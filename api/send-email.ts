// Email Notification Service using SendGrid
// This is a Vercel Edge Function

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface EmailRequest {
  type: 'event_reminder' | 'daily_digest' | 'weekly_summary' | 'welcome' | 'subscription_confirmation';
  to: string;
  data: Record<string, any>;
}

// Email templates
const templates = {
  event_reminder: (data: any) => ({
    subject: `Reminder: ${data.eventTitle} starts soon`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0a1a; color: #fff; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: #1a1025; border-radius: 12px; padding: 24px; }
            .header { text-align: center; margin-bottom: 24px; }
            .logo { width: 60px; height: 60px; }
            .event-card { background: linear-gradient(135deg, #8b5cf6, #7c3aed); border-radius: 8px; padding: 20px; margin: 16px 0; }
            .event-title { font-size: 24px; font-weight: bold; margin-bottom: 8px; }
            .event-time { font-size: 16px; opacity: 0.9; }
            .button { display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 16px; }
            .footer { text-align: center; margin-top: 24px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="color: #8b5cf6;">Malleabite</h2>
            </div>
            <p>Hey there! 👋</p>
            <p>Your event is starting soon:</p>
            <div class="event-card">
              <div class="event-title">${data.eventTitle}</div>
              <div class="event-time">📅 ${data.eventDate} at ${data.eventTime}</div>
              ${data.description ? `<p style="margin-top: 12px; opacity: 0.9;">${data.description}</p>` : ''}
            </div>
            <a href="${data.appUrl}/calendar" class="button">View in Calendar</a>
            <div class="footer">
              <p>Sent by Malleabite • <a href="${data.appUrl}/settings" style="color: #8b5cf6;">Manage notifications</a></p>
            </div>
          </div>
        </body>
      </html>
    `,
  }),

  daily_digest: (data: any) => ({
    subject: `Your day ahead: ${data.eventCount} events on ${data.date}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0a1a; color: #fff; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: #1a1025; border-radius: 12px; padding: 24px; }
            .header { text-align: center; margin-bottom: 24px; }
            .event-list { margin: 16px 0; }
            .event-item { background: #2a1f3d; padding: 12px 16px; border-radius: 8px; margin-bottom: 8px; display: flex; align-items: center; }
            .event-time { color: #8b5cf6; font-weight: 600; width: 70px; }
            .event-title { flex: 1; }
            .button { display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
            .stats { display: flex; gap: 16px; margin: 16px 0; }
            .stat { background: #2a1f3d; padding: 16px; border-radius: 8px; text-align: center; flex: 1; }
            .stat-number { font-size: 24px; font-weight: bold; color: #8b5cf6; }
            .stat-label { font-size: 12px; color: #888; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="color: #8b5cf6;">☀️ Good Morning!</h2>
              <p style="color: #888;">Here's your schedule for ${data.date}</p>
            </div>
            
            <div class="stats">
              <div class="stat">
                <div class="stat-number">${data.eventCount}</div>
                <div class="stat-label">Events</div>
              </div>
              <div class="stat">
                <div class="stat-number">${data.focusHours}h</div>
                <div class="stat-label">Focus Time</div>
              </div>
            </div>

            <div class="event-list">
              ${data.events.map((event: any) => `
                <div class="event-item">
                  <span class="event-time">${event.time}</span>
                  <span class="event-title">${event.title}</span>
                </div>
              `).join('')}
            </div>

            <div style="text-align: center; margin-top: 20px;">
              <a href="${data.appUrl}/calendar" class="button">Open Calendar</a>
            </div>
          </div>
        </body>
      </html>
    `,
  }),

  welcome: (data: any) => ({
    subject: 'Welcome to Malleabite! 🎉',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0a1a; color: #fff; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: #1a1025; border-radius: 12px; padding: 24px; }
            .header { text-align: center; margin-bottom: 24px; }
            .feature { display: flex; align-items: flex-start; gap: 12px; margin: 16px 0; padding: 16px; background: #2a1f3d; border-radius: 8px; }
            .feature-icon { font-size: 24px; }
            .button { display: inline-block; background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="color: #8b5cf6;">Welcome to Malleabite!</h1>
              <p>Your intelligent productivity journey starts now 🚀</p>
            </div>

            <p>Hi ${data.name || 'there'}! 👋</p>
            <p>We're thrilled to have you on board. Here's what you can do with Malleabite:</p>

            <div class="feature">
              <span class="feature-icon">🗓️</span>
              <div>
                <strong>Smart Calendar</strong>
                <p style="margin: 4px 0 0; color: #888; font-size: 14px;">Schedule events with AI-powered suggestions</p>
              </div>
            </div>

            <div class="feature">
              <span class="feature-icon">🤖</span>
              <div>
                <strong>Mally AI Assistant</strong>
                <p style="margin: 4px 0 0; color: #888; font-size: 14px;">Chat naturally to manage your schedule</p>
              </div>
            </div>

            <div class="feature">
              <span class="feature-icon">📊</span>
              <div>
                <strong>Productivity Analytics</strong>
                <p style="margin: 4px 0 0; color: #888; font-size: 14px;">Track your time and optimize your days</p>
              </div>
            </div>

            <div style="text-align: center; margin-top: 24px;">
              <a href="${data.appUrl}" class="button">Get Started</a>
            </div>
          </div>
        </body>
      </html>
    `,
  }),

  subscription_confirmation: (data: any) => ({
    subject: `You're now a ${data.plan} member! 🎉`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0a1a; color: #fff; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: #1a1025; border-radius: 12px; padding: 24px; }
            .success-badge { background: linear-gradient(135deg, #8b5cf6, #7c3aed); padding: 16px 24px; border-radius: 8px; text-align: center; margin: 24px 0; }
            .feature-list { margin: 16px 0; }
            .feature-item { padding: 8px 0; border-bottom: 1px solid #2a1f3d; }
            .feature-item:last-child { border-bottom: none; }
            .button { display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <div style="text-align: center;">
              <h1>🎉 Welcome to ${data.plan}!</h1>
            </div>
            
            <div class="success-badge">
              <h2 style="margin: 0;">Thank you for upgrading!</h2>
              <p style="margin: 8px 0 0; opacity: 0.9;">Your ${data.plan} subscription is now active</p>
            </div>

            <p>You now have access to:</p>
            <div class="feature-list">
              <div class="feature-item">✅ Unlimited events</div>
              <div class="feature-item">✅ ${data.aiRequests} AI requests per month</div>
              <div class="feature-item">✅ Advanced analytics</div>
              <div class="feature-item">✅ Priority support</div>
            </div>

            <div style="text-align: center; margin-top: 24px;">
              <a href="${data.appUrl}/billing" class="button">Manage Subscription</a>
            </div>
          </div>
        </body>
      </html>
    `,
  }),

  weekly_summary: (data: any) => ({
    subject: `Your week in review: ${data.weekRange}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f0a1a; color: #fff; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background: #1a1025; border-radius: 12px; padding: 24px; }
            .header { text-align: center; margin-bottom: 24px; }
            .stats { display: flex; gap: 12px; margin: 16px 0; }
            .stat { background: #2a1f3d; padding: 16px; border-radius: 8px; text-align: center; flex: 1; }
            .stat-number { font-size: 28px; font-weight: bold; color: #8b5cf6; }
            .stat-label { font-size: 12px; color: #888; margin-top: 4px; }
            .highlight { background: linear-gradient(135deg, #8b5cf6, #7c3aed); padding: 16px; border-radius: 8px; margin: 16px 0; }
            .button { display: inline-block; background: #8b5cf6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2 style="color: #8b5cf6;">📊 Weekly Summary</h2>
              <p style="color: #888;">${data.weekRange}</p>
            </div>

            <div class="stats">
              <div class="stat">
                <div class="stat-number">${data.totalEvents}</div>
                <div class="stat-label">Events</div>
              </div>
              <div class="stat">
                <div class="stat-number">${data.completedTasks}</div>
                <div class="stat-label">Tasks Done</div>
              </div>
              <div class="stat">
                <div class="stat-number">${data.focusHours}h</div>
                <div class="stat-label">Focus Time</div>
              </div>
            </div>

            <div class="highlight">
              <p style="margin: 0; font-weight: 600;">🏆 ${data.achievement || 'Great week!'}</p>
              <p style="margin: 8px 0 0; opacity: 0.9; font-size: 14px;">${data.achievementDetail || 'Keep up the excellent work!'}</p>
            </div>

            <p>Top focus areas this week:</p>
            <ul style="color: #ccc;">
              ${(data.topCategories || []).map((cat: string) => `<li>${cat}</li>`).join('')}
            </ul>

            <div style="text-align: center; margin-top: 24px;">
              <a href="${data.appUrl}/analytics" class="button">View Full Analytics</a>
            </div>
          </div>
        </body>
      </html>
    `,
  }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, to, data } = req.body as EmailRequest;
  
  if (!type || !to || !data) {
    return res.status(400).json({ error: 'Missing required fields: type, to, data' });
  }

  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  if (!sendgridApiKey) {
    return res.status(500).json({ error: 'SendGrid API key not configured' });
  }

  const templateFn = templates[type];
  if (!templateFn) {
    return res.status(400).json({ error: `Unknown email type: ${type}` });
  }

  const { subject, html } = templateFn({
    ...data,
    appUrl: process.env.VITE_APP_URL || 'https://malleabite.vercel.app',
  });

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { 
          email: process.env.SENDGRID_FROM_EMAIL || 'noreply@malleabite.com',
          name: 'Malleabite'
        },
        subject,
        content: [{ type: 'text/html', value: html }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('SendGrid error:', error);
      return res.status(500).json({ error: 'Failed to send email' });
    }

    return res.status(200).json({ success: true, message: 'Email sent' });
  } catch (error) {
    console.error('Email error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
