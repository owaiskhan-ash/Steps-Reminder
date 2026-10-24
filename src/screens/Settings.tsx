import { useState } from 'react'
import { Stitch } from '../components/Stitch'
import { Modal } from '../components/Modal'
import { Bell, Clock, Footsteps, House, Play, Ruler, Pause } from '../components/Icons'
import type { DetectorDiagnostics, TrackerStatus } from '../lib/useStepTracker'
import type { StepSource } from '../lib/nativeSteps'
import { fmt, minutesUntil, prettyTime } from '../lib/format'
import type { AppState } from '../lib/storage'
import { testNotification } from '../lib/notify'

type Props = {
  state: AppState
  steps: number
  simulating: boolean
  trackerStatus: TrackerStatus
  trackerDetail: string
  diagnostics: DetectorDiagnostics | null
  stepSource: StepSource
  sourceReason: string
  syncLabel: string
  syncLast: number | null
  syncCounter: number | null
  syncSince: string | null
  syncRebooted: boolean
  onSync: () => void
  onExperimental: (on: boolean) => void
  onLogSteps: (n: number) => void
  onGoal: (goal: number) => void
  onTime: (time: string) => void
  onSensitivity: (n: number) => void
  onStride: (n: number) => void
  onToggleSim: () => void
  onReset: () => void
  onGoHome: () => void
  onToast: (title: string, body: string) => void
}

const SENSITIVITY_LABELS = ['Strictest', 'Strict', 'Balanced', 'Loose', 'Loosest']

export function Settings({
  state,
  steps,
  simulating,
  trackerStatus,
  trackerDetail,
  diagnostics,
  stepSource,
  sourceReason,
  syncLabel,
  syncLast,
  syncCounter,
  syncSince,
  syncRebooted,
  onSync,
  onExperimental,
  onLogSteps,
  onGoal,
  onTime,
  onSensitivity,
  onStride,
  onToggleSim,
  onReset,
  onGoHome,
  onToast,
}: Props) {
  const [confirmReset, setConfirmReset] = useState(false)
  const remaining = Math.max(0, state.goal - steps)
  const untilReminder = minutesUntil(state.reminderTime)

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
        <Stitch inset={6} radius={16} opacity={0.34} />
        <div className="label">Detector diagnostics</div>
        <div className="diag-grid">
          <DiagRow
            label="Source"
            value={
              stepSource === 'pedometer'
                ? 'Phone step counter'
                : stepSource === 'motion'
                  ? 'Motion sensor (experimental)'
                  : 'None'
            }
            warn={stepSource === 'motion'}
          />
          <DiagRow
            label="Counter"
            value={syncCounter != null ? `${Math.round(syncCounter).toLocaleString()} since boot` : '—'}
          />
          <DiagRow
            label="Last sync"
            value={syncLast ? new Date(syncLast).toLocaleTimeString() : '—'}
          />
          <DiagRow label="Day started" value={syncSince ? `${syncSince} (mid-day)` : 'Midnight'} />
          {syncRebooted && <DiagRow label="Note" value="Phone rebooted — counter restarted" warn />}
          <DiagRow label="Sensor" value={trackerDetail || 'starting…'} />
          <DiagRow
            label="Status"
            value={
              trackerStatus === 'running'
                ? 'listening'
                : trackerStatus === 'requesting'
                  ? 'starting'
                  : trackerStatus
            }
          />
          <DiagRow
            label="Gyroscope"
            value={diagnostics ? (diagnostics.hasGyro ? 'active' : 'unavailable') : '—'}
          />
          <DiagRow
            label="Rotation"
            value={
              diagnostics
                ? `${(diagnostics.angular * (180 / Math.PI)).toFixed(0)}°/s of ${(diagnostics.angularLimit * (180 / Math.PI)).toFixed(0)}`
                : '—'
            }
            warn={!!diagnostics && diagnostics.angular > diagnostics.angularLimit * 0.75}
          />
          <DiagRow
            label="Cadence"
            value={diagnostics && diagnostics.cadence ? `${diagnostics.cadence} steps/min` : '—'}
          />
          <DiagRow
            label="Impulse"
            value={
              diagnostics
                ? `skew ${diagnostics.skew.toFixed(2)} · crest ${diagnostics.crest.toFixed(2)}`
                : '—'
            }
            warn={!!diagnostics && diagnostics.skew < 0.2 && diagnostics.crest > 0}
          />
          <DiagRow
            label="Walk run"
            value={
              diagnostics
                ? `${diagnostics.sustain} / ${diagnostics.sustainNeeded} steps`
                : '—'
            }
          />
          <DiagRow label="Verdict" value={diagnostics?.lastReason ?? '—'} />
          <DiagRow
            label="Credited"
            value={
              diagnostics
                ? `${diagnostics.accepted} counted · ${diagnostics.rejected} rejected`
                : '—'
            }
          />
        </div>
        {stepSource === 'none' && sourceReason ? (
          <p className="hint" style={{ marginTop: 12 }}>
            Why nothing is counting: {sourceReason} Nothing is being counted rather than guessing
            from motion — switch on the motion sensor above if you want counting anyway.
          </p>
        ) : (
          <p className="hint" style={{ marginTop: 12 }}>
            Walk a few paces and this should read “counting”. Rotate, swing or shake the phone and
            watch Rotation cross its limit, or the Impulse line give way.
          </p>
        )}
      </section>

      <section className="card card--felt">
        <Stitch inset={6} radius={16} opacity={0.3} />
        <div className="settings-row" style={{ paddingTop: 0 }}>
          <div>
            <div className="settings-row-title">Log steps by hand</div>
            <div className="settings-row-sub">For days the phone stayed in a drawer.</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[100, 500].map((n) => (
              <button
                key={n}
                className="btn btn--felt"
                onClick={() => onLogSteps(n)}
                style={{ padding: '10px 11px', flex: 'none' }}
              >
                +{n}
              </button>
            ))}
          </div>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-row-title">Demo walk</div>
            <div className="settings-row-sub">
              Adds steps at a walking pace so you can preview the dial. Real counting uses the
              sensor.
            </div>
          </div>
          <button
            className="btn btn--felt"
            onClick={onToggleSim}
            style={{ padding: '10px 13px', flex: 'none' }}
          >
            {simulating ? <Pause size={13} /> : <Play size={13} />}
            {simulating ? 'Stop' : 'Start'}
          </button>
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
              Version 1.3.0 · leather, felt and suede · made quietly
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

function DiagRow({
  label,
  value,
  warn = false,
}: {
  label: string
  value: string
  warn?: boolean
}) {
  return (
    <div className="diag-row">
      <span className="diag-label">{label}</span>
      <span className={`diag-value ${warn ? 'diag-value--warn' : ''}`}>{value}</span>
    </div>
  )
}
