import { useEffect, useRef, useCallback } from 'react';
import { useAlarms, Alarm } from './use-alarms';
import { useReminders, Reminder } from './use-reminders';
import { toast } from 'sonner';
import { Timestamp } from 'firebase/firestore';

const REMINDER_SOUNDS = [
    { id: 'default', name: 'Default', url: 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg' },
    { id: 'bell', name: 'Bell', url: 'https://actions.google.com/sounds/v1/alarms/mechanic_clock_ring.ogg' },
    { id: 'chime', name: 'Chime', url: 'https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg' },
    { id: 'soft', name: 'Soft', url: 'https://actions.google.com/sounds/v1/alarms/gentle_walk_alarm.ogg' },
];

export function useNotificationManager() {
    const { alarms, updateAlarm } = useAlarms();
    const { reminders, toggleReminderActive } = useReminders();
    const triggeredAlarmsRef = useRef<Set<string>>(new Set());
    const triggeredRemindersRef = useRef<Set<string>>(new Set());
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Request notification permission on mount
    useEffect(() => {
        console.log('[NotificationManager] Initializing...');
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log('[NotificationManager] Notification permission granted');
                } else {
                    console.log('[NotificationManager] Notification permission denied:', permission);
                }
            });
        } else if ('Notification' in window) {
            console.log('[NotificationManager] Notification permission:', Notification.permission);
        }
    }, []);

    const stopSound = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            // Don't nullify immediately if we want to reuse, but recreating is fine
        }
    }, []);

    const playSound = useCallback((soundId: string = 'default') => {
        const sound = REMINDER_SOUNDS.find(s => s.id === soundId) || REMINDER_SOUNDS[0];

        // Stop any currently playing sound
        stopSound();

        audioRef.current = new Audio(sound.url);
        audioRef.current.loop = true; // Loop the sound
        audioRef.current.play().catch(err => console.error('Error playing sound:', err));
    }, [stopSound]);

    const showNotification = useCallback((title: string, body: string, soundId?: string) => {
        // Play sound
        playSound(soundId);

        // Show browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(title, {
                body,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                requireInteraction: true,
                tag: `alarm-${Date.now()}` // Unique tag to prevent grouping
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
                stopSound();
            };
        }

        // Also show toast notification as fallback
        toast.message(title, {
            description: body,
            duration: Infinity, // Stay until dismissed
            action: {
                label: 'Turn Off',
                onClick: () => stopSound(),
            },
            onDismiss: () => stopSound(),
            onAutoClose: () => stopSound(),
        });
    }, [playSound, stopSound]);

    const shouldTriggerAlarm = useCallback((alarm: Alarm, now: Date): boolean => {
        console.log('[NotificationManager] Checking alarm:', {
            id: alarm.id,
            title: alarm.title,
            enabled: alarm.enabled,
            time: alarm.time,
            currentTime: now.toISOString()
        });

        if (!alarm.enabled || !alarm.id) {
            console.log('[NotificationManager] Alarm skipped - not enabled or no ID');
            return false;
        }
        if (triggeredAlarmsRef.current.has(alarm.id)) {
            console.log('[NotificationManager] Alarm skipped - already triggered');
            return false;
        }

        let alarmTime: Date;
        if (typeof alarm.time === 'string') {
            // Check if it's a simple HH:MM format (e.g., "14:30")
            // Simple time format: short string, contains :, but no T or - characters
            const isSimpleTime = alarm.time.length <= 8 && alarm.time.includes(':') && !alarm.time.includes('T') && !alarm.time.includes('-');

            if (isSimpleTime) {
                // Handle HH:MM format
                const [hours, minutes] = alarm.time.split(':').map(Number);
                alarmTime = new Date();
                alarmTime.setHours(hours, minutes, 0, 0);
            } else {
                // Handle ISO string or other date format
                alarmTime = new Date(alarm.time);
            }
        } else {
            alarmTime = alarm.time instanceof Date ? alarm.time : new Date(alarm.time);
        }

        console.log('[NotificationManager] Alarm time parsed:', alarmTime.toISOString());

        // Check if alarm time has passed and is within the last 10 minutes
        // This allows catching "missed" alarms when page loads late
        const timeDiff = now.getTime() - alarmTime.getTime();
        const shouldTrigger = timeDiff >= 0 && timeDiff < 600000;

        console.log('[NotificationManager] Time diff:', timeDiff, 'ms, should trigger:', shouldTrigger);

        return shouldTrigger;
    }, []);

    const shouldTriggerReminder = useCallback((reminder: Reminder, now: Date): boolean => {
        if (!reminder.isActive || !reminder.id) return false;
        if (triggeredRemindersRef.current.has(reminder.id)) return false;

        let reminderTime: Date;
        if (reminder.reminderTime instanceof Timestamp) {
            reminderTime = reminder.reminderTime.toDate();
        } else if (typeof reminder.reminderTime === 'string') {
            reminderTime = new Date(reminder.reminderTime);
        } else {
            reminderTime = new Date();
        }

        // Check if reminder time has passed and is within the last 10 minutes
        const timeDiff = now.getTime() - reminderTime.getTime();
        return timeDiff >= 0 && timeDiff < 600000; // Within last 10 minutes
    }, []);

    const triggerAlarm = useCallback((alarm: Alarm) => {
        if (!alarm.id) return;

        console.log('Triggering alarm:', alarm.title);
        triggeredAlarmsRef.current.add(alarm.id);

        showNotification(
            `⏰ ${alarm.title}`,
            `Alarm at ${typeof alarm.time === 'string' ? alarm.time : new Date(alarm.time).toLocaleTimeString()}`,
            alarm.soundId
        );

        // If it's a one-time alarm (no repeat days), disable it
        if (!alarm.repeatDays || alarm.repeatDays.length === 0) {
            updateAlarm(alarm.id, { enabled: false });
        }

        // Clear from triggered set after 2 minutes to allow re-triggering
        setTimeout(() => {
            if (alarm.id) {
                triggeredAlarmsRef.current.delete(alarm.id);
            }
        }, 120000);
    }, [showNotification, updateAlarm]);

    const triggerReminder = useCallback((reminder: Reminder) => {
        if (!reminder.id) return;

        console.log('Triggering reminder:', reminder.title);
        triggeredRemindersRef.current.add(reminder.id);

        showNotification(
            `🔔 ${reminder.title}`,
            reminder.description || 'Reminder',
            reminder.soundId || 'default'
        );

        // Mark reminder as inactive after triggering
        toggleReminderActive(reminder.id, false);

        // Clear from triggered set after 2 minutes
        setTimeout(() => {
            if (reminder.id) {
                triggeredRemindersRef.current.delete(reminder.id);
            }
        }, 120000);
    }, [showNotification, toggleReminderActive]);

    // Check alarms and reminders every 30 seconds
    useEffect(() => {
        const checkNotifications = () => {
            const now = new Date();
            console.log('[NotificationManager] Checking notifications at:', now.toISOString());
            console.log('[NotificationManager] Total alarms:', alarms.length, 'Total reminders:', reminders.length);

            // Check alarms
            if (alarms.length > 0) {
                console.log('[NotificationManager] Checking', alarms.length, 'alarms...');
                alarms.forEach(alarm => {
                    if (shouldTriggerAlarm(alarm, now)) {
                        console.log('[NotificationManager] TRIGGERING ALARM:', alarm.title);
                        triggerAlarm(alarm);
                    }
                });
            }

            // Check reminders
            if (reminders.length > 0) {
                console.log('[NotificationManager] Checking', reminders.length, 'reminders...');
                reminders.forEach(reminder => {
                    if (shouldTriggerReminder(reminder, now)) {
                        console.log('[NotificationManager] TRIGGERING REMINDER:', reminder.title);
                        triggerReminder(reminder);
                    }
                });
            }
        };

        // Check immediately on mount
        console.log('[NotificationManager] Running initial check...');
        checkNotifications();

        // Then check every 30 seconds
        console.log('[NotificationManager] Setting up 30-second interval...');
        const interval = setInterval(checkNotifications, 30000);

        return () => {
            console.log('[NotificationManager] Cleaning up interval...');
            clearInterval(interval);
        };
    }, [alarms, reminders, shouldTriggerAlarm, shouldTriggerReminder, triggerAlarm, triggerReminder]);

    return null;
}
