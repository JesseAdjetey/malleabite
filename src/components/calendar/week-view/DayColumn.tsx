
import React, { useState, useMemo, useRef } from "react";
import { getHours, isCurrentDay } from "@/lib/getTime";
import { cn } from "@/lib/utils";
import { CalendarEventType } from "@/lib/stores/types";
import dayjs from "dayjs";
import CalendarEvent from "../CalendarEvent";
import SelectableCalendarEvent from "../SelectableCalendarEvent";
import EventContextMenu from "../EventContextMenu";
import CurrentTimeIndicator from "./CurrentTimeIndicator";
import { calculateEventHeight, calculateEventPosition, getTimeInfo } from "../event-utils/touch-handlers";
import { calculateEventPositions, getEventStyle } from "@/lib/utils/event-overlap";
import { useEventResize } from "@/hooks/use-event-resize";
import { useConflictMap } from "@/hooks/use-conflict-detection";
import { RescheduleOptionsSheet } from "@/components/calendar/RescheduleOptionsSheet";

interface DayColumnProps {
  currentDate: dayjs.Dayjs;
  dayEvents: CalendarEventType[];
  /** Full event list used for alternative-slot search. Falls back to dayEvents. */
  allEvents?: CalendarEventType[];
  currentTime: dayjs.Dayjs;
  onTimeSlotClick: (day: dayjs.Dayjs, hour: dayjs.Dayjs) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, day: dayjs.Dayjs, hour: dayjs.Dayjs) => void;
  openEventSummary: (event: CalendarEventType) => void;
  toggleEventLock: (id: string, isLocked: boolean) => void;
  isBulkMode?: boolean;
  isSelected?: (eventId: string) => boolean;
  onToggleSelection?: (eventId: string) => void;
  onShiftClickEvent?: (eventId: string) => void;
  draggingBulkEventId?: string | null;
  onResizeEvent?: (event: CalendarEventType, newStart: Date, newEnd: Date) => void;
  // Context menu handlers
  onDeleteEvent?: (eventId: string) => void;
  onColorChange?: (eventId: string, color: string) => void;
}

const DayColumn: React.FC<DayColumnProps> = ({
  currentDate,
  dayEvents,
  allEvents,
  currentTime,
  onTimeSlotClick,
  onDragOver,
  onDrop,
  openEventSummary,
  toggleEventLock,
  isBulkMode = false,
  isSelected = () => false,
  onToggleSelection = () => { },
  onShiftClickEvent,
  draggingBulkEventId,
  onResizeEvent,
  onDeleteEvent,
  onColorChange,
}) => {
  const hourHeight = 80; // px per hour
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);
  // Track when context menu last closed to prevent spurious openEventSummary calls
  const ctxMenuClosedAtRef = useRef(0);

  // Conflict detection
  const { conflicts, isEnabled: conflictEnabled } = useConflictMap(dayEvents);
  // Reschedule sheet state
  const [rescheduleEvent, setRescheduleEvent] = useState<CalendarEventType | null>(null);

  // Live resize preview: track the event being resized and its new times
  const [liveResize, setLiveResize] = useState<{
    eventId: string;
    newStart: Date;
    newEnd: Date;
  } | null>(null);

  // Calculate event positions for overlapping events
  const eventPositions = useMemo(() => calculateEventPositions(dayEvents), [dayEvents]);

  const [, resizeHandlers] = useEventResize({
    minutesPerPixel: 60 / hourHeight, // 0.75 min per pixel (80px = 1 hour = 60 min)
    snapInterval: 15,
    minDuration: 15,
    onResize: (_eventId, newStart, newEnd) => {
      setLiveResize({ eventId: _eventId, newStart, newEnd });
    },
    onResizeEnd: async (eventId, newStart, newEnd) => {
      setLiveResize(null);
      const event = dayEvents.find(e => e.id === eventId);
      if (event && onResizeEvent) {
        onResizeEvent(event, newStart, newEnd);
      }
      return true;
    },
    onResizeCancel: () => {
      setLiveResize(null);
    },
  });

  const handleDragEnter = (hourIndex: number) => {
    setDragOverHour(hourIndex);
  };

  const handleDragLeave = (e: React.DragEvent) => {
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

        // Use live resize preview for the event currently being resized
        let topPosition: number;
        let eventHeight: number;
        if (liveResize?.eventId === event.id) {
          const liveStartStr = dayjs(liveResize.newStart).format('HH:mm');
          const liveEndStr = dayjs(liveResize.newEnd).format('HH:mm');
          topPosition = calculateEventPosition(liveStartStr, hourHeight);
          eventHeight = calculateEventHeight(liveStartStr, liveEndStr, hourHeight);
        } else {
          topPosition = calculateEventPosition(timeInfo.start, hourHeight);
          eventHeight = calculateEventHeight(timeInfo.start, timeInfo.end, hourHeight);
        }

        // Get overlap position for side-by-side display
        const position = eventPositions.get(event.id);
        const overlapStyle = getEventStyle(position);

        // Resolve start/end dates for the resize handle
        const startDate = event.startsAt
          ? new Date(event.startsAt)
          : dayjs(currentDate)
              .hour(parseInt(timeInfo.start.split(':')[0]))
              .minute(parseInt(timeInfo.start.split(':')[1]))
              .toDate();
        const endDate = event.endsAt
          ? new Date(event.endsAt)
          : dayjs(currentDate)
              .hour(parseInt(timeInfo.end.split(':')[0]))
              .minute(parseInt(timeInfo.end.split(':')[1]))
              .toDate();

        const isBeingResized = liveResize?.eventId === event.id;

        return (
          <div
            key={event.id}
            data-event-id={event.id}
            className={cn(
              "absolute z-10",
              // Only apply opacity transition when NOT resizing (avoids lag during live resize)
              !isBeingResized && "transition-opacity",
              draggingBulkEventId &&
                isSelected(event.id) &&
                event.id !== draggingBulkEventId &&
                "opacity-30"
            )}
            style={{
              top: `${topPosition}px`,
              height: `${eventHeight}px`,
              left: overlapStyle.left,
              width: overlapStyle.width,
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (Date.now() - ctxMenuClosedAtRef.current < 300) return;
              if (e.shiftKey && !isBulkMode) {
                onShiftClickEvent?.(event.id);
                return;
              }
              if (!isBulkMode) {
                openEventSummary(event);
              }
            }}
          >
            {isBulkMode ? (
              <SelectableCalendarEvent
                event={event}
                color={event.color}
                isBulkMode={isBulkMode}
                isSelected={isSelected(event.id)}
                onToggleSelection={onToggleSelection}
              />
            ) : (
              <EventContextMenu
                event={event}
                hasConflict={conflictEnabled && conflicts.has(event.id)}
                onEdit={openEventSummary}
                onDelete={onDeleteEvent}
                onColorChange={onColorChange}
                onLockToggle={(eventId, locked) => toggleEventLock(eventId, locked)}
                onReschedule={() => setRescheduleEvent(event)}
                onOpenChange={(open) => { if (!open) ctxMenuClosedAtRef.current = Date.now(); }}
              >
                <div className="h-full relative">
                  {/* Top resize handle — adjusts start time */}
                  {!event.isLocked && !isBulkMode && (
                    <div
                      className="absolute top-0 left-0 right-0 h-3 cursor-ns-resize z-20 flex items-start justify-center pt-0.5 group/rht"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        resizeHandlers.handleResizeStart(e, event.id, 'top', startDate, endDate);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        resizeHandlers.handleResizeStart(e, event.id, 'top', startDate, endDate);
                      }}
                    >
                      <div className="w-8 h-1 rounded-full bg-white/50 opacity-0 group-hover/rht:opacity-100 transition-opacity" />
                    </div>
                  )}

                  <CalendarEvent
                    event={event}
                    color={event.color}
                    isLocked={event.isLocked}
                    hasAlarm={event.hasAlarm}
                    hasReminder={event.hasReminder}
                    hasTodo={event.isTodo}
                    participants={event.participants}
                    isOverlapping={position?.isOverlapping}
                    onLockToggle={(isLocked) => toggleEventLock(event.id, isLocked)}
                  />

                  {/* Bottom resize handle — adjusts end time */}
                  {!event.isLocked && !isBulkMode && (
                    <div
                      className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize z-20 flex items-end justify-center pb-0.5 group/rh"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        resizeHandlers.handleResizeStart(e, event.id, 'bottom', startDate, endDate);
                      }}
                      onClick={(e) => {
                        // Prevent any click on the resize handle from opening the event card
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        resizeHandlers.handleResizeStart(e, event.id, 'bottom', startDate, endDate);
                      }}
                    >
                      {/* Grip indicator */}
                      <div className="w-8 h-1 rounded-full bg-white/50 opacity-0 group-hover/rh:opacity-100 transition-opacity" />
                    </div>
                  )}
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

      {/* Reschedule sheet — opened via right-click "Reschedule…" */}
      {rescheduleEvent && (
        <RescheduleOptionsSheet
          event={rescheduleEvent}
          allEvents={allEvents ?? dayEvents}
          conflicts={conflicts.get(rescheduleEvent.id) ?? []}
          open={!!rescheduleEvent}
          onOpenChange={(open) => { if (!open) setRescheduleEvent(null); }}
        />
      )}
    </div>
  );
};

export default DayColumn;
