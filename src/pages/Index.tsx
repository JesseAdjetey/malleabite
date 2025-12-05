
import React, { useEffect } from 'react';
import Mainview from '@/components/Mainview';
import { useDateStore, useViewStore } from "@/lib/store";
import { useCalendarEvents } from '@/hooks/use-calendar-events.unified';
import { toast } from 'sonner';
import { CalendarEventType } from '@/lib/stores/types';
import '../styles/ai-animations.css';
import DraggableMallyAI from '@/components/ai/DraggableMallyAI';
import MobileNavigation from '@/components/MobileNavigation';
import { motion } from 'framer-motion';
import { eventSchema } from '@/lib/validation';
import { logger } from '@/lib/logger';
import { errorHandler } from '@/lib/error-handler';

const Index = () => {
  const { addEvent } = useCalendarEvents();
  
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
      logger.debug('Index', 'MallyAI event scheduling attempt', event);
      
      if (!event || !event.title) {
        logger.warn('Index', 'Invalid event data received', { event });
        toast.error("Invalid event data received");
        return { success: false, error: "Invalid event data" };
      }
      
      // Validate event using Zod schema
      const validation = eventSchema.safeParse(event);
      if (!validation.success) {
        const errorMessage = validation.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
        logger.warn('Index', 'Event validation failed', { 
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
      
      logger.debug('Index', 'Formatted event ready for addEvent', { 
        title: formattedEvent.title,
        date: formattedEvent.date 
      });
      
      // Use the addEvent function from the hook
      const result = await addEvent(formattedEvent);
      
      if (result.success) {
        logger.info('Index', 'Event successfully added', { title: event.title });
        toast.success(`Event "${event.title}" scheduled successfully`);
      } else {
        logger.error('Index', 'Failed to add event', new Error(result.error || 'Unknown error'), {
          title: event.title
        });
        errorHandler.handleError(
          new Error(result.error || 'Unknown error'),
          'Failed to schedule event',
          'Index'
        );
      }
      
      return result;
    } catch (error) {
      logger.error('Index', 'Error scheduling event via MallyAI', error as Error);
      errorHandler.handleError(
        error as Error,
        'Error scheduling event',
        'Index'
      );
      return { success: false, error };
    }
  };

  return (
    <div className="min-h-screen flex flex-col text-white relative pb-16 md:pb-0">
      <Mainview />
      <DraggableMallyAI onScheduleEvent={handleScheduleEvent} />
      <MobileNavigation />
    </div>
  );
};

export default Index;
