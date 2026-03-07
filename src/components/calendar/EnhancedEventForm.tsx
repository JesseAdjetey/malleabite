import React, { useState, useEffect } from 'react';
import { CalendarEventType, RecurrenceRule } from '@/lib/stores/types';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';
import { useTodoCalendarIntegration } from '@/hooks/use-todo-calendar-integration';
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Clock, AlarmClock, Users, Palette, Sun, Repeat } from "lucide-react";
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
import { useFocusTimeCheck } from './FocusTimeBlocks';
import { Shield } from 'lucide-react';
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
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [hasAlarm, setHasAlarm] = useState(false);
  const [hasReminder, setHasReminder] = useState(false);

  const [category, setCategory] = useState<import('@/lib/algorithms/event-classifier').EventCategory | undefined>();
  
  // Calendar-style fields
  const [isAllDay, setIsAllDay] = useState(false);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [recurrenceRule, setRecurrenceRule] = useState<RecurrenceRule | undefined>(undefined);

  const isTemplateMode = useTemplateModeStore(s => s.isTemplateMode);

  const { handleCreateTodoFromEvent } = useTodoCalendarIntegration();
  const { events } = useCalendarEvents();
  const { calendars: connectedCalendars } = useCalendarGroups();
  const getVisibleCalendarIds = useCalendarFilterStore(s => s.getVisibleCalendarIds);
  const { isInFocusTime, getFocusBlockAtTime } = useFocusTimeCheck();
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
  
  // Check if event is during focus time
  const focusTimeCheck = React.useMemo(() => {
    if (!previewEvent) return null;
    const inFocusTime = isInFocusTime(previewEvent.startsAt);
    if (inFocusTime) {
      return getFocusBlockAtTime(previewEvent.startsAt);
    }
    return null;
  }, [previewEvent, isInFocusTime, getFocusBlockAtTime]);

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

  // Auto-select the first active calendar whenever none are selected
  useEffect(() => {
    if (connectedCalendars.length > 0 && selectedCalendarIds.length === 0) {
      const firstActive = connectedCalendars.find(c => c.isActive && c.id);
      if (firstActive) {
        setSelectedCalendarIds([firstActive.id]);
      }
    }
  }, [connectedCalendars, selectedCalendarIds.length]);

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
    if (!eventData && !selectedDate) {
      toast.error("Please fill out the event details first");
      return;
    }
    
    try {
      // Create a properly formed event object to pass to the handler
      const eventToCreate = eventData || {
        id: crypto.randomUUID(),
        title: title,
        description: `${startTime} - ${endTime} | ${description}`,
        date: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined,
        startsAt: selectedDate ? new Date(selectedDate).toISOString() : new Date().toISOString(),
        endsAt: selectedDate ? new Date(selectedDate).toISOString() : new Date().toISOString(),
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
          <Popover>
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
            <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
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

        {/* Calendar Selection — multi-select with auto-visible */}
        {connectedCalendars.length > 0 && (() => {
          const activeCalendars = connectedCalendars.filter(c => c.isActive && c.id);
          if (activeCalendars.length === 0) return null;
          return (
            <div className="mb-4">
              <Label className="mb-1.5 block">Calendars</Label>
              <div className="flex flex-wrap gap-2">
                {activeCalendars.map((cal) => {
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

        {/* Focus Time Warning */}
        {focusTimeCheck && previewEvent && (
          <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-1">
                  During Protected Focus Time
                </h4>
                <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">
                  This event is scheduled during "{focusTimeCheck.label}" (
                  {focusTimeCheck.startHour.toString().padStart(2, '0')}:00 -{' '}
                  {focusTimeCheck.endHour.toString().padStart(2, '0')}:00).
                  Consider rescheduling to maintain your productivity.
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  💡 Tip: Focus time is reserved for deep work and concentration
                </p>
              </div>
            </div>
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
