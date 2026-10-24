import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

export type StepSensorKind = 'detector' | 'counter' | 'none'

/** Where a step count came from. Surfaced in the UI so nothing is silent. */
export type StepSource = 'pedometer' | 'motion' | 'manual' | 'none'

export type PedometerReading = {
  steps: number
  counter: number
  available: boolean
  rebooted: boolean
  baselineStartedNow: boolean
  /** The counter only started today, so it is already today's total. */
  fromBoot: boolean
  since?: string
  reason?: string
  /** Daily totals banked by the midnight alarm: { "2026-10-23": 8342 } */
  history?: Record<string, number>
  permission?: 'granted' | 'denied' | 'prompt'
}

type StepCounterPlugin = {
  isAvailable(): Promise<{ available: boolean; kind: StepSensorKind }>
  getTodaySteps(): Promise<PedometerReading>
  getRawCounter(): Promise<{ counter: number }>
  bankToday(): Promise<{ ok: boolean; history: string }>
  start(): Promise<void>
  stop(): Promise<void>
  addListener(event: 'step', listener: () => void): Promise<PluginListenerHandle>
}

const StepCounter = registerPlugin<StepCounterPlugin>('StepCounter')

export function nativeStepsSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

export function isWebBuild(): boolean {
  return !Capacitor.isNativePlatform()
}

/** Reads today's total from the phone's counter, with an explicit reason on failure. */
export async function readPedometer(): Promise<
  { ok: true; reading: PedometerReading } | { ok: false; reason: string }
> {
  if (!nativeStepsSupported()) {
    return { ok: false, reason: 'Web build — the phone step counter is only on Android.' }
  }
  try {
    const availability = await StepCounter.isAvailable()
    if (!availability.available || availability.kind === 'none') {
      return { ok: false, reason: 'This phone reports no step counter.' }
    }
    const reading = await StepCounter.getTodaySteps()
    if (reading.permission === 'denied') {
      return {
        ok: false,
        reason: 'Activity permission was refused — allow it in system settings.',
      }
    }
    if (!reading.available) {
      return {
        ok: false,
        reason: reading.reason ?? 'The step counter returned no reading.',
      }
    }
    return { ok: true, reading }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, reason: `Step counter unavailable: ${message}` }
  }
}

export async function readRawCounter(): Promise<number | null> {
  if (!nativeStepsSupported()) return null
  try {
    const { counter } = await StepCounter.getRawCounter()
    return counter >= 0 ? counter : null
  } catch {
    return null
  }
}

/** Forces the midnight banking now (used by the diagnostics panel). */
export async function bankToday(): Promise<Record<string, number> | null> {
  if (!nativeStepsSupported()) return null
  try {
    const { history } = await StepCounter.bankToday()
    return JSON.parse(history) as Record<string, number>
  } catch {
    return null
  }
}
