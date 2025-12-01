
import React, { useEffect } from 'react';
import Mainview from '@/components/Mainview';
import { useDateStore, useViewStore } from "@/lib/store";
import { useCalendarEvents } from '@/hooks/use-calendar-events.unified';
import { toast } from 'sonner';
import { CalendarEventType } from '@/lib/stores/types';
import '../styles/ai-animations.css';
import DraggableMallyAI from '@/components/ai/DraggableMallyAI';
import { motion } from 'framer-motion';

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
      console.log("Index component handling MallyAI event:", event);
      
      if (!event || !event.title) {
        console.error("Invalid event data received:", event);
        toast.error("Invalid event data received");
        return { success: false, error: "Invalid event data" };
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
      
      console.log("Formatted event ready for addEvent:", formattedEvent);
      
      // Use the addEvent function from the hook
      const result = await addEvent(formattedEvent);
      
      if (result.success) {
        console.log("Event successfully added:", event.title);
        toast.success(`Event "${event.title}" scheduled successfully`);
      } else {
        console.error("Failed to add event:", result.error);
        toast.error(`Failed to schedule event: ${result.error || "Unknown error"}`);
      }
      
      return result;
    } catch (error) {
      console.error("Error scheduling event via MallyAI:", error);
      toast.error(`Error scheduling event: ${error instanceof Error ? error.message : "Unknown error"}`);
      return { success: false, error };
    }
  };

  return (
    <div className="min-h-screen flex flex-col text-white relative">
      <Mainview />
      <DraggableMallyAI onScheduleEvent={handleScheduleEvent} />
    </div>
  );
};

export default Index;
