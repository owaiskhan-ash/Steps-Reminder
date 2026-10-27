package com.sc.stepreminder;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** After a reboot the midnight rollover and widget refresh have to be armed again. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        StepStore.scheduleMidnight(context);
        if (StepWidgetProvider.hasInstances(context)) {
            StepWidgetProvider.schedulePeriodicRefresh(context);
            StepWidgetProvider.refreshAsync(context);
        }
    }
}
