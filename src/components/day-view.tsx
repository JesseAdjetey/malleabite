// src/components/day-view.tsx

import React, { useEffect, useState } from "react";
import dayjs from "dayjs";
import { useDateStore, useEventStore } from "@/lib/store";
import AddEventButton from "@/components/calendar/AddEventButton";
import EventForm from "@/components/calendar/EventForm";
import EventDetails from "@/components/calendar/EventDetails";
import DayHeader from "./day-view/DayHeader";
import TimeSlotsGrid from "./day-view/TimeSlotsGrid";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { CalendarEventType } from "@/lib/stores/types";
import { toast } from "@/components/ui/use-toast";
import { useBulkSelection } from "@/hooks/use-bulk-selection";
import { BulkActionToolbar } from "@/components/calendar";

const DayView = () => {
  const [currentTime, setCurrentTime] = useState(dayjs());
  const { userSelectedDate } = useDateStore();
  const { isEventSummaryOpen, closeEventSummary } = useEventStore();
  const { events, addEvent } = useCalendarEvents();
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

  const dayEvents = events.filter(
    (event) => event.date === userSelectedDate.format("YYYY-MM-DD")
  );

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
      <div className="glass m-4 rounded-xl overflow-hidden gradient-border cursor-glow">
        <DayHeader userSelectedDate={userSelectedDate} isToday={isToday} />

        <TimeSlotsGrid
          userSelectedDate={userSelectedDate}
          currentTime={currentTime}
          events={dayEvents}
          onTimeSlotClick={handleTimeSlotClick}
          addEvent={handleAddEvent}
          openEventForm={openEventForm}
          isBulkMode={isBulkMode}
          isSelected={isSelected}
          onToggleSelection={toggleSelection}
        />
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
    </>
  );
};

export default DayView;
