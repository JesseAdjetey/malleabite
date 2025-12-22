
import React from "react";
import { cn } from "@/lib/utils";
import { useEventDrag } from "@/hooks/use-event-drag";
import EventIndicators from "./event-components/EventIndicators";
import EventLockToggle from "./event-components/EventLockToggle";
import DragHandle from "./event-components/DragHandle";
import { CalendarEventType } from "@/lib/stores/types";
import { CheckSquare, ListTodo, Repeat } from "lucide-react";

interface CalendarEventProps {
  event: CalendarEventType;
  color?: string;
  isLocked?: boolean;
  hasAlarm?: boolean;
  hasReminder?: boolean;
  hasTodo?: boolean;
  participants?: string[];
  onClick?: () => void;
  onLockToggle?: (locked: boolean) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  compact?: boolean;
}

const CalendarEvent: React.FC<CalendarEventProps> = ({
  event,
  color = "bg-primary/70",
  isLocked = false,
  hasAlarm = false,
  hasReminder = false,
  hasTodo = false,
  participants = [],
  onClick,
  onLockToggle,
  onMouseDown,
  compact = false,
}) => {
  const {
    isDragging,
    handleDragStart,
    handleDragEnd,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleClick,
  } = useEventDrag(event, isLocked, color);

  const handleLockToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onLockToggle) onLockToggle(!isLocked);
  };

  // Whether this is a todo-related event
  const isTodoEvent = Boolean(event.isTodo || event.todoId || hasTodo);
  
  // Whether this is a recurring event
  const isRecurring = Boolean(event.isRecurring || event.recurrenceParentId);

  // Determine if color is a hex value or a class name
  const isHexColor = color?.startsWith('#') || color?.startsWith('rgb');
  const bgStyle = isHexColor ? { backgroundColor: color } : undefined;
  const bgClass = isHexColor ? 'bg-purple-500' : color; // Fallback for hex colors

  return (
    <div
      className={cn(
        "calendar-event group rounded-sm sm:rounded overflow-hidden",
        bgClass,
        !isLocked && "cursor-move",
        isDragging && "opacity-70",
        compact ? "h-auto" : "h-full"
      )}
      style={{ minHeight: compact ? 'auto' : '100%', ...bgStyle }}
      onClick={(e) => handleClick(e, onClick)}
      draggable={!isLocked}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={onMouseDown}
    >
      <div className={cn("relative", compact ? "px-1.5 py-1" : "h-full p-1 sm:p-1.5")}>
        {/* Lock/Unlock Button - hidden in compact mode */}
        {!compact && <EventLockToggle isLocked={Boolean(isLocked)} onToggle={handleLockToggle} />}

        {/* Drag Handle (only shown if not locked and not compact) */}
        {!isLocked && !compact && <DragHandle />}
        
        {/* Recurring indicator at top right - smaller in compact mode */}
        {isRecurring && !compact && (
          <div className="absolute top-0 right-0 bg-white/20 rounded-full p-0.5 sm:p-1 m-0.5">
            <Repeat size={8} className="text-white sm:w-[10px] sm:h-[10px]" />
          </div>
        )}

        {/* Event Title with inline indicators for compact mode */}
        <div className={cn(
          "font-medium leading-tight truncate flex items-center gap-1",
          compact ? "text-[11px]" : "text-[10px] sm:text-xs"
        )}>
          <span className="truncate">{event.title}</span>
          {/* Compact inline indicators */}
          {compact && (isRecurring || hasAlarm || hasReminder || isTodoEvent) && (
            <span className="flex-shrink-0 flex items-center gap-0.5 opacity-80">
              {isRecurring && <Repeat size={9} />}
              {hasAlarm && <span className="w-1.5 h-1.5 rounded-full bg-yellow-300" />}
              {hasReminder && <span className="w-1.5 h-1.5 rounded-full bg-blue-300" />}
              {isTodoEvent && <span className="w-1.5 h-1.5 rounded-full bg-green-300" />}
            </span>
          )}
        </div>

        {/* Event Time or Description - hidden in compact mode */}
        {!compact && (
          <div className="text-[9px] sm:text-xs opacity-80 truncate hidden sm:block">{event.description}</div>
        )}

        {/* Full indicators - only in non-compact mode */}
        {!compact && (
          <>
            <EventIndicators
              hasAlarm={hasAlarm}
              hasReminder={hasReminder}
              hasTodo={isTodoEvent}
              participants={participants}
            />

            {/* Todo indicator at bottom right */}
            {isTodoEvent && (
              <div className="absolute bottom-0 right-0 bg-white/10 rounded-full p-0.5 m-0.5">
                <ListTodo size={10} className="text-white sm:w-3 sm:h-3" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CalendarEvent;
