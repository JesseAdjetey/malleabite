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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { webhookUrl, type, data } = req.body as SlackNotificationRequest;

    if (!webhookUrl) {
      return res.status(400).json({ error: 'Slack webhook URL is required' });
    }

    if (!type) {
      return res.status(400).json({ error: 'Notification type is required' });
    }

    // Validate webhook URL format
    if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
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
