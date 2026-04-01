// Slack Notification API Route
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface SlackNotificationRequest {
  webhookUrl: string;
  type: 'event_reminder' | 'daily_digest' | 'event_created' | 'event_updated';
  data: {
    eventTitle?: string;
    eventTime?: string;
    eventDate?: string;
    eventLocation?: string;
    eventDescription?: string;
    events?: Array<{
      title: string;
      time: string;
    }>;
    userName?: string;
    message?: string;
  };
}

function createSlackBlocks(type: string, data: SlackNotificationRequest['data']) {
  switch (type) {
    case 'event_reminder':
      return {
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '⏰ Event Reminder',
              emoji: true,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Event:*\n${data.eventTitle || 'Untitled Event'}`,
              },
              {
                type: 'mrkdwn',
                text: `*When:*\n${data.eventDate || ''} at ${data.eventTime || ''}`,
              },
            ],
          },
          ...(data.eventLocation
            ? [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `📍 *Location:* ${data.eventLocation}`,
                  },
                },
              ]
            : []),
          ...(data.eventDescription
            ? [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `📝 ${data.eventDescription}`,
                  },
                },
              ]
            : []),
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: '📅 Sent from Malleabite',
              },
            ],
          },
        ],
      };

    case 'daily_digest':
      const eventsList = data.events || [];
      return {
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '📅 Your Daily Schedule',
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `Hey ${data.userName || 'there'}! Here's what's on your calendar today:`,
            },
          },
          {
            type: 'divider',
          },
          ...eventsList.map((event) => ({
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `• *${event.time}* - ${event.title}`,
            },
          })),
          {
            type: 'divider',
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `📊 You have *${eventsList.length}* event${eventsList.length !== 1 ? 's' : ''} today | Sent from Malleabite`,
              },
            ],
          },
        ],
      };

    case 'event_created':
      return {
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `✅ *New Event Created*\n${data.eventTitle || 'Untitled Event'}`,
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Date:*\n${data.eventDate || 'Not set'}`,
              },
              {
                type: 'mrkdwn',
                text: `*Time:*\n${data.eventTime || 'Not set'}`,
              },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: '📅 Created via Malleabite',
              },
            ],
          },
        ],
      };

    case 'event_updated':
      return {
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `📝 *Event Updated*\n${data.eventTitle || 'Untitled Event'}`,
            },
          },
          ...(data.message
            ? [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: data.message,
                  },
                },
              ]
            : []),
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: '📅 Updated via Malleabite',
              },
            ],
          },
        ],
      };

    default:
      return {
        text: data.message || 'Notification from Malleabite',
      };
  }
}

const ALLOWED_ORIGINS = [
  'https://malleabite.com',
  'https://www.malleabite.com',
  'https://app.malleabite.com',
];

const ALLOWED_NOTIFICATION_TYPES = new Set([
  'event_reminder',
  'daily_digest',
  'event_created',
  'event_updated',
]);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers['origin'] as string | undefined;

  // Restrict CORS to known origins only
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Require a Firebase ID token in Authorization header
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const { webhookUrl, type, data } = req.body as SlackNotificationRequest;

    if (!webhookUrl) {
      return res.status(400).json({ error: 'Slack webhook URL is required' });
    }

    if (!type || !ALLOWED_NOTIFICATION_TYPES.has(type)) {
      return res.status(400).json({ error: 'Invalid notification type' });
    }

    // Strict webhook URL validation — must be hooks.slack.com with no path traversal
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(webhookUrl);
    } catch {
      return res.status(400).json({ error: 'Invalid Slack webhook URL' });
    }
    if (
      parsedUrl.protocol !== 'https:' ||
      parsedUrl.hostname !== 'hooks.slack.com' ||
      !parsedUrl.pathname.startsWith('/services/')
    ) {
      return res.status(400).json({ error: 'Invalid Slack webhook URL' });
    }

    const payload = createSlackBlocks(type, data);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Slack API error:', errorText);
      return res.status(500).json({ error: 'Failed to send Slack notification' });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Slack notification error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
