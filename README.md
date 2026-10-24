# SC · Step Reminder

A quietly handsome step counter in leather, felt and suede. Set a daily step target, choose the
hour you want to be nudged, and the app counts your footfalls from the motion sensor. If the day is
slipping away short of your mark, it says so in plain words:

> **Step Reminder** — You're missing out 2,000 of 8,000 steps for the day.

<img src="assets/icon.png" alt="SC Step Reminder icon" width="132" align="left" />

<br clear="left" />

## What it does

- **First run asks two things** — your daily step target (2,000–20,000, with presets) and your
  reminder time. Nothing else.
- **Your phone's own step counter.** Steps come from Android's `TYPE_STEP_COUNTER` — a cumulative
  total the OS keeps while the app is closed — resolved against a persisted midnight baseline. Open
  the app at any hour and you see the day's real total, including steps taken when it wasn't running.
  No login, no Google Fit, no Health Connect, no cloud.
- **Today's total from the first read.** If the phone booted after midnight, every step in the
  counter happened today, so the counter *is* today's total — the app reports the same number your
  phone shows, no baseline guesswork. If the phone booted before today, the older steps can't be
  attributed, so counting starts honestly from "since HH:MM".
- **History builds itself.** A midnight alarm banks the finished day's total, so a week of data
  appears even if you never open the app. A boot receiver re-arms it after a restart, and counter
  resets are detected rather than producing nonsense.
- **No silent fallback.** If the counter is unavailable (no sensor, `ACTIVITY_RECOGNITION` refused)
  the Today screen names the reason and counts **nothing** rather than guessing from motion.
- **Motion counting is a last resort.** *Tune → Fallback: motion sensor* enables the accelerometer
  path for phones with no step counter, with five gates: world-frame
  gravity projection, a **gyroscope gate** (walking rocks the phone gently; arm swinging, figure-8s and
  revolutions exceed the angular limit and are discarded), cadence, impact-shaped waveform, and a
  **sustained-walk requirement** (nothing is credited until 8 consecutive valid footfalls confirm you are
  walking). Gravity is tracked per axis,
  the signed vertical bounce is smoothed and detected with hysteresis, and a footfall is credited
  only once the **rhythm** holds: peaks must fall inside a human cadence window (0.3–1.5 s apart)
  with low variance, **and the waveform looks like an impact** (positive skew, high crest factor)
  rather than a smooth wave. Picking the phone up, swinging it, waving or a bumpy bus ride never
  commits steps; walking tracks the real cadence within a step or two.
- **Reminds you once a day** at your chosen hour, with live copy that reflects exactly how many
  steps are still missing. Native Android builds use a repeating local notification; the web build
  fires a browser notification while the app is open and always shows an in-app nudge.
- **Tells the story** — dial with remaining steps and minutes of walking, distance, energy, streak,
  last seven days, and a daily ledger.
- **Stays local** — goal, reminder and history live in `localStorage`. No account, no cloud, no
  analytics.

## The look

Every surface is stitched, not just decorated: a real SVG saddle-stitch seam is drawn per card
(pixel-space, so dashes never stretch), leather gets a slow grain and a soft top-light, felt gets a
fibre texture, suede gets a lighter nap with debossed type. Buttons are pressed leather; the toggle
knobs are brass. Motion is restrained and respects `prefers-reduced-motion`.

```
Leather  #6C4527 → #462A16   (cards, dial bezel, primary buttons)
Felt     #34302B → #201E1B   (reminder card, week chart, tab bar)
Suede    #B08257 → #7F5936   (sensor controls)
Thread   #E8D5B0             (all stitching)
```

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production bundle in dist/
```

Counting uses the phone's own step counter and starts by itself — there is nothing to switch on.
**Sync** on the Today screen (or in Tune) re-reads it on demand. Step-detection strictness and
stride length live in Tune; the motion fallback stays off unless you turn it on.

## Get the APK

**[Download the latest APK →](https://github.com/owaiskhan-ash/Steps-Reminder/releases/latest)**

A signed **release** build (`SC-Step-Reminder-<version>.apk`), Android 6.0+ (targets Android 15).
Sideload it — Settings → "Install unknown apps" — and it counts steps from the motion sensor,
nudging you at the hour you choose.

It is signed with the project's committed release key, so each new release installs straight over
the previous one. See `android/keystore/README.md`: that key is public and is **not** a Play Store
key.

## Build the APK yourself

The Android project is already generated (`android/`, Capacitor 7, application id
`com.sc.stepreminder`).

```bash
npm run apk:release  # build web + sync + ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/SC-Step-Reminder-<version>.apk
```

Signing details live in `android/keystore.properties`, which `app/build.gradle` reads. **Bump
`versionCode`/`versionName` in `android/app/build.gradle` before each release**, then push a `v*`
tag and CI builds, verifies the signature and attaches the APK to the release.

Or let CI do it: **Actions → Build Android APK → Run workflow**, then download the
`sc-step-reminder-release-apk` artifact. Tagged pushes (`v1.1.0`, …) also publish a GitHub Release
with the APK attached. For the Play Store, swap in a private upload key and build an AAB.

Icons are generated from `assets/icon.png` into every density, the adaptive foreground, the splash
screen and the monochrome status-bar glyph:

```bash
npm run icons
```

## Reminder behaviour

| Platform | Scheduling | Fires when |
| --- | --- | --- |
| Android (Capacitor) | `@capacitor/local-notifications`, repeating daily, exact alarm | App open or closed |
| Web | in-app checker + browser notification | App open |

The notification body is refreshed as your step count changes, so it's accurate to the moment of
the last sync. Time, goal and sensor sensitivity are all editable in **Tune**.

## Project layout

```
src/
  App.tsx                 state, reminder scheduling, day rollover
  screens/                Onboarding · Today · History · Settings
  components/             Dial · Stitch · TabBar · Toasts · Icons
  lib/                    pedometer · notify · storage · format · useStepTracker
  styles.css              the whole tactile design system
assets/icon.png           source app icon (debossed S/C on leather + felt)
scripts/make-icons.mjs    every derived icon, including Android assets
android/                  Capacitor Android project
.github/workflows/        APK build
```

## Privacy

**Tune → Detector diagnostics** shows live sensor type, rotation rate against its limit, cadence,
skew/crest of the waveform, the current walk run and the verdict — enough to see exactly why a step was
accepted or rejected.

Steps, goals and history never leave the device. There is no network call in the app at runtime.
