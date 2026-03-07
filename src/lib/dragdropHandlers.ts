import { toast } from "sonner";
import { CalendarEventType } from "@/lib/stores/types";
import dayjs from "dayjs";
import { formatMinutesAsTime, getTimeInMinutes } from "@/components/calendar/event-utils/touch-handlers";
import { nanoid } from "@/lib/utils";
import type { CreateEntityLinkInput, EntityType } from "@/lib/entity-links/types";

export interface TodoDragData {
  id: string;
  text: string;
  source: string; // 'todo-module' | 'eisenhower' | 'alarm' | 'reminder'
  completed?: boolean;
  /** Which Firestore collection this item lives in ('todos' | 'todo_items') */
  collectionName?: 'todos' | 'todo_items';
}

/** Drag data for any linkable entity — superset of TodoDragData */
export interface EntityDragData {
  id: string;
  text: string;
  source: string;
  entityType: EntityType; // 'todo' | 'event' | 'alarm' | 'reminder' | 'eisenhower'
  completed?: boolean;
  time?: string; // For alarms/reminders: the time value
}

export interface DragHandlerOptions {
  updateEventFn: (event: CalendarEventType) => Promise<any>;
  addEventFn: (event: CalendarEventType) => Promise<any>;
  linkTodoToEventFn: (todoId: string, eventId: string, collectionName?: string) => Promise<any>;
  deleteTodoFn?: (todoId: string) => Promise<any>;
  onShowTodoCalendarDialog: (todoData: TodoDragData, date: Date, startTime: string) => void;
  /** New: entity link function from useEntityLinks */
  createEntityLinkFn?: (input: CreateEntityLinkInput) => Promise<string | null>;
}

export const handleDragOver = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = 'move';
};

// Create a calendar event from a todo item
export const createCalendarEventFromTodo = async (
  todoData: TodoDragData,
  date: Date,
  startTime: string,
  keepTodo: boolean,
  options: DragHandlerOptions
): Promise<string | null> => {
  if (!options.addEventFn || !todoData || !todoData.id || !todoData.text) {
    console.error("Invalid todo data or missing functions");
    return null;
  }

  try {
    // Format day and time
    const day = dayjs(date);
    const eventDate = day.format('YYYY-MM-DD');

    // Calculate end time (1 hour after start by default)
    const startHour = parseInt(startTime.split(':')[0]);
    const startMinute = parseInt(startTime.split(':')[1] || '0');
    const endHour = (startHour + 1) % 24;
    const endTime = `${endHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;

    // Format ISO strings for startsAt and endsAt
    let startDateTime = day.hour(startHour).minute(startMinute).second(0);
    let endDateTime = day.hour(endHour).minute(startMinute).second(0);

    // Soft warning for past dates — still allow the event creation
    const now = dayjs();
    if (startDateTime.isBefore(now)) {
      const isToday = startDateTime.isSame(now, 'day');

      if (isToday) {
        // If scheduling for earlier today, nudge to next available slot
        const currentHour = now.hour();
        const currentMinute = now.minute();
        const nextSlot = currentMinute < 30 ? 30 : 0;
        const nextHour = currentMinute < 30 ? currentHour : currentHour + 1;

        const suggestedStart = now.minute(nextSlot).hour(nextHour).second(0);
        const suggestedEnd = suggestedStart.add(1, 'hour');

        toast.info(`Time adjusted`, {
          description: `${startTime} already passed — scheduled for ${suggestedStart.format('h:mm A')} instead.`,
          duration: 4000,
        });

        startDateTime = suggestedStart;
        endDateTime = suggestedEnd;
      }
      // Past dates are allowed — no block, just proceed
    }

    // Update eventDate and times to match the validated startDateTime
    const finalEventDate = startDateTime.format('YYYY-MM-DD');
    const finalStartTime = startDateTime.format('HH:mm');
    const finalEndTime = endDateTime.format('HH:mm');

    // Create a new calendar event from the todo item
    const newEvent: CalendarEventType = {
      id: nanoid(), // This will be replaced by the database
      title: todoData.text,
      date: finalEventDate,
      description: `${finalStartTime} - ${finalEndTime} | ${todoData.text}`,
      color: 'bg-purple-500/70', // Special color for todo events
      isTodo: true, // Mark as a todo event
      todoId: keepTodo ? todoData.id : undefined, // Reference to original todo if keeping both
      startsAt: startDateTime.toISOString(),
      endsAt: endDateTime.toISOString()
    };

    console.log("Creating new calendar event from todo:", newEvent);

    // Add the event to the database
    const response = await options.addEventFn(newEvent);

    if (response.success) {
      // FIX: addEvent returns { data: { id } }, not { data: [{ id }] }
      const newEventId = response.data?.id ?? response.data?.[0]?.id;

      // Link todo to the new event if we're keeping both
      if (keepTodo && newEventId) {
        // Legacy FK link (backward compat)
        await options.linkTodoToEventFn(todoData.id, newEventId, todoData.collectionName);

        // Unified entity link (new system)
        if (options.createEntityLinkFn) {
          const sourceEntityType: EntityType =
            todoData.source === 'eisenhower' ? 'eisenhower' : 'todo';
          await options.createEntityLinkFn({
            sourceType: sourceEntityType,
            sourceId: todoData.id,
            sourceTitle: todoData.text,
            targetType: 'event',
            targetId: newEventId,
            targetTitle: todoData.text,
            relation: 'mirror',
            metadata: { createdVia: 'drag-and-drop' },
          });
        }

        toast.success(`"${todoData.text}" added to calendar`, {
          description: `${startDateTime.format('MMM D, YYYY')} at ${startDateTime.format('h:mm A')}`
        });
        return newEventId;
      }
      // If not keeping the todo, delete it
      else if (!keepTodo && options.deleteTodoFn) {
        await options.deleteTodoFn(todoData.id);
        toast.success(`"${todoData.text}" moved to calendar`, {
          description: `${startDateTime.format('MMM D, YYYY')} at ${startDateTime.format('h:mm A')}`
        });
        return newEventId || null;
      }

      toast.success(`Event added to calendar at ${startTime}`);
      return newEventId || null;
    } else {
      toast.error(`Failed to add: ${response.diagnosticMessage || 'Unknown error'}`);
      return null;
    }
  } catch (error) {
    console.error("Error creating calendar event from todo:", error);
    toast.error("Failed to create calendar event");
    return null;
  }
};

// Create a todo item from a calendar event
export const createTodoFromCalendarEvent = async (
  event: CalendarEventType,
  linkTodoToEventFn: (todoId: string, eventId: string) => Promise<any>,
  addTodoFn: (title: string) => Promise<any>,
  createEntityLinkFn?: (input: CreateEntityLinkInput) => Promise<string | null>
): Promise<string | null> => {
  try {
    if (!event.title || !event.id) {
      console.error("Invalid event data");
      return null;
    }

    // Add the todo to the database
    const response = await addTodoFn(event.title);

    if (response.success && response.todoId) {
      // Legacy FK link
      await linkTodoToEventFn(response.todoId, event.id);

      // Unified entity link
      if (createEntityLinkFn) {
        await createEntityLinkFn({
          sourceType: 'event',
          sourceId: event.id,
          sourceTitle: event.title,
          targetType: 'todo',
          targetId: response.todoId,
          targetTitle: event.title,
          relation: 'mirror',
          metadata: { createdVia: 'context-menu' },
        });
      }

      toast.success(`"${event.title}" added to todo list`);
      return response.todoId;
    } else {
      toast.error(`Failed to add todo: ${response.message || 'Unknown error'}`);
      return null;
    }
  } catch (error) {
    console.error("Error creating todo from calendar event:", error);
    toast.error("Failed to create todo item");
    return null;
  }
};

// Updates an existing todo item with new title from calendar event
export const syncEventTitleWithTodo = async (
  eventId: string,
  todoId: string,
  newTitle: string,
  updateTodoFn: (id: string, title: string) => Promise<any>
): Promise<boolean> => {
  try {
    if (!todoId || !newTitle.trim()) {
      return false;
    }

    // Update the todo with the new title from the event
    const response = await updateTodoFn(todoId, newTitle);

    if (response?.success) {
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error syncing event ${eventId} title with todo ${todoId}:`, error);
    return false;
  }
};

export const handleDrop = (
  e: React.DragEvent,
  day: dayjs.Dayjs,
  hour: dayjs.Dayjs,
  options: DragHandlerOptions
) => {
  e.preventDefault();

  try {
    // Get the drag data
    const dataString = e.dataTransfer.getData('application/json');
    if (!dataString) {
      console.error("No data found in drag event");
      return;
    }

    const data = JSON.parse(dataString);
    console.log("Received drop data:", data);

    // Handle todo item or eisenhower item drag
    if (data.source === 'todo-module' || data.source === 'eisenhower') {
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

      // Show the integration dialog
      options.onShowTodoCalendarDialog(data, day.toDate(), startTime);
      return;
    }

    // Don't process if the event is locked
    if (data.isLocked) return;

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
    const descriptionParts = (data.description || '').split('|');
    const descriptionText = descriptionParts.length > 1 ? descriptionParts[1].trim() : (data.description || '');

    // Create the updated event
    const updatedEvent = {
      ...data,
      date: day.format('YYYY-MM-DD'), // Set to the drop target day
      description: `${newStartTime} - ${newEndTime} | ${descriptionText}`,
      startsAt: day.hour(parseInt(newStartTime.split(':')[0])).minute(parseInt(newStartTime.split(':')[1])).toISOString(),
      endsAt: day.hour(parseInt(newEndTime.split(':')[0])).minute(parseInt(newEndTime.split(':')[1])).toISOString()
    };

    // Update the event in the store
    options.updateEventFn(updatedEvent);

    // Show success message
    toast.success(`Event moved to ${day.format("MMM D")} at ${newStartTime}`);

  } catch (error) {
    console.error("Error handling drop:", error);
    toast.error("Failed to move event");
  }
};
