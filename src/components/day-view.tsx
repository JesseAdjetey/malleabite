// src/components/day-view.tsx

import React, { useEffect, useState, useMemo } from "react";
import dayjs from "dayjs";
import { useDateStore, useEventStore } from "@/lib/store";
import AddEventButton from "@/components/calendar/AddEventButton";
import EventForm from "@/components/calendar/EventForm";
import EventDetails from "@/components/calendar/EventDetails";
import DayHeader from "./day-view/DayHeader";
import TimeSlotsGrid from "./day-view/TimeSlotsGrid";
import { useEventCRUD } from "@/hooks/use-event-crud";
import { CalendarEventType } from "@/lib/stores/types";
import { toast } from "@/components/ui/use-toast";
import { useBulkSelection } from "@/hooks/use-bulk-selection";
import { BulkActionToolbar } from "@/components/calendar";
import { generateRecurringInstances } from "@/lib/utils/recurring-events";
import { useTodoCalendarIntegration } from "@/hooks/use-todo-calendar-integration";
import TodoDropDialog from "@/components/calendar/integration/TodoDropDialog";
import TodoLinkedWarningDialog from "@/components/calendar/integration/TodoLinkedWarningDialog";
import { useCalendarFilterStore } from "@/lib/stores/calendar-filter-store";
import { useTemplateModeStore } from "@/lib/stores/template-mode-store";
import { DayAllDayRow, splitAllDayEvents } from "@/components/calendar/AllDaySection";

const DayView = () => {
  const [currentTime, setCurrentTime] = useState(dayjs());
  const { userSelectedDate } = useDateStore();
  const { events, isEventSummaryOpen, closeEventSummary, openEventSummary } = useEventStore();
  const { addEvent } = useEventCRUD();
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
    hasRecurringEvents,
    getRecurringEvents,
  } = useBulkSelection();
  const {
    isTodoCalendarDialogOpen,
    currentTodoData,
    currentDateTimeData,
    showTodoCalendarDialog,
    hideTodoCalendarDialog,
    handleTodoDropConfirm,
    isLinkedWarningOpen,
    linkedEventRefs,
    hideLinkedWarning,
    scheduleAnywayFromWarning,
    navigateToLinkedEvent,
  } = useTodoCalendarIntegration();
  const [formOpen, setFormOpen] = useState(false);
  const [selectedTime, setSelectedTime] = useState<
    { date: Date; startTime: string } | undefined
  >();
  const [todoData, setTodoData] = useState<any>(null);
  // Add this new state for pending time selection
  const [pendingTimeSelection, setPendingTimeSelection] = useState<{
    hour: dayjs.Dayjs;
  } | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(dayjs());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // New useEffect to handle time slot selection properly
  useEffect(() => {
    if (pendingTimeSelection) {
      const { hour } = pendingTimeSelection;

      // First update the selected time
      setSelectedTime({
        date: userSelectedDate.toDate(),
        startTime: hour.format("HH:00"),
      });

      // Then open the form in the next render cycle
      // This ensures selectedTime is updated before the form uses it
      setTimeout(() => {
        setFormOpen(true);
        // Clear the pending selection
        setPendingTimeSelection(null);
      }, 0);
    }
  }, [pendingTimeSelection, userSelectedDate]);

  const isToday =
    userSelectedDate.format("DD-MM-YY") === dayjs().format("DD-MM-YY");

  // Get calendar visibility filter — subscribe to hiddenCalendarIds for reactivity
  const hiddenCalendarIds = useCalendarFilterStore(state => state.hiddenCalendarIds);
  const isCalendarVisible = useCalendarFilterStore(state => state.isCalendarVisible);

  // Template mode
  const isTemplateMode = useTemplateModeStore(s => s.isTemplateMode);
  const draftEvents = useTemplateModeStore(s => s.draftEvents);
  const addDraftEvent = useTemplateModeStore(s => s.addDraftEvent);

  // Expand recurring events into instances for the current day
  const expandedEvents = useMemo(() => {
    const dayStart = userSelectedDate.startOf('day').toDate();
    const dayEnd = userSelectedDate.endOf('day').toDate();

    const allInstances: CalendarEventType[] = [];

    // First filter by calendar visibility, then expand recurring events
    const visibleEvents = events.filter(event => isCalendarVisible(event.calendarId));

    visibleEvents.forEach(event => {
      if (event.isRecurring && event.recurrenceRule) {
        try {
          const instances = generateRecurringInstances(event, dayStart, dayEnd);
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
  }, [events, userSelectedDate, isCalendarVisible, hiddenCalendarIds]);

  // Merge template draft events when in template mode
  const displayEvents = useMemo(() => {
    if (!isTemplateMode || draftEvents.length === 0) return expandedEvents;
    return [...expandedEvents, ...draftEvents];
  }, [expandedEvents, isTemplateMode, draftEvents]);

  const dayEvents = displayEvents.filter((event) => {
    const dayStr = userSelectedDate.format("YYYY-MM-DD");
    if (event.date === dayStr) return true;
    if (event.startsAt) {
      const eventDate = dayjs(event.startsAt).format("YYYY-MM-DD");
      return eventDate === dayStr;
    }
    return false;
  });

  // Split into all-day and timed events
  const { allDayEvents: dayAllDayEvents, timedEvents: dayTimedEvents } = splitAllDayEvents(dayEvents);

  // Update to use the pending time selection approach
  const handleTimeSlotClick = (hour: dayjs.Dayjs) => {
    setTodoData(null); // Reset todo data
    // Instead of immediately updating state and opening form,
    // set a pending time selection that will be processed by the useEffect
    setPendingTimeSelection({ hour });
  };

  // Function to open event form with todo data
  const openEventForm = (todoData: any, hour: dayjs.Dayjs) => {
    console.log(
      "Opening event form with todo data in day view:",
      todoData,
      hour.format("HH:mm")
    );
    setTodoData(todoData);
    // Use the pending selection approach here too
    setPendingTimeSelection({ hour });
  };

  // This is a wrapper function to make the type match what TimeSlotsGrid expects
  const handleAddEvent = async (event: CalendarEventType) => {
    return await addEvent(event);
  };

  // Add this function to handle saving events via the form
  const handleSaveEvent = async (event: CalendarEventType) => {
    // In template mode, save to draft events (not Firestore)
    if (isTemplateMode) {
      addDraftEvent(event);
      setFormOpen(false);
      toast({
        title: "Draft Event Added",
        description: `"${event.title}" added to template`,
      });
      return;
    }
    try {
      const response = await addEvent(event);

      if (response.success) {
        setFormOpen(false);
        toast({
          title: "Event Added",
          description: `${event.title} has been added to your calendar.`,
        });
      } else {
        toast({
          title: "Error",
          description: response.error
            ? String(response.error)
            : "Failed to add event",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error adding event:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <div className="glass mx-2 mt-2 mb-3 rounded-xl overflow-hidden border border-purple-200 dark:border-white/10 shadow-sm bg-gradient-to-r from-purple-50/80 to-purple-100/50 dark:from-secondary/50 dark:to-secondary/50">
        <DayHeader userSelectedDate={userSelectedDate} isToday={isToday} />
      </div>

      {/* All-Day Events Row */}
      <DayAllDayRow
        allDayEvents={dayAllDayEvents}
        onEventClick={openEventSummary}
        isBulkMode={isBulkMode}
        isSelected={isSelected}
        onToggleSelection={toggleSelection}
      />

      <div className="mx-2 mb-2 rounded-2xl overflow-hidden cursor-glow">
        <div className="h-[calc(100vh-170px)] overflow-y-auto">
          <TimeSlotsGrid
            userSelectedDate={userSelectedDate}
            currentTime={currentTime}
            events={dayTimedEvents}
            onTimeSlotClick={handleTimeSlotClick}
            addEvent={handleAddEvent}
            openEventForm={openEventForm}
            showTodoCalendarDialog={showTodoCalendarDialog}
            isBulkMode={isBulkMode}
            isSelected={isSelected}
            onToggleSelection={toggleSelection}
          />
        </div>
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
          hasRecurringEvents={hasRecurringEvents()}
          recurringCount={getRecurringEvents().length}
        />
      )}

      {/* Event Form Dialog */}
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

      {/* Event Details Dialog */}
      <EventDetails open={isEventSummaryOpen} onClose={closeEventSummary} />

      <TodoDropDialog
        open={isTodoCalendarDialogOpen}
        onClose={hideTodoCalendarDialog}
        todoTitle={currentTodoData?.text || ''}
        date={currentDateTimeData?.date || null}
        startTime={currentDateTimeData?.startTime || null}
        onConfirm={handleTodoDropConfirm}
      />

      <TodoLinkedWarningDialog
        open={isLinkedWarningOpen}
        onClose={hideLinkedWarning}
        todoTitle={currentTodoData?.text || ''}
        linkedEventRefs={linkedEventRefs}
        onNavigateToEvent={navigateToLinkedEvent}
        onScheduleAnyway={scheduleAnywayFromWarning}
      />
    </>
  );
};

export default DayView;
