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
- **Counts real steps** from the accelerometer, with a hysteresis peak detector, gravity tracking
  and a refractory window so a bumpy ride doesn't inflate the count.
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

On a desktop browser there is no accelerometer, so use **Demo walk** on the Today screen to watch
the dial, stats and reminder copy work in real time. On a phone, **Start sensor** asks for motion
access and counts for real.

## Get the APK

**[Download the latest APK →](https://github.com/owaiskhan-ash/Steps-Reminder/releases/latest)**

Sideload it (Settings → install unknown apps). It is signed with the debug key, so it is meant for
testing rather than the Play Store.

## Build the APK yourself

The Android project is already generated (`android/`, Capacitor 7, application id
`com.sc.stepreminder`).

```bash
npm run apk          # build web + sync + ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

Or let CI do it: **Actions → Build Android APK → Run workflow**, then download the
`sc-step-reminder-debug-apk` artifact. That is a signed-with-debug-key APK — installable, good for
testing, not for the Play Store. For a store build, add a keystore and run `assembleRelease`.

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

Steps, goals and history never leave the device. There is no network call in the app at runtime.
