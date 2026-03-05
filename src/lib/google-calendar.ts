// Google Calendar Sync Service
import { CalendarEventType } from '@/lib/stores/types';
import { logger } from '@/lib/logger';
import dayjs from 'dayjs';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_CALENDAR_SCOPES = [
  'openid',
  'email',
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

// ─── Per-account token storage ─────────────────────────────────────────
// Supports multiple Google accounts by keying tokens on email.
// Legacy single-slot keys are migrated on boot.

const TOKEN_MAP_KEY = 'malleabite_gcal_tokens';
const LEGACY_TOKEN_KEY = 'malleabite_gcal_token';
const LEGACY_EXPIRY_KEY = 'malleabite_gcal_expiry';

interface AccountToken {
  accessToken: string;
  expiry: number; // epoch ms
  email: string;
}

/** In-memory cache — hydrated from localStorage on load */
let tokenMap: Record<string, AccountToken> = {};

function loadTokenMap(): Record<string, AccountToken> {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_MAP_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveTokenMap() {
  localStorage.setItem(TOKEN_MAP_KEY, JSON.stringify(tokenMap));
}

// Migrate legacy single-slot token once
(function migrateLegacyToken() {
  const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY);
  const legacyExpiry = localStorage.getItem(LEGACY_EXPIRY_KEY);
  if (legacyToken && legacyExpiry) {
    // We don't know the email yet, store under a sentinel key; it will be
    // overwritten on the next real auth.
    const map = loadTokenMap();
    if (Object.keys(map).length === 0) {
      map['__legacy__'] = {
        accessToken: legacyToken,
        expiry: parseInt(legacyExpiry, 10),
        email: '__legacy__',
      };
      localStorage.setItem(TOKEN_MAP_KEY, JSON.stringify(map));
    }
    localStorage.removeItem(LEGACY_TOKEN_KEY);
    localStorage.removeItem(LEGACY_EXPIRY_KEY);
  }
  tokenMap = loadTokenMap();
})();

function persistAccountToken(email: string, token: string, expiresIn: number) {
  // Remove the legacy sentinel if it exists
  delete tokenMap['__legacy__'];
  tokenMap[email] = { accessToken: token, expiry: Date.now() + expiresIn * 1000, email };
  saveTokenMap();
}

function getAccountToken(email?: string): string | null {
  if (email && tokenMap[email]) {
    const entry = tokenMap[email];
    if (Date.now() < entry.expiry) return entry.accessToken;
    return null;
  }
  // If no specific email requested, return the first non-expired token
  // (only used for non-account-specific calls like initial discovery).
  if (!email) {
    for (const entry of Object.values(tokenMap)) {
      if (Date.now() < entry.expiry) return entry.accessToken;
    }
  }
  // If a specific email was requested but not found, do NOT fall back
  // to another account's token — that would use the wrong credentials.
  return null;
}

function clearAccountToken(email: string) {
  delete tokenMap[email];
  saveTokenMap();
}

function clearAllTokens() {
  tokenMap = {};
  saveTokenMap();
}

// Back-compat helper used by API functions below
function getActiveToken(accountEmail?: string): string | null {
  return getAccountToken(accountEmail);
}

// Guard to prevent re-entrant popup calls
let authInProgress = false;

// Initialize Google OAuth — returns the token AND the account email
export interface GoogleAuthResult {
  token: string;
  email: string;
}

export function initGoogleCalendarAuth(): Promise<GoogleAuthResult> {
  return new Promise((resolve, reject) => {
    if (!GOOGLE_CLIENT_ID) {
      reject(new Error('Google Client ID not configured. Add VITE_GOOGLE_CLIENT_ID to your .env file.'));
      return;
    }

    // Prevent re-entrant popup calls — if an auth is already in progress,
    // reject immediately so callers don't stack up multiple popups.
    if (authInProgress) {
      reject(new Error('Google authentication is already in progress.'));
      return;
    }
    authInProgress = true;

    let settled = false;
    const settle = (fn: () => void) => {
      if (!settled) { settled = true; authInProgress = false; fn(); }
    };

    // Safety timeout — if the popup is blocked or GIS never calls back
    const timeout = setTimeout(() => {
      settle(() => reject(new Error(
        'Google authentication timed out. Make sure popups are allowed for this site.'
      )));
    }, 60_000);

    // Use Google Identity Services
    const client = (window as any).google?.accounts?.oauth2?.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: GOOGLE_CALENDAR_SCOPES,
      callback: async (response: any) => {
        // Wrap the entire callback in try/catch so the promise can never hang.
        // clearTimeout is called first — if something throws afterwards
        // without this guard, the promise would never settle.
        try {
          clearTimeout(timeout);
          if (response.error) {
            settle(() => reject(new Error(response.error_description || response.error)));
            return;
          }
          if (!response.access_token) {
            settle(() => reject(new Error('No access token received from Google')));
            return;
          }

          // Fetch the email of the account that just authenticated
          let email = '__unknown__';
          try {
            const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${response.access_token}` },
            }).then(r => r.json());
            email = userInfo.email || '__unknown__';
          } catch (e) {
            console.warn('[Google Auth] Failed to fetch user email, using fallback', e);
          }

          persistAccountToken(email, response.access_token, response.expires_in || 3600);
          settle(() => resolve({ token: response.access_token, email }));
        } catch (callbackErr) {
          console.error('[Google Auth] Unexpected error in GIS callback:', callbackErr);
          settle(() => reject(
            callbackErr instanceof Error
              ? callbackErr
              : new Error('Unexpected error during Google sign-in')
          ));
        }
      },
      error_callback: (err: any) => {
        // GIS calls this when popup is closed, blocked, or fails to open
        clearTimeout(timeout);
        const msg = err?.message || err?.type || 'Google sign-in was cancelled or blocked';
        console.warn('[Google Auth] error_callback:', err);
        settle(() => reject(new Error(msg)));
      },
    });

    if (!client) {
      clearTimeout(timeout);
      settle(() => reject(new Error(
        'Google Identity Services not loaded. Check your internet connection and try again.'
      )));
      return;
    }

    // 'select_account' shows account picker every time.
    // Avoid 'consent' — it triggers stricter COOP handling in some browsers
    // that blocks the popup callback.
    client.requestAccessToken({ prompt: 'select_account' });
  });
}

// Check if authenticated (optionally for a specific account)
export function isGoogleCalendarAuthenticated(accountEmail?: string): boolean {
  // Re-read from localStorage in case another tab updated the map
  tokenMap = loadTokenMap();
  return !!getAccountToken(accountEmail);
}

/**
 * Silently attempt to refresh a Google token using GIS `prompt: 'none'`.
 * Does NOT open any popup or redirect — only works if the user has an active
 * Google session and has previously consented.  Background operations
 * (polling, write-back) should call this instead of initGoogleCalendarAuth
 * so they never trigger a visible popup.
 * Returns true if a valid token was obtained.
 */
export async function ensureGoogleToken(accountEmail?: string): Promise<boolean> {
  // Fast path: token is already valid
  if (isGoogleCalendarAuthenticated(accountEmail)) return true;

  // Attempt a silent token refresh — no popup
  if (!GOOGLE_CLIENT_ID) return false;
  const gis = (window as any).google?.accounts?.oauth2;
  if (!gis) return false;

  return new Promise<boolean>((resolve) => {
    // 10-second timeout for the silent attempt
    const timeout = setTimeout(() => resolve(false), 10_000);

    try {
      const client = gis.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_CALENDAR_SCOPES,
        callback: async (response: any) => {
          clearTimeout(timeout);
          if (response.error || !response.access_token) {
            resolve(false);
            return;
          }
          // Fetch email for the token
          let email = accountEmail || '__unknown__';
          if (!accountEmail) {
            try {
              const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${response.access_token}` },
              }).then(r => r.json());
              email = userInfo.email || '__unknown__';
            } catch { /* use fallback */ }
          }
          persistAccountToken(email, response.access_token, response.expires_in || 3600);
          resolve(true);
        },
        error_callback: () => {
          clearTimeout(timeout);
          resolve(false);
        },
      });

      if (!client) {
        clearTimeout(timeout);
        resolve(false);
        return;
      }

      // prompt: 'none' is the official GIS silent mode — no UI of any kind.
      // If a valid session exists and the user previously consented to these
      // scopes, a new token is returned silently.  Otherwise the error_callback
      // fires and we resolve(false).
      client.requestAccessToken({ prompt: 'none' });
    } catch {
      clearTimeout(timeout);
      resolve(false);
    }
  });
}

// Disconnect a Google Calendar account (or all if no email given)
export function disconnectGoogleCalendar(accountEmail?: string): void {
  if (accountEmail) {
    const entry = tokenMap[accountEmail];
    if (entry) {
      (window as any).google?.accounts?.oauth2?.revoke(entry.accessToken);
      clearAccountToken(accountEmail);
    }
  } else {
    // Revoke all tokens
    for (const entry of Object.values(tokenMap)) {
      (window as any).google?.accounts?.oauth2?.revoke(entry.accessToken);
    }
    clearAllTokens();
  }
}

// Fetch user's calendars
export async function fetchGoogleCalendars(accountEmail?: string): Promise<GoogleCalendarList['items']> {
  const token = getActiveToken(accountEmail);
  if (!token) {
    throw new Error('Not authenticated with Google. Please reconnect.');
  }

  // 15-second timeout so the call can't hang forever
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  let response: Response;
  try {
    response = await fetch(
      'https://www.googleapis.com/calendar/v3/users/me/calendarList',
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      }
    );
  } catch (fetchErr: any) {
    clearTimeout(timeoutId);
    if (fetchErr?.name === 'AbortError') {
      throw new Error('Request timed out. Check your internet connection and try again.');
    }
    throw new Error(`Network error: ${fetchErr?.message || 'Failed to reach Google Calendar API'}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    // Extract the actual error from Google's API response
    let detail = '';
    try {
      const errBody = await response.json();
      detail = errBody?.error?.message || '';
    } catch { /* ignore parse errors */ }

    if (response.status === 403) {
      throw new Error(
        detail ||
        'Google Calendar API access denied. Make sure the Google Calendar API is enabled in your Google Cloud Console.'
      );
    }
    if (response.status === 401) {
      if (accountEmail) clearAccountToken(accountEmail); else clearAllTokens();
      throw new Error('Google session expired. Please reconnect.');
    }
    throw new Error(detail || `Failed to fetch calendars (HTTP ${response.status})`);
  }

  const data: GoogleCalendarList = await response.json();
  return data.items || [];
}

// Fetch events from Google Calendar
export async function fetchGoogleCalendarEvents(
  calendarId: string = 'primary',
  timeMin?: Date,
  timeMax?: Date,
  accountEmail?: string
): Promise<GoogleCalendarEvent[]> {
  const token = getActiveToken(accountEmail);
  if (!token) {
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
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch events');
  }

  const data = await response.json();
  return data.items || [];
}

// Convert Google event to Malleabite format.
// startsAt/endsAt are now full ISO strings (not "HH:mm").
export function googleEventToMalleabite(
  event: GoogleCalendarEvent,
  calendarId?: string
): Partial<CalendarEventType> {
  const startRaw = event.start.dateTime || event.start.date;
  const endRaw = event.end.dateTime || event.end.date;
  const isAllDay = !event.start.dateTime;

  const startDayjs = dayjs(startRaw);
  const endDayjs = endRaw ? dayjs(endRaw) : startDayjs.add(1, 'hour');

  return {
    title: event.summary || 'Untitled Event',
    description: event.description || '',
    date: startDayjs.format('YYYY-MM-DD'),
    startsAt: startDayjs.toISOString(),
    endsAt: endDayjs.toISOString(),
    timeStart: startDayjs.format('HH:mm'),
    timeEnd: endDayjs.format('HH:mm'),
    color: googleColorToMalleabite(event.colorId),
    isLocked: false,
    isTodo: false,
    hasAlarm: false,
    hasReminder: false,
    isAllDay,
    calendarId: calendarId || 'google',
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
// startsAt/endsAt are full ISO strings in Malleabite
export function malleabiteEventToGoogle(event: CalendarEventType): Partial<GoogleCalendarEvent> {
  // startsAt is already an ISO string (e.g. "2026-03-02T14:00:00.000Z")
  const startISO = event.startsAt;
  const endISO = event.endsAt || dayjs(event.startsAt).add(1, 'hour').toISOString();
  const tz = event.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  return {
    summary: event.title,
    description: event.description,
    location: event.location,
    start: {
      dateTime: startISO,
      timeZone: tz,
    },
    end: {
      dateTime: endISO,
      timeZone: tz,
    },
  };
}

// Create event in Google Calendar
export async function createGoogleCalendarEvent(
  event: CalendarEventType,
  calendarId: string = 'primary',
  accountEmail?: string
): Promise<GoogleCalendarEvent> {
  const token = getActiveToken(accountEmail);
  if (!token) {
    throw new Error('Not authenticated with Google');
  }

  const googleEvent = malleabiteEventToGoogle(event);

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
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
  calendarId: string = 'primary',
  accountEmail?: string
): Promise<GoogleCalendarEvent> {
  const token = getActiveToken(accountEmail);
  if (!token) {
    throw new Error('Not authenticated with Google');
  }

  const googleEvent = malleabiteEventToGoogle(event);

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
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
  calendarId: string = 'primary',
  accountEmail?: string
): Promise<void> {
  const token = getActiveToken(accountEmail);
  if (!token) {
    throw new Error('Not authenticated with Google');
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
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
