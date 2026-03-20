import React, { useState } from "react";
import { CalendarEventType } from "@/lib/stores/types";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import CalendarEvent from "./CalendarEvent";
import SelectableCalendarEvent from "./SelectableCalendarEvent";
import EventContextMenu from "./EventContextMenu";
import { ChevronDown, ChevronUp } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AllDayEvent {
  event: CalendarEventType;
  dayKey: string; // YYYY-MM-DD
}

interface AllDaySectionBaseProps {
  /** All events (the component filters for isAllDay internally) */
  allDayEvents: CalendarEventType[];
  onEventClick?: (event: CalendarEventType) => void;
  onAllDayCellClick?: (day: dayjs.Dayjs) => void;
  isBulkMode?: boolean;
  isSelected?: (eventId: string) => boolean;
  onToggleSelection?: (eventId: string) => void;
  // Context menu handlers (optional – used in week view)
  onDeleteEvent?: (eventId: string) => void;
  onDuplicateEvent?: (event: CalendarEventType) => void;
  onColorChange?: (eventId: string, color: string) => void;
  onAddAlarm?: (event: CalendarEventType) => void;
  onAddTodo?: (event: CalendarEventType) => void;
  onLockToggle?: (id: string, isLocked: boolean) => void;
}

// ─── Week All-Day Row ────────────────────────────────────────────────────────

interface WeekAllDayRowProps extends AllDaySectionBaseProps {
  weekDays: { currentDate: dayjs.Dayjs; today: boolean }[];
  onAllDayEventDrop?: (event: CalendarEventType, newDate: dayjs.Dayjs) => void;
}

/**
 * Renders an all-day event strip for the WEEK view.
 * Sits between the WeekHeader pill and the scrollable time-grid.
 * Uses the same 8-column grid as the time-grid (auto + 7 × 1fr).
 */
export const WeekAllDayRow: React.FC<WeekAllDayRowProps> = ({
  weekDays,
  allDayEvents,
  onEventClick,
  onAllDayCellClick,
  isBulkMode = false,
  isSelected = () => false,
  onToggleSelection = () => {},
  onDeleteEvent,
  onDuplicateEvent,
  onColorChange,
  onAddAlarm,
  onAddTodo,
  onLockToggle,
  onAllDayEventDrop,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  // Group all-day events by day
  const eventsByDay: Record<string, CalendarEventType[]> = {};
  weekDays.forEach(({ currentDate }) => {
    eventsByDay[currentDate.format("YYYY-MM-DD")] = [];
  });
  allDayEvents.forEach((event) => {
    const dayStr = event.date
      ? dayjs(event.date).format("YYYY-MM-DD")
      : event.startsAt
        ? dayjs(event.startsAt).format("YYYY-MM-DD")
        : null;
    if (dayStr && eventsByDay[dayStr]) {
      eventsByDay[dayStr].push(event);
    }
  });

  const maxEventsInAnyDay = Math.max(
    0,
    ...Object.values(eventsByDay).map((e) => e.length)
  );
  const collapsedMax = 2;
  const showToggle = maxEventsInAnyDay > collapsedMax;

  return (
    <div className="mx-2 mb-1 rounded-xl overflow-hidden border border-purple-100 dark:border-white/5 bg-purple-50/40 dark:bg-secondary/30">
      <div className="px-4" style={{ display: 'grid', gridTemplateColumns: `auto repeat(${weekDays.length}, 1fr)` }}>
        {/* Label cell */}
        <div className="w-16 flex items-center justify-center py-1.5">
          <span className="text-[10px] font-medium text-purple-600 dark:text-purple-300 uppercase tracking-wide select-none">
            All day
          </span>
        </div>

        {/* One cell per day */}
        {weekDays.map(({ currentDate }, index) => {
          const dayStr = currentDate.format("YYYY-MM-DD");
          const dayAllDay = eventsByDay[dayStr] || [];
          const visibleEvents = expanded
            ? dayAllDay
            : dayAllDay.slice(0, collapsedMax);
          const hiddenCount = dayAllDay.length - visibleEvents.length;

          return (
            <div
              key={index}
              className={cn(
                "relative border-l border-purple-100 dark:border-white/5 min-h-[28px] py-1 px-0.5 flex flex-col gap-0.5 cursor-pointer transition-colors",
                "hover:bg-purple-100/40 dark:hover:bg-white/5",
                dragOverDay === dayStr && "bg-purple-200/50 dark:bg-white/10"
              )}
              onDragOver={(e) => { e.preventDefault(); setDragOverDay(dayStr); }}
              onDragLeave={() => setDragOverDay(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverDay(null);
                const raw = e.dataTransfer.getData('application/json');
                if (!raw) return;
                try {
                  const data = JSON.parse(raw);
                  if (data._allDayDrag && onAllDayEventDrop) {
                    onAllDayEventDrop(data, currentDate);
                  }
                } catch {}
              }}
              onClick={(e) => {
                if (
                  (e.target as HTMLElement).closest(
                    ".calendar-event-wrapper"
                  ) === null
                ) {
                  onAllDayCellClick?.(currentDate);
                }
              }}
            >
              {visibleEvents.map((event) => (
                <div
                  key={event.id}
                  className="calendar-event-wrapper"
                  draggable
                  onDragStart={(e) => {
                    e.stopPropagation();
                    e.dataTransfer.setData('application/json', JSON.stringify({ ...event, _allDayDrag: true }));
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isBulkMode) {
                      onEventClick?.(event);
                    }
                  }}
                >
                  {isBulkMode ? (
                    <SelectableCalendarEvent
                      event={event}
                      isBulkMode={isBulkMode}
                      isSelected={isSelected(event.id)}
                      onToggleSelection={onToggleSelection}
                      compact
                    />
                  ) : onDeleteEvent ? (
                    <EventContextMenu
                      event={event}
                      onEdit={onEventClick}
                      onDelete={onDeleteEvent}
                      onDuplicate={onDuplicateEvent}
                      onColorChange={onColorChange}
                      onLockToggle={
                        onLockToggle
                          ? (eventId, locked) =>
                              onLockToggle(eventId, locked)
                          : undefined
                      }
                      onAddAlarm={onAddAlarm}
                      onAddTodo={onAddTodo}
                    >
                      <CalendarEvent
                        event={event}
                        color={event.color}
                        isLocked={event.isLocked}
                        hasAlarm={event.hasAlarm}
                        hasReminder={event.hasReminder}
                        hasTodo={event.isTodo}
                        participants={event.participants}
                        compact
                      />
                    </EventContextMenu>
                  ) : (
                    <CalendarEvent
                      event={event}
                      color={event.color}
                      isLocked={event.isLocked}
                      hasAlarm={event.hasAlarm}
                      hasReminder={event.hasReminder}
                      hasTodo={event.isTodo}
                      participants={event.participants}
                      compact
                    />
                  )}
                </div>
              ))}
              {!expanded && hiddenCount > 0 && (
                <span className="text-[9px] text-purple-500 dark:text-purple-300 text-center">
                  +{hiddenCount} more
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Expand / Collapse toggle */}
      {showToggle && (
        <button
          className="w-full flex items-center justify-center gap-1 py-0.5 text-[10px] text-purple-500 dark:text-purple-300 hover:bg-purple-100/40 dark:hover:bg-white/5 transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? (
            <>
              <ChevronUp size={12} /> Show less
            </>
          ) : (
            <>
              <ChevronDown size={12} /> Show all
            </>
          )}
        </button>
      )}
    </div>
  );
};

// ─── Day All-Day Row ─────────────────────────────────────────────────────────

interface DayAllDayRowProps extends AllDaySectionBaseProps {}

/**
 * Renders an all-day event strip for the DAY view.
 * Sits between the DayHeader pill and the scrollable time-grid.
 * Uses a 2-column layout matching the time-grid (label + content).
 */
export const DayAllDayRow: React.FC<DayAllDayRowProps> = ({
  allDayEvents,
  onEventClick,
  onAllDayCellClick,
  isBulkMode = false,
  isSelected = () => false,
  onToggleSelection = () => {},
}) => {
  if (allDayEvents.length === 0) {
    return null; // Don't render the row if there are no all-day events on this day
  }

  return (
    <div className="mx-2 mb-1 rounded-xl overflow-hidden border border-purple-100 dark:border-white/5 bg-purple-50/40 dark:bg-secondary/30">
      <div className="grid grid-cols-[auto_1fr] px-4">
        {/* Label */}
        <div className="w-16 flex items-center justify-center py-1.5">
          <span className="text-[10px] font-medium text-purple-600 dark:text-purple-300 uppercase tracking-wide select-none">
            All day
          </span>
        </div>

        {/* Events */}
        <div className="flex flex-wrap items-center gap-1 py-1.5 px-1 min-h-[28px]">
          {allDayEvents.map((event) => (
            <div
              key={event.id}
              className="calendar-event-wrapper max-w-[200px]"
              onClick={(e) => {
                e.stopPropagation();
                if (!isBulkMode) {
                  onEventClick?.(event);
                }
              }}
            >
              {isBulkMode ? (
                <SelectableCalendarEvent
                  event={event}
                  isBulkMode={isBulkMode}
                  isSelected={isSelected(event.id)}
                  onToggleSelection={onToggleSelection}
                  compact
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
                  compact
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Helper: split events into all-day vs timed ─────────────────────────────

export function splitAllDayEvents(events: CalendarEventType[]) {
  const allDayEvents: CalendarEventType[] = [];
  const timedEvents: CalendarEventType[] = [];

  events.forEach((event) => {
    if (event.isAllDay) {
      allDayEvents.push(event);
    } else {
      timedEvents.push(event);
    }
  });

  return { allDayEvents, timedEvents };
}
