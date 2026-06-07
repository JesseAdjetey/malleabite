import React from 'react';
import CalendarEvent from './CalendarEvent';
import { CalendarEventType } from '@/lib/stores/types';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

interface SelectableCalendarEventProps {
  event: CalendarEventType;
  color?: string;
  isLocked?: boolean;
  hasAlarm?: boolean;
  hasReminder?: boolean;
  hasTodo?: boolean;
  participants?: string[];
  onClick?: () => void;
  onLockToggle?: (locked: boolean) => void;
  
  // Bulk selection props
  isBulkMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (eventId: string) => void;
  compact?: boolean;
}

const SelectableCalendarEvent: React.FC<SelectableCalendarEventProps> = ({
  event,
  color,
  isLocked,
  hasAlarm,
  hasReminder,
  hasTodo,
  participants,
  onClick,
  onLockToggle,
  isBulkMode = false,
  isSelected = false,
  onToggleSelection,
  compact = false,
}) => {
  const handleCheckboxChange = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleSelection) {
      onToggleSelection(event.id);
    }
  };

  const handleEventClick = () => {
    if (isBulkMode && onToggleSelection) {
      // In bulk mode, clicking the event toggles selection
      onToggleSelection(event.id);
    } else if (onClick) {
      // Normal mode - open event details
      onClick();
    }
  };

  return (
    <div className="relative h-full">
      {/* Selection Checkbox (only in bulk mode) */}
      {isBulkMode && (
        <div
          className="absolute -left-1 -top-1 z-10"
          onClick={handleCheckboxChange}
        >
          <Checkbox
            checked={isSelected}
            className={cn(
              "h-5 w-5 rounded-full border-2 transition-all",
              isSelected 
                ? "bg-primary border-primary" 
                : "bg-background border-muted-foreground hover:border-primary"
            )}
          />
        </div>
      )}

      {/* Event Component with selection highlight */}
      <div
        className={cn(
          "transition-all duration-200 h-full",
          isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-md"
        )}
      >
        <CalendarEvent
          event={event}
          color={color}
          isLocked={isLocked}
          hasAlarm={hasAlarm}
          hasReminder={hasReminder}
          hasTodo={hasTodo}
          participants={participants}
          onClick={handleEventClick}
          onLockToggle={onLockToggle}
          compact={compact}
        />
      </div>
    </div>
  );
};

// Memoized for the same reason as CalendarEvent — ignore callback identity, compare
// the data + selection flags that affect output. Prevents whole-grid pill re-renders
// on a sibling's live-resize / parent re-render.
function selectablePropsEqual(prev: SelectableCalendarEventProps, next: SelectableCalendarEventProps): boolean {
  const a = prev.event;
  const b = next.event;
  return (
    (a === b ||
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
        (a.mallyActions?.length ?? 0) === (b.mallyActions?.length ?? 0))) &&
    prev.color === next.color &&
    prev.isLocked === next.isLocked &&
    prev.hasAlarm === next.hasAlarm &&
    prev.hasReminder === next.hasReminder &&
    prev.hasTodo === next.hasTodo &&
    prev.compact === next.compact &&
    prev.isBulkMode === next.isBulkMode &&
    prev.isSelected === next.isSelected &&
    (prev.participants?.length ?? 0) === (next.participants?.length ?? 0)
  );
}

export default React.memo(SelectableCalendarEvent, selectablePropsEqual);
