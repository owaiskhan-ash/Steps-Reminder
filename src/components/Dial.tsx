import { fmt } from '../lib/format'

type Props = {
  steps: number
  goal: number
  remaining: number
  goalReached: boolean
}

const SIZE = 302
const C = SIZE / 2
const ARC_R = 104
const CIRC = 2 * Math.PI * ARC_R

export function Dial({ steps, goal, remaining, goalReached }: Props) {
  const progress = goal > 0 ? Math.min(1, steps / goal) : 0
  const shown = Math.round(progress * 100)
  const tipAngle = -90 + progress * 360
  const tipX = C + ARC_R * Math.cos((tipAngle * Math.PI) / 180)
  const tipY = C + ARC_R * Math.sin((tipAngle * Math.PI) / 180)

  return (
    <div className="dial">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`${fmt(steps)} of ${fmt(goal)} steps`}>
        <defs>
          <radialGradient id="face" cx="38%" cy="26%" r="80%">
            <stop offset="0%" stopColor="#77512e" />
            <stop offset="55%" stopColor="#674328" />
            <stop offset="100%" stopColor="#5a3a20" />
          </radialGradient>
          <radialGradient id="recess" cx="46%" cy="30%" r="78%">
            <stop offset="0%" stopColor="#261a0e" />
            <stop offset="100%" stopColor="#201509" />
          </radialGradient>
          <linearGradient id="threadArc" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#eadcbe" />
            <stop offset="100%" stopColor="#d3b183" />
          </linearGradient>
          <linearGradient id="threadArcDone" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#cfdcb6" />
            <stop offset="100%" stopColor="#93ac79" />
          </linearGradient>
        </defs>

        {/* leather bezel */}
        <circle cx={C} cy={C} r={146} fill="url(#face)" stroke="rgba(0,0,0,0.4)" strokeWidth="1.2" />

        {/* saddle stitches around the rim */}
        <circle
          cx={C}
          cy={C}
          r={135}
          fill="none"
          stroke="var(--thread)"
          strokeOpacity="0.42"
          strokeWidth="1.5"
          strokeDasharray="4.5 7"
          strokeLinecap="round"
        />

        {/* inner felt recess with rim shadow */}
        <circle cx={C} cy={C} r={126} fill="url(#recess)" stroke="rgba(0,0,0,0.4)" strokeWidth="1.4" />

        {/* minute ticks */}
        <g opacity="0.5">
          {Array.from({ length: 60 }).map((_, i) => {
            const a = (i * 6 - 90) * (Math.PI / 180)
            const major = i % 5 === 0
            const r1 = major ? 112 : 116
            const r2 = 121
            return (
              <line
                key={i}
                x1={C + r1 * Math.cos(a)}
                y1={C + r1 * Math.sin(a)}
                x2={C + r2 * Math.cos(a)}
                y2={C + r2 * Math.sin(a)}
                stroke={major ? 'rgba(241,228,204,0.5)' : 'rgba(241,228,204,0.22)'}
                strokeWidth={major ? 1.5 : 1}
                strokeLinecap="round"
              />
            )
          })}
        </g>

        {/* track */}
        <circle
          cx={C}
          cy={C}
          r={ARC_R}
          fill="none"
          stroke="rgba(0,0,0,0.32)"
          strokeWidth={11}
          strokeLinecap="round"
        />

        {/* progress thread */}
        <circle
          cx={C}
          cy={C}
          r={ARC_R}
          fill="none"
          stroke={goalReached ? 'url(#threadArcDone)' : 'url(#threadArc)'}
          strokeWidth={11}
          strokeLinecap="round"
          strokeDasharray={`${CIRC}`}
          strokeDashoffset={CIRC * (1 - progress)}
          transform={`rotate(-90 ${C} ${C})`}
          style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(.22,.8,.2,1)' }}
        />

        {/* thread tail bead */}
        {progress > 0.004 && (
          <circle cx={tipX} cy={tipY} r={4.6} fill="#f0e2c6" />
        )}

        {/* start notch */}
        <circle cx={C} cy={C - ARC_R} r={2.8} fill="rgba(241,228,204,0.28)" />
      </svg>

      <div className="dial-center">
        <div
          className="dial-steps"
          style={{
            fontSize:
              steps >= 100000
                ? 'clamp(28px, 8.4vw, 36px)'
                : steps >= 10000
                  ? 'clamp(37px, 10.6vw, 48px)'
                  : undefined,
          }}
        >
          {fmt(steps)}
        </div>
        <div className="dial-of">of {fmt(goal)} steps</div>
        <div className="dial-pct">
          {goalReached ? 'Goal complete' : `${shown}% · ${fmt(remaining)} to go`}
        </div>
      </div>
    </div>
  )
}
