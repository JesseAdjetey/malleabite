import React, { useState, useEffect } from 'react';
import { CalendarEventType, MallyAction, RecurrenceRule } from '@/lib/stores/types';
import { ActionBuilder } from '@/components/actions/ActionBuilder';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';
import { useTodoCalendarIntegration } from '@/hooks/use-todo-calendar-integration';
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Clock, AlarmClock, Users, Palette, Sun, Repeat, Lock, Timer, Zap } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from '@/lib/utils';
import { Switch } from "@/components/ui/switch";

import { useConflictDetection } from '@/hooks/use-conflict-detection';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import ConflictWarning from './ConflictWarning';
import { CategorySuggestions } from '@/components/categorization/CategorySuggestions';
import { EventClassifier, getCategoryColor } from '@/lib/algorithms/event-classifier';
import { useCalendarGroups } from '@/hooks/use-calendar-groups';
import { PERSONAL_CALENDAR_ID, useCalendarFilterStore } from '@/lib/stores/calendar-filter-store';
import { RecurrenceRuleEditor } from './RecurrenceRuleEditor';
import { useTemplateModeStore } from '@/lib/stores/template-mode-store';


interface EnhancedEventFormProps {
  event?: CalendarEventType | null;
  initialEvent?: CalendarEventType | null;
  onUpdateEvent?: (event: CalendarEventType) => void;
  onSave?: (event: CalendarEventType) => void;
  onClose?: () => void;
  onCancel?: () => void;
}

const EVENT_COLORS = [
  { value: 'bg-[hsl(var(--event-red))]', label: 'Red', class: 'bg-rose-500' },
  { value: 'bg-[hsl(var(--event-green))]', label: 'Green', class: 'bg-green-500' },
  { value: 'bg-[hsl(var(--event-blue))]', label: 'Blue', class: 'bg-blue-500' },
  { value: 'bg-[hsl(var(--event-purple))]', label: 'Purple', class: 'bg-purple-500' },
  { value: 'bg-[hsl(var(--event-teal))]', label: 'Teal', class: 'bg-teal-500' },
  { value: 'bg-[hsl(var(--event-orange))]', label: 'Orange', class: 'bg-orange-500' },
  { value: 'bg-[hsl(var(--event-pink))]', label: 'Pink', class: 'bg-pink-500' },
];

const TIME_OPTIONS = Array.from({ length: 24 * 4 }).map((_, i) => {
  const hour = Math.floor(i / 4);
  const minute = (i % 4) * 15;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
});

const EnhancedEventForm: React.FC<EnhancedEventFormProps> = ({
  event,
  initialEvent,
  onUpdateEvent,
  onSave,
  onClose,
  onCancel,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const [isLocked, setIsLocked] = useState(false);
  const [isTodo, setIsTodo] = useState(false);
  const [countdownEnabled, setCountdownEnabled] = useState(false);
  const [countdownReminderIntervalDays, setCountdownReminderIntervalDays] = useState(2);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [hasAlarm, setHasAlarm] = useState(false);
  const [hasReminder, setHasReminder] = useState(false);

  const [category, setCategory] = useState<import('@/lib/algorithms/event-classifier').EventCategory | undefined>();

  // Calendar-style fields
  const [isAllDay, setIsAllDay] = useState(false);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>(() => {
    // Read directly from the Zustand store (synchronous — no loading delay)
    // so the correct calendars are shown immediately on open.
    const visible = useCalendarFilterStore.getState().getVisibleCalendarIds()
      .filter(id => !id.startsWith('template_'));
    return visible.length > 0 ? visible : [PERSONAL_CALENDAR_ID];
  });
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule | undefined>(undefined);
  const [mallyActions, setMallyActions] = useState<MallyAction[]>([]);
  const [actionsExpanded, setActionsExpanded] = useState(false);

  const isTemplateMode = useTemplateModeStore(s => s.isTemplateMode);

  const { handleCreateTodoFromEvent } = useTodoCalendarIntegration();
  const { events } = useCalendarEvents();
  const { calendars: connectedCalendars } = useCalendarGroups();
  const eventClassifier = React.useMemo(() => new EventClassifier(), []);

  // Use either the event or initialEvent prop, whichever is provided
  const eventData = event || initialEvent;

  // Create a preview event for conflict detection
  const previewEvent: CalendarEventType | undefined = React.useMemo(() => {
    if (!selectedDate || !startTime || !endTime) return undefined;

    const formattedDate = format(selectedDate, 'yyyy-MM-dd');
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const startsAtDate = new Date(selectedDate);
    startsAtDate.setHours(startHour, startMinute, 0);

    const endsAtDate = new Date(selectedDate);
    endsAtDate.setHours(endHour, endMinute, 0);

    return {
      id: eventData?.id || 'preview-event',
      title: title || 'New Event',
      description: description,
      date: formattedDate,
      startsAt: startsAtDate.toISOString(),
      endsAt: endsAtDate.toISOString(),
      color: selectedColor,
    };
  }, [selectedDate, startTime, endTime, title, description, selectedColor, eventData]);

  // Detect conflicts with the preview event
  const conflictDetection = useConflictDetection(events, previewEvent);


  useEffect(() => {
    if (eventData) {
      setTitle(eventData.title);

      // First try to get time from startsAt/endsAt fields (modern format)
      if (eventData.startsAt && eventData.endsAt) {
        const startDate = new Date(eventData.startsAt);
        const endDate = new Date(eventData.endsAt);
        setStartTime(
          `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`
        );
        setEndTime(
          `${endDate.getHours().toString().padStart(2, '0')}:${endDate.getMinutes().toString().padStart(2, '0')}`
        );

        // Get description - exclude the time part if it exists in legacy format
        const desc = eventData.description || '';
        if (desc.includes('|')) {
          setDescription(desc.split('|').slice(1).join('|').trim());
        } else if (/^\d{2}:\d{2}\s*-\s*\d{2}:\d{2}$/.test(desc.trim())) {
          setDescription('');
        } else {
          setDescription(desc);
        }
      } else {
        // Fallback: Extract time information from description (legacy format: "HH:MM - HH:MM | Description")
        const descriptionParts = eventData.description?.split('|') || [];
        const timeRange = descriptionParts[0]?.trim() || '';
        const actualDescription = descriptionParts.length > 1 ? descriptionParts[1].trim() : '';

        // Split time range into start and end times
        const times = timeRange.split('-');
        if (times.length === 2 && /^\d{2}:\d{2}$/.test(times[0].trim())) {
          setStartTime(times[0].trim());
          setEndTime(times[1].trim());
        } else {
          // Default times if not found
          setStartTime('09:00');
          setEndTime('10:00');
        }

        setDescription(actualDescription);
      }

      setIsLocked(eventData.isLocked || false);
      setIsTodo(eventData.isTodo || false);
      setCountdownEnabled(eventData.countdownEnabled || false);
      setCountdownReminderIntervalDays(eventData.countdownReminderIntervalDays ?? 2);
      setHasAlarm(eventData.hasAlarm || false);
      setHasReminder(eventData.hasReminder || false);
      setSelectedColor(eventData.color || EVENT_COLORS[0].value);

      // Set selected date from either date field or startsAt
      if (eventData.date) {
        setSelectedDate(new Date(eventData.date));
      } else if (eventData.startsAt) {
        setSelectedDate(new Date(eventData.startsAt));
      }

      // Load calendar-style fields
      setIsAllDay(eventData.isAllDay || false);
      if (eventData.calendarId) {
        setSelectedCalendarIds([eventData.calendarId]);
      }
      setRecurrenceRule(eventData.recurrenceRule);
      setMallyActions(eventData.mallyActions || []);
      if (eventData.mallyActions?.length) setActionsExpanded(true);
    }
  }, [eventData]);

  // In template mode, auto-default to weekly recurrence when creating a new event
  useEffect(() => {
    if (isTemplateMode && !eventData?.recurrenceRule && !recurrenceRule && selectedDate) {
      setRecurrenceRule({
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [selectedDate.getDay()],
      });
    }
  }, [isTemplateMode, selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback: if the filter store was empty on mount and still no selection, default to Personal
  useEffect(() => {
    if (selectedCalendarIds.length === 0) {
      setSelectedCalendarIds([PERSONAL_CALENDAR_ID]);
    }
  }, [selectedCalendarIds.length]);

  const handleSubmit = () => {
    if (!title) {
      toast.error("Title is required");
      return;
    }

    if (!selectedDate) {
      toast.error("Date is required");
      return;
    }

    if (!startTime || !endTime) {
      toast.error("Start and end time are required");
      return;
    }

    // Reconstruct the description with time information
    const fullDescription = `${startTime} - ${endTime} | ${description}`;

    // Convert the selected date to YYYY-MM-DD format
    const formattedDate = format(selectedDate, 'yyyy-MM-dd');

    // Create the startsAt and endsAt ISO strings by combining the date with times
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    const startsAtDate = new Date(selectedDate);
    startsAtDate.setHours(startHour, startMinute, 0);

    const endsAtDate = new Date(selectedDate);
    endsAtDate.setHours(endHour, endMinute, 0);

    const updatedEvent: CalendarEventType = {
      ...(eventData || { id: crypto.randomUUID() }),
      title,
      description: fullDescription,
      isLocked,
      isTodo,
      countdownEnabled,
      countdownReminderIntervalDays: countdownEnabled ? countdownReminderIntervalDays : undefined,
      hasAlarm,
      hasReminder,
      date: formattedDate,
      startsAt: startsAtDate.toISOString(),
      endsAt: endsAtDate.toISOString(),
      color: selectedColor,
      timeStart: startTime,
      timeEnd: endTime,
      isAllDay,
      calendarId: selectedCalendarIds[0] || undefined,
      // Recurring event fields
      isRecurring: !!recurrenceRule,
      recurrenceRule: recurrenceRule,
      mallyActions: mallyActions.length > 0 ? mallyActions : undefined,
    };

    // If multiple calendars selected, save a copy to each
    const calendarsToSave = selectedCalendarIds.length > 1 ? selectedCalendarIds : [selectedCalendarIds[0] || undefined];

    for (const calId of calendarsToSave) {
      const eventForCalendar: CalendarEventType = {
        ...updatedEvent,
        id: calId === calendarsToSave[0] ? updatedEvent.id : crypto.randomUUID(),
        calendarId: calId,
      };

      if (onUpdateEvent) {
        onUpdateEvent(eventForCalendar);
      } else if (onSave) {
        onSave(eventForCalendar);
      }
    }

    if (onClose) onClose();
    else if (onCancel) onCancel();
  };

  const handleCreateTodo = async () => {
    if (!title.trim()) {
      toast.error("Please enter an event title first");
      return;
    }

    try {
      // Use existing saved event or build one from current form state
      const eventToCreate = eventData || {
        id: crypto.randomUUID(),
        title: title.trim(),
        description: description,
        date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        startsAt: selectedDate ? new Date(selectedDate).toISOString() : new Date().toISOString(),
        endsAt: selectedDate ? new Date(new Date(selectedDate).getTime() + 3600000).toISOString() : new Date(Date.now() + 3600000).toISOString(),
        color: selectedColor || EVENT_COLORS[0].value,
      };

      const todoId = await handleCreateTodoFromEvent(eventToCreate);

      if (todoId) {
        toast.success("Todo created from event");
        setIsTodo(true);

        // Update the event to link it with the todo
        const updatedEvent = {
          ...eventToCreate,
          todoId,
          isTodo: true
        };

        if (onUpdateEvent) {
          onUpdateEvent(updatedEvent);
        } else if (onSave) {
          onSave(updatedEvent);
        }
      }
    } catch (error) {
      console.error("Error creating todo from event:", error);
      toast.error("Failed to create todo from event");
    }
  };

  return (
    <div className="p-4 relative overflow-hidden">
      {/* Template mode indicator */}
      {isTemplateMode && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2 text-xs text-primary font-medium">
          <Repeat size={13} />
          Template mode — events will repeat weekly by default
        </div>
      )}
      {/* Subtle background animation */}
      <div className="absolute inset-0 -z-10 pointer-events-none bg-gradient-to-r from-background/5 to-background/20 bg-[size:200%_200%] animate-subtle-gradient opacity-10" />

      {/* Header with Save button */}
      <div className="flex items-center justify-end mb-4">
        <div className="flex items-center gap-2">
          {(onCancel || onClose) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel || onClose}
              className="hover:bg-secondary/80 transition-colors"
            >
              Cancel
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            className="transition-all hover:bg-primary/90"
          >
            {onUpdateEvent ? "Update" : "Save"}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="mb-4">
          <Label htmlFor="title" className="mb-1 block">Event Title</Label>
          <Input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add event title"
            className="transition-all duration-200 focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <div className="mb-4">
          <Label htmlFor="date" className="mb-1 block">Date</Label>
          <Popover modal={true}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !selectedDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, "PPP") : <span>Select date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 pointer-events-auto z-[200]" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                initialFocus
                className="rounded-md border"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* All-Day Event Toggle — placed before time pickers */}
        <div className="flex items-center justify-between space-x-2 p-3 rounded-md border mb-4">
          <div className="flex items-center space-x-2">
            <Sun className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="isAllDay">All-day event</Label>
          </div>
          <Switch
            id="isAllDay"
            checked={isAllDay}
            onCheckedChange={(checked) => {
              setIsAllDay(checked);
              if (checked) {
                setStartTime('00:00');
                setEndTime('23:59');
              }
            }}
          />
        </div>

        {/* Time pickers — hidden when all-day is toggled */}
        {!isAllDay && (
          <>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="startTime" className="mb-1 block">Start Time</Label>
                <Select
                  value={startTime}
                  onValueChange={setStartTime}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Start time">
                      {startTime || "Select time"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {TIME_OPTIONS.map((time) => (
                      <SelectItem key={`start-${time}`} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="endTime" className="mb-1 block">End Time</Label>
                <Select
                  value={endTime}
                  onValueChange={setEndTime}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="End time">
                      {endTime || "Select time"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {TIME_OPTIONS.map((time) => (
                      <SelectItem key={`end-${time}`} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

          </>
        )}

        {/* Calendar Selection — always visible; Personal is always an option */}
        {(() => {
          const activeConnected = connectedCalendars.filter(c => c.id && c.id !== PERSONAL_CALENDAR_ID && c.name?.toLowerCase() !== 'personal');
          const allOptions: { id: string; name: string; color: string; source: string | null }[] = [
            { id: PERSONAL_CALENDAR_ID, name: 'Personal', color: '#8B5CF6', source: null },
            ...activeConnected,
          ];
          return (
            <div className="mb-4">
              <Label className="mb-1.5 block">Calendar</Label>
              <div className="flex flex-wrap gap-2">
                {allOptions.map((cal) => {
                  const isSelected = selectedCalendarIds.includes(cal.id);
                  return (
                    <button
                      key={cal.id}
                      type="button"
                      onClick={() => {
                        setSelectedCalendarIds(prev =>
                          prev.includes(cal.id)
                            ? prev.filter(id => id !== cal.id)
                            : [...prev, cal.id]
                        );
                      }}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                        isSelected
                          ? "border-primary/50 bg-primary/10 text-foreground"
                          : "border-border/50 bg-transparent text-muted-foreground hover:border-border"
                      )}
                    >
                      <div
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: cal.color }}
                      />
                      {cal.name}
                      {cal.source === 'google' && (
                        <span className="text-[9px] text-muted-foreground">G</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Recurring Event */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Repeat className="h-4 w-4 text-muted-foreground" />
            <Label>Repeat</Label>
          </div>
          <RecurrenceRuleEditor
            value={recurrenceRule}
            onChange={setRecurrenceRule}
            startDate={selectedDate}
          />
        </div>

        <div className="mb-4">
          <Label htmlFor="color" className="mb-1 block">Event Color</Label>
          <Select
            value={selectedColor}
            onValueChange={setSelectedColor}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a color">
                <div className="flex items-center">
                  <div
                    className={`h-3 w-3 rounded-full mr-2 ${EVENT_COLORS.find(c => c.value === selectedColor)?.class || 'bg-primary'}`}
                  />
                  {EVENT_COLORS.find(c => c.value === selectedColor)?.label || 'Select color'}
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {EVENT_COLORS.map((color) => (
                <SelectItem key={color.value} value={color.value}>
                  <div className="flex items-center">
                    <div className={`h-3 w-3 rounded-full mr-2 ${color.class}`} />
                    {color.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mb-4">
          <Label htmlFor="description" className="mb-1 block">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add details about this event"
            className="min-h-[80px] transition-all duration-200 focus:ring-2 focus:ring-primary/50"
          />
        </div>

        {/* Lock Event Toggle */}
        <div className="flex items-center justify-between space-x-2 p-3 rounded-md border mb-4">
          <div className="flex items-center space-x-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="isLocked">Lock event</Label>
          </div>
          <Switch
            id="isLocked"
            checked={isLocked}
            onCheckedChange={setIsLocked}
          />
        </div>

        {/* Countdown Toggle */}
        <div className="rounded-md border mb-4">
          <div className="flex items-center justify-between space-x-2 p-3">
            <div className="flex items-center space-x-2">
              <Timer className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="countdownEnabled">Countdown</Label>
            </div>
            <Switch
              id="countdownEnabled"
              checked={countdownEnabled}
              onCheckedChange={setCountdownEnabled}
            />
          </div>
          {countdownEnabled && (
            <div className="px-3 pb-3 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Remind every</span>
              <Select
                value={String(countdownReminderIntervalDays)}
                onValueChange={(v) => setCountdownReminderIntervalDays(Number(v))}
              >
                <SelectTrigger className="w-32 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={String(30/1440)}>30 minutes</SelectItem>
                  <SelectItem value={String(1/24)}>1 hour</SelectItem>
                  <SelectItem value={String(3/24)}>3 hours</SelectItem>
                  <SelectItem value={String(6/24)}>6 hours</SelectItem>
                  <SelectItem value="1">1 day</SelectItem>
                  <SelectItem value="2">2 days</SelectItem>
                  <SelectItem value="3">3 days</SelectItem>
                  <SelectItem value="7">7 days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Mally Actions */}
        <div className="rounded-md border mb-4">
          <button
            type="button"
            className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
            onClick={() => setActionsExpanded(v => !v)}
          >
            <Zap className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Mally Actions</span>
            {mallyActions.length > 0 && (
              <span className="ml-auto text-[11px] font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
                {mallyActions.length}
              </span>
            )}
          </button>
          {actionsExpanded && (
            <div className="px-3 pb-3 border-t border-border/30 pt-2.5">
              <ActionBuilder
                actions={mallyActions}
                onChange={setMallyActions}
              />
            </div>
          )}
        </div>

        {/* Conflict Warning - Show if there are any conflicts */}
        {conflictDetection.hasConflicts && previewEvent && (
          <div className="mb-4">
            <ConflictWarning
              conflicts={conflictDetection.conflicts}
              events={events}
              variant="inline"
            />
          </div>
        )}


        <div className="flex justify-end pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCreateTodo}
            className="transition-all hover:bg-secondary/80"
          >
            Create Todo
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EnhancedEventForm;
