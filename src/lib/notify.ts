import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { fmt } from './format'

export const REMINDER_CHANNEL = 'step-reminders'
export const DAILY_ID = 4101

export function isNative(): boolean {
  return Capacitor.isNativePlatform()
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (isNative()) {
    const res = await LocalNotifications.checkPermissions()
    if (res.display === 'granted') return true
    const req = await LocalNotifications.requestPermissions()
    return req.display === 'granted'
  }
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const perm = await Notification.requestPermission()
  return perm === 'granted'
}

export function notificationPermission(): 'granted' | 'denied' | 'default' | 'unsupported' {
  if (isNative()) return 'default'
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission as 'granted' | 'denied' | 'default'
}

export function reminderCopy(remaining: number, goal: number): { title: string; body: string } {
  if (remaining <= 0) {
    return {
      title: 'Goal reached',
      body: `All ${fmt(goal)} steps are in the bag. Beautifully done.`,
    }
  }
  return {
    title: 'Step Reminder',
    body: `You're missing out ${fmt(remaining)} of ${fmt(goal)} steps for the day. A short walk still counts.`,
  }
}

async function ensureChannel() {
  if (!isNative()) return
  try {
    await LocalNotifications.createChannel({
      id: REMINDER_CHANNEL,
      name: 'Step reminders',
      description: 'Daily nudges about your remaining steps',
      importance: 4,
      visibility: 1,
      vibration: true,
    })
  } catch {
    /* channel may already exist */
  }
}

/** (Re)schedule the daily nudge, keeping the copy in sync with today's steps. */
export async function scheduleDailyReminder(
  time: string,
  remaining: number,
  goal: number,
): Promise<void> {
  const [hour, minute] = time.split(':').map(Number)
  const { title, body } = reminderCopy(remaining, goal)

  if (isNative()) {
    try {
      await ensureChannel()
      await LocalNotifications.cancel({ notifications: [{ id: DAILY_ID }] })
      await LocalNotifications.schedule({
        notifications: [
          {
            id: DAILY_ID,
            title,
            body,
            channelId: REMINDER_CHANNEL,
            smallIcon: 'ic_stat_sc',
            schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true },
          },
        ],
      })
    } catch {
      /* permission or platform issue — in-app reminder still runs */
    }
    return
  }

  // Web: nothing to persist while the tab is closed, but we can keep the last
  // message handy for the in-app scheduler.
  try {
    localStorage.setItem(
      'sc-reminder-copy',
      JSON.stringify({ title, body, at: `${hour}:${minute}` }),
    )
  } catch {
    /* ignore */
  }
}

export async function testNotification(remaining: number, goal: number): Promise<boolean> {
  const { title, body } = reminderCopy(remaining, goal)
  const ok = await ensureNotificationPermission()
  if (!ok) return false

  if (isNative()) {
    try {
      await ensureChannel()
      await LocalNotifications.schedule({
        notifications: [
          {
            id: DAILY_ID + 1,
            title,
            body,
            channelId: REMINDER_CHANNEL,
            smallIcon: 'ic_stat_sc',
            schedule: { at: new Date(Date.now() + 1200), allowWhileIdle: true },
          },
        ],
      })
      return true
    } catch {
      return false
    }
  }

  try {
    new Notification(title, { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png' })
    return true
  } catch {
    return false
  }
}

/** Fire the daily reminder from the app itself (works when the app is open). */
export function fireInAppReminder(remaining: number, goal: number) {
  const { title, body } = reminderCopy(remaining, goal)
  try {
    new Notification(title, { body, icon: '/icons/icon-192.png' })
  } catch {
    /* ignore */
  }
  return { title, body }
}

export async function cancelDailyReminder() {
  if (!isNative()) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: DAILY_ID }] })
  } catch {
    /* ignore */
  }
}

export async function buzz(): Promise<void> {
  if (isNative()) {
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
      await Haptics.impact({ style: ImpactStyle.Medium })
    } catch {
      /* ignore */
    }
    return
  }
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate(14)
    } catch {
      /* ignore */
    }
  }
}
