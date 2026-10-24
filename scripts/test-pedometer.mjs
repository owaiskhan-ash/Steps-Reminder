/**
 * Step-detector regression tests.
 *
 * Feeds simulated accelerometer + gyroscope streams through the real detector:
 * walking must be counted, and every non-walking gesture (hand swinging,
 * figure-8s, revolutions, shaking) must count exactly zero.
 *
 * Run with `npm run test:steps`.
 */
import { StepDetector } from '../src/lib/pedometer.ts'

const HZ = 50
const DT_MS = 1000 / HZ
const DT_S = 1 / HZ
const R2D = 180 / Math.PI

/* ---------------------------------------------------------- seeded rng --- */
let seed = 12345
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}
const noise = (a) => (rand() - 0.5) * 2 * a

/* ------------------------------------------------------------- signals --- */
function build({ seconds, vertical, gyro }) {
  const accel = []
  const rot = []
  for (let i = 0; i < seconds * HZ; i++) {
    const t = i * DT_S
    const g = gyro(t)
    accel.push({
      x: noise(0.25) + (g.tiltX ?? 0),
      y: vertical(t) * 0.2 + noise(0.25),
      z: 9.81 + vertical(t) * Math.cos(g.tilt ?? 0) + noise(0.35),
    })
    rot.push({ alpha: g.a, beta: g.b, gamma: g.c })
  }
  return { accel, rot }
}

/** Walking: sharp vertical impacts, gentle wrist rock (~70 °/s). */
function walking(stepHz, seconds, amp = 3.2, gyroAmp = 70) {
  const period = 1 / stepHz
  const pulse = 0.22 / period
  return build({
    seconds,
    vertical: (t) => {
      const phase = (t % period) / period
      let v = 0
      if (phase < pulse) v = amp * Math.sin(Math.PI * Math.pow(phase / pulse, 0.55))
      const q = (phase + 0.5) % 1
      if (q < pulse * 0.7) v += amp * 0.35 * Math.sin(Math.PI * (q / (pulse * 0.7)))
      return v
    },
    gyro: (t) => {
      const w = gyroAmp * Math.sin(2 * Math.PI * (stepHz / 2) * t)
      return { a: w * 0.3, b: w * 1.6, c: w * 0.4 }
    },
  })
}

/** Arm swinging: large sinusoidal vertical, big wrist rotation (~260 °/s). */
function armSwing(hz, seconds, amp = 4.5, gyroAmp = 260) {
  return build({
    seconds,
    vertical: (t) => amp * Math.sin(2 * Math.PI * hz * t),
    gyro: (t) => {
      const w = gyroAmp * Math.cos(2 * Math.PI * hz * t)
      return { a: w * 0.4, b: w * 1.5, c: w * 0.6, tilt: 0.5, tiltX: w * 0.002 }
    },
  })
}

/** Figure of eight: coupled rotations. */
function figureEight(hz, seconds, gyroAmp = 330) {
  return build({
    seconds,
    vertical: (t) =>
      3.4 * Math.sin(2 * Math.PI * hz * t) + 1.6 * Math.sin(4 * Math.PI * hz * t + 1),
    gyro: (t) => ({
      a: gyroAmp * Math.sin(2 * Math.PI * hz * t),
      b: gyroAmp * Math.cos(4 * Math.PI * hz * t),
      c: gyroAmp * 0.7 * Math.sin(4 * Math.PI * hz * t + 0.6),
      tilt: 0.9,
      tiltX: gyroAmp * 0.001 * Math.cos(2 * Math.PI * hz * t),
    }),
  })
}

/** Revolution: continuous spin with centripetal pull. */
function revolution(hz, seconds, gyroAmp = 400) {
  return build({
    seconds,
    vertical: (t) => 6 * Math.sin(2 * Math.PI * hz * t) + 4 * Math.sin(4 * Math.PI * hz * t),
    gyro: (t) => ({
      a: gyroAmp,
      b: gyroAmp * 0.9 * Math.sin(2 * Math.PI * hz * t),
      c: gyroAmp * 0.5,
      tilt: 1.2,
      tiltX: 2.5 * Math.cos(2 * Math.PI * hz * t),
    }),
  })
}

/** Random shaking. */
function shaking(seconds) {
  let lo = 0
  return build({
    seconds,
    vertical: () => {
      const w = noise(1.8)
      lo += (w - lo) * 0.25
      return lo * 3
    },
    gyro: () => ({ a: noise(300), b: noise(300), c: noise(300), tilt: noise(0.6), tiltX: noise(1.5) }),
  })
}

/* --------------------------------------------------------------- runner --- */
function count({ accel, rot }, sensitivity = 2, withGyro = true) {
  let n = 0
  const d = new StepDetector({ sensitivity, onStep: () => n++ })
  accel.forEach((a, i) => d.push(a, i * DT_MS, withGyro ? rot[i] : undefined))
  return n
}

let failures = 0
const check = (label, got, pass, note = '') => {
  if (!pass) failures++
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(36)} ${String(got).padStart(4)}  ${note}`)
}

console.log('walking — should count close to the real cadence')
check('walk 1.4/s, 30 s', count(walking(1.4, 30, 2.3)), ((n) => n >= 32 && n <= 48)(count(walking(1.4, 30, 2.3))), '≈42')
{
  const n = count(walking(1.6, 30))
  check('walk 1.6/s, 30 s', n, n >= 38 && n <= 52, '≈48')
}
{
  const n = count(walking(1.8, 30))
  check('walk 1.8/s, 30 s', n, n >= 44 && n <= 58, '≈54')
}
{
  const n = count(walking(2.2, 30))
  check('walk 2.2/s, 30 s', n, n >= 52 && n <= 70, '≈66')
}
{
  const n = count(walking(1.8, 30, 2.6, 25))
  check('walk 1.8/s, pocket (low gyro)', n, n >= 44, '≈54')
}
{
  const n = count(walking(1.8, 20), 2, false)
  check('walk 1.8/s, no gyro data', n, n >= 26, 'shape test carries it')
}

console.log('\ngestures — must count exactly zero')
for (const hz of [0.8, 1.0, 1.2, 1.5]) {
  const n = count(armSwing(hz, 20))
  check(`arm swing ${hz} Hz`, n, n === 0)
}
for (const hz of [0.8, 1.2, 1.6]) {
  const n = count(figureEight(hz, 20))
  check(`figure-8 ${hz} Hz`, n, n === 0)
}
for (const hz of [0.7, 1.0, 1.4]) {
  const n = count(revolution(hz, 20))
  check(`revolution ${hz} Hz`, n, n === 0)
}
{
  const n = count(shaking(20))
  check('random shaking', n, n === 0)
}

console.log('\nmixed — a gesture mid-walk must not add anything')
{
  const walk = walking(1.8, 20)
  const swing = armSwing(1.2, 10)
  const mixed = { accel: [...walk.accel, ...swing.accel], rot: [...walk.rot, ...swing.rot] }
  const n = count(mixed)
  check('20 s walk + 10 s swing', n, n >= 28 && n <= 42, 'walk only ≈36')
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
