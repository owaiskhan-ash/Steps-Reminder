export const nf = new Intl.NumberFormat('en-US')

export function fmt(n: number): string {
  return nf.format(Math.max(0, Math.round(n)))
}

export function pct(steps: number, goal: number): number {
  if (goal <= 0) return 0
  return Math.min(1, steps / goal)
}

export function km(steps: number, strideMeters: number): string {
  const v = (steps * strideMeters) / 1000
  return v < 10 ? v.toFixed(2) : v.toFixed(1)
}

export function kcal(steps: number, strideMeters: number): number {
  // ~0.045 kcal per step for an average adult, nudged by stride length
  return Math.round(steps * 0.045 * (strideMeters / 0.72))
}

export function prettyTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setHours(h || 0, m || 0, 0, 0)
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

export function minutesUntil(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  const now = new Date()
  const target = new Date()
  target.setHours(h || 0, m || 0, 0, 0)
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1)
  return Math.round((target.getTime() - now.getTime()) / 60000)
}

export function humanGap(mins: number): string {
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export function prettyDate(d = new Date()): string {
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
}

export function shortDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00`)
  return d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2)
}
