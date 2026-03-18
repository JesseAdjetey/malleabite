
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ModuleContainer from './ModuleContainer';
import {
  Bell, Calendar, Clock, Plus, Edit2, Trash2, AlarmClock, Check, RotateCcw, X
} from 'lucide-react';
import { useReminders, Reminder, ReminderFormData, ReminderRecurrence } from '@/hooks/use-reminders';
import { useAlarms, Alarm } from '@/hooks/use-alarms';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { Input } from '@/components/ui/input';
import { Form, FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import dayjs from 'dayjs';
import { Timestamp } from 'firebase/firestore';
import { useEventHighlightStore } from '@/lib/stores/event-highlight-store';
import { cn } from '@/lib/utils';

const resolveDate = (date: any): Date => {
  if (date?.toDate && typeof date.toDate === 'function') return date.toDate();
  return new Date(date);
};

const reminderFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  reminderTime: z.string().refine((val) => val !== '' && !isNaN(Date.parse(val)), {
    message: 'Valid time is required',
  }),
  soundId: z.string().optional(),
  recurrence: z.enum(['none', 'daily', 'weekly', 'weekdays', 'custom']).optional(),
  customDays: z.array(z.number()).optional(),
});

interface RemindersModuleProps {
  title?: string;
  onRemove?: () => void;
  onTitleChange?: (title: string) => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
  isDragging?: boolean;
  instanceId?: string;
}

const TIME_PRESETS = [
  { id: '30min', label: '30 min', getValue: () => dayjs().add(30, 'minute').format('YYYY-MM-DDTHH:mm') },
  { id: '1h',    label: '1 hour', getValue: () => dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm') },
  { id: 'tonight', label: 'Tonight', getValue: () => dayjs().hour(18).minute(0).second(0).format('YYYY-MM-DDTHH:mm') },
  { id: 'tomorrow', label: 'Tomorrow', getValue: () => dayjs().add(1, 'day').hour(9).minute(0).second(0).format('YYYY-MM-DDTHH:mm') },
];

const RECURRENCE_OPTIONS: { value: ReminderRecurrence; label: string }[] = [
  { value: 'none',     label: 'No repeat' },
  { value: 'daily',    label: 'Every day' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly',   label: 'Every week' },
  { value: 'custom',   label: 'Custom' },
];

const DAYS_OF_WEEK = [
  { label: 'S', fullLabel: 'Sun', value: 0 },
  { label: 'M', fullLabel: 'Mon', value: 1 },
  { label: 'T', fullLabel: 'Tue', value: 2 },
  { label: 'W', fullLabel: 'Wed', value: 3 },
  { label: 'T', fullLabel: 'Thu', value: 4 },
  { label: 'F', fullLabel: 'Fri', value: 5 },
  { label: 'S', fullLabel: 'Sat', value: 6 },
];

const RECURRENCE_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  weekdays: 'Weekdays',
  custom: 'Custom',
};

function formatDisplayTime(time: Date): string {
  const now = dayjs();
  const t = dayjs(time);
  const diffMins = t.diff(now, 'minute');

  if (diffMins < 0) {
    if (t.isSame(now.subtract(1, 'day'), 'day')) return `Yesterday ${t.format('h:mm A')}`;
    if (t.isSame(now, 'day')) return `Today ${t.format('h:mm A')}`;
    return t.format('MMM D [at] h:mm A');
  }
  if (diffMins < 60) return `in ${diffMins}m`;
  if (diffMins < 120) return `in 1h ${diffMins % 60}m`;
  if (t.isSame(now, 'day')) return t.format('h:mm A');
  if (t.isSame(now.add(1, 'day'), 'day')) return `Tomorrow ${t.format('h:mm A')}`;
  return t.format('MMM D [at] h:mm A');
}

// --- Searchable event picker ---
interface EventPickerProps {
  value: string;
  onChange: (id: string) => void;
}

const EventPicker: React.FC<EventPickerProps> = ({ value, onChange }) => {
  const { events } = useCalendarEvents();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedEvent = useMemo(() => events.find(e => e.id === value), [events, value]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return events
      .filter(e => !q || e.title.toLowerCase().includes(q))
      .slice(0, 8);
  }, [events, search]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <div
        onClick={() => setOpen(o => !o)}
        className={cn(
          "flex items-center gap-2 w-full h-10 px-3 rounded-md border cursor-pointer text-sm transition-colors",
          "bg-background border-input hover:border-ring/50",
          open && "border-ring/70"
        )}
      >
        {selectedEvent ? (
          <>
            <Calendar size={14} className="text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="font-medium truncate block">{selectedEvent.title}</span>
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">
              {dayjs(selectedEvent.startsAt).format('MMM D')}
            </span>
            <button onClick={handleClear} className="ml-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
              <X size={12} />
            </button>
          </>
        ) : (
          <>
            <Calendar size={14} className="text-gray-400 flex-shrink-0" />
            <span className="text-gray-400">Link to event (optional)</span>
          </>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
          <div className="p-1.5 border-b border-border">
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search events…"
              className="w-full text-sm bg-transparent px-2 py-1 outline-none placeholder:text-gray-400"
            />
          </div>
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-3">No events found</div>
            ) : (
              filtered.map(event => (
                <div
                  key={event.id}
                  onClick={() => handleSelect(event.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent transition-colors",
                    value === event.id && "bg-primary/10"
                  )}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: event.color || '#6366f1' }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{event.title}</div>
                    <div className="text-[11px] text-gray-400">
                      {dayjs(event.startsAt).format('ddd, MMM D · h:mm A')}
                    </div>
                  </div>
                  {value === event.id && <Check size={12} className="text-primary flex-shrink-0" />}
                </div>
              ))
            )}
          </div>
          {value && (
            <div
              onClick={handleClear}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent border-t border-border text-xs text-gray-400"
            >
              <X size={12} /> Remove link
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// --- Group section ---
interface GroupSectionProps {
  label: string;
  color?: 'red' | 'default';
  children: React.ReactNode;
}
const GroupSection: React.FC<GroupSectionProps> = ({ label, color = 'default', children }) => (
  <div className="space-y-1">
    <div className={cn(
      "text-[10px] font-semibold uppercase tracking-wider px-1",
      color === 'red' ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-gray-500"
    )}>
      {label}
    </div>
    {children}
  </div>
);

// --- Main component ---
const RemindersModule: React.FC<RemindersModuleProps> = ({
  title = "Reminders",
  onRemove,
  onTitleChange,
  onMinimize,
  isMinimized = false,
  isDragging = false,
  instanceId
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Tracks which preset button is active (null = custom/manual)
  const [activePreset, setActivePreset] = useState<string | null>('1h');

  const {
    reminders, loading, addReminder, updateReminder, deleteReminder,
    completeReminder, getSounds,
  } = useReminders(instanceId);
  const { alarms, loading: alarmsLoading, toggleAlarm, deleteAlarm } = useAlarms(instanceId);

  const highlightedItemId = useEventHighlightStore(s => s.highlightedItemId);
  const highlightedItemType = useEventHighlightStore(s => s.highlightedItemType);
  const spotlightRef = useCallback((node: HTMLDivElement | null) => {
    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  const activeReminders = useMemo(() =>
    reminders.filter(r => r.isActive && r.status !== 'completed'),
    [reminders]
  );

  const now = dayjs();
  const groupedReminders = useMemo(() => {
    const overdue: Reminder[] = [], today: Reminder[] = [], tomorrow: Reminder[] = [], upcoming: Reminder[] = [];
    activeReminders.forEach(r => {
      const t = dayjs(resolveDate(r.reminderTime));
      if (t.isBefore(now, 'minute')) overdue.push(r);
      else if (t.isSame(now, 'day')) today.push(r);
      else if (t.isSame(now.add(1, 'day'), 'day')) tomorrow.push(r);
      else upcoming.push(r);
    });
    return { overdue, today, tomorrow, upcoming };
  }, [activeReminders, now]);

  const form = useForm<ReminderFormData>({
    resolver: zodResolver(reminderFormSchema),
    defaultValues: {
      title: '',
      description: '',
      reminderTime: dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
      soundId: 'default',
      recurrence: 'none',
      customDays: [],
    }
  });

  const watchedRecurrence = form.watch('recurrence');
  const watchedCustomDays = form.watch('customDays') || [];
  const watchedEventId = form.watch('eventId');

  useEffect(() => {
    if (isDialogOpen) {
      if (isEditing && selectedReminder) {
        setActivePreset(null);
        form.reset({
          title: selectedReminder.title,
          description: selectedReminder.description || '',
          reminderTime: dayjs(resolveDate(selectedReminder.reminderTime)).format('YYYY-MM-DDTHH:mm'),
          eventId: selectedReminder.eventId || undefined,
          timeBeforeMinutes: selectedReminder.timeBeforeMinutes || undefined,
          timeAfterMinutes: selectedReminder.timeAfterMinutes || undefined,
          soundId: selectedReminder.soundId || 'default',
          recurrence: selectedReminder.recurrence || 'none',
          customDays: selectedReminder.customDays || [],
        });
      } else {
        setActivePreset('1h');
        form.reset({
          title: '',
          description: '',
          reminderTime: dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
          soundId: 'default',
          recurrence: 'none',
          customDays: [],
        });
      }
    }
  }, [isDialogOpen, isEditing, selectedReminder]);

  const handleSubmit = async (data: ReminderFormData) => {
    try {
      if (isEditing && selectedReminder) {
        await updateReminder(selectedReminder.id, data);
      } else {
        await addReminder(data);
      }
      setIsDialogOpen(false);
    } catch {
      toast.error('Failed to save reminder');
    }
  };

  const handleQuickAdd = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && quickTitle.trim()) {
      await addReminder({
        title: quickTitle.trim(),
        reminderTime: dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
        soundId: 'default',
        recurrence: 'none',
      });
      setQuickTitle('');
    }
  };

  const openEditDialog = (reminder: Reminder) => {
    setSelectedReminder(reminder);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (deletingId === id) {
      await deleteReminder(id);
      setDeletingId(null);
    } else {
      setDeletingId(id);
      setTimeout(() => setDeletingId(null), 3000);
    }
  };

  const handleAlarmDelete = async (id: string) => {
    const key = `alarm-${id}`;
    if (deletingId === key) {
      await deleteAlarm(id);
      setDeletingId(null);
    } else {
      setDeletingId(key);
      setTimeout(() => setDeletingId(null), 3000);
    }
  };

  const toggleCustomDay = (day: number) => {
    const current = watchedCustomDays;
    const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
    form.setValue('customDays', next);
  };

  const hasItems = activeReminders.length > 0 || alarms.length > 0;

  const renderReminderRow = (item: Reminder) => {
    const t = resolveDate(item.reminderTime);
    const isOverdue = dayjs(t).isBefore(now, 'minute');
    const isHighlighted = highlightedItemId === item.id && highlightedItemType === 'reminder';
    const isDeleting = deletingId === item.id;

    return (
      <div
        key={`reminder-${item.id}`}
        ref={isHighlighted ? spotlightRef : undefined}
        data-reminder-id={item.id}
        className={cn(
          "group flex items-start gap-2 px-2 py-1.5 rounded-lg transition-colors",
          isOverdue ? "bg-red-50 dark:bg-red-950/30" : "hover:bg-gray-100/60 dark:hover:bg-white/5",
          isHighlighted && "event-spotlight"
        )}
      >
        {/* Complete circle */}
        <button
          onClick={() => completeReminder(item.id)}
          className={cn(
            "mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center",
            isOverdue
              ? "border-red-400 hover:bg-red-400 hover:border-red-400"
              : "border-gray-300 dark:border-gray-600 hover:border-primary hover:bg-primary/10"
          )}
          title="Mark as done"
        >
          <Check size={9} className="opacity-0 group-hover:opacity-70 transition-opacity" />
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <span className={cn(
              "text-sm font-medium leading-tight",
              isOverdue ? "text-red-700 dark:text-red-400" : "text-gray-800 dark:text-white"
            )}>
              {item.title}
            </span>
            <div className="flex gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => openEditDialog(item)}
                className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/10"
                title="Edit"
              >
                <Edit2 size={12} />
              </button>
              <button
                onClick={() => handleDelete(item.id)}
                className={cn(
                  "p-1 rounded transition-colors",
                  isDeleting
                    ? "bg-red-500 text-white px-1.5 rounded"
                    : "text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                )}
              >
                {isDeleting ? <span className="text-[10px] font-medium">Delete?</span> : <Trash2 size={12} />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={cn(
              "text-[11px]",
              isOverdue ? "text-red-500 dark:text-red-400 font-medium" : "text-gray-500 dark:text-gray-400"
            )}>
              {formatDisplayTime(t)}
            </span>

            {item.recurrence && item.recurrence !== 'none' && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded-full">
                <RotateCcw size={9} />
                {item.recurrence === 'custom' && item.customDays?.length
                  ? item.customDays.map(d => ['Su','Mo','Tu','We','Th','Fr','Sa'][d]).join(' ')
                  : RECURRENCE_LABELS[item.recurrence]
                }
              </span>
            )}

            {item.event && (
              <span className="flex items-center gap-0.5 text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[90px]">
                <Calendar size={9} />
                {item.event.title}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAlarmRow = (item: Alarm) => {
    const isHighlighted = highlightedItemId === item.id && highlightedItemType === 'alarm';
    const isDeleting = deletingId === `alarm-${item.id}`;

    return (
      <div
        key={`alarm-${item.id}`}
        ref={isHighlighted ? spotlightRef : undefined}
        data-alarm-id={item.id}
        className={cn(
          "group flex items-start gap-2 px-2 py-1.5 rounded-lg transition-colors",
          item.enabled ? "hover:bg-blue-50/60 dark:hover:bg-blue-900/20" : "opacity-50 hover:bg-gray-100/60 dark:hover:bg-white/5",
          isHighlighted && "event-spotlight"
        )}
      >
        <AlarmClock size={14} className={cn("mt-0.5 flex-shrink-0", item.enabled ? "text-blue-500 dark:text-blue-400" : "text-gray-400")} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <span className={cn("text-sm font-medium leading-tight text-gray-800 dark:text-white", !item.enabled && "line-through")}>
              {item.title}
            </span>
            <div className="flex gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => toggleAlarm(item.id!, !item.enabled)}
                className={cn(
                  "text-[10px] px-1.5 py-0.5 rounded font-medium",
                  item.enabled ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" : "bg-gray-100 text-gray-500 dark:bg-white/10"
                )}
              >
                {item.enabled ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={() => handleAlarmDelete(item.id!)}
                className={cn(
                  "p-1 rounded transition-colors",
                  isDeleting ? "bg-red-500 text-white px-1.5" : "text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
                )}
              >
                {isDeleting ? <span className="text-[10px] font-medium">Delete?</span> : <Trash2 size={12} />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <Clock size={10} className="text-gray-400" />
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {formatDisplayTime(typeof item.time === 'string' ? new Date(item.time) : item.time)}
            </span>
            {item.repeatDays && item.repeatDays.length > 0 && (
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                · {item.repeatDays.map(d => ['Su','Mo','Tu','We','Th','Fr','Sa'][d]).join(' ')}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <ModuleContainer
      title={title}
      onRemove={onRemove}
      onTitleChange={onTitleChange}
      onMinimize={onMinimize}
      isMinimized={isMinimized}
      isDragging={isDragging}
    >
      <div className="space-y-2">
        {/* Quick-add */}
        <div className="flex items-center gap-1.5">
          <input
            value={quickTitle}
            onChange={e => setQuickTitle(e.target.value)}
            onKeyDown={handleQuickAdd}
            placeholder="Add reminder… (press Enter)"
            className="flex-1 text-sm bg-gray-100/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-md px-3 py-1.5 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <button
            onClick={() => { setIsEditing(false); setSelectedReminder(null); setIsDialogOpen(true); }}
            className="p-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
            title="Add with options"
          >
            <Plus size={16} />
          </button>
        </div>

        {/* List */}
        <div className="max-h-64 overflow-y-auto space-y-3 pr-0.5">
          {(loading || alarmsLoading) ? (
            <div className="text-center py-4 text-sm opacity-50">Loading…</div>
          ) : !hasItems ? (
            <div className="text-center py-6 opacity-60">
              <Bell className="mx-auto h-7 w-7 mb-2 opacity-40" />
              <p className="text-sm">No reminders</p>
              <p className="text-xs mt-0.5 opacity-70">Type above or tap + to add one</p>
            </div>
          ) : (
            <>
              {groupedReminders.overdue.length > 0 && (
                <GroupSection label="Overdue" color="red">{groupedReminders.overdue.map(renderReminderRow)}</GroupSection>
              )}
              {groupedReminders.today.length > 0 && (
                <GroupSection label="Today">{groupedReminders.today.map(renderReminderRow)}</GroupSection>
              )}
              {groupedReminders.tomorrow.length > 0 && (
                <GroupSection label="Tomorrow">{groupedReminders.tomorrow.map(renderReminderRow)}</GroupSection>
              )}
              {groupedReminders.upcoming.length > 0 && (
                <GroupSection label="Upcoming">{groupedReminders.upcoming.map(renderReminderRow)}</GroupSection>
              )}
              {alarms.length > 0 && (
                <GroupSection label="Alarms">{alarms.map(renderAlarmRow)}</GroupSection>
              )}
            </>
          )}
        </div>
      </div>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[420px] bg-background/95 border-white/10">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Reminder' : 'New Reminder'}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              {/* Title */}
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="What do you need to remember?" {...field} className="glass-input" />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Note */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note <span className="text-gray-400 font-normal">(optional)</span></FormLabel>
                    <FormControl>
                      <Input placeholder="Add details…" {...field} className="glass-input" />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* When — presets + datetime */}
              <FormField
                control={form.control}
                name="reminderTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>When</FormLabel>
                    <div className="space-y-2">
                      {/* Preset chips */}
                      <div className="flex gap-1.5 flex-wrap">
                        {TIME_PRESETS.map(preset => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => {
                              setActivePreset(preset.id);
                              form.setValue('reminderTime', preset.getValue());
                            }}
                            className={cn(
                              "text-xs px-2.5 py-1 rounded-full border transition-colors",
                              activePreset === preset.id
                                ? "bg-primary text-white border-primary"
                                : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-primary/50"
                            )}
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                      {/* Datetime input — always visible, typing clears preset */}
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          onChange={e => {
                            setActivePreset(null);
                            field.onChange(e);
                          }}
                          className="glass-input text-sm"
                        />
                      </FormControl>
                    </div>
                  </FormItem>
                )}
              />

              {/* Repeat */}
              <FormField
                control={form.control}
                name="recurrence"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Repeat</FormLabel>
                    <div className="space-y-2">
                      <div className="flex gap-1.5 flex-wrap">
                        {RECURRENCE_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => form.setValue('recurrence', opt.value)}
                            className={cn(
                              "text-xs px-2.5 py-1 rounded-full border transition-colors",
                              field.value === opt.value
                                ? "bg-primary text-white border-primary"
                                : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-primary/50"
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      {/* Custom day picker */}
                      {watchedRecurrence === 'custom' && (
                        <div className="flex gap-1 mt-1">
                          {DAYS_OF_WEEK.map(day => (
                            <button
                              key={day.value}
                              type="button"
                              title={day.fullLabel}
                              onClick={() => toggleCustomDay(day.value)}
                              className={cn(
                                "w-8 h-8 rounded-full text-xs font-medium border transition-colors",
                                watchedCustomDays.includes(day.value)
                                  ? "bg-primary text-white border-primary"
                                  : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-primary/50"
                              )}
                            >
                              {day.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </FormItem>
                )}
              />

              {/* Sound */}
              <FormField
                control={form.control}
                name="soundId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sound</FormLabel>
                    <FormControl>
                      <select {...field} className="glass-input w-full h-10 px-3">
                        {getSounds().map(sound => (
                          <option key={sound.id} value={sound.id}>{sound.name}</option>
                        ))}
                      </select>
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Event link — searchable picker */}
              <FormField
                control={form.control}
                name="eventId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link to event <span className="text-gray-400 font-normal">(optional)</span></FormLabel>
                    <FormControl>
                      <EventPicker value={field.value || ''} onChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              {/* Minutes before/after — only when event linked */}
              {watchedEventId && (
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="timeBeforeMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min before</FormLabel>
                        <FormControl>
                          <Input
                            type="number" min="0" placeholder="0"
                            {...field}
                            value={field.value || ''}
                            onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            className="glass-input"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="timeAfterMinutes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Min after</FormLabel>
                        <FormControl>
                          <Input
                            type="number" min="0" placeholder="0"
                            {...field}
                            value={field.value || ''}
                            onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                            className="glass-input"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit">{isEditing ? 'Update' : 'Create'}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </ModuleContainer>
  );
};

export default RemindersModule;
