// Firebase version of useCalendarEvents hook
import { useState, useEffect, useCallback } from 'react';
import { 
  FirestoreService, 
  CalendarEvent, 
  COLLECTIONS, 
  timestampFromDate,
  timestampToDate
} from '@/integrations/firebase/firestore';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { CalendarEventType } from '@/lib/stores/types';
import { toast } from 'sonner';
import dayjs from 'dayjs';

interface FirebaseActionResponse {
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

  // Helper function to format timestring from event descriptions
  const extractTimeString = (description: string): string => {
    if (!description) return '';
    const timePart = description.split('|')[0];
    return timePart ? timePart.trim() : '';
  };

  // Helper to create a formatted description for display
  const formatDescription = (timeStart: string, timeEnd: string, description: string): string => {
    const formattedTime = `${dayjs(timeStart).format('HH:mm')} - ${dayjs(timeEnd).format('HH:mm')}`;
    return `${formattedTime} | ${description || ''}`;
  };

  // Transform Firebase CalendarEvent to CalendarEventType
  const transformFirebaseEvent = (firebaseEvent: CalendarEvent & { id: string }): CalendarEventType => {
    const startDate = timestampToDate(firebaseEvent.startAt);
    const endDate = timestampToDate(firebaseEvent.endAt);
    const eventDate = dayjs(startDate).format('YYYY-MM-DD');
    
    const descriptionWithTime = formatDescription(
      startDate.toISOString(),
      endDate.toISOString(),
      firebaseEvent.description || ''
    );
    
    return {
      id: firebaseEvent.id,
      title: firebaseEvent.title,
      description: descriptionWithTime,
      color: firebaseEvent.color || 'bg-blue-400/70',
      isLocked: firebaseEvent.isLocked || false,
      isTodo: firebaseEvent.isTodo || false,
      hasAlarm: firebaseEvent.hasAlarm || false,
      hasReminder: firebaseEvent.hasReminder || false,
      todoId: firebaseEvent.todoId,
      startsAt: startDate.toISOString(),
      endsAt: endDate.toISOString(),
      date: eventDate
    };
  };

  // Fetch calendar events from Firebase
  const fetchEvents = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('===== FETCH EVENTS DEBUG (Firebase) =====');
      console.log('Authentication Status:', {
        user: user ? 'User authenticated' : 'No user',
        userId: user?.uid,
        email: user?.email
      });
      
      if (!user) {
        console.log('No authenticated user, clearing events');
        setEvents([]);
        setLoading(false);
        return;
      }
      
      console.log('Fetching calendar events for user:', user!.uid);
      
      // Query Firebase Firestore
      const firebaseEvents = await FirestoreService.query<CalendarEvent>(
        COLLECTIONS.CALENDAR_EVENTS,
        [{ field: 'userId', operator: '==', value: user!.uid }],
        'startAt', // Order by start time
        'asc'
      );
      
      console.log('Fetched calendar events from Firebase:', firebaseEvents);
      
      // Transform Firebase events to CalendarEventType
      const transformedEvents = firebaseEvents.map(transformFirebaseEvent);
      setEvents(transformedEvents);
      
    } catch (err: any) {
      console.error('===== FETCH EVENTS ERROR (Firebase) =====');
      console.error('Error Details:', {
        message: err.message,
        name: err.name,
        stack: err.stack,
        fullError: err
      });
      setError(err.message || String(err));
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Add a new event to Firebase
  const addEvent = async (event: CalendarEventType): Promise<FirebaseActionResponse> => {
    console.log('===== ADD EVENT DEBUG (Firebase) =====');
    console.log('Authentication Status:', {
      user: user ? 'User authenticated' : 'No user',
      userId: user?.uid,
      email: user?.email
    });
    
    if (!user) {
      console.error('No authenticated user');
      toast.error('User not authenticated');
      return { success: false };
    }
    
    try {
      console.log('Incoming Event Object:', event);
      
      // Parse the time range from description (e.g., "09:00 - 10:00 | Description")
      const timeRange = extractTimeString(event.description);
      console.log('Extracted Time Range:', timeRange);
      
      const [startTime, endTime] = timeRange.split('-').map(t => t.trim());
      console.log('Start Time:', startTime);
      console.log('End Time:', endTime);
      
      const eventDate = event.date || dayjs().format('YYYY-MM-DD');
      console.log('Event Date:', eventDate);
      
      // Create Date objects by combining date and time
      const startDateTime = dayjs(`${eventDate} ${startTime}`).toDate();
      const endDateTime = dayjs(`${eventDate} ${endTime}`).toDate();
      
      console.log('Start DateTime:', startDateTime);
      console.log('End DateTime:', endDateTime);
      
      // Extract the actual description part
      const descriptionParts = event.description.split('|');
      const actualDescription = descriptionParts.length > 1 ? descriptionParts[1].trim() : '';
      
      // Prepare Firebase event data
      const firebaseEvent: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'> = {
        title: event.title,
        description: actualDescription,
        startAt: timestampFromDate(startDateTime),
        endAt: timestampFromDate(endDateTime),
        userId: user!.uid,
        color: event.color,
        isLocked: event.isLocked || false,
        isTodo: event.isTodo || false,
        hasAlarm: event.hasAlarm || false,
        hasReminder: event.hasReminder || false,
        todoId: event.todoId
      };
      
      console.log('Prepared Firebase Event Object:', firebaseEvent);
      
      // Insert into Firebase
      const docRef = await FirestoreService.create<CalendarEvent>(
        COLLECTIONS.CALENDAR_EVENTS, 
        firebaseEvent
      );
      
      console.log('Firebase Insert Response:', { 
        success: true, 
        docId: docRef.id
      });
      
      // Refresh events to show the new one
      await fetchEvents();
      
      toast.success('Event created successfully!');
      return { 
        success: true, 
        data: { id: docRef.id },
        diagnosticMessage: 'Event inserted successfully into Firebase'
      };
      
    } catch (err: any) {
      console.error('===== ADD EVENT ERROR (Firebase) =====');
      console.error('Firebase Insert Error:', {
        message: err.message,
        name: err.name,
        stack: err.stack,
        fullError: err
      });
      
      const errorMessage = err.message || 'Failed to create event';
      setError(errorMessage);
      toast.error(errorMessage);
      
      return { 
        success: false, 
        error: err,
        diagnosticMessage: `Firebase insert error: ${errorMessage}`
      };
    }
  };

  // Update an existing event
  const updateEvent = async (eventId: string, updates: Partial<CalendarEventType>): Promise<FirebaseActionResponse> => {
    if (!user) {
      toast.error('User not authenticated');
      return { success: false };
    }

    try {
      console.log('===== UPDATE EVENT DEBUG (Firebase) =====');
      console.log('Event ID:', eventId);
      console.log('Updates:', updates);

      // Transform updates to Firebase format
      const firebaseUpdates: Partial<CalendarEvent> = {};
      
      if (updates.title) firebaseUpdates.title = updates.title;
      if (updates.color) firebaseUpdates.color = updates.color;
      if (updates.isLocked !== undefined) firebaseUpdates.isLocked = updates.isLocked;
      if (updates.isTodo !== undefined) firebaseUpdates.isTodo = updates.isTodo;
      if (updates.hasAlarm !== undefined) firebaseUpdates.hasAlarm = updates.hasAlarm;
      if (updates.hasReminder !== undefined) firebaseUpdates.hasReminder = updates.hasReminder;
      if (updates.todoId) firebaseUpdates.todoId = updates.todoId;

      // Handle description and time updates
      if (updates.description) {
        const timeRange = extractTimeString(updates.description);
        if (timeRange) {
          const [startTime, endTime] = timeRange.split('-').map(t => t.trim());
          const eventDate = updates.date || dayjs().format('YYYY-MM-DD');
          
          firebaseUpdates.startAt = timestampFromDate(dayjs(`${eventDate} ${startTime}`).toDate());
          firebaseUpdates.endAt = timestampFromDate(dayjs(`${eventDate} ${endTime}`).toDate());
          
          // Extract actual description
          const descriptionParts = updates.description.split('|');
          firebaseUpdates.description = descriptionParts.length > 1 ? descriptionParts[1].trim() : '';
        }
      }

      await FirestoreService.update<CalendarEvent>(
        COLLECTIONS.CALENDAR_EVENTS,
        eventId,
        firebaseUpdates
      );

      // Refresh events
      await fetchEvents();
      
      toast.success('Event updated successfully!');
      return { success: true };

    } catch (err: any) {
      console.error('Update event error:', err);
      const errorMessage = err.message || 'Failed to update event';
      toast.error(errorMessage);
      return { success: false, error: err };
    }
  };

  // Delete an event
  const deleteEvent = async (eventId: string): Promise<FirebaseActionResponse> => {
    if (!user) {
      toast.error('User not authenticated');
      return { success: false };
    }

    try {
      console.log('===== DELETE EVENT DEBUG (Firebase) =====');
      console.log('Event ID:', eventId);

      await FirestoreService.delete(COLLECTIONS.CALENDAR_EVENTS, eventId);

      // Refresh events
      await fetchEvents();
      
      toast.success('Event deleted successfully!');
      return { success: true };

    } catch (err: any) {
      console.error('Delete event error:', err);
      const errorMessage = err.message || 'Failed to delete event';
      toast.error(errorMessage);
      return { success: false, error: err };
    }
  };

  // Set up real-time subscription
  useEffect(() => {
    if (!user) {
      setEvents([]);
      setLoading(false);
      return;
    }

    console.log('Setting up Firebase real-time subscription for user:', user!.uid);

    // Set up real-time listener
    const unsubscribe = FirestoreService.subscribeToCollection<CalendarEvent>(
      COLLECTIONS.CALENDAR_EVENTS,
      (firebaseEvents) => {
        console.log('Real-time update received:', firebaseEvents);
        const transformedEvents = firebaseEvents.map(transformFirebaseEvent);
        setEvents(transformedEvents);
        setLoading(false);
      },
      [{ field: 'userId', operator: '==', value: user!.uid }],
      'startAt',
      'asc'
    );

    // Initial fetch is handled by the subscription
    return unsubscribe;
  }, [user]);

  return {
    events,
    loading,
    error,
    addEvent,
    updateEvent,
    deleteEvent,
    fetchEvents,
    // Legacy compatibility
    refetch: fetchEvents
  };
}
