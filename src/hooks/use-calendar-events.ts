// Firebase-only calendar events hook for production
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  serverTimestamp,
  Timestamp,
  getDocs,
  getDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { CalendarEventType } from '@/lib/stores/types';
import { toast } from 'sonner';
import dayjs from 'dayjs';

// Usage limits callback type - will be set by the component using this hook
type UsageLimitCallback = () => Promise<boolean>;
let checkEventLimitCallback: UsageLimitCallback | null = null;
let incrementEventCountCallback: (() => Promise<void>) | null = null;

// Export functions to set the callbacks from the component level
export const setUsageLimitCallbacks = (
  checkLimit: UsageLimitCallback,
  incrementCount: () => Promise<void>
) => {
  checkEventLimitCallback = checkLimit;
  incrementEventCountCallback = incrementCount;
};

interface SupabaseActionResponse {
  success: boolean;
  data?: any;
  error?: Error | unknown;
  diagnosticMessage?: string;
}

// Helper function to clean recurrence rule object for Firestore
// Firestore doesn't accept undefined values, so we filter them out
const cleanRecurrenceRule = (rule: Record<string, any>): Record<string, any> | null => {
  if (!rule) return null;

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(rule)) {
    if (value !== undefined && value !== null) {
      cleaned[key] = value;
    }
  }

  // Return null if no valid fields remain
  return Object.keys(cleaned).length > 0 ? cleaned : null;
};

export interface ArchivedFolder {
  name: string;
  count: number;
  lastUpdatedAt?: string;
}

export function useCalendarEvents() {
  const [events, setEvents] = useState<CalendarEventType[]>([]);
  const [archivedFolders, setArchivedFolders] = useState<ArchivedFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const archivedUnsubscribeRef = useRef<(() => void) | null>(null);

  // Helper function to format timestring from event descriptions
  const extractTimeString = (description: string): string => {
    if (!description) return '';
    const match = description.match(/^(\d{2}:\d{2}\s*-\s*\d{2}:\d{2})/);
    return match ? match[1] : '';
  };

  // Convert Firebase doc to CalendarEventType
  const convertFirebaseEvent = (doc: any): CalendarEventType => {
    const data = doc.data();
    // Support both startAt/endAt (standardized) and startsAt/endsAt (legacy)
    const startsAt = data.startAt?.toDate?.()?.toISOString() ||
      (typeof data.startAt === 'string' ? data.startAt : null) ||
      data.startsAt?.toDate?.()?.toISOString() ||
      (typeof data.startsAt === 'string' ? data.startsAt : null);

    const endsAt = data.endAt?.toDate?.()?.toISOString() ||
      (typeof data.endAt === 'string' ? data.endAt : null) ||
      data.endsAt?.toDate?.()?.toISOString() ||
      (typeof data.endsAt === 'string' ? data.endsAt : null);

    // Extract date from startsAt for calendar display
    const date = startsAt ? new Date(startsAt).toISOString().split('T')[0] : '';
    // Handle isArchived which might be missing in old docs
    const isArchived = data.isArchived === true || data.is_archived === true;

    return {
      id: doc.id,
      title: data.title || '',
      description: data.description || '',
      date: date,
      color: data.color || '#3b82f6',
      isLocked: data.isLocked || data.is_locked || false,
      isTodo: data.isTodo || data.is_todo || false,
      hasAlarm: data.hasAlarm || data.has_alarm || false,
      hasReminder: data.hasReminder || data.has_reminder || false,
      todoId: data.todoId || data.todo_id || null,
      startsAt: startsAt || '',
      endsAt: endsAt || '',

      // Google Calendar-style fields
      location: data.location || undefined,
      meetingUrl: data.meetingUrl || undefined,
      meetingProvider: data.meetingProvider || undefined,
      calendarId: data.calendarId || undefined,
      isAllDay: data.isAllDay || false,
      visibility: data.visibility || 'public',
      status: data.status || 'confirmed',
      timeZone: data.timeZone || undefined,

      // Recurring event fields
      isRecurring: data.isRecurring || false,
      recurrenceRule: data.recurrenceRule || undefined,
      recurrenceParentId: data.recurrenceParentId || undefined,
      recurrenceExceptions: data.recurrenceExceptions || undefined,

      // Attendees and reminders
      attendees: data.attendees || undefined,
      reminders: data.reminders || undefined,
      useDefaultReminders: data.useDefaultReminders ?? true,

      // Event type
      eventType: data.eventType || 'default',

      // Archiving support
      isArchived: isArchived,
      folderName: data.folderName || undefined,
    };
  };

  // One-time fetch events from Firebase (for manual refresh)
  const fetchEvents = useCallback(async () => {
    if (!user?.uid) {
      console.log("No user found, skipping events fetch");
      setEvents([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('Fetching calendar events for user:', user.uid);

      const eventsQuery = query(
        collection(db, 'calendar_events'),
        where('userId', '==', user.uid)
      );

      const snapshot = await getDocs(eventsQuery);
      const eventsList = snapshot.docs
        .map(doc => convertFirebaseEvent(doc))
        .filter(event => !event.isArchived)
        .sort((a, b) => (a.startsAt || '').localeCompare(b.startsAt || ''));
      console.log(`Fetched ${eventsList.length} events from Firebase`);
      setEvents(eventsList);
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error('Error in fetchEvents:', err);
      setError('Failed to fetch events');
      setLoading(false);
    }
  }, [user?.uid]);

  // Set up real-time listener (only once per user)
  useEffect(() => {
    if (!user?.uid) {
      setEvents([]);
      setLoading(false);
      return;
    }

    // Clean up any existing subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    const eventsQuery = query(
      collection(db, 'calendar_events'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
      const eventsList = snapshot.docs
        .map(doc => convertFirebaseEvent(doc))
        .filter(event => !event.isArchived)
        .sort((a, b) => (a.startsAt || '').localeCompare(b.startsAt || ''));
      setEvents(eventsList);
      setLoading(false);
      setError(null);
    }, (error) => {
      console.error('Error in real-time listener:', error);
      setError('Failed to fetch events');
      setLoading(false);
    });

    unsubscribeRef.current = unsubscribe;

    // Archived folders listener
    if (archivedUnsubscribeRef.current) {
      archivedUnsubscribeRef.current();
    }

    const archivedQuery = query(
      collection(db, 'calendar_events'),
      where('userId', '==', user.uid),
      where('isArchived', '==', true)
    );

    const archivedUnsubscribe = onSnapshot(archivedQuery, (snapshot) => {
      const foldersMap = new Map<string, ArchivedFolder>();

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const name = data.folderName || 'Uncategorized';
        const updatedAt = data.updatedAt?.toDate?.()?.toISOString();

        if (foldersMap.has(name)) {
          const folder = foldersMap.get(name)!;
          folder.count++;
          if (updatedAt && (!folder.lastUpdatedAt || updatedAt > folder.lastUpdatedAt)) {
            folder.lastUpdatedAt = updatedAt;
          }
        } else {
          foldersMap.set(name, { name, count: 1, lastUpdatedAt: updatedAt });
        }
      });

      setArchivedFolders(Array.from(foldersMap.values()));
    });

    archivedUnsubscribeRef.current = archivedUnsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (archivedUnsubscribeRef.current) {
        archivedUnsubscribeRef.current();
        archivedUnsubscribeRef.current = null;
      }
    };
  }, [user?.uid]);

  // Add a new event
  const addEvent = async (event: CalendarEventType): Promise<SupabaseActionResponse> => {
    if (!user?.uid) {
      toast.error('User not authenticated');
      return { success: false };
    }

    // Check usage limits before creating event
    if (checkEventLimitCallback) {
      const canCreate = await checkEventLimitCallback();
      if (!canCreate) {
        // The callback will trigger the upgrade prompt
        return { success: false, error: new Error('Event limit reached') };
      }
    }

    try {
      console.log('Adding event:', event);

      let startsAt: Date;
      let endsAt: Date;
      let actualDescription = event.description || '';

      // Check if startsAt/endsAt are already provided (from AI or direct creation)
      // startsAt and endsAt are ISO strings
      if (event.startsAt && event.endsAt && !event.startsAt.includes('|')) {
        startsAt = new Date(event.startsAt);
        endsAt = new Date(event.endsAt);

        // Ensure minimum 1-hour duration if start and end are the same
        if (startsAt.getTime() === endsAt.getTime()) {
          endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
          console.log('Adjusting zero-duration event to 1 hour');
        }

        console.log('Using provided startsAt/endsAt:', { startsAt, endsAt });

        // If description doesn't contain time info, keep it as is
        if (!actualDescription.includes('|')) {
          // Description is just the description, no time prefix
        } else {
          // Extract the actual description part after the time
          const descriptionParts = actualDescription.split('|');
          actualDescription = descriptionParts.length > 1 ? descriptionParts[1].trim() : actualDescription;
        }
      } else {
        // Legacy: Parse the time range from description (e.g., "09:00 - 10:00 | Description")
        const timeRange = extractTimeString(event.description);
        console.log('Extracted Time Range:', timeRange);

        const [startTime, endTime] = timeRange ? timeRange.split('-').map(t => t.trim()) : ['09:00', '10:00'];
        const eventDate = dayjs(event.date || new Date()).format('YYYY-MM-DD');

        startsAt = dayjs(`${eventDate} ${startTime}`).toDate();
        endsAt = dayjs(`${eventDate} ${endTime}`).toDate();

        // Extract the actual description part
        const descriptionParts = event.description.split('|');
        actualDescription = descriptionParts.length > 1 ? descriptionParts[1].trim() : '';
      }

      console.log('Final startsAt:', startsAt, 'endsAt:', endsAt);

      // Ensure title is not empty (Firestore rules require at least 1 character)
      const eventTitle = (event.title || '').trim() || 'Untitled Event';

      const newEvent: Record<string, any> = {
        title: eventTitle,
        description: actualDescription,
        color: event.color || '#3b82f6',
        isLocked: event.isLocked || false,
        isTodo: event.isTodo || false,
        hasAlarm: event.hasAlarm || false,
        hasReminder: event.hasReminder || false,
        userId: user.uid,
        todoId: event.todoId || null,
        // Write both for compatibility and to avoid missing field in future indexes
        startAt: Timestamp.fromDate(startsAt),
        endAt: Timestamp.fromDate(endsAt),
        startsAt: Timestamp.fromDate(startsAt),
        endsAt: Timestamp.fromDate(endsAt),
        createdAt: serverTimestamp(),

        // Google Calendar-style fields
        location: event.location || null,
        meetingUrl: event.meetingUrl || null,
        meetingProvider: event.meetingProvider || null,
        calendarId: event.calendarId || null,
        isAllDay: event.isAllDay || false,
        visibility: event.visibility || 'public',
        status: event.status || 'confirmed',
        timeZone: event.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone,

        // Recurring event fields - clean undefined values for Firestore
        isRecurring: event.isRecurring || false,
        recurrenceRule: event.recurrenceRule ? cleanRecurrenceRule(event.recurrenceRule) : null,
        recurrenceParentId: event.recurrenceParentId || null,
        recurrenceExceptions: event.recurrenceExceptions || null,

        // Attendees and reminders
        attendees: event.attendees || null,
        reminders: event.reminders || null,
        useDefaultReminders: event.useDefaultReminders ?? true,

        // Event type
        eventType: event.eventType || 'default',

        // Archiving
        isArchived: false,
      };

      // OPTIMISTIC UPDATE: Add to local state immediately for instant UI feedback
      const optimisticId = `temp_${Date.now()}`;
      const optimisticEvent: CalendarEventType = {
        id: optimisticId,
        title: eventTitle,
        description: actualDescription,
        date: dayjs(startsAt).format('YYYY-MM-DD'),
        color: newEvent.color,
        isLocked: newEvent.isLocked,
        isTodo: newEvent.isTodo,
        hasAlarm: newEvent.hasAlarm,
        hasReminder: newEvent.hasReminder,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        isRecurring: newEvent.isRecurring,
        recurrenceRule: newEvent.recurrenceRule,
      };

      // Add to state immediately (optimistic)
      setEvents(prev => [...prev, optimisticEvent]);

      // Now write to Firestore
      const docRef = await addDoc(collection(db, 'calendar_events'), newEvent);

      // Update the optimistic event with the real ID (the listener will handle this,
      // but we remove the temp one to prevent duplicates)
      setEvents(prev => prev.filter(e => e.id !== optimisticId));

      // Increment usage count after successful creation
      if (incrementEventCountCallback) {
        await incrementEventCountCallback();
      }

      toast.success('Event added successfully');
      return { success: true, data: { id: docRef.id } };
    } catch (error) {
      console.error('Error adding event:', error);
      // Remove optimistic event on failure
      setEvents(prev => prev.filter(e => !e.id.startsWith('temp_')));
      toast.error('Failed to add event');
      return { success: false, error };
    }
  };

  // Update an existing event
  const updateEvent = async (event: CalendarEventType): Promise<SupabaseActionResponse> => {
    if (!user?.uid || !event.id) {
      toast.error('Invalid event data or user not authenticated');
      return { success: false };
    }

    try {
      let startsAt: Date;
      let endsAt: Date;
      let actualDescription = event.description || '';

      // Check if startsAt/endsAt are already provided as ISO strings
      if (event.startsAt && event.endsAt && !event.startsAt.includes('|')) {
        startsAt = new Date(event.startsAt);
        endsAt = new Date(event.endsAt);

        // Ensure minimum 1-hour duration if start and end are the same
        if (startsAt.getTime() === endsAt.getTime()) {
          endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
          console.log('Adjusting zero-duration event to 1 hour');
        }

        // Extract the actual description part after the time if present
        if (actualDescription.includes('|')) {
          const descriptionParts = actualDescription.split('|');
          actualDescription = descriptionParts.length > 1 ? descriptionParts[1].trim() : actualDescription;
        }
      } else {
        // Legacy: Parse the time range from description
        const timeRange = extractTimeString(event.description);
        const [startTime, endTime] = timeRange ? timeRange.split('-').map(t => t.trim()) : ['09:00', '10:00'];
        const eventDate = dayjs(event.startsAt || new Date()).format('YYYY-MM-DD');

        startsAt = dayjs(`${eventDate} ${startTime}`).toDate();
        endsAt = dayjs(`${eventDate} ${endTime}`).toDate();

        const descriptionParts = event.description.split('|');
        actualDescription = descriptionParts.length > 1 ? descriptionParts[1].trim() : '';
      }

      const updatedEvent: Record<string, any> = {
        title: event.title,
        description: actualDescription,
        color: event.color || '#3b82f6',
        isLocked: event.isLocked || false,
        isTodo: event.isTodo || false,
        hasAlarm: event.hasAlarm || false,
        hasReminder: event.hasReminder || false,
        todoId: event.todoId || null,
        startAt: Timestamp.fromDate(startsAt),
        endAt: Timestamp.fromDate(endsAt),
        startsAt: Timestamp.fromDate(startsAt),
        endsAt: Timestamp.fromDate(endsAt),

        // Google Calendar-style fields
        location: event.location || null,
        meetingUrl: event.meetingUrl || null,
        meetingProvider: event.meetingProvider || null,
        calendarId: event.calendarId || null,
        isAllDay: event.isAllDay || false,
        visibility: event.visibility || 'public',
        status: event.status || 'confirmed',
        timeZone: event.timeZone || null,

        // Recurring event fields - clean undefined values for Firestore
        isRecurring: event.isRecurring || false,
        recurrenceRule: event.recurrenceRule ? cleanRecurrenceRule(event.recurrenceRule) : null,
        recurrenceParentId: event.recurrenceParentId || null,
        recurrenceExceptions: event.recurrenceExceptions || null,

        // Attendees and reminders
        attendees: event.attendees || null,
        reminders: event.reminders || null,
        useDefaultReminders: event.useDefaultReminders ?? true,

        // Event type
        eventType: event.eventType || 'default',

        // Ensure archiving fields are preserved or set
        isArchived: event.isArchived ?? false,
        folderName: event.folderName ?? null,
      };

      await updateDoc(doc(db, 'calendar_events', event.id), updatedEvent);
      toast.success('Event updated');
      return { success: true };
    } catch (error) {
      console.error('Error updating event:', error);
      toast.error('Failed to update event');
      return { success: false, error };
    }
  };

  // Remove an event
  const removeEvent = async (eventId: string): Promise<SupabaseActionResponse> => {
    if (!user?.uid || !eventId) {
      toast.error('Invalid event ID or user not authenticated');
      return { success: false };
    }

    try {
      await deleteDoc(doc(db, 'calendar_events', eventId));
      toast.success('Event removed');
      return { success: true };
    } catch (error) {
      console.error('Error removing event:', error);
      toast.error('Failed to remove event');
      return { success: false, error };
    }
  };

  // Add an exception date to a recurring event (excludes that date from the recurrence)
  const addRecurrenceException = async (eventId: string, exceptionDate: string): Promise<SupabaseActionResponse> => {
    if (!user?.uid || !eventId) {
      console.error('Invalid event ID or user not authenticated');
      return { success: false };
    }

    try {
      // Get the current event to retrieve existing exceptions
      const eventDoc = await getDoc(doc(db, 'calendar_events', eventId));
      if (!eventDoc.exists()) {
        console.error('Event not found:', eventId);
        return { success: false, error: 'Event not found' };
      }

      const eventData = eventDoc.data();
      const currentExceptions: string[] = eventData.recurrenceExceptions || [];

      // Add the new exception if it doesn't already exist
      if (!currentExceptions.includes(exceptionDate)) {
        currentExceptions.push(exceptionDate);

        await updateDoc(doc(db, 'calendar_events', eventId), {
          recurrenceExceptions: currentExceptions
        });

        console.log(`Added exception ${exceptionDate} to event ${eventId}`);
      }

      return { success: true };
    } catch (error) {
      console.error('Error adding recurrence exception:', error);
      return { success: false, error };
    }
  };

  // Toggle event lock status
  const toggleEventLock = async (eventId: string, isLocked: boolean): Promise<SupabaseActionResponse> => {
    if (!user?.uid || !eventId) {
      toast.error('Invalid event ID or user not authenticated');
      return { success: false };
    }

    try {
      await updateDoc(doc(db, 'calendar_events', eventId), {
        isLocked: isLocked
      });
      toast.success(isLocked ? 'Event locked' : 'Event unlocked');
      return { success: true };
    } catch (error) {
      console.error('Error toggling event lock:', error);
      toast.error('Failed to update event status');
      return { success: false, error };
    }
  };

  // Archive all visible events into a folder
  const archiveAllEvents = async (folderName: string): Promise<SupabaseActionResponse> => {
    if (!user?.uid) {
      toast.error('User not authenticated');
      return { success: false };
    }

    try {
      setLoading(true);
      const batch = writeBatch(db);
      let count = 0;

      // Archive each currently loaded event
      events.forEach((event) => {
        if (!event.isArchived) {
          const docRef = doc(db, 'calendar_events', event.id);
          batch.update(docRef, {
            isArchived: true,
            folderName: folderName,
            updatedAt: serverTimestamp()
          });
          count++;
        }
      });

      if (count > 0) {
        await batch.commit();
        toast.success(`Archived ${count} events into "${folderName}"`);
      } else {
        toast.info("No events to archive");
      }

      setLoading(false);
      return { success: true };
    } catch (error) {
      console.error('Error archiving events:', error);
      toast.error('Failed to archive events');
      setLoading(false);
      return { success: false, error };
    }
  };

  // Restore all events from an archived folder
  const restoreFolder = async (folderName: string): Promise<SupabaseActionResponse> => {
    if (!user?.uid) return { success: false };

    try {
      setLoading(true);
      const q = query(
        collection(db, 'calendar_events'),
        where('userId', '==', user.uid),
        where('folderName', '==', folderName),
        where('isArchived', '==', true)
      );

      const snapshot = await getDocs(q);
      const batch = writeBatch(db);

      snapshot.forEach(d => {
        batch.update(d.ref, {
          isArchived: false,
          folderName: null,
          updatedAt: serverTimestamp()
        });
      });

      await batch.commit();
      toast.success(`Restored ${snapshot.size} events from "${folderName}"`);
      setLoading(false);
      return { success: true };
    } catch (error) {
      console.error('Error restoring folder:', error);
      toast.error('Failed to restore archive');
      setLoading(false);
      return { success: false, error };
    }
  };

  // Permanently delete all events in an archived folder
  const deleteArchivedFolder = async (folderName: string): Promise<SupabaseActionResponse> => {
    if (!user?.uid) return { success: false };

    try {
      setLoading(true);
      const q = query(
        collection(db, 'calendar_events'),
        where('userId', '==', user.uid),
        where('folderName', '==', folderName),
        where('isArchived', '==', true)
      );

      const snapshot = await getDocs(q);
      const batch = writeBatch(db);

      snapshot.forEach(d => {
        batch.delete(d.ref);
      });

      await batch.commit();
      toast.success(`Permanently deleted folder "${folderName}"`);
      setLoading(false);
      return { success: true };
    } catch (error) {
      console.error('Error deleting folder:', error);
      toast.error('Failed to delete archived folder');
      setLoading(false);
      return { success: false, error };
    }
  };

  return {
    events,
    archivedFolders,
    loading,
    error,
    fetchEvents,
    addEvent,
    updateEvent,
    removeEvent,
    toggleEventLock,
    addRecurrenceException,
    archiveAllEvents,
    restoreFolder,
    deleteArchivedFolder
  };
}