
import React, { useCallback, useState } from "react";
import { motion } from "framer-motion";
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
  /**
   * Rendered pixel height of the pill, already computed by the parent (DayColumn)
   * from the event's start/end. Used to derive short/tiny layout WITHOUT a
   * per-pill ResizeObserver — with 100+ pills, 100+ ResizeObservers firing during
   * layout was a measured source of main-thread jank on scroll.
   */
  heightPx?: number;
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
  heightPx,
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

  const [isHovered, setIsHovered] = useState(false);

  // Short/tiny layout derived directly from the height the parent already computed
  // — no ResizeObserver per pill. When heightPx is unknown (callers that don't pass
  // it), treat as full-size (the prior observer default before first measurement).
  const isShort = !compact && heightPx != null && heightPx < 40;
  const isTiny  = !compact && heightPx != null && heightPx < 25;

  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    if (node && isSpotlit) {
      requestAnimationFrame(() => {
        node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }, [isSpotlit]);

  const handleLockToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onLockToggle) onLockToggle(!isLocked);
  };

  // Whether this is a todo-related event
  const isTodoEvent = Boolean(event.isTodo || event.todoId || hasTodo);

  // Whether this is a recurring event
  const isRecurring = Boolean(event.isRecurring || event.recurrenceParentId);

  // Whether this event has Mally Actions attached
  const hasActionsAttached = Boolean(event.mallyActions?.length);

  // Determine if color is a hex value or a class name
  const isHexColor = color?.startsWith('#') || color?.startsWith('rgb');
  const bgStyle = isHexColor ? { backgroundColor: color } : undefined;
  const bgClass = isHexColor ? 'bg-purple-500' : color; // Fallback for hex colors

  return (
    <motion.div
      ref={combinedRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: isDragging ? 0.7 : 1, scale: 1 }}
      transition={{ type: "spring", damping: 24, stiffness: 300 }}
      whileHover={!isDragging && !compact ? { scale: 1.012, transition: { type: "spring", damping: 22, stiffness: 450 } } : undefined}
      whileTap={!isLocked && !compact ? { scale: 0.97, transition: { type: "spring", damping: 22, stiffness: 500 } } : undefined}
      style={{ willChange: 'transform, opacity', minHeight: compact ? 'auto' : '100%', ...bgStyle }}
      className={cn(
        "calendar-event group relative rounded-sm sm:rounded overflow-hidden",
        bgClass,
        !isLocked && "cursor-move",
        compact ? "h-auto" : "h-full",
        isSpotlit && "event-spotlight",
        isOverlapping && "event-collision-glow"
      )}
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
          {compact && (isRecurring || hasAlarm || hasReminder || isTodoEvent || hasActionsAttached) && (
            <span className="flex-shrink-0 flex items-center gap-0.5 opacity-80">
              {isRecurring && <Repeat size={9} />}
              {hasAlarm && <span className="w-1.5 h-1.5 rounded-full bg-yellow-300" />}
              {hasReminder && <span className="w-1.5 h-1.5 rounded-full bg-blue-300" />}
              {isTodoEvent && <span className="w-1.5 h-1.5 rounded-full bg-green-300" />}
              {hasActionsAttached && <span className="w-1.5 h-1.5 rounded-full bg-yellow-300/90" />}
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
              hasActions={hasActionsAttached}
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
    </motion.div>
  );
};

// Memoized so a parent re-render (e.g. a live-resize setState on a sibling, or the
// day column re-rendering) doesn't re-render every pill. The comparator intentionally
// ignores callback identity (onClick/onLockToggle/onMouseDown are recreated each parent
// render) and compares only the data that actually affects this pill's output.
function eventPropsEqual(prev: CalendarEventProps, next: CalendarEventProps): boolean {
  const a = prev.event;
  const b = next.event;
  return (
    a === b ||
    (a.id === b.id &&
      a.title === b.title &&
      a.startsAt === b.startsAt &&
      a.endsAt === b.endsAt &&
      a.description === b.description &&
      a.color === b.color &&
      a.isLocked === b.isLocked &&
      a.isTodo === b.isTodo &&
      a.todoId === b.todoId &&
      a.isRecurring === b.isRecurring &&
      a.recurrenceParentId === b.recurrenceParentId &&
      (a.mallyActions?.length ?? 0) === (b.mallyActions?.length ?? 0))
  ) &&
    prev.color === next.color &&
    prev.isLocked === next.isLocked &&
    prev.hasAlarm === next.hasAlarm &&
    prev.hasReminder === next.hasReminder &&
    prev.hasTodo === next.hasTodo &&
    prev.compact === next.compact &&
    prev.isOverlapping === next.isOverlapping &&
    (prev.participants?.length ?? 0) === (next.participants?.length ?? 0);
}

export default React.memo(CalendarEvent, eventPropsEqual);
