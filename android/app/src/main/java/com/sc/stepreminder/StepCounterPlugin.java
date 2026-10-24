package com.sc.stepreminder;

import android.Manifest;
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
 * Hardware step counting.
 *
 * Android's TYPE_STEP_DETECTOR fires one event per detected footfall using the
 * platform's own motion classifier — it does not count hand swinging, shaking or
 * bumps, and it costs far less battery than sampling the accelerometer. Where
 * only TYPE_STEP_COUNTER exists (a cumulative counter since boot) we diff it.
 *
 * The web layer prefers this plugin and falls back to its accelerometer detector
 * when no hardware step sensor is present.
 */
@CapacitorPlugin(
    name = "StepCounter",
    permissions = {
        @Permission(alias = "activity", strings = { Manifest.permission.ACTIVITY_RECOGNITION })
    }
)
public class StepCounterPlugin extends Plugin implements SensorEventListener {

    private SensorManager sensorManager;
    private Sensor stepDetector;
    private Sensor stepCounter;
    private float lastCounterValue = -1f;
    private boolean listening = false;

    @Override
    public void load() {
        Context context = getContext();
        sensorManager = (SensorManager) context.getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager == null) return;
        stepDetector = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR);
        stepCounter = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject result = new JSObject();
        boolean available = stepDetector != null || stepCounter != null;
        String kind = stepDetector != null ? "detector" : (stepCounter != null ? "counter" : "none");
        result.put("available", available);
        result.put("kind", kind);
        call.resolve(result);
    }

    @PluginMethod
    public void start(PluginCall call) {
        // ACTIVITY_RECOGNITION only exists from Android 10; older versions grant
        // step sensors to any app.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            && getPermissionState("activity") != PermissionState.GRANTED) {
            requestPermissionForAlias("activity", call, "onActivityPermission");
            return;
        }
        startListening(call);
    }

    @PermissionCallback
    private void onActivityPermission(PluginCall call) {
        if (getPermissionState("activity") == PermissionState.GRANTED) {
            startListening(call);
        } else {
            call.reject("Activity recognition permission is needed for hardware step counting.");
        }
    }

    private void startListening(PluginCall call) {
        if (listening) {
            call.resolve();
            return;
        }
        Sensor sensor = stepDetector != null ? stepDetector : stepCounter;
        if (sensor == null || sensorManager == null) {
            call.reject("This device has no step sensor.");
            return;
        }
        sensorManager.registerListener(this, sensor, SensorManager.SENSOR_DELAY_UI);
        listening = true;
        lastCounterValue = -1f;
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (sensorManager != null) sensorManager.unregisterListener(this);
        listening = false;
        call.resolve();
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        int type = event.sensor.getType();
        if (type == Sensor.TYPE_STEP_DETECTOR) {
            emitStep();
        } else if (type == Sensor.TYPE_STEP_COUNTER) {
            float total = event.values[0];
            if (lastCounterValue >= 0f && total > lastCounterValue) {
                int delta = Math.round(total - lastCounterValue);
                // Ignore absurd jumps (e.g. sensor reset after reboot).
                if (delta > 0 && delta < 500) {
                    for (int i = 0; i < delta; i++) emitStep();
                }
            }
            lastCounterValue = total;
        }
    }

    private void emitStep() {
        notifyListeners("step", new JSObject());
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // nothing to do
    }

    @Override
    protected void handleOnPause() {
        // Keep listening: the WebView layer decides when counting should stop, and
        // the hardware sensor is cheap.
        super.handleOnPause();
    }
}
