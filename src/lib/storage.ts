export type DayRecord = {
  steps: number
  goal: number
}

export type AppState = {
  onboarded: boolean
  goal: number
  reminderTime: string // "HH:MM" 24h
  strideMeters: number
  sensitivity: number // 1 (strict) .. 5 (loose)
  /** Opt-in accelerometer counting. Off by default: gestures can add steps. */
  experimentalMotion: boolean
  days: Record<string, DayRecord>
  seeded: boolean
}

const KEY = 'sc-step-reminder-v1'

export const DEFAULT_STATE: AppState = {
  onboarded: false,
  goal: 8000,
  reminderTime: '20:00',
  strideMeters: 0.72,
  sensitivity: 2,
  experimentalMotion: false,
  days: {},
  seeded: false,
}

export function todayKey(d = new Date()): string {
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_STATE }
    const parsed = JSON.parse(raw) as Partial<AppState>
    return {
      ...DEFAULT_STATE,
      ...parsed,
      days: parsed.days ?? {},
    }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

export function saveState(state: AppState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* storage full / private mode — ignore */
  }
}

export function clearState() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export function stepsToday(state: AppState): number {
  return state.days[todayKey()]?.steps ?? 0
}

/** Demo history so the weekly chart isn't empty on first open. */
export function seedHistory(state: AppState): AppState {
  if (state.seeded) return state
  const days = { ...state.days }
  const seed = [9420, 6180, 11240, 7830, 10060, 5210, 4100]
  for (let i = 1; i <= 7; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = todayKey(d)
    if (!days[key]) days[key] = { steps: seed[i - 1], goal: state.goal }
  }
  return { ...state, days, seeded: true }
}
