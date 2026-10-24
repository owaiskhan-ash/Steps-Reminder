import { Stitch } from '../components/Stitch'
import { Chart, Check, Flame, Footsteps } from '../components/Icons'
import { fmt, pct } from '../lib/format'
import type { AppState } from '../lib/storage'
import { computeStreak, lastSevenDays } from './Today'

type Props = {
  state: AppState
}

export function History({ state }: Props) {
  const entries = Object.entries(state.days)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 30)

  const week = lastSevenDays(state)
  const weekSteps = week.reduce((sum, d) => sum + d.steps, 0)
  const best = entries.reduce((m, [, r]) => Math.max(m, r.steps), 0)
  const hits = entries.filter(([, r]) => r.steps >= (r.goal || state.goal)).length

  return (
    <div className="screen">
      <header className="topbar">
        <div>
          <div className="brand-name">Your trail</div>
          <div className="brand-sub">Every step kept</div>
        </div>
        <div className="reminder-icon" style={{ width: 38, height: 38 }}>
          <Chart size={18} />
        </div>
      </header>

      <section className="card card--leather">
        <Stitch inset={6} radius={16} double opacity={0.4} />
        <div className="label">This week</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
          <span className="serif" style={{ fontSize: 32, lineHeight: 1, color: '#f6ead6' }}>
            {fmt(weekSteps)}
          </span>
          <span style={{ fontSize: 11, color: 'var(--cream-dim)', letterSpacing: '.14em', textTransform: 'uppercase' }}>
            steps
          </span>
        </div>
        <div className="stats" style={{ marginTop: 16 }}>
          <div className="stat">
            <div className="label">Best day</div>
            <div className="stat-val">
              {fmt(best)}
              <small>steps</small>
            </div>
          </div>
          <div className="stat">
            <div className="label">Goals hit</div>
            <div className="stat-val">
              {hits}
              <small>days</small>
            </div>
          </div>
          <div className="stat">
            <div className="label">Streak</div>
            <div className="stat-val">
              {computeStreak(state)}
              <small>days</small>
            </div>
          </div>
        </div>
      </section>

      <div className="section-title">Daily ledger</div>

      {entries.length === 0 ? (
        <div className="card card--felt">
          <Stitch inset={6} radius={16} opacity={0.3} />
          <div className="empty-state">
            <Footsteps size={26} style={{ color: 'var(--cream-faint)', marginBottom: 10 }} />
            <div>No days recorded yet.</div>
            <div style={{ marginTop: 4 }}>Your first walk will appear here.</div>
          </div>
        </div>
      ) : (
        <div className="history-list">
          {entries.map(([key, rec]) => {
            const goal = rec.goal || state.goal
            const ratio = pct(rec.steps, goal)
            const d = new Date(`${key}T12:00:00`)
            const hit = rec.steps >= goal
            return (
              <div className="history-item" key={key}>
                <div className="history-day">
                  <div className="history-day-name">
                    {d.toLocaleDateString(undefined, { weekday: 'short' })}
                  </div>
                  <div className="history-day-date">
                    {d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                  </div>
                </div>
                <div className="history-meter">
                  <div className="history-meter-fill" style={{ width: `${ratio * 100}%`, opacity: hit ? 1 : 0.55 }} />
                </div>
                <div className="history-steps">{fmt(rec.steps)}</div>
                <div className="history-tick">
                  {hit ? <Check size={14} /> : <Flame size={12} style={{ opacity: 0.25 }} />}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="footnote" style={{ marginTop: 'auto' }}>
        History stays on this device. Nothing is uploaded.
      </p>
    </div>
  )
}
