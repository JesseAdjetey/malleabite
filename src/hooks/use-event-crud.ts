// Hook that wraps event CRUD (create / update / delete) and transparently
// pushes changes to Google Calendar when the target calendar is a Google one.
//
// Usage: replace direct addEvent/updateEvent/removeEvent calls with the
// wrappers returned by this hook.

import { useCallback } from 'react';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { useGoogleSyncBridgeContext } from '@/contexts/GoogleSyncBridgeContext';
import { CalendarEventType } from '@/lib/stores/types';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

/**
 * Returns wrapped versions of addEvent / updateEvent / removeEvent that
 * automatically push to Google Calendar when appropriate.
 */
export function useEventCRUD() {
  const { addEvent, updateEvent, removeEvent, deleteEvent, ...rest } = useCalendarEvents() as any;
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
            // Store the Google event ID back on the Firestore document so future
            // updates/deletes can target the right Google event.
            await updateEvent({ ...eventWithId, googleEventId });
            logger.info('useEventCRUD', `Synced new event to Google: ${googleEventId}`);
          } else if (!googleEventId) {
            toast.warning('Event saved locally but could not sync to Google Calendar. Check your Google account connection.');
          }
        } catch (err) {
          // Non-blocking — local save already succeeded
          logger.error('useEventCRUD', 'Google write-back failed for new event', { error: err });
          toast.error('Failed to sync event to Google Calendar');
        }
      }

      return response;
    },
    [addEvent, updateEvent, bridge]
  );

  const updateEventWithSync = useCallback(
    async (event: CalendarEventType) => {
      const response = await updateEvent(event);

      if (bridge) {
        try {
          if (event.googleEventId) {
            await bridge.pushUpdateToGoogle(event);
          } else {
            // Event is being moved to a Google calendar but doesn't have a Google ID yet — create it
            const googleEventId = await bridge.pushCreateToGoogle(event);
            if (googleEventId) {
              await updateEvent({ ...event, googleEventId });
            }
          }
        } catch (err) {
          logger.error('useEventCRUD', 'Google write-back failed for update', { error: err });
        }
      }

      return response;
    },
    [updateEvent, bridge]
  );

  const deleteEventWithSync = useCallback(
    async (eventOrId: string | CalendarEventType) => {
      // If we got an event object, try to push delete to Google first
      if (typeof eventOrId !== 'string' && bridge) {
        try {
          await bridge.pushDeleteToGoogle(eventOrId);
        } catch (err) {
          logger.error('useEventCRUD', 'Google delete failed', { error: err });
        }
      }

      const id = typeof eventOrId === 'string' ? eventOrId : eventOrId.id;
      return doDelete(id);
    },
    [doDelete, bridge]
  );

  return {
    ...rest,
    addEvent: addEventWithSync,
    updateEvent: updateEventWithSync,
    removeEvent: deleteEventWithSync,
    deleteEvent: deleteEventWithSync,
  };
}
