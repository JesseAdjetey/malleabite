// Email Client - Frontend helper for sending emails
import { logger } from '@/lib/logger';

type EmailType = 'event_reminder' | 'daily_digest' | 'weekly_summary' | 'welcome' | 'subscription_confirmation';

interface SendEmailOptions {
  type: EmailType;
  to: string;
  data: Record<string, any>;
}

export async function sendEmail({ type, to, data }: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type, to, data }),
    });

    if (!response.ok) {
      const error = await response.json();
      logger.error('Email', `Failed to send email: ${error.error}`);
      return { success: false, error: error.error };
    }

    logger.info('Email', `Email sent successfully: ${type} to ${to}`);
    return { success: true };
  } catch (error) {
    logger.error('Email', 'Failed to send email', error as Error);
    return { success: false, error: 'Network error' };
  }
}

// Schedule event reminder (call this when event is created with reminder enabled)
export async function scheduleEventReminder(
  email: string,
  event: {
    title: string;
    date: string;
    time: string;
    description?: string;
  }
): Promise<boolean> {
  const result = await sendEmail({
    type: 'event_reminder',
    to: email,
    data: {
      eventTitle: event.title,
      eventDate: event.date,
      eventTime: event.time,
      description: event.description,
    },
  });
  return result.success;
}

// Send welcome email (call after user registration)
export async function sendWelcomeEmail(
  email: string,
  name?: string
): Promise<boolean> {
  const result = await sendEmail({
    type: 'welcome',
    to: email,
    data: { name },
  });
  return result.success;
}

// Send subscription confirmation (call after successful payment)
export async function sendSubscriptionConfirmation(
  email: string,
  plan: 'Pro' | 'Teams',
  aiRequests: number
): Promise<boolean> {
  const result = await sendEmail({
    type: 'subscription_confirmation',
    to: email,
    data: { plan, aiRequests },
  });
  return result.success;
}

// Send daily digest (typically called by a cron job)
export async function sendDailyDigest(
  email: string,
  events: Array<{ time: string; title: string }>,
  date: string,
  focusHours: number
): Promise<boolean> {
  const result = await sendEmail({
    type: 'daily_digest',
    to: email,
    data: {
      events,
      date,
      eventCount: events.length,
      focusHours,
    },
  });
  return result.success;
}
