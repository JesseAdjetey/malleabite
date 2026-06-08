
import React, { useState, useMemo, useRef, memo } from "react";
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
import { useReminderEventPickerStore } from "@/lib/stores/reminder-event-picker-store";

interface DayColumnProps {
  currentDate: dayjs.Dayjs;
  dayEvents: CalendarEventType[];
  /** Full event list used for alternative-slot search. Falls back to dayEvents. */
  allEvents?: CalendarEventType[];
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

/**
 * The hour cells behind the events. Extracted + memoized so the drag-over highlight
 * (which fires continuously while dragging a pill across hours) re-renders ONLY these
 * lightweight divs — not the sibling event-pill map (40–100 pills + their context
 * menus). `dragOverHour` state lives here, isolated from the pills.
 */
interface HourGridProps {
  currentDate: dayjs.Dayjs;
  onTimeSlotClick: (day: dayjs.Dayjs, hour: dayjs.Dayjs) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, day: dayjs.Dayjs, hour: dayjs.Dayjs) => void;
}

const HourGrid = memo(function HourGrid({ currentDate, onTimeSlotClick, onDragOver, onDrop }: HourGridProps) {
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);

  const handleDragLeave = (e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDragOverHour(null);
    }
  };

  return (
    <div onDragLeave={handleDragLeave}>
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
            setDragOverHour(i);
          }}
          onDragEnter={() => setDragOverHour(i)}
          onDrop={(e) => { setDragOverHour(null); onDrop(e, currentDate, hour); }}
        />
      ))}
    </div>
  );
}, (prev, next) => prev.currentDate.isSame(next.currentDate, 'day'));

const DayColumn: React.FC<DayColumnProps> = ({
  currentDate,
  dayEvents,
  allEvents,
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
  // Track when context menu last closed to prevent spurious openEventSummary calls
  const ctxMenuClosedAtRef = useRef(0);

  const { isPickingEvent, completePicking } = useReminderEventPickerStore();

  // Conflict detection
  const { conflicts, isEnabled: conflictEnabled } = useConflictMap(dayEvents);
  // Reschedule sheet state
  const [rescheduleEvent, setRescheduleEvent] = useState<CalendarEventType | null>(null);

  // Live resize preview. During a drag we DO NOT call setState per pointermove —
  // that would re-render the whole column (every pill) ~60×/sec and is the main
  // source of resize lag. Instead we mutate ONLY the dragged pill's DOM node
  // (top/height) directly via this ref, and commit to React state only on end.
  const columnRef = useRef<HTMLDivElement>(null);

  // Calculate event positions for overlapping events
  const eventPositions = useMemo(() => calculateEventPositions(dayEvents), [dayEvents]);

  const [, resizeHandlers] = useEventResize({
    minutesPerPixel: 60 / hourHeight, // 0.75 min per pixel (80px = 1 hour = 60 min)
    snapInterval: 15,
    minDuration: 15,
    onResize: (eventId, newStart, newEnd) => {
      // Direct DOM mutation — no React re-render during the drag.
      const node = columnRef.current?.querySelector<HTMLElement>(`[data-event-id="${eventId}"]`);
      if (node) {
        const startStr = dayjs(newStart).format('HH:mm');
        const endStr = dayjs(newEnd).format('HH:mm');
        node.style.top = `${calculateEventPosition(startStr, hourHeight)}px`;
        node.style.height = `${calculateEventHeight(startStr, endStr, hourHeight)}px`;
      }
    },
    onResizeEnd: async (eventId, newStart, newEnd) => {
      const event = dayEvents.find(e => e.id === eventId);
      if (event && onResizeEvent) {
        onResizeEvent(event, newStart, newEnd);
      }
      return true;
    },
    onResizeCancel: () => {
      // Snap the pill back to its original position by clearing the inline overrides;
      // React's last render already holds the correct top/height.
    },
  });

  return (
    <div
      ref={columnRef}
      className="relative border-r border-gray-200 dark:border-white/10"
    >
      {/* Hour cells + drag-over highlight live in their own memoized component so
          dragging across hours doesn't re-render the event pills. */}
      <HourGrid
        currentDate={currentDate}
        onTimeSlotClick={onTimeSlotClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
      />

      {/* Events displayed at their exact positions */}
      {dayEvents.map(event => {
        const timeInfo = getTimeInfo(event.description, event.startsAt, event.endsAt);

        // Resize preview is applied via direct DOM mutation during the drag (see
        // onResize above), so render always uses the committed times.
        const topPosition = calculateEventPosition(timeInfo.start, hourHeight);
        const eventHeight = calculateEventHeight(timeInfo.start, timeInfo.end, hourHeight);

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

        return (
          <div
            key={event.id}
            data-event-id={event.id}
            className={cn(
              "absolute z-10 transition-opacity",
              draggingBulkEventId &&
                isSelected(event.id) &&
                event.id !== draggingBulkEventId &&
                "opacity-30",
              // During a bulk drag, let drag events pass through OTHER selected events
              // (not the one being dragged) so the underlying time-slot divs register
              // as valid drop targets instead of being blocked by those event cards
              draggingBulkEventId &&
                isSelected(event.id) &&
                event.id !== draggingBulkEventId &&
                "pointer-events-none"
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
              if (isPickingEvent) {
                completePicking(event);
                return;
              }
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
                    heightPx={eventHeight}
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

      {/* Current Time indicator — owns its own minute ticker internally */}
      <CurrentTimeIndicator
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

// Memoized so a WeekView re-render (dialogs, hover, selection changes elsewhere)
// doesn't re-render all 7 columns and every pill inside them. Callback props are
// recreated each WeekView render, so the comparator ignores their identity and
// compares the data + flags that actually change this column's output. currentDate
// is a fresh Dayjs each render, so it's compared by its day string.
function dayColumnPropsEqual(prev: DayColumnProps, next: DayColumnProps): boolean {
  if (prev.dayEvents !== next.dayEvents) return false; // dayEvents arrays are memoized upstream
  if (!prev.currentDate.isSame(next.currentDate, 'day')) return false;
  if (prev.isBulkMode !== next.isBulkMode) return false;
  if (prev.draggingBulkEventId !== next.draggingBulkEventId) return false;
  if (prev.allEvents !== next.allEvents) return false;
  // isSelected is a closure over bulk-selection state; when isBulkMode is active we
  // can't reliably diff it, so re-render columns while in bulk mode.
  if (next.isBulkMode) return false;
  return true;
}

export default React.memo(DayColumn, dayColumnPropsEqual);
