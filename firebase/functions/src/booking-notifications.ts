// Booking notification Cloud Function
// Sends confirmation emails to guest and host, and creates a calendar event for the host.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';

const sendgridApiKey = defineSecret('SENDGRID_API_KEY');
const appBaseUrl = defineSecret('APP_BASE_URL');

interface BookingConfirmationData {
  bookingId: string;
  bookingPageId: string;
  guestName: string;
  guestEmail: string;
  hostUserId: string;
  startsAt: string;
  endsAt: string;
  title: string;
  location?: string;
  timeZone: string;
}

const FROM_EMAIL = 'noreply@malleabite.com';

async function sendEmail(apiKey: string, to: string, subject: string, html: string, attachments?: Array<{ content: string; filename: string; type: string; disposition: string }>) {
  const body: any = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: FROM_EMAIL, name: 'Malleabite' },
    subject,
    content: [{ type: 'text/html', value: html }],
  };
  if (attachments) body.attachments = attachments;

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error('[BookingNotifications] SendGrid error:', err);
  }
}

export const onBookingCreated = onCall(
  { secrets: [sendgridApiKey, appBaseUrl] },
  async (request) => {
    const data = request.data as BookingConfirmationData;

    if (!data.bookingId || !data.guestEmail || !data.hostUserId) {
      throw new HttpsError('invalid-argument', 'Missing required booking fields');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.guestEmail)) {
      throw new HttpsError('invalid-argument', 'Invalid guest email address');
    }

    const hostDoc = await admin.firestore().collection('users').doc(data.hostUserId).get();
    const hostData = hostDoc.data();
    const hostEmail = hostData?.email as string | undefined;
    const hostName = (hostData?.displayName as string | undefined) || 'Your host';

    const startFormatted = new Date(data.startsAt).toLocaleString('en-US', {
      timeZone: data.timeZone,
      dateStyle: 'full',
      timeStyle: 'short',
    });

    const baseUrl = appBaseUrl.value() || 'https://malleabite.com';
    const apiKey = sendgridApiKey.value();

    // Build ICS attachment
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Malleabite//EN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:${data.bookingId}@malleabite.com`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace('.', '').slice(0, 15)}Z`,
      `DTSTART:${new Date(data.startsAt).toISOString().replace(/[-:]/g, '').replace('.', '').slice(0, 15)}Z`,
      `DTEND:${new Date(data.endsAt).toISOString().replace(/[-:]/g, '').replace('.', '').slice(0, 15)}Z`,
      `SUMMARY:${data.title}`,
      `DESCRIPTION:Booked via Malleabite`,
      data.location ? `LOCATION:${data.location}` : '',
      `ORGANIZER;CN=${hostName}:mailto:${hostEmail || FROM_EMAIL}`,
      `ATTENDEE;CN=${data.guestName};RSVP=TRUE:mailto:${data.guestEmail}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');

    const icsAttachment = [{
      content: Buffer.from(icsContent).toString('base64'),
      filename: 'invite.ics',
      type: 'text/calendar; method=REQUEST',
      disposition: 'attachment',
    }];

    const emailPromises: Promise<void>[] = [];

    // Guest confirmation email
    emailPromises.push(sendEmail(
      apiKey,
      data.guestEmail,
      `Confirmed: ${data.title} with ${hostName}`,
      `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <h2 style="color:#3b82f6">Your appointment is confirmed</h2>
          <p>Hi ${data.guestName},</p>
          <p>Your booking with <strong>${hostName}</strong> has been confirmed.</p>
          <table style="border-collapse:collapse;width:100%;margin:16px 0">
            <tr><td style="padding:8px 0;color:#6b7280;width:120px">Event</td><td><strong>${data.title}</strong></td></tr>
            <tr><td style="padding:8px 0;color:#6b7280">When</td><td>${startFormatted}</td></tr>
            ${data.location ? `<tr><td style="padding:8px 0;color:#6b7280">Where</td><td>${data.location}</td></tr>` : ''}
          </table>
          <p style="color:#6b7280;font-size:14px">The calendar invite is attached. Add it to your calendar to get reminders.</p>
        </div>
      `,
      icsAttachment,
    ));

    // Host notification email
    if (hostEmail) {
      emailPromises.push(sendEmail(
        apiKey,
        hostEmail,
        `New booking: ${data.title} — ${data.guestName}`,
        `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#3b82f6">New appointment booked</h2>
            <p>Someone has booked time on your calendar.</p>
            <table style="border-collapse:collapse;width:100%;margin:16px 0">
              <tr><td style="padding:8px 0;color:#6b7280;width:120px">Guest</td><td><strong>${data.guestName}</strong> (${data.guestEmail})</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280">Event</td><td>${data.title}</td></tr>
              <tr><td style="padding:8px 0;color:#6b7280">When</td><td>${startFormatted}</td></tr>
              ${data.location ? `<tr><td style="padding:8px 0;color:#6b7280">Where</td><td>${data.location}</td></tr>` : ''}
            </table>
            <a href="${baseUrl}/settings?tab=bookings" style="display:inline-block;background:#3b82f6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;margin-top:8px">View Booking</a>
          </div>
        `,
        icsAttachment,
      ));
    }

    await Promise.allSettled(emailPromises);

    // Persist a calendar event on the host's Malleabite calendar
    await admin.firestore()
      .collection('users')
      .doc(data.hostUserId)
      .collection('events')
      .add({
        title: `${data.title} — ${data.guestName}`,
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        date: data.startsAt.split('T')[0],
        location: data.location || '',
        description: `Booked by ${data.guestName} (${data.guestEmail})`,
        color: '#3b82f6',
        isLocked: true,
        source: 'booking',
        bookingId: data.bookingId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

    return { success: true };
  }
);
