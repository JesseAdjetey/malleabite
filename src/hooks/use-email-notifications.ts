// Email Notifications Hook - Event reminders, invitations, RSVP
import { useState, useCallback, useEffect } from 'react';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { CalendarEventType } from '@/lib/stores/types';

export type NotificationType = 'reminder' | 'invitation' | 'update' | 'cancellation' | 'rsvp' | 'daily_agenda';
export type ReminderUnit = 'minutes' | 'hours' | 'days' | 'weeks';
export type DeliveryMethod = 'email' | 'push' | 'sms';

export interface Reminder {
  id: string;
  method: DeliveryMethod;
  value: number;
  unit: ReminderUnit;
}

export interface NotificationPreferences {
  id: string;
  userId: string;
  email: string;
  
  // Default reminders for new events
  defaultReminders: Reminder[];
  
  // Notification toggles
  enableEventReminders: boolean;
  enableInvitations: boolean;
  enableEventUpdates: boolean;
  enableCancellations: boolean;
  enableRSVPNotifications: boolean;
  enableDailyAgenda: boolean;
  
  // Daily agenda settings
  dailyAgendaTime: string; // HH:mm format
  dailyAgendaDays: number[]; // 0=Sun, 6=Sat
  
  // Push notification settings
  enablePushNotifications: boolean;
  pushSubscription?: string;
  
  // SMS settings
  enableSMSNotifications: boolean;
  phoneNumber?: string;
  
  // Quiet hours
  enableQuietHours: boolean;
  quietHoursStart: string; // HH:mm
  quietHoursEnd: string; // HH:mm
  
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledNotification {
  id: string;
  userId: string;
  eventId: string;
  type: NotificationType;
  method: DeliveryMethod;
  scheduledFor: string;
  sent: boolean;
  sentAt?: string;
  error?: string;
  
  // Email content
  subject: string;
  body: string;
  htmlBody?: string;
  recipientEmail: string;
  
  createdAt: string;
}

export interface InvitationEmail {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventLocation?: string;
  eventDescription?: string;
  organizerName: string;
  organizerEmail: string;
  attendeeEmail: string;
  attendeeName?: string;
  rsvpUrl: string;
  calendarUrl: string;
}

// Convert reminder to minutes before event
export function reminderToMinutes(value: number, unit: ReminderUnit): number {
  switch (unit) {
    case 'minutes': return value;
    case 'hours': return value * 60;
    case 'days': return value * 60 * 24;
    case 'weeks': return value * 60 * 24 * 7;
    default: return value;
  }
}

// Generate email content for different notification types
export function generateEmailContent(
  type: NotificationType,
  event: CalendarEventType,
  organizerName?: string
): { subject: string; body: string; htmlBody: string } {
  const eventDate = dayjs(event.startsAt).format('dddd, MMMM D, YYYY');
  const eventTime = event.isAllDay 
    ? 'All day' 
    : `${dayjs(event.startsAt).format('h:mm A')} - ${dayjs(event.endsAt).format('h:mm A')}`;
  
  switch (type) {
    case 'reminder':
      return {
        subject: `Reminder: ${event.title}`,
        body: `
Reminder for your upcoming event:

${event.title}
Date: ${eventDate}
Time: ${eventTime}
${event.location ? `Location: ${event.location}` : ''}

${event.description || ''}
        `.trim(),
        htmlBody: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">Reminder: ${event.title}</h2>
  <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
    <p><strong>📅 Date:</strong> ${eventDate}</p>
    <p><strong>🕐 Time:</strong> ${eventTime}</p>
    ${event.location ? `<p><strong>📍 Location:</strong> ${event.location}</p>` : ''}
    ${event.meetingUrl ? `<p><strong>🔗 Meeting Link:</strong> <a href="${event.meetingUrl}">${event.meetingUrl}</a></p>` : ''}
  </div>
  ${event.description ? `<p>${event.description}</p>` : ''}
</div>
        `,
      };
      
    case 'invitation':
      return {
        subject: `Invitation: ${event.title}`,
        body: `
${organizerName || 'Someone'} has invited you to:

${event.title}
Date: ${eventDate}
Time: ${eventTime}
${event.location ? `Location: ${event.location}` : ''}

${event.description || ''}

Please respond to this invitation.
        `.trim(),
        htmlBody: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">You're Invited!</h2>
  <p>${organizerName || 'Someone'} has invited you to:</p>
  <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
    <h3 style="margin-top: 0;">${event.title}</h3>
    <p><strong>📅 Date:</strong> ${eventDate}</p>
    <p><strong>🕐 Time:</strong> ${eventTime}</p>
    ${event.location ? `<p><strong>📍 Location:</strong> ${event.location}</p>` : ''}
    ${event.meetingUrl ? `<p><strong>🔗 Meeting Link:</strong> <a href="${event.meetingUrl}">${event.meetingUrl}</a></p>` : ''}
  </div>
  ${event.description ? `<p>${event.description}</p>` : ''}
  <div style="margin: 24px 0;">
    <a href="#" style="display: inline-block; padding: 12px 24px; background: #22c55e; color: white; text-decoration: none; border-radius: 6px; margin-right: 8px;">Yes</a>
    <a href="#" style="display: inline-block; padding: 12px 24px; background: #f59e0b; color: white; text-decoration: none; border-radius: 6px; margin-right: 8px;">Maybe</a>
    <a href="#" style="display: inline-block; padding: 12px 24px; background: #ef4444; color: white; text-decoration: none; border-radius: 6px;">No</a>
  </div>
</div>
        `,
      };
      
    case 'update':
      return {
        subject: `Updated: ${event.title}`,
        body: `
The following event has been updated:

${event.title}
Date: ${eventDate}
Time: ${eventTime}
${event.location ? `Location: ${event.location}` : ''}

${event.description || ''}
        `.trim(),
        htmlBody: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #f59e0b;">Event Updated</h2>
  <p>The following event has been updated:</p>
  <div style="background: #fef3c7; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #f59e0b;">
    <h3 style="margin-top: 0;">${event.title}</h3>
    <p><strong>📅 Date:</strong> ${eventDate}</p>
    <p><strong>🕐 Time:</strong> ${eventTime}</p>
    ${event.location ? `<p><strong>📍 Location:</strong> ${event.location}</p>` : ''}
  </div>
  ${event.description ? `<p>${event.description}</p>` : ''}
</div>
        `,
      };
      
    case 'cancellation':
      return {
        subject: `Cancelled: ${event.title}`,
        body: `
The following event has been cancelled:

${event.title}
Date: ${eventDate}
Time: ${eventTime}
        `.trim(),
        htmlBody: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #ef4444;">Event Cancelled</h2>
  <p>The following event has been cancelled:</p>
  <div style="background: #fee2e2; padding: 16px; border-radius: 8px; margin: 16px 0; border-left: 4px solid #ef4444;">
    <h3 style="margin-top: 0; text-decoration: line-through;">${event.title}</h3>
    <p><strong>📅 Date:</strong> ${eventDate}</p>
    <p><strong>🕐 Time:</strong> ${eventTime}</p>
  </div>
</div>
        `,
      };
      
    case 'rsvp':
      return {
        subject: `RSVP: ${event.title}`,
        body: `An attendee has responded to your event: ${event.title}`,
        htmlBody: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">RSVP Response</h2>
  <p>An attendee has responded to your event:</p>
  <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
    <h3 style="margin-top: 0;">${event.title}</h3>
  </div>
</div>
        `,
      };
      
    case 'daily_agenda':
      return {
        subject: `Your agenda for ${eventDate}`,
        body: `Here's your schedule for today.`,
        htmlBody: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #333;">Your Daily Agenda</h2>
  <p>Here's your schedule for ${eventDate}</p>
</div>
        `,
      };
      
    default:
      return {
        subject: event.title,
        body: event.description || '',
        htmlBody: `<p>${event.description || ''}</p>`,
      };
  }
}

export function useEmailNotifications() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [scheduledNotifications, setScheduledNotifications] = useState<ScheduledNotification[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch user preferences
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const fetchPreferences = async () => {
      try {
        const docRef = doc(db, 'notification_preferences', user.uid);
        const snapshot = await getDoc(docRef);
        
        if (snapshot.exists()) {
          setPreferences({
            id: snapshot.id,
            ...snapshot.data(),
          } as NotificationPreferences);
        } else {
          // Create default preferences
          const defaultPrefs: Omit<NotificationPreferences, 'id'> = {
            userId: user.uid,
            email: user.email || '',
            defaultReminders: [
              { id: '1', method: 'email', value: 30, unit: 'minutes' },
              { id: '2', method: 'push', value: 10, unit: 'minutes' },
            ],
            enableEventReminders: true,
            enableInvitations: true,
            enableEventUpdates: true,
            enableCancellations: true,
            enableRSVPNotifications: true,
            enableDailyAgenda: false,
            dailyAgendaTime: '07:00',
            dailyAgendaDays: [1, 2, 3, 4, 5], // Mon-Fri
            enablePushNotifications: true,
            enableSMSNotifications: false,
            enableQuietHours: false,
            quietHoursStart: '22:00',
            quietHoursEnd: '07:00',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          
          await addDoc(collection(db, 'notification_preferences'), {
            ...defaultPrefs,
            userId: user.uid,
          });
          
          setPreferences({ id: user.uid, ...defaultPrefs });
        }
      } catch (error) {
        console.error('Failed to fetch notification preferences:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, [user?.uid, user?.email]);

  // Update preferences
  const updatePreferences = useCallback(async (updates: Partial<NotificationPreferences>) => {
    if (!preferences?.id) return;

    try {
      await updateDoc(doc(db, 'notification_preferences', preferences.id), {
        ...updates,
        updatedAt: new Date().toISOString(),
      });

      setPreferences(prev => prev ? { ...prev, ...updates } : null);
      toast.success('Notification preferences updated');
    } catch (error) {
      console.error('Failed to update preferences:', error);
      toast.error('Failed to update preferences');
    }
  }, [preferences?.id]);

  // Schedule reminders for an event
  const scheduleEventReminders = useCallback(async (
    event: CalendarEventType,
    reminders: Reminder[] = preferences?.defaultReminders || []
  ) => {
    if (!user?.uid || !preferences?.enableEventReminders) return;

    try {
      for (const reminder of reminders) {
        const minutesBefore = reminderToMinutes(reminder.value, reminder.unit);
        const scheduledFor = dayjs(event.startsAt).subtract(minutesBefore, 'minute');
        
        // Don't schedule if already past
        if (scheduledFor.isBefore(dayjs())) continue;
        
        const { subject, body, htmlBody } = generateEmailContent('reminder', event);
        
        const notification: Omit<ScheduledNotification, 'id'> = {
          userId: user.uid,
          eventId: event.id,
          type: 'reminder',
          method: reminder.method,
          scheduledFor: scheduledFor.toISOString(),
          sent: false,
          subject,
          body,
          htmlBody,
          recipientEmail: preferences.email,
          createdAt: new Date().toISOString(),
        };
        
        await addDoc(collection(db, 'scheduled_notifications'), notification);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Failed to schedule reminders:', error);
      return { success: false, error };
    }
  }, [user?.uid, preferences]);

  // Send invitation emails
  const sendInvitations = useCallback(async (
    event: CalendarEventType,
    attendeeEmails: string[],
    organizerName: string
  ) => {
    if (!user?.uid || !preferences?.enableInvitations) return;

    try {
      for (const email of attendeeEmails) {
        const { subject, body, htmlBody } = generateEmailContent('invitation', event, organizerName);
        
        const notification: Omit<ScheduledNotification, 'id'> = {
          userId: user.uid,
          eventId: event.id,
          type: 'invitation',
          method: 'email',
          scheduledFor: new Date().toISOString(), // Send immediately
          sent: false,
          subject,
          body,
          htmlBody,
          recipientEmail: email,
          createdAt: new Date().toISOString(),
        };
        
        await addDoc(collection(db, 'scheduled_notifications'), notification);
      }
      
      toast.success(`Invitations sent to ${attendeeEmails.length} attendees`);
      return { success: true };
    } catch (error) {
      console.error('Failed to send invitations:', error);
      toast.error('Failed to send invitations');
      return { success: false, error };
    }
  }, [user?.uid, preferences?.enableInvitations]);

  // Send update notification
  const sendUpdateNotification = useCallback(async (
    event: CalendarEventType,
    attendeeEmails: string[]
  ) => {
    if (!user?.uid || !preferences?.enableEventUpdates) return;

    try {
      for (const email of attendeeEmails) {
        const { subject, body, htmlBody } = generateEmailContent('update', event);
        
        const notification: Omit<ScheduledNotification, 'id'> = {
          userId: user.uid,
          eventId: event.id,
          type: 'update',
          method: 'email',
          scheduledFor: new Date().toISOString(),
          sent: false,
          subject,
          body,
          htmlBody,
          recipientEmail: email,
          createdAt: new Date().toISOString(),
        };
        
        await addDoc(collection(db, 'scheduled_notifications'), notification);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Failed to send update notifications:', error);
      return { success: false, error };
    }
  }, [user?.uid, preferences?.enableEventUpdates]);

  // Send cancellation notification
  const sendCancellationNotification = useCallback(async (
    event: CalendarEventType,
    attendeeEmails: string[]
  ) => {
    if (!user?.uid || !preferences?.enableCancellations) return;

    try {
      for (const email of attendeeEmails) {
        const { subject, body, htmlBody } = generateEmailContent('cancellation', event);
        
        const notification: Omit<ScheduledNotification, 'id'> = {
          userId: user.uid,
          eventId: event.id,
          type: 'cancellation',
          method: 'email',
          scheduledFor: new Date().toISOString(),
          sent: false,
          subject,
          body,
          htmlBody,
          recipientEmail: email,
          createdAt: new Date().toISOString(),
        };
        
        await addDoc(collection(db, 'scheduled_notifications'), notification);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Failed to send cancellation notifications:', error);
      return { success: false, error };
    }
  }, [user?.uid, preferences?.enableCancellations]);

  // Cancel scheduled reminders for an event
  const cancelEventReminders = useCallback(async (eventId: string) => {
    if (!user?.uid) return;

    try {
      const q = query(
        collection(db, 'scheduled_notifications'),
        where('eventId', '==', eventId),
        where('sent', '==', false)
      );
      
      const snapshot = await getDocs(q);
      
      for (const doc of snapshot.docs) {
        await deleteDoc(doc.ref);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Failed to cancel reminders:', error);
      return { success: false, error };
    }
  }, [user?.uid]);

  // Request push notification permission
  const requestPushPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      toast.error('Push notifications not supported');
      return { success: false };
    }

    try {
      const permission = await Notification.requestPermission();
      
      if (permission === 'granted') {
        // Would register service worker and get subscription
        await updatePreferences({ enablePushNotifications: true });
        toast.success('Push notifications enabled');
        return { success: true };
      } else {
        toast.error('Push notification permission denied');
        return { success: false };
      }
    } catch (error) {
      console.error('Failed to request push permission:', error);
      return { success: false, error };
    }
  }, [updatePreferences]);

  // Add a reminder to default list
  const addDefaultReminder = useCallback(async (
    method: DeliveryMethod,
    value: number,
    unit: ReminderUnit
  ) => {
    if (!preferences) return;

    const newReminder: Reminder = {
      id: `${Date.now()}`,
      method,
      value,
      unit,
    };

    await updatePreferences({
      defaultReminders: [...preferences.defaultReminders, newReminder],
    });
  }, [preferences, updatePreferences]);

  // Remove a default reminder
  const removeDefaultReminder = useCallback(async (reminderId: string) => {
    if (!preferences) return;

    await updatePreferences({
      defaultReminders: preferences.defaultReminders.filter(r => r.id !== reminderId),
    });
  }, [preferences, updatePreferences]);

  // Check if in quiet hours
  const isInQuietHours = useCallback(() => {
    if (!preferences?.enableQuietHours) return false;

    const now = dayjs();
    const [startHour, startMin] = preferences.quietHoursStart.split(':').map(Number);
    const [endHour, endMin] = preferences.quietHoursEnd.split(':').map(Number);
    
    const start = now.hour(startHour).minute(startMin);
    const end = now.hour(endHour).minute(endMin);
    
    // Handle overnight quiet hours
    if (end.isBefore(start)) {
      return now.isAfter(start) || now.isBefore(end);
    }
    
    return now.isAfter(start) && now.isBefore(end);
  }, [preferences]);

  return {
    preferences,
    loading,
    updatePreferences,
    scheduleEventReminders,
    sendInvitations,
    sendUpdateNotification,
    sendCancellationNotification,
    cancelEventReminders,
    requestPushPermission,
    addDefaultReminder,
    removeDefaultReminder,
    isInQuietHours,
    generateEmailContent,
  };
}

export default useEmailNotifications;
