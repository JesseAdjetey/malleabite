import React, { useState, useEffect } from 'react';
import { CalendarEventType } from '@/lib/stores/types';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { toast } from 'sonner';
import { useTodoCalendarIntegration } from '@/hooks/use-todo-calendar-integration';
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Clock, AlarmClock, Users, Palette, MapPin, Video, Globe, Sun } from "lucide-react";
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
import dayjs from 'dayjs';
import { useConflictDetection } from '@/hooks/use-conflict-detection';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import ConflictWarning from './ConflictWarning';
import { useFocusTimeCheck } from './FocusTimeBlocks';
import { Shield } from 'lucide-react';
import { CategorySuggestions } from '@/components/categorization/CategorySuggestions';
import { EventClassifier, getCategoryColor } from '@/lib/algorithms/event-classifier';
import { useCalendars } from '@/hooks/use-calendars';

interface EnhancedEventFormProps {
  event?: CalendarEventType | null;
  initialEvent?: CalendarEventType | null;
  onUpdateEvent?: (event: CalendarEventType) => void;
  onSave?: (event: CalendarEventType) => void;
  onClose?: () => void;
  onCancel?: () => void;
  onUseAI?: () => void;
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
  onUseAI
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
  const [participants, setParticipants] = useState('');
  const [category, setCategory] = useState<import('@/lib/algorithms/event-classifier').EventCategory | undefined>();
  
  // NEW: Google Calendar-style fields
  const [location, setLocation] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [meetingUrl, setMeetingUrl] = useState('');
  const [meetingProvider, setMeetingProvider] = useState<'zoom' | 'google_meet' | 'teams' | 'other' | ''>('');
  const [selectedCalendarId, setSelectedCalendarId] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');

  const { handleCreateTodoFromEvent } = useTodoCalendarIntegration();
  const { events } = useCalendarEvents();
  const { calendars } = useCalendars();
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
      
      // Extract time information from description (format: "HH:MM - HH:MM | Description")
      const descriptionParts = eventData.description.split('|');
      const timeRange = descriptionParts[0].trim();
      const actualDescription = descriptionParts.length > 1 ? descriptionParts[1].trim() : '';
      
      // Split time range into start and end times
      const times = timeRange.split('-');
      if (times.length === 2) {
        setStartTime(times[0].trim());
        setEndTime(times[1].trim());
      }
      
      setDescription(actualDescription);
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
      
      // Handle participants
      if (eventData.participants && Array.isArray(eventData.participants)) {
        setParticipants(eventData.participants.join(', '));
      }
      
      // NEW: Load Google Calendar-style fields
      setLocation(eventData.location || '');
      setIsAllDay(eventData.isAllDay || false);
      setMeetingUrl(eventData.meetingUrl || '');
      setMeetingProvider(eventData.meetingProvider || '');
      setSelectedCalendarId(eventData.calendarId || '');
      setVisibility(eventData.visibility === 'private' ? 'private' : 'public');
    }
  }, [eventData]);

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
    
    // Parse participants string to array
    const participantsArray = participants
      ? participants.split(',').map(p => p.trim()).filter(Boolean)
      : undefined;
    
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
      participants: participantsArray,
      timeStart: startTime,
      timeEnd: endTime,
      // NEW: Google Calendar-style fields
      location: location || undefined,
      isAllDay,
      meetingUrl: meetingUrl || undefined,
      meetingProvider: meetingProvider || undefined,
      calendarId: selectedCalendarId || undefined,
      visibility: visibility,
    };

    if (onUpdateEvent) {
      onUpdateEvent(updatedEvent);
    } else if (onSave) {
      onSave(updatedEvent);
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
      {/* Subtle background animation */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-background/5 to-background/20 bg-[size:200%_200%] animate-subtle-gradient opacity-10" />
      
      <h2 className="text-lg font-semibold mb-4">
        {eventData ? "Edit Event" : "Add New Event"}
      </h2>

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

        {/* All-Day Event Toggle */}
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

        {/* Location Input */}
        <div className="mb-4">
          <Label htmlFor="location" className="mb-1 block">Location</Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Add location or address"
              className="pl-9 transition-all duration-200 focus:ring-2 focus:ring-primary/50"
            />
          </div>
        </div>

        {/* Video Conferencing */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <Label htmlFor="meetingProvider" className="mb-1 block">Video Call</Label>
            <Select
              value={meetingProvider}
              onValueChange={(v) => setMeetingProvider(v as any)}
            >
              <SelectTrigger className="w-full">
                <div className="flex items-center">
                  <Video className="h-4 w-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="Add video conferencing" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                <SelectItem value="zoom">Zoom</SelectItem>
                <SelectItem value="google_meet">Google Meet</SelectItem>
                <SelectItem value="teams">Microsoft Teams</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {meetingProvider && (
            <div>
              <Label htmlFor="meetingUrl" className="mb-1 block">Meeting URL</Label>
              <Input
                type="url"
                id="meetingUrl"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="https://..."
                className="transition-all duration-200"
              />
            </div>
          )}
        </div>

        {/* Calendar Selection */}
        {calendars.length > 0 && (
          <div className="mb-4">
            <Label htmlFor="calendar" className="mb-1 block">Calendar</Label>
            <Select
              value={selectedCalendarId}
              onValueChange={setSelectedCalendarId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select calendar" />
              </SelectTrigger>
              <SelectContent>
                {calendars.filter(c => c.isVisible).map((cal) => (
                  <SelectItem key={cal.id} value={cal.id}>
                    <div className="flex items-center">
                      <div 
                        className="h-3 w-3 rounded-full mr-2" 
                        style={{ backgroundColor: cal.color }}
                      />
                      {cal.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Visibility */}
        <div className="flex items-center justify-between space-x-2 p-3 rounded-md border mb-4">
          <div className="flex items-center space-x-2">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="visibility">Public event</Label>
          </div>
          <Switch
            id="visibility"
            checked={visibility === 'public'}
            onCheckedChange={(checked) => setVisibility(checked ? 'public' : 'private')}
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

        {/* Category Suggestions - Auto-categorization */}
        <CategorySuggestions
          title={title}
          description={description}
          location={participants}
          currentCategory={category}
          onSelectCategory={(selectedCategory) => {
            setCategory(selectedCategory);
            const color = getCategoryColor(selectedCategory);
            setSelectedColor(color);
            
            // Learn from user's selection if they manually change it later
            if (eventData && eventData.color !== color) {
              eventClassifier.learn(
                title,
                selectedCategory,
                description
              );
            }
          }}
        />
        
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

        <div className="mb-4">
          <Label htmlFor="participants" className="mb-1 block">Participants (comma separated)</Label>
          <Input
            type="text"
            id="participants"
            value={participants}
            onChange={(e) => setParticipants(e.target.value)}
            placeholder="John Doe, Jane Smith"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center justify-between space-x-2 p-3 rounded-md border">
            <div className="flex items-center space-x-2">
              <AlarmClock className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="hasAlarm">Has Alarm</Label>
            </div>
            <Switch
              id="hasAlarm"
              checked={hasAlarm}
              onCheckedChange={setHasAlarm}
            />
          </div>
          <div className="flex items-center justify-between space-x-2 p-3 rounded-md border">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="hasReminder">Reminder</Label>
            </div>
            <Switch
              id="hasReminder"
              checked={hasReminder}
              onCheckedChange={setHasReminder}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center justify-between space-x-2 p-3 rounded-md border">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="isTodo">Todo</Label>
            </div>
            <Switch
              id="isTodo"
              checked={isTodo}
              onCheckedChange={setIsTodo}
            />
          </div>
          <div className="flex items-center justify-between space-x-2 p-3 rounded-md border">
            <div className="flex items-center space-x-2">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="isLocked">Locked</Label>
            </div>
            <Switch
              id="isLocked"
              checked={isLocked}
              onCheckedChange={setIsLocked}
            />
          </div>
        </div>

        <div className="flex justify-between pt-4 border-t border-border">
          {onCancel || onClose ? (
            <Button 
              variant="ghost" 
              onClick={onCancel || onClose}
              className="hover:bg-secondary/80 transition-colors"
            >
              Cancel
            </Button>
          ) : null}
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              onClick={onUseAI}
              className="transition-all hover:bg-primary/20"
            >
              Use AI
            </Button>
            <Button 
              variant="outline" 
              onClick={handleCreateTodo}
              className="transition-all hover:bg-secondary/80"
            >
              Create Todo
            </Button>
            <Button 
              onClick={handleSubmit}
              className="transition-all hover:bg-primary/90"
            >
              {onUpdateEvent ? "Update" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EnhancedEventForm;
