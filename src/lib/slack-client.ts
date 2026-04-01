// Slack Notification Client
// Webhook URLs are stored in Firestore (user_settings/{userId}.slackWebhookUrl)
// and never in localStorage — they are retrieved server-side via the authenticated
// /api/slack-notify endpoint.

import { getAuth } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';

interface SlackNotificationData {
  eventTitle?: string;
  eventTime?: string;
  eventDate?: string;
  eventLocation?: string;
  eventDescription?: string;
  events?: Array<{ title: string; time: string }>;
  userName?: string;
  message?: string;
}

type NotificationType = 'event_reminder' | 'daily_digest' | 'event_created' | 'event_updated';

// --- Webhook URL storage in Firestore ---

export async function getSlackWebhook(): Promise<string | null> {
  const user = getAuth().currentUser;
  if (!user) return null;
  try {
    const snap = await getDoc(doc(db, 'user_settings', user.uid));
    return snap.exists() ? (snap.data().slackWebhookUrl ?? null) : null;
  } catch {
    return null;
  }
}

export async function setSlackWebhook(webhookUrl: string): Promise<void> {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Not authenticated');
  const ref = doc(db, 'user_settings', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await updateDoc(ref, { slackWebhookUrl: webhookUrl });
  } else {
    await setDoc(ref, { userId: user.uid, slackWebhookUrl: webhookUrl });
  }
}

export async function removeSlackWebhook(): Promise<void> {
  const user = getAuth().currentUser;
  if (!user) return;
  await updateDoc(doc(db, 'user_settings', user.uid), { slackWebhookUrl: null });
}

export async function isSlackConnected(): Promise<boolean> {
  return !!(await getSlackWebhook());
}

// --- Notification sending ---

async function getAuthToken(): Promise<string> {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Not authenticated');
  return user.getIdToken();
}

export async function sendSlackNotification(
  type: NotificationType,
  data: SlackNotificationData
): Promise<boolean> {
  const webhookUrl = await getSlackWebhook();

  if (!webhookUrl) {
    console.warn('Slack webhook not configured');
    return false;
  }

  try {
    const token = await getAuthToken();
    const response = await fetch('/api/slack-notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ webhookUrl, type, data }),
    });

    if (!response.ok) {
      console.error('Failed to send Slack notification');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending Slack notification:', error);
    return false;
  }
}

// Convenience functions for specific notification types
export async function notifyEventReminder(event: {
  title: string;
  date: Date;
  location?: string;
  description?: string;
}): Promise<boolean> {
  return sendSlackNotification('event_reminder', {
    eventTitle: event.title,
    eventDate: event.date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    eventTime: event.date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
    eventLocation: event.location,
    eventDescription: event.description,
  });
}

export async function notifyEventCreated(event: {
  title: string;
  date: Date;
}): Promise<boolean> {
  return sendSlackNotification('event_created', {
    eventTitle: event.title,
    eventDate: event.date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }),
    eventTime: event.date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }),
  });
}

export async function notifyEventUpdated(event: {
  title: string;
  changes?: string;
}): Promise<boolean> {
  return sendSlackNotification('event_updated', {
    eventTitle: event.title,
    message: event.changes,
  });
}

export async function sendDailyDigest(
  userName: string,
  events: Array<{ title: string; time: string }>
): Promise<boolean> {
  return sendSlackNotification('daily_digest', { userName, events });
}

// Test webhook connection
export async function testSlackWebhook(webhookUrl: string): Promise<boolean> {
  try {
    const token = await getAuthToken();
    const response = await fetch('/api/slack-notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        webhookUrl,
        type: 'event_created',
        data: {
          eventTitle: 'Malleabite Connected!',
          eventDate: new Date().toLocaleDateString(),
          eventTime: new Date().toLocaleTimeString(),
        },
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}
