// Hook that wraps event CRUD (create / update / delete) and transparently
// pushes changes to Google Calendar when the target calendar is a Google one.
//
// Usage: replace direct addEvent/updateEvent/removeEvent calls with the
// wrappers returned by this hook.

import { useCallback } from 'react';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { useGoogleSyncBridgeContext } from '@/contexts/GoogleSyncBridgeContext';
import { useEventStore } from '@/lib/store';
import { CalendarEventType } from '@/lib/stores/types';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.unified';
import { db } from '@/integrations/firebase/config';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';

/**
 * Returns wrapped versions of addEvent / updateEvent / removeEvent that
 * automatically push to Google Calendar when appropriate.
 */
export function useEventCRUD() {
  const { addEvent, updateEvent, removeEvent, deleteEvent, ...rest } = useCalendarEvents() as any;
  const bridge = useGoogleSyncBridgeContext();
  const { user } = useAuth();

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
      // Google Calendar events: push via bridge + update local state.
      // Bypasses Firestore to avoid permission errors on imported/synced events.
      if (event.googleEventId) {
        if (bridge) {
          try {
            const synced = await bridge.pushUpdateToGoogle(event);
            if (!synced) {
              toast.warning('Changes saved locally but could not sync to Google Calendar.');
            }
          } catch (err) {
            logger.error('useEventCRUD', 'Google write-back failed for update', { error: err });
            toast.warning('Changes saved locally but could not sync to Google Calendar.');
          }
        }
        // Update Zustand store directly so the UI reflects the change immediately
        useEventStore.getState().updateEvent(event);

        if (event.id.startsWith('synced_')) {
          // Synced events live in users/{uid}/syncedEvents and are NOT in calendar_events.
          // Previously we skipped persistence entirely here, so the edit only lived in
          // memory and the synced-events listener reverted it on the next reload/sync.
          // Persist the edited fields onto the synced doc so the change survives reload.
          // (The push to Google above means the next full sync brings back the same value.)
          if (user?.uid) {
            const syncedDocId = event.id.replace(/^synced_/, '');
            try {
              const syncedPatch: Record<string, any> = {
                title: event.title,
                description: event.description ?? '',
                location: event.location ?? '',
                startTime: event.startsAt,
                endTime: event.endsAt,
                isAllDay: event.isAllDay ?? false,
              };
              if (event.color) syncedPatch.color = event.color;
              if (event.meetingUrl !== undefined) syncedPatch.meetingUrl = event.meetingUrl ?? null;
              await updateDoc(doc(db, `users/${user.uid}/syncedEvents`, syncedDocId), syncedPatch);
            } catch (err) {
              logger.error('useEventCRUD', 'Failed to persist synced-event edit to Firestore', { error: err });
              toast.warning('Changes saved locally but may not persist after reload.');
              return { success: false, error: err };
            }
          }
        } else {
          // Locally-created event that has been linked to Google — persist to
          // calendar_events so the edit survives refresh. Await so we can surface failures.
          const result = await updateEvent(event).catch((err) => {
            logger.error('useEventCRUD', 'Failed to persist event edit to Firestore', { error: err });
            return { success: false, error: err };
          });
          if (!result?.success) {
            toast.warning('Changes saved locally but may not persist after reload.');
            return result ?? { success: false };
          }
        }
        return { success: true };
      }

      // Non-Google events: standard Firestore path
      const response = await updateEvent(event);

      if (response.success && bridge) {
        try {
          // Event being assigned to a Google calendar for the first time — create it there
          const googleEventId = await bridge.pushCreateToGoogle(event);
          if (googleEventId) {
            await updateEvent({ ...event, googleEventId });
          } else {
            toast.warning('Changes saved locally but could not sync to Google Calendar.');
          }
        } catch (err) {
          logger.error('useEventCRUD', 'Google write-back failed for update', { error: err });
          toast.warning('Changes saved locally but could not sync to Google Calendar.');
        }
      }

      return response;
    },
    [updateEvent, bridge]
  );

  const deleteEventWithSync = useCallback(
    async (eventOrId: string | CalendarEventType, scope?: 'single' | 'all' | 'thisAndFuture') => {
      const rawId = typeof eventOrId === 'string' ? eventOrId : eventOrId.id;

      // A recurring series is expanded in the grid into instance objects whose ids are
      // `${parentId}_${YYYY-MM-DD}`. These instances are NOT stored, so when a user
      // selected an external (synced) recurring occurrence and deleted it, the lookup
      // below resolved to nothing and the delete silently failed / only the one
      // occurrence's (nonexistent) doc was targeted. Resolve an instance id back to
      // its real parent so series-vs-occurrence handling can work for synced events.
      const store = useEventStore.getState();
      let id = rawId;
      let eventObj: CalendarEventType | null = typeof eventOrId !== 'string'
        ? eventOrId
        : store.events.find(e => e.id === rawId) ?? null;

      if (!eventObj && typeof eventOrId === 'string') {
        const lastUnderscore = rawId.lastIndexOf('_');
        if (lastUnderscore > 0) {
          const maybeDate = rawId.slice(lastUnderscore + 1);
          const maybeParent = rawId.slice(0, lastUnderscore);
          if (/^\d{4}-\d{2}-\d{2}$/.test(maybeDate)) {
            const parent = store.events.find(e => e.id === maybeParent);
            if (parent) {
              // For an external/synced series, default to deleting the whole series
              // unless the caller explicitly asked for just this occurrence.
              eventObj = parent;
              id = maybeParent;
            }
          }
        }
      }

      // Microsoft synced events: remove from store + delete syncedEvents doc (no API call needed)
      if (eventObj?.source === 'microsoft' && id.startsWith('synced_')) {
        useEventStore.getState().deleteEvent(id);
        if (user?.uid) {
          const syncedDocId = id.replace(/^synced_/, '');
          deleteDoc(doc(db, `users/${user.uid}/syncedEvents`, syncedDocId)).catch((err) => {
            logger.error('useEventCRUD', 'Failed to delete Microsoft syncedEvents doc', { error: err });
          });
        }
        toast.success('Event removed');
        return { success: true };
      }

      // Single occurrence of an EXTERNAL recurring series: don't nuke the whole
      // series. Push a delete for just this instance to Google (instance id =
      // `${recurringEventId}_${UTC compact timestamp}`) and add a local exception so
      // the grid hides it immediately. If we can't build the instance id, fall back
      // to a local-only exception rather than deleting the series.
      if (scope === 'single' && eventObj?.googleEventId && rawId !== id) {
        const instanceDate = rawId.slice(rawId.lastIndexOf('_') + 1); // YYYY-MM-DD
        if (bridge) {
          try {
            const occurrenceStart = (typeof eventOrId !== 'string' ? eventOrId.startsAt : undefined)
              || `${instanceDate}T00:00:00Z`;
            const compact = new Date(occurrenceStart).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
            const instanceGoogleId = `${eventObj.googleEventId}_${compact}`;
            await bridge.pushDeleteToGoogle({ ...eventObj, googleEventId: instanceGoogleId });
          } catch (err) {
            logger.error('useEventCRUD', 'Google single-occurrence delete failed', { error: err });
          }
        }
        // Record the exception locally so it survives reload without dropping the series.
        if (rest.addRecurrenceException && !id.startsWith('synced_')) {
          await rest.addRecurrenceException(id, instanceDate).catch(() => undefined);
        }
        store.deleteEvent(rawId);
        toast.success('This occurrence has been removed');
        return { success: true };
      }

      // Google Calendar events: use API delete + local state removal to avoid
      // Firestore permission errors on imported/synced events.
      // When `id` was resolved from an instance to its parent above, this deletes the
      // whole series (parent googleEventId is the base recurring id) — which is the
      // desired behaviour for 'all'/'thisAndFuture' and for deleting a synced series.
      if (eventObj?.googleEventId && bridge) {
        try {
          await bridge.pushDeleteToGoogle(eventObj);
        } catch (err) {
          logger.error('useEventCRUD', 'Google delete failed', { error: err });
          toast.warning('Event removed locally but could not be removed from Google Calendar.');
        }
        useEventStore.getState().deleteEvent(id);
        // Also drop the originally-targeted instance from the store (if different)
        if (rawId !== id) useEventStore.getState().deleteEvent(rawId);
        // Delete the syncedEvents Firestore doc so it doesn't reappear on refresh.
        // Synced events: doc ID = id without 'synced_' prefix (format: {calendarId}_{googleEventId})
        // Local events pushed to Google: doc ID = {calendarId}_{googleEventId} (not the local id)
        if (user?.uid) {
          let syncedDocId: string | null = null;
          if (id.startsWith('synced_')) {
            syncedDocId = id.replace(/^synced_/, '');
          } else if (eventObj.calendarId && eventObj.googleEventId) {
            syncedDocId = `${eventObj.calendarId}_${eventObj.googleEventId}`;
          }
          if (syncedDocId) {
            deleteDoc(doc(db, `users/${user.uid}/syncedEvents`, syncedDocId)).catch((err) => {
              logger.error('useEventCRUD', 'Failed to delete syncedEvents doc', { error: err });
            });
          }
          // For locally-created events (in calendar_events), also delete that doc
          // so it doesn't reappear on page refresh.
          if (!id.startsWith('synced_')) {
            deleteDoc(doc(db, 'calendar_events', id)).catch((err) => {
              logger.error('useEventCRUD', 'Failed to delete calendar_events doc', { error: err });
            });
          }
        }
        return { success: true };
      }

      // Non-Google events with a full event object: attempt Google sync if applicable
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

      return doDelete(id);
    },
    [doDelete, bridge, user]
  );

  return {
    ...rest,
    addEvent: addEventWithSync,
    updateEvent: updateEventWithSync,
    removeEvent: deleteEventWithSync,
    deleteEvent: deleteEventWithSync,
  };
}
