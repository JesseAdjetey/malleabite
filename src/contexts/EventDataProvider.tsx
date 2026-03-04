
import React, { useEffect, useMemo } from 'react';
import { useCalendarEvents } from '@/hooks/use-calendar-events.unified';
import { useSyncedEventsLoader } from '@/hooks/use-synced-events-loader';
import { useTemplateEventsLoader } from '@/hooks/use-template-events-loader';
import { GoogleSyncBridgeProvider } from '@/contexts/GoogleSyncBridgeContext';
import { useEventStore } from '@/lib/store';
import { useAuth } from '@/contexts/AuthContext.unified';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { errorHandler } from '@/lib/error-handler';
import { PERSONAL_CALENDAR_ID } from '@/lib/stores/calendar-filter-store';

interface EventDataProviderProps {
  children: React.ReactNode;
}

const EventDataProvider: React.FC<EventDataProviderProps> = ({ children }) => {
  const calendarHook = useCalendarEvents();
  const { events, loading, error, addEvent, updateEvent } = calendarHook;
  // Handle different function names between Firebase (deleteEvent) and Supabase (removeEvent)
  const deleteEvent = 'deleteEvent' in calendarHook ? calendarHook.deleteEvent : calendarHook.removeEvent;
  const { syncedEvents, loading: syncedLoading } = useSyncedEventsLoader();
  const { templateEvents, loading: templateLoading } = useTemplateEventsLoader();
  const { setEvents, setIsInitialized, isInitialized } = useEventStore();
  const { user } = useAuth();

  // Merge user-created events with synced external events and template events
  const mergedEvents = useMemo(() => {
    // Filter out any synced events whose IDs already exist in own events
    // (prevents duplicates if an event was both created locally and synced)
    const ownIds = new Set(events.map(e => e.id));

    // Build a set of googleEventIds from local events so we can deduplicate
    // synced events that were originally pushed from this app to Google.
    // Without this, a locally-created Google event gets fetched back by the
    // poll sync and appears as a second copy in the syncedEvents collection.
    const ownGoogleEventIds = new Set(
      events
        .map(e => e.googleEventId)
        .filter((gid): gid is string => !!gid)
    );

    const uniqueSynced = syncedEvents.filter(se => {
      if (ownIds.has(se.id)) return false;
      // Deduplicate by googleEventId — if a local event already owns this
      // Google event, skip the synced copy.
      if (se.googleEventId && ownGoogleEventIds.has(se.googleEventId)) return false;
      return true;
    });
    const uniqueTemplate = templateEvents.filter(te => !ownIds.has(te.id));
    // Ensure every event has a calendarId (assign Personal if missing)
    const ensureCalendarId = (e: typeof events[number]) => 
      e.calendarId ? e : { ...e, calendarId: PERSONAL_CALENDAR_ID };
    const merged = [
      ...events.map(ensureCalendarId),
      ...uniqueSynced.map(ensureCalendarId),
      ...uniqueTemplate, // Template events already have calendarId = template_xxx
    ];
    const dedupedSyncCount = syncedEvents.length - uniqueSynced.length;
    if (uniqueSynced.length > 0 || uniqueTemplate.length > 0 || dedupedSyncCount > 0) {
      console.log(`[EventDataProvider] Merging ${events.length} own + ${uniqueSynced.length} synced + ${uniqueTemplate.length} template = ${merged.length} total (${dedupedSyncCount} synced events deduped by googleEventId)`);
    }
    return merged;
  }, [events, syncedEvents, templateEvents]);

  // Update the store when events change (own + synced)
  useEffect(() => {
    if (!loading && !error) {
      setEvents(mergedEvents);
      if (!isInitialized) {
        setIsInitialized(true);
      }
    }
  }, [mergedEvents, loading, error, setEvents, setIsInitialized, isInitialized]);

  // When user logs out, clear events
  useEffect(() => {
    if (!user && isInitialized) {
      setEvents([]);
    }
  }, [user, isInitialized, setEvents]);

  // Handle any errors from the calendar events hook
  useEffect(() => {
    if (error) {
      logger.error('EventDataProvider', 'Calendar events error', new Error(error));
      errorHandler.handleError(
        new Error(error),
        'Error loading calendar events',
        'EventDataProvider'
      );
    }
  }, [error]);

  return (
    <GoogleSyncBridgeProvider>
      {children}
    </GoogleSyncBridgeProvider>
  );
};

export default EventDataProvider;
