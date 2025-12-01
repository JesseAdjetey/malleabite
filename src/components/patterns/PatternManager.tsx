import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Edit2, Calendar, Repeat, X, PlayCircle } from 'lucide-react';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { usePatternDetection } from '@/hooks/use-pattern-detection';
import { CalendarEventType } from '@/lib/stores/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RecurringPattern {
  id: string;
  name: string;
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  interval: number;
  daysOfWeek?: number[]; // 0-6 for weekly patterns
  dayOfMonth?: number; // 1-31 for monthly patterns
  description: string;
  eventCount: number;
  lastApplied?: string;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

export default function PatternManager() {
  const { addEvent } = useCalendarEvents();
  const patternStats = usePatternDetection();
  const [patterns, setPatterns] = useState<RecurringPattern[]>([
    {
      id: '1',
      name: 'Daily Standup',
      type: 'daily',
      interval: 1,
      description: 'Every weekday at 9 AM',
      eventCount: 5,
      daysOfWeek: [1, 2, 3, 4, 5],
    },
    {
      id: '2',
      name: 'Weekly Review',
      type: 'weekly',
      interval: 1,
      description: 'Every Friday at 4 PM',
      eventCount: 1,
      daysOfWeek: [5],
    },
  ]);

  const [isCreating, setIsCreating] = useState(false);
  const [applyDialogOpen, setApplyDialogOpen] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<RecurringPattern | null>(null);
  const [startDate, setStartDate] = useState<string>(dayjs().format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState<string>(dayjs().add(30, 'days').format('YYYY-MM-DD'));
  const [eventTitle, setEventTitle] = useState<string>('');
  const [eventTime, setEventTime] = useState<string>('09:00');
  const [eventDuration, setEventDuration] = useState<number>(60);
  const [newPattern, setNewPattern] = useState<Partial<RecurringPattern>>({
    name: '',
    type: 'weekly',
    interval: 1,
    daysOfWeek: [],
    description: '',
  });

  // Remove mock pattern stats - now using real pattern detection hook

  const handleCreatePattern = () => {
    if (!newPattern.name || !newPattern.type) {
      toast.error('Please fill in all required fields');
      return;
    }

    const pattern: RecurringPattern = {
      id: crypto.randomUUID(),
      name: newPattern.name,
      type: newPattern.type as 'daily' | 'weekly' | 'monthly' | 'custom',
      interval: newPattern.interval || 1,
      daysOfWeek: newPattern.daysOfWeek || [],
      dayOfMonth: newPattern.dayOfMonth,
      description: newPattern.description || '',
      eventCount: 0,
    };

    setPatterns([...patterns, pattern]);
    setNewPattern({ name: '', type: 'weekly', interval: 1, daysOfWeek: [], description: '' });
    setIsCreating(false);
    toast.success('Pattern created successfully');
  };

  const handleDeletePattern = (patternId: string) => {
    setPatterns(patterns.filter((p) => p.id !== patternId));
    toast.success('Pattern deleted');
  };

  const handleApplyPattern = (pattern: RecurringPattern) => {
    setSelectedPattern(pattern);
    setEventTitle(pattern.name);
    setApplyDialogOpen(true);
  };

  const applyPattern = async () => {
    if (!selectedPattern || !eventTitle) {
      toast.error('Please provide event title');
      return;
    }

    const start = dayjs(startDate);
    const end = dayjs(endDate);
    const events: Partial<CalendarEventType>[] = [];

    let currentDate = start;
    while (currentDate.isBefore(end) || currentDate.isSame(end, 'day')) {
      let shouldCreateEvent = false;

      switch (selectedPattern.type) {
        case 'daily':
          // For daily patterns, check if day is in daysOfWeek (if specified)
          if (selectedPattern.daysOfWeek && selectedPattern.daysOfWeek.length > 0) {
            shouldCreateEvent = selectedPattern.daysOfWeek.includes(currentDate.day());
          } else {
            shouldCreateEvent = true;
          }
          break;

        case 'weekly':
          // For weekly patterns, only create on specified days
          if (selectedPattern.daysOfWeek) {
            shouldCreateEvent = selectedPattern.daysOfWeek.includes(currentDate.day());
          }
          break;

        case 'monthly':
          // For monthly patterns, check if date matches
          if (selectedPattern.dayOfMonth) {
            shouldCreateEvent = currentDate.date() === selectedPattern.dayOfMonth;
          }
          break;

        case 'custom':
          shouldCreateEvent = true;
          break;
      }

      if (shouldCreateEvent) {
        const [hours, minutes] = eventTime.split(':').map(Number);
        const startDateTime = currentDate.hour(hours).minute(minutes);
        const endDateTime = startDateTime.add(eventDuration, 'minutes');

        events.push({
          id: crypto.randomUUID(),
          title: eventTitle,
          date: currentDate.format('YYYY-MM-DD'),
          startsAt: startDateTime.toISOString(),
          endsAt: endDateTime.toISOString(),
          description: `${eventTime} - ${endDateTime.format('HH:mm')} | ${eventTitle}`,
          color: 'bg-purple-500/70',
        });
      }

      currentDate = currentDate.add(1, 'day');
    }

    if (events.length === 0) {
      toast.error('No events would be created with this pattern and date range');
      return;
    }

    // Create events in batch
    try {
      await Promise.all(events.map(event => addEvent(event as CalendarEventType)));
      
      // Update pattern stats
      const updatedPattern = {
        ...selectedPattern,
        eventCount: (selectedPattern.eventCount || 0) + events.length,
        lastApplied: dayjs().format('YYYY-MM-DD'),
      };
      
      setPatterns(patterns.map(p => 
        p.id === selectedPattern.id ? updatedPattern : p
      ));

      toast.success(`Created ${events.length} events from pattern "${selectedPattern.name}"`);
      setApplyDialogOpen(false);
    } catch (error) {
      console.error('Error applying pattern:', error);
      toast.error('Failed to create events from pattern');
    }
  };

  const handleToggleDay = (day: number) => {
    const currentDays = newPattern.daysOfWeek || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day];
    setNewPattern({ ...newPattern, daysOfWeek: newDays });
  };

  const getPatternDescription = (pattern: RecurringPattern): string => {
    switch (pattern.type) {
      case 'daily':
        return `Every ${pattern.interval === 1 ? 'day' : `${pattern.interval} days`}`;
      case 'weekly':
        const days = pattern.daysOfWeek?.map((d) => DAYS_OF_WEEK[d].label).join(', ') || 'No days';
        return `Every ${pattern.interval === 1 ? 'week' : `${pattern.interval} weeks`} on ${days}`;
      case 'monthly':
        return `Every ${pattern.interval === 1 ? 'month' : `${pattern.interval} months`} on day ${pattern.dayOfMonth}`;
      default:
        return pattern.description;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Recurring Patterns</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and apply recurring event patterns
          </p>
        </div>
        <Button onClick={() => setIsCreating(!isCreating)} variant={isCreating ? "outline" : "default"}>
          {isCreating ? (
            <>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" />
              New Pattern
            </>
          )}
        </Button>
      </div>

      {/* Pattern Stats */}
      <Card className="bg-gradient-to-r   dark:from-purple-950 dark:to-blue-950 border-purple-100 dark:border-purple-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Repeat className="h-5 w-5" />
            Detected Patterns
          </CardTitle>
          <CardDescription>
            AI-detected recurring patterns in your calendar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {patternStats?.totalPatterns || 0}
              </div>
              <div className="text-sm text-muted-foreground">Total Patterns</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {patternStats?.weeklyPatterns || 0}
              </div>
              <div className="text-sm text-muted-foreground">Weekly</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {patternStats?.monthlyPatterns || 0}
              </div>
              <div className="text-sm text-muted-foreground">Monthly</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Pattern Form */}
      {isCreating && (
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle>Create New Pattern</CardTitle>
            <CardDescription>Define a recurring pattern for your events</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="pattern-name">Pattern Name</Label>
              <Input
                id="pattern-name"
                placeholder="e.g., Daily Standup"
                value={newPattern.name}
                onChange={(e) => setNewPattern({ ...newPattern, name: e.target.value })}
              />
            </div>

            <div>
              <Label htmlFor="pattern-type">Pattern Type</Label>
              <Select
                value={newPattern.type}
                onValueChange={(value) => setNewPattern({ ...newPattern, type: value as any })}
              >
                <SelectTrigger id="pattern-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="pattern-interval">Repeat Every</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="pattern-interval"
                  type="number"
                  min="1"
                  value={newPattern.interval}
                  onChange={(e) => setNewPattern({ ...newPattern, interval: parseInt(e.target.value) })}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">
                  {newPattern.type === 'daily' && 'days'}
                  {newPattern.type === 'weekly' && 'weeks'}
                  {newPattern.type === 'monthly' && 'months'}
                </span>
              </div>
            </div>

            {newPattern.type === 'weekly' && (
              <div>
                <Label>Days of Week</Label>
                <div className="flex gap-2 mt-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <Button
                      key={day.value}
                      variant={newPattern.daysOfWeek?.includes(day.value) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleToggleDay(day.value)}
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {newPattern.type === 'monthly' && (
              <div>
                <Label htmlFor="day-of-month">Day of Month</Label>
                <Input
                  id="day-of-month"
                  type="number"
                  min="1"
                  max="31"
                  value={newPattern.dayOfMonth || ''}
                  onChange={(e) => setNewPattern({ ...newPattern, dayOfMonth: parseInt(e.target.value) })}
                />
              </div>
            )}

            <div>
              <Label htmlFor="pattern-description">Description (Optional)</Label>
              <Input
                id="pattern-description"
                placeholder="Add a description"
                value={newPattern.description}
                onChange={(e) => setNewPattern({ ...newPattern, description: e.target.value })}
              />
            </div>

            <Button onClick={handleCreatePattern} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Create Pattern
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pattern List */}
      <div className="space-y-3">
        {patterns.map((pattern) => (
          <Card key={pattern.id} className="hover:border-primary/50 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-semibold">{pattern.name}</h3>
                    <Badge variant={pattern.type === 'daily' ? 'default' : pattern.type === 'weekly' ? 'secondary' : 'outline'}>
                      {pattern.type}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {getPatternDescription(pattern)}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Applied to {pattern.eventCount} events</span>
                    {pattern.lastApplied && (
                      <span>Last applied: {pattern.lastApplied}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={() => handleApplyPattern(pattern)}
                  >
                    <PlayCircle className="h-4 w-4 mr-1" />
                    Apply
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeletePattern(pattern.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {patterns.length === 0 && !isCreating && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Repeat className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-2">No patterns yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first recurring pattern to get started
            </p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Pattern
            </Button>
          </CardContent>
        </Card>
      )}
      
      {/* Apply Pattern Dialog */}
      <Dialog open={applyDialogOpen} onOpenChange={setApplyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apply Pattern: {selectedPattern?.name}</DialogTitle>
            <DialogDescription>
              Create recurring events based on this pattern
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="event-title">Event Title</Label>
              <Input
                id="event-title"
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder="Enter event title"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="event-time">Time</Label>
                <Input
                  id="event-time"
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="15"
                  step="15"
                  value={eventDuration}
                  onChange={(e) => setEventDuration(parseInt(e.target.value))}
                />
              </div>
            </div>
            
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm text-muted-foreground">
                {selectedPattern && (
                  <>This will create events {getPatternDescription(selectedPattern).toLowerCase()} from {dayjs(startDate).format('MMM D')} to {dayjs(endDate).format('MMM D, YYYY')}</>
                )}
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applyPattern}>
              <Calendar className="h-4 w-4 mr-2" />
              Create Events
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
