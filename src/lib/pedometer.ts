/**
 * Conservative footfall detector.
 *
 * A phone gets rotated, waved, swung in figures of eight and spun in circles all
 * day, and every one of those produces real acceleration. Counting peaks is
 * therefore hopeless on its own. A footfall is only credited when *everything*
 * below agrees:
 *
 *  1. **World-frame vertical** — gravity is tracked per axis (with a fast
 *     re-lock) so acceleration is projected onto true vertical, not the phone's
 *     own axes. Spinning the phone then cannot manufacture vertical signal.
 *  2. **Gyroscope gate** — walking rocks the phone gently (peak angular speed
 *     well under ~2 rad/s). Arm swinging, figure-8s and handling the phone in
 *     revolutions all exceed it, so those intervals are discarded outright.
 *  3. **Cadence** — peaks must fall 0.3–1.5 s apart with low variance.
 *  4. **Impact shape** — a footfall is an impact (positive skew, high crest
 *     factor); a swung phone is a near-perfect sine and fails.
 *  5. **Sustained walking** — validated footfalls are buffered and only credited
 *     once a run of consecutive ones confirms you are actually walking. A
 *     gesture that fools the other tests for a second or two still adds nothing.
 */

export type AccelSample = {
  x: number
  y: number
  z: number
}

/** Angular velocity in degrees per second, as browsers report it. */
export type RotationSample = {
  alpha: number
  beta: number
  gamma: number
}

const DEG_TO_RAD = Math.PI / 180

/** Plausible time between footfalls, in seconds. */
const MIN_CADENCE = 0.3
const MAX_CADENCE = 1.5
/** Peaks closer together than this are the same footfall. */
const SAME_PEAK_GAP = 0.22
/** A gap this long ends the current walk. */
const RHYTHM_TIMEOUT_MS = 2500
/** How many peaks we keep while judging rhythm. */
const PEAK_WINDOW = 6
/** Trailing samples used for the shape test (~2.5 s at 50 Hz). */
const SHAPE_WINDOW = 128

/** Angular speed above which we assume deliberate handling, not walking. */
export const ANGULAR_LIMIT = 2.2 // rad/s ≈ 126 °/s
/** Angular speed that marks the whole recent window as non-walking. */
export const ANGULAR_SUSTAINED = 3.2
/** Consecutive validated footfalls required before anything is credited. */
export const SUSTAIN_MIN = 8

export type ShapeStats = {
  skew: number
  crest: number
}

/** Skewness and crest factor of a signal — enough to tell impacts from waves. */
export function shapeStats(xs: number[]): ShapeStats {
  const n = xs.length
  if (n < 24) return { skew: 0, crest: 0 }
  let mean = 0
  for (const x of xs) mean += x
  mean /= n
  let sum2 = 0
  let sum3 = 0
  let max = -Infinity
  for (const x of xs) {
    const d = x - mean
    sum2 += d * d
    sum3 += d * d * d
    if (d > max) max = d
  }
  const m2 = sum2 / n
  const sd = Math.sqrt(m2)
  if (sd < 1e-6) return { skew: 0, crest: 0 }
  return { skew: sum3 / n / sd ** 3, crest: max / sd }
}

/**
 * Trigger level as a fraction of the recent peak envelope. Strict sensitivity
 * asks for a fuller peak; the absolute floor stops sensor noise ever counting.
 */
export function peakRatioFor(sensitivity: number): number {
  const clamped = Math.min(5, Math.max(1, sensitivity))
  return 0.62 - (clamped - 1) * 0.045
}

export function noiseFloorFor(sensitivity: number): number {
  const clamped = Math.min(5, Math.max(1, sensitivity))
  return 1.0 - (clamped - 1) * 0.06
}

export function cadenceToleranceFor(sensitivity: number): number {
  const clamped = Math.min(5, Math.max(1, sensitivity))
  return 0.26 + (clamped - 1) * 0.025
}

/** How impulse-like the signal must be. Loosens slightly as sensitivity rises. */
export function shapeLimitsFor(sensitivity: number) {
  const clamped = Math.min(5, Math.max(1, sensitivity))
  return {
    skew: 0.34 - (clamped - 1) * 0.025,
    crest: 1.86 - (clamped - 1) * 0.03,
  }
}

/** Angular gate loosens a little with sensitivity, but never much. */
export function angularLimitFor(sensitivity: number): number {
  const clamped = Math.min(5, Math.max(1, sensitivity))
  return ANGULAR_LIMIT + (clamped - 1) * 0.12
}

export type DetectorDiagnostics = {
  angular: number
  angularLimit: number
  cadence: number
  skew: number
  crest: number
  sustain: number
  sustainNeeded: number
  hasGyro: boolean
  lastReason: string
  accepted: number
  rejected: number
}

export type DetectorOptions = {
  sensitivity: number
  onStep: (at: number) => void
  /** Called whenever the diagnostics snapshot changes materially. */
  onDiagnostics?: (snapshot: DetectorDiagnostics) => void
}

export class StepDetector {
  private gravity = { x: 0, y: 0, z: 0 }
  private primed = false
  private lastSampleAt = 0
  private smoothed = 0

  private peaked = false
  private envelope = 0
  private peakRatio = 0.575
  private floor = 0.94
  private cvLimit = 0.285
  private skewLimit = 0.315
  private crestLimit = 1.83
  private angularLimit = ANGULAR_LIMIT

  private peaks: number[] = []
  private window: number[] = []
  /** Decaying peak of the angular speed (rad/s) over the last ~1.5 s. */
  private angularPeak = 0
  private angularSmoothed = 0
  private hasGyro = false

  /** Validated footfalls waiting for the walk to be confirmed. */
  private run: number[] = []
  private emitted = 0

  private lastShape: ShapeStats = { skew: 0, crest: 0 }
  private lastReason = 'waiting'
  private accepted = 0
  private rejected = 0
  private lastDiagAt = 0

  private onStep: (at: number) => void
  private onDiagnostics?: (snapshot: DetectorDiagnostics) => void

  samples = 0

  constructor(options: DetectorOptions) {
    this.onStep = options.onStep
    this.onDiagnostics = options.onDiagnostics
    this.applySensitivity(options.sensitivity)
  }

  setSensitivity(sensitivity: number) {
    this.applySensitivity(sensitivity)
  }

  private applySensitivity(sensitivity: number) {
    this.peakRatio = peakRatioFor(sensitivity)
    this.floor = noiseFloorFor(sensitivity)
    this.cvLimit = cadenceToleranceFor(sensitivity)
    const shape = shapeLimitsFor(sensitivity)
    this.skewLimit = shape.skew
    this.crestLimit = shape.crest
    this.angularLimit = angularLimitFor(sensitivity)
  }

  reset() {
    this.samples = 0
    this.primed = false
    this.smoothed = 0
    this.peaked = false
    this.envelope = 0
    this.peaks = []
    this.window = []
    this.run = []
    this.emitted = 0
    this.angularPeak = 0
    this.angularSmoothed = 0
    this.lastSampleAt = 0
    this.lastReason = 'waiting'
  }

  diagnostics(): DetectorDiagnostics {
    const mean =
      this.peaks.length > 1
        ? (this.peaks[this.peaks.length - 1] - this.peaks[0]) / (this.peaks.length - 1)
        : 0
    return {
      angular: this.angularSmoothed,
      angularLimit: this.angularLimit,
      cadence: mean > 0 ? Math.round(60000 / mean) : 0,
      skew: this.lastShape.skew,
      crest: this.lastShape.crest,
      sustain: Math.min(this.run.length, SUSTAIN_MIN),
      sustainNeeded: SUSTAIN_MIN,
      hasGyro: this.hasGyro,
      lastReason: this.lastReason,
      accepted: this.accepted,
      rejected: this.rejected,
    }
  }

  /** Feed one acceleration sample (m/s², gravity included). */
  push(sample: AccelSample, now = Date.now(), rotation?: RotationSample) {
    const { x, y, z } = sample
    if (![x, y, z].every((v) => Number.isFinite(v))) return
    const magnitude = Math.sqrt(x * x + y * y + z * z)
    if (magnitude === 0) return
    this.samples++

    if (!this.primed) {
      this.gravity = { x, y, z }
      this.primed = true
      this.lastSampleAt = now
      return
    }

    const dt = Math.min(0.1, Math.max(0.002, (now - this.lastSampleAt) / 1000))
    this.lastSampleAt = now

    // 1. Gravity tracking with a fast re-lock: normally slow and steady, but if
    //    |a| sits far from |g| (or the phone was clearly being rotated) the
    //    estimate is allowed to catch up quickly so the world frame stays true.
    const gravityAlpha = dt / (0.35 + dt)
    this.gravity.x += (x - this.gravity.x) * gravityAlpha
    this.gravity.y += (y - this.gravity.y) * gravityAlpha
    this.gravity.z += (z - this.gravity.z) * gravityAlpha

    const gMag = Math.sqrt(
      this.gravity.x ** 2 + this.gravity.y ** 2 + this.gravity.z ** 2,
    )
    if (gMag < 1) return

    // Signed acceleration along gravity — the vertical bounce of a footfall.
    const radial =
      (x * this.gravity.x + y * this.gravity.y + z * this.gravity.z) / gMag - gMag

    const smoothAlpha = dt / (0.02 + dt)
    this.smoothed += (radial - this.smoothed) * smoothAlpha

    this.window.push(this.smoothed)
    if (this.window.length > SHAPE_WINDOW) this.window.shift()

    // 2. Gyroscope bookkeeping.
    if (rotation) {
      const omega =
        Math.sqrt(rotation.alpha ** 2 + rotation.beta ** 2 + rotation.gamma ** 2) * DEG_TO_RAD
      if (Number.isFinite(omega)) {
        this.hasGyro = true
        this.angularSmoothed += (omega - this.angularSmoothed) * (dt / (0.12 + dt))
        this.angularPeak = Math.max(omega, this.angularPeak * Math.exp(-dt / 1.5))
        if (this.angularPeak > ANGULAR_SUSTAINED) {
          // The phone is being handled, not carried: drop the current walk.
          this.clearRun('rolling')
        }
      }
    }

    // 3. Dynamic trigger on a fraction of the decaying peak envelope.
    const envelopeDecay = Math.exp(-dt / 3)
    this.envelope = Math.max(this.smoothed, this.envelope * envelopeDecay)
    const trigger = Math.max(this.floor, this.envelope * this.peakRatio)
    const rearm = trigger * 0.3

    if (!this.peaked && this.smoothed > trigger) {
      this.peaked = true
      this.onPeak(now)
    } else if (this.peaked && this.smoothed < rearm) {
      this.peaked = false
    }

    if (now - this.lastDiagAt > 250) {
      this.lastDiagAt = now
      this.onDiagnostics?.(this.diagnostics())
    }
  }

  private clearRun(reason: string) {
    if (this.run.length) this.rejected += this.run.length
    this.run = []
    this.emitted = 0
    if (this.accepted > 0 || this.rejected > 0) this.lastReason = reason
  }

  private onPeak(now: number) {
    const last = this.peaks[this.peaks.length - 1]
    if (last !== undefined && now - last < SAME_PEAK_GAP * 1000) return

    if (last !== undefined && now - last > RHYTHM_TIMEOUT_MS) {
      this.peaks = []
      this.clearRun('walk ended')
    }

    this.peaks.push(now)
    if (this.peaks.length > PEAK_WINDOW) this.peaks.shift()

    this.validate(now)
  }

  /** Rhythm + shape + gyroscope must all agree before a peak becomes a step. */
  private validate(now: number) {
    const peaks = this.peaks
    if (peaks.length < 3) return

    const intervals: number[] = []
    for (let i = 1; i < peaks.length; i++) {
      intervals.push((peaks[i] - peaks[i - 1]) / 1000)
    }
    const recent = intervals.slice(-3)
    if (recent.length < 2) return
    if (!recent.every((v) => v >= MIN_CADENCE && v <= MAX_CADENCE)) {
      this.lastReason = 'irregular timing'
      return
    }

    const mean = recent.reduce((a, b) => a + b, 0) / recent.length
    const variance = recent.reduce((a, b) => a + (b - mean) ** 2, 0) / recent.length
    const cv = Math.sqrt(variance) / mean
    if (cv > this.cvLimit) {
      this.lastReason = 'irregular timing'
      return
    }

    // Gyroscope gate: gentle rock yes, deliberate handling no.
    if (this.hasGyro && this.angularPeak > this.angularLimit) {
      this.rejected++
      this.lastReason = 'phone being moved'
      this.clearRun('phone being moved')
      return
    }

    // Impact shape: a swung phone is a sine wave and fails here.
    const shape = shapeStats(this.window)
    this.lastShape = shape
    if (shape.skew < this.skewLimit || shape.crest < this.crestLimit) {
      this.rejected++
      this.lastReason = 'smooth motion'
      return
    }

    // Everything agreed — buffer it until the walk is confirmed.
    this.run.push(now)
    this.lastReason = this.run.length >= SUSTAIN_MIN ? 'counting' : 'confirming walk'

    if (this.run.length >= SUSTAIN_MIN) {
      while (this.emitted < this.run.length) {
        this.onStep(this.run[this.emitted])
        this.emitted++
        this.accepted++
      }
    }
  }
}
