package com.sc.stepreminder;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.SystemClock;
import android.widget.RemoteViews;

import java.text.NumberFormat;
import java.util.Locale;

/**
 * Minimal 1x1 home screen widget: 95% transparent rounded tile with a small
 * white footsteps glyph and today's step count in white.
 */
public class StepWidgetProvider extends AppWidgetProvider {

    static final String ACTION_REFRESH = "com.sc.stepreminder.ACTION_WIDGET_REFRESH";
    private static final int REFRESH_REQUEST_CODE = 4201;

    static String formatSteps(int steps) {
        int safe = Math.max(0, steps);
        if (safe >= 100000) {
            return String.format(Locale.US, "%dk", safe / 1000);
        }
        return NumberFormat.getIntegerInstance(Locale.US).format(safe);
    }

    static RemoteViews buildViews(Context context, int steps) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.step_widget);
        String formatted = formatSteps(steps);
        views.setTextViewText(R.id.widget_steps, formatted);
        views.setContentDescription(R.id.widget_root, formatted + " steps today");

        Intent launch = new Intent(context, MainActivity.class);
        launch.setFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        PendingIntent launchPending = PendingIntent.getActivity(
            context,
            0,
            launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_root, launchPending);
        return views;
    }

    static int[] getWidgetIds(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        if (manager == null) return new int[0];
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, StepWidgetProvider.class));
        return ids != null ? ids : new int[0];
    }

    static boolean hasInstances(Context context) {
        return getWidgetIds(context).length > 0;
    }

    static void updateAll(Context context, int steps) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        if (manager == null) return;
        int[] ids = getWidgetIds(context);
        if (ids.length == 0) return;
        manager.updateAppWidget(ids, buildViews(context, steps));
    }

    static void updateAllFromCache(Context context) {
        if (!hasInstances(context)) return;
        updateAll(context, StepStore.peekTodaySteps(context));
    }

    static void refreshAsync(final Context context) {
        if (context == null) return;
        final Context appContext = context.getApplicationContext();
        if (!hasInstances(appContext)) return;
        updateAllFromCache(appContext);
        new Thread(() -> {
            float counter = StepStore.readCounter(appContext, 1500);
            if (counter >= 0) {
                StepStore.resolveToday(appContext, counter);
            }
            updateAll(appContext, StepStore.peekTodaySteps(appContext));
        }).start();
    }

    /**
     * Schedules a non-wakeup inexact 15-minute refresh while at least one widget
     * is placed. Because it uses ELAPSED_REALTIME (not _WAKEUP), it costs zero
     * battery while the phone sleeps and fires as soon as the phone wakes up.
     */
    static void schedulePeriodicRefresh(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        Intent intent = new Intent(context, StepWidgetProvider.class);
        intent.setAction(ACTION_REFRESH);
        PendingIntent pending = PendingIntent.getBroadcast(
            context,
            REFRESH_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        alarms.setInexactRepeating(
            AlarmManager.ELAPSED_REALTIME,
            SystemClock.elapsedRealtime() + AlarmManager.INTERVAL_FIFTEEN_MINUTES,
            AlarmManager.INTERVAL_FIFTEEN_MINUTES,
            pending
        );
    }

    static void cancelPeriodicRefresh(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        Intent intent = new Intent(context, StepWidgetProvider.class);
        intent.setAction(ACTION_REFRESH);
        PendingIntent pending = PendingIntent.getBroadcast(
            context,
            REFRESH_REQUEST_CODE,
            intent,
            PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE
        );
        if (pending != null) {
            alarms.cancel(pending);
            pending.cancel();
        }
    }

    @Override
    public void onEnabled(Context context) {
        super.onEnabled(context);
        schedulePeriodicRefresh(context);
    }

    @Override
    public void onDisabled(Context context) {
        super.onDisabled(context);
        cancelPeriodicRefresh(context);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        schedulePeriodicRefresh(context);
        int cached = StepStore.peekTodaySteps(context);
        appWidgetManager.updateAppWidget(appWidgetIds, buildViews(context, cached));

        final Context appContext = context.getApplicationContext();
        final PendingResult pending = goAsync();
        new Thread(() -> {
            try {
                float counter = StepStore.readCounter(appContext, 1500);
                if (counter >= 0) {
                    StepStore.resolveToday(appContext, counter);
                }
                updateAll(appContext, StepStore.peekTodaySteps(appContext));
            } finally {
                pending.finish();
            }
        }).start();
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (intent != null && ACTION_REFRESH.equals(intent.getAction())) {
            if (!hasInstances(context)) {
                cancelPeriodicRefresh(context);
                return;
            }
            final Context appContext = context.getApplicationContext();
            final PendingResult pending = goAsync();
            new Thread(() -> {
                try {
                    float counter = StepStore.readCounter(appContext, 1500);
                    if (counter >= 0) {
                        StepStore.resolveToday(appContext, counter);
                    }
                    updateAll(appContext, StepStore.peekTodaySteps(appContext));
                } finally {
                    pending.finish();
                }
            }).start();
        }
    }
}
