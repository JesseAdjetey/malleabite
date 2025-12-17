// Find a Time Dialog - UI for finding available meeting times
import React, { useState, useCallback, useMemo } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Clock, Users, ChevronLeft, ChevronRight, Check, X, Star } from 'lucide-react';
import { useFindTime, Attendee, TimeSlot, FindTimeOptions, FindTimeResult } from '@/hooks/use-find-time';
import dayjs from 'dayjs';
import { cn } from '@/lib/utils';

interface FindTimeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectTime: (start: string, end: string) => void;
  initialAttendees?: string[];
  initialDuration?: number;
}

export function FindTimeDialog({
  open,
  onOpenChange,
  onSelectTime,
  initialAttendees = [],
  initialDuration = 60,
}: FindTimeDialogProps) {
  const [attendeeEmails, setAttendeeEmails] = useState<string[]>(initialAttendees);
  const [newEmail, setNewEmail] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(initialDuration);
  const [currentWeek, setCurrentWeek] = useState(dayjs().startOf('week'));
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Build attendees array for the hook (in real app, would fetch their events from server)
  const attendees: Attendee[] = useMemo(() => {
    return attendeeEmails.map((email, index) => ({
      id: `attendee-${index}`,
      email,
      displayName: email.split('@')[0],
      events: [], // In production, fetch actual events from backend
    }));
  }, [attendeeEmails]);

  const { findAvailableTimes, loading, results } = useFindTime(attendees);

  // Add attendee
  const addAttendee = useCallback(() => {
    const email = newEmail.trim().toLowerCase();
    if (email && !attendeeEmails.includes(email) && email.includes('@')) {
      setAttendeeEmails(prev => [...prev, email]);
      setNewEmail('');
    }
  }, [newEmail, attendeeEmails]);

  // Remove attendee
  const removeAttendee = useCallback((email: string) => {
    setAttendeeEmails(prev => prev.filter(e => e !== email));
  }, []);

  // Find times
  const handleFindTimes = useCallback(async () => {
    if (attendeeEmails.length === 0) return;

    const options: FindTimeOptions = {
      duration: durationMinutes,
      startDate: currentWeek.toDate(),
      endDate: currentWeek.add(7, 'day').toDate(),
      excludeWeekends: true,
    };

    const findResults = await findAvailableTimes(options);
    // Flatten all slots from all days
    const allSlots = findResults.flatMap(r => r.slots.filter(s => s.available));
    setAvailableSlots(allSlots);
    setHasSearched(true);
    setSelectedSlot(null);
  }, [attendeeEmails, durationMinutes, currentWeek, findAvailableTimes]);

  // Navigate weeks
  const goToPreviousWeek = () => setCurrentWeek(prev => prev.subtract(1, 'week'));
  const goToNextWeek = () => setCurrentWeek(prev => prev.add(1, 'week'));

  // Group slots by day
  const slotsByDay = useMemo(() => {
    const grouped = new Map<string, TimeSlot[]>();
    
    for (let i = 0; i < 7; i++) {
      const day = currentWeek.add(i, 'day');
      grouped.set(day.format('YYYY-MM-DD'), []);
    }
    
    availableSlots.forEach(slot => {
      const dayKey = dayjs(slot.start).format('YYYY-MM-DD');
      if (grouped.has(dayKey)) {
        grouped.get(dayKey)!.push(slot);
      }
    });
    
    return grouped;
  }, [availableSlots, currentWeek]);

  // Handle confirm
  const handleConfirm = () => {
    if (selectedSlot) {
      onSelectTime(selectedSlot.start.toISOString(), selectedSlot.end.toISOString());
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Find a Time
          </DialogTitle>
          <DialogDescription>
            Find available time slots that work for all attendees
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden grid grid-cols-[300px,1fr] gap-4">
          {/* Left Panel - Settings */}
          <div className="space-y-4 pr-4 border-r">
            {/* Attendees */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Attendees
              </Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="Add email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addAttendee();
                    }
                  }}
                />
                <Button size="sm" onClick={addAttendee}>Add</Button>
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {attendeeEmails.map(email => (
                  <Badge key={email} variant="secondary" className="flex items-center gap-1">
                    {email}
                    <button
                      onClick={() => removeAttendee(email)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label>Duration: {durationMinutes} minutes</Label>
              <Slider
                value={[durationMinutes]}
                onValueChange={([value]) => setDurationMinutes(value)}
                min={15}
                max={180}
                step={15}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>15 min</span>
                <span>3 hours</span>
              </div>
            </div>

            {/* Quick duration buttons */}
            <div className="flex flex-wrap gap-2">
              {[15, 30, 45, 60, 90, 120].map(mins => (
                <Button
                  key={mins}
                  size="sm"
                  variant={durationMinutes === mins ? 'default' : 'outline'}
                  onClick={() => setDurationMinutes(mins)}
                >
                  {mins < 60 ? `${mins}m` : `${mins / 60}h`}
                </Button>
              ))}
            </div>

            {/* Find Button */}
            <Button
              className="w-full"
              onClick={handleFindTimes}
              disabled={attendeeEmails.length === 0 || loading}
            >
              {loading ? 'Searching...' : 'Find Available Times'}
            </Button>
          </div>

          {/* Right Panel - Calendar Grid */}
          <div className="flex flex-col min-h-0">
            {/* Week Navigation */}
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="icon" onClick={goToPreviousWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="font-medium">
                {currentWeek.format('MMM D')} - {currentWeek.add(6, 'day').format('MMM D, YYYY')}
              </span>
              <Button variant="ghost" size="icon" onClick={goToNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Days Grid */}
            <ScrollArea className="flex-1">
              <div className="grid grid-cols-7 gap-2">
                {/* Day Headers */}
                {Array.from({ length: 7 }).map((_, i) => {
                  const day = currentWeek.add(i, 'day');
                  const isToday = day.isSame(dayjs(), 'day');
                  return (
                    <div
                      key={i}
                      className={cn(
                        'text-center p-2 text-sm font-medium',
                        isToday && 'bg-primary/10 rounded-t-lg'
                      )}
                    >
                      <div>{day.format('ddd')}</div>
                      <div className={cn(
                        'text-lg',
                        isToday && 'bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center mx-auto'
                      )}>
                        {day.format('D')}
                      </div>
                    </div>
                  );
                })}

                {/* Time Slots */}
                {Array.from({ length: 7 }).map((_, i) => {
                  const day = currentWeek.add(i, 'day');
                  const dayKey = day.format('YYYY-MM-DD');
                  const slots = slotsByDay.get(dayKey) || [];
                  
                  return (
                    <div key={dayKey} className="space-y-1 min-h-[200px]">
                      {hasSearched && slots.length === 0 && (
                        <div className="text-xs text-muted-foreground text-center py-4">
                          No times
                        </div>
                      )}
                      {slots.map((slot, idx) => {
                        const isSelected = selectedSlot?.start.getTime() === slot.start.getTime();
                        const isBest = slot.score === Math.max(...slots.map(s => s.score));
                        
                        return (
                          <button
                            key={idx}
                            onClick={() => setSelectedSlot(slot)}
                            className={cn(
                              'w-full p-2 text-xs rounded-md border transition-colors',
                              'hover:bg-accent hover:border-primary',
                              isSelected && 'bg-primary text-primary-foreground border-primary',
                              !isSelected && isBest && 'border-green-500 bg-green-50 dark:bg-green-950'
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span>{dayjs(slot.start).format('h:mm A')}</span>
                              {isBest && <Star className="h-3 w-3 text-green-600" />}
                            </div>
                            <div className="text-[10px] opacity-70">
                              {dayjs(slot.end).format('h:mm A')}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Legend */}
            {hasSearched && (
              <div className="flex items-center gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded border border-green-500 bg-green-50" />
                  <span>Best time</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded bg-primary" />
                  <span>Selected</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedSlot}>
            {selectedSlot ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Use {dayjs(selectedSlot.start).format('ddd, MMM D [at] h:mm A')}
              </>
            ) : (
              'Select a time'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FindTimeDialog;
