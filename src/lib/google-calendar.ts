// Google Calendar Sync Service
import { CalendarEventType } from '@/lib/stores/types';
import { logger } from '@/lib/logger';
import dayjs from 'dayjs';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string; timeZone?: string };
  end: { dateTime?: string; date?: string; timeZone?: string };
  colorId?: string;
}

interface GoogleCalendarList {
  items: Array<{
    id: string;
    summary: string;
    primary?: boolean;
    backgroundColor?: string;
  }>;
}

// Store tokens in memory (in production, use secure storage)
let accessToken: string | null = null;
let tokenExpiry: number | null = null;

// Initialize Google OAuth
export function initGoogleCalendarAuth(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!GOOGLE_CLIENT_ID) {
      reject(new Error('Google Client ID not configured'));
      return;
    }

    // Use Google Identity Services
    const client = (window as any).google?.accounts?.oauth2?.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_CALENDAR_SCOPES,
      callback: (response: any) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        accessToken = response.access_token;
        tokenExpiry = Date.now() + (response.expires_in * 1000);
        resolve(response.access_token);
      },
    });

    if (!client) {
      reject(new Error('Google Identity Services not loaded'));
      return;
    }

    client.requestAccessToken({ prompt: 'consent' });
  });
}

// Check if authenticated
export function isGoogleCalendarAuthenticated(): boolean {
  return !!accessToken && !!tokenExpiry && Date.now() < tokenExpiry;
}

// Disconnect Google Calendar
export function disconnectGoogleCalendar(): void {
  if (accessToken) {
    (window as any).google?.accounts?.oauth2?.revoke(accessToken);
  }
  accessToken = null;
  tokenExpiry = null;
}

// Fetch user's calendars
export async function fetchGoogleCalendars(): Promise<GoogleCalendarList['items']> {
  if (!accessToken) {
    throw new Error('Not authenticated with Google');
  }

  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch calendars');
  }

  const data: GoogleCalendarList = await response.json();
  return data.items;
}

// Fetch events from Google Calendar
export async function fetchGoogleCalendarEvents(
  calendarId: string = 'primary',
  timeMin?: Date,
  timeMax?: Date
): Promise<GoogleCalendarEvent[]> {
  if (!accessToken) {
    throw new Error('Not authenticated with Google');
  }

  const params = new URLSearchParams({
    maxResults: '250',
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  if (timeMin) {
    params.set('timeMin', timeMin.toISOString());
  }
  if (timeMax) {
    params.set('timeMax', timeMax.toISOString());
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch events');
  }

  const data = await response.json();
  return data.items || [];
}

// Convert Google event to Malleabite format.
// Produces the format expected by useCalendarEvents.addEvent:
//   description = "HH:mm - HH:mm | actual description"
//   date = Date object, startsAt / endsAt = "HH:mm" strings
export function googleEventToMalleabite(
  event: GoogleCalendarEvent,
  calendarId?: string
): Partial<CalendarEventType> {
  const startRaw = event.start.dateTime || event.start.date;
  const endRaw = event.end.dateTime || event.end.date;
  const isAllDay = !event.start.dateTime;

  const startDayjs = dayjs(startRaw);
  const endDayjs = endRaw ? dayjs(endRaw) : startDayjs.add(1, 'hour');

  const startHHMM = startDayjs.format('HH:mm');
  const endHHMM = endDayjs.format('HH:mm');

  return {
    title: event.summary || 'Untitled Event',
    description: `${startHHMM} - ${endHHMM} | ${event.description || ''}`,
    date: startDayjs.toDate(),
    startsAt: startHHMM,
    endsAt: endHHMM,
    color: googleColorToMalleabite(event.colorId),
    isLocked: false,
    isTodo: false,
    hasAlarm: false,
    hasReminder: false,
    isAllDay,
    location: event.location,
    timeZone: event.start.timeZone,
    calendarId: calendarId || 'google',
    googleEventId: event.id,
    source: 'google',
  };
}

// Map Google Calendar colors to Malleabite colors
function googleColorToMalleabite(colorId?: string): string {
  const colorMap: Record<string, string> = {
    '1': 'bg-blue-500/70',    // Lavender
    '2': 'bg-green-500/70',   // Sage
    '3': 'bg-purple-500/70',  // Grape
    '4': 'bg-pink-500/70',    // Flamingo
    '5': 'bg-yellow-500/70',  // Banana
    '6': 'bg-orange-500/70',  // Tangerine
    '7': 'bg-cyan-500/70',    // Peacock
    '8': 'bg-gray-500/70',    // Graphite
    '9': 'bg-indigo-500/70',  // Blueberry
    '10': 'bg-emerald-500/70', // Basil
    '11': 'bg-red-500/70',    // Tomato
  };
  return colorMap[colorId || ''] || 'bg-blue-500/70';
}

// Convert Malleabite event to Google format
export function malleabiteEventToGoogle(event: CalendarEventType): Partial<GoogleCalendarEvent> {
  return {
    summary: event.title,
    description: event.description,
    start: {
      dateTime: dayjs(event.startsAt).toISOString(),
    },
    end: {
      dateTime: event.endsAt 
        ? dayjs(event.endsAt).toISOString()
        : dayjs(event.startsAt).add(1, 'hour').toISOString(),
    },
  };
}

// Create event in Google Calendar
export async function createGoogleCalendarEvent(
  event: CalendarEventType,
  calendarId: string = 'primary'
): Promise<GoogleCalendarEvent> {
  if (!accessToken) {
    throw new Error('Not authenticated with Google');
  }

  const googleEvent = malleabiteEventToGoogle(event);

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(googleEvent),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    logger.error('GoogleCalendar', `Failed to create event: ${error}`);
    throw new Error('Failed to create event in Google Calendar');
  }

  return response.json();
}

// Update event in Google Calendar
export async function updateGoogleCalendarEvent(
  eventId: string,
  event: CalendarEventType,
  calendarId: string = 'primary'
): Promise<GoogleCalendarEvent> {
  if (!accessToken) {
    throw new Error('Not authenticated with Google');
  }

  const googleEvent = malleabiteEventToGoogle(event);

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(googleEvent),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to update event in Google Calendar');
  }

  return response.json();
}

// Delete event from Google Calendar
export async function deleteGoogleCalendarEvent(
  eventId: string,
  calendarId: string = 'primary'
): Promise<void> {
  if (!accessToken) {
    throw new Error('Not authenticated with Google');
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok && response.status !== 404) {
    throw new Error('Failed to delete event from Google Calendar');
  }
}

// Import all events from Google Calendar
export async function importFromGoogleCalendar(
  calendarId: string = 'primary',
  daysBack: number = 30,
  daysForward: number = 90
): Promise<Partial<CalendarEventType>[]> {
  const timeMin = dayjs().subtract(daysBack, 'day').toDate();
  const timeMax = dayjs().add(daysForward, 'day').toDate();

  const googleEvents = await fetchGoogleCalendarEvents(calendarId, timeMin, timeMax);
  
  logger.info('GoogleCalendar', `Imported ${googleEvents.length} events`);
  
  return googleEvents.map(e => googleEventToMalleabite(e, calendarId));
}
