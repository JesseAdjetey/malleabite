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
  fetchGoogleCalendarEvents,
  isGoogleCalendarAuthenticated,
  disconnectGoogleCalendar,
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

  // ─── Authentication ─────────────────────────────────────────────────────

  const authenticateSource = useCallback(async (source: CalendarSource): Promise<boolean> => {
    setSyncState({ status: 'authenticating', message: `Connecting to ${source}...` });

    try {
      switch (source) {
        case 'google': {
          const result = await initGoogleCalendarAuth();
          lastAuthEmailRef.current = result.email;
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
          // We just authenticated — go straight to fetching calendars.
          // If the token expired between auth and now, fetchGoogleCalendars
          // will throw and we'll show the error UI.
          const googleCalendars = await fetchGoogleCalendars(lastAuthEmailRef.current || undefined);
          discovered = googleCalendars.map(gc => ({
            id: gc.id,
            name: gc.summary,
            color: gc.backgroundColor || '#4285F4',
            primary: gc.primary || false,
            source: 'google' as CalendarSource,
          }));
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
      const timeMin = dayjs().subtract(30, 'day').toDate();
      const timeMax = dayjs().add(90, 'day').toDate();

      switch (calendar.source) {
        case 'google': {
          if (!isGoogleCalendarAuthenticated(calendar.accountEmail)) {
            throw new Error(`Google token expired for ${calendar.accountEmail || 'unknown account'}. Please re-connect.`);
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

      // Save to Firestore
      if (events.length > 0) {
        await calendarService.upsertSyncedEvents(user.uid, events);
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
    const activeCalendars = calendars.filter(c => c.isActive && c.syncEnabled);
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
    authenticateSource,
    disconnectSource,
    isAuthenticated,
    discoverCalendars,
    syncCalendar,
    syncAllActive,
    resetSyncState,
  };
}
