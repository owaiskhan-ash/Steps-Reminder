package com.sc.stepreminder;

import android.Manifest;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.os.SystemClock;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Reads the phone's own step counter (TYPE_STEP_COUNTER) and keeps a persisted
 * daily baseline so today's total is known even for hours when the app was not
 * open. The counter itself is maintained by the OS/hardware and survives the app
 * being killed; it resets only on reboot, which is detected here.
 *
 * A midnight alarm records yesterday's total and starts a fresh baseline, so a
 * week of history builds up without the app ever being launched.
 */
final class StepStore {

    private static final String PREFS = "sc_step_store";
    private static final String KEY_BASELINE_DATE = "baseline_date";
    private static final String KEY_BASELINE_VALUE = "baseline_value";
    private static final String KEY_LAST_VALUE = "last_value";
    private static final String DAY_PREFIX = "day_";

    private StepStore() {}

    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static String today() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    /** Reads the cumulative counter once, blocking briefly. -1 when unavailable. */
    static float readCounter(Context context, long timeoutMs) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            && context.checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION)
                != PackageManager.PERMISSION_GRANTED) {
            return -1f;
        }
        SensorManager manager = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
        if (manager == null) return -1f;
        Sensor sensor = manager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        if (sensor == null) return -1f;

        final float[] value = { -1f };
        final CountDownLatch latch = new CountDownLatch(1);
        SensorEventListener listener = new SensorEventListener() {
            @Override
            public void onSensorChanged(SensorEvent event) {
                value[0] = event.values[0];
                latch.countDown();
            }

            @Override
            public void onAccuracyChanged(Sensor sensor, int accuracy) {}
        };

        boolean registered;
        try {
            registered = manager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_FASTEST);
        } catch (SecurityException e) {
            return -1f;
        }
        if (!registered) return -1f;

        try {
            latch.await(timeoutMs, TimeUnit.MILLISECONDS);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        } finally {
            manager.unregisterListener(listener);
        }
        return value[0];
    }

    /** Result of resolving the counter against the stored baseline. */
    static final class Today {
        final int steps;
        final float counter;
        final boolean rebooted;
        final boolean baselineStartedNow;
        /** True when the counter itself only started today, so it IS today's total. */
        final boolean fromBoot;
        final String since;

        Today(
            int steps,
            float counter,
            boolean rebooted,
            boolean baselineStartedNow,
            boolean fromBoot,
            String since
        ) {
            this.steps = steps;
            this.counter = counter;
            this.rebooted = rebooted;
            this.baselineStartedNow = baselineStartedNow;
            this.fromBoot = fromBoot;
            this.since = since;
        }
    }

    /** Wall-clock time the phone booted. */
    static long bootTimeMillis() {
        return System.currentTimeMillis() - SystemClock.elapsedRealtime();
    }

    /** Start of today, in wall-clock millis. */
    static long midnightMillis() {
        Calendar midnight = Calendar.getInstance();
        midnight.set(Calendar.HOUR_OF_DAY, 0);
        midnight.set(Calendar.MINUTE, 0);
        midnight.set(Calendar.SECOND, 0);
        midnight.set(Calendar.MILLISECOND, 0);
        return midnight.getTimeInMillis();
    }

    /**
     * Today's steps from the counter. Establishes a baseline the first time it is
     * called on a given day; if the app was closed across midnight the baseline
     * restarts at "now" and {@code baselineStartedNow} is true so the UI can say
     * "counting since 09:14" instead of inventing a number.
     */
    static Today resolveToday(Context context, float counter) {
        SharedPreferences p = prefs(context);
        String date = today();
        String baselineDate = p.getString(KEY_BASELINE_DATE, null);
        float baseline = p.getFloat(KEY_BASELINE_VALUE, -1f);
        float lastValue = p.getFloat(KEY_LAST_VALUE, -1f);

        if (counter < 0) {
            return new Today(0, counter, false, false, false, null);
        }

        // Counter went backwards → the phone rebooted since the baseline.
        boolean rebooted = lastValue >= 0 && counter < lastValue;

        if (date.equals(baselineDate) && baseline >= 0 && !rebooted) {
            int steps = Math.max(0, Math.round(counter - baseline));
            int stored = p.getInt(DAY_PREFIX + date, 0);
            p.edit()
                .putFloat(KEY_LAST_VALUE, counter)
                .putInt(DAY_PREFIX + date, Math.max(steps, stored))
                .apply();
            boolean fromBoot = baseline == 0f;
            return new Today(steps, counter, false, false, fromBoot, null);
        }

        // If crossing into a new day before the midnight alarm ran, bank the
        // finished day's reading first so history isn't lost.
        if (baselineDate != null && !date.equals(baselineDate) && baseline >= 0 && !rebooted && counter >= baseline) {
            int priorSteps = Math.round(counter - baseline);
            int existingPrior = p.getInt(DAY_PREFIX + baselineDate, 0);
            if (priorSteps > existingPrior) {
                p.edit().putInt(DAY_PREFIX + baselineDate, priorSteps).apply();
            }
        }

        // No baseline for today yet. If the phone booted after midnight, then
        // every step in the counter happened today, so the counter itself is
        // today's total — this is what the phone's own step card is showing.
        boolean bootedToday = bootTimeMillis() >= midnightMillis();
        if (bootedToday) {
            int steps = Math.max(0, Math.round(counter));
            int stored = p.getInt(DAY_PREFIX + date, 0);
            p.edit()
                .putString(KEY_BASELINE_DATE, date)
                .putFloat(KEY_BASELINE_VALUE, 0f)
                .putFloat(KEY_LAST_VALUE, counter)
                .putInt(DAY_PREFIX + date, Math.max(steps, stored))
                .apply();
            return new Today(steps, counter, rebooted, false, true, null);
        }

        // Booted before today: steps from earlier days are mixed into the
        // counter, so start counting from here rather than inventing a number.
        String now = new SimpleDateFormat("HH:mm", Locale.US).format(new Date());
        int stored = p.getInt(DAY_PREFIX + date, 0);
        p.edit()
            .putString(KEY_BASELINE_DATE, date)
            .putFloat(KEY_BASELINE_VALUE, counter)
            .putFloat(KEY_LAST_VALUE, counter)
            .putInt(DAY_PREFIX + date, stored)
            .apply();
        return new Today(0, counter, rebooted, true, false, now);
    }

    /**
     * Non-blocking snapshot of today's step count from persisted state, used so
     * the home screen widget paints immediately without waiting on sensor I/O.
     */
    static int peekTodaySteps(Context context) {
        SharedPreferences p = prefs(context);
        String date = today();
        int stored = p.getInt(DAY_PREFIX + date, 0);
        String baselineDate = p.getString(KEY_BASELINE_DATE, null);
        float baseline = p.getFloat(KEY_BASELINE_VALUE, -1f);
        float lastValue = p.getFloat(KEY_LAST_VALUE, -1f);
        int fromCounter = 0;
        if (date.equals(baselineDate) && baseline >= 0 && lastValue >= baseline) {
            fromCounter = Math.max(0, Math.round(lastValue - baseline));
        }
        return Math.max(0, Math.max(stored, fromCounter));
    }

    /** Records at least {@code steps} for today (e.g. from motion fallback in JS). */
    static void recordTodayFloor(Context context, int steps) {
        if (steps < 0) return;
        SharedPreferences p = prefs(context);
        String date = today();
        int existing = p.getInt(DAY_PREFIX + date, 0);
        if (steps > existing) {
            p.edit().putInt(DAY_PREFIX + date, steps).apply();
        }
    }

    /** Clears stored steps and baselines when the user resets everything. */
    static void clear(Context context) {
        prefs(context).edit().clear().apply();
        scheduleMidnight(context);
    }

    /**
     * Rolls the baseline at midnight: records the finished day's total and starts
     * a new baseline from the current counter.
     */
    static void rollover(Context context) {
        float counter = readCounter(context, 8000);
        if (counter < 0) return;
        SharedPreferences p = prefs(context);
        String baselineDate = p.getString(KEY_BASELINE_DATE, null);
        float baseline = p.getFloat(KEY_BASELINE_VALUE, -1f);
        String date = today();

        if (baselineDate != null && baseline >= 0 && counter >= baseline) {
            int steps = Math.round(counter - baseline);
            int existing = p.getInt(DAY_PREFIX + baselineDate, 0);
            p.edit().putInt(DAY_PREFIX + baselineDate, Math.max(steps, existing)).apply();
        }

        p.edit()
            .putString(KEY_BASELINE_DATE, date)
            .putFloat(KEY_BASELINE_VALUE, counter)
            .putFloat(KEY_LAST_VALUE, counter)
            .putInt(DAY_PREFIX + date, 0)
            .apply();
    }

    /** Stored daily totals (date → steps), for filling in history on open. */
    static String historyJson(Context context) {
        SharedPreferences p = prefs(context);
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (java.util.Map.Entry<String, ?> entry : p.getAll().entrySet()) {
            if (!entry.getKey().startsWith(DAY_PREFIX)) continue;
            Object value = entry.getValue();
            if (!(value instanceof Integer)) continue;
            if (!first) sb.append(',');
            first = false;
            sb.append('"').append(entry.getKey().substring(DAY_PREFIX.length())).append("\":")
              .append(value);
        }
        return sb.append('}').toString();
    }

    /** Writes a day total (used when the plugin adopts an authoritative value). */
    static void putDay(Context context, String date, int steps) {
        prefs(context).edit().putInt(DAY_PREFIX + date, steps).apply();
    }

    /** Schedules the next midnight rollover. Safe to call often. */
    static void scheduleMidnight(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;

        Intent intent = new Intent(context, MidnightReceiver.class);
        PendingIntent pending = PendingIntent.getBroadcast(
            context,
            0,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Calendar next = Calendar.getInstance();
        next.add(Calendar.DAY_OF_YEAR, 1);
        next.set(Calendar.HOUR_OF_DAY, 0);
        next.set(Calendar.MINUTE, 5);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarms.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    next.getTimeInMillis(),
                    pending
                );
            } else {
                alarms.set(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pending);
            }
        } catch (SecurityException e) {
            // Exact alarms refused (user restricted them) — fall back to inexact.
            alarms.set(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pending);
        }
    }
}
