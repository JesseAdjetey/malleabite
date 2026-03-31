// Booking notification Cloud Function
// Sends confirmation emails to guest and host, and creates a calendar event for the host.
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as nodemailer from 'nodemailer';
import { defineSecret } from 'firebase-functions/params';

const smtpUser = defineSecret('SMTP_USER');
const smtpPass = defineSecret('SMTP_PASS');
const smtpHost = defineSecret('SMTP_HOST');
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

export const onBookingCreated = onCall(
  { secrets: [smtpUser, smtpPass, smtpHost, appBaseUrl] },
  async (request) => {
    const data = request.data as BookingConfirmationData;

    if (!data.bookingId || !data.guestEmail || !data.hostUserId) {
      throw new HttpsError('invalid-argument', 'Missing required booking fields');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.guestEmail)) {
      throw new HttpsError('invalid-argument', 'Invalid guest email address');
    }

    // Fetch host profile for name / email
    const hostDoc = await admin.firestore().collection('users').doc(data.hostUserId).get();
    const hostData = hostDoc.data();
    const hostEmail = hostData?.email as string | undefined;
    const hostName = (hostData?.displayName as string | undefined) || 'Your host';

    const startFormatted = new Date(data.startsAt).toLocaleString('en-US', {
      timeZone: data.timeZone,
      dateStyle: 'full',
      timeStyle: 'short',
    });

    const transport = nodemailer.createTransport({
      host: smtpHost.value(),
      port: 587,
      secure: false,
      auth: { user: smtpUser.value(), pass: smtpPass.value() },
    });

    const baseUrl = appBaseUrl.value() || 'https://malleabite.com';

    // Build ICS attachment for calendar invite
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
      `ORGANIZER;CN=${hostName}:mailto:${hostEmail || smtpUser.value()}`,
      `ATTENDEE;CN=${data.guestName};RSVP=TRUE:mailto:${data.guestEmail}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].filter(Boolean).join('\r\n');

    const icsAttachment = {
      filename: 'invite.ics',
      content: icsContent,
      contentType: 'text/calendar; charset=utf-8; method=REQUEST',
    };

    const emailPromises: Promise<unknown>[] = [];

    // Guest confirmation email
    emailPromises.push(
      transport.sendMail({
        from: `"Malleabite" <${smtpUser.value()}>`,
        to: data.guestEmail,
        subject: `Confirmed: ${data.title} with ${hostName}`,
        html: `
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
        attachments: [icsAttachment],
      })
    );

    // Host notification email
    if (hostEmail) {
      emailPromises.push(
        transport.sendMail({
          from: `"Malleabite" <${smtpUser.value()}>`,
          to: hostEmail,
          subject: `New booking: ${data.title} — ${data.guestName}`,
          html: `
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
          attachments: [icsAttachment],
        })
      );
    }

    await Promise.allSettled(emailPromises);

    // Persist a calendar event on the host's Malleabite calendar
    const calendarEventsRef = admin
      .firestore()
      .collection('users')
      .doc(data.hostUserId)
      .collection('events');

    await calendarEventsRef.add({
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
