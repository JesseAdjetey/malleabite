
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import ModuleContainer from './ModuleContainer';
import {
  Bell, Calendar, Clock, Plus, Edit2, Trash2, AlarmClock, Check, RotateCcw,
  X, Sparkles, Info, Volume2, VolumeX, ChevronDown, ChevronUp, CalendarSearch,
} from 'lucide-react';
import { useReminders, Reminder, ReminderFormData, ReminderRecurrence } from '@/hooks/use-reminders';
import { useAlarms, Alarm } from '@/hooks/use-alarms';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { useEventStore } from '@/lib/stores/event-store';
import { useCalendarFilterStore, PERSONAL_CALENDAR_ID } from '@/lib/stores/calendar-filter-store';
import { Input } from '@/components/ui/input';
import { Form, FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import dayjs from 'dayjs';
import { Timestamp } from 'firebase/firestore';
import { useEventHighlightStore } from '@/lib/stores/event-highlight-store';
import { useReminderEventPickerStore } from '@/lib/stores/reminder-event-picker-store';
import { cn } from '@/lib/utils';
import { useModuleSize } from '@/contexts/ModuleSizeContext';

const resolveDate = (date: any): Date => {
  if (date?.toDate && typeof date.toDate === 'function') return date.toDate();
  return new Date(date);
};

const reminderFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  reminderTime: z.string().optional(),
  soundId: z.string().optional(),
  recurrence: z.string().optional(),
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
  moduleId?: string; // stable module.id from sidebar-store (for event-form → reminder linking)
  moveTargets?: { id: string; title: string }[];
  onMoveToPage?: (pageId: string) => void;
  onShare?: () => void;
  isReadOnly?: boolean;
  contentReadOnly?: boolean;
}

// ── Constants ────────────────────────────────────────────────────────────────

const TIME_PRESETS = [
  { id: '30min',    label: '30 min',    getValue: () => dayjs().add(30, 'minute').format('YYYY-MM-DDTHH:mm') },
  { id: '1h',       label: '1 hour',    getValue: () => dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm') },
  { id: '2h',       label: 'In 2h',     getValue: () => dayjs().add(2, 'hour').format('YYYY-MM-DDTHH:mm') },
  { id: 'tonight',  label: 'Tonight',   getValue: () => dayjs().hour(18).minute(0).second(0).format('YYYY-MM-DDTHH:mm') },
  { id: 'tomorrow', label: 'Tomorrow',  getValue: () => dayjs().add(1, 'day').hour(9).minute(0).second(0).format('YYYY-MM-DDTHH:mm') },
  { id: 'nextweek', label: 'Next week', getValue: () => dayjs().add(1, 'week').startOf('day').hour(9).format('YYYY-MM-DDTHH:mm') },
];

const OFFSET_CHIPS = [
  { label: '5 min',  value: 5 },
  { label: '10 min', value: 10 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 hour', value: 60 },
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
  daily: 'Daily', weekly: 'Weekly', weekdays: 'Weekdays',
  monthly: 'Monthly', yearly: 'Yearly', custom: 'Custom',
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

// ── EventPicker (calendar-aware) ──────────────────────────────────────────────

interface EventPickerProps {
  value: string;
  onChange: (id: string) => void;
  activeCalendarIds: string[]; // 'personal' or ConnectedCalendar.id values
}

const EventPicker: React.FC<EventPickerProps> = ({ value, onChange, activeCalendarIds }) => {
  const { events } = useEventStore();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const visibleEvents = useMemo(() => {
    if (activeCalendarIds.length === 0) return events;
    return events.filter(e => activeCalendarIds.includes(e.calendarId || PERSONAL_CALENDAR_ID));
  }, [events, activeCalendarIds]);

  const selectedEvent = useMemo(() => events.find(e => e.id === value), [events, value]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return visibleEvents
      .filter(e => !q || e.title.toLowerCase().includes(q))
      .slice(0, 10);
  }, [visibleEvents, search]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false); setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (id: string) => { onChange(id); setOpen(false); setSearch(''); };
  const handleClear = (e: React.MouseEvent) => { e.stopPropagation(); onChange(''); setSearch(''); setOpen(false); };

  return (
    <div ref={containerRef} className="relative">
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
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: selectedEvent.color || '#6366f1' }} />
            <div className="flex-1 min-w-0">
              <span className="font-medium truncate block">{selectedEvent.title}</span>
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">{dayjs(selectedEvent.startsAt).format('MMM D · h:mm A')}</span>
            <button onClick={handleClear} className="ml-1 text-gray-400 hover:text-gray-600 flex-shrink-0"><X size={12} /></button>
          </>
        ) : (
          <>
            <CalendarSearch size={14} className="text-gray-400 flex-shrink-0" />
            <span className="text-gray-400">Search events…</span>
          </>
        )}
      </div>
      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
          <div className="p-1.5 border-b border-border">
            <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by event name…"
              className="w-full text-sm bg-transparent px-2 py-1 outline-none placeholder:text-gray-400" />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-3">No events found</div>
            ) : filtered.map(event => (
              <div key={event.id} onClick={() => handleSelect(event.id)}
                className={cn("flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent transition-colors", value === event.id && "bg-primary/10")}>
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: event.color || '#6366f1' }} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{event.title}</div>
                  <div className="text-[11px] text-gray-400">
                    {dayjs(event.startsAt).format('ddd, MMM D · h:mm A')}
                    {(event as any).isRecurring && <span className="ml-1 text-primary/60">· recurring</span>}
                  </div>
                </div>
                {value === event.id && <Check size={12} className="text-primary flex-shrink-0" />}
              </div>
            ))}
          </div>
          {value && (
            <div onClick={handleClear} className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent border-t border-border text-xs text-gray-400">
              <X size={12} /> Remove link
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── GroupSection ──────────────────────────────────────────────────────────────

const GroupSection: React.FC<{ label: string; color?: 'red' | 'default'; children: React.ReactNode }> = ({ label, color = 'default', children }) => (
  <div className="space-y-1">
    <div className={cn("text-[10px] font-semibold uppercase tracking-wider px-1",
      color === 'red' ? "text-red-500 dark:text-red-400" : "text-gray-400 dark:text-gray-500")}>
      {label}
    </div>
    {children}
  </div>
);

// ── Chip button ───────────────────────────────────────────────────────────────

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; className?: string }> = ({ active, onClick, children, className }) => (
  <button type="button" onClick={onClick}
    className={cn("text-xs px-2.5 py-1 rounded-full border transition-colors", className,
      active ? "bg-primary text-white border-primary" : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-primary/50")}>
    {children}
  </button>
);

// ── Main component ────────────────────────────────────────────────────────────

const RemindersModule: React.FC<RemindersModuleProps> = ({
  title = "Reminders", onRemove, onTitleChange, onMinimize,
  isMinimized = false, isDragging = false, instanceId, moduleId,
  moveTargets, onMoveToPage, onShare, isReadOnly, contentReadOnly,
}) => {
  const { sizeLevel, onSizeChange } = useModuleSize();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const [quickTitle, setQuickTitle] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // When true, the isDialogOpen effect skips its reset (used when opening via browse/event-form)
  const skipDialogResetRef = useRef(false);

  // "When" mode — default to event-linked
  const [whenMode, setWhenMode] = useState<'specific' | 'event'>('event');

  // Specific-time controls
  const [activePreset, setActivePreset] = useState<string | null>('1h');
  const [splitDate, setSplitDate] = useState('');
  const [splitTime, setSplitTime] = useState('');

  // Event-link controls
  const [linkedEventId, setLinkedEventId] = useState('');
  const [offsetBefore, setOffsetBefore] = useState<number>(15);
  const [offsetAfter, setOffsetAfter] = useState<number | null>(null);
  const [recurringScope, setRecurringScope] = useState<'this' | 'all'>('this');
  // Calendar filter: 'personal' or ConnectedCalendar.id — empty = All
  const [calFilterIds, setCalFilterIds] = useState<string[]>([]);

  // Custom repeat
  const [customRepeatOpen, setCustomRepeatOpen] = useState(false);
  const [customFreqType, setCustomFreqType] = useState<'days' | 'weeks' | 'months'>('weeks');
  const [customFreqValue, setCustomFreqValue] = useState(1);

  // Sound toggle
  const [soundEnabled, setSoundEnabled] = useState(true);

  const {
    reminders, loading, addReminder, updateReminder, deleteReminder, completeReminder, getSounds,
  } = useReminders(instanceId);
  const { alarms, loading: alarmsLoading, toggleAlarm, deleteAlarm } = useAlarms(instanceId);
  const { events } = useEventStore();
  const { accounts } = useCalendarFilterStore();

  const {
    isPickingEvent, pickedEvent, pendingFormData, startPicking, clearPickedEvent,
    initiatorInstanceId,
    pendingEventForReminder, setPendingEventForReminder,
  } = useReminderEventPickerStore();

  const highlightedItemId = useEventHighlightStore(s => s.highlightedItemId);
  const highlightedItemType = useEventHighlightStore(s => s.highlightedItemType);
  const spotlightRef = useCallback((node: HTMLDivElement | null) => {
    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  // ── Open when calendar-browse returns a picked event ──────────────────────
  useEffect(() => {
    if (!pickedEvent || isPickingEvent) return;
    // Only react if this instance initiated the picking
    if (initiatorInstanceId && initiatorInstanceId !== instanceId) return;
    setIsEditing(false);
    setSelectedReminder(null);
    setWhenMode('event');
    setLinkedEventId(pickedEvent.id);
    setOffsetBefore(15);
    setOffsetAfter(null);
    // Always use the picked event's title; carry over other form fields from snapshot
    form.reset({
      title: pickedEvent.title,
      description: (pendingFormData as any)?.description || '',
      soundId: (pendingFormData as any)?.soundId || 'default',
      recurrence: (pendingFormData as any)?.recurrence || 'none',
      customDays: (pendingFormData as any)?.customDays || [],
    } as any);
    setSoundEnabled((pendingFormData as any)?.soundEnabled !== false);
    clearPickedEvent();
    skipDialogResetRef.current = true;
    setIsDialogOpen(true);
  }, [pickedEvent, isPickingEvent, initiatorInstanceId, instanceId]);

  // ── Open when triggered from the event form ───────────────────────────────
  useEffect(() => {
    if (!pendingEventForReminder) return;
    const { event, targetModuleId } = pendingEventForReminder;
    // Accept if no target specified, or if target matches our moduleId
    if (targetModuleId && targetModuleId !== moduleId) return;
    setIsEditing(false);
    setSelectedReminder(null);
    setWhenMode('event');
    setLinkedEventId(event.id);
    setOffsetBefore(15);
    setOffsetAfter(null);
    form.reset({
      title: event.title,
      description: '',
      soundId: 'default',
      recurrence: 'none',
      customDays: [],
    } as any);
    setSoundEnabled(true);
    setPendingEventForReminder(null);
    skipDialogResetRef.current = true;
    setIsDialogOpen(true);
  }, [pendingEventForReminder, moduleId]);

  const activeReminders = useMemo(() => reminders.filter(r => r.isActive && r.status !== 'completed'), [reminders]);

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

  const linkedEvent = useMemo(() => {
    if (!linkedEventId) return null;
    // Exact match (normal events)
    const exact = events.find(e => e.id === linkedEventId);
    if (exact) return exact;
    // Recurring instance ID: "baseId_YYYY-MM-DD" — look up base event and reconstruct instance
    const lastUnderscore = linkedEventId.lastIndexOf('_');
    if (lastUnderscore === -1) return null;
    const baseId = linkedEventId.substring(0, lastUnderscore);
    const datePart = linkedEventId.substring(lastUnderscore + 1);
    const base = events.find(e => e.id === baseId);
    if (!base) return null;
    const baseStart = dayjs(base.startsAt);
    const duration = dayjs(base.endsAt).diff(baseStart, 'minute');
    const instanceStart = dayjs(datePart).hour(baseStart.hour()).minute(baseStart.minute()).second(0);
    return {
      ...base,
      id: linkedEventId,
      startsAt: instanceStart.toISOString(),
      endsAt: instanceStart.add(duration, 'minute').toISOString(),
    };
  }, [events, linkedEventId]);

  const computedEventTime = useMemo(() => {
    if (!linkedEvent) return null;
    const base = dayjs(linkedEvent.startsAt);
    if (offsetBefore > 0) return base.subtract(offsetBefore, 'minute');
    if (offsetAfter) return base.add(offsetAfter, 'minute');
    return base;
  }, [linkedEvent, offsetBefore, offsetAfter]);

  const form = useForm({
    resolver: zodResolver(reminderFormSchema),
    defaultValues: {
      title: '', description: '', reminderTime: dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
      soundId: 'default', recurrence: 'none', customDays: [] as number[],
    }
  });

  const watchedRecurrence = form.watch('recurrence');
  const watchedCustomDays = (form.watch('customDays') as number[]) || [];

  const setReminderTime = useCallback((iso: string) => {
    form.setValue('reminderTime', iso);
    const [date, time] = iso.split('T');
    setSplitDate(date || ''); setSplitTime(time?.substring(0, 5) || '');
  }, [form]);

  useEffect(() => {
    if (!isDialogOpen) return;
    // Skip reset if this dialog open was triggered by browse-calendar or event-form flows
    if (skipDialogResetRef.current) {
      skipDialogResetRef.current = false;
      return;
    }
    if (isEditing && selectedReminder) {
      setActivePreset(null);
      const rt = dayjs(resolveDate(selectedReminder.reminderTime)).format('YYYY-MM-DDTHH:mm');
      form.reset({
        title: selectedReminder.title, description: selectedReminder.description || '',
        reminderTime: rt, soundId: selectedReminder.soundId || 'default',
        recurrence: selectedReminder.recurrence || 'none', customDays: selectedReminder.customDays || [],
      } as any);
      setSoundEnabled(!!selectedReminder.soundId);
      const [d, t] = rt.split('T'); setSplitDate(d || ''); setSplitTime(t?.substring(0, 5) || '');
      if (selectedReminder.eventId) {
        setWhenMode('event');
        setLinkedEventId(selectedReminder.eventId);
        setOffsetBefore(selectedReminder.timeBeforeMinutes || 15);
        setOffsetAfter(selectedReminder.timeAfterMinutes || null);
      } else {
        setWhenMode('specific');
        setLinkedEventId('');
      }
    } else if (!pickedEvent && !pendingEventForReminder) {
      setActivePreset('1h');
      const defaultIso = dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm');
      form.reset({ title: '', description: '', reminderTime: defaultIso, soundId: 'default', recurrence: 'none', customDays: [] } as any);
      setSoundEnabled(true);
      const [d, t] = defaultIso.split('T'); setSplitDate(d || ''); setSplitTime(t?.substring(0, 5) || '');
      setWhenMode('event');
      setLinkedEventId('');
      setOffsetBefore(15); setOffsetAfter(null);
    }
    setRecurringScope('this');
    setCustomRepeatOpen(false);
  }, [isDialogOpen, isEditing, selectedReminder]);

  const handleSubmit = async (data: any) => {
    try {
      let reminderTime = data.reminderTime;
      let eventId: string | undefined;
      let timeBeforeMinutes: number | undefined;
      let timeAfterMinutes: number | undefined;

      if (whenMode === 'event' && linkedEvent) {
        const base = dayjs(linkedEvent.startsAt);
        if (offsetBefore > 0) {
          reminderTime = base.subtract(offsetBefore, 'minute').format('YYYY-MM-DDTHH:mm');
          timeBeforeMinutes = offsetBefore;
        } else if (offsetAfter) {
          reminderTime = base.add(offsetAfter, 'minute').format('YYYY-MM-DDTHH:mm');
          timeAfterMinutes = offsetAfter;
        } else {
          reminderTime = base.format('YYYY-MM-DDTHH:mm');
        }
        eventId = linkedEvent.id;
      }

      if (!reminderTime) {
        toast.error('Please set a reminder time');
        return;
      }

      const payload: ReminderFormData = {
        title: data.title,
        description: data.description,
        reminderTime,
        soundId: soundEnabled ? (data.soundId || 'default') : undefined,
        recurrence: data.recurrence as ReminderRecurrence,
        customDays: data.customDays,
        eventId,
        timeBeforeMinutes,
        timeAfterMinutes,
      };

      if (isEditing && selectedReminder) {
        await updateReminder(selectedReminder.id, payload);
      } else {
        await addReminder(payload);
      }
      setIsDialogOpen(false);
    } catch {
      toast.error('Failed to save reminder');
    }
  };

  const handleQuickAdd = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && quickTitle.trim()) {
      await addReminder({ title: quickTitle.trim(), reminderTime: dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm'), soundId: 'default', recurrence: 'none' });
      setQuickTitle('');
    }
  };

  const openEditDialog = (reminder: Reminder) => {
    setSelectedReminder(reminder); setIsEditing(true); setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (deletingId === id) { await deleteReminder(id); setDeletingId(null); }
    else { setDeletingId(id); setTimeout(() => setDeletingId(null), 3000); }
  };

  const handleAlarmDelete = async (id: string) => {
    const key = `alarm-${id}`;
    if (deletingId === key) { await deleteAlarm(id); setDeletingId(null); }
    else { setDeletingId(key); setTimeout(() => setDeletingId(null), 3000); }
  };

  const toggleCustomDay = (day: number) => {
    const next = watchedCustomDays.includes(day) ? watchedCustomDays.filter(d => d !== day) : [...watchedCustomDays, day];
    form.setValue('customDays', next);
  };

  const toggleCalFilter = (id: string) => {
    setCalFilterIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleAskMally = useCallback(() => {
    setIsDialogOpen(false);
    window.dispatchEvent(new CustomEvent('open-mally-chat', {
      detail: { prompt: 'I want to set a reminder linked to a calendar event. Help me pick an event and set the timing.' }
    }));
  }, []);

  const handleBrowseCalendar = useCallback(() => {
    const snapshot = {
      title: form.getValues('title'),
      description: form.getValues('description'),
      soundId: form.getValues('soundId'),
      recurrence: form.getValues('recurrence'),
      customDays: form.getValues('customDays'),
      soundEnabled,
      whenMode: 'event',
    };
    startPicking(snapshot as any, instanceId);
    setIsDialogOpen(false);
    // If fullscreen, drop to sidebar so the calendar is visible
    if (sizeLevel === 3 && onSizeChange) onSizeChange(2);
    toast('Tap any event in the calendar to link it', { duration: 4000 });
  }, [form, soundEnabled, startPicking, instanceId, sizeLevel, onSizeChange]);

  const hasItems = activeReminders.length > 0 || alarms.length > 0;

  // ── Render reminder rows ─────────────────────────────────────────────────

  const renderReminderRow = (item: Reminder) => {
    const t = resolveDate(item.reminderTime);
    const isOverdue = dayjs(t).isBefore(now, 'minute');
    const isHighlighted = highlightedItemId === item.id && highlightedItemType === 'reminder';
    const isDeleting = deletingId === item.id;
    return (
      <div key={`reminder-${item.id}`} ref={isHighlighted ? spotlightRef : undefined} data-reminder-id={item.id}
        className={cn(
          "group flex items-start gap-2 px-2 py-1.5 transition-colors",
          sizeLevel < 2 ? "rounded-lg" : "rounded-sm",
          isOverdue
            ? "bg-red-50 dark:bg-red-950/30"
            : sizeLevel >= 2
              ? "hover:bg-foreground/[0.04] dark:hover:bg-foreground/[0.06]"
              : "hover:bg-gray-100/60 dark:hover:bg-white/5",
          isHighlighted && "event-spotlight"
        )}>
        <button onClick={() => completeReminder(item.id)}
          className={cn("mt-0.5 flex-shrink-0 w-4 h-4 rounded-full border-2 transition-all flex items-center justify-center",
            isOverdue ? "border-red-400 hover:bg-red-400" : "border-gray-300 dark:border-gray-600 hover:border-primary hover:bg-primary/10")}
          title="Mark as done">
          <Check size={9} className="opacity-0 group-hover:opacity-70 transition-opacity" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <span className={cn("text-sm font-medium leading-tight",
              isOverdue ? "text-red-700 dark:text-red-400" : "text-gray-800 dark:text-white")}>
              {item.title}
            </span>
            <div className="flex gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => openEditDialog(item)} className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/10"><Edit2 size={12} /></button>
              <button onClick={() => handleDelete(item.id)}
                className={cn("p-1 rounded transition-colors",
                  isDeleting ? "bg-red-500 text-white px-1.5" : "text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10")}>
                {isDeleting ? <span className="text-[10px] font-medium">Delete?</span> : <Trash2 size={12} />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={cn("text-[11px]", isOverdue ? "text-red-500 dark:text-red-400 font-medium" : "text-gray-500 dark:text-gray-400")}>
              {formatDisplayTime(t)}
            </span>
            {item.recurrence && item.recurrence !== 'none' && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded-full">
                <RotateCcw size={9} />
                {item.recurrence === 'custom' && item.customDays?.length
                  ? item.customDays.map(d => ['Su','Mo','Tu','We','Th','Fr','Sa'][d]).join(' ')
                  : RECURRENCE_LABELS[item.recurrence] || item.recurrence}
              </span>
            )}
            {item.event && (
              <span className="flex items-center gap-0.5 text-[10px] text-gray-400 truncate max-w-[90px]">
                <Calendar size={9} />{item.event.title}
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
      <div key={`alarm-${item.id}`} ref={isHighlighted ? spotlightRef : undefined} data-alarm-id={item.id}
        className={cn(
          "group flex items-start gap-2 px-2 py-1.5 transition-colors",
          sizeLevel < 2 ? "rounded-lg" : "rounded-sm",
          item.enabled
            ? sizeLevel >= 2 ? "hover:bg-foreground/[0.04] dark:hover:bg-foreground/[0.06]" : "hover:bg-blue-50/60 dark:hover:bg-blue-900/20"
            : sizeLevel >= 2 ? "opacity-50 hover:bg-foreground/[0.04]" : "opacity-50 hover:bg-gray-100/60 dark:hover:bg-white/5",
          isHighlighted && "event-spotlight"
        )}>
        <AlarmClock size={14} className={cn("mt-0.5 flex-shrink-0", item.enabled ? "text-blue-500 dark:text-blue-400" : "text-gray-400")} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <span className={cn("text-sm font-medium leading-tight text-gray-800 dark:text-white", !item.enabled && "line-through")}>{item.title}</span>
            <div className="flex gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => toggleAlarm(item.id!, !item.enabled)}
                className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium",
                  item.enabled ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" : "bg-gray-100 text-gray-500 dark:bg-white/10")}>
                {item.enabled ? 'ON' : 'OFF'}
              </button>
              <button onClick={() => handleAlarmDelete(item.id!)}
                className={cn("p-1 rounded transition-colors",
                  isDeleting ? "bg-red-500 text-white px-1.5" : "text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10")}>
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
              <span className="text-[10px] text-gray-400">· {item.repeatDays.map(d => ['Su','Mo','Tu','We','Th','Fr','Sa'][d]).join(' ')}</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── "Before/After event" section ─────────────────────────────────────────

  const renderEventSection = () => (
    <div className="space-y-3">
      {/* 1 — Browse calendar (most prominent) */}
      <button type="button" onClick={handleBrowseCalendar}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-colors text-left group">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
          <Calendar size={18} className="text-primary" />
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-800 dark:text-white">Browse calendar</div>
          <div className="text-[11px] text-gray-400">Go to your calendar and tap any event</div>
        </div>
      </button>

      {/* 2 — Ask Mally */}
      <button type="button" onClick={handleAskMally}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-purple-200 dark:border-purple-500/30 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors text-left group">
        <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-500/20 flex items-center justify-center flex-shrink-0">
          <Sparkles size={16} className="text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <div className="text-sm font-semibold text-purple-700 dark:text-purple-300">Ask Mally</div>
          <div className="text-[11px] text-purple-500/80">Let AI help you find and link an event</div>
        </div>
      </button>

      {/* 3 — Search events */}
      <div className="space-y-2">
        <div className="text-[11px] text-gray-400 font-medium uppercase tracking-wider">Or search events</div>
        <EventPicker
          value={linkedEventId}
          onChange={(id) => { setLinkedEventId(id); if (!id) { setOffsetBefore(15); setOffsetAfter(null); } }}
          activeCalendarIds={calFilterIds}
        />

        {/* 4 — Calendar filter chips (below search) */}
        {accounts.length > 1 && (
          <div className="flex gap-1.5 flex-wrap pt-0.5">
            <button type="button" onClick={() => setCalFilterIds([])}
              className={cn("text-xs px-2.5 py-1 rounded-full border transition-colors",
                calFilterIds.length === 0
                  ? "bg-primary text-white border-primary"
                  : "border-gray-200 dark:border-white/10 text-gray-500 hover:border-primary/50")}>
              All
            </button>
            {accounts.map(acc => (
              <button key={acc.id} type="button" onClick={() => toggleCalFilter(acc.id)}
                className={cn("flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors",
                  calFilterIds.includes(acc.id) ? "text-white border-transparent" : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-primary/50")}
                style={calFilterIds.includes(acc.id) ? { backgroundColor: acc.color, borderColor: acc.color } : {}}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: acc.color }} />
                {acc.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Event offset config — only when event linked */}
      {linkedEventId && linkedEvent && (
        <div className="space-y-3 p-3 rounded-lg bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30">
          {computedEventTime && (
            <div className="flex items-center gap-1.5 text-[11px] text-blue-600 dark:text-blue-400">
              <Clock size={11} />
              Alert fires: <strong>{computedEventTime.format('ddd MMM D · h:mm A')}</strong>
            </div>
          )}

          {/* Before chips */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-500 font-medium">Before event</span>
              <span className="text-[10px] text-gray-400">{offsetBefore} min</span>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {OFFSET_CHIPS.map(c => (
                <Chip key={c.value} active={offsetBefore === c.value && offsetAfter === null}
                  onClick={() => { setOffsetBefore(c.value); setOffsetAfter(null); }}>
                  {c.label}
                </Chip>
              ))}
            </div>
            <Input type="number" min="0" placeholder="Custom minutes"
              value={offsetBefore || ''}
              onChange={e => { setOffsetBefore(Number(e.target.value)); setOffsetAfter(null); }}
              className="glass-input h-8 text-sm" />
          </div>

          {/* After toggle */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-500 font-medium">Also alert after event</span>
              <button type="button" onClick={() => setOffsetAfter(a => a === null ? 30 : null)}
                className={cn("text-[10px] px-2 py-0.5 rounded-full border transition-colors",
                  offsetAfter !== null
                    ? "bg-blue-500 text-white border-blue-500"
                    : "border-gray-200 dark:border-white/10 text-gray-500 hover:border-blue-300")}>
                {offsetAfter !== null ? `ON · ${offsetAfter}m` : 'OFF'}
              </button>
            </div>
            {offsetAfter !== null && (
              <div className="space-y-1.5">
                <div className="flex items-start gap-1.5 text-[11px] text-gray-400">
                  <Info size={10} className="mt-0.5 flex-shrink-0" />
                  Two separate alerts — one before, one after the event.
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {OFFSET_CHIPS.map(c => (
                    <Chip key={c.value} active={offsetAfter === c.value} onClick={() => setOffsetAfter(c.value)}>{c.label}</Chip>
                  ))}
                </div>
                <Input type="number" min="0" placeholder="Custom minutes"
                  value={offsetAfter || ''} onChange={e => setOffsetAfter(Number(e.target.value))}
                  className="glass-input h-8 text-sm" />
              </div>
            )}
          </div>

          {/* Recurring scope */}
          {(linkedEvent as any).isRecurring && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-700/30">
              <RotateCcw size={11} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Recurring event</p>
                <div className="flex gap-1.5">
                  {(['this', 'all'] as const).map(s => (
                    <button key={s} type="button" onClick={() => setRecurringScope(s)}
                      className={cn("text-xs px-2.5 py-1 rounded-full border transition-colors",
                        recurringScope === s
                          ? "bg-amber-500 text-white border-amber-500"
                          : "border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-400 hover:border-amber-400")}>
                      {s === 'this' ? `Just ${dayjs((linkedEvent as any).startsAt).format('MMM D')}` : 'All instances'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderWhenSection = () => (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
        {(['event', 'specific'] as const).map(mode => (
          <button key={mode} type="button" onClick={() => setWhenMode(mode)}
            className={cn("flex-1 py-1.5 text-xs font-medium transition-colors",
              whenMode === mode ? "bg-primary text-white" : "text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5")}>
            {mode === 'event' ? 'Before/After event' : 'Specific time'}
          </button>
        ))}
      </div>

      {whenMode === 'event' ? renderEventSection() : (
        <FormField control={form.control} name="reminderTime" render={({ field }) => (
          <div className="space-y-2.5">
            <div className="flex gap-1.5 flex-wrap">
              {TIME_PRESETS.map(p => (
                <Chip key={p.id} active={activePreset === p.id}
                  onClick={() => { setActivePreset(p.id); setReminderTime(p.getValue()); }}>
                  {p.label}
                </Chip>
              ))}
            </div>
            <div className="space-y-1">
              <span className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">Custom</span>
              <div className="grid grid-cols-2 gap-2">
                <FormControl>
                  <Input type="date" value={splitDate}
                    onChange={e => { setActivePreset(null); setSplitDate(e.target.value); field.onChange(`${e.target.value}T${splitTime || '09:00'}`); }}
                    className="glass-input text-sm" />
                </FormControl>
                <Input type="time" value={splitTime}
                  onChange={e => { setActivePreset(null); setSplitTime(e.target.value); if (splitDate) field.onChange(`${splitDate}T${e.target.value}`); }}
                  className="glass-input text-sm" />
              </div>
            </div>
          </div>
        )} />
      )}
    </div>
  );

  const renderRepeatSection = () => {
    const allOptions = [
      { value: 'none', label: 'No repeat' },
      { value: 'daily', label: 'Daily' },
      { value: 'weekdays', label: 'Weekdays' },
      { value: 'weekly', label: 'Weekly' },
      { value: 'monthly', label: 'Monthly' },
      { value: 'yearly', label: 'Yearly' },
      { value: 'custom', label: 'Custom' },
    ];
    return (
      <FormField control={form.control} name="recurrence" render={({ field }) => (
        <FormItem>
          <FormLabel>Repeat</FormLabel>
          <div className="space-y-2">
            <div className="flex gap-1.5 flex-wrap">
              {allOptions.map(opt => (
                <Chip key={opt.value} active={field.value === opt.value}
                  onClick={() => { form.setValue('recurrence', opt.value as any); if (opt.value === 'custom') setCustomRepeatOpen(true); }}>
                  {opt.label}
                </Chip>
              ))}
            </div>
            {field.value === 'custom' && (
              <div className="space-y-3 p-3 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/3">
                <button type="button" onClick={() => setCustomRepeatOpen(o => !o)}
                  className="flex items-center gap-1 text-xs text-primary font-medium">
                  {customRepeatOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  {customRepeatOpen ? 'Hide options' : 'Configure'}
                </button>
                {customRepeatOpen && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">Frequency</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-500">Every</span>
                        <Input type="number" min="1" value={customFreqValue}
                          onChange={e => setCustomFreqValue(Math.max(1, Number(e.target.value)))}
                          className="glass-input h-8 text-sm w-16" />
                        <div className="flex gap-1">
                          {(['days', 'weeks', 'months'] as const).map(t => (
                            <Chip key={t} active={customFreqType === t} onClick={() => setCustomFreqType(t)}>{t}</Chip>
                          ))}
                        </div>
                      </div>
                    </div>
                    {customFreqType === 'weeks' && (
                      <div className="space-y-1.5">
                        <span className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">On these days</span>
                        <div className="flex gap-1">
                          {DAYS_OF_WEEK.map(day => (
                            <button key={day.value} type="button" title={day.fullLabel} onClick={() => toggleCustomDay(day.value)}
                              className={cn("w-8 h-8 rounded-full text-xs font-medium border transition-colors",
                                watchedCustomDays.includes(day.value)
                                  ? "bg-primary text-white border-primary"
                                  : "border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-primary/50")}>
                              {day.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {customFreqType === 'months' && (
                      <div className="flex items-start gap-1.5 text-[11px] text-gray-400">
                        <Info size={10} className="mt-0.5 flex-shrink-0" />
                        Repeats on the same date each month.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </FormItem>
      )} />
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <ModuleContainer title={title} onRemove={onRemove} onTitleChange={onTitleChange}
      onMinimize={onMinimize} isMinimized={isMinimized} isDragging={isDragging}
      moveTargets={moveTargets} onMoveToPage={onMoveToPage} onShare={onShare} isReadOnly={isReadOnly}>
      <div className={cn("space-y-2", sizeLevel >= 2 && "flex flex-col h-full min-h-0")}>
        <div className="flex items-center gap-1.5">
          <input value={quickTitle} onChange={e => setQuickTitle(e.target.value)} onKeyDown={handleQuickAdd}
            placeholder="Add reminder… (press Enter)"
            className="flex-1 text-sm bg-gray-100/70 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-md px-3 py-1.5 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-primary/50" />
          <button onClick={() => {
            setIsEditing(false);
            setSelectedReminder(null);
            setWhenMode('event');
            setLinkedEventId('');
            setOffsetBefore(15);
            setOffsetAfter(null);
            setActivePreset('1h');
            setSoundEnabled(true);
            setRecurringScope('this');
            setCustomRepeatOpen(false);
            const defaultIso = dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm');
            const [d, t] = defaultIso.split('T');
            setSplitDate(d || '');
            setSplitTime(t?.substring(0, 5) || '');
            form.reset({ title: '', description: '', reminderTime: defaultIso, soundId: 'default', recurrence: 'none', customDays: [] } as any);
            skipDialogResetRef.current = true;
            setIsDialogOpen(true);
          }}
            className="p-1.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors" title="Add with options">
            <Plus size={16} />
          </button>
        </div>

        <div className={cn("overflow-y-auto space-y-3 pr-0.5", sizeLevel >= 2 ? "flex-1 min-h-0" : "max-h-64")}>
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
              {groupedReminders.overdue.length > 0 && <GroupSection label="Overdue" color="red">{groupedReminders.overdue.map(renderReminderRow)}</GroupSection>}
              {groupedReminders.today.length > 0 && <GroupSection label="Today">{groupedReminders.today.map(renderReminderRow)}</GroupSection>}
              {groupedReminders.tomorrow.length > 0 && <GroupSection label="Tomorrow">{groupedReminders.tomorrow.map(renderReminderRow)}</GroupSection>}
              {groupedReminders.upcoming.length > 0 && <GroupSection label="Upcoming">{groupedReminders.upcoming.map(renderReminderRow)}</GroupSection>}
              {alarms.length > 0 && <GroupSection label="Alarms">{alarms.map(renderAlarmRow)}</GroupSection>}
            </>
          )}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[440px] bg-background/95 border-white/10 max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Reminder' : 'New Reminder'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">

              <FormField control={form.control} name="title" render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input placeholder="What do you need to remember?" {...field} className="glass-input" /></FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>Note <span className="text-gray-400 font-normal">(optional)</span></FormLabel>
                  <FormControl><Input placeholder="Add details…" {...field} className="glass-input" /></FormControl>
                </FormItem>
              )} />

              {/* Sound toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {soundEnabled ? <Volume2 size={14} className="text-primary" /> : <VolumeX size={14} className="text-gray-400" />}
                  <span className="text-sm font-medium">Sound</span>
                  <span className="text-[11px] text-gray-400">{soundEnabled ? 'plays sound' : 'silent'}</span>
                </div>
                <button type="button" onClick={() => setSoundEnabled(v => !v)}
                  className={cn("relative w-9 h-5 rounded-full transition-colors flex items-center px-0.5",
                    soundEnabled ? "bg-primary" : "bg-gray-200 dark:bg-white/10")}>
                  <span className={cn("w-4 h-4 rounded-full bg-white shadow transition-transform",
                    soundEnabled ? "translate-x-4" : "translate-x-0")} />
                </button>
              </div>

              {soundEnabled && (
                <FormField control={form.control} name="soundId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sound</FormLabel>
                    <FormControl>
                      <select {...field} className="glass-input w-full h-10 px-3">
                        {getSounds().map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </FormControl>
                  </FormItem>
                )} />
              )}

              <div>
                <FormLabel className="mb-2 block">When</FormLabel>
                {renderWhenSection()}
              </div>

              {renderRepeatSection()}

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
