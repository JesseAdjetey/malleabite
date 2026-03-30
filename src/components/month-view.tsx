// src/components/month-view.tsx

import React, { Fragment, useState, useEffect, useMemo } from "react";
import { sounds } from "@/lib/sounds";
import MonthViewBox from "@/components/month-view-box";
import { useDateStore, useEventStore, useViewStore } from "@/lib/store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import AddEventButton from "@/components/calendar/AddEventButton";
import EventForm from "@/components/calendar/EventForm";
import EventDetails from "@/components/calendar/EventDetails";
import TodoDropDialog from "@/components/calendar/integration/TodoDropDialog";
import TodoLinkedWarningDialog from "@/components/calendar/integration/TodoLinkedWarningDialog";
import dayjs from "dayjs";
import { useEventCRUD } from "@/hooks/use-event-crud";
import { CalendarEventType } from "@/lib/stores/types";
import { toast } from "sonner";
import { useBulkSelection } from "@/hooks/use-bulk-selection";
import { BulkActionToolbar } from "@/components/calendar";
import { useIsMobile } from "@/hooks/use-mobile";
import { generateRecurringInstances } from "@/lib/utils/recurring-events";
import { useTodoCalendarIntegration } from "@/hooks/use-todo-calendar-integration";
import { useCalendarFilterStore } from "@/lib/stores/calendar-filter-store";
import { logCalendarPerf } from "@/lib/perf/calendar-perf";

const MonthView = () => {
  const { twoDMonthArray } = useDateStore();
  const { openEventSummary, isEventSummaryOpen, closeEventSummary, events } =
    useEventStore();
  const { updateEvent, addEvent } = useEventCRUD();
  const { selectedView, setView } = useViewStore();
  const isMobile = useIsMobile();

  const handleViewChange = (view: string) => {
    sounds.play("viewSwipe");
    setView(view);
  };
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

  // Get calendar visibility filter — subscribe to hiddenCalendarIds for reactivity
  const hiddenCalendarIds = useCalendarFilterStore(state => state.hiddenCalendarIds);
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
  }, [events, twoDMonthArray, isCalendarVisible, hiddenCalendarIds]);

  const eventsByDay = useMemo(() => {
    const startedAt = performance.now();
    const grouped = new Map<string, CalendarEventType[]>();

    expandedEvents.forEach((event) => {
      const dayKey = event.date || (event.startsAt ? dayjs(event.startsAt).format("YYYY-MM-DD") : '');
      if (!dayKey) return;

      const list = grouped.get(dayKey);
      if (list) {
        list.push(event);
      } else {
        grouped.set(dayKey, [event]);
      }
    });

    logCalendarPerf(
      'month-view-events-by-day',
      'MonthView eventsByDay build',
      performance.now() - startedAt,
      {
        expandedEvents: expandedEvents.length,
        dayBuckets: grouped.size,
      }
    );

    return grouped;
  }, [expandedEvents]);

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
    // Update the date and shift startsAt/endsAt to the new date, preserving the time-of-day
    const newDay = dayjs(newDate);
    let updatedStartsAt = event.startsAt;
    let updatedEndsAt = event.endsAt;

    if (event.startsAt) {
      const oldStart = dayjs(event.startsAt);
      updatedStartsAt = newDay.hour(oldStart.hour()).minute(oldStart.minute()).second(0).toISOString();
    }
    if (event.endsAt) {
      const oldEnd = dayjs(event.endsAt);
      updatedEndsAt = newDay.hour(oldEnd.hour()).minute(oldEnd.minute()).second(0).toISOString();
    }

    const updatedEvent: CalendarEventType = {
      ...event,
      date: newDate,
      startsAt: updatedStartsAt,
      endsAt: updatedEndsAt,
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
      {/* Top Container: Header Pill */}
      <div className="glass mx-2 mt-2 mb-3 rounded-xl overflow-hidden relative border border-purple-200 dark:border-white/10 shadow-sm bg-gradient-to-r from-purple-50/80 to-purple-100/50 dark:from-secondary/50 dark:to-secondary/50">
        <div className="relative">
          {/* Absolutely positioned View Selector but with adjusted z-index and padding to not overlap with Sunday text if possible, or placed above the grid */}
          <div className="absolute left-2 lg:left-4 top-1/2 -translate-y-1/2 z-10">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/40 dark:bg-white/10 hover:bg-white/60 dark:hover:bg-white/20 transition-colors text-xs font-medium text-purple-900 dark:text-foreground outline-none border border-purple-200 dark:border-white/10 backdrop-blur-md">
                {selectedView}
                <ChevronDown size={14} className="text-purple-700 dark:text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[120px] rounded-xl">
                {["Day", "Week", "Month"].map((viewStr) => (
                  <DropdownMenuItem
                    key={viewStr}
                    onClick={() => handleViewChange(viewStr)}
                    className={`rounded-lg cursor-pointer ${selectedView === viewStr ? "bg-accent text-accent-foreground" : ""
                      }`}
                  >
                    {viewStr}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* We push the Sunday text slightly to the right using padding on the first element if needed, or just let it sit. The button has a backdrop blur now so it's readable even if it slightly overlaps. */}
          <div className="grid grid-cols-7 text-center py-1 h-[36px]">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => (
              <div key={day} className={`text-xs font-medium text-purple-900 dark:text-gray-200 flex items-center justify-center ${idx === 0 ? "pl-16 md:pl-20" : ""}`}>
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{day.charAt(0)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Container: Standalone Grid with rounded corners */}
      <section className={`grid grid-cols-7 ${isMobile ? 'grid-rows-6' : 'grid-rows-5'} lg:h-[calc(100vh-170px)] touch-pan-y mx-2 mb-2 rounded-2xl overflow-hidden`}>
        {twoDMonthArray.map((row, i) => (
          <Fragment key={i}>
            {row.map((day, index) => (
              <MonthViewBox
                key={index}
                day={day}
                rowIndex={i}
                events={day ? eventsByDay.get(day.format("YYYY-MM-DD")) || [] : []}
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

export default MonthView;
