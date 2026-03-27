// Google Calendar Sync Bridge
// Provides functions to push local event changes to Google Calendar
// and periodically poll for updates from Google.
//
// Write-back: when a user creates/updates/deletes events on a Google-connected
// calendar, we push those changes to the Google Calendar API.
//
// Polling: every syncInterval minutes we re-fetch events from Google and upsert
// them into the local syncedEvents collection.

import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext.unified';
import { useCalendarGroups } from '@/hooks/use-calendar-groups';
import { useCalendarSync } from '@/hooks/use-calendar-sync';
import {
  isGoogleCalendarAuthenticated,
  ensureGoogleToken,
  initGoogleCalendarAuth,
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
} from '@/lib/google-calendar';
import { ConnectedCalendar } from '@/types/calendar';
import { CalendarEventType } from '@/lib/stores/types';
import { logger } from '@/lib/logger';
import { PERSONAL_CALENDAR_ID } from '@/lib/stores/calendar-filter-store';
import { useSyncStatusStore } from '@/lib/stores/sync-status-store';
import { toast } from 'sonner';

// Default poll interval: 60 seconds
const DEFAULT_POLL_INTERVAL_MS = 60_000;
const GOOGLE_WRITE_RETRY_DELAYS_MS = [800, 1600];

// Throttle token-expired toasts: max once per 5 minutes per account email
const _lastExpiredToast: Record<string, number> = {};
const EXPIRED_TOAST_THROTTLE_MS = 5 * 60 * 1000;

function showTokenExpiredToast(accountEmail: string) {
  const now = Date.now();
  if (_lastExpiredToast[accountEmail] && now - _lastExpiredToast[accountEmail] < EXPIRED_TOAST_THROTTLE_MS) {
    return; // Throttled — don't spam
  }
  _lastExpiredToast[accountEmail] = now;
  toast.warning(`Google sync paused for ${accountEmail}`, {
    description: 'Token expired. Open Calendar dropdown to reconnect.',
    duration: 8000,
  });
}

function isTransientGoogleWriteError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return [
    'failed to fetch',
    'network',
    'load failed',
    'timeout',
    'timed out',
    'http 500',
    'http 502',
    'http 503',
    'http 504',
    'status 500',
    'status 502',
    'status 503',
    'status 504',
    'quota exceeded',
    'rate limit',
  ].some(fragment => message.includes(fragment));
}

async function retryGoogleWrite<T>(
  operation: 'create' | 'update' | 'delete',
  execute: () => Promise<T>
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= GOOGLE_WRITE_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await execute();
    } catch (error) {
      lastError = error;
      if (attempt === GOOGLE_WRITE_RETRY_DELAYS_MS.length || !isTransientGoogleWriteError(error)) {
        throw error;
      }

      const delayMs = GOOGLE_WRITE_RETRY_DELAYS_MS[attempt];
      logger.warn('GoogleSyncBridge', `Transient Google ${operation} failure, retrying in ${delayMs}ms`, { error });
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Google ${operation} failed`);
}

/**
 * Hook that sets up the two-way Google Calendar sync bridge.
 *
 * Mount once at a high level (e.g., inside EventDataProvider or MainView).
 *
 * Returns helper functions for write-back operations.
 */
export function useGoogleSyncBridge() {
  const { user } = useAuth();
  const { calendars } = useCalendarGroups();
  const { syncCalendar } = useCalendarSync();
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep a stable ref to calendars so the polling effect doesn't restart
  // every time a Firestore update (e.g. lastSyncAt change) triggers a new
  // calendars array.  The poll function reads from the ref instead.
  const calendarsRef = useRef(calendars);
  calendarsRef.current = calendars;

  // Derived flag: true once at least one active, sync-enabled Google calendar exists.
  // Adding this as a dep ensures the polling effect re-fires after Firestore first
  // loads the connected calendars (Firestore is async, so `calendars` starts empty
  // at mount — without this dep, the poll timer never starts).
  const hasGoogleCalendars = calendars.some(
    (c) => c.source === 'google' && c.isActive && c.syncEnabled
  );

  // ─── Reconnect ──────────────────────────────────────────────────────────

  /**
   * Reconnect a Google account whose token has expired.
   * Opens the Google sign-in popup, refreshes the token, then auto-syncs.
   */
  const reconnectAccount = useCallback(
    async (accountEmail: string): Promise<boolean> => {
      try {
        const result = await initGoogleCalendarAuth();
        // The user may pick the same or a different account in the popup.
        // Clear expired state for the email they originally had AND the
        // email that was just authenticated.
        useSyncStatusStore.getState().clearExpired(accountEmail);
        useSyncStatusStore.getState().clearExpired(result.email);

        // Auto-sync all Google calendars for that account
        const matchingCals = calendarsRef.current.filter(
          (c) => c.source === 'google' && c.accountEmail === accountEmail && c.isActive
        );
        for (const cal of matchingCals) {
          try {
            await syncCalendar(cal);
          } catch { /* non-blocking */ }
        }

        toast.success(`Reconnected ${accountEmail}`);
        return true;
      } catch (err) {
        logger.error('GoogleSyncBridge', 'Reconnect failed', { error: err });
        toast.error('Failed to reconnect. Please try again.');
        return false;
      }
    },
    [syncCalendar]
  );

  // ─── Helpers ────────────────────────────────────────────────────────────

  /**
   * Find the ConnectedCalendar entry for a given calendarId.
   * Returns null if the calendarId doesn't point to a Google calendar.
   */
  const getGoogleCalendar = useCallback(
    (calendarId: string | undefined): ConnectedCalendar | null => {
      if (!calendarId || calendarId === PERSONAL_CALENDAR_ID) return null;
      const cal = calendars.find((c) => c.id === calendarId);
      if (!cal || cal.source !== 'google') return null;
      return cal;
    },
    [calendars]
  );

  // ─── Write-back Operations ──────────────────────────────────────────────

  /**
   * Push a newly created event to Google Calendar.
   * Call this AFTER the event has been saved to Firestore.
   * Returns the Google event ID (for storing in `googleEventId`).
   */
  const pushCreateToGoogle = useCallback(
    async (event: CalendarEventType): Promise<string | null> => {
      const googleCal = getGoogleCalendar(event.calendarId);
      if (!googleCal) return null;

      // Try silent token refresh (no popup) if expired
      if (!isGoogleCalendarAuthenticated(googleCal.accountEmail)) {
        const ok = await ensureGoogleToken(googleCal.accountEmail, googleCal.googleAccountId);
        if (!ok) {
          logger.warn('GoogleSyncBridge', `Token expired for ${googleCal.accountEmail}; event not pushed.`);
          useSyncStatusStore.getState().markExpired(googleCal.accountEmail);
          showTokenExpiredToast(googleCal.accountEmail);
          return null;
        }
      }

      try {
        const sourceCalId = googleCal.sourceCalendarId || 'primary';
        const googleEvent = await retryGoogleWrite(
          'create',
          () => createGoogleCalendarEvent(event, sourceCalId, googleCal.accountEmail)
        );
        logger.info('GoogleSyncBridge', `Pushed create → Google: ${googleEvent.id}`);
        return googleEvent.id;
      } catch (err) {
        logger.error('GoogleSyncBridge', 'Failed to push create to Google', { error: err });
        return null;
      }
    },
    [getGoogleCalendar]
  );

  /**
   * Push an updated event to Google Calendar.
   */
  const pushUpdateToGoogle = useCallback(
    async (event: CalendarEventType): Promise<boolean> => {
      const googleCal = getGoogleCalendar(event.calendarId);
      console.log('[GoogleSyncBridge] pushUpdateToGoogle:', {
        calendarId: event.calendarId,
        googleEventId: event.googleEventId,
        foundGoogleCal: !!googleCal,
        googleCalSource: googleCal?.source,
        googleCalEmail: googleCal?.accountEmail,
        sourceCalendarId: googleCal?.sourceCalendarId,
      });
      if (!googleCal) {
        console.warn('[GoogleSyncBridge] No matching Google calendar found for calendarId:', event.calendarId);
        return false;
      }
      if (!event.googleEventId) {
        console.warn('[GoogleSyncBridge] No googleEventId on event');
        return false;
      }

      if (!isGoogleCalendarAuthenticated(googleCal.accountEmail)) {
        const ok = await ensureGoogleToken(googleCal.accountEmail, googleCal.googleAccountId);
        if (!ok) {
          logger.warn('GoogleSyncBridge', `Token expired for ${googleCal.accountEmail}; update not pushed.`);
          useSyncStatusStore.getState().markExpired(googleCal.accountEmail);
          showTokenExpiredToast(googleCal.accountEmail);
          return false;
        }
      }

      try {
        const sourceCalId = googleCal.sourceCalendarId || 'primary';
        await retryGoogleWrite(
          'update',
          () => updateGoogleCalendarEvent(event.googleEventId, event, sourceCalId, googleCal.accountEmail)
        );
        logger.info('GoogleSyncBridge', `Pushed update → Google: ${event.googleEventId}`);
        return true;
      } catch (err) {
        logger.error('GoogleSyncBridge', 'Failed to push update to Google', { error: err });
        return false;
      }
    },
    [getGoogleCalendar]
  );

  /**
   * Push a delete to Google Calendar.
   */
  const pushDeleteToGoogle = useCallback(
    async (event: CalendarEventType): Promise<boolean> => {
      const googleCal = getGoogleCalendar(event.calendarId);
      if (!googleCal) return false;
      if (!event.googleEventId) return false;

      if (!isGoogleCalendarAuthenticated(googleCal.accountEmail)) {
        const ok = await ensureGoogleToken(googleCal.accountEmail, googleCal.googleAccountId);
        if (!ok) {
          logger.warn('GoogleSyncBridge', `Token expired for ${googleCal.accountEmail}; delete not pushed.`);
          useSyncStatusStore.getState().markExpired(googleCal.accountEmail);
          showTokenExpiredToast(googleCal.accountEmail);
          return false;
        }
      }

      try {
        const sourceCalId = googleCal.sourceCalendarId || 'primary';
        await retryGoogleWrite(
          'delete',
          () => deleteGoogleCalendarEvent(event.googleEventId, sourceCalId, googleCal.accountEmail)
        );
        logger.info('GoogleSyncBridge', `Pushed delete → Google: ${event.googleEventId}`);
        return true;
      } catch (err) {
        logger.error('GoogleSyncBridge', 'Failed to push delete to Google', { error: err });
        return false;
      }
    },
    [getGoogleCalendar]
  );

  // ─── Polling (Google → Malleabite) ─────────────────────────────────────

  useEffect(() => {
    // hasGoogleCalendars gates this effect so it re-fires once Firestore
    // finishes loading (calendars is always [] on mount due to async fetch).
    if (!user?.uid || !hasGoogleCalendars) return;

    // Read from the ref so this effect doesn't restart on every Firestore write
    // (e.g. lastSyncAt timestamp updates).  The poll function reads the ref each tick.
    const getGoogleCalendars = () =>
      calendarsRef.current.filter(
        (c) => c.source === 'google' && c.isActive && c.syncEnabled
      );

    const googleCalendars = getGoogleCalendars();

    // Use the shortest sync interval among all active Google calendars
    const minIntervalMinutes = Math.max(
      1,
      Math.min(...googleCalendars.map((c) => c.syncInterval || 15))
    );
    const intervalMs = minIntervalMinutes * 60_000;

    // Don't poll faster than 60s
    const safeInterval = Math.max(DEFAULT_POLL_INTERVAL_MS, intervalMs);

    logger.info(
      'GoogleSyncBridge',
      `Starting poll timer: every ${safeInterval / 1000}s for ${googleCalendars.length} calendars`
    );

    const poll = async () => {
      // Re-read from the ref each poll so we pick up newly added/removed calendars
      const currentGoogleCals = getGoogleCalendars();
      for (const cal of currentGoogleCals) {
        // Skip calendars with no accountEmail — they were created before
        // multi-account support and need to be re-connected.
        if (!cal.accountEmail) {
          logger.warn('GoogleSyncBridge', `Skipping poll for ${cal.name}: no accountEmail set`);
          continue;
        }

        // Check token per-account so multi-account setups work.
        // Try silent refresh if expired (no popup).
        if (!isGoogleCalendarAuthenticated(cal.accountEmail)) {
          const ok = await ensureGoogleToken(cal.accountEmail, cal.googleAccountId);
          if (!ok) {
            logger.warn('GoogleSyncBridge', `Token expired for ${cal.accountEmail}. Marking for reconnect.`);
            useSyncStatusStore.getState().markExpired(cal.accountEmail);
            showTokenExpiredToast(cal.accountEmail);
            continue;
          } else {
            // Silent refresh succeeded — clear any stale expired flag
            useSyncStatusStore.getState().clearExpired(cal.accountEmail);
          }
        }

        try {
          await syncCalendar(cal);
        } catch (err) {
          logger.error('GoogleSyncBridge', `Poll sync failed for ${cal.name}`, {
            error: err,
          });
        }
      }
    };

    // Initial sync on mount
    poll();

    // Set interval
    pollTimerRef.current = setInterval(poll, safeInterval);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
    // Restart when user or hasGoogleCalendars changes (false→true on first Firestore load).
    // Individual calendar field updates (e.g. lastSyncAt) don't flip hasGoogleCalendars,
    // so the interval is NOT restarted on every sync write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, syncCalendar, hasGoogleCalendars]);

  return {
    pushCreateToGoogle,
    pushUpdateToGoogle,
    pushDeleteToGoogle,
    getGoogleCalendar,
    reconnectAccount,
  };
}
