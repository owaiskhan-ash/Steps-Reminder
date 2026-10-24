import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

export type StepSensorKind = 'detector' | 'counter' | 'none'

type StepCounterPlugin = {
  isAvailable(): Promise<{ available: boolean; kind: StepSensorKind }>
  start(): Promise<void>
  stop(): Promise<void>
  checkPermissions(): Promise<{ activity: 'granted' | 'denied' | 'prompt' }>
  requestPermissions(): Promise<{ activity: 'granted' | 'denied' | 'prompt' }>
  addListener(event: 'step', listener: () => void): Promise<PluginListenerHandle>
}

const StepCounter = registerPlugin<StepCounterPlugin>('StepCounter')

export function nativeStepsSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'
}

/**
 * Starts the hardware pedometer if this device has one. Returns a stop function,
 * or null when the platform has no step sensor — the caller then falls back to
 * the accelerometer detector.
 *
 * Hardware counting is the reliable answer to false steps: the platform's own
 * classifier ignores hand swinging, shaking and bumps.
 */
export async function startNativeSteps(
  onStep: () => void,
): Promise<{ kind: StepSensorKind; stop: () => Promise<void> } | null> {
  if (!nativeStepsSupported()) return null

  try {
    const availability = await StepCounter.isAvailable()
    if (!availability.available) return null

    const permission = await StepCounter.requestPermissions()
    if (permission.activity !== 'granted' && permission.activity !== 'prompt') {
      return null
    }

    const handle = await StepCounter.addListener('step', onStep)
    await StepCounter.start()

    return {
      kind: availability.kind,
      stop: async () => {
        try {
          await StepCounter.stop()
        } catch {
          /* ignore */
        }
        await handle.remove()
      },
    }
  } catch {
    return null
  }
}
