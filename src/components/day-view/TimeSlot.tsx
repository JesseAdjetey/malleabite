
import React, { useState } from "react";
import dayjs from "dayjs";
import CalendarEvent from "../calendar/CalendarEvent";
import SelectableCalendarEvent from "../calendar/SelectableCalendarEvent";
import { useEventStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getTimeInfo } from "../calendar/event-utils/touch-handlers";
import { nanoid } from "nanoid";
import { CalendarEventType } from "@/lib/stores/types";
import { useCalendarEvents } from "@/hooks/use-calendar-events";

interface TimeSlotProps {
  hour: dayjs.Dayjs;
  selectedDate: dayjs.Dayjs;
  events: any[];
  onTimeSlotClick: (hour: dayjs.Dayjs) => void;
  addEvent?: (event: CalendarEventType) => Promise<any>;
  openEventForm?: (todoData: any, hour: dayjs.Dayjs) => void;
  showTodoCalendarDialog?: (todoData: any, date: Date, startTime: string) => void;
  isBulkMode?: boolean;
  isSelected?: (eventId: string) => boolean;
  onToggleSelection?: (eventId: string) => void;
}

const TimeSlot: React.FC<TimeSlotProps> = ({ 
  hour, 
  selectedDate,
  events, 
  onTimeSlotClick,
  addEvent,
  openEventForm,
  showTodoCalendarDialog,
  isBulkMode = false,
  isSelected = () => false,
  onToggleSelection = () => {},
}) => {
  const { openEventSummary, toggleEventLock } = useEventStore();
  const { updateEvent } = useCalendarEvents();
  
  // State for drag-over visual feedback
  const [isDragOver, setIsDragOver] = useState(false);
  const [showLockIn, setShowLockIn] = useState(false);

  // Handle dropping an event onto a time slot
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    console.log("🎯 DROP EVENT FIRED in TimeSlot:", hour.format("HH:mm"));
    console.log("🎯 Available data types:", e.dataTransfer.types);
    
    try {
      // Get the drag data - try multiple formats
      let dataString = e.dataTransfer.getData('application/json');
      console.log("🎯 application/json data:", dataString);
      
      if (!dataString) {
        dataString = e.dataTransfer.getData('text/plain');
        console.log("🎯 text/plain data:", dataString);
      }
      
      if (!dataString) {
        dataString = e.dataTransfer.getData('text');
        console.log("🎯 text data:", dataString);
      }
      
      // Fallback: check window backup (for cross-component drag issues)
      if (!dataString && (window as any).__dragData) {
        console.log("🎯 Using window backup data");
        const windowData = (window as any).__dragData;
        dataString = JSON.stringify(windowData);
        // Clear the backup
        delete (window as any).__dragData;
      }
      
      if (!dataString) {
        console.error("❌ No data found in drag event");
        return;
      }
      
      const data = JSON.parse(dataString);
      console.log("🎯 Parsed drop data:", data);
      
      // Handle todo item drag (from todo module or eisenhower matrix)
      if (data.source === 'todo-module' || data.source === 'eisenhower') {
        console.log("✅ Todo/Eisenhower item detected, source:", data.source);
        console.log("🔍 showTodoCalendarDialog available?", !!showTodoCalendarDialog);
        
        // Show lock-in animation
        setShowLockIn(true);
        setTimeout(() => setShowLockIn(false), 600);
        
        // If we have the showTodoCalendarDialog function, use it
        if (showTodoCalendarDialog) {
          // Use the selected date from the calendar view
          const targetDate = selectedDate.startOf('day').toDate();
          
          // Format start time from the hour
          const startTime = hour.format("HH:00");
          
          console.log("📅 Calling showTodoCalendarDialog with:", data, targetDate, startTime);
          // Show the integration dialog
          showTodoCalendarDialog(data, targetDate, startTime);
          return;
        }
        
        // Fallback to openEventForm if available
        if (openEventForm) {
          openEventForm(data, hour);
          return;
        }
        
        if (addEvent) {
          handleTodoDrop(data, hour);
        }
        return;
      }
      
      // Don't process if the event is locked
      if (data.isLocked) {
        console.log("Event is locked, ignoring drop");
        toast.error("Event is locked and cannot be moved");
        return;
      }
      
      // Show lock-in animation
      setShowLockIn(true);
      setTimeout(() => setShowLockIn(false), 600);
      
      // Calculate precise drop position to snap to 30-minute intervals
      const rect = e.currentTarget.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const hourHeight = rect.height;
      const minutesWithinHour = Math.floor((relativeY / hourHeight) * 60);
      
      // Snap to nearest 30-minute interval (0 or 30)
      const snappedMinutes = minutesWithinHour < 30 ? 0 : 30;
      
      // Set new start time to the hour with snapped minutes
      const baseHour = hour.hour();
      const newStartTime = `${baseHour.toString().padStart(2, '0')}:${snappedMinutes.toString().padStart(2, '0')}`;
      
      // Calculate new end time by preserving duration
      let durationMinutes = 60; // Default 1 hour
      
      if (data.timeStart && data.timeEnd) {
        const oldStartParts = data.timeStart.split(':').map(Number);
        const oldEndParts = data.timeEnd.split(':').map(Number);
        const oldStartMinutes = oldStartParts[0] * 60 + (oldStartParts[1] || 0);
        const oldEndMinutes = oldEndParts[0] * 60 + (oldEndParts[1] || 0);
        durationMinutes = oldEndMinutes - oldStartMinutes;
        if (durationMinutes <= 0) durationMinutes = 60;
      } else if (data.startsAt && data.endsAt) {
        // Calculate from ISO timestamps
        const startMs = new Date(data.startsAt).getTime();
        const endMs = new Date(data.endsAt).getTime();
        durationMinutes = Math.round((endMs - startMs) / 60000);
        if (durationMinutes <= 0) durationMinutes = 60;
      }
      
      // Calculate new end time
      const newStartMinutes = baseHour * 60 + snappedMinutes;
      const newEndMinutes = newStartMinutes + durationMinutes;
      
      const newEndHours = Math.floor(newEndMinutes / 60) % 24;
      const newEndMinutes2 = newEndMinutes % 60;
      
      const newEndTime = `${newEndHours.toString().padStart(2, '0')}:${newEndMinutes2.toString().padStart(2, '0')}`;
      
      // Get description without time part
      const descriptionParts = (data.description || '').split('|');
      const descriptionText = descriptionParts.length > 1 ? descriptionParts[1].trim() : (data.title || '');
      
      // Use the selected date from the calendar view (or fall back to event's date)
      const targetDate = selectedDate.format('YYYY-MM-DD');
      
      // Create the updated event with ISO timestamps
      const updatedEvent = {
        ...data,
        description: `${newStartTime} - ${newEndTime} | ${descriptionText}`,
        date: targetDate,
        startsAt: dayjs(`${targetDate}T${newStartTime}`).toISOString(),
        endsAt: dayjs(`${targetDate}T${newEndTime}`).toISOString()
      };
      
      console.log("Updating event with new time:", updatedEvent);
      
      // Update the event in the database
      updateEvent(updatedEvent);
      
      // Show success message with visual feedback
      toast.success(`Event moved to ${newStartTime}`, {
        icon: "✅",
        duration: 2000
      });
      
    } catch (error) {
      console.error("Error handling drop:", error);
      toast.error("Failed to move event");
    }
  };

  // Handle dropping a todo item onto the calendar
  const handleTodoDrop = async (todoData: any, hour: dayjs.Dayjs) => {
    console.log("Handling todo drop in TimeSlot", todoData);
    if (!addEvent || !todoData || !todoData.id || !todoData.text) {
      console.error("Invalid todo data or missing addEvent function:", todoData, addEvent);
      return;
    }
    
    // Format time strings
    const startTime = hour.format("HH:00");
    const endTime = hour.add(1, 'hour').format("HH:00");
    // Use the selected date from the calendar view instead of today's date
    const eventDate = selectedDate.format('YYYY-MM-DD');
    
    // Format ISO strings for startsAt and endsAt
    const startDateTime = dayjs(`${eventDate} ${startTime}`);
    const endDateTime = dayjs(`${eventDate} ${endTime}`);
    
    // Create a new calendar event from the todo item
    const newEvent: CalendarEventType = {
      id: nanoid(), // This will be replaced by the database
      title: todoData.text,
      date: eventDate, // Use selected date from calendar view
      description: `${startTime} - ${endTime} | ${todoData.text}`,
      color: 'bg-purple-500/70', // Special color for todo events
      isTodo: true, // Mark as a todo event
      todoId: todoData.id, // Reference back to original todo
      startsAt: startDateTime.toISOString(),
      endsAt: endDateTime.toISOString()
    };
    
    console.log("Adding new event from todo:", newEvent);
    
    try {
      // Add to database
      const response = await addEvent(newEvent);
      
      if (response.success) {
        toast.success(`Todo "${todoData.text}" added to calendar at ${startTime}`);
      } else {
        toast.error(`Failed to add todo: ${response.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Error adding event from todo:", error);
      toast.error("Failed to add todo to calendar");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  // Get events for this specific hour slot
  const hourEvents = events.filter(event => {
    const timeInfo = getTimeInfo(event.description, event.startsAt, event.endsAt);
    const eventHour = parseInt(timeInfo.start.split(':')[0], 10);
    return eventHour === hour.hour();
  });

  return (
    <div
      className={cn(
        "relative flex h-20 border-t border-gray-200 dark:border-white/10 hover:bg-gray-100/50 dark:hover:bg-white/5 gradient-border cursor-glow transition-all duration-200",
        isDragOver && "bg-primary/10 dark:bg-primary/20 border-primary/50 ring-2 ring-primary/30 ring-inset",
        showLockIn && "animate-pulse bg-green-500/20 dark:bg-green-500/30"
      )}
      onClick={() => onTimeSlotClick(hour)}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-hour={hour.format('HH:mm')}
    >
      {/* Lock-in animation overlay */}
      {showLockIn && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div className="w-10 h-10 rounded-full bg-green-500/40 animate-ping" />
          <div className="absolute w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      )}
      
      {/* Drag over indicator */}
      {isDragOver && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">
            Drop here - {hour.format('h:mm A')}
          </div>
        </div>
      )}
      
      {/* Events for this hour */}
      {hourEvents.map(event => (
        <div 
          key={event.id} 
          className="absolute inset-x-2 z-10"
          style={{ top: '2px' }}
          onClick={(e) => {
            e.stopPropagation();
            if (!isBulkMode) {
              openEventSummary(event);
            }
          }}
        >
          {isBulkMode ? (
            <SelectableCalendarEvent
              event={event}
              isBulkMode={isBulkMode}
              isSelected={isSelected(event.id)}
              onToggleSelection={onToggleSelection}
            />
          ) : (
            <CalendarEvent
              event={event}
              color={event.color}
              isLocked={event.isLocked}
              hasAlarm={event.hasAlarm}
              hasReminder={event.hasReminder}
              hasTodo={event.isTodo}
              participants={event.participants}
              onClick={() => openEventSummary(event)}
              onLockToggle={(isLocked) => toggleEventLock(event.id, isLocked)}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default TimeSlot;
