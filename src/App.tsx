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
import { useStepSync } from './lib/useStepSync'
import {
  buzz,
  fireInAppReminder,
  isNative,
  scheduleDailyReminder,
} from './lib/notify'
import { fmt, prettyTime } from './lib/format'
import { clearReminderCopy } from './lib/notify'

export default function App() {
  const [state, setState] = useState<AppState>(() => seedHistory(loadState()))
  const [tab, setTab] = useState<Tab>('today')
  // The sensor starts itself — there is no longer a widget on the home screen.
  const [sensorOn, setSensorOn] = useState<boolean>(() => loadState().onboarded)
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

  /** Authoritative total from the phone: never lowers what is already stored. */
  const adoptTodaySteps = useCallback((n: number) => {
    if (!Number.isFinite(n) || n <= 0) return
    setState((prev) => {
      const key = todayKey()
      const current = prev.days[key]?.steps ?? 0
      if (n <= current) return prev
      return {
        ...prev,
        days: { ...prev.days, [key]: { steps: Math.round(n), goal: prev.goal } },
      }
    })
  }, [])

  /** Days banked at midnight while the app was closed. */
  const mergeHistory = useCallback((days: Record<string, number>) => {
    setState((prev) => {
      let changed = false
      const next = { ...prev.days }
      for (const [date, steps] of Object.entries(days)) {
        const existing = next[date]?.steps ?? 0
        if (steps > existing) {
          next[date] = { steps, goal: prev.goal }
          changed = true
        }
      }
      return changed ? { ...prev, days: next } : prev
    })
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

  const sync = useStepSync({
    enabled: state.onboarded,
    onTodaySteps: adoptTodaySteps,
    onHistory: mergeHistory,
  })

  const tracker = useStepTracker({
    enabled: sensorOn && state.experimentalMotion && sync.source !== 'pedometer',
    sensitivity: state.sensitivity,
    experimentalMotion: state.experimentalMotion,
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
    clearReminderCopy()
    setTab('today')
    goalCelebrated.current = false
    setState({ ...DEFAULT_STATE })
    pushToast('Everything cleared', 'Start fresh whenever you’re ready.')
  }

  const completeOnboarding = (goal: number, reminderTime: string) => {
    setState((prev) => ({ ...prev, onboarded: true, goal, reminderTime }))
    pushToast('Your mark is set', `${fmt(goal)} steps a day · reminder at ${prettyTime(reminderTime)}.`)
    // Straight after a user gesture, so the motion prompt (iOS) is allowed.
    setSensorOn(true)
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
            stepSource={sync.source === 'pedometer' ? 'pedometer' : tracker.source}
            sourceReason={sync.source === 'pedometer' ? '' : sync.reason || tracker.reason}
            countedSince={sync.since}
            onOpenSettings={() => setTab('settings')}
          />
        )}
        {tab === 'history' && <History state={state} />}
        {tab === 'settings' && (
          <Settings
            state={state}
            steps={steps}
            simulating={simulating}
            trackerStatus={tracker.status}
            trackerDetail={tracker.detail}
            diagnostics={tracker.diagnostics}
            stepSource={sync.source === 'pedometer' ? 'pedometer' : tracker.source}
            sourceReason={sync.reason}
            syncLabel={sync.label}
            syncLast={sync.lastSync}
            syncCounter={sync.counter}
            syncSince={sync.since}
            syncRebooted={sync.rebooted}
            onSync={() => void sync.sync()}
            onExperimental={(on) =>
              setState((prev) => ({ ...prev, experimentalMotion: on }))
            }
            onLogSteps={(n) => addSteps(n)}
            onGoal={setGoal}
            onTime={setReminderTime}
            onSensitivity={(n) => setState((prev) => ({ ...prev, sensitivity: n }))}
            onStride={(n) => setState((prev) => ({ ...prev, strideMeters: n }))}
            onToggleSim={() => setSimulating((v) => !v)}
            onReset={reset}
            onGoHome={() => setTab('today')}
            onToast={pushToast}
          />
        )}

        <TabBar tab={tab} onChange={setTab} />
        <Toasts items={toasts} onDismiss={dismissToast} />
      </main>
    </div>
  )
}
