
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  CalendarCheck,
  Calendar,
  ArrowLeft,
  Check,
  ChevronRight,
  Briefcase,
  User,
  Users,
  Heart,
  Star,
  Folder,
  Globe,
  Zap,
} from 'lucide-react';
import { useCalendarGroups } from '@/hooks/use-calendar-groups';
import { PERSONAL_CALENDAR_ID } from '@/lib/stores/calendar-filter-store';
import { GroupIcon } from '@/types/calendar';
import dayjs from 'dayjs';

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

interface CalendarRowProps {
  id: string;
  name: string;
  color: string;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

const CalendarRow: React.FC<CalendarRowProps> = ({ id, name, color, isSelected, onToggle }) => (
  <button
    onClick={() => onToggle(id)}
    className="w-full flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors"
  >
    <div
      className={cn(
        'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200',
        isSelected ? 'border-transparent' : 'border-muted-foreground/30'
      )}
      style={{ backgroundColor: isSelected ? color : undefined }}
    >
      {isSelected && (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.1 }}>
          <Check size={10} className="text-white" strokeWidth={3} />
        </motion.div>
      )}
    </div>
    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
    <span
      className={cn(
        'text-xs truncate',
        isSelected ? 'text-foreground font-medium' : 'text-muted-foreground'
      )}
    >
      {name}
    </span>
  </button>
);

interface TodoDropDialogProps {
  open: boolean;
  onClose: () => void;
  todoTitle: string;
  date: Date | null;
  startTime: string | null;
  onConfirm: (keepAsTodo: boolean, calendarIds: string[]) => void;
}

const TodoDropDialog: React.FC<TodoDropDialogProps> = ({
  open,
  onClose,
  todoTitle,
  date,
  startTime,
  onConfirm,
}) => {
  const [keepAsTodo, setKeepAsTodo] = useState(true);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([PERSONAL_CALENDAR_ID]);
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  const { groups, getGroupCalendars } = useCalendarGroups();

  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.order - b.order),
    [groups]
  );

  // Reset state and auto-expand groups with calendars whenever dialog opens
  useEffect(() => {
    if (open) {
      setKeepAsTodo(true);
      setSelectedCalendarIds([PERSONAL_CALENDAR_ID]);
      const groupsWithCals = groups
        .filter(g => getGroupCalendars(g.id).length > 0)
        .map(g => g.id);
      setExpandedGroups(groupsWithCals);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayTime = useMemo(() => {
    if (!date || !startTime) return '';
    const d = dayjs(date).format('ddd, MMM D');
    const [h, m] = startTime.split(':').map(Number);
    const t = dayjs().hour(h).minute(m);
    return `${d} at ${t.format('h:mm A')}`;
  }, [date, startTime]);

  const toggleCalendar = (calendarId: string) => {
    setSelectedCalendarIds(prev =>
      prev.includes(calendarId)
        ? prev.filter(id => id !== calendarId)
        : [...prev, calendarId]
    );
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev =>
      prev.includes(groupId) ? prev.filter(id => id !== groupId) : [...prev, groupId]
    );
  };

  const handleConfirm = () => {
    if (selectedCalendarIds.length === 0) return;
    onConfirm(keepAsTodo, selectedCalendarIds);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] bg-background/95 backdrop-blur-xl border-border/60 p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-lg font-bold text-foreground">Schedule Todo</DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-4">
          {/* Todo info */}
          <div className="rounded-xl bg-muted/40 px-3 py-2.5">
            <p className="text-sm font-semibold text-foreground truncate">"{todoTitle}"</p>
            {displayTime && (
              <p className="text-xs text-muted-foreground mt-0.5">{displayTime}</p>
            )}
          </div>

          {/* Type selection */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
              Add as
            </p>

            <button
              onClick={() => setKeepAsTodo(true)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all duration-200 text-left',
                keepAsTodo
                  ? 'border-purple-500/60 bg-purple-500/10'
                  : 'border-border/40 hover:border-border/70 bg-transparent'
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
                  keepAsTodo ? 'bg-purple-500/20' : 'bg-muted/60'
                )}
              >
                <CalendarCheck size={15} className={keepAsTodo ? 'text-purple-500' : 'text-muted-foreground'} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn('text-sm font-semibold', keepAsTodo ? 'text-foreground' : 'text-muted-foreground')}>
                  Event + Todo
                </div>
                <div className="text-[11px] text-muted-foreground">Keep in todo list & add to calendar</div>
              </div>
              {keepAsTodo && (
                <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                  <Check size={11} className="text-white" strokeWidth={3} />
                </div>
              )}
            </button>

            <button
              onClick={() => setKeepAsTodo(false)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all duration-200 text-left',
                !keepAsTodo
                  ? 'border-purple-500/60 bg-purple-500/10'
                  : 'border-border/40 hover:border-border/70 bg-transparent'
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors',
                  !keepAsTodo ? 'bg-purple-500/20' : 'bg-muted/60'
                )}
              >
                <Calendar size={15} className={!keepAsTodo ? 'text-purple-500' : 'text-muted-foreground'} />
              </div>
              <div className="flex-1 min-w-0">
                <div className={cn('text-sm font-semibold', !keepAsTodo ? 'text-foreground' : 'text-muted-foreground')}>
                  Event only
                </div>
                <div className="text-[11px] text-muted-foreground">Move to calendar, remove from todos</div>
              </div>
              {!keepAsTodo && (
                <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                  <Check size={11} className="text-white" strokeWidth={3} />
                </div>
              )}
            </button>
          </div>

          <Separator className="opacity-50" />

          {/* Calendar selector */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
              Add to calendar
            </p>

            <ScrollArea className="max-h-44">
              <div className="space-y-0.5 pr-1">
                {/* Personal calendar — always shown */}
                <CalendarRow
                  id={PERSONAL_CALENDAR_ID}
                  name="Personal"
                  color="#8B5CF6"
                  isSelected={selectedCalendarIds.includes(PERSONAL_CALENDAR_ID)}
                  onToggle={toggleCalendar}
                />

                {/* Connected calendars grouped */}
                {sortedGroups.map(group => {
                  const groupCals = getGroupCalendars(group.id);
                  if (groupCals.length === 0) return null;

                  const isExpanded = expandedGroups.includes(group.id);
                  const IconComponent = GROUP_ICONS[group.icon] || Folder;

                  return (
                    <div key={group.id}>
                      <button
                        onClick={() => toggleGroup(group.id)}
                        className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/40 transition-colors"
                      >
                        <motion.div
                          animate={{ rotate: isExpanded ? 90 : 0 }}
                          transition={{ type: 'spring', damping: 25, stiffness: 400, duration: 0.15 }}
                        >
                          <ChevronRight size={12} className="text-muted-foreground" />
                        </motion.div>
                        <div
                          className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${group.color}20` }}
                        >
                          <IconComponent size={10} style={{ color: group.color }} />
                        </div>
                        <span className="text-xs font-semibold text-foreground">{group.name}</span>
                        <span className="text-[10px] text-muted-foreground ml-auto">{groupCals.length}</span>
                      </button>

                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="overflow-hidden pl-5"
                          >
                            {groupCals.map(cal => (
                              <CalendarRow
                                key={cal.id}
                                id={cal.id}
                                name={cal.name}
                                color={cal.color}
                                isSelected={selectedCalendarIds.includes(cal.id)}
                                onToggle={toggleCalendar}
                              />
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="ghost"
              onClick={onClose}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft size={15} />
              Go back
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={selectedCalendarIds.length === 0}
              className="flex-1 gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
            >
              <CalendarCheck size={15} />
              Add to Calendar
              {selectedCalendarIds.length > 1 && (
                <span className="ml-1 bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {selectedCalendarIds.length}
                </span>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TodoDropDialog;
