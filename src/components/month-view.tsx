
// src/components/month-view.tsx

import React, { Fragment, useState, useEffect, useMemo } from "react";
import MonthViewBox from "@/components/month-view-box";
import { useDateStore, useEventStore } from "@/lib/store";
import AddEventButton from "@/components/calendar/AddEventButton";
import EventForm from "@/components/calendar/EventForm";
import EventDetails from "@/components/calendar/EventDetails";
import dayjs from "dayjs";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { CalendarEventType } from "@/lib/stores/types";
import { toast } from "sonner";
import { useBulkSelection } from "@/hooks/use-bulk-selection";
import { BulkActionToolbar } from "@/components/calendar";
import { useIsMobile } from "@/hooks/use-mobile";
import { generateRecurringInstances } from "@/lib/utils/recurring-events";

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
  } = useBulkSelection();
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

  // Get month date range for recurring event expansion
  const monthStart = twoDMonthArray[0]?.[0]?.startOf('day').toDate() || new Date();
  const monthEnd = twoDMonthArray[twoDMonthArray.length - 1]?.[6]?.endOf('day').toDate() || new Date();

  // Expand recurring events into instances for the current month view
  const expandedEvents = useMemo(() => {
    const allInstances: CalendarEventType[] = [];
    
    events.forEach(event => {
      if (event.isRecurring && event.recurrenceRule) {
        const instances = generateRecurringInstances(event, monthStart, monthEnd);
        allInstances.push(...instances);
      } else {
        allInstances.push(event);
      }
    });
    
    return allInstances;
  }, [events, monthStart.getTime(), monthEnd.getTime()]);

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
        <div className="grid grid-cols-7 text-center py-2 bg-secondary/50 border-b border-white/10">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day} className="text-xs md:text-sm font-medium">
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
    </>
  );
};

export default MonthView;
