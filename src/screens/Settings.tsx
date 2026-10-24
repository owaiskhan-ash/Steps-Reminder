import { useState } from 'react'
import { Stitch } from '../components/Stitch'
import { Bell, Clock, Footsteps, Ruler, Spark } from '../components/Icons'
import { fmt, minutesUntil, prettyTime } from '../lib/format'
import type { AppState } from '../lib/storage'
import { testNotification } from '../lib/notify'

type Props = {
  state: AppState
  steps: number
  onGoal: (goal: number) => void
  onTime: (time: string) => void
  onSensitivity: (n: number) => void
  onStride: (n: number) => void
  onReset: () => void
  onToast: (title: string, body: string) => void
}

export function Settings({
  state,
  steps,
  onGoal,
  onTime,
  onSensitivity,
  onStride,
  onReset,
  onToast,
}: Props) {
  const [confirmReset, setConfirmReset] = useState(false)
  const remaining = Math.max(0, state.goal - steps)

  return (
    <div className="screen">
      <header className="topbar">
        <div>
          <div className="brand-name">Preferences</div>
          <div className="brand-sub">Tuned to your pace</div>
        </div>
        <div className="reminder-icon" style={{ width: 38, height: 38 }}>
          <Spark size={18} />
        </div>
      </header>

      <section className="card card--leather">
        <Stitch inset={8} radius={16} double opacity={0.4} />
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
        <Stitch inset={8} radius={16} opacity={0.32} />
        <div className="field-label">
          <span className="label">
            <Clock size={12} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            Reminder time
          </span>
          <span className="field-value" style={{ fontSize: 13 }}>
            in {Math.floor(minutesUntil(state.reminderTime) / 60)}h{' '}
            {minutesUntil(state.reminderTime) % 60}m
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
        <Stitch inset={8} radius={16} color="rgba(74,45,22,.7)" opacity={0.6} />
        <div className="field-label">
          <span className="label" style={{ color: 'rgba(42,26,14,.6)' }}>
            Sensor sensitivity
          </span>
          <span className="field-value" style={{ color: '#2c1b0e' }}>
            {['Light', 'Soft', 'Balanced', 'Firm', 'Heavy'][Math.min(4, Math.max(0, state.sensitivity - 1))]}
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
          aria-label="Step sensor sensitivity"
        />
        <p className="hint" style={{ color: 'rgba(42,26,14,.55)' }}>
          Turn it down for light footfalls, up if a bumpy commute adds phantom steps.
        </p>

        <div style={{ height: 1, background: 'rgba(74,45,22,.18)', margin: '16px 0 4px' }} />

        <div className="field-label" style={{ marginTop: 12 }}>
          <span className="label" style={{ color: 'rgba(42,26,14,.6)' }}>
            <Ruler size={12} style={{ verticalAlign: '-2px', marginRight: 6 }} />
            Stride length
          </span>
          <span className="field-value" style={{ color: '#2c1b0e', fontSize: 17 }}>
            {(state.strideMeters * 100).toFixed(0)}
            <small style={{ color: 'rgba(42,26,14,.5)' }}>cm</small>
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
        <Stitch inset={8} radius={16} opacity={0.3} />
        <div className="settings-row" style={{ paddingTop: 0 }}>
          <div>
            <div className="settings-row-title">Reset everything</div>
            <div className="settings-row-sub">
              Clears your goal, reminder and all recorded days on this device.
            </div>
          </div>
          <button className="btn btn--felt" onClick={() => setConfirmReset(true)} style={{ padding: '10px 13px' }}>
            Reset
          </button>
        </div>
        <div className="settings-row" style={{ paddingBottom: 0, borderBottom: 0 }}>
          <div>
            <div className="settings-row-title">SC · Step Reminder</div>
            <div className="settings-row-sub">
              Version 1.0 · leather, felt and suede · made quietly
            </div>
          </div>
        </div>
      </section>

      {confirmReset && (
        <div className="modal-scrim" onClick={() => setConfirmReset(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
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
          </div>
        </div>
      )}

      <p className="footnote" style={{ marginTop: 'auto' }}>
        Reminders use local notifications. No account, no cloud, no tracking.
      </p>
    </div>
  )
}
