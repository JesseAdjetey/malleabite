
import React, { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { getHours, isCurrentDay } from "@/lib/getTime";
import { CalendarEventType } from "@/lib/stores/types";
import dayjs from "dayjs";
import CalendarEvent from "../CalendarEvent";
import SelectableCalendarEvent from "../SelectableCalendarEvent";
import EventContextMenu from "../EventContextMenu";
import CurrentTimeIndicator from "./CurrentTimeIndicator";
import { calculateEventHeight, calculateEventPosition, getTimeInfo } from "../event-utils/touch-handlers";
import { calculateEventPositions, getEventStyle } from "@/lib/utils/event-overlap";
import { useEventResize } from "@/hooks/use-event-resize";

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
  onEventResize?: (event: CalendarEventType, newStartsAt: string, newEndsAt: string) => Promise<void>;
  onShiftClickEvent?: (eventId: string) => void;
  draggingBulkEventId?: string | null;
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
  onEventResize,
  onShiftClickEvent,
  draggingBulkEventId,
}) => {
  const hourHeight = 80; // The height in pixels of each hour cell
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);
  const [resizePreview, setResizePreview] = useState<{ eventId: string; height: number; label: string } | null>(null);

  const [, { handleResizeStart }] = useEventResize({
    minutesPerPixel: 60 / hourHeight,
    snapInterval: 15,
    minDuration: 15,
    onResize: (eventId, newStart, newEnd) => {
      const newHeight = calculateEventHeight(
        dayjs(newStart).format('HH:mm'),
        dayjs(newEnd).format('HH:mm'),
        hourHeight
      );
      const mins = dayjs(newEnd).diff(dayjs(newStart), 'minute');
      const label = mins >= 60
        ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}`
        : `${mins}m`;
      setResizePreview({ eventId, height: Math.max(newHeight, 20), label });
    },
    onResizeEnd: async (eventId, newStart, newEnd) => {
      setResizePreview(null);
      const event = dayEvents.find(e => e.id === eventId);
      if (!event) return false;
      await onEventResize?.(event, newStart.toISOString(), newEnd.toISOString());
      return true;
    },
    onResizeCancel: () => setResizePreview(null),
  });

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

        const isResizingThis = resizePreview?.eventId === event.id;
        const displayHeight = isResizingThis ? resizePreview!.height : eventHeight;

        return (
          <div
            key={event.id}
            data-event-id={event.id}
            className={cn(
              "absolute z-10 group/event transition-opacity",
              draggingBulkEventId &&
                isSelected(event.id) &&
                event.id !== draggingBulkEventId &&
                "opacity-30"
            )}
            style={{
              top: `${topPosition}px`,
              height: `${displayHeight}px`,
              left: overlapStyle.left,
              width: overlapStyle.width,
            }}
            onClickCapture={(e) => {
              // Capture phase fires before inner handlers — intercept Shift+Click
              // before CalendarEvent's onClick can open the detail dialog.
              if (e.shiftKey && !isBulkMode) {
                e.stopPropagation();
                onShiftClickEvent?.(event.id);
                return;
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (!isBulkMode) {
                openEventSummary(event);
              }
            }}
          >
            {/* Duration tooltip shown during active resize */}
            {isResizingThis && (
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-30 px-2 py-0.5 rounded-full bg-foreground text-background text-xs font-medium whitespace-nowrap pointer-events-none">
                {resizePreview!.label}
              </div>
            )}

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
                onEdit={openEventSummary}
                onDelete={onDeleteEvent}
                onDuplicate={onDuplicateEvent}
                onColorChange={onColorChange}
                onLockToggle={(eventId, locked) => toggleEventLock(eventId, locked)}
                onAddAlarm={onAddAlarm}
                onAddTodo={onAddTodo}
              >
                <div className="h-full relative">
                  <CalendarEvent
                    event={event}
                    color={event.color}
                    isLocked={event.isLocked}
                    hasAlarm={event.hasAlarm}
                    hasReminder={event.hasReminder}
                    hasTodo={event.isTodo}
                    participants={event.participants}
                    isOverlapping={position?.isOverlapping}
                    onClick={() => openEventSummary(event)}
                    onLockToggle={(isLocked) => toggleEventLock(event.id, isLocked)}
                  />
                  {/* Bottom resize handle — visible on hover, hidden for locked events */}
                  {!event.isLocked && (
                    <div
                      className="absolute bottom-0 left-0 right-0 h-3 z-20 cursor-ns-resize flex items-end justify-center pb-0.5 opacity-0 group-hover/event:opacity-100 transition-opacity"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleResizeStart(e, event.id, 'bottom', new Date(event.startsAt), new Date(event.endsAt));
                      }}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        handleResizeStart(e, event.id, 'bottom', new Date(event.startsAt), new Date(event.endsAt));
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="w-8 h-1 rounded-full bg-white/70" />
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
    </div>
  );
};

export default DayColumn;
