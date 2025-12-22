
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import EventForm from "@/components/calendar/EventForm";
import { useState, useMemo } from "react";
import { CalendarEventType } from "@/lib/stores/types";
import { toast } from "@/components/ui/use-toast";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import dayjs from "dayjs";

const AddEventButton = () => {
  const { addEvent: dbAddEvent } = useCalendarEvents();
  const [open, setOpen] = useState(false);

  // Calculate the initial time: today's date with the next hour
  const initialTime = useMemo(() => {
    const now = dayjs();
    // Get the next hour (if it's 2:30, next hour is 3:00)
    const nextHour = now.add(1, 'hour').startOf('hour');
    
    return {
      date: now.toDate(),
      startTime: nextHour.format("HH:00"),
    };
  }, [open]); // Recalculate when dialog opens

  const handleSaveEvent = async (event: CalendarEventType) => {
    // Generate a random color for the event
    const colors = [
      'bg-[hsl(var(--event-red))]',
      'bg-[hsl(var(--event-green))]',
      'bg-[hsl(var(--event-blue))]',
      'bg-[hsl(var(--event-purple))]',
      'bg-[hsl(var(--event-teal))]',
      'bg-[hsl(var(--event-orange))]',
      'bg-[hsl(var(--event-pink))]',
    ];
    
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    
    // Create the event with a temporary ID (will be replaced by DB)
    const newEvent = {
      ...event,
      id: event.id || crypto.randomUUID(),
      color: event.color || randomColor,
    };
    
    try {
      // Add to database and update store if successful
      const response = await dbAddEvent(newEvent);
      
      if (response.success) {
        setOpen(false);
        
        toast({
          title: "Event Added",
          description: `${event.title} has been added to your calendar.`,
        });
      } else {
        toast({
          title: "Error",
          description: response.error ? String(response.error) : "Failed to add event",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error adding event:", error);
      toast({
        title: "Error",
        description: "Failed to add event. Please try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <>
      <Button 
        size="icon" 
        className="h-14 w-14 rounded-full fixed bottom-20 right-8 z-50 shadow-lg bg-primary hover:bg-primary/90"
        aria-label="Add event"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-6 w-6" />
      </Button>
      
      {/* Use the same EventForm dialog as time slot click */}
      <EventForm 
        open={open}
        onClose={() => setOpen(false)}
        initialTime={initialTime}
        onSave={handleSaveEvent}
      />
    </>
  );
};

export default AddEventButton;
