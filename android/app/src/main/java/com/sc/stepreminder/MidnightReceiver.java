package com.sc.stepreminder;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Fires just after midnight: banks the finished day's step total from the phone's
 * counter and starts a fresh baseline, then schedules the next night. This is why
 * history builds up even if the app is never opened.
 */
public class MidnightReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        final Context appContext = context.getApplicationContext();
        final PendingResult pending = goAsync();
        new Thread(() -> {
            try {
                StepStore.rollover(appContext);
                StepWidgetProvider.updateAllFromCache(appContext);
            } finally {
                StepStore.scheduleMidnight(appContext);
                pending.finish();
            }
        }).start();
    }
}
