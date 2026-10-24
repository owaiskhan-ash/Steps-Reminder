import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

export type StepSensorKind = 'detector' | 'counter' | 'none'

/** Where a step count came from. Surfaced in the UI so nothing is silent. */
export type StepSource = 'hardware' | 'motion' | 'none'

export type NativeStepStatus =
  | { ok: true; kind: StepSensorKind }
  | { ok: false; reason: string }

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

/** True when running in a browser, where there is no step sensor at all. */
export function isWebBuild(): boolean {
  return !Capacitor.isNativePlatform()
}

/**
 * Probes the hardware pedometer without starting it, so the UI can explain why
 * hardware counting is or isn't in use instead of silently degrading.
 */
export async function probeNativeSteps(): Promise<NativeStepStatus> {
  if (!nativeStepsSupported()) {
    return { ok: false, reason: 'Web build — no step sensor on this platform.' }
  }
  try {
    const availability = await StepCounter.isAvailable()
    if (!availability.available) {
      return { ok: false, reason: 'This device reports no step sensor.' }
    }
    const permission = await StepCounter.checkPermissions()
    if (permission.activity === 'denied') {
      return {
        ok: false,
        reason: 'Activity permission was blocked — allow it in system settings.',
      }
    }
    return { ok: true, kind: availability.kind }
  } catch {
    return { ok: false, reason: 'The step counter plugin did not respond.' }
  }
}

/**
 * Starts the hardware pedometer. Returns an explicit reason on failure rather
 * than null, because a silent failure is what let gestures masquerade as steps.
 */
export async function startNativeSteps(
  onStep: () => void,
): Promise<
  | { ok: true; kind: StepSensorKind; stop: () => Promise<void> }
  | { ok: false; reason: string }
> {
  if (!nativeStepsSupported()) {
    return { ok: false, reason: 'Web build — hardware counting unavailable.' }
  }

  try {
    const availability = await StepCounter.isAvailable()
    if (!availability.available) {
      return { ok: false, reason: 'This device reports no step sensor.' }
    }

    const permission = await StepCounter.requestPermissions()
    if (permission.activity === 'denied') {
      return { ok: false, reason: 'Activity permission was denied.' }
    }

    const handle = await StepCounter.addListener('step', onStep)
    await StepCounter.start()

    return {
      ok: true,
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, reason: `Step counter failed: ${message}` }
  }
}
