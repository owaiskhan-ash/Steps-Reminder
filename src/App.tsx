import { useCallback, useEffect, useRef, useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { Toasts, type ToastItem } from './components/Toasts'
import { Today } from './screens/Today'
import { History } from './screens/History'
import { Settings } from './screens/Settings'
import { Onboarding } from './screens/Onboarding'
import {
  DEFAULT_STATE,
  clearState,
  loadState,
  saveState,
  seedHistory,
  stepsToday,
  todayKey,
  type AppState,
} from './lib/storage'
import { useSimulator, useStepTracker } from './lib/useStepTracker'
import {
  buzz,
  fireInAppReminder,
  isNative,
  scheduleDailyReminder,
} from './lib/notify'
import { fmt, prettyTime } from './lib/format'

export default function App() {
  const [state, setState] = useState<AppState>(() => seedHistory(loadState()))
  const [tab, setTab] = useState<Tab>('today')
  const [sensorOn, setSensorOn] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [dayKey, setDayKey] = useState(todayKey())
  const goalCelebrated = useRef(false)

  const steps = stepsToday(state)
  const remaining = Math.max(0, state.goal - steps)

  useEffect(() => saveState(state), [state])

  const pushToast = useCallback((title: string, body: string) => {
    setToasts((prev) => [
      ...prev.slice(-2),
      { id: Date.now() + Math.random(), title, body },
    ])
  }, [])

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addSteps = useCallback((n: number) => {
    if (n <= 0) return
    setState((prev) => {
      const key = todayKey()
      const current = prev.days[key] ?? { steps: 0, goal: prev.goal }
      return {
        ...prev,
        days: {
          ...prev.days,
          [key]: { steps: Math.min(999999, current.steps + n), goal: prev.goal },
        },
      }
    })
  }, [])

  const tracker = useStepTracker({
    enabled: sensorOn,
    sensitivity: state.sensitivity,
    onStep: () => addSteps(1),
  })

  useSimulator(simulating, addSteps)

  /* ---------------------------------------------------------- goal cheer -- */
  useEffect(() => {
    if (steps >= state.goal && state.goal > 0) {
      if (!goalCelebrated.current) {
        goalCelebrated.current = true
        buzz()
        pushToast('Target complete', `${fmt(steps)} steps — your ${fmt(state.goal)} step mark is met. Beautifully done.`)
      }
    } else if (steps < state.goal * 0.92) {
      goalCelebrated.current = false
    }
  }, [steps, state.goal, pushToast])

  /* ------------------------------------------------------- day rollover --- */
  useEffect(() => {
    const id = window.setInterval(() => {
      const key = todayKey()
      if (key !== dayKey) {
        setDayKey(key)
        goalCelebrated.current = false
      }
    }, 20000)
    return () => window.clearInterval(id)
  }, [dayKey])

  /* ---------------------------------------------------- daily reminder ----- */
  // Keep the scheduled notification copy in sync with the live count.
  useEffect(() => {
    if (!state.onboarded) return
    const id = window.setTimeout(() => {
      scheduleDailyReminder(state.reminderTime, remaining, state.goal)
    }, 1400)
    return () => window.clearTimeout(id)
  }, [state.onboarded, state.reminderTime, state.goal, remaining, dayKey])

  // In-app firing for the web build (the native schedule handles itself).
  useEffect(() => {
    if (!state.onboarded) return
    const check = () => {
      if (isNative()) return
      const [h, m] = state.reminderTime.split(':').map(Number)
      const now = new Date()
      const target = new Date()
      target.setHours(h || 0, m || 0, 0, 0)
      if (now.getTime() < target.getTime()) return
      const firedKey = `sc-fired-${todayKey()}`
      if (localStorage.getItem(firedKey)) return
      localStorage.setItem(firedKey, '1')
      const copy = fireInAppReminder(
        Math.max(0, state.goal - stepsToday(state)),
        state.goal,
      )
      pushToast(copy.title, copy.body)
    }
    check()
    const id = window.setInterval(check, 30000)
    return () => window.clearInterval(id)
  }, [state, pushToast])

  /* ------------------------------------------------------------ updates --- */
  const setGoal = (goal: number) => {
    setState((prev) => {
      const key = todayKey()
      const current = prev.days[key]
      return {
        ...prev,
        goal,
        days: current ? { ...prev.days, [key]: { ...current, goal } } : prev.days,
      }
    })
  }

  const setReminderTime = (reminderTime: string) => {
    setState((prev) => ({ ...prev, reminderTime }))
    pushToast('Reminder set', `We’ll check your steps at ${prettyTime(reminderTime)} each day.`)
  }

  const reset = () => {
    clearState()
    setSensorOn(false)
    setSimulating(false)
    setTab('today')
    goalCelebrated.current = false
    setState({ ...DEFAULT_STATE })
    pushToast('Everything cleared', 'Start fresh whenever you’re ready.')
  }

  const completeOnboarding = (goal: number, reminderTime: string) => {
    setState((prev) => ({ ...prev, onboarded: true, goal, reminderTime }))
    pushToast('Your mark is set', `${fmt(goal)} steps a day · reminder at ${prettyTime(reminderTime)}.`)
    // Ask the sensor for permission straight after a user gesture.
    if (isNative()) setSensorOn(true)
  }

  if (!state.onboarded) {
    return (
      <div className="stage">
        <main className="app">
          <Onboarding
            initialGoal={state.goal}
            initialTime={state.reminderTime}
            onComplete={completeOnboarding}
          />
          <Toasts items={toasts} onDismiss={dismissToast} />
        </main>
      </div>
    )
  }

  return (
    <div className="stage">
      <main className="app">
        {tab === 'today' && (
          <Today
            state={state}
            steps={steps}
            trackerStatus={tracker.status}
            trackerDetail={tracker.detail}
            simulating={simulating}
            sensorOn={sensorOn}
            onToggleSim={() => setSimulating((v) => !v)}
            onToggleSensor={() => {
              if (!sensorOn) {
                setSensorOn(true)
                setSimulating(false)
              } else {
                setSensorOn(false)
              }
            }}
            onOpenSettings={() => setTab('settings')}
            onToast={pushToast}
          />
        )}
        {tab === 'history' && <History state={state} />}
        {tab === 'settings' && (
          <Settings
            state={state}
            steps={steps}
            onGoal={setGoal}
            onTime={setReminderTime}
            onSensitivity={(n) => setState((prev) => ({ ...prev, sensitivity: n }))}
            onStride={(n) => setState((prev) => ({ ...prev, strideMeters: n }))}
            onReset={reset}
            onToast={pushToast}
          />
        )}

        <TabBar tab={tab} onChange={setTab} />
        <Toasts items={toasts} onDismiss={dismissToast} />
      </main>
    </div>
  )
}
