import { useState } from 'react'
import { Stitch } from '../components/Stitch'
import { Arrow, Bell, Check, Footsteps, Spark } from '../components/Icons'
import { fmt } from '../lib/format'
import { ensureNotificationPermission } from '../lib/notify'

type Props = {
  initialGoal: number
  initialTime: string
  onComplete: (goal: number, time: string) => void
}

const PRESETS = [6000, 8000, 10000, 12000]

export function Onboarding({ initialGoal, initialTime, onComplete }: Props) {
  const [step, setStep] = useState(0)
  const [goal, setGoal] = useState(initialGoal)
  const [time, setTime] = useState(initialTime)
  const [notifyState, setNotifyState] = useState<'idle' | 'asking' | 'granted' | 'denied'>('idle')

  const askPermission = async () => {
    setNotifyState('asking')
    const ok = await ensureNotificationPermission()
    setNotifyState(ok ? 'granted' : 'denied')
  }

  const finishTime = (value: string) => setTime(value)

  return (
    <div className="screen onboard">
      <div className="onboard-hero">
        <div className="onboard-logo">
          <img src="/icons/icon-320.png" alt="SC Step Reminder" />
        </div>
        <h1 className="onboard-title">
          {step === 0 ? 'Set your daily mark' : 'When should we nudge you?'}
        </h1>
        <p className="onboard-sub">
          {step === 0
            ? 'Two things and you are walking: how far you want to go each day, and when you would like a gentle reminder.'
            : 'We will only speak up if the day is slipping away without your steps.'}
        </p>
      </div>

      {step === 0 ? (
        <div className="card card--leather">
          <Stitch inset={6} radius={16} double />
          <div className="field-label">
            <span className="label">Daily step target</span>
            <span className="field-value">
              {fmt(goal)}
              <small>steps</small>
            </span>
          </div>

          <input
            className="slider"
            type="range"
            min={2000}
            max={20000}
            step={500}
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value))}
            aria-label="Daily step target"
          />

          <div className="presets">
            {PRESETS.map((p) => (
              <button
                key={p}
                className={`preset ${goal === p ? 'preset--on' : ''}`}
                onClick={() => setGoal(p)}
              >
                {p / 1000}k
              </button>
            ))}
          </div>

          <p className="hint">
            {goal <= 5000
              ? 'A gentle start — about 40 minutes of walking spread through the day.'
              : goal <= 9000
                ? 'A steady, sustainable target. Roughly an hour of movement in total.'
                : goal <= 13000
                  ? 'A committed target. Think one long walk plus a few short ones.'
                  : 'An ambitious target. Build up to it over a few weeks.'}
          </p>
        </div>
      ) : (
        <div className="card card--leather">
          <Stitch inset={6} radius={16} double />
          <div className="field-label">
            <span className="label">Reminder time</span>
            <span className="field-value" style={{ fontSize: 15 }}>
              every day
            </span>
          </div>

          <div className="time-row">
            <input
              className="time-input"
              type="time"
              value={time}
              onChange={(e) => finishTime(e.target.value)}
              aria-label="Reminder time"
            />
          </div>

          <p className="hint">
            At this hour each day we check your count. If steps are missing, you get a note like
            “you’re missing out 2,000 steps for the day.”
          </p>

          <div className="settings-row" style={{ marginTop: 6 }}>
            <div>
              <div className="settings-row-title">Allow notifications</div>
              <div className="settings-row-sub">
                {notifyState === 'granted'
                  ? 'Notifications are on. We will stay quiet otherwise.'
                  : notifyState === 'denied'
                    ? 'Blocked in system settings — you can enable it later.'
                    : 'Needed for reminders outside the app.'}
              </div>
            </div>
            <button
              className={`switch ${notifyState === 'granted' ? 'switch--on' : ''}`}
              onClick={askPermission}
              aria-label="Allow notifications"
              aria-pressed={notifyState === 'granted'}
            />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 9, marginTop: 'auto' }}>
        {step > 0 && (
          <button className="btn btn--felt" onClick={() => setStep(0)}>
            Back
          </button>
        )}
        <button
          className="btn btn--primary"
          style={{ flex: 1 }}
          onClick={() => {
            if (step === 0) setStep(1)
            else onComplete(goal, time)
          }}
        >
          {step === 0 ? (
            <>
              Continue <Arrow size={15} />
            </>
          ) : (
            <>
              <Check size={15} /> Start walking
            </>
          )}
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 7, alignItems: 'center' }}>
        {step === 0 ? (
          <>
            <Footsteps size={13} className="toast-icon" />
            <span className="footnote" style={{ padding: 0 }}>
              Step 1 of 2 · target
            </span>
          </>
        ) : (
          <>
            <Bell size={13} className="toast-icon" />
            <span className="footnote" style={{ padding: 0 }}>
              Step 2 of 2 · reminder
            </span>
          </>
        )}
      </div>
    </div>
  )
}
