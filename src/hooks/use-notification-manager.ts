import { useEffect, useRef, useCallback } from 'react';
import { useAlarms, Alarm } from './use-alarms';
import { useReminders, Reminder } from './use-reminders';
import { useCountdownEvents } from './use-countdown-events';
import { toast } from 'sonner';
import { Timestamp } from 'firebase/firestore';
import { isNative } from '@/lib/platform';
import { syncAllNotifications, createNotificationChannels } from '@/lib/native-notification-scheduler';
import { mallyTTS } from '@/lib/ai/tts-service';

// Speak a notification aloud using Mally's voice (respects user mute preference)
function speakNotification(text: string) {
    const muted = localStorage.getItem('mally-voice-muted') === 'true';
    if (muted) return;
    // Small delay so the notification sound plays first, then Mally speaks
    setTimeout(() => {
        mallyTTS.speak({ text }).catch(() => mallyTTS.speakFallback(text));
    }, 800);
}

export const REMINDER_SOUNDS = [
    { id: 'default', name: 'Default', url: '/sounds/default-notification.mp3' },
    { id: 'bell', name: 'Bell', url: '/sounds/bell-notification.mp3' },
    { id: 'chime', name: 'Chime', url: '/sounds/chime-notification.mp3' },
    { id: 'soft', name: 'Soft', url: '/sounds/soft-notification.mp3' },
];

export function useNotificationManager() {
    const { alarms, updateAlarm } = useAlarms();
    const { reminders, toggleReminderActive } = useReminders();
    const countdowns = useCountdownEvents();
    const triggeredAlarmsRef = useRef<Set<string>>(new Set());
    const triggeredRemindersRef = useRef<Set<string>>(new Set());
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Request notification permission on mount + create channels on Android
    useEffect(() => {
        console.log('[NotificationManager] Initializing...');
        if (isNative) {
            // Request native notification permissions via Capacitor
            import('@capacitor/local-notifications').then(({ LocalNotifications }) => {
                LocalNotifications.requestPermissions().then(result => {
                    console.log('[NotificationManager] Native permission:', result.display);
                });
            });
            // Create Android notification channels
            createNotificationChannels();
        } else if ('Notification' in window && Notification.permission === 'default') {
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
        }
    }, []);

    const playSound = useCallback((soundId: string = 'default') => {
        // Find sound by ID, or fallback to first one if not found or if ID is empty
        const sound = REMINDER_SOUNDS.find(s => s.id === soundId) || REMINDER_SOUNDS[0];

        // Stop any currently playing sound
        stopSound();

        audioRef.current = new Audio(sound.url);
        audioRef.current.loop = true; // Loop the sound
        audioRef.current.play().catch(err => console.error('Error playing sound:', err));
    }, [stopSound]);

    // Native: sync all alarms/reminders to OS-scheduled notifications on startup
    const hasSyncedRef = useRef(false);
    useEffect(() => {
        if (!isNative || hasSyncedRef.current) return;
        // Wait until we have data loaded (at least one array is non-empty, or both are loaded)
        if (alarms.length === 0 && reminders.length === 0) return;

        hasSyncedRef.current = true;
        syncAllNotifications(alarms, reminders);
    }, [alarms, reminders]);

    // Native: listen for notification events (foreground sound + tap handling)
    useEffect(() => {
        if (!isNative) return;

        let cleanup: (() => void) | undefined;

        import('@capacitor/local-notifications').then(({ LocalNotifications }) => {
            const receivedPromise = LocalNotifications.addListener(
                'localNotificationReceived',
                (notification) => {
                    // Notification received while app is in foreground — play sound + voice + toast
                    const extra = notification.extra;
                    playSound(extra?.soundId || 'default');
                    // Mally announces the notification
                    const voiceText = extra?.type === 'alarm'
                        ? `Alarm: ${notification.title?.replace('⏰ ', '') || 'Time\'s up'}`
                        : `Reminder: ${notification.title?.replace('🔔 ', '') || notification.body || 'You have a reminder'}`;
                    speakNotification(voiceText);
                    toast.message(notification.title || 'Notification', {
                        description: notification.body,
                        duration: Infinity,
                        action: { label: 'Dismiss', onClick: () => { stopSound(); mallyTTS.stop(); } },
                        onDismiss: () => { stopSound(); mallyTTS.stop(); },
                    });
                }
            );

            const actionPromise = LocalNotifications.addListener(
                'localNotificationActionPerformed',
                (action) => {
                    // User tapped the notification
                    stopSound();
                    mallyTTS.stop();

                    // If it's a Mally Action notification, dispatch an event so
                    // AppRoutes can pick it up and show the ActionRunnerModal
                    if (action.notification.extra?.type === 'mally_action') {
                        const eventId = action.notification.extra?.eventId;
                        if (eventId) {
                            window.dispatchEvent(
                                new CustomEvent('mally-action-tap', { detail: { eventId } })
                            );
                        }
                    }
                }
            );

            cleanup = () => {
                receivedPromise.then(l => l.remove());
                actionPromise.then(l => l.remove());
            };
        });

        return () => cleanup?.();
    }, [playSound, stopSound]);

    const showNotification = useCallback((title: string, body: string, soundId?: string) => {
        // Play sound
        playSound(soundId);

        if (isNative) {
            // Use Capacitor LocalNotifications on native
            import('@capacitor/local-notifications').then(({ LocalNotifications }) => {
                LocalNotifications.schedule({
                    notifications: [{
                        title,
                        body,
                        id: Date.now(),
                        schedule: { at: new Date() },
                        extra: { type: 'alarm' },
                    }],
                });
            });
        } else if ('Notification' in window && Notification.permission === 'granted') {
            // Show browser notification on web
            const notification = new Notification(title, {
                body,
                icon: '/favicon.ico',
                badge: '/favicon.ico',
                requireInteraction: true,
                tag: `alarm-${Date.now()}`
            });

            notification.onclick = () => {
                window.focus();
                notification.close();
                stopSound();
            };
        }

        // Also show toast notification as fallback (works everywhere)
        toast.message(title, {
            description: body,
            duration: Infinity,
            action: {
                label: 'Turn Off',
                onClick: () => { stopSound(); mallyTTS.stop(); },
            },
            onDismiss: () => { stopSound(); mallyTTS.stop(); },
            onAutoClose: () => { stopSound(); mallyTTS.stop(); },
        });
    }, [playSound, stopSound]);

    const shouldTriggerAlarm = useCallback((alarm: Alarm, now: Date): boolean => {
        // console.log('[NotificationManager] Checking alarm:', {
        //     id: alarm.id,
        //     title: alarm.title,
        //     enabled: alarm.enabled,
        //     time: alarm.time,
        //     currentTime: now.toISOString()
        // });

        if (!alarm.enabled || !alarm.id) {
            // console.log('[NotificationManager] Alarm skipped - not enabled or no ID');
            return false;
        }
        if (triggeredAlarmsRef.current.has(alarm.id)) {
            // console.log('[NotificationManager] Alarm skipped - already triggered');
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

        // console.log('[NotificationManager] Alarm time parsed:', alarmTime.toISOString());

        // Check if alarm time has passed and is within the last 10 minutes
        // This allows catching "missed" alarms when page loads late
        const timeDiff = now.getTime() - alarmTime.getTime();
        const shouldTrigger = timeDiff >= 0 && timeDiff < 600000;

        // console.log('[NotificationManager] Time diff:', timeDiff, 'ms, should trigger:', shouldTrigger);

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

        // Mally voice announcement
        speakNotification(`Alarm: ${alarm.title}`);

        // If it's a one-time alarm (no repeat days), disable it
        if (!alarm.repeatDays || alarm.repeatDays.length === 0) {
            updateAlarm(alarm.id, { enabled: false });
        }

        // Clear from triggered set after 15 minutes to prevent re-triggering within the 10m window
        // The window is 10 minutes, so 15 minutes is safe.
        setTimeout(() => {
            if (alarm.id) {
                triggeredAlarmsRef.current.delete(alarm.id);
            }
        }, 900000);
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

        // Mally voice announcement
        const voiceText = reminder.description
            ? `Reminder: ${reminder.title}. ${reminder.description}`
            : `Reminder: ${reminder.title}`;
        speakNotification(voiceText);

        // Mark reminder as inactive after triggering
        toggleReminderActive(reminder.id, false);

        // Clear from triggered set after 2 minutes
        setTimeout(() => {
            if (reminder.id) {
                triggeredRemindersRef.current.delete(reminder.id);
            }
        }, 120000);
    }, [showNotification, toggleReminderActive]);

    // Check alarms and reminders every 30 seconds (web only — native uses OS-scheduled notifications)
    useEffect(() => {
        if (isNative) return; // Native relies on pre-scheduled OS notifications

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

    // Countdown reminders — separate effect so countdown clock updates don't re-trigger the alarm loop
    const countdownsRef = useRef(countdowns);
    countdownsRef.current = countdowns;
    useEffect(() => {
        if (isNative) return;
        const checkCountdowns = () => {
            countdownsRef.current.forEach(({ event, days, hours }) => {
                const intervalMinutes = event.countdownReminderIntervalDays
                    ? event.countdownReminderIntervalDays * 24 * 60
                    : 2 * 24 * 60;
                const storageKey = `countdown_last_notified_${event.id}`;
                const lastNotified = localStorage.getItem(storageKey);
                const nowMs = Date.now();

                if (!lastNotified) {
                    localStorage.setItem(storageKey, String(nowMs));
                    return;
                }

                const minutesSinceLast = (nowMs - Number(lastNotified)) / 60000;
                if (minutesSinceLast >= intervalMinutes) {
                    const timeLabel = days > 0 ? `${days} day${days !== 1 ? 's' : ''}` : `${hours} hour${hours !== 1 ? 's' : ''}`;
                    toast.message(`${timeLabel} until ${event.title}`, {
                        description: 'Countdown reminder',
                        duration: 8000,
                    });
                    localStorage.setItem(storageKey, String(nowMs));
                }
            });
        };

        const interval = setInterval(checkCountdowns, 60000);
        return () => clearInterval(interval);
    }, []); // stable — reads countdowns via ref

    return null;
}
