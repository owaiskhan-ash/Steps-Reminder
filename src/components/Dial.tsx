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
          <radialGradient id="face" cx="34%" cy="22%" r="82%">
            <stop offset="0%" stopColor="#8a5d36" />
            <stop offset="46%" stopColor="#6a4526" />
            <stop offset="100%" stopColor="#3f2714" />
          </radialGradient>
          <radialGradient id="recess" cx="42%" cy="26%" r="76%">
            <stop offset="0%" stopColor="#2f2013" />
            <stop offset="62%" stopColor="#241809" />
            <stop offset="100%" stopColor="#1b1108" />
          </radialGradient>
          <linearGradient id="threadArc" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f3e3c6" />
            <stop offset="55%" stopColor="#d9b98e" />
            <stop offset="100%" stopColor="#c69a65" />
          </linearGradient>
          <linearGradient id="threadArcDone" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#dce6c4" />
            <stop offset="60%" stopColor="#a8c08a" />
            <stop offset="100%" stopColor="#7f9a68" />
          </linearGradient>
          <filter id="arcGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor={goalReached ? '#a8c08a' : '#d9b98e'} floodOpacity="0.42" />
          </filter>
        </defs>

        {/* leather bezel */}
        <circle cx={C} cy={C} r={146} fill="url(#face)" />
        <circle cx={C} cy={C} r={145.4} fill="none" stroke="rgba(0,0,0,0.45)" strokeWidth="1.2" />
        <circle cx={C} cy={C} r={142} fill="none" stroke="rgba(255,236,204,0.16)" strokeWidth="1" />

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
        <circle cx={C} cy={C} r={126} fill="url(#recess)" />
        <circle cx={C} cy={C} r={126} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth="2.5" />
        <circle cx={C} cy={C} r={123.4} fill="none" stroke="rgba(255,232,196,0.09)" strokeWidth="1.4" />

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
          stroke="rgba(0,0,0,0.45)"
          strokeWidth={13}
          strokeLinecap="round"
        />
        <circle
          cx={C}
          cy={C}
          r={ARC_R}
          fill="none"
          stroke="rgba(255,236,204,0.07)"
          strokeWidth={11}
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
          filter="url(#arcGlow)"
          style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(.22,.8,.2,1)' }}
        />

        {/* thread tail bead */}
        {progress > 0.004 && (
          <g style={{ transition: 'transform 700ms cubic-bezier(.22,.8,.2,1)' }}>
            <circle cx={tipX} cy={tipY} r={6.4} fill="#f6e8cd" opacity="0.92" />
            <circle cx={tipX} cy={tipY} r={3} fill="#a6814f" opacity="0.85" />
          </g>
        )}

        {/* start notch */}
        <circle cx={C} cy={C - ARC_R} r={3.2} fill="rgba(241,228,204,0.35)" />
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
