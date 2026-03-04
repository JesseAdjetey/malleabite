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
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
} from '@/lib/google-calendar';
import { ConnectedCalendar } from '@/types/calendar';
import { CalendarEventType } from '@/lib/stores/types';
import { logger } from '@/lib/logger';
import { PERSONAL_CALENDAR_ID } from '@/lib/stores/calendar-filter-store';

// Default poll interval: 60 seconds
const DEFAULT_POLL_INTERVAL_MS = 60_000;

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

      // Attempt to refresh the token if it's expired
      if (!isGoogleCalendarAuthenticated(googleCal.accountEmail)) {
        const ok = await ensureGoogleToken(googleCal.accountEmail);
        if (!ok) {
          logger.warn('GoogleSyncBridge', 'Google token expired and re-auth failed; event not pushed');
          return null;
        }
      }

      try {
        const sourceCalId = googleCal.sourceCalendarId || 'primary';
        const googleEvent = await createGoogleCalendarEvent(event, sourceCalId, googleCal.accountEmail);
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
      if (!googleCal) return false;
      if (!event.googleEventId) return false;

      if (!isGoogleCalendarAuthenticated(googleCal.accountEmail)) {
        const ok = await ensureGoogleToken(googleCal.accountEmail);
        if (!ok) return false;
      }

      try {
        const sourceCalId = googleCal.sourceCalendarId || 'primary';
        await updateGoogleCalendarEvent(event.googleEventId, event, sourceCalId, googleCal.accountEmail);
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
        const ok = await ensureGoogleToken(googleCal.accountEmail);
        if (!ok) return false;
      }

      try {
        const sourceCalId = googleCal.sourceCalendarId || 'primary';
        await deleteGoogleCalendarEvent(event.googleEventId, sourceCalId, googleCal.accountEmail);
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
    if (!user?.uid) return;

    // Get active Google calendars
    const googleCalendars = calendars.filter(
      (c) => c.source === 'google' && c.isActive && c.syncEnabled
    );

    if (googleCalendars.length === 0) return;

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
      for (const cal of googleCalendars) {
        // Skip calendars with no accountEmail — they were created before
        // multi-account support and need to be re-connected.
        if (!cal.accountEmail) {
          logger.warn('GoogleSyncBridge', `Skipping poll for ${cal.name}: no accountEmail set`);
          continue;
        }

        // Check token per-account so multi-account setups work
        if (!isGoogleCalendarAuthenticated(cal.accountEmail)) {
          const ok = await ensureGoogleToken(cal.accountEmail);
          if (!ok) continue; // skip this calendar, try the rest
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
  }, [user?.uid, calendars, syncCalendar]);

  return {
    pushCreateToGoogle,
    pushUpdateToGoogle,
    pushDeleteToGoogle,
    getGoogleCalendar,
  };
}
