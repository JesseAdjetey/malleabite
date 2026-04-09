// CalendarItem - Individual calendar row inside a group section.
// Shows checkbox toggle, color dot, name, drag handle.

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Check, GripVertical, MoreHorizontal, Trash2, ArrowRightLeft, ShieldAlert, ShieldOff } from 'lucide-react';
import { ConnectedCalendar, CalendarSource, CALENDAR_SOURCES } from '@/types/calendar';
import { PERSONAL_CALENDAR_ID } from '@/lib/stores/calendar-filter-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { springs } from '@/lib/animations';
import { useDraggable } from '@dnd-kit/core';
import { useCalendarFilterStore } from '@/lib/stores/calendar-filter-store';
import { useSettingsStore } from '@/lib/stores/settings-store';

interface CalendarItemProps {
  calendar: ConnectedCalendar;
  onToggle: (calendarId: string, isActive: boolean) => void;
  onDelete: (calendarId: string) => void;
  onMoveToGroup?: (calendarId: string) => void;
}

const CalendarItem: React.FC<CalendarItemProps> = ({
  calendar,
  onToggle,
  onDelete,
  onMoveToGroup,
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `calendar:${calendar.id}`,
    data: { type: 'calendar', calendar },
  });
  const isVisible = useCalendarFilterStore((state) => !state.hiddenCalendarIds.has(calendar.id));

  const { reschedulingPrefs, setReschedulingPrefs } = useSettingsStore();
  const isConflictChecked =
    reschedulingPrefs.mode !== 'off' &&
    !reschedulingPrefs.conflictExcludedCalendarIds.includes(calendar.id);

  const toggleConflictCheck = () => {
    const excluded = reschedulingPrefs.conflictExcludedCalendarIds;
    if (isConflictChecked) {
      setReschedulingPrefs({ conflictExcludedCalendarIds: [...excluded, calendar.id] });
    } else {
      setReschedulingPrefs({ conflictExcludedCalendarIds: excluded.filter((id) => id !== calendar.id) });
    }
  };

  const sourceLabel = CALENDAR_SOURCES[calendar.source]?.label || calendar.source;
  const isPersonal = calendar.id === PERSONAL_CALENDAR_ID;

  return (
    <motion.div
      ref={setNodeRef}
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{
        opacity: isDragging ? 0.3 : 1,
        y: 0,
        scale: 1,
      }}
      exit={{ opacity: 0, y: -4 }}
      transition={springs.gentle}
      className={cn(
        'group flex items-center gap-2 py-1.5 px-2 rounded-lg',
        'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
        'transition-colors duration-150',
      )}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="opacity-0 group-hover:opacity-40 hover:!opacity-70 cursor-grab active:cursor-grabbing transition-opacity duration-150 flex-shrink-0"
      >
        <GripVertical size={14} className="text-muted-foreground" />
      </div>

      {/* Checkbox Toggle */}
      <button
        onClick={() => onToggle(calendar.id, !isVisible)}
        className={cn(
          'rounded-[4px] border-2 flex items-center justify-center flex-shrink-0',
          'transition-colors duration-100',
          isVisible
            ? 'border-transparent'
            : 'border-muted-foreground/30 bg-transparent'
        )}
        style={{
          width: '1rem',
          height: '1rem',
          minWidth: '1rem',
          minHeight: '1rem',
          padding: 0,
          backgroundColor: isVisible ? calendar.color : undefined,
        }}
        aria-label={`Toggle ${calendar.name} visibility`}
      >
        {isVisible && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 20, stiffness: 400 }}
          >
            <Check size={10} className="text-white" strokeWidth={3} />
          </motion.div>
        )}
      </button>

      {/* Calendar Name + Source */}
      <div className="flex-1 min-w-0">
        <div className={cn(
          'text-[13px] font-medium truncate',
          isVisible
            ? 'text-foreground'
            : 'text-muted-foreground'
        )}>
          {calendar.name}
        </div>
        {!isPersonal && calendar.accountEmail && (
          <div className="text-[10px] text-muted-foreground/60 truncate">
            {calendar.accountEmail}
          </div>
        )}
      </div>

      {/* More Actions — hide for the built-in Personal calendar */}
      {!isPersonal && (
        <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-all duration-150 flex-shrink-0">
            <MoreHorizontal size={14} className="text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          {onMoveToGroup && (
            <DropdownMenuItem onClick={() => onMoveToGroup(calendar.id)}>
              <ArrowRightLeft size={14} className="mr-2" />
              Move to Group
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            onClick={toggleConflictCheck}
            disabled={reschedulingPrefs.mode === 'off'}
          >
            {isConflictChecked ? (
              <>
                <ShieldOff size={14} className="mr-2 text-muted-foreground" />
                Disable conflict check
              </>
            ) : (
              <>
                <ShieldAlert size={14} className="mr-2 text-amber-500" />
                Enable conflict check
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDelete(calendar.id)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 size={14} className="mr-2" />
            Remove Calendar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      )}
    </motion.div>
  );
};

export default CalendarItem;
