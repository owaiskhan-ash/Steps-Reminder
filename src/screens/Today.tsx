import { Dial } from '../components/Dial'
import { Stitch } from '../components/Stitch'
import {
  Bell,
  Clock,
  Flame,
  Footsteps,
  Pause,
  Play,
  Ruler,
  Spark,
} from '../components/Icons'
import { fmt, humanGap, kcal, km, minutesUntil, prettyDate, prettyTime, pct, shortDay } from '../lib/format'
import type { AppState } from '../lib/storage'
import { todayKey } from '../lib/storage'
import type { TrackerStatus } from '../lib/useStepTracker'

type Props = {
  state: AppState
  steps: number
  trackerStatus: TrackerStatus
  trackerDetail: string
  simulating: boolean
  sensorOn: boolean
  onToggleSim: () => void
  onToggleSensor: () => void
  onOpenSettings: () => void
  onToast: (title: string, body: string) => void
}

const STATUS_COPY: Record<TrackerStatus, string> = {
  idle: 'Sensor resting. Start it when you begin moving.',
  requesting: 'Waiting for permission to read the motion sensor…',
  running: 'Counting footfalls from the motion sensor.',
  denied: 'Motion access declined. Enable it in system settings.',
  unsupported: 'No motion sensor here — use the demo walk to preview.',
}

export function Today({
  state,
  steps,
  trackerStatus,
  trackerDetail,
  simulating,
  sensorOn,
  onToggleSim,
  onToggleSensor,
  onOpenSettings,
  onToast,
}: Props) {
  const goal = state.goal
  const remaining = Math.max(0, goal - steps)
  const goalReached = steps >= goal
  const progress = pct(steps, goal)
  const mins = minutesUntil(state.reminderTime)
  const streak = computeStreak(state)
  const live = trackerStatus === 'running'

  const days = lastSevenDays(state)

  return (
    <div className="screen">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">
            <img src="/icons/icon-192.png" alt="" />
          </div>
          <div>
            <div className="brand-name">SC</div>
            <div className="brand-sub">Step Reminder</div>
          </div>
        </div>
        <button className="icon-btn" onClick={onOpenSettings} aria-label="Settings">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <circle cx="12" cy="12" r="3.2" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
        </button>
      </header>

      <section className="card card--leather dial-card">
        <Stitch inset={9} radius={17} double opacity={0.42} />
        <div className="dial-head">
          <span className="label">{prettyDate()}</span>
          <span className={`chip ${live || simulating ? 'chip--live' : ''}`}>
            <span className="dot" style={{ background: live || simulating ? 'var(--good)' : 'rgba(241,228,204,.3)', boxShadow: 'none' }} />
            {simulating ? 'Demo walk' : live ? 'Recording' : 'Paused'}
          </span>
        </div>

        <Dial steps={steps} goal={goal} remaining={remaining} goalReached={goalReached} />

        <div className="dial-foot">
          {goalReached ? (
            <>Every one of your <strong>{fmt(goal)}</strong> steps is in. Rest easy.</>
          ) : (
            <>
              <strong>{fmt(remaining)}</strong> steps left · about{' '}
              <strong>{Math.max(1, Math.round(remaining / 110))} min</strong> of walking
            </>
          )}
        </div>

        <div className="stats" style={{ width: '100%', marginTop: 14 }}>
          <div className="stat">
            <div className="label">Distance</div>
            <div className="stat-val">
              {km(steps, state.strideMeters)}
              <small>km</small>
            </div>
          </div>
          <div className="stat">
            <div className="label">Energy</div>
            <div className="stat-val">
              {kcal(steps, state.strideMeters)}
              <small>kcal</small>
            </div>
          </div>
          <div className="stat">
            <div className="label">Streak</div>
            <div className="stat-val">
              {streak}
              <small>days</small>
            </div>
          </div>
        </div>
      </section>

      <section className="card card--felt">
        <Stitch inset={8} radius={16} opacity={0.34} />
        <div className="reminder">
          <div className="reminder-icon">
            <Bell size={19} />
          </div>
          <div className="reminder-text">
            <div className="reminder-title emboss">
              {remaining > 0 ? (
                <>
                  You’re missing out <strong>{fmt(remaining)} steps</strong> for the day.
                </>
              ) : (
                <>Nothing missing. Today’s target is met.</>
              )}
            </div>
            <div className="reminder-meta">
              <Clock size={11} style={{ verticalAlign: '-1px', marginRight: 4 }} />
              Reminder {prettyTime(state.reminderTime)} · in {humanGap(mins)}
            </div>
          </div>
        </div>
        <div className="tracker-actions">
          <button
            className="btn btn--felt"
            style={{ flex: 1 }}
            onClick={() => {
              onToast(
                'Reminder preview',
                remaining > 0
                  ? `You’re missing out ${fmt(remaining)} of ${fmt(goal)} steps for the day.`
                  : `All ${fmt(goal)} steps are in the bag. Beautifully done.`,
              )
            }}
          >
            <Bell size={14} /> Preview nudge
          </button>
        </div>
      </section>

      <section className="card card--suede">
        <Stitch inset={8} radius={16} color="rgba(74,45,22,.7)" opacity={0.6} />
        <div className="tracker-head">
          <div>
            <div className="tracker-title deboss" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Footsteps size={17} /> Step sensor
            </div>
            <div className="tracker-sub">
              {STATUS_COPY[trackerStatus]}
              {trackerDetail && trackerStatus === 'running' ? ` · ${trackerDetail}` : ''}
            </div>
          </div>
        </div>
        <div className="tracker-actions">
          <button className="btn btn--primary" style={{ flex: 1 }} onClick={onToggleSensor}>
            {sensorOn ? <Pause size={14} /> : <Play size={14} />}
            {sensorOn ? 'Pause sensor' : 'Start sensor'}
          </button>
          <button className="btn btn--ghost" onClick={onToggleSim}>
            {simulating ? 'Stop demo' : 'Demo walk'}
          </button>
        </div>
        <div className="hint" style={{ color: 'rgba(42,26,14,.5)' }}>
          Real counting uses the accelerometer. The demo walk adds steps at a walking pace so you can
          see the dial and reminders work.
        </div>
      </section>

      <section className="card card--felt">
        <Stitch inset={8} radius={16} opacity={0.32} />
        <div className="week-head">
          <div>
            <div className="label">Last seven days</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <Flame size={14} style={{ color: 'var(--brass)' }} />
              <span className="week-avg">
                Average <strong>{fmt(weeklyAverage(state))}</strong> steps
              </span>
            </div>
          </div>
          <Spark size={15} style={{ color: 'var(--brass)', opacity: 0.7 }} />
        </div>
        <div className="bars">
          {days.map((d) => {
            const h = Math.max(3, Math.min(100, (d.steps / Math.max(goal, d.steps, 1)) * 100))
            const hit = d.steps >= goal
            return (
              <div className="bar-col" key={d.key}>
                <div className="bar-track" title={`${fmt(d.steps)} steps`}>
                  <div
                    className={`bar-fill ${d.isToday ? 'bar-fill--today' : hit ? '' : 'bar-fill--miss'}`}
                    style={{ height: `${h}%` }}
                  />
                </div>
                <span className={`bar-day ${d.isToday ? 'bar-day--today' : ''}`}>{d.label}</span>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14 }}>
          <Ruler size={12} style={{ color: 'var(--cream-faint)' }} />
          <span className="week-avg">
            Goal line {fmt(goal)} · stride {(state.strideMeters * 100).toFixed(0)} cm
          </span>
        </div>
      </section>
    </div>
  )
}

function weeklyAverage(state: AppState): number {
  const vals = lastSevenDays(state)
    .slice(0, 6)
    .map((d) => d.steps)
    .filter((n) => n > 0)
  if (!vals.length) return 0
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
}

export function lastSevenDays(state: AppState) {
  const out: { key: string; steps: number; label: string; isToday: boolean }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = todayKey(d)
    out.push({
      key,
      steps: state.days[key]?.steps ?? 0,
      label: i === 0 ? 'Now' : shortDay(key),
      isToday: i === 0,
    })
  }
  return out
}

export function computeStreak(state: AppState): number {
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const rec = state.days[todayKey(d)]
    const hit = rec ? rec.steps >= (rec.goal || state.goal) : false
    if (i === 0 && !hit) continue // today still has time
    if (hit) streak++
    else break
  }
  return streak
}
