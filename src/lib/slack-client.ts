// Slack Notification Client
// Handles sending notifications to Slack from the frontend

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

const SLACK_WEBHOOK_KEY = 'malleabite_slack_webhook';

export function getSlackWebhook(): string | null {
  return localStorage.getItem(SLACK_WEBHOOK_KEY);
}

export function setSlackWebhook(webhookUrl: string): void {
  localStorage.setItem(SLACK_WEBHOOK_KEY, webhookUrl);
}

export function removeSlackWebhook(): void {
  localStorage.removeItem(SLACK_WEBHOOK_KEY);
}

export function isSlackConnected(): boolean {
  return !!getSlackWebhook();
}

export async function sendSlackNotification(
  type: NotificationType,
  data: SlackNotificationData
): Promise<boolean> {
  const webhookUrl = getSlackWebhook();
  
  if (!webhookUrl) {
    console.warn('Slack webhook not configured');
    return false;
  }

  try {
    const response = await fetch('/api/slack-notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhookUrl,
        type,
        data,
      }),
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
  return sendSlackNotification('daily_digest', {
    userName,
    events,
  });
}

// Test webhook connection
export async function testSlackWebhook(webhookUrl: string): Promise<boolean> {
  try {
    const response = await fetch('/api/slack-notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        webhookUrl,
        type: 'event_created',
        data: {
          eventTitle: '🎉 Malleabite Connected!',
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
