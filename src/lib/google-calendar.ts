// Google Calendar Sync Service
import { CalendarEventType } from '@/lib/stores/types';
import { logger } from '@/lib/logger';
import {
  FirebaseFunctions,
  ListGoogleCalendarsResponse,
} from '@/integrations/firebase/functions';
import dayjs from 'dayjs';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
const USE_BACKEND_GOOGLE_OAUTH = import.meta.env.VITE_USE_BACKEND_GOOGLE_OAUTH === 'true';
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

interface GoogleCalendarEventsResponse {
  items?: GoogleCalendarEvent[];
  nextPageToken?: string;
}

export const GOOGLE_SYNC_DAYS_BACK = 365;
export const GOOGLE_SYNC_DAYS_FORWARD = 365;

// ─── Per-account token storage ─────────────────────────────────────────
// Supports multiple Google accounts by keying tokens on email.
// Legacy single-slot keys are migrated on boot.

const TOKEN_MAP_KEY = 'malleabite_gcal_tokens';
const ACCOUNT_ID_MAP_KEY = 'malleabite_gcal_account_ids';
const LEGACY_TOKEN_KEY = 'malleabite_gcal_token';
const LEGACY_EXPIRY_KEY = 'malleabite_gcal_expiry';

interface AccountToken {
  accessToken: string;
  expiry: number; // epoch ms
  email: string;
}

interface AccountIdMap {
  [email: string]: string;
}

/** In-memory cache — hydrated from localStorage on load */
let tokenMap: Record<string, AccountToken> = {};

function loadAccountIdMap(): AccountIdMap {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNT_ID_MAP_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveAccountIdMap(map: AccountIdMap) {
  localStorage.setItem(ACCOUNT_ID_MAP_KEY, JSON.stringify(map));
}

function persistGoogleAccountId(email: string, googleAccountId?: string) {
  if (!googleAccountId) return;
  const map = loadAccountIdMap();
  map[email] = googleAccountId;
  saveAccountIdMap(map);
}

function getGoogleAccountId(email?: string): string | null {
  const map = loadAccountIdMap();
  if (email) {
    return map[email] || null;
  }
  const firstEntry = Object.values(map)[0];
  return firstEntry || null;
}

function clearGoogleAccountId(email: string) {
  const map = loadAccountIdMap();
  delete map[email];
  saveAccountIdMap(map);
}

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
  clearGoogleAccountId(email);
}

function clearAllTokens() {
  tokenMap = {};
  saveTokenMap();
  saveAccountIdMap({});
}

// Back-compat helper used by API functions below
function getActiveToken(accountEmail?: string): string | null {
  return getAccountToken(accountEmail);
}

// ─── Interactive auth state ────────────────────────────────────────────
let authInProgress = false;
let gisRequestInProgress = false; // shared mutex with silent refresh

// Reusable GIS token client — singleton to avoid issues with multiple instances
let cachedTokenClient: any = null;
let pendingResolve: ((result: GoogleAuthResult) => void) | null = null;
let pendingReject: ((err: Error) => void) | null = null;

function cleanupAuth() {
  authInProgress = false;
  gisRequestInProgress = false;
  pendingResolve = null;
  pendingReject = null;
}

/** Cancel an in-progress interactive auth (called by UI Cancel button). */
export function cancelGoogleAuth() {
  if (!authInProgress) return;
  const reject = pendingReject;
  cleanupAuth();
  reject?.(new Error('Authentication was cancelled.'));
}

function getOrCreateTokenClient(): any {
  const gis = (window as any).google?.accounts?.oauth2;
  if (!gis) return null;

  if (cachedTokenClient) return cachedTokenClient;

  cachedTokenClient = gis.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: GOOGLE_CALENDAR_SCOPES,
    callback: async (response: any) => {
      gisRequestInProgress = false;
      console.log('[Google Auth] GIS callback fired', response.error ? `error: ${response.error}` : 'success');
      try {
        if (response.error) {
          pendingReject?.(new Error(response.error_description || response.error));
          return;
        }
        if (!response.access_token) {
          pendingReject?.(new Error('No access token received from Google'));
          return;
        }

        let email = '__unknown__';
        try {
          const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${response.access_token}` },
          }).then(r => r.json());
          email = userInfo.email || '__unknown__';
        } catch (e) {
          console.warn('[Google Auth] Could not fetch user email', e);
        }

        persistAccountToken(email, response.access_token, response.expires_in || 3600);
        console.log('[Google Auth] Token stored for', email, '— calling pendingResolve:', !!pendingResolve);
        pendingResolve?.({ token: response.access_token, email });
      } catch (callbackErr) {
        console.error('[Google Auth] Callback error:', callbackErr);
        pendingReject?.(
          callbackErr instanceof Error
            ? callbackErr
            : new Error('Unexpected error during Google sign-in')
        );
      } finally {
        cleanupAuth();
      }
    },
    error_callback: (err: any) => {
      const msg = err?.message || err?.type || 'Google sign-in was cancelled or blocked';
      console.warn('[Google Auth] error_callback:', err);
      pendingReject?.(new Error(msg));
      cleanupAuth();
    },
  });

  return cachedTokenClient;
}

// Initialize Google OAuth — returns the token AND the account email
export interface GoogleAuthResult {
  token: string;
  email: string;
  googleAccountId?: string;
}

async function initBackendGoogleCalendarAuth(loginHint?: string): Promise<GoogleAuthResult> {
  const { authUrl, callbackUrl } = await FirebaseFunctions.getGoogleCalendarAuthUrl({
    origin: window.location.origin,
    loginHint,
  });

  const allowedOrigins = new Set<string>([window.location.origin]);
  try {
    allowedOrigins.add(new URL(callbackUrl).origin);
  } catch {
    // Ignore malformed callback URL and fall back to the app origin check.
  }

  return new Promise((resolve, reject) => {
    const popup = window.open(
      authUrl,
      'malleabite-google-auth',
      'width=520,height=720,left=200,top=80,toolbar=no,menubar=no',
    );

    if (!popup) {
      reject(new Error('Google sign-in popup was blocked. Please allow popups for this site and try again.'));
      return;
    }

    let settled = false;
    let closePoll: ReturnType<typeof setInterval> | null = null;

    const cleanup = () => {
      if (closePoll) {
        clearInterval(closePoll);
        closePoll = null;
      }
      window.removeEventListener('message', onMessage);
    };

    const onMessage = (event: MessageEvent) => {
      const data = event.data as {
        source?: string;
        type?: string;
        error?: string;
        accessToken?: string;
        expiresIn?: number;
        email?: string;
        googleAccountId?: string;
      };

      if (data?.source !== 'malleabite-google-oauth') return;
      if (!allowedOrigins.has(event.origin)) {
        console.warn('[Google Auth] Ignoring OAuth message from unexpected origin:', event.origin);
        return;
      }
      if (settled) return;

      settled = true;
      cleanup();

      if (data.type === 'success' && data.accessToken && data.email) {
        persistAccountToken(data.email, data.accessToken, data.expiresIn || 3600);
        persistGoogleAccountId(data.email, data.googleAccountId);
        resolve({
          token: data.accessToken,
          email: data.email,
          googleAccountId: data.googleAccountId,
        });
        return;
      }

      reject(new Error(data?.error || 'Google Calendar connection failed.'));
    };

    window.addEventListener('message', onMessage);
    closePoll = setInterval(() => {
      if (!settled && popup.closed) {
        settled = true;
        cleanup();
        reject(new Error('Google sign-in window was closed before completing.'));
      }
    }, 500);
  });
}

export async function fetchGoogleCalendarsViaBackend(googleAccountId: string): Promise<ListGoogleCalendarsResponse['calendars']> {
  const response = await FirebaseFunctions.listGoogleCalendarsForAccount({ googleAccountId });
  return response.calendars;
}

/**
 * Uses GIS to request an access token for an explicit user-driven connect
 * action. This path should always trigger a visible Google sign-in / consent
 * flow instead of silently reusing cached state.
 */
export function initGoogleCalendarAuth(loginHint?: string): Promise<GoogleAuthResult> {
  if (USE_BACKEND_GOOGLE_OAUTH) {
    return initBackendGoogleCalendarAuth(loginHint);
  }

  return new Promise((resolve, reject) => {
    if (!GOOGLE_CLIENT_ID) {
      reject(new Error('Google Client ID not configured. Add VITE_GOOGLE_CLIENT_ID to your .env file.'));
      return;
    }

    if (authInProgress) {
      reject(new Error('Google authentication is already in progress.'));
      return;
    }
    authInProgress = true;
    gisRequestInProgress = true;

    pendingResolve = (result) => {
      console.log('[Google Auth] ✓ Promise resolved for', result.email);
      cleanupAuth();
      resolve(result);
    };
    pendingReject = (err) => {
      console.log('[Google Auth] ✗ Promise rejected:', err.message);
      cleanupAuth();
      reject(err);
    };

    const client = getOrCreateTokenClient();
    if (!client) {
      cleanupAuth();
      reject(new Error(
        'Google Identity Services not loaded. Check your internet connection and try again.'
      ));
      return;
    }

    console.log('[Google Auth] Calling GIS requestAccessToken with prompt=consent...');
    const overrides: any = {};
    if (loginHint) overrides.login_hint = loginHint;
    overrides.prompt = 'consent';
    client.requestAccessToken(overrides);
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
export async function ensureGoogleToken(accountEmail?: string, googleAccountId?: string): Promise<boolean> {
  // Fast path: token is already valid
  if (isGoogleCalendarAuthenticated(accountEmail)) return true;

  // If an interactive or another silent auth is already in progress, don't compete
  if (gisRequestInProgress || authInProgress) return false;

  const storedGoogleAccountId = googleAccountId || getGoogleAccountId(accountEmail || undefined);
  if (storedGoogleAccountId) {
    try {
      const refreshed = await FirebaseFunctions.refreshGoogleCalendarAccessToken({
        googleAccountId: storedGoogleAccountId,
      });
      persistAccountToken(refreshed.email, refreshed.accessToken, refreshed.expiresIn);
      persistGoogleAccountId(refreshed.email, refreshed.googleAccountId);
      return true;
    } catch (error) {
      console.warn('[Google Auth] Backend refresh failed, falling back to GIS silent refresh', error);
    }
  }

  // Attempt a silent token refresh — no popup
  if (!GOOGLE_CLIENT_ID) return false;
  const gis = (window as any).google?.accounts?.oauth2;
  if (!gis) return false;

  gisRequestInProgress = true;
  return new Promise<boolean>((resolve) => {
    // 10-second timeout for the silent attempt
    const timeout = setTimeout(() => { gisRequestInProgress = false; resolve(false); }, 10_000);

    try {
      const client = gis.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_CALENDAR_SCOPES,
        callback: async (response: any) => {
          clearTimeout(timeout);
          gisRequestInProgress = false;
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
          gisRequestInProgress = false;
          resolve(false);
        },
      });

      if (!client) {
        clearTimeout(timeout);
        gisRequestInProgress = false;
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
      gisRequestInProgress = false;
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
    } else {
      clearGoogleAccountId(accountEmail);
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
      // Only clear the token if it's older than 60s — a brand-new token
      // getting a 401 is transient (propagation delay); clearing it would
      // prevent retries.
      if (accountEmail && tokenMap[accountEmail]) {
        const age = Date.now() - (tokenMap[accountEmail].expiry - 3600_000);
        if (age > 60_000) {
          clearAccountToken(accountEmail);
        }
      } else if (!accountEmail) {
        clearAllTokens();
      }
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

  const allEvents: GoogleCalendarEvent[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      maxResults: '2500',
      singleEvents: 'true',
      orderBy: 'startTime',
    });

    if (timeMin) {
      params.set('timeMin', timeMin.toISOString());
    }
    if (timeMax) {
      params.set('timeMax', timeMax.toISOString());
    }
    if (pageToken) {
      params.set('pageToken', pageToken);
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

    const data: GoogleCalendarEventsResponse = await response.json();
    allEvents.push(...(data.items || []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allEvents;
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

  // Clean description — strip the internal "HH:mm - HH:mm | text" format
  let cleanDescription = event.description || '';
  if (typeof cleanDescription === 'string' && cleanDescription.includes('|')) {
    const afterPipe = cleanDescription.split('|').slice(1).join('|').trim();
    if (afterPipe) cleanDescription = afterPipe;
  }

  // All-day events use date (YYYY-MM-DD) not dateTime
  const isAllDay = event.isAllDay;

  const result: Partial<GoogleCalendarEvent> = {
    summary: event.title,
    description: cleanDescription,
    location: event.location,
  };

  if (isAllDay) {
    const startDate = dayjs(startISO).format('YYYY-MM-DD');
    // Google all-day end date is exclusive, so add 1 day
    const endDate = dayjs(endISO || startISO).add(1, 'day').format('YYYY-MM-DD');
    result.start = { date: startDate };
    result.end = { date: endDate };
  } else {
    result.start = { dateTime: startISO, timeZone: tz };
    result.end = { dateTime: endISO, timeZone: tz };
  }

  return result;
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

  // Use PATCH instead of PUT so we only update the fields we send,
  // preserving recurrence rules, reminders, color, attendees, etc.
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(googleEvent),
    }
  );

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'unknown error');
    console.error(`[GoogleCalendar] PATCH failed for event ${eventId}:`, response.status, errorText);
    throw new Error(`Failed to update event in Google Calendar: ${response.status}`);
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
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
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
  daysBack: number = GOOGLE_SYNC_DAYS_BACK,
  daysForward: number = GOOGLE_SYNC_DAYS_FORWARD
): Promise<Partial<CalendarEventType>[]> {
  const timeMin = dayjs().subtract(daysBack, 'day').toDate();
  const timeMax = dayjs().add(daysForward, 'day').toDate();

  const googleEvents = await fetchGoogleCalendarEvents(calendarId, timeMin, timeMax);
  
  logger.info('GoogleCalendar', `Imported ${googleEvents.length} events`);
  
  return googleEvents.map(e => googleEventToMalleabite(e, calendarId));
}
