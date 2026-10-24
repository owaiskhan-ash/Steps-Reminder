import type { CSSProperties } from 'react'

type P = { size?: number; className?: string; style?: CSSProperties }

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export const Gear = ({ size = 19, className, style }: P) => (
  <svg {...base(size)} className={className} style={style}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </svg>
)

export const Bell = ({ size = 18, className, style }: P) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
)

export const Footsteps = ({ size = 20, className, style }: P) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M6.5 21c-1.4 0-2.4-1.1-2.4-2.6 0-2.2 1.1-3.3 1.1-5.4 0-1.4.6-2.4.6-4.2C5.8 6.3 6.9 4 9 4s3 2 3 4.2c0 2-.5 3-.5 4.4 0 2.2 1 3.2 1 5.3 0 1.7-1 3.1-2.6 3.1H6.5Z" />
    <path d="M17 13.4c1.2 0 2 .9 2 2.1 0 1.6-.8 2.4-.8 3.9 0 1-.5 1.7-.5 2.3 0 .8.4 1.3 1.3 1.3" opacity=".55" />
    <circle cx="15.6" cy="7.4" r="1.4" opacity=".55" />
    <circle cx="18.4" cy="9.6" r="1.2" opacity=".55" />
  </svg>
)

export const Clock = ({ size = 16, className, style }: P) => (
  <svg {...base(size)} className={className} style={style}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.6V12l3 1.8" />
  </svg>
)

export const Chart = ({ size = 20, className, style }: P) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M4 20V9M9.3 20V4.5M14.7 20v-7M20 20V7" />
  </svg>
)

export const Check = ({ size = 14, className, style }: P) => (
  <svg {...base(size)} className={className} strokeWidth={2.2} style={style}>
    <path d="m4.5 12.5 4.6 4.6L19.5 6.8" />
  </svg>
)

export const Flame = ({ size = 16, className, style }: P) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M12 22c3.6 0 6-2.4 6-5.6 0-4.4-4.2-5.6-3.4-10.4C12.2 7 10.8 8.8 10.8 11c-1-.6-1.6-1.7-1.6-3C7.4 9.6 6 11.9 6 14.9 6 19 8.6 22 12 22Z" />
  </svg>
)

export const Ruler = ({ size = 16, className, style }: P) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M3.5 14.8 14.8 3.5l5.7 5.7L9.2 20.5z" />
    <path d="M8 10.3l2 2M11 7.3l2 2M5 13.3l2 2" />
  </svg>
)

export const Plus = ({ size = 15, className, style }: P) => (
  <svg {...base(size)} className={className} strokeWidth={2} style={style}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const Play = ({ size = 15, className, style }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} style={style}>
    <path d="M8 5.2c0-.8.9-1.3 1.6-.9l9 6.8c.6.5.6 1.4 0 1.8l-9 6.8c-.7.5-1.6 0-1.6-.9z" />
  </svg>
)

export const Pause = ({ size = 15, className, style }: P) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} style={style}>
    <rect x="7" y="5" width="3.6" height="14" rx="1.2" />
    <rect x="13.4" y="5" width="3.6" height="14" rx="1.2" />
  </svg>
)

export const Spark = ({ size = 16, className, style }: P) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M12 3.2l1.9 5.1 5.1 1.9-5.1 1.9L12 17.2l-1.9-5.1L5 10.2l5.1-1.9z" />
    <path d="M18.4 16.4l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" opacity=".6" />
  </svg>
)

export const Close = ({ size = 18, className, style }: P) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

export const Arrow = ({ size = 16, className, style }: P) => (
  <svg {...base(size)} className={className} style={style}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

export const Compass = ({ size = 20, className, style }: P) => (
  <svg {...base(size)} className={className} style={style}>
    <circle cx="12" cy="12" r="8.6" />
    <path d="m15.4 8.6-2.1 4.7-4.7 2.1 2.1-4.7z" />
  </svg>
)
