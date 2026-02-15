
// src/components/calendar/EventForm.tsx

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { nanoid } from "nanoid";
import EnhancedEventForm from "./EnhancedEventForm";
import { toast } from "@/components/ui/use-toast";
import { CalendarEventType } from "@/lib/stores/types";
import { useCalendarEvents } from "@/hooks/use-calendar-events";

interface EventFormProps {
  open: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  initialTime?: {
    date: Date;
    startTime: string;
  };
  todoData?: any;
  onSave?: (event: any) => void;
}

const EventForm: React.FC<EventFormProps> = ({
  open,
  onClose,
  onCancel,
  initialTime,
  todoData,
  onSave: propOnSave,
}) => {
  const { addEvent } = useCalendarEvents();
  const [initialEvent, setInitialEvent] = useState<CalendarEventType | undefined>(undefined);

  // Use onCancel or onClose, whichever is provided
  const handleClose = onCancel || onClose;

  // Log initialTime for debugging
  useEffect(() => {
    if (initialTime) {
      console.log("EventForm received initialTime:", initialTime);
    }
  }, [initialTime]);

  // Prepare initial event data when props change
  useEffect(() => {
    if (initialTime) {
      // Start with time data - make sure we have the current initialTime
      console.log("Setting initialEvent with time:", initialTime.startTime);

      try {
        const startDate = initialTime.date.toISOString().split("T")[0];
        const startHour = parseInt(initialTime.startTime.split(":")[0]);
        const startMinutes = parseInt(initialTime.startTime.split(":")[1] || "0");

        const startTimeFormatted = `${startHour.toString().padStart(2, "0")}:${startMinutes.toString().padStart(2, "0")}`;
        const startsAt = new Date(`${startDate}T${startTimeFormatted}:00`);

        const endHour = (startHour + 1) % 24;
        const endTime = `${endHour.toString().padStart(2, "0")}:${startMinutes.toString().padStart(2, "0")}`;
        const endsAt = new Date(`${startDate}T${endTime}:00`);

        let event: CalendarEventType = {
          id: nanoid(),
          title: "",
          description: `${startTimeFormatted} - ${endTime} | `,
          date: startDate,
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          isLocked: false,
        };

        // If we have todo data, add it
        if (todoData) {
          event = {
            ...event,
            title: todoData.text,
            description: `${startTimeFormatted} - ${endTime} | ${todoData.text}`,
            isTodo: true,
            todoId: todoData.id,
            color: "bg-purple-500/70", // Special color for todo events
          };
        }

        setInitialEvent(event);
      } catch (error) {
        console.error("Error creating initial event:", error);
        toast({
          title: "Error",
          description: "Failed to create event with the selected time",
          variant: "destructive"
        });
      }
    } else {
      setInitialEvent(undefined);
    }
  }, [initialTime, todoData]);

  const handleSave = (event: CalendarEventType) => {
    // Generate a unique ID for the new event if it doesn't have one
    console.log("Event being saved:", event);

    if (propOnSave) {
      propOnSave(event);
    } else {
      addEvent(event);

      // Show a success message
      if (todoData) {
        toast({
          title: "Success",
          description: `Todo "${todoData.text}" added to calendar`,
        });
      } else {
        toast({
          title: "Success",
          description: "Event added to calendar",
        });
      }
    }
    if (handleClose) handleClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => !isOpen && handleClose && handleClose()}
    >
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto bg-background/95 border-white/10">
        <DialogTitle className="sr-only">Add Event</DialogTitle>
        <EnhancedEventForm
          initialEvent={initialEvent}
          onSave={handleSave}
          onCancel={handleClose}
        />
      </DialogContent>
    </Dialog>
  );
};

export default EventForm;
