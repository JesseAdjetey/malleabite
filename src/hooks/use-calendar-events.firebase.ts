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
import { eventSchema } from '@/lib/validation';
import { logger } from '@/lib/logger';
import { errorHandler } from '@/lib/error-handler';

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
      
      logger.debug('useCalendarEvents', 'Fetching events', {
        hasUser: !!user,
        userId: user?.uid
      });
      
      if (!user) {
        logger.warn('useCalendarEvents', 'No authenticated user, clearing events');
        setEvents([]);
        setLoading(false);
        return;
      }
      
      // Query Firebase Firestore
      const firebaseEvents = await FirestoreService.query<CalendarEvent>(
        COLLECTIONS.CALENDAR_EVENTS,
        [{ field: 'userId', operator: '==', value: user!.uid }],
        'startAt', // Order by start time
        'asc'
      );
      
      logger.info('useCalendarEvents', 'Fetched calendar events', {
        count: firebaseEvents.length
      });
      
      // Transform Firebase events to CalendarEventType
      const transformedEvents = firebaseEvents.map(transformFirebaseEvent);
      setEvents(transformedEvents);
      
    } catch (err: any) {
      logger.error('useCalendarEvents', 'Fetch events error', err);
      errorHandler.handleFirestoreError(err);
      setError(err.message || String(err));
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Add a new event to Firebase
  const addEvent = async (event: CalendarEventType): Promise<FirebaseActionResponse> => {
    logger.debug('useCalendarEvents', 'Add event attempt', {
      hasUser: !!user,
      eventTitle: event.title
    });
    
    if (!user) {
      logger.error('useCalendarEvents', 'No authenticated user', new Error('User not authenticated'));
      errorHandler.handleError(
        new Error('User not authenticated'),
        'Cannot add event',
        'useCalendarEvents'
      );
      return { success: false };
    }
    
    try {
      // Validate event data
      const validation = eventSchema.safeParse(event);
      if (!validation.success) {
        const errorMessage = validation.error.errors.map(e => 
          `${e.path.join('.')}: ${e.message}`
        ).join(', ');
        logger.warn('useCalendarEvents', 'Event validation failed', {
          errors: validation.error.errors
        });
        toast.error(`Invalid event data: ${errorMessage}`);
        return { success: false, error: new Error(errorMessage) };
      }
      
      logger.debug('useCalendarEvents', 'Processing event', {
        date: event.date,
        hasDescription: !!event.description
      });
      
      // Parse the time range from description (e.g., "09:00 - 10:00 | Description")
      const timeRange = extractTimeString(event.description);
      
      const [startTime, endTime] = timeRange.split('-').map(t => t.trim());
      
      const eventDate = event.date || dayjs().format('YYYY-MM-DD');
      
      // Create Date objects by combining date and time
      const startDateTime = dayjs(`${eventDate} ${startTime}`).toDate();
      const endDateTime = dayjs(`${eventDate} ${endTime}`).toDate();
      
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
      
      logger.debug('useCalendarEvents', 'Inserting event to Firebase', {
        title: firebaseEvent.title
      });
      
      // Insert into Firebase
      const docRef = await FirestoreService.create<CalendarEvent>(
        COLLECTIONS.CALENDAR_EVENTS, 
        firebaseEvent
      );
      
      logger.info('useCalendarEvents', 'Event created successfully', {
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
      logger.error('useCalendarEvents', 'Add event error', err);
      
      errorHandler.handleFirestoreError(err);
      const errorMessage = err.message || 'Failed to create event';
      setError(errorMessage);
      
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
      logger.debug('useCalendarEvents', 'Update event attempt', {
        eventId,
        updateKeys: Object.keys(updates)
      });

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
      logger.error('useCalendarEvents', 'Update event error', err);
      errorHandler.handleFirestoreError(err);
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
      logger.debug('useCalendarEvents', 'Delete event attempt', { eventId });

      await FirestoreService.delete(COLLECTIONS.CALENDAR_EVENTS, eventId);

      // Refresh events
      await fetchEvents();
      
      toast.success('Event deleted successfully!');
      return { success: true };

    } catch (err: any) {
      logger.error('useCalendarEvents', 'Delete event error', err);
      errorHandler.handleFirestoreError(err);
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

    logger.debug('useCalendarEvents', 'Setting up real-time subscription', {
      userId: user!.uid
    });

    // Set up real-time listener
    const unsubscribe = FirestoreService.subscribeToCollection<CalendarEvent>(
      COLLECTIONS.CALENDAR_EVENTS,
      (firebaseEvents) => {
        logger.debug('useCalendarEvents', 'Real-time update received', {
          count: firebaseEvents.length
        });
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
