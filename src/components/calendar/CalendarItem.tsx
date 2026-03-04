// CalendarItem - Individual calendar row inside a group section.
// Shows checkbox toggle, color dot, name, drag handle.

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Check, GripVertical, MoreHorizontal, Trash2, ArrowRightLeft } from 'lucide-react';
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

interface CalendarItemProps {
  calendar: ConnectedCalendar;
  onToggle: (calendarId: string, isActive: boolean) => void;
  onDelete: (calendarId: string) => void;
  onMoveToGroup?: (calendarId: string) => void;
  isDragging?: boolean;
  dragHandleProps?: Record<string, any>;
}

const CalendarItem: React.FC<CalendarItemProps> = ({
  calendar,
  onToggle,
  onDelete,
  onMoveToGroup,
  isDragging = false,
  dragHandleProps,
}) => {
  const sourceLabel = CALENDAR_SOURCES[calendar.source]?.label || calendar.source;
  const isPersonal = calendar.id === PERSONAL_CALENDAR_ID;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{
        opacity: isDragging ? 0.7 : 1,
        y: 0,
        scale: isDragging ? 1.02 : 1,
        boxShadow: isDragging
          ? '0 8px 20px rgba(0,0,0,0.15)'
          : '0 0px 0px rgba(0,0,0,0)',
      }}
      exit={{ opacity: 0, y: -4 }}
      transition={springs.gentle}
      className={cn(
        'group flex items-center gap-2 py-1.5 px-2 rounded-lg',
        'hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
        'transition-colors duration-150',
        isDragging && 'bg-card border border-border shadow-lg z-50'
      )}
    >
      {/* Drag Handle */}
      <div
        {...dragHandleProps}
        className="opacity-0 group-hover:opacity-40 hover:!opacity-70 cursor-grab active:cursor-grabbing transition-opacity duration-150 flex-shrink-0"
      >
        <GripVertical size={14} className="text-muted-foreground" />
      </div>

      {/* Checkbox Toggle */}
      <button
        onClick={() => onToggle(calendar.id, !calendar.isActive)}
        className={cn(
          'w-4 h-4 rounded-[4px] border-2 flex items-center justify-center flex-shrink-0',
          'transition-all duration-200',
          calendar.isActive
            ? 'border-transparent'
            : 'border-muted-foreground/30 bg-transparent'
        )}
        style={{
          backgroundColor: calendar.isActive ? calendar.color : undefined,
        }}
        aria-label={`Toggle ${calendar.name} visibility`}
      >
        {calendar.isActive && (
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
          calendar.isActive
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
        <DropdownMenuContent align="end" className="w-44">
          {onMoveToGroup && (
            <DropdownMenuItem onClick={() => onMoveToGroup(calendar.id)}>
              <ArrowRightLeft size={14} className="mr-2" />
              Move to Group
            </DropdownMenuItem>
          )}
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
