
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getWeekDays } from "@/lib/getTime";
import { useDateStore, useEventStore } from "@/lib/store";
import dayjs from "dayjs";
import { ScrollArea } from "@/components/ui/scroll-area";
import AddEventButton from "@/components/calendar/AddEventButton";
import EventForm from "@/components/calendar/EventForm";
import EventDetails from "@/components/calendar/EventDetails";
import WeekHeader from "./calendar/week-view/WeekHeader";
import TimeColumn from "./calendar/week-view/TimeColumn";
import DayColumn from "./calendar/week-view/DayColumn";
import {
  handleDragOver,
  handleDrop as libHandleDrop,
  RecurringDropResult,
} from "./calendar/week-view/DragDropHandlers";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { CalendarEventType } from "@/lib/stores/types";
import { toast } from "sonner";
import { useTodos } from "@/hooks/use-todos";
import TodoCalendarDialog from "@/components/calendar/integration/TodoCalendarDialog";
import { useTodoCalendarIntegration } from "@/hooks/use-todo-calendar-integration";
import { useBulkSelection } from "@/hooks/use-bulk-selection";
import { BulkActionToolbar } from "@/components/calendar";
import { generateRecurringInstances } from "@/lib/utils/recurring-events";
import { RecurringEventEditDialog } from "@/components/calendar/RecurringEventEditDialog";
import { EditScope } from "@/hooks/use-recurring-events";

const WeekView = () => {
  const [currentTime, setCurrentTime] = useState(dayjs());
  const { userSelectedDate } = useDateStore();
  const {
    openEventSummary,
    toggleEventLock,
    isEventSummaryOpen,
    closeEventSummary,
  } = useEventStore();
  const { events, updateEvent, addEvent, addRecurrenceException } = useCalendarEvents();
  const { linkTodoToEvent, deleteTodo } = useTodos();
  const {
    isBulkMode,
    selectedIds,
    selectedCount,
    toggleSelection,
    isSelected,
    deselectAll,
    bulkDelete,
    bulkUpdateColor,
    bulkReschedule,
    bulkDuplicate,
  } = useBulkSelection();
  const [formOpen, setFormOpen] = useState(false);
  const [selectedTime, setSelectedTime] = useState<
    { date: Date; startTime: string } | undefined
  >();
  const [todoData, setTodoData] = useState<any>(null);
  const [pendingTimeSelection, setPendingTimeSelection] = useState<{
    day: dayjs.Dayjs;
    hour: dayjs.Dayjs;
  } | null>(null);
  
  // State for recurring event drop dialog
  const [recurringDropDialogOpen, setRecurringDropDialogOpen] = useState(false);
  const [pendingRecurringDrop, setPendingRecurringDrop] = useState<RecurringDropResult | null>(null);
  const [recurringEventForDialog, setRecurringEventForDialog] = useState<CalendarEventType | null>(null);

  const {
    isTodoCalendarDialogOpen,
    currentTodoData,
    showTodoCalendarDialog,
    hideTodoCalendarDialog,
    handleCreateBoth,
    handleCreateCalendarOnly,
    handleCreateTodoFromEvent
  } = useTodoCalendarIntegration();
  
  // Handler for when a recurring event is dropped
  const handleRecurringEventDrop = useCallback((result: RecurringDropResult) => {
    if (!result.isRecurring) return;
    
    // Find the parent event to show in dialog
    const parentEvent = events.find(e => 
      e.id === result.parentId || 
      e.id.startsWith(result.parentId || '')
    );
    
    if (parentEvent) {
      setRecurringEventForDialog(parentEvent);
      setPendingRecurringDrop(result);
      setRecurringDropDialogOpen(true);
    } else if (result.newEvent) {
      // If we can't find parent, just create the single instance
      addEvent(result.newEvent);
      toast.success("Event moved");
    }
  }, [events, addEvent]);
  
  // Handle confirmation from recurring event dialog
  const handleRecurringDropConfirm = useCallback(async (scope: EditScope) => {
    if (!pendingRecurringDrop || !pendingRecurringDrop.newEvent) return;
    
    const { parentId, originalDate, newEvent } = pendingRecurringDrop;
    
    try {
      if (scope === 'single') {
        // Move only this occurrence - create new event and add exception to parent
        await addEvent(newEvent);
        if (parentId && originalDate && addRecurrenceException) {
          await addRecurrenceException(parentId, originalDate);
        }
        toast.success("This occurrence has been moved");
      } else if (scope === 'all') {
        // Move all occurrences - update the parent event's time
        const parentEvent = events.find(e => e.id === parentId);
        if (parentEvent) {
          const updatedParent = {
            ...parentEvent,
            startsAt: newEvent.startsAt,
            endsAt: newEvent.endsAt,
            date: newEvent.date,
          };
          await updateEvent(updatedParent);
          toast.success("All occurrences have been updated");
        }
      } else if (scope === 'thisAndFuture') {
        // Move this and future - add exception to parent and create new recurring event
        if (parentId && originalDate && addRecurrenceException) {
          await addRecurrenceException(parentId, originalDate);
        }
        // Create a new recurring event from this date forward
        const parentEvent = events.find(e => e.id === parentId);
        if (parentEvent) {
          const newRecurring: CalendarEventType = {
            ...newEvent,
            isRecurring: true,
            recurrenceRule: parentEvent.recurrenceRule,
          };
          await addEvent(newRecurring);
          toast.success("This and future occurrences have been moved");
        } else {
          await addEvent(newEvent);
          toast.success("Event moved");
        }
      }
    } catch (error) {
      console.error("Error handling recurring drop:", error);
      toast.error("Failed to move event");
    }
    
    setPendingRecurringDrop(null);
    setRecurringEventForDialog(null);
  }, [pendingRecurringDrop, events, addEvent, updateEvent, addRecurrenceException]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(dayjs());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (pendingTimeSelection) {
      const { day, hour } = pendingTimeSelection;

      setSelectedTime({
        date: day.toDate(),
        startTime: hour.format("HH:00"),
      });

      setTimeout(() => {
        setFormOpen(true);
        setPendingTimeSelection(null);
      }, 0);
    }
  }, [pendingTimeSelection]);

  // Get week days for the current view
  const weekDays = getWeekDays(userSelectedDate);

  // Expand recurring events into instances for the current week view
  const expandedEvents = useMemo(() => {
    if (!weekDays.length) {
      return events;
    }
    
    // weekDays returns { currentDate, today } objects, not dayjs directly
    const weekStart = weekDays[0].currentDate.startOf('day').toDate();
    const weekEnd = weekDays[weekDays.length - 1].currentDate.endOf('day').toDate();
    
    const allInstances: CalendarEventType[] = [];
    
    events.forEach(event => {
      if (event.isRecurring && event.recurrenceRule) {
        try {
          const instances = generateRecurringInstances(event, weekStart, weekEnd);
          allInstances.push(...instances);
        } catch (e) {
          console.error('Error generating recurring instances:', e);
          allInstances.push(event);
        }
      } else {
        allInstances.push(event);
      }
    });
    
    return allInstances;
  }, [events, userSelectedDate]);

  const getEventsForDay = (day: dayjs.Dayjs) => {
    const dayStr = day.format("YYYY-MM-DD");
    return expandedEvents.filter((event) => {
      // Check both date field and startsAt
      if (event.date === dayStr) return true;
      if (event.startsAt) {
        const eventDate = dayjs(event.startsAt).format("YYYY-MM-DD");
        return eventDate === dayStr;
      }
      return false;
    });
  };

  const handleTimeSlotClick = (day: dayjs.Dayjs, hour: dayjs.Dayjs) => {
    setTodoData(null);
    setPendingTimeSelection({ day, hour });
  };

  const openEventForm = (todoData: any, date: Date, startTime: string) => {
    console.log(
      "Opening event form with todo data:",
      todoData,
      date,
      startTime
    );
    setTodoData(todoData);

    const dayObj = dayjs(date);
    const hourObj = dayjs(date).hour(parseInt(startTime.split(":")[0]));

    setPendingTimeSelection({ day: dayObj, hour: hourObj });
  };

  const handleDrop = (e: React.DragEvent, day: dayjs.Dayjs, hour: dayjs.Dayjs) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("🎯 DROP EVENT FIRED on week-view");
    console.log("🎯 Available data types:", e.dataTransfer.types);
    try {
      let dataString = e.dataTransfer.getData('application/json');
      console.log("🎯 DROP - application/json:", dataString);
      
      if (!dataString) {
        dataString = e.dataTransfer.getData('text/plain');
        console.log("🎯 DROP - text/plain fallback:", dataString);
      }
      
      if (!dataString) {
        dataString = e.dataTransfer.getData('text');
        console.log("🎯 DROP - text fallback:", dataString);
      }
      
      if (!dataString) {
        console.error("❌ No data found in drag event");
        return;
      }

      const data = JSON.parse(dataString);
      console.log("🎯 DROP - Parsed data:", data);

      if (data.source === 'todo-module' || data.source === 'eisenhower') {
        console.log("✅ Todo/Eisenhower drop detected, showing dialog...");
        const rect = e.currentTarget.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const hourHeight = rect.height;
        const minutesWithinHour = Math.floor((relativeY / hourHeight) * 60);

        const snappedMinutes = minutesWithinHour < 30 ? 0 : 30;

        const baseHour = hour.hour();
        const startTime = `${baseHour.toString().padStart(2, '0')}:${snappedMinutes.toString().padStart(2, '0')}`;

        console.log("📅 Calling showTodoCalendarDialog with:", data, day.toDate(), startTime);
        showTodoCalendarDialog(data, day.toDate(), startTime);
        return;
      }

      // Pass addEvent and recurring handler to handleDrop
      libHandleDrop(
        e, 
        day, 
        hour, 
        updateEvent, 
        addEvent, 
        undefined, // openEventForm
        addRecurrenceException, // for adding exceptions
        handleRecurringEventDrop // callback for recurring events
      );
    } catch (error) {
      console.error("❌ Error handling drop:", error);
      toast.error("Failed to process drop event");
    }
  };

  const handleUpdateEvent = async (event: CalendarEventType): Promise<void> => {
    await updateEvent(event);
  };

  const handleAddEvent = async (event: CalendarEventType): Promise<void> => {
    await addEvent(event);
  };

  const handleSaveEvent = async (event: CalendarEventType) => {
    try {
      if (event.isTodo && !event.todoId) {
        const newTodoId = await handleCreateTodoFromEvent(event);
        if (newTodoId) {
          event.todoId = newTodoId;
        }
      }

      const response = await addEvent(event);

      if (response.success) {
        setFormOpen(false);
        toast.success(`${event.title} has been added to your calendar.`);
      } else {
        toast.error(response.error
          ? String(response.error)
          : "Failed to add event");
      }
    } catch (error) {
      console.error("Error adding event:", error);
      toast.error("An unexpected error occurred");
    }
  };

  return (
    <>
      <div className="glass mx-2 my-2 rounded-xl overflow-hidden">
        <WeekHeader userSelectedDate={userSelectedDate} />

        <ScrollArea className="h-[calc(100vh-160px)]">
          <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_1fr] px-4 py-2">
            <TimeColumn />
            {getWeekDays(userSelectedDate).map(({ currentDate }, index) => {
              const dayEvents = getEventsForDay(currentDate);

              return (
                <DayColumn
                  key={index}
                  currentDate={currentDate}
                  dayEvents={dayEvents}
                  currentTime={currentTime}
                  onTimeSlotClick={handleTimeSlotClick}
                  onDragOver={handleDragOver}
                  onDrop={(e, day, hour) => handleDrop(e, day, hour)}
                  openEventSummary={openEventSummary}
                  toggleEventLock={toggleEventLock}
                  isBulkMode={isBulkMode}
                  isSelected={isSelected}
                  onToggleSelection={toggleSelection}
                />
              );
            })}
          </div>
        </ScrollArea>
      </div>
      <AddEventButton />

      {isBulkMode && selectedCount > 0 && (
        <BulkActionToolbar
          selectedCount={selectedCount}
          onDelete={bulkDelete}
          onUpdateColor={bulkUpdateColor}
          onReschedule={bulkReschedule}
          onDuplicate={bulkDuplicate}
          onDeselectAll={deselectAll}
        />
      )}

      <EventForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setTodoData(null);
        }}
        initialTime={selectedTime}
        todoData={todoData}
        onSave={handleSaveEvent}
      />

      <EventDetails open={isEventSummaryOpen} onClose={closeEventSummary} />

      {currentTodoData && (
        <TodoCalendarDialog
          open={isTodoCalendarDialogOpen}
          onClose={hideTodoCalendarDialog}
          todoTitle={currentTodoData.text}
          onCreateBoth={handleCreateBoth}
          onCreateCalendarOnly={handleCreateCalendarOnly}
        />
      )}
      
      {/* Recurring Event Edit Dialog for drag-drop operations */}
      {recurringEventForDialog && (
        <RecurringEventEditDialog
          open={recurringDropDialogOpen}
          onOpenChange={setRecurringDropDialogOpen}
          event={recurringEventForDialog}
          action="edit"
          onConfirm={handleRecurringDropConfirm}
          onCancel={() => {
            setPendingRecurringDrop(null);
            setRecurringEventForDialog(null);
          }}
        />
      )}
    </>
  );
};

export default WeekView;
