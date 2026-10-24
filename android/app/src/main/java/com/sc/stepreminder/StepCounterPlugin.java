package com.sc.stepreminder;

import android.Manifest;
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
    private boolean listening;

    @Override
    public void load() {
        sensorManager = (SensorManager) getContext().getSystemService(android.content.Context.SENSOR_SERVICE);
        if (sensorManager == null) return;
        stepCounter = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
        stepDetector = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR);
        // Keep the midnight rollover armed whenever the plugin loads.
        StepStore.scheduleMidnight(getContext());
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_STEP_COUNTER) {
            latestCounter = event.values[0];
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
            resolveToday(call);
        } else {
            JSObject result = new JSObject();
            result.put("steps", 0);
            result.put("permission", "denied");
            call.resolve(result);
        }
    }

    private void resolveToday(PluginCall call) {
        final android.content.Context context = getContext();
        new Thread(() -> {
            float counter = StepStore.readCounter(context, 2500);
            JSObject result = new JSObject();
            if (counter < 0) {
                result.put("steps", 0);
                result.put("available", false);
                call.resolve(result);
                return;
            }
            latestCounter = counter;
            StepStore.Today today = StepStore.resolveToday(context, counter);
            result.put("steps", today.steps);
            result.put("counter", today.counter);
            result.put("rebooted", today.rebooted);
            result.put("baselineStartedNow", today.baselineStartedNow);
            if (today.since != null) result.put("since", today.since);
            result.put("available", true);
            result.put("history", StepStore.historyJson(context));
            call.resolve(result);
        }).start();
    }

    /** Debug/verification helper: the raw cumulative counter value. */
    @PluginMethod
    public void getRawCounter(PluginCall call) {
        final android.content.Context context = getContext();
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
        final android.content.Context context = getContext();
        new Thread(() -> {
            StepStore.rollover(context);
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
        if (sensorManager != null) sensorManager.unregisterListener(this);
        listening = false;
        call.resolve();
    }
}
