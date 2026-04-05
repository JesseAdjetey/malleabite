// Calendar Sync Hook
// Handles syncing events from connected external calendars (Google, Microsoft, Apple).
// Integrates with existing google-calendar.ts utilities and extends for other providers.

import { useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext.unified';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import {
  CalendarSource,
  ConnectedCalendar,
  SyncedCalendarEvent,
} from '@/types/calendar';
import * as calendarService from '@/lib/services/calendarService';
import {
  initGoogleCalendarAuth,
  fetchGoogleCalendars,
  fetchGoogleCalendarsViaBackend,
  fetchGoogleCalendarEvents,
  isGoogleCalendarAuthenticated,
  ensureGoogleToken,
  disconnectGoogleCalendar,
  GOOGLE_SYNC_DAYS_BACK,
  GOOGLE_SYNC_DAYS_FORWARD,
} from '@/lib/google-calendar';
import dayjs from 'dayjs';

export type SyncStatus = 'idle' | 'authenticating' | 'syncing' | 'success' | 'error';

interface SyncState {
  status: SyncStatus;
  message?: string;
  lastSync?: string;
  progress?: number; // 0-100
}

interface AvailableExternalCalendar {
  id: string;
  name: string;
  color: string;
  primary: boolean;
  source: CalendarSource;
}

interface UseCalendarSyncReturn {
  // State
  syncState: SyncState;
  availableCalendars: AvailableExternalCalendar[];
  lastAuthEmail: string | null;
  lastAuthGoogleAccountId: string | null;

  // Authentication
  authenticateSource: (source: CalendarSource) => Promise<boolean>;
  disconnectSource: (source: CalendarSource) => void;
  isAuthenticated: (source: CalendarSource) => boolean;

  // Discovery
  discoverCalendars: (source: CalendarSource) => Promise<AvailableExternalCalendar[]>;

  // Sync
  syncCalendar: (calendar: ConnectedCalendar) => Promise<number>;
  syncAllActive: (calendars: ConnectedCalendar[]) => Promise<void>;

  // Reset
  resetSyncState: () => void;
}

export function useCalendarSync(): UseCalendarSyncReturn {
  const { user } = useAuth();
  const [syncState, setSyncState] = useState<SyncState>({ status: 'idle' });
  const [availableCalendars, setAvailableCalendars] = useState<AvailableExternalCalendar[]>([]);
  const syncAbortRef = useRef<AbortController | null>(null);
  const lastAuthEmailRef = useRef<string | null>(null);
  const lastAuthGoogleAccountIdRef = useRef<string | null>(null);

  // ─── Authentication ─────────────────────────────────────────────────────

  const authenticateSource = useCallback(async (source: CalendarSource): Promise<boolean> => {
    setSyncState({ status: 'authenticating', message: `Connecting to ${source}...` });

    try {
      switch (source) {
        case 'google': {
          const result = await initGoogleCalendarAuth();
          lastAuthEmailRef.current = result.email;
          lastAuthGoogleAccountIdRef.current = result.googleAccountId || null;
          setSyncState({ status: 'idle' });
          return true;
        }
        case 'microsoft': {
          // Microsoft Graph OAuth - placeholder for future implementation
          // Will use MSAL.js for authentication
          toast.info('Microsoft Calendar integration coming soon');
          setSyncState({ status: 'idle' });
          return false;
        }
        case 'apple': {
          // Apple Calendar - primarily through CalDAV or native Capacitor
          toast.info('Apple Calendar integration coming soon');
          setSyncState({ status: 'idle' });
          return false;
        }
        default:
          setSyncState({ status: 'error', message: `Unknown source: ${source}` });
          return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      logger.error('useCalendarSync', `Auth failed for ${source}`, { error: err });
      setSyncState({ status: 'error', message });
      toast.error(`Failed to connect to ${source}`);
      return false;
    }
  }, []);

  const disconnectSource = useCallback((source: CalendarSource) => {
    switch (source) {
      case 'google':
        disconnectGoogleCalendar();
        break;
      case 'microsoft':
        // TODO: MSAL disconnect
        break;
      case 'apple':
        // TODO: CalDAV disconnect
        break;
    }
    toast.success(`Disconnected from ${source}`);
  }, []);

  const isAuthenticated = useCallback((source: CalendarSource): boolean => {
    switch (source) {
      case 'google':
        return isGoogleCalendarAuthenticated();
      case 'microsoft':
        return false; // TODO
      case 'apple':
        return false; // TODO
      default:
        return false;
    }
  }, []);

  // ─── Calendar Discovery ─────────────────────────────────────────────────

  const discoverCalendars = useCallback(async (
    source: CalendarSource
  ): Promise<AvailableExternalCalendar[]> => {
    try {
      setSyncState({ status: 'syncing', message: 'Discovering calendars...' });

      let discovered: AvailableExternalCalendar[] = [];

      switch (source) {
        case 'google': {
          const discoverGoogleCalendars = async (): Promise<AvailableExternalCalendar[]> => {
            const preferredEmail = lastAuthEmailRef.current || undefined;
            const fetchWithTimeout = async (accountEmail?: string) => {
              return Promise.race([
                fetchGoogleCalendars(accountEmail),
                new Promise<never>((_, reject) => {
                  setTimeout(() => reject(new Error('Loading calendars timed out. Please try again.')), 12_000);
                }),
              ]);
            };

            let lastError: Error | null = null;

            for (let attempt = 1; attempt <= 4; attempt++) {
              try {
                // Give Google a chance to finish propagating the token.
                await ensureGoogleToken(preferredEmail, lastAuthGoogleAccountIdRef.current || undefined);

                const googleCalendars = lastAuthGoogleAccountIdRef.current
                  ? await Promise.race([
                      fetchGoogleCalendarsViaBackend(lastAuthGoogleAccountIdRef.current),
                      new Promise<never>((_, reject) => {
                        setTimeout(() => reject(new Error('Loading calendars timed out. Please try again.')), 12_000);
                      }),
                    ])
                  : await fetchWithTimeout(preferredEmail);
                return googleCalendars.map(gc => ({
                  id: gc.id,
                  name: gc.summary,
                  color: gc.backgroundColor || '#4285F4',
                  primary: gc.primary || false,
                  source: 'google' as CalendarSource,
                }));
              } catch (primaryErr) {
                lastError = primaryErr instanceof Error
                  ? primaryErr
                  : new Error('Failed to load Google calendars');

                // Fallback: if the authenticated email key is stale/missing,
                // try using the first valid token in storage.
                if (preferredEmail) {
                  try {
                    const fallbackCalendars = await fetchWithTimeout(undefined);
                    return fallbackCalendars.map(gc => ({
                      id: gc.id,
                      name: gc.summary,
                      color: gc.backgroundColor || '#4285F4',
                      primary: gc.primary || false,
                      source: 'google' as CalendarSource,
                    }));
                  } catch (fallbackErr) {
                    lastError = fallbackErr instanceof Error
                      ? fallbackErr
                      : lastError;
                  }
                }

                const transient =
                  lastError.message.includes('expired') ||
                  lastError.message.includes('timed out') ||
                  lastError.message.includes('Network error') ||
                  lastError.message.includes('Not authenticated');

                if (!transient || attempt === 4) {
                  throw lastError;
                }

                await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
              }
            }

            throw lastError || new Error('Failed to load Google calendars');
          };

          const googleCalendars = await discoverGoogleCalendars();
          discovered = googleCalendars;
          break;
        }
        case 'microsoft':
          // TODO: Microsoft Graph API calendar list
          break;
        case 'apple':
          // TODO: CalDAV calendar discovery
          break;
      }

      setAvailableCalendars(discovered);
      setSyncState({ status: 'idle' });
      return discovered;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to discover calendars';
      logger.error('useCalendarSync', `Discovery failed for ${source}`, { error: err });
      setSyncState({ status: 'error', message });
      toast.error(message);
      // Re-throw so the caller (e.g. AddCalendarFlow) can show its own
      // error UI instead of silently displaying "No calendars found".
      throw err;
    }
  }, [authenticateSource]);

  // ─── Event Sync ─────────────────────────────────────────────────────────

  const syncCalendar = useCallback(async (
    calendar: ConnectedCalendar
  ): Promise<number> => {
    if (!user?.uid) return 0;

    setSyncState({
      status: 'syncing',
      message: `Syncing ${calendar.name}...`,
      progress: 0,
    });

    try {
      let events: SyncedCalendarEvent[] = [];
      const timeMin = dayjs().subtract(GOOGLE_SYNC_DAYS_BACK, 'day').toDate();
      const timeMax = dayjs().add(GOOGLE_SYNC_DAYS_FORWARD, 'day').toDate();

      switch (calendar.source) {
        case 'google': {
          if (!isGoogleCalendarAuthenticated(calendar.accountEmail)) {
            // Try silent token refresh before giving up
            const refreshed = await ensureGoogleToken(calendar.accountEmail, calendar.googleAccountId);
            if (!refreshed) {
              throw new Error(`Google token expired for ${calendar.accountEmail || 'unknown account'}. Please reconnect.`);
            }
          }

          setSyncState(prev => ({ ...prev, progress: 30 }));

          const googleEvents = await fetchGoogleCalendarEvents(
            calendar.sourceCalendarId || 'primary',
            timeMin,
            timeMax,
            calendar.accountEmail
          );

          setSyncState(prev => ({ ...prev, progress: 70 }));

          events = googleEvents.map(ge => ({
            id: `${calendar.id}_${ge.id}`,
            calendarId: calendar.id,
            externalId: ge.id,
            title: ge.summary || 'Untitled Event',
            description: ge.description || '',
            location: ge.location || '',
            startTime: ge.start.dateTime || ge.start.date || '',
            endTime: ge.end.dateTime || ge.end.date || '',
            isAllDay: !ge.start.dateTime,
            status: 'confirmed' as const,
            source: 'google' as const,
            syncedAt: new Date().toISOString(),
          }));
          break;
        }
        case 'microsoft':
          // TODO: Microsoft Graph events
          break;
        case 'apple':
          // TODO: CalDAV events
          break;
      }

      // Replace cached synced events for this calendar inside the current sync window.
      await calendarService.replaceSyncedEventsForCalendar(user.uid, calendar.id, events);

      // Also clean up locally-created calendar_events whose googleEventId was
      // deleted from Google Calendar — replaceSyncedEventsForCalendar only
      // handles the syncedEvents collection.
      if (calendar.source === 'google') {
        const freshGoogleIds = new Set(events.map((e) => e.externalId).filter(Boolean) as string[]);
        await calendarService.cleanupStaleLocalGoogleEvents(user.uid, calendar.id, freshGoogleIds);
      }

      // Update last sync time on calendar
      await calendarService.updateConnectedCalendar(user.uid, calendar.id, {
        lastSyncAt: new Date().toISOString(),
        lastSyncError: '',
        eventCount: events.length,
      });

      setSyncState({
        status: 'success',
        message: `Synced ${events.length} events from ${calendar.name}`,
        lastSync: new Date().toISOString(),
        progress: 100,
      });

      return events.length;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      logger.error('useCalendarSync', `Sync failed for ${calendar.name}`, { error: err });

      // Save error to calendar
      if (user?.uid) {
        await calendarService.updateConnectedCalendar(user.uid, calendar.id, {
          lastSyncError: message,
        }).catch(() => {});
      }

      setSyncState({ status: 'error', message });
      return 0;
    }
  }, [user?.uid, authenticateSource]);

  const syncAllActive = useCallback(async (
    calendars: ConnectedCalendar[]
  ): Promise<void> => {
    const activeCalendars = calendars.filter(c => c.isActive && c.syncEnabled !== false);
    if (activeCalendars.length === 0) {
      toast.info('No active calendars to sync');
      return;
    }

    let totalEvents = 0;
    let syncedCount = 0;

    for (const calendar of activeCalendars) {
      setSyncState({
        status: 'syncing',
        message: `Syncing ${calendar.name} (${syncedCount + 1}/${activeCalendars.length})`,
        progress: (syncedCount / activeCalendars.length) * 100,
      });

      const count = await syncCalendar(calendar);
      totalEvents += count;
      syncedCount++;
    }

    setSyncState({
      status: 'success',
      message: `Synced ${totalEvents} events from ${syncedCount} calendars`,
      lastSync: new Date().toISOString(),
      progress: 100,
    });

    toast.success(`Synced ${totalEvents} events`);
  }, [syncCalendar]);

  // ─── Reset ──────────────────────────────────────────────────────────────

  const resetSyncState = useCallback(() => {
    setSyncState({ status: 'idle' });
    setAvailableCalendars([]);
    if (syncAbortRef.current) {
      syncAbortRef.current.abort();
      syncAbortRef.current = null;
    }
  }, []);

  return {
    syncState,
    availableCalendars,
    lastAuthEmail: lastAuthEmailRef.current,
    lastAuthGoogleAccountId: lastAuthGoogleAccountIdRef.current,
    authenticateSource,
    disconnectSource,
    isAuthenticated,
    discoverCalendars,
    syncCalendar,
    syncAllActive,
    resetSyncState,
  };
}
