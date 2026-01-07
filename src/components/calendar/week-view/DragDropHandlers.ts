
import { toast } from "sonner";
import { CalendarEventType } from "@/lib/stores/types";
import dayjs from "dayjs";
import { formatMinutesAsTime, getTimeInMinutes } from "../event-utils/touch-handlers";
import { nanoid } from "nanoid";
import { useCalendarEvents } from "@/hooks/use-calendar-events";

export const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault();
  // Show copy cursor when Ctrl is held
  e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
};

// Result type for recurring event actions
export interface RecurringDropResult {
  isRecurring: boolean;
  parentId?: string;
  originalDate?: string;
  newEvent?: CalendarEventType;
}

export const handleDrop = (
  e: React.DragEvent, 
  day: dayjs.Dayjs, 
  hour: dayjs.Dayjs,
  updateEventFn: (event: CalendarEventType) => Promise<any>,
  addEventFn?: (event: CalendarEventType) => Promise<any>,
  openEventForm?: (todoData: any, date: Date, timeStart: string) => void,
  addRecurrenceExceptionFn?: (parentId: string, exceptionDate: string) => Promise<any>,
  onRecurringEventDrop?: (result: RecurringDropResult) => void
) => {
  e.preventDefault();
  
  // Check if Ctrl was held during drop (duplicate mode)
  const isDuplicateMode = e.ctrlKey;
  
  try {
    // Get the drag data
    const dataString = e.dataTransfer.getData('application/json');
    if (!dataString) {
      console.error("No data found in drag event");
      return;
    }
    
    const data = JSON.parse(dataString);
    console.log("Week view received drop data:", data, "Duplicate mode:", isDuplicateMode);
    
    // Handle todo item drag
    if (data.source === 'todo-module') {
      // If we have the openEventForm function, use it instead of immediately creating an event
      if (openEventForm) {
        // Calculate precise drop time based on cursor position
        const rect = e.currentTarget.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const hourHeight = rect.height;
        const minutesWithinHour = Math.floor((relativeY / hourHeight) * 60);
        
        // Snap to nearest 30-minute interval (0 or 30)
        const snappedMinutes = minutesWithinHour < 30 ? 0 : 30;
        
        // Get the base hour and add the snapped minutes
        const baseHour = hour.hour();
        const startTime = `${baseHour.toString().padStart(2, '0')}:${snappedMinutes.toString().padStart(2, '0')}`;
        
        // Open the event form with the todo data
        openEventForm(data, day.toDate(), startTime);
        return;
      }
      
      if (addEventFn) {
        handleTodoDrop(data, day, hour, addEventFn);
      }
      return;
    }
    
    // Don't process if the event is locked
    if (data.isLocked) {
      toast.info("Event is locked. Unlock it first to move.");
      return;
    }
    
    // Calculate precise drop time based on cursor position
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const hourHeight = rect.height;
    const minutesWithinHour = Math.floor((relativeY / hourHeight) * 60);
    
    // Snap to nearest 30-minute interval (0 or 30)
    const snappedMinutes = minutesWithinHour < 30 ? 0 : 30;
    
    // Get the base hour and add the snapped minutes
    const baseHour = hour.hour();
    const totalMinutes = baseHour * 60 + snappedMinutes;
    
    // Format as HH:MM
    const newStartTime = formatMinutesAsTime(totalMinutes);
    
    // Calculate new end time by preserving duration
    const oldStartMinutes = getTimeInMinutes(data.timeStart);
    const oldEndMinutes = getTimeInMinutes(data.timeEnd);
    const durationMinutes = oldEndMinutes - oldStartMinutes;
    
    const newEndMinutes = totalMinutes + durationMinutes;
    const newEndTime = formatMinutesAsTime(newEndMinutes);
    
    // Get description without time part
    const descriptionParts = data.description?.split('|') || [];
    const descriptionText = descriptionParts.length > 1 ? descriptionParts[1].trim() : data.title || '';
    
    // Check if this is a recurring event instance (has recurrenceParentId or synthetic ID with underscore)
    const isRecurringInstance = data.isRecurring || data.recurrenceParentId || (data.id && data.id.includes('_'));
    
    // Handle recurring event instances - trigger the popup
    if (isRecurringInstance && onRecurringEventDrop) {
      const parentId = data.recurrenceParentId || (data.id.includes('_') ? data.id.split('_')[0] : data.id);
      const originalDate = data.id.includes('_') ? data.id.split('_')[1] : dayjs(data.startsAt).format('YYYY-MM-DD');
      
      // Create the new event that would be created if user confirms
      const newEvent: CalendarEventType = {
        id: nanoid(),
        title: data.title,
        date: day.format('YYYY-MM-DD'),
        description: `${newStartTime} - ${newEndTime} | ${descriptionText}`,
        color: data.color || 'bg-purple-500/70',
        startsAt: day.hour(parseInt(newStartTime.split(':')[0])).minute(parseInt(newStartTime.split(':')[1])).toISOString(),
        endsAt: day.hour(parseInt(newEndTime.split(':')[0])).minute(parseInt(newEndTime.split(':')[1])).toISOString(),
        isRecurring: false,
      };
      
      // Trigger the recurring event edit dialog
      onRecurringEventDrop({
        isRecurring: true,
        parentId,
        originalDate,
        newEvent,
      });
      return;
    }
    
    // For recurring instances without callback, handle directly
    if (isRecurringInstance && addEventFn && !onRecurringEventDrop) {
      const parentId = data.recurrenceParentId || data.id.split('_')[0];
      const originalDate = data.id.includes('_') ? data.id.split('_')[1] : dayjs(data.startsAt).format('YYYY-MM-DD');
      
      // Create new standalone event at the new position
      const newEvent: CalendarEventType = {
        id: nanoid(),
        title: data.title,
        date: day.format('YYYY-MM-DD'),
        description: `${newStartTime} - ${newEndTime} | ${descriptionText}`,
        color: data.color || 'bg-purple-500/70',
        startsAt: day.hour(parseInt(newStartTime.split(':')[0])).minute(parseInt(newStartTime.split(':')[1])).toISOString(),
        endsAt: day.hour(parseInt(newEndTime.split(':')[0])).minute(parseInt(newEndTime.split(':')[1])).toISOString(),
        isRecurring: false,
        recurrenceParentId: parentId, // Keep reference to parent for tracking
      };
      
      console.log("Creating standalone event from recurring instance:", newEvent);
      
      // Add the new event
      addEventFn(newEvent).then(response => {
        if (response.success) {
          // If we have the function to add exceptions, use it
          if (addRecurrenceExceptionFn) {
            addRecurrenceExceptionFn(parentId, originalDate);
          }
          toast.success(`Moved this occurrence to ${day.format("MMM D")} at ${newStartTime}`);
        } else {
          toast.error("Failed to move event");
        }
      });
      
      return;
    }
    
    // DUPLICATE MODE: If Ctrl is held, create a copy instead of moving
    if (isDuplicateMode && addEventFn) {
      const duplicateEvent: CalendarEventType = {
        id: nanoid(), // New ID for the duplicate
        title: data.title,
        date: day.format('YYYY-MM-DD'),
        description: `${newStartTime} - ${newEndTime} | ${descriptionText}`,
        color: data.color || 'bg-purple-500/70',
        startsAt: day.hour(parseInt(newStartTime.split(':')[0])).minute(parseInt(newStartTime.split(':')[1])).toISOString(),
        endsAt: day.hour(parseInt(newEndTime.split(':')[0])).minute(parseInt(newEndTime.split(':')[1])).toISOString(),
        isRecurring: false, // Duplicates are not recurring by default
        isTodo: data.isTodo,
        hasAlarm: data.hasAlarm,
        hasReminder: data.hasReminder,
      };
      
      console.log("Duplicating event:", duplicateEvent);
      
      addEventFn(duplicateEvent).then(response => {
        if (response.success) {
          toast.success(`Event duplicated to ${day.format("MMM D")} at ${newStartTime}`);
        } else {
          toast.error("Failed to duplicate event");
        }
      });
      
      return;
    }
    
    // MOVE MODE: For regular events, UPDATE (don't add) the event
    // Make sure we have the original event ID
    if (!data.id) {
      console.error("Cannot update event: missing event ID");
      toast.error("Failed to move event: missing ID");
      return;
    }
    
    // Extract the real ID (not the synthetic one with date suffix)
    const realEventId = data.id.includes('_') ? data.id.split('_')[0] : data.id;
    
    const updatedEvent: CalendarEventType = {
      ...data,
      id: realEventId, // Use the real event ID
      date: day.format('YYYY-MM-DD'),
      description: `${newStartTime} - ${newEndTime} | ${descriptionText}`,
      startsAt: day.hour(parseInt(newStartTime.split(':')[0])).minute(parseInt(newStartTime.split(':')[1])).toISOString(),
      endsAt: day.hour(parseInt(newEndTime.split(':')[0])).minute(parseInt(newEndTime.split(':')[1])).toISOString(),
    };
    
    console.log("Moving event (UPDATE, not add):", updatedEvent);
    
    // Update the event in the store - this should UPDATE, not ADD
    updateEventFn(updatedEvent).then(response => {
      if (response?.success !== false) {
        toast.success(`Event moved to ${day.format("MMM D")} at ${newStartTime}`);
      } else {
        toast.error("Failed to move event");
      }
    }).catch(err => {
      console.error("Error updating event:", err);
      toast.error("Failed to move event");
    });
    
  } catch (error) {
    console.error("Error handling drop:", error);
    toast.error("Failed to move event");
  }
};

// Handle dropping a todo item onto the calendar
const handleTodoDrop = async (
  todoData: any,
  day: dayjs.Dayjs,
  hour: dayjs.Dayjs,
  addEventFn: (event: CalendarEventType) => Promise<any>
) => {
  if (!addEventFn || !todoData || !todoData.id || !todoData.text) {
    console.error("Invalid todo data or missing addEvent function:", todoData);
    return;
  }
  
  // Format time strings
  const startTime = hour.format("HH:00");
  const endTime = hour.add(1, 'hour').format("HH:00");
  const eventDate = day.format('YYYY-MM-DD');
  
  // Format ISO strings for startsAt and endsAt
  const startDateTime = day.hour(parseInt(startTime.split(':')[0]));
  const endDateTime = day.hour(parseInt(endTime.split(':')[0]));
  
  // Create a new calendar event from the todo item
  const newEvent: CalendarEventType = {
    id: nanoid(), // This will be replaced by the database
    title: todoData.text,
    date: eventDate,
    description: `${startTime} - ${endTime} | ${todoData.text}`,
    color: 'bg-purple-500/70', // Special color for todo events
    isTodo: true, // Mark as a todo event
    todoId: todoData.id, // Reference back to original todo
    startsAt: startDateTime.toISOString(),
    endsAt: endDateTime.toISOString()
  };
  
  console.log("Week view adding new event from todo:", newEvent);
  
  try {
    // Add the event to the database
    const response = await addEventFn(newEvent);
    
    if (response.success) {
      // Show success message
      toast.success(`Todo "${todoData.text}" added to calendar at ${startTime}`);
    } else {
      toast.error(`Failed to add todo: ${response.message}`);
    }
  } catch (error) {
    console.error("Error adding event from todo:", error);
    toast.error("Failed to add todo to calendar");
  }
};
