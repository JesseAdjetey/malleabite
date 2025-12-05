
import React from "react";
import { getHours, isCurrentDay } from "@/lib/getTime";
import { CalendarEventType } from "@/lib/stores/types";
import dayjs from "dayjs";
import CalendarEvent from "../CalendarEvent";
import SelectableCalendarEvent from "../SelectableCalendarEvent";
import CurrentTimeIndicator from "./CurrentTimeIndicator";
import { calculateEventHeight, calculateEventPosition, getTimeInfo } from "../event-utils/touch-handlers";

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
  onToggleSelection = () => {},
}) => {
  const hourHeight = 80; // The height in pixels of each hour cell

  return (
    <div className="relative border-r border-white/10">
      {getHours.map((hour, i) => (
        <div
          key={i}
          className="relative flex h-20 cursor-pointer border-t border-white/10 hover:bg-white/5"
          onClick={() => onTimeSlotClick(currentDate, hour)}
          onDragOver={onDragOver}
          onDrop={(e) => onDrop(e, currentDate, hour)}
        />
      ))}

      {/* Events displayed at their exact positions */}
      {dayEvents.map(event => {
        const timeInfo = getTimeInfo(event.description, event.startsAt, event.endsAt);
        const topPosition = calculateEventPosition(timeInfo.start, hourHeight);
        const eventHeight = calculateEventHeight(timeInfo.start, timeInfo.end, hourHeight);
        
        // Debug logging
        console.log('=== EVENT DISPLAY DEBUG ===', {
          title: event.title,
          startsAt: event.startsAt,
          endsAt: event.endsAt,
          timeInfo,
          topPosition,
          eventHeight
        });
        
        return (
          <div 
            key={event.id} 
            className="absolute inset-x-0.5 z-10 border-2 border-red-500"
            style={{ 
              top: `${topPosition}px`,
              height: `${eventHeight}px`
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
