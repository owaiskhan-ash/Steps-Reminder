/**
 * Lightweight accelerometer step detector.
 *
 * Works on raw `devicemotion` samples as well as the native Capacitor Motion
 * plugin. We run a moving-average gravity estimate, look at the dynamic
 * component of the acceleration magnitude, then count hysteresis peaks — one
 * peak per footfall, with a refractory window so a bouncy pocket can't inflate
 * the count.
 */

export type AccelSample = {
  x: number
  y: number
  z: number
}

const MIN_STEP_INTERVAL_MS = 250
const SMOOTHING = 0.09

/** Sensitivity 1 = counts light footfalls, 5 = firm steps only. */
export function thresholdFor(sensitivity: number): number {
  const clamped = Math.min(5, Math.max(1, sensitivity))
  return 1.75 - clamped * 0.17 // 1.58 .. 0.9
}

export class StepDetector {
  private gravity = 9.81
  private primed = false
  private armed = true
  private lastStepAt = 0
  private threshold: number
  private onStep: (at: number) => void
  private recent: number[] = []
  /** How many usable samples have arrived — used to detect a dead sensor. */
  samples = 0

  constructor(sensitivity: number, onStep: (at: number) => void) {
    this.threshold = thresholdFor(sensitivity)
    this.onStep = onStep
  }

  setSensitivity(sensitivity: number) {
    this.threshold = thresholdFor(sensitivity)
  }

  reset() {
    this.samples = 0
    this.primed = false
    this.armed = true
    this.lastStepAt = 0
  }

  /** Feed one acceleration sample (m/s², gravity included). */
  push(sample: AccelSample, now = Date.now()) {
    const mag = Math.sqrt(sample.x * sample.x + sample.y * sample.y + sample.z * sample.z)
    if (!Number.isFinite(mag) || mag === 0) return
    this.samples++

    if (!this.primed) {
      this.gravity = mag
      this.primed = true
      return
    }

    this.gravity += (mag - this.gravity) * SMOOTHING
    const dynamic = mag - this.gravity

    this.recent.push(dynamic)
    if (this.recent.length > 40) this.recent.shift()

    if (this.armed && dynamic > this.threshold) {
      const gap = now - this.lastStepAt
      if (gap >= MIN_STEP_INTERVAL_MS) {
        this.lastStepAt = now
        this.onStep(now)
      }
      this.armed = false
    } else if (!this.armed && dynamic < -this.threshold * 0.55) {
      this.armed = true
    }
  }
}
