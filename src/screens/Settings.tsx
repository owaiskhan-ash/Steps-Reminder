import { useEffect, useState } from 'react'
import { Stitch } from '../components/Stitch'
import { Modal } from '../components/Modal'
import { Bell, Clock, Footsteps, House, Ruler } from '../components/Icons'
import {
  getHomeWidgetStatus,
  nativeStepsSupported,
  pinHomeWidget,
  type HomeWidgetStatus,
  type StepSource,
} from '../lib/nativeSteps'
import { fmt, minutesUntil, prettyTime } from '../lib/format'
import type { AppState } from '../lib/storage'
import { testNotification } from '../lib/notify'

type Props = {
  state: AppState
  steps: number
  stepSource: StepSource
  syncLabel: string
  sourceReason: string
  onSync: () => void
  onExperimental: (on: boolean) => void
  onGoal: (goal: number) => void
  onTime: (time: string) => void
  onSensitivity: (n: number) => void
  onStride: (n: number) => void
  onReset: () => void
  onGoHome: () => void
  onToast: (title: string, body: string) => void
}

const SENSITIVITY_LABELS = ['Strictest', 'Strict', 'Balanced', 'Loose', 'Loosest']

export function Settings({
  state,
  steps,
  stepSource,
  sourceReason,
  syncLabel,
  onSync,
  onExperimental,
  onGoal,
  onTime,
  onSensitivity,
  onStride,
  onReset,
  onGoHome,
  onToast,
}: Props) {
  const [confirmReset, setConfirmReset] = useState(false)
  const [widgetStatus, setWidgetStatus] = useState<HomeWidgetStatus>({
    supported: nativeStepsSupported(),
    pinSupported: false,
    count: 0,
  })
  const remaining = Math.max(0, state.goal - steps)
  const untilReminder = minutesUntil(state.reminderTime)

  useEffect(() => {
    let alive = true
    const refresh = () => {
      void getHomeWidgetStatus().then((s) => {
        if (alive) setWidgetStatus(s)
      })
    }
    refresh()
    const onVis = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return (
    <div className="screen">
      <header className="topbar">
        <div>
          <div className="brand-name">Preferences</div>
          <div className="brand-sub">Tuned to your pace</div>
        </div>
        <button className="icon-btn" onClick={onGoHome} aria-label="Back to today">
          <House size={19} />
        </button>
      </header>

      <section className="card card--leather">
        <Stitch inset={6} radius={16} double opacity={0.4} />
        <div className="field-label">
          <span className="label">
            <Footsteps size={12} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            Daily target
          </span>
          <span className="field-value">
            {fmt(state.goal)}
            <small>steps</small>
          </span>
        </div>
        <input
          className="slider"
          type="range"
          min={2000}
          max={20000}
          step={500}
          value={state.goal}
          onChange={(e) => onGoal(Number(e.target.value))}
          aria-label="Daily step target"
        />
        <div className="presets">
          {[6000, 8000, 10000, 12000].map((p) => (
            <button
              key={p}
              className={`preset ${state.goal === p ? 'preset--on' : ''}`}
              onClick={() => onGoal(p)}
            >
              {p / 1000}k
            </button>
          ))}
        </div>
      </section>

      <section className="card card--felt">
        <Stitch inset={6} radius={16} opacity={0.32} />
        <div className="field-label">
          <span className="label">
            <Clock size={12} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            Reminder time
          </span>
          <span className="field-value" style={{ fontSize: 13 }}>
            in {Math.floor(untilReminder / 60)}h {untilReminder % 60}m
          </span>
        </div>
        <div className="time-row">
          <input
            className="time-input"
            type="time"
            value={state.reminderTime}
            onChange={(e) => onTime(e.target.value)}
            aria-label="Reminder time"
          />
          <button
            className="btn btn--felt"
            style={{ flex: '0 0 auto', padding: '14px 14px' }}
            onClick={async () => {
              const ok = await testNotification(remaining, state.goal)
              onToast(
                ok ? 'Reminder sent' : 'Reminder not sent',
                ok
                  ? `Test nudge on its way — check your notifications. Daily reminder stays at ${prettyTime(state.reminderTime)}.`
                  : 'Notifications are blocked. Allow them in your device or browser settings, then try again.',
              )
            }}
          >
            <Bell size={15} /> Test
          </button>
        </div>
        <p className="hint">
          You’ll hear from us only at this hour, and only about steps still missing.
        </p>
      </section>

      <section className="card card--suede">
        <Stitch inset={6} radius={16} color="rgba(74,45,22,.7)" opacity={0.6} />
        <div className="settings-row" style={{ paddingTop: 0, borderColor: 'rgba(74,45,22,.18)' }}>
          <div>
            <div className="settings-row-title">{syncLabel}</div>
            <div className="settings-row-sub">
              {stepSource === 'pedometer'
                ? 'Read from the phone’s own step counter — it keeps counting while the app is closed, and gestures cannot add steps.'
                : sourceReason || 'No phone step counter available.'}
            </div>
          </div>
          <button
            className="btn btn--ghost"
            onClick={onSync}
            style={{ padding: '10px 12px', flex: 'none' }}
          >
            Sync
          </button>
        </div>
        <div className="settings-row" style={{ borderColor: 'rgba(74,45,22,.18)' }}>
          <div>
            <div className="settings-row-title">Fallback: motion sensor</div>
            <div className="settings-row-sub">
              Only for phones without a step counter. Uses the accelerometer and gyroscope; gestures
              can still add steps.
            </div>
          </div>
          <button
            className={`switch ${state.experimentalMotion ? 'switch--on' : ''}`}
            onClick={() => onExperimental(!state.experimentalMotion)}
            aria-pressed={state.experimentalMotion}
            aria-label="Fallback motion counting"
            style={stepSource === 'pedometer' ? { opacity: 0.45 } : undefined}
          />
        </div>
        <div className="field-label" style={{ marginTop: 14 }}>
          <span className="label" style={{ color: 'rgba(20,11,7,.6)' }}>
            Detection strictness
          </span>
          <span className="field-value" style={{ color: '#140b07' }}>
            {SENSITIVITY_LABELS[Math.min(4, Math.max(0, state.sensitivity - 1))]}
          </span>
        </div>
        <input
          className="slider"
          type="range"
          min={1}
          max={5}
          step={1}
          value={state.sensitivity}
          onChange={(e) => onSensitivity(Number(e.target.value))}
          aria-label="Step detection sensitivity"
        />
        <p className="hint" style={{ color: 'rgba(20,11,7,.62)' }}>
          On Android the hardware pedometer counts and ignores hand movement entirely. Otherwise a
          step needs gentle rotation, steady cadence and an impact-shaped waveform, and only counts
          once you have taken several in a row. Rotating, swinging or shaking the phone adds
          nothing.
        </p>

        <div style={{ height: 1, background: 'rgba(74,45,22,.18)', margin: '16px 0 4px' }} />

        <div className="field-label" style={{ marginTop: 12 }}>
          <span className="label" style={{ color: 'rgba(20,11,7,.6)' }}>
            <Ruler size={12} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            Stride length
          </span>
          <span className="field-value" style={{ color: '#140b07', fontSize: 17 }}>
            {(state.strideMeters * 100).toFixed(0)}
            <small style={{ color: 'rgba(20,11,7,.55)' }}>cm</small>
          </span>
        </div>
        <input
          className="slider"
          type="range"
          min={0.55}
          max={0.95}
          step={0.01}
          value={state.strideMeters}
          onChange={(e) => onStride(Number(e.target.value))}
          aria-label="Stride length"
        />
      </section>

      <section className="card card--felt">
        <Stitch inset={6} radius={16} opacity={0.3} />
        <div className="settings-row" style={{ paddingTop: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <div className="widget-swatch" aria-hidden="true">
              <div className="widget-tile">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#ffffff">
                  <path d="M 7.4 1.8 C 4.8 1.8 3.2 4.3 3.4 7.4 C 3.5 9.7 4.4 11.2 4.5 12.7 L 8.9 12.7 C 8.9 11.0 10.3 9.2 10.4 6.6 C 10.5 3.8 9.4 1.8 7.4 1.8 Z" />
                  <path d="M 4.6 14.3 L 8.8 14.3 L 8.8 15.3 C 8.8 16.9 7.9 18.0 6.7 18.0 C 5.5 18.0 4.6 16.9 4.6 15.3 Z" />
                  <path d="M 16.6 6.0 C 14.6 6.0 13.5 8.0 13.6 10.8 C 13.7 13.4 15.1 15.2 15.1 16.9 L 19.5 16.9 C 19.6 15.4 20.5 13.9 20.6 11.6 C 20.8 8.5 19.2 6.0 16.6 6.0 Z" />
                  <path d="M 15.2 18.5 L 19.4 18.5 L 19.4 19.5 C 19.4 21.1 18.5 22.2 17.3 22.2 C 16.1 22.2 15.2 21.1 15.2 19.5 Z" />
                </svg>
                <span className="widget-tile-steps">
                  {steps >= 100000 ? `${Math.floor(steps / 1000)}k` : fmt(steps)}
                </span>
              </div>
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="settings-row-title">Home screen widget · 1×1</div>
              <div className="settings-row-sub">
                {widgetStatus.count > 0
                  ? `${widgetStatus.count} placed on home screen · 95% transparent white footsteps & daily count.`
                  : '95% transparent 1×1 tile with white footsteps and your daily step count.'}
              </div>
            </div>
          </div>
          {widgetStatus.supported ? (
            <button
              className="btn btn--felt"
              style={{ padding: '10px 13px', flex: 'none' }}
              onClick={async () => {
                const outcome = await pinHomeWidget()
                if (outcome === 'requested') {
                  onToast(
                    'Pin 1×1 widget',
                    'Confirm in your launcher prompt, or drag Steps (1×1) onto your home screen.',
                  )
                } else {
                  onToast(
                    'Add from home screen',
                    'Long-press your home screen → Widgets → SC Step Reminder → Steps (1×1).',
                  )
                }
                const next = await getHomeWidgetStatus()
                setWidgetStatus(next)
              }}
            >
              {widgetStatus.count > 0 ? 'Add another' : 'Add 1×1'}
            </button>
          ) : (
            <span className="chip" style={{ flex: 'none' }}>
              Android APK
            </span>
          )}
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-row-title">Reset everything</div>
            <div className="settings-row-sub">
              Clears your goal, reminder and all recorded days on this device.
            </div>
          </div>
          <button
            className="btn btn--felt"
            onClick={() => setConfirmReset(true)}
            style={{ padding: '10px 13px', flex: 'none' }}
          >
            Reset
          </button>
        </div>
        <div className="settings-row" style={{ paddingBottom: 0, borderBottom: 0 }}>
          <div>
            <div className="settings-row-title">SC · Step Reminder</div>
            <div className="settings-row-sub">
              Version 1.4.0 · leather, felt and suede · made quietly
            </div>
          </div>
        </div>
      </section>

      <Modal open={confirmReset} onClose={() => setConfirmReset(false)}>
        <h2>Start over?</h2>
        <p>Your goal, reminder time and every recorded day will be removed from this device.</p>
        <div className="modal-actions">
          <button className="btn btn--felt" onClick={() => setConfirmReset(false)}>
            Keep it
          </button>
          <button
            className="btn btn--primary"
            onClick={() => {
              setConfirmReset(false)
              onReset()
            }}
          >
            Reset
          </button>
        </div>
      </Modal>

      <p className="footnote" style={{ marginTop: 'auto' }}>
        Reminders use local notifications. No account, no cloud, no tracking.
      </p>
    </div>
  )
}
