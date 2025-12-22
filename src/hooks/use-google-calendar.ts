// Hook for Google Calendar Sync
import { useState, useCallback, useEffect } from 'react';
import {
  initGoogleCalendarAuth,
  isGoogleCalendarAuthenticated,
  disconnectGoogleCalendar,
  fetchGoogleCalendars,
  importFromGoogleCalendar,
  createGoogleCalendarEvent,
  updateGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
} from '@/lib/google-calendar';
import { CalendarEventType } from '@/lib/stores/types';
import { logger } from '@/lib/logger';

interface GoogleCalendar {
  id: string;
  summary: string;
  primary?: boolean;
}

export function useGoogleCalendar() {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<string>('primary');
  const [error, setError] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  // Check connection status on mount
  useEffect(() => {
    setIsConnected(isGoogleCalendarAuthenticated());
  }, []);

  // Load Google Identity Services script
  useEffect(() => {
    if (!(window as any).google?.accounts) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }, []);

  // Connect to Google Calendar
  const connect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    
    try {
      await initGoogleCalendarAuth();
      setIsConnected(true);
      
      // Fetch available calendars
      const calendarList = await fetchGoogleCalendars();
      setCalendars(calendarList);
      
      // Select primary calendar by default
      const primary = calendarList.find(c => c.primary);
      if (primary) {
        setSelectedCalendar(primary.id);
      }
      
      logger.info('GoogleCalendar', 'Connected successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      setError(message);
      logger.error('GoogleCalendar', 'Connection failed', err as Error);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Disconnect from Google Calendar
  const disconnect = useCallback(() => {
    disconnectGoogleCalendar();
    setIsConnected(false);
    setCalendars([]);
    setSelectedCalendar('primary');
    setLastSyncTime(null);
    logger.info('GoogleCalendar', 'Disconnected');
  }, []);

  // Import events from Google Calendar
  const importEvents = useCallback(async (): Promise<Partial<CalendarEventType>[]> => {
    if (!isConnected) {
      throw new Error('Not connected to Google Calendar');
    }

    setIsSyncing(true);
    setError(null);

    try {
      const events = await importFromGoogleCalendar(selectedCalendar);
      setLastSyncTime(new Date());
      logger.info('GoogleCalendar', `Imported ${events.length} events`);
      return events;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Import failed';
      setError(message);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [isConnected, selectedCalendar]);

  // Export event to Google Calendar
  const exportEvent = useCallback(async (event: CalendarEventType): Promise<string> => {
    if (!isConnected) {
      throw new Error('Not connected to Google Calendar');
    }

    try {
      const googleEvent = await createGoogleCalendarEvent(event, selectedCalendar);
      logger.info('GoogleCalendar', `Exported event: ${event.title}`);
      return googleEvent.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      setError(message);
      throw err;
    }
  }, [isConnected, selectedCalendar]);

  // Sync event (update in Google if exists, create if not)
  const syncEvent = useCallback(async (
    event: CalendarEventType,
    googleEventId?: string
  ): Promise<string> => {
    if (!isConnected) {
      throw new Error('Not connected to Google Calendar');
    }

    try {
      if (googleEventId) {
        await updateGoogleCalendarEvent(googleEventId, event, selectedCalendar);
        return googleEventId;
      } else {
        const googleEvent = await createGoogleCalendarEvent(event, selectedCalendar);
        return googleEvent.id;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      setError(message);
      throw err;
    }
  }, [isConnected, selectedCalendar]);

  // Delete event from Google Calendar
  const deleteEvent = useCallback(async (googleEventId: string): Promise<void> => {
    if (!isConnected) {
      throw new Error('Not connected to Google Calendar');
    }

    try {
      await deleteGoogleCalendarEvent(googleEventId, selectedCalendar);
      logger.info('GoogleCalendar', `Deleted event: ${googleEventId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Delete failed';
      setError(message);
      throw err;
    }
  }, [isConnected, selectedCalendar]);

  return {
    isConnected,
    isConnecting,
    isSyncing,
    calendars,
    selectedCalendar,
    setSelectedCalendar,
    error,
    lastSyncTime,
    connect,
    disconnect,
    importEvents,
    exportEvent,
    syncEvent,
    deleteEvent,
  };
}
