
// src/components/month-view.tsx

import React, { Fragment, useState, useEffect, useMemo } from "react";
import MonthViewBox from "@/components/month-view-box";
import { useDateStore, useEventStore } from "@/lib/store";
import AddEventButton from "@/components/calendar/AddEventButton";
import EventForm from "@/components/calendar/EventForm";
import EventDetails from "@/components/calendar/EventDetails";
import TodoCalendarDialog from "@/components/calendar/integration/TodoCalendarDialog";
import dayjs from "dayjs";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { CalendarEventType } from "@/lib/stores/types";
import { toast } from "sonner";
import { useBulkSelection } from "@/hooks/use-bulk-selection";
import { BulkActionToolbar } from "@/components/calendar";
import { useIsMobile } from "@/hooks/use-mobile";
import { generateRecurringInstances } from "@/lib/utils/recurring-events";
import { useTodoCalendarIntegration } from "@/hooks/use-todo-calendar-integration";
import { useCalendarFilterStore } from "@/lib/stores/calendar-filter-store";

const MonthView = () => {
  const { twoDMonthArray } = useDateStore();
  const { openEventSummary, isEventSummaryOpen, closeEventSummary } =
    useEventStore();
  const { events, updateEvent, addEvent } = useCalendarEvents();
  const isMobile = useIsMobile();
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
    showTodoCalendarDialog,
    hideTodoCalendarDialog,
    handleCreateBoth,
    handleCreateCalendarOnly,
  } = useTodoCalendarIntegration();
  const [formOpen, setFormOpen] = useState(false);
  const [selectedTime, setSelectedTime] = useState<
    { date: Date; startTime: string } | undefined
  >();
  const [todoData, setTodoData] = useState<any>(null);
  const [pendingDaySelection, setPendingDaySelection] =
    useState<dayjs.Dayjs | null>(null);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .touch-dragging {
        opacity: 0.6;
        transform: scale(0.95);
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 100;
        position: relative;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    if (pendingDaySelection) {
      setSelectedTime({
        date: pendingDaySelection.toDate(),
        startTime: "09:00",
      });

      setTimeout(() => {
        setFormOpen(true);
        setPendingDaySelection(null);
      }, 0);
    }
  }, [pendingDaySelection]);

  // Get calendar visibility filter
  const isCalendarVisible = useCalendarFilterStore(state => state.isCalendarVisible);

  // Expand recurring events into instances for the current month view
  const expandedEvents = useMemo(() => {
    // Get month date range for recurring event expansion
    const firstDay = twoDMonthArray[0]?.[0];
    const lastWeek = twoDMonthArray[twoDMonthArray.length - 1];
    const lastDay = lastWeek?.[6] || lastWeek?.[lastWeek.length - 1];
    
    if (!firstDay || !lastDay) {
      return events.filter(event => isCalendarVisible(event.calendarId)); // Filter and return
    }
    
    const monthStart = firstDay.startOf('day').toDate();
    const monthEnd = lastDay.endOf('day').toDate();
    
    const allInstances: CalendarEventType[] = [];
    
    // First filter by calendar visibility, then expand recurring events
    const visibleEvents = events.filter(event => isCalendarVisible(event.calendarId));
    
    visibleEvents.forEach(event => {
      if (event.isRecurring && event.recurrenceRule) {
        try {
          const instances = generateRecurringInstances(event, monthStart, monthEnd);
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
  }, [events, twoDMonthArray, isCalendarVisible]);

  const getEventsForDay = (day: any) => {
    if (!day) return [];

    const dayStr = day.format("YYYY-MM-DD");
    return expandedEvents.filter((event) => {
      if (event.date === dayStr) return true;
      if (event.startsAt) {
        const eventDate = dayjs(event.startsAt).format("YYYY-MM-DD");
        return eventDate === dayStr;
      }
      return false;
    });
  };

  const handleDayClick = (day: any) => {
    if (!day) return;

    setTodoData(null);
    setPendingDaySelection(day);
  };

  const openEventForm = (todoData: any, day: dayjs.Dayjs) => {
    console.log(
      "Opening event form with todo data in month view:",
      todoData,
      day.format("YYYY-MM-DD")
    );
    setTodoData(todoData);
    setPendingDaySelection(day);
  };

  const handleEventDrop = async (event: CalendarEventType, newDate: string) => {
    const updatedEvent = {
      ...event,
      date: newDate,
    };

    await updateEvent(updatedEvent);
  };

  const handleSaveEvent = async (event: CalendarEventType) => {
    try {
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
        <div className="grid grid-cols-7 text-center py-2 bg-secondary/50 border-b border-gray-200 dark:border-white/10">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="text-xs md:text-sm font-medium text-gray-700 dark:text-gray-200">
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day.charAt(0)}</span>
            </div>
          ))}
        </div>

        <section className={`grid grid-cols-7 ${isMobile ? 'grid-rows-6' : 'grid-rows-5'} lg:h-[calc(100vh-160px)] touch-pan-y`}>
          {twoDMonthArray.map((row, i) => (
            <Fragment key={i}>
              {row.map((day, index) => (
                <MonthViewBox
                  key={index}
                  day={day}
                  rowIndex={i}
                  events={getEventsForDay(day)}
                  onEventClick={openEventSummary}
                  onDayClick={handleDayClick}
                  onEventDrop={handleEventDrop}
                  addEvent={addEvent}
                  openEventForm={openEventForm}
                  showTodoCalendarDialog={showTodoCalendarDialog}
                  isBulkMode={isBulkMode}
                  isSelected={isSelected}
                  onToggleSelection={toggleSelection}
                />
              ))}
            </Fragment>
          ))}
        </section>
      </div>
      {!isMobile && <AddEventButton />}

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

      <TodoCalendarDialog
        open={isTodoCalendarDialogOpen && !!currentTodoData}
        onClose={hideTodoCalendarDialog}
        todoTitle={currentTodoData?.text || ''}
        onCreateBoth={handleCreateBoth}
        onCreateCalendarOnly={handleCreateCalendarOnly}
      />
    </>
  );
};

export default MonthView;
