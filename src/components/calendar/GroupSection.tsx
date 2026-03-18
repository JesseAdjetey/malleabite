// GroupSection - Collapsible group with calendars inside.
// Shows group header with expand/collapse, drag handle, and calendar list.

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  ChevronRight,
  GripVertical,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Briefcase,
  User,
  Users,
  Heart,
  Star,
  Folder,
  Globe,
  Zap,
} from 'lucide-react';
import { CalendarGroup, ConnectedCalendar, GroupIcon } from '@/types/calendar';
import CalendarItem from './CalendarItem';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { springs } from '@/lib/animations';
import { useCalendarFilterStore } from '@/lib/stores/calendar-filter-store';

// Icon mapping
const GROUP_ICONS: Record<GroupIcon, React.ElementType> = {
  briefcase: Briefcase,
  user: User,
  users: Users,
  heart: Heart,
  star: Star,
  folder: Folder,
  globe: Globe,
  zap: Zap,
};

interface GroupSectionProps {
  group: CalendarGroup;
  calendars: ConnectedCalendar[];
  isExpanded: boolean;
  onToggleExpand: (groupId: string) => void;
  onEditGroup: (group: CalendarGroup) => void;
  onDeleteGroup: (groupId: string) => void;
  onAddCalendar: (groupId: string) => void;
  onToggleCalendar: (calendarId: string, isActive: boolean) => void;
  onDeleteCalendar: (calendarId: string) => void;
  onMoveCalendar?: (calendarId: string) => void;
  dragHandleProps?: Record<string, any>;
  isDragging?: boolean;
  isDropTarget?: boolean;
}

const GroupSection: React.FC<GroupSectionProps> = ({
  group,
  calendars,
  isExpanded,
  onToggleExpand,
  onEditGroup,
  onDeleteGroup,
  onAddCalendar,
  onToggleCalendar,
  onDeleteCalendar,
  onMoveCalendar,
  dragHandleProps,
  isDragging = false,
  isDropTarget = false,
}) => {
  const IconComponent = GROUP_ICONS[group.icon] || Folder;
  const hiddenCalendarIds = useCalendarFilterStore((state) => state.hiddenCalendarIds);
  const activeCount = calendars.filter(c => !hiddenCalendarIds.has(c.id)).length;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{
        opacity: isDragging ? 0.8 : 1,
        y: 0,
        scale: isDragging ? 1.01 : 1,
      }}
      exit={{ opacity: 0, y: -6 }}
      transition={springs.gentle}
      className={cn(
        'rounded-xl',
        isDragging && 'bg-card border border-border shadow-lg',
        isDropTarget && 'ring-2 ring-primary/30 bg-primary/5'
      )}
    >
      {/* Group Header */}
      <div className="group flex items-center gap-1.5 py-1.5 px-1">
        {/* Drag Handle */}
        <div
          {...dragHandleProps}
          className="opacity-0 group-hover:opacity-40 hover:!opacity-70 cursor-grab active:cursor-grabbing transition-opacity duration-150 flex-shrink-0"
        >
          <GripVertical size={14} className="text-muted-foreground" />
        </div>

        {/* Expand/Collapse Button */}
        <button
          onClick={() => onToggleExpand(group.id)}
          className="flex items-center gap-2 flex-1 min-w-0 py-0.5 rounded-md hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors duration-150 px-1"
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${group.name}`}
        >
          {/* Chevron */}
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400, duration: 0.15 }}
            className="flex-shrink-0"
          >
            <ChevronRight size={14} className="text-muted-foreground" />
          </motion.div>

          {/* Group Icon + Name */}
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `${group.color}15` }}
          >
            <IconComponent size={12} style={{ color: group.color }} />
          </div>

          <span className="text-[13px] font-semibold text-foreground truncate">
            {group.name}
          </span>

          {/* Calendar Count Badge */}
          {calendars.length > 0 && (
            <span className="text-[10px] text-muted-foreground/60 flex-shrink-0">
              {activeCount}/{calendars.length}
            </span>
          )}
        </button>

        {/* Group Actions */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {/* Add Calendar to Group */}
          <button
            onClick={() => onAddCalendar(group.id)}
            className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-all duration-150"
            aria-label={`Add calendar to ${group.name}`}
          >
            <Plus size={14} className="text-muted-foreground" />
          </button>

          {/* More Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="opacity-0 group-hover:opacity-60 hover:!opacity-100 p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/10 transition-all duration-150">
                <MoreHorizontal size={14} className="text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => onEditGroup(group)}>
                <Pencil size={14} className="mr-2" />
                Edit Group
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDeleteGroup(group.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 size={14} className="mr-2" />
                Delete Group
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Collapsible Calendar List */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{
              height: { type: 'spring', damping: 30, stiffness: 300 },
              opacity: { duration: 0.15 },
            }}
            className="overflow-hidden"
          >
            <div className="pl-6 pr-1 pb-1">
              {calendars.length === 0 ? (
                <button
                  onClick={() => onAddCalendar(group.id)}
                  className="w-full py-3 px-2 text-[12px] text-muted-foreground/50 hover:text-muted-foreground/80 transition-colors duration-150 text-center rounded-lg hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                >
                  + Add a calendar
                </button>
              ) : (
                <AnimatePresence>
                  {calendars.map((calendar) => (
                    <CalendarItem
                      key={calendar.id}
                      calendar={calendar}
                      onToggle={onToggleCalendar}
                      onDelete={onDeleteCalendar}
                      onMoveToGroup={onMoveCalendar}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default GroupSection;
