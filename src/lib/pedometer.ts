/**
 * Conservative accelerometer step detector.
 *
 * A phone gets bumped and waved all day, and naive peak counting turns every
 * jostle into a "step". This detector only counts a footfall when the motion
 * *looks like walking*:
 *
 *  1. Vector gravity tracking, then the *signed* acceleration along gravity —
 *     the vertical bounce of a footfall. (Using |linear| instead would rectify
 *     the signal and halve the apparent cadence.) Orientation changes and slow
 *     tilts produce nothing.
 *  2. Time-constant smoothing, so a single jolt is one broad hump rather than a
 *     burst of peaks.
 *  3. Hysteresis peak detection — the signal must climb past a high threshold
 *     and fall back below a low one before another peak can register.
 *  4. **Rhythm validation** — a run of peaks only becomes steps when the
 *     intervals between them are consistent (all inside a human cadence window
 *     and low variance). Random shaking is irregular by nature, so it never
 *     commits. This is what keeps a little nudge from adding a step.
 */

export type AccelSample = {
  x: number
  y: number
  z: number
}

/** Plausible time between footfalls, in seconds. */
const MIN_CADENCE = 0.3
const MAX_CADENCE = 1.5
/** Peaks closer together than this are the same footfall. */
const SAME_PEAK_GAP = 0.22
/** Forgetting a walk after this long without a peak. */
const RHYTHM_TIMEOUT_MS = 2500
/** How many peaks we keep while judging rhythm. */
const PEAK_WINDOW = 6

export type DetectorOptions = {
  sensitivity: number
  onStep: (at: number) => void
}

/**
 * Sensitivity 1 (strict) … 5 (loose).
 * Strict needs a firmer, more regular footfall before it counts anything.
 */
export function thresholdFor(sensitivity: number): number {
  const clamped = Math.min(5, Math.max(1, sensitivity))
  return 2.2 - (clamped - 1) * 0.25 // 2.20 … 1.20 m/s²
}

export function cadenceToleranceFor(sensitivity: number): number {
  const clamped = Math.min(5, Math.max(1, sensitivity))
  return 0.26 + (clamped - 1) * 0.025 // coefficient of variation 0.26 … 0.36
}

export class StepDetector {
  private gravity = { x: 0, y: 0, z: 0 }
  private primed = false
  private lastSampleAt = 0
  private smoothed = 0
  private peaked = false
  private threshold: number
  private cvLimit: number
  private onStep: (at: number) => void

  /** Timestamps (ms) of recent candidate peaks, oldest first. */
  private peaks: number[] = []
  /** Peaks at or before this time have already been counted. */
  private countedThrough = 0
  /** How many usable samples have arrived — used to detect a dead sensor. */
  samples = 0

  constructor(options: DetectorOptions) {
    this.threshold = thresholdFor(options.sensitivity)
    this.cvLimit = cadenceToleranceFor(options.sensitivity)
    this.onStep = options.onStep
  }

  setSensitivity(sensitivity: number) {
    this.threshold = thresholdFor(sensitivity)
    this.cvLimit = cadenceToleranceFor(sensitivity)
  }

  reset() {
    this.samples = 0
    this.primed = false
    this.smoothed = 0
    this.peaked = false
    this.peaks = []
    this.countedThrough = 0
    this.lastSampleAt = 0
  }

  /** Feed one acceleration sample (m/s², gravity included). */
  push(sample: AccelSample, now = Date.now()) {
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

    // Guard against tab-suspension time jumps.
    const dt = Math.min(0.1, Math.max(0.002, (now - this.lastSampleAt) / 1000))
    this.lastSampleAt = now

    // 1. Track gravity with a ~0.45 s time constant, independent of sample rate.
    const gravityAlpha = dt / (0.45 + dt)
    this.gravity.x += (x - this.gravity.x) * gravityAlpha
    this.gravity.y += (y - this.gravity.y) * gravityAlpha
    this.gravity.z += (z - this.gravity.z) * gravityAlpha

    const gMag = Math.sqrt(
      this.gravity.x ** 2 + this.gravity.y ** 2 + this.gravity.z ** 2,
    )
    if (gMag < 1) return
    // Signed vertical acceleration: positive when the phone is pushed up along
    // the gravity axis. One crest per footfall, unlike a rectified magnitude.
    const radial =
      (x * this.gravity.x + y * this.gravity.y + z * this.gravity.z) / gMag - gMag

    // 2. Smooth (~35 ms time constant) to tame sensor noise.
    const smoothAlpha = dt / (0.035 + dt)
    this.smoothed += (radial - this.smoothed) * smoothAlpha

    // 3. Hysteresis peak detection: climb past the threshold, then settle back
    //    below a much lower one before another footfall can register.
    const rearm = this.threshold * 0.3
    if (!this.peaked && this.smoothed > this.threshold) {
      this.peaked = true
      this.onPeak(now)
    } else if (this.peaked && this.smoothed < rearm) {
      this.peaked = false
    }
  }

  private onPeak(now: number) {
    const last = this.peaks[this.peaks.length - 1]
    // Same footfall arriving in a couple of samples, or an impossibly fast one.
    if (last !== undefined && now - last < SAME_PEAK_GAP * 1000) return

    // A long gap means the previous walk ended; the new one must earn its rhythm.
    if (last !== undefined && now - last > RHYTHM_TIMEOUT_MS) {
      this.peaks = []
    }

    this.peaks.push(now)
    if (this.peaks.length > PEAK_WINDOW) this.peaks.shift()

    this.commitIfRhythmic()
  }

  /**
   * Counts pending peaks only once the intervals between them look like walking.
   * Irregular nudges fail the variance test and are silently discarded.
   */
  private commitIfRhythmic() {
    const peaks = this.peaks
    if (peaks.length < 3) return

    const intervals: number[] = []
    for (let i = 1; i < peaks.length; i++) {
      intervals.push((peaks[i] - peaks[i - 1]) / 1000)
    }

    // Judge the two or three most recent intervals.
    const recent = intervals.slice(-3)
    if (recent.length < 2) return
    if (!recent.every((v) => v >= MIN_CADENCE && v <= MAX_CADENCE)) return

    const mean = recent.reduce((a, b) => a + b, 0) / recent.length
    const variance = recent.reduce((a, b) => a + (b - mean) ** 2, 0) / recent.length
    const cv = Math.sqrt(variance) / mean
    if (cv > this.cvLimit) return

    // Rhythm confirmed — credit the peaks that made the pattern, plus anything
    // since the last commit, and let later peaks ride along while it holds.
    const pending = peaks.filter((t) => t > this.countedThrough)
    if (!pending.length) return

    const latest = pending[pending.length - 1]
    this.countedThrough = latest

    for (let i = 0; i < pending.length; i++) {
      // Spread the credit slightly so a burst doesn't land in one millisecond.
      this.onStep(pending[i])
    }
  }
}
