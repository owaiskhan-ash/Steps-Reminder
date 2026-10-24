package com.sc.stepreminder;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** After a reboot the midnight rollover has to be scheduled again. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        StepStore.scheduleMidnight(context);
    }
}
