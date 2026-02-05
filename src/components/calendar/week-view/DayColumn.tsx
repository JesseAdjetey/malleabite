
import React, { useState, useMemo } from "react";
import { getHours, isCurrentDay } from "@/lib/getTime";
import { CalendarEventType } from "@/lib/stores/types";
import dayjs from "dayjs";
import CalendarEvent from "../CalendarEvent";
import SelectableCalendarEvent from "../SelectableCalendarEvent";
import EventContextMenu from "../EventContextMenu";
import CurrentTimeIndicator from "./CurrentTimeIndicator";
import { calculateEventHeight, calculateEventPosition, getTimeInfo } from "../event-utils/touch-handlers";
import { calculateEventPositions, getEventStyle } from "@/lib/utils/event-overlap";

interface DayColumnProps {
  currentDate: dayjs.Dayjs;
  dayEvents: CalendarEventType[];
  currentTime: dayjs.Dayjs;
  onTimeSlotClick: (day: dayjs.Dayjs, hour: dayjs.Dayjs) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, day: dayjs.Dayjs, hour: dayjs.Dayjs) => void;
  openEventSummary: (event: CalendarEventType) => void;
  toggleEventLock: (id: string, isLocked: boolean) => void;
  isBulkMode?: boolean;
  isSelected?: (eventId: string) => boolean;
  onToggleSelection?: (eventId: string) => void;
  // Context menu handlers
  onDeleteEvent?: (eventId: string) => void;
  onDuplicateEvent?: (event: CalendarEventType) => void;
  onColorChange?: (eventId: string, color: string) => void;
  onAddAlarm?: (event: CalendarEventType) => void;
  onAddTodo?: (event: CalendarEventType) => void;
}

const DayColumn: React.FC<DayColumnProps> = ({
  currentDate,
  dayEvents,
  currentTime,
  onTimeSlotClick,
  onDragOver,
  onDrop,
  openEventSummary,
  toggleEventLock,
  isBulkMode = false,
  isSelected = () => false,
  onToggleSelection = () => { },
  onDeleteEvent,
  onDuplicateEvent,
  onColorChange,
  onAddAlarm,
  onAddTodo,
}) => {
  const hourHeight = 80; // The height in pixels of each hour cell
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);

  // Calculate event positions for overlapping events
  const eventPositions = useMemo(() => calculateEventPositions(dayEvents), [dayEvents]);

  const handleDragEnter = (hourIndex: number) => {
    setDragOverHour(hourIndex);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving the column entirely
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDragOverHour(null);
    }
  };

  const handleDrop = (e: React.DragEvent, day: dayjs.Dayjs, hour: dayjs.Dayjs) => {
    setDragOverHour(null);
    onDrop(e, day, hour);
  };

  return (
    <div
      className="relative border-r border-gray-200 dark:border-white/10"
      onDragLeave={handleDragLeave}
    >
      {getHours.map((hour, i) => (
        <div
          key={i}
          className={`relative flex h-20 cursor-pointer border-t border-gray-200 dark:border-white/10 transition-all duration-150 ${dragOverHour === i
              ? 'bg-primary/30 dark:bg-white/20 ring-2 ring-inset ring-white/70 shadow-[inset_0_0_20px_rgba(255,255,255,0.5)] scale-[1.02]'
              : 'hover:bg-gray-100/50 dark:hover:bg-white/5'
            }`}
          onClick={() => onTimeSlotClick(currentDate, hour)}
          onDragOver={(e) => {
            onDragOver(e);
            handleDragEnter(i);
          }}
          onDragEnter={() => handleDragEnter(i)}
          onDrop={(e) => handleDrop(e, currentDate, hour)}
        />
      ))}

      {/* Events displayed at their exact positions */}
      {dayEvents.map(event => {
        const timeInfo = getTimeInfo(event.description, event.startsAt, event.endsAt);
        const topPosition = calculateEventPosition(timeInfo.start, hourHeight);
        const eventHeight = calculateEventHeight(timeInfo.start, timeInfo.end, hourHeight);
        
        // Get overlap position for side-by-side display
        const position = eventPositions.get(event.id);
        const overlapStyle = getEventStyle(position);

        return (
          <div
            key={event.id}
            className="absolute z-10"
            style={{
              top: `${topPosition}px`,
              height: `${eventHeight}px`,
              left: overlapStyle.left,
              width: overlapStyle.width,
            }}
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
              <EventContextMenu
                event={event}
                onEdit={openEventSummary}
                onDelete={onDeleteEvent}
                onDuplicate={onDuplicateEvent}
                onColorChange={onColorChange}
                onLockToggle={(eventId, locked) => toggleEventLock(eventId, locked)}
                onAddAlarm={onAddAlarm}
                onAddTodo={onAddTodo}
              >
                <div className="h-full">
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
                </div>
              </EventContextMenu>
            )}
          </div>
        );
      })}

      {/* Current Time indicator */}
      <CurrentTimeIndicator
        currentTime={currentTime}
        isCurrentDay={isCurrentDay(currentDate)}
      />
    </div>
  );
};

export default DayColumn;
