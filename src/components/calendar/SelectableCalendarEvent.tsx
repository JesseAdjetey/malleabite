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

export default SelectableCalendarEvent;
