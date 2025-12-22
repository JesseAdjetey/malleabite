
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
        "calendar-event group h-full rounded-sm sm:rounded overflow-hidden",
        bgClass,
        !isLocked && "cursor-move",
        isDragging && "opacity-70"
      )}
      style={{ height: '100%', minHeight: '100%', ...bgStyle }}
      onClick={(e) => handleClick(e, onClick)}
      draggable={!isLocked}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={onMouseDown}
    >
      <div className="relative h-full p-1 sm:p-1.5">
        {/* Lock/Unlock Button */}
        <EventLockToggle isLocked={Boolean(isLocked)} onToggle={handleLockToggle} />

        {/* Drag Handle (only shown if not locked) */}
        {!isLocked && <DragHandle />}
        
        {/* Recurring indicator at top right */}
        {isRecurring && (
          <div className="absolute top-0 right-0 bg-white/20 rounded-full p-0.5 sm:p-1 m-0.5">
            <Repeat size={8} className="text-white sm:w-[10px] sm:h-[10px]" />
          </div>
        )}

        {/* Event Title */}
        <div className="font-medium text-[10px] sm:text-xs leading-tight truncate">{event.title}</div>

        {/* Event Time or Description - hidden on very small events */}
        <div className="text-[9px] sm:text-xs opacity-80 truncate hidden sm:block">{event.description}</div>

        {/* Indicators */}
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
      </div>
    </div>
  );
};

export default CalendarEvent;
