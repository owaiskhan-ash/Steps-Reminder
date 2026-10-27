package com.sc.stepreminder;

import android.Manifest;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * The phone's own step counter.
 *
 * `TYPE_STEP_COUNTER` is a cumulative total maintained by the hardware/OS that
 * keeps advancing even when this app is closed. We resolve it against a persisted
 * midnight baseline, so opening the app at any hour shows today's real total —
 * including steps taken while it wasn't running — with no login, no Health
 * Connect and no cloud.
 *
 * `TYPE_STEP_DETECTOR` (one event per footfall) is kept only for an optional live
 * readout.
 */
@CapacitorPlugin(
    name = "StepCounter",
    permissions = {
        @Permission(alias = "activity", strings = { Manifest.permission.ACTIVITY_RECOGNITION })
    }
)
public class StepCounterPlugin extends Plugin implements SensorEventListener {

    private SensorManager sensorManager;
    private Sensor stepCounter;
    private Sensor stepDetector;
    private volatile float latestCounter = -1f;
    private volatile long lastWidgetPushMs = 0L;
    private volatile int lastWidgetSteps = -1;
    private boolean listening;

    @Override
    public void load() {
        Context context = getContext();
        sensorManager = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager == null) return;
        stepCounter = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        stepDetector = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR);
        // Keep the midnight rollover armed whenever the plugin loads.
        StepStore.scheduleMidnight(context);

        // Listen to the cumulative counter permanently. It is extremely low
        // power, and it means a reading is always available instantly — a
        // one-shot read can otherwise time out on devices that only report the
        // counter when a step occurs.
        if (stepCounter != null) {
            try {
                sensorManager.registerListener(this, stepCounter, SensorManager.SENSOR_DELAY_NORMAL);
            } catch (SecurityException ignored) {
                // Permission will be requested in getTodaySteps().
            }
        }
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        StepWidgetProvider.refreshAsync(getContext());
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_STEP_COUNTER) {
            latestCounter = event.values[0];
            Context context = getContext();
            if (context != null) {
                long now = System.currentTimeMillis();
                if (now - lastWidgetPushMs >= 3000L && StepWidgetProvider.hasInstances(context)) {
                    lastWidgetPushMs = now;
                    StepStore.Today today = StepStore.resolveToday(context, latestCounter);
                    int effective = Math.max(today.steps, StepStore.peekTodaySteps(context));
                    if (effective != lastWidgetSteps) {
                        lastWidgetSteps = effective;
                        StepWidgetProvider.updateAll(context, effective);
                    }
                }
            }
        } else if (event.sensor.getType() == Sensor.TYPE_STEP_DETECTOR) {
            notifyListeners("step", new JSObject());
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}

    /** True when this device exposes a cumulative step counter. */
    @PluginMethod
    public void isAvailable(PluginCall call) {
        boolean counter = stepCounter != null;
        boolean detector = stepDetector != null;
        JSObject result = new JSObject();
        result.put("available", counter || detector);
        result.put("kind", counter ? "counter" : (detector ? "detector" : "none"));
        call.resolve(result);
    }

    /**
     * Today's steps from the phone counter, resolved against the stored baseline.
     * Resolves with { steps, counter, rebooted, baselineStartedNow, since, history }.
     */
    @PluginMethod
    public void getTodaySteps(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            && getPermissionState("activity") != PermissionState.GRANTED) {
            requestPermissionForAlias("activity", call, "onActivityPermission");
            return;
        }
        resolveToday(call);
    }

    @PermissionCallback
    private void onActivityPermission(PluginCall call) {
        if (getPermissionState("activity") == PermissionState.GRANTED) {
            if (sensorManager != null && stepCounter != null) {
                try {
                    sensorManager.registerListener(this, stepCounter, SensorManager.SENSOR_DELAY_NORMAL);
                } catch (SecurityException ignored) {}
            }
            resolveToday(call);
        } else {
            JSObject result = new JSObject();
            result.put("steps", 0);
            result.put("permission", "denied");
            call.resolve(result);
        }
    }

    private void resolveToday(PluginCall call) {
        final Context context = getContext();
        new Thread(() -> {
            float counter = StepStore.readCounter(context, 1500);
            // Fall back to the continuously-updated value rather than failing.
            if (counter < 0) counter = latestCounter;
            JSObject result = new JSObject();
            if (counter < 0) {
                result.put("steps", 0);
                result.put("available", false);
                result.put(
                    "reason",
                    "The step counter hasn't reported yet. Take a few steps, then sync again."
                );
                call.resolve(result);
                return;
            }
            latestCounter = counter;
            StepStore.Today today = StepStore.resolveToday(context, counter);
            int effective = Math.max(today.steps, StepStore.peekTodaySteps(context));
            lastWidgetSteps = effective;
            StepWidgetProvider.updateAll(context, effective);

            result.put("steps", today.steps);
            result.put("counter", today.counter);
            result.put("rebooted", today.rebooted);
            result.put("baselineStartedNow", today.baselineStartedNow);
            result.put("fromBoot", today.fromBoot);
            if (today.since != null) result.put("since", today.since);
            result.put("available", true);
            result.put("history", StepStore.historyJson(context));
            call.resolve(result);
        }).start();
    }

    /** Keeps the 1x1 home screen widget synced with app-reported steps or resets. */
    @PluginMethod
    public void syncWidget(PluginCall call) {
        Context context = getContext();
        boolean reset = Boolean.TRUE.equals(call.getBoolean("reset", false));
        if (reset) {
            StepStore.clear(context);
            lastWidgetSteps = 0;
            StepWidgetProvider.updateAll(context, 0);
            JSObject result = new JSObject();
            result.put("ok", true);
            call.resolve(result);
            return;
        }
        Integer passed = call.getInt("steps", 0);
        int steps = Math.max(0, passed != null ? passed : 0);
        StepStore.recordTodayFloor(context, steps);
        int effective = StepStore.peekTodaySteps(context);
        lastWidgetSteps = effective;
        StepWidgetProvider.updateAll(context, effective);
        JSObject result = new JSObject();
        result.put("ok", true);
        result.put("steps", effective);
        call.resolve(result);
    }

    /** Returns whether the 1x1 widget is placed and if one-tap pinning is supported. */
    @PluginMethod
    public void getWidgetStatus(PluginCall call) {
        Context context = getContext();
        int count = StepWidgetProvider.getWidgetIds(context).length;
        boolean pinSupported = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            pinSupported = manager != null && manager.isRequestPinAppWidgetSupported();
        }
        JSObject result = new JSObject();
        result.put("supported", true);
        result.put("pinSupported", pinSupported);
        result.put("count", count);
        call.resolve(result);
    }

    /** Opens Android's native Pin Widget sheet for the 1x1 step widget (API 26+). */
    @PluginMethod
    public void requestPinWidget(PluginCall call) {
        Context context = getContext();
        boolean requested = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            if (manager != null && manager.isRequestPinAppWidgetSupported()) {
                ComponentName provider = new ComponentName(context, StepWidgetProvider.class);
                requested = manager.requestPinAppWidget(provider, null, null);
            }
        }
        JSObject result = new JSObject();
        result.put("requested", requested);
        call.resolve(result);
    }

    /** Debug/verification helper: the raw cumulative counter value. */
    @PluginMethod
    public void getRawCounter(PluginCall call) {
        final Context context = getContext();
        new Thread(() -> {
            float counter = StepStore.readCounter(context, 2500);
            JSObject result = new JSObject();
            result.put("counter", counter);
            call.resolve(result);
        }).start();
    }

    /** Manual trigger for the midnight banking, exposed for testing. */
    @PluginMethod
    public void bankToday(PluginCall call) {
        final Context context = getContext();
        new Thread(() -> {
            StepStore.rollover(context);
            StepWidgetProvider.updateAllFromCache(context);
            JSObject result = new JSObject();
            result.put("ok", true);
            result.put("history", StepStore.historyJson(context));
            call.resolve(result);
        }).start();
    }

    /** Optional live footfall events (TYPE_STEP_DETECTOR). */
    @PluginMethod
    public void start(PluginCall call) {
        if (stepDetector == null || sensorManager == null) {
            call.reject("This device has no step detector.");
            return;
        }
        if (!listening) {
            sensorManager.registerListener(this, stepDetector, SensorManager.SENSOR_DELAY_UI);
            listening = true;
        }
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (sensorManager != null && stepDetector != null) {
            sensorManager.unregisterListener(this, stepDetector);
        }
        listening = false;
        call.resolve();
    }
}
