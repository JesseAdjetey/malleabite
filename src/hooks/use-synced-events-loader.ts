// Synced Events Loader Hook
// Subscribes to Firestore `syncedEvents` collection and converts
// SyncedCalendarEvent[] → CalendarEventType[] so they appear in calendar views.

import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.unified';
import { SyncedCalendarEvent } from '@/types/calendar';
import { CalendarEventType } from '@/lib/stores/types';
import dayjs from 'dayjs';
import { logger } from '@/lib/logger';

/**
 * Convert a SyncedCalendarEvent (from external source) into a CalendarEventType
 * so it can be displayed alongside user-created events.
 */
function syncedToCalendarEvent(synced: SyncedCalendarEvent): CalendarEventType {
  const start = dayjs(synced.startTime);
  const end = dayjs(synced.endTime);

  return {
    id: `synced_${synced.id}`,
    title: synced.title,
    description: synced.description || '',
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    date: start.format('YYYY-MM-DD'),
    timeStart: start.format('HH:mm'),
    timeEnd: end.format('HH:mm'),
    color: synced.color || '#4285F4', // Default Google blue
    isAllDay: synced.isAllDay,
    location: synced.location,
    meetingUrl: synced.meetingUrl,
    status: synced.status,
    calendarId: synced.calendarId,
    source: synced.source === 'google' ? 'google' : 'malleabite',
    googleEventId: synced.source === 'google' ? synced.externalId : undefined,
    isLocked: true, // Synced events are read-only in the local calendar
    attendees: synced.attendees?.map(a => ({
      email: a.email,
      displayName: a.name,
      responseStatus: a.status,
    })),
    // Map recurring info if present
    isRecurring: !!synced.recurring,
    recurrenceRule: synced.recurring
      ? {
          frequency: synced.recurring.frequency,
          interval: 1,
          endDate: synced.recurring.endDate,
        }
      : undefined,
  };
}

/**
 * Hook that subscribes to synced events from Firestore and returns them
 * as CalendarEventType[] ready for the event store.
 */
export function useSyncedEventsLoader(): {
  syncedEvents: CalendarEventType[];
  loading: boolean;
} {
  const [syncedEvents, setSyncedEvents] = useState<CalendarEventType[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setSyncedEvents([]);
      setLoading(false);
      return;
    }

    // Clean up previous listener
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    const syncedRef = collection(db, `users/${user.uid}/syncedEvents`);

    const unsubscribe = onSnapshot(
      syncedRef,
      (snapshot) => {
        console.log(`[SyncedEventsLoader] Firestore snapshot: ${snapshot.docs.length} docs`);
        const events = snapshot.docs
          .map((doc) => {
            const data = doc.data() as SyncedCalendarEvent;
            return syncedToCalendarEvent({ ...data, id: doc.id });
          })
          .filter((e) => e.status !== 'cancelled'); // Skip cancelled events

        logger.info(
          'SyncedEventsLoader',
          `Loaded ${events.length} synced events from Firestore`
        );
        if (events.length > 0) {
          console.log('[SyncedEventsLoader] Sample event:', {
            id: events[0].id,
            title: events[0].title,
            date: events[0].date,
            calendarId: events[0].calendarId,
          });
        }
        setSyncedEvents(events);
        setLoading(false);
      },
      (error) => {
        logger.error('SyncedEventsLoader', 'Failed to load synced events', {
          error,
        });
        setLoading(false);
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user?.uid]);

  return { syncedEvents, loading };
}
