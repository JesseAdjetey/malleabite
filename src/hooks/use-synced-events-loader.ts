// Synced Events Loader Hook
// Subscribes to Firestore `syncedEvents` collection and converts
// SyncedCalendarEvent[] → CalendarEventType[] so they appear in calendar views.

import { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.unified';
import { SyncedCalendarEvent } from '@/types/calendar';
import { CalendarEventType } from '@/lib/stores/types';
import dayjs from 'dayjs';
import { logger } from '@/lib/logger';
import { logCalendarPerf } from '@/lib/perf/calendar-perf';

const SYNCED_EVENTS_DAYS_BACK = 90;
const SYNCED_EVENTS_DAYS_FORWARD = 365;

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
  const syncedEventsMapRef = useRef<Map<string, CalendarEventType>>(new Map());
  const frameRef = useRef<number | null>(null);

  const flushSyncedEvents = () => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }

    frameRef.current = requestAnimationFrame(() => {
      const nextEvents = Array.from(syncedEventsMapRef.current.values()).sort((a, b) =>
        (a.startsAt || '').localeCompare(b.startsAt || '')
      );
      setSyncedEvents(nextEvents);
      setLoading(false);
      frameRef.current = null;
    });
  };

  useEffect(() => {
    if (!user?.uid) {
      syncedEventsMapRef.current.clear();
      setSyncedEvents([]);
      setLoading(false);
      return;
    }

    // Clean up previous listener
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    const syncedRef = collection(db, `users/${user.uid}/syncedEvents`);

    const windowStart = dayjs()
      .subtract(SYNCED_EVENTS_DAYS_BACK, 'day')
      .format('YYYY-MM-DD');
    const windowEnd = `${dayjs()
      .add(SYNCED_EVENTS_DAYS_FORWARD, 'day')
      .format('YYYY-MM-DD')}z`;

    const syncedQuery = query(
      syncedRef,
      where('startTime', '>=', windowStart),
      where('startTime', '<=', windowEnd),
      orderBy('startTime', 'asc')
    );

    const unsubscribe = onSnapshot(
      syncedQuery,
      (snapshot) => {
        const startedAt = performance.now();
        const changes = snapshot.docChanges();
        let added = 0;
        let modified = 0;
        let removed = 0;

        for (const change of changes) {
          const docId = change.doc.id;

          if (change.type === 'added') added += 1;
          if (change.type === 'modified') modified += 1;
          if (change.type === 'removed') removed += 1;

          if (change.type === 'removed') {
            syncedEventsMapRef.current.delete(docId);
            continue;
          }

          const data = change.doc.data() as SyncedCalendarEvent;
          const converted = syncedToCalendarEvent({ ...data, id: docId });

          if (converted.status === 'cancelled') {
            syncedEventsMapRef.current.delete(docId);
            continue;
          }

          syncedEventsMapRef.current.set(docId, converted);
        }

        logger.info('SyncedEventsLoader', `Synced events in memory: ${syncedEventsMapRef.current.size}`);
        logCalendarPerf(
          'synced-events-snapshot',
          'SyncedEventsLoader snapshot processing',
          performance.now() - startedAt,
          {
            docsInSnapshot: snapshot.size,
            docChanges: changes.length,
            added,
            modified,
            removed,
            inMemoryEvents: syncedEventsMapRef.current.size,
          }
        );
        flushSyncedEvents();
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
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user?.uid]);

  return { syncedEvents, loading };
}
