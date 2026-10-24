import { useCallback, useEffect, useRef, useState } from 'react'
import { StepDetector, type DetectorDiagnostics } from './pedometer'
import { isNative } from './notify'
import { type StepSource } from './nativeSteps'

export type TrackerStatus = 'idle' | 'requesting' | 'running' | 'denied' | 'unsupported'

export type { DetectorDiagnostics }

type Options = {
  enabled: boolean
  sensitivity: number
  /** Off by default. Gesture-prone, so only used when the user asks for it. */
  experimentalMotion: boolean
  onStep: () => void
}

type MotionEventCtor = {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

/**
 * Subscribes to raw motion. Uses the native Capacitor Motion plugin on a device
 * and window `devicemotion` in the browser.
 */
export function useStepTracker({
  enabled,
  sensitivity,
  experimentalMotion,
  onStep,
}: Options) {
  const [status, setStatus] = useState<TrackerStatus>('idle')
  const [detail, setDetail] = useState<string>('')
  const [source, setSource] = useState<StepSource>('none')
  const [reason, setReason] = useState<string>('')
  const [diagnostics, setDiagnostics] = useState<DetectorDiagnostics | null>(null)
  const detector = useRef<StepDetector | null>(null)
  const onStepRef = useRef(onStep)
  const stopRef = useRef<(() => void) | null>(null)
  onStepRef.current = onStep

  useEffect(() => {
    if (!detector.current) {
      detector.current = new StepDetector({
        sensitivity,
        onStep: () => onStepRef.current(),
        onDiagnostics: (snapshot) => setDiagnostics(snapshot),
      })
    } else {
      detector.current.setSensitivity(sensitivity)
    }
  }, [sensitivity])

  const stop = useCallback(() => {
    stopRef.current?.()
    stopRef.current = null
    detector.current?.reset()
    setStatus('idle')
  }, [])

  useEffect(() => {
    if (!enabled) {
      stop()
      return
    }
    let cancelled = false
    let webAttached = false

    const attachWebListener = () => {
      if (webAttached) return
      if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
        setStatus('unsupported')
        setDetail('This device exposes no motion sensor.')
        return
      }
      const listener = (event: DeviceMotionEvent) => {
        const a = event.accelerationIncludingGravity ?? event.acceleration
        if (!a) return
        const r = event.rotationRate
        detector.current?.push(
          { x: a.x ?? 0, y: a.y ?? 0, z: a.z ?? 0 },
          Date.now(),
          r ? { alpha: r.alpha ?? 0, beta: r.beta ?? 0, gamma: r.gamma ?? 0 } : undefined,
        )
      }
      window.addEventListener('devicemotion', listener)
      webAttached = true
      const previousStop = stopRef.current
      stopRef.current = () => {
        previousStop?.()
        window.removeEventListener('devicemotion', listener)
        webAttached = false
      }
    }

    const start = async () => {
      setStatus('requesting')
      setDetail('')

      // Motion counting is the explicit fallback for phones without a step
      // counter. The phone's own counter (useStepSync) takes precedence.
      if (!isNative() && typeof window === 'undefined') {
        setStatus('unsupported')
        setSource('none')
        setReason('No motion sensor on this platform.')
        return
      }

      setSource('motion')
      setReason('Experimental motion counting — gestures can add steps.')

      // Native/accelerometer path — Capacitor Motion wraps the WebView sensor APIs
      // and handles the iOS permission prompt. A watchdog falls back to raw
      // `devicemotion` if the plugin never delivers samples.
      if (isNative()) {
        try {
          const { Motion } = await import('@capacitor/motion')
          const handler = await Motion.addListener('accel', (event) => {
            const rate = event.rotationRate
            detector.current?.push(
              {
                x: event.acceleration.x ?? 0,
                y: event.acceleration.y ?? 0,
                z: event.acceleration.z ?? 0,
              },
              Date.now(),
              rate
                ? { alpha: rate.alpha ?? 0, beta: rate.beta ?? 0, gamma: rate.gamma ?? 0 }
                : undefined,
            )
          })
          if (cancelled) {
            handler.remove()
            return
          }
          setStatus('running')
          setDetail('Device sensor')

          const watchdog = window.setTimeout(() => {
            if ((detector.current?.samples ?? 0) > 8) return
            handler.remove()
            attachWebListener()
            setDetail('Device sensor (web fallback)')
          }, 6000)

          stopRef.current = () => {
            window.clearTimeout(watchdog)
            Motion.removeAllListeners()
          }
          return
        } catch {
          setDetail('Using browser motion API')
        }
      }

      // Browser path.
      if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
        setStatus('unsupported')
        setDetail('This device exposes no motion sensor.')
        return
      }

      const ctor = window.DeviceMotionEvent as unknown as MotionEventCtor
      if (typeof ctor.requestPermission === 'function') {
        try {
          const perm = await ctor.requestPermission()
          if (perm !== 'granted') {
            setStatus('denied')
            setDetail('Motion access was declined — enable it in Settings.')
            return
          }
        } catch {
          setStatus('denied')
          setDetail('Motion access was declined — enable it in Settings.')
          return
        }
      }

      attachWebListener()
      setStatus('running')
      setDetail('Browser sensor')
    }

    start()

    return () => {
      cancelled = true
      stopRef.current?.()
      stopRef.current = null
      detector.current?.reset()
      setStatus('idle')
    }
  }, [enabled, stop, experimentalMotion])

  return { status, detail, diagnostics, source, reason, stop }
}

/** Desktop/demo helper: walks a plausible cadence so the UI can be seen working. */
export function useSimulator(active: boolean, onSteps: (n: number) => void) {
  const cb = useRef(onSteps)
  cb.current = onSteps
  useEffect(() => {
    if (!active) return
    let alive = true
    let carry = 0
    const tick = () => {
      if (!alive) return
      const cadence = 1.4 + Math.random() * 1.6 // steps per second
      carry += cadence * 0.5
      const whole = Math.floor(carry)
      if (whole > 0) {
        carry -= whole
        cb.current(whole)
      }
    }
    const id = window.setInterval(tick, 500)
    return () => {
      alive = false
      window.clearInterval(id)
    }
  }, [active])
}
