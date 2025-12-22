// Feedback API Route
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface FeedbackData {
  type: 'bug' | 'feature' | 'question' | 'other';
  message: string;
  email: string;
  page: string;
  userAgent: string;
  timestamp: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const feedback = req.body as FeedbackData;

    if (!feedback.type || !feedback.message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Log feedback (in production, save to database or send to Slack)
    console.log('📨 New Feedback Received:', {
      type: feedback.type,
      message: feedback.message,
      email: feedback.email,
      page: feedback.page,
      timestamp: feedback.timestamp,
    });

    // Optional: Send to Slack webhook if configured
    const slackWebhook = process.env.SLACK_FEEDBACK_WEBHOOK;
    if (slackWebhook) {
      const typeEmoji = {
        bug: '🐛',
        feature: '💡',
        question: '❓',
        other: '📝',
      };

      await fetch(slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blocks: [
            {
              type: 'header',
              text: {
                type: 'plain_text',
                text: `${typeEmoji[feedback.type]} New ${feedback.type.charAt(0).toUpperCase() + feedback.type.slice(1)} Feedback`,
                emoji: true,
              },
            },
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: feedback.message,
              },
            },
            {
              type: 'context',
              elements: [
                {
                  type: 'mrkdwn',
                  text: `👤 ${feedback.email} • 📍 ${feedback.page} • 🕐 ${new Date(feedback.timestamp).toLocaleString()}`,
                },
              ],
            },
          ],
        }),
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Feedback error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
