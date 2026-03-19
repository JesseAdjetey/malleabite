// Hook that wraps event CRUD (create / update / delete) and transparently
// pushes changes to Google Calendar when the target calendar is a Google one.
//
// Usage: replace direct addEvent/updateEvent/removeEvent calls with the
// wrappers returned by this hook.

import { useCallback } from 'react';
import { doc, updateDoc, deleteDoc, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { useGoogleSyncBridgeContext } from '@/contexts/GoogleSyncBridgeContext';
import { CalendarEventType } from '@/lib/stores/types';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.unified';
import {
  deleteGoogleCalendarEvent,
  isGoogleCalendarAuthenticated,
  ensureGoogleToken,
} from '@/lib/google-calendar';

/**
 * Minimal write of just googleEventId back to Firestore.
 * Avoids going through the full updateEvent (which shows toasts, runs validation,
 * and is more likely to fail on a secondary write).
 */
async function writeGoogleEventId(docId: string, googleEventId: string): Promise<void> {
  await updateDoc(doc(db, 'calendar_events', docId), { googleEventId });
}

/**
 * Returns wrapped versions of addEvent / updateEvent / removeEvent that
 * automatically push to Google Calendar when appropriate.
 */
export function useEventCRUD() {
  const { user } = useAuth();
  const { addEvent, updateEvent, removeEvent, deleteEvent, events, ...rest } = useCalendarEvents() as any;
  const bridge = useGoogleSyncBridgeContext();

  // The actual delete function may be named differently between implementations
  const doDelete = deleteEvent || removeEvent;

  const addEventWithSync = useCallback(
    async (event: CalendarEventType) => {
      const response = await addEvent(event);

      // If save succeeded and the event targets a Google calendar, push to Google
      if (response.success && bridge) {
        const firestoreId = response.data?.id;
        const eventWithId: CalendarEventType = {
          ...event,
          id: firestoreId || event.id,
        };

        try {
          const googleEventId = await bridge.pushCreateToGoogle(eventWithId);
          if (googleEventId && firestoreId) {
            try {
              await writeGoogleEventId(firestoreId, googleEventId);
              logger.info('useEventCRUD', `Synced new event to Google: ${googleEventId}`);
            } catch (writeErr) {
              logger.error('useEventCRUD', 'Failed to store googleEventId in Firestore', { error: writeErr });
            }
          } else if (!googleEventId) {
            toast.warning('Event saved locally but could not sync to Google Calendar. Check your Google account connection.');
          }
        } catch (err) {
          logger.error('useEventCRUD', 'Google write-back failed for new event', { error: err });
          toast.error('Failed to sync event to Google Calendar');
        }
      }

      return response;
    },
    [addEvent, bridge]
  );

  const updateEventWithSync = useCallback(
    async (event: CalendarEventType) => {
      // Synced events (Google Calendar events) live in users/{uid}/syncedEvents,
      // not in calendar_events — so they need their own update path.
      if (event.id?.startsWith('synced_') && user?.uid) {
        const docId = event.id.replace('synced_', '');

        try {
          // Write new times back to the syncedEvents Firestore doc.
          // The snapshot listener will immediately reflect the change in the UI.
          await updateDoc(doc(db, `users/${user.uid}/syncedEvents`, docId), {
            startTime: event.startsAt,
            endTime: event.endsAt,
          });
        } catch (err) {
          logger.error('useEventCRUD', 'Failed to update synced event in Firestore', { error: err });
          toast.error('Failed to save changes');
          return { success: false };
        }

        // Push the new times to Google Calendar
        if (bridge && event.googleEventId) {
          try {
            const pushed = await bridge.pushUpdateToGoogle(event);
            if (!pushed) {
              toast.warning('Changes saved locally but could not sync to Google Calendar.');
            }
          } catch (err) {
            logger.error('useEventCRUD', 'Google update failed for synced event', { error: err });
            toast.warning('Changes saved locally but could not sync to Google Calendar.');
          }
        }

        return { success: true };
      }

      // Standard (Malleabite-created) event update
      const response = await updateEvent(event);

      if (response.success && bridge) {
        try {
          if (event.googleEventId) {
            const synced = await bridge.pushUpdateToGoogle(event);
            if (!synced) {
              toast.warning('Changes saved locally but could not sync to Google Calendar.');
            }
          } else {
            const googleEventId = await bridge.pushCreateToGoogle(event);
            if (googleEventId) {
              try {
                await writeGoogleEventId(event.id, googleEventId);
              } catch (writeErr) {
                logger.error('useEventCRUD', 'Failed to store googleEventId after update', { error: writeErr });
              }
            } else {
              toast.warning('Changes saved locally but could not sync to Google Calendar.');
            }
          }
        } catch (err) {
          logger.error('useEventCRUD', 'Google write-back failed for update', { error: err });
          toast.warning('Changes saved locally but could not sync to Google Calendar.');
        }
      }

      return response;
    },
    [updateEvent, bridge, user?.uid]
  );

  const deleteEventWithSync = useCallback(
    async (eventOrId: string | CalendarEventType) => {
      const eventId = typeof eventOrId === 'string' ? eventOrId : eventOrId.id;

      // Handle synced events (Google-created, stored in users/{uid}/syncedEvents, not calendar_events)
      if (eventId?.startsWith('synced_') && user?.uid) {
        const event = typeof eventOrId !== 'string'
          ? eventOrId
          : (events as CalendarEventType[] | undefined)?.find(e => e.id === eventId);
        const docId = eventId.replace('synced_', '');

        // Push delete to Google Calendar (instance only)
        if (event && bridge) {
          try {
            await bridge.pushDeleteToGoogle(event);
          } catch (err) {
            logger.error('useEventCRUD', 'Google delete failed for synced event', { error: err });
          }
        }

        // Remove the local cached copy from syncedEvents collection
        try {
          await deleteDoc(doc(db, `users/${user.uid}/syncedEvents`, docId));
          toast.success('Event removed');
        } catch (err) {
          logger.error('useEventCRUD', 'Failed to delete synced event', { error: err });
          toast.error('Failed to remove event');
        }
        return;
      }

      // If we got an event object (non-synced), try to push delete to Google first
      if (typeof eventOrId !== 'string' && bridge) {
        try {
          const deleted = await bridge.pushDeleteToGoogle(eventOrId);
          if (!deleted && eventOrId.googleEventId) {
            toast.warning('Event removed locally but could not be removed from Google Calendar.');
          }
        } catch (err) {
          logger.error('useEventCRUD', 'Google delete failed', { error: err });
          toast.warning('Event removed locally but could not be removed from Google Calendar.');
        }
      }

      const id = typeof eventOrId === 'string' ? eventOrId : eventOrId.id;
      return doDelete(id);
    },
    [doDelete, bridge, user?.uid, events]
  );

  /**
   * Delete a synced (Google-created) event with scope awareness.
   * - 'single': removes just this occurrence from Google + local cache
   * - 'all' / 'thisAndFuture': removes the entire series from Google + local cache
   *   (the remaining synced instances for that series will be cleared on the next poll)
   */
  const deleteSyncedGoogleEvent = useCallback(
    async (event: CalendarEventType, scope: 'single' | 'all' | 'thisAndFuture'): Promise<void> => {
      if (!event.id.startsWith('synced_') || !user?.uid) return;

      const docId = event.id.replace('synced_', '');
      const googleCal = bridge?.getGoogleCalendar(event.calendarId);

      if (scope === 'single') {
        // Delete just this instance via the bridge (handles token refresh + auth)
        if (bridge) {
          try {
            await bridge.pushDeleteToGoogle(event);
          } catch (err) {
            logger.error('useEventCRUD', 'Google instance delete failed', { error: err });
          }
        }
      } else {
        // 'all' or 'thisAndFuture': delete the entire series using the series ID
        const seriesId = event.googleSeriesId;

        if (seriesId && googleCal) {
          // Ensure token is valid before calling the API directly
          if (!isGoogleCalendarAuthenticated(googleCal.accountEmail)) {
            await ensureGoogleToken(googleCal.accountEmail, googleCal.googleAccountId);
          }
          try {
            await deleteGoogleCalendarEvent(
              seriesId,
              googleCal.sourceCalendarId || 'primary',
              googleCal.accountEmail
            );
            logger.info('useEventCRUD', `Deleted Google series: ${seriesId}`);
          } catch (err) {
            logger.error('useEventCRUD', 'Google series delete failed', { error: err });
          }
        } else {
          // Fallback (no series ID stored yet — older synced events): delete the instance
          if (bridge) {
            try {
              await bridge.pushDeleteToGoogle(event);
            } catch (err) {
              logger.error('useEventCRUD', 'Google fallback delete failed', { error: err });
            }
          }
        }
      }

      // Remove local syncedEvents documents
      try {
        if (scope === 'single') {
          // Just delete the one clicked instance
          await deleteDoc(doc(db, `users/${user.uid}/syncedEvents`, docId));
          toast.success('Occurrence removed');
        } else {
          // 'all' / 'thisAndFuture': delete ALL instances of this series from Firestore.
          // Query by calendarId (single-field, auto-indexed) then filter client-side
          // by googleSeriesId or by externalId prefix (covers older docs without googleSeriesId).
          const seriesId = event.googleSeriesId;
          const syncedRef = collection(db, `users/${user.uid}/syncedEvents`);
          const snap = await getDocs(
            query(syncedRef, where('calendarId', '==', event.calendarId))
          );

          const batch = writeBatch(db);
          let count = 0;
          for (const d of snap.docs) {
            const data = d.data();
            const matchesSeries =
              (seriesId && data.googleSeriesId === seriesId) ||
              (seriesId && data.externalId?.startsWith(seriesId));
            // Also always delete the specific doc the user clicked
            if (matchesSeries || d.id === docId) {
              batch.delete(d.ref);
              count++;
            }
          }
          await batch.commit();
          toast.success(`All ${count} occurrence${count !== 1 ? 's' : ''} removed`);
        }
      } catch (err) {
        logger.error('useEventCRUD', 'Failed to delete synced event doc(s)', { error: err });
        toast.error('Failed to remove event');
      }
    },
    [bridge, user?.uid]
  );

  return {
    ...rest,
    addEvent: addEventWithSync,
    updateEvent: updateEventWithSync,
    removeEvent: deleteEventWithSync,
    deleteEvent: deleteEventWithSync,
    deleteSyncedGoogleEvent,
  };
}
