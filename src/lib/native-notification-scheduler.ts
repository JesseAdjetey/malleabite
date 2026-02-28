// Native notification scheduler — pre-schedules OS-level notifications
// so alarms/reminders fire even when the app is closed or backgrounded.
// On web, this module is a no-op (web uses polling in use-notification-manager).

import { isNative, isAndroid } from '@/lib/platform';
import type { Alarm } from '@/hooks/use-alarms';
import type { Reminder } from '@/hooks/use-reminders';
import { Timestamp } from 'firebase/firestore';

// ── ID Hashing ──────────────────────────────────────────────────────────────────
// Capacitor LocalNotifications requires numeric IDs (32-bit signed int).
// Firestore IDs are 20-char alphanumeric strings. We use DJB2 hash to convert.

export function firestoreIdToNumericId(firestoreId: string, prefix: number = 0): number {
  let hash = 5381;
  for (let i = 0; i < firestoreId.length; i++) {
    hash = ((hash << 5) + hash + firestoreId.charCodeAt(i)) & 0x7fffffff;
  }
  return ((hash + prefix) & 0x7fffffff) || 1; // Ensure non-zero
}

// ── Sound Mapping ───────────────────────────────────────────────────────────────
// Android res/raw files cannot have hyphens; use underscored names without extension.

function getSoundFileName(soundId?: string): string {
  const map: Record<string, string> = {
    'default': 'default_notification',
    'bell': 'bell_notification',
    'chime': 'chime_notification',
    'soft': 'soft_notification',
  };
  return map[soundId || 'default'] || 'default_notification';
}

// ── Time Parsing ────────────────────────────────────────────────────────────────

function parseAlarmTime(time: string | Date): Date {
  if (time instanceof Date) return time;
  if (typeof time !== 'string') return new Date(time as any);

  // Simple HH:MM format
  const isSimpleTime = time.length <= 8 && time.includes(':') && !time.includes('T') && !time.includes('-');
  if (isSimpleTime) {
    const [hours, minutes] = time.split(':').map(Number);
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    // If time already passed today, schedule for tomorrow
    if (d.getTime() <= Date.now()) {
      d.setDate(d.getDate() + 1);
    }
    return d;
  }

  // ISO string or other parseable format
  return new Date(time);
}

function parseReminderTime(reminderTime: string | Timestamp): Date {
  if (reminderTime instanceof Timestamp) {
    return reminderTime.toDate();
  }
  if (typeof reminderTime === 'object' && 'toDate' in (reminderTime as any)) {
    return (reminderTime as any).toDate();
  }
  return new Date(reminderTime);
}

// ── Notification Channels (Android) ─────────────────────────────────────────────

export async function createNotificationChannels(): Promise<void> {
  if (!isNative || !isAndroid) return;

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');

    await LocalNotifications.createChannel({
      id: 'alarms',
      name: 'Alarms',
      description: 'Alarm notifications',
      importance: 5, // IMPORTANCE_HIGH — heads-up notification
      visibility: 1, // PUBLIC
      sound: 'default_notification',
      vibration: true,
    });

    await LocalNotifications.createChannel({
      id: 'reminders',
      name: 'Reminders',
      description: 'Reminder notifications',
      importance: 4, // IMPORTANCE_DEFAULT
      visibility: 1,
      sound: 'default_notification',
      vibration: true,
    });

    console.log('[NativeScheduler] Notification channels created');
  } catch (err) {
    console.error('[NativeScheduler] Failed to create channels:', err);
  }
}

// ── Schedule Alarm ──────────────────────────────────────────────────────────────

export async function scheduleAlarmNotification(alarm: Alarm): Promise<void> {
  if (!isNative || !alarm.id || !alarm.enabled) return;

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const sound = getSoundFileName(alarm.soundId);

    // Repeat alarm: schedule one notification per repeat day
    if (alarm.repeatDays && alarm.repeatDays.length > 0) {
      const alarmDate = parseAlarmTime(alarm.time);
      const hour = alarmDate.getHours();
      const minute = alarmDate.getMinutes();

      const notifications = alarm.repeatDays.map((day, idx) => ({
        id: firestoreIdToNumericId(alarm.id!, idx + 1),
        title: `⏰ ${alarm.title}`,
        body: `Alarm at ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
        schedule: {
          on: { weekday: day + 1, hour, minute }, // Capacitor weekday: 1=Sunday..7=Saturday
          every: 'week' as const,
          allowWhileIdle: true,
        },
        channelId: 'alarms',
        sound,
        extra: { alarmId: alarm.id, type: 'alarm', soundId: alarm.soundId || 'default' },
      }));

      await LocalNotifications.schedule({ notifications });
      console.log(`[NativeScheduler] Scheduled repeat alarm "${alarm.title}" for ${alarm.repeatDays.length} days`);
    } else {
      // One-time alarm
      const at = parseAlarmTime(alarm.time);

      // Don't schedule if already in the past
      if (at.getTime() <= Date.now()) {
        console.log(`[NativeScheduler] Skipping past alarm "${alarm.title}"`);
        return;
      }

      await LocalNotifications.schedule({
        notifications: [{
          id: firestoreIdToNumericId(alarm.id),
          title: `⏰ ${alarm.title}`,
          body: `Alarm at ${at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          schedule: { at, allowWhileIdle: true },
          channelId: 'alarms',
          sound,
          extra: { alarmId: alarm.id, type: 'alarm', soundId: alarm.soundId || 'default' },
        }],
      });
      console.log(`[NativeScheduler] Scheduled one-time alarm "${alarm.title}" at ${at.toISOString()}`);
    }
  } catch (err) {
    console.error(`[NativeScheduler] Failed to schedule alarm "${alarm.title}":`, err);
  }
}

// ── Cancel Alarm ────────────────────────────────────────────────────────────────

export async function cancelAlarmNotification(alarmId: string): Promise<void> {
  if (!isNative) return;

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');

    // Cancel base ID + all 7 possible repeat-day variant IDs
    const ids = [firestoreIdToNumericId(alarmId)];
    for (let i = 0; i < 7; i++) {
      ids.push(firestoreIdToNumericId(alarmId, i + 1));
    }

    await LocalNotifications.cancel({
      notifications: ids.map(id => ({ id })),
    });
    console.log(`[NativeScheduler] Cancelled alarm notifications for ${alarmId}`);
  } catch (err) {
    console.error(`[NativeScheduler] Failed to cancel alarm ${alarmId}:`, err);
  }
}

// ── Schedule Reminder ───────────────────────────────────────────────────────────

export async function scheduleReminderNotification(reminder: Reminder): Promise<void> {
  if (!isNative || !reminder.id || !reminder.isActive) return;

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    const at = parseReminderTime(reminder.reminderTime);

    // Don't schedule if already in the past
    if (at.getTime() <= Date.now()) {
      console.log(`[NativeScheduler] Skipping past reminder "${reminder.title}"`);
      return;
    }

    const sound = getSoundFileName(reminder.soundId || 'default');

    await LocalNotifications.schedule({
      notifications: [{
        id: firestoreIdToNumericId(reminder.id, 100), // offset 100 to avoid alarm ID collisions
        title: `🔔 ${reminder.title}`,
        body: reminder.description || 'Reminder',
        schedule: { at, allowWhileIdle: true },
        channelId: 'reminders',
        sound,
        extra: { reminderId: reminder.id, type: 'reminder', soundId: reminder.soundId || 'default' },
      }],
    });
    console.log(`[NativeScheduler] Scheduled reminder "${reminder.title}" at ${at.toISOString()}`);
  } catch (err) {
    console.error(`[NativeScheduler] Failed to schedule reminder "${reminder.title}":`, err);
  }
}

// ── Cancel Reminder ─────────────────────────────────────────────────────────────

export async function cancelReminderNotification(reminderId: string): Promise<void> {
  if (!isNative) return;

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({
      notifications: [{ id: firestoreIdToNumericId(reminderId, 100) }],
    });
    console.log(`[NativeScheduler] Cancelled reminder notification for ${reminderId}`);
  } catch (err) {
    console.error(`[NativeScheduler] Failed to cancel reminder ${reminderId}:`, err);
  }
}

// ── Full Sync (App Startup) ─────────────────────────────────────────────────────

export async function syncAllNotifications(alarms: Alarm[], reminders: Reminder[]): Promise<void> {
  if (!isNative) return;

  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');

    // Cancel all existing scheduled notifications to avoid duplicates
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
      console.log(`[NativeScheduler] Cleared ${pending.notifications.length} pending notifications`);
    }

    // Re-schedule all active alarms
    let scheduledAlarms = 0;
    for (const alarm of alarms) {
      if (alarm.enabled && alarm.id) {
        await scheduleAlarmNotification(alarm);
        scheduledAlarms++;
      }
    }

    // Re-schedule all active reminders
    let scheduledReminders = 0;
    for (const reminder of reminders) {
      if (reminder.isActive && reminder.id) {
        await scheduleReminderNotification(reminder);
        scheduledReminders++;
      }
    }

    console.log(`[NativeScheduler] Sync complete: ${scheduledAlarms} alarms, ${scheduledReminders} reminders scheduled`);
  } catch (err) {
    console.error('[NativeScheduler] Sync failed:', err);
  }
}
