
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
import DraggableMallyAI from '@/components/ai/DraggableMallyAI';
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
      
      // Validate event using Zod schema
      const validation = eventSchema.safeParse(event);
      if (!validation.success) {
        const errorMessage = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        logger.warn('Calendar', 'Event validation failed', { 
          event, 
          errors: validation.error.errors 
        });
        toast.error(`Invalid event: ${errorMessage}`);
        return { success: false, error: errorMessage };
      }
      
      // Ensure the event has all required fields before passing to addEvent
      const formattedEvent: CalendarEventType = {
        id: event.id || crypto.randomUUID(),
        title: event.title,
        description: event.description,
        date: event.date,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        color: event.color || 'bg-purple-500/70',
        isLocked: event.isLocked || false,
        isTodo: event.isTodo || false,
        hasAlarm: event.hasAlarm || false,
        hasReminder: event.hasReminder || false,
        todoId: event.todoId
      };
      
      logger.debug('Calendar', 'Formatted event ready for addEvent', { 
        title: formattedEvent.title,
        date: formattedEvent.date 
      });
      
      // Use the addEvent function from the hook
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
    <div className="min-h-screen flex flex-col text-white relative pb-16 md:pb-0 bg-background">
      <Mainview />
      <DraggableMallyAI onScheduleEvent={handleScheduleEvent} />
      <MobileNavigation />
    </div>
  );
};

export default Calendar;
