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
  getDocs
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { CalendarEventType } from '@/lib/stores/types';
import { toast } from 'sonner';
import dayjs from 'dayjs';

interface SupabaseActionResponse {
  success: boolean;
  data?: any;
  error?: Error | unknown;
  diagnosticMessage?: string;
}

export function useCalendarEvents() {
  const [events, setEvents] = useState<CalendarEventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Helper function to format timestring from event descriptions
  const extractTimeString = (description: string): string => {
    if (!description) return '';
    const match = description.match(/^(\d{2}:\d{2}\s*-\s*\d{2}:\d{2})/);
    return match ? match[1] : '';
  };

  // Convert Firebase doc to CalendarEventType
  const convertFirebaseEvent = (doc: any): CalendarEventType => {
    const data = doc.data();
    const startsAt = data.startsAt?.toDate?.()?.toISOString() || data.startsAt;
    const endsAt = data.endsAt?.toDate?.()?.toISOString() || data.endsAt;
    
    // Extract date from startsAt for calendar display
    const date = startsAt ? new Date(startsAt).toISOString().split('T')[0] : '';
    
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
      startsAt: startsAt,
      endsAt: endsAt,
      
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
        where('userId', '==', user.uid),
        orderBy('startsAt', 'asc')
      );

      const snapshot = await getDocs(eventsQuery);
      const eventsList = snapshot.docs.map(doc => convertFirebaseEvent(doc));
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
      where('userId', '==', user.uid),
      orderBy('startsAt', 'asc')
    );

    const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
      const eventsList = snapshot.docs.map(doc => convertFirebaseEvent(doc));
      setEvents(eventsList);
      setLoading(false);
      setError(null);
    }, (error) => {
      console.error('Error in real-time listener:', error);
      setError('Failed to fetch events');
      setLoading(false);
    });

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user?.uid]);

  // Add a new event
  const addEvent = async (event: CalendarEventType): Promise<SupabaseActionResponse> => {
    if (!user?.uid) {
      toast.error('User not authenticated');
      return { success: false };
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
      
      const newEvent: Record<string, any> = {
        title: event.title,
        description: actualDescription,
        color: event.color || '#3b82f6',
        isLocked: event.isLocked || false,
        isTodo: event.isTodo || false,
        hasAlarm: event.hasAlarm || false,
        hasReminder: event.hasReminder || false,
        userId: user.uid,
        todoId: event.todoId || null,
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
        
        // Recurring event fields
        isRecurring: event.isRecurring || false,
        recurrenceRule: event.recurrenceRule || null,
        recurrenceParentId: event.recurrenceParentId || null,
        recurrenceExceptions: event.recurrenceExceptions || null,
        
        // Attendees and reminders
        attendees: event.attendees || null,
        reminders: event.reminders || null,
        useDefaultReminders: event.useDefaultReminders ?? true,
        
        // Event type
        eventType: event.eventType || 'default',
      };

      await addDoc(collection(db, 'calendar_events'), newEvent);
      toast.success('Event added successfully');
      return { success: true };
    } catch (error) {
      console.error('Error adding event:', error);
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
        
        // Recurring event fields
        isRecurring: event.isRecurring || false,
        recurrenceRule: event.recurrenceRule || null,
        recurrenceParentId: event.recurrenceParentId || null,
        recurrenceExceptions: event.recurrenceExceptions || null,
        
        // Attendees and reminders
        attendees: event.attendees || null,
        reminders: event.reminders || null,
        useDefaultReminders: event.useDefaultReminders ?? true,
        
        // Event type
        eventType: event.eventType || 'default',
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

  // Toggle event lock status
  const toggleEventLock = async (eventId: string, isLocked: boolean): Promise<SupabaseActionResponse> => {
    if (!user?.uid || !eventId) {
      toast.error('Invalid event ID or user not authenticated');
      return { success: false };
    }

    try {
      await updateDoc(doc(db, 'calendar_events', eventId), {
        is_locked: isLocked
      });
      toast.success(isLocked ? 'Event locked' : 'Event unlocked');
      return { success: true };
    } catch (error) {
      console.error('Error toggling event lock:', error);
      toast.error('Failed to update event');
      return { success: false, error };
    }
  };

  return {
    events,
    loading,
    error,
    fetchEvents,
    addEvent,
    updateEvent,
    removeEvent,
    toggleEventLock
  };
}