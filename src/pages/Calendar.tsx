
import React, { useEffect } from 'react';
import Mainview from '@/components/Mainview';
import { useDateStore, useViewStore } from "@/lib/store";
import { useCalendarEvents } from '@/hooks/use-calendar-events.unified';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Home } from 'lucide-react';
import { CalendarEventType } from '@/lib/stores/types';
import '../styles/ai-animations.css';
import BottomMallyAI from '@/components/ai/BottomMallyAI';
import MobileNavigation from '@/components/MobileNavigation';
import { motion } from 'framer-motion';
import { eventSchema } from '@/lib/validation';
import { logger } from '@/lib/logger';
import dayjs from 'dayjs';
import { useGoogleCalendar } from '@/hooks/use-google-calendar';

const Calendar = () => {
  const { addEvent, updateEvent } = useCalendarEvents();
  const { syncEnabled, pushEventToGoogle } = useGoogleCalendar();
  const navigate = useNavigate();

  // Initialize stores on client side
  useEffect(() => {
    // Hydrate zustand stores if needed
    const view = useViewStore.getState();
    const date = useDateStore.getState();

    // Any other initialization needed
  }, []);

  // Handler for event scheduling via MallyAI
  const handleScheduleEvent = async (event: CalendarEventType): Promise<any> => {
    try {
      logger.debug('Calendar', 'MallyAI event scheduling attempt', event);

      if (!event || !event.title) {
        logger.warn('Calendar', 'Invalid event data received', { event });
        toast.error("Invalid event data received");
        return { success: false, error: "Invalid event data" };
      }

      // Transform ISO datetime strings to handle multiple requirements:
      // 1. Zod schema validation requires "HH:MM" strings for startsAt/endsAt
      // 2. addEvent parsing logic requires description to start with "HH:MM - HH:MM | "
      // 3. The Date object needs to be set correctly

      let startsAt = event.startsAt;
      let endsAt = event.endsAt;
      let eventDate = event.date;
      let description = event.description || '';

      // If startsAt is an ISO datetime string, parse it
      if (typeof startsAt === 'string' && startsAt.includes('T')) {
        // Use imported dayjs to handle parsing
        const startDayjs = dayjs(startsAt);
        const endDayjs = dayjs(endsAt);

        // Helper to format as HH:MM
        const formatTime = (d: any) => {
          return d.format('HH:mm');
        };

        const startTimeStr = formatTime(startDayjs);
        const endTimeStr = formatTime(endDayjs);

        // Update to HH:MM format for validation
        startsAt = startTimeStr;
        endsAt = endTimeStr;

        // For validation, date must be a Date object. 
        // Our updated useCalendarEvents hook now handles Date objects correctly for string interpolation.
        eventDate = startDayjs.toDate();

        // Prepend time to description for addEvent parsing logic
        description = `${startTimeStr} - ${endTimeStr} | ${description}`;
      }

      // Ensure the event has all required fields before passing to addEvent
      const formattedEvent: CalendarEventType = {
        id: event.id || crypto.randomUUID(),
        title: event.title,
        description: description,
        date: eventDate,
        startsAt: startsAt,
        endsAt: endsAt,
        color: event.color || 'bg-purple-500/70',
        isLocked: event.isLocked || false,
        isTodo: event.isTodo || false,
        hasAlarm: event.hasAlarm || false,
        hasReminder: event.hasReminder || false,
        todoId: event.todoId,
        isRecurring: event.isRecurring,
        recurrenceRule: event.recurrenceRule,
        calendarId: event.calendarId,
      };

      logger.debug('Calendar', 'Formatted event ready for addEvent', {
        title: formattedEvent.title,
        startsAt: formattedEvent.startsAt,
        endsAt: formattedEvent.endsAt,
        description: formattedEvent.description
      });

      // Use the addEvent function from the hook
      const result = await addEvent(formattedEvent);

      if (result.success) {
        logger.info('Calendar', 'Event successfully added', { title: event.title });
        toast.success(`Event "${event.title}" scheduled successfully`);

        // Auto-sync to Google Calendar if enabled
        if (syncEnabled && formattedEvent.source !== 'google') {
          const googleId = await pushEventToGoogle({ ...formattedEvent, id: result.data?.id || '' });
          if (googleId && result.data?.id) {
            await updateEvent(result.data.id, { googleEventId: googleId });
          }
        }
      } else {
        const errorMessage = result.error || 'Unknown error';
        logger.error('Calendar', `Failed to add event: ${event.title}`, new Error(String(errorMessage)));
        toast.error('Failed to schedule event');
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Calendar', 'Error scheduling event via MallyAI', error as Error);
      toast.error('Error scheduling event');
      return { success: false, error: errorMessage };
    }
  };

  return (
    <div className="h-screen flex flex-col text-white relative overflow-hidden bg-background">
      <Mainview />
      <BottomMallyAI onScheduleEvent={handleScheduleEvent} />
      <MobileNavigation />
    </div>
  );
};

export default Calendar;
