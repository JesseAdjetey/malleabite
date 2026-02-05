
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

const Calendar = () => {
  const { addEvent } = useCalendarEvents();
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
      
      // Transform ISO datetime strings to the format addEvent expects
      // The AI sends full ISO strings like "2026-02-06T05:00:00Z"
      // We need to parse these and pass to addEvent which handles the conversion
      let startsAt = event.startsAt;
      let endsAt = event.endsAt;
      let eventDate = event.date;
      
      // If startsAt is an ISO datetime string, parse it
      if (typeof startsAt === 'string' && startsAt.includes('T')) {
        const startDate = new Date(startsAt);
        eventDate = eventDate || startDate;
        // Keep the ISO string - addEvent handles this format
      }
      
      // Ensure the event has all required fields before passing to addEvent
      const formattedEvent: CalendarEventType = {
        id: event.id || crypto.randomUUID(),
        title: event.title,
        description: event.description || '',
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
        endsAt: formattedEvent.endsAt
      });
      
      // Use the addEvent function from the hook - skip Zod validation for AI events
      // The addEvent function handles the ISO datetime format properly
      const result = await addEvent(formattedEvent);
      
      if (result.success) {
        logger.info('Calendar', 'Event successfully added', { title: event.title });
        toast.success(`Event "${event.title}" scheduled successfully`);
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
