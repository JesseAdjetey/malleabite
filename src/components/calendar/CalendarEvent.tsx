
import React, { useCallback, useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useEventDrag } from "@/hooks/use-event-drag";
import EventIndicators from "./event-components/EventIndicators";
import EventLockToggle from "./event-components/EventLockToggle";
import DragHandle from "./event-components/DragHandle";
import { CalendarEventType } from "@/lib/stores/types";
import { CheckSquare, ListTodo, Repeat } from "lucide-react";
import { useEventHighlightStore } from "@/lib/stores/event-highlight-store";

interface CalendarEventProps {
  event: CalendarEventType;
  color?: string;
  isLocked?: boolean;
  hasAlarm?: boolean;
  hasReminder?: boolean;
  hasTodo?: boolean;
  participants?: string[];
  onClick?: () => void;
  onLockToggle?: (isLocked: boolean) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  compact?: boolean; // If true, render a more compact version (e.g., for month view)
  isOverlapping?: boolean;
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
  isOverlapping = false,
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

  // Spotlight: glow + scroll into view when this event is highlighted
  const highlightedEventId = useEventHighlightStore(s => s.highlightedEventId);
  const isSpotlit = highlightedEventId === event.id;

  // Track height for short event detection
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isShort, setIsShort] = useState(false);  // < 40px
  const [isTiny, setIsTiny] = useState(false);     // < 25px
  const [isHovered, setIsHovered] = useState(false);

  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    if (node && isSpotlit) {
      requestAnimationFrame(() => {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }, [isSpotlit]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || compact) return;

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const h = entry.contentRect.height;
        setIsShort(h < 40);
        setIsTiny(h < 25);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [compact]);

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
      ref={combinedRef}
      className={cn(
        "calendar-event group relative rounded-sm sm:rounded overflow-hidden",
        bgClass,
        !isLocked && "cursor-move",
        isDragging && "opacity-70",
        compact ? "h-auto" : "h-full",
        isSpotlit && "event-spotlight",
        isOverlapping && "event-collision-glow"
      )}
      style={{ minHeight: compact ? 'auto' : '100%', ...bgStyle }}
      onClick={onClick}
      draggable={!isLocked}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={onMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Hover overlay — direct child so overflow-hidden clips it to card shape */}
      {!compact && (
        <div className={cn(
          "absolute inset-0 z-10 bg-black/40 flex items-center justify-center gap-2 transition-opacity duration-150",
          (isHovered && !isDragging) ? "opacity-100" : "opacity-0 pointer-events-none"
        )}>
          {isRecurring && (
            <div className="bg-white/20 rounded-full p-0.5">
              <Repeat size={10} className="text-white" />
            </div>
          )}
          {!isLocked && <DragHandle />}
          <EventLockToggle isLocked={Boolean(isLocked)} onToggle={handleLockToggle} />
        </div>
      )}

      <div className={cn(
        "relative",
        compact ? "px-1.5 py-1" : isShort ? "h-full px-1 py-0.5" : "h-full p-1 sm:p-1.5"
      )}>

        {/* Event Title with inline indicators for compact mode */}
        <div className={cn(
          "font-medium leading-tight truncate flex items-center gap-1",
          compact ? "text-[11px]" : isShort ? "text-[9px] sm:text-[10px]" : "text-[10px] sm:text-xs"
        )}>
          <span className="truncate">{event.title}</span>
          {/* Inline indicators for short events */}
          {isShort && !compact && (isRecurring || isTodoEvent || isLocked) && (
            <span className="flex-shrink-0 flex items-center gap-0.5 opacity-80">
              {isLocked && <span className="w-1.5 h-1.5 rounded-full bg-yellow-300" />}
              {isRecurring && <Repeat size={8} />}
              {isTodoEvent && <span className="w-1.5 h-1.5 rounded-full bg-green-300" />}
            </span>
          )}
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

        {/* Event Time or Description - hidden in compact and short modes */}
        {!compact && !isShort && (
          <div className="text-[9px] sm:text-xs opacity-80 truncate hidden sm:block">{event.description}</div>
        )}

        {/* Full indicators - only in non-compact, non-short mode */}
        {!compact && !isShort && (
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
