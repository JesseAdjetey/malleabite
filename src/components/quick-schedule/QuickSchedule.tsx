import { useState, useEffect } from 'react';
import { Calendar, Clock, Plus, Zap, Trash2, Copy, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useTemplates } from '@/hooks/use-templates';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { findFreeTimeBlocks } from '@/lib/algorithms/time-blocks';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { EventTemplate } from '@/types/template';
import type { CalendarEventType } from '@/lib/stores/types';
import { toast } from 'sonner';
import { AutoScheduleButton } from '@/components/calendar/AutoScheduleButton';

interface QuickEvent {
  id: string;
  templateId?: string;
  title: string;
  duration: number;
  color: string;
  category: string;
  location?: string;
  notes?: string;
  suggestedTime?: Date;
}

export function QuickSchedule() {
  const { favoriteTemplates, mostUsedTemplates, applyTemplate, useTemplate } = useTemplates();
  const { events, addEvent } = useCalendarEvents();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [quickEvents, setQuickEvents] = useState<QuickEvent[]>([]);
  const [isScheduling, setIsScheduling] = useState(false);
  const [suggestedSlots, setSuggestedSlots] = useState<Date[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [viewMonth, setViewMonth] = useState(dayjs());

  const displayTemplates = favoriteTemplates.length > 0 
    ? favoriteTemplates 
    : mostUsedTemplates;

  // Find available time slots when date or events change
  useEffect(() => {
    const dateStr = dayjs(selectedDate).format('YYYY-MM-DD');
    const analysis = findFreeTimeBlocks(dateStr, events);
    
    // Extract start times from high/medium quality blocks
    const goodSlots = analysis.freeBlocks
      .filter(block => block.quality === 'high' || block.quality === 'medium')
      .slice(0, 8)
      .map(block => new Date(block.start));
    
    setSuggestedSlots(goodSlots);
  }, [selectedDate, events]);

  const addTemplateToQueue = (template: EventTemplate) => {
    const quickEvent: QuickEvent = {
      id: `quick-${Date.now()}-${Math.random()}`,
      templateId: template.id,
      title: template.title,
      duration: template.duration,
      color: template.color,
      category: template.category,
      location: template.location,
      notes: template.notes,
    };

    setQuickEvents([...quickEvents, quickEvent]);
    toast.success(`Added "${template.name}" to queue`);
  };

  const addCustomEvent = () => {
    const quickEvent: QuickEvent = {
      id: `quick-${Date.now()}-${Math.random()}`,
      title: 'New Event',
      duration: 60,
      color: '#3b82f6',
      category: 'work',
    };

    setQuickEvents([...quickEvents, quickEvent]);
  };

  const removeFromQueue = (id: string) => {
    setQuickEvents(quickEvents.filter(e => e.id !== id));
  };

  const duplicateEvent = (event: QuickEvent) => {
    const duplicate: QuickEvent = {
      ...event,
      id: `quick-${Date.now()}-${Math.random()}`,
    };
    setQuickEvents([...quickEvents, duplicate]);
    toast.success('Event duplicated');
  };

  const updateEventTime = (id: string, suggestedTime: Date) => {
    setQuickEvents(quickEvents.map(e => 
      e.id === id ? { ...e, suggestedTime } : e
    ));
  };

  const scheduleAll = async () => {
    if (quickEvents.length === 0) {
      toast.error('No events to schedule');
      return;
    }

    setIsScheduling(true);

    try {
      let currentTime = suggestedSlots[0] || dayjs(selectedDate).hour(9).minute(0).toDate();
      let successCount = 0;

      for (const quickEvent of quickEvents) {
        const startTime = quickEvent.suggestedTime || currentTime;
        const endTime = dayjs(startTime).add(quickEvent.duration, 'minutes').toDate();

        const newEvent: Partial<CalendarEventType> = {
          title: quickEvent.title,
          startsAt: startTime.toISOString(),
          endsAt: endTime.toISOString(),
          description: quickEvent.notes || '',
          color: quickEvent.color,
          isLocked: false,
        };

        await addEvent(newEvent as CalendarEventType);
        
        // Track template usage
        if (quickEvent.templateId) {
          await useTemplate(quickEvent.templateId);
        }

        // Move to next slot (add 15 min buffer)
        currentTime = dayjs(endTime).add(15, 'minutes').toDate();
        successCount++;
      }

      toast.success(`Successfully scheduled ${successCount} events!`);
      setQuickEvents([]);
    } catch (error) {
      console.error('Error scheduling events:', error);
      toast.error('Failed to schedule some events');
    } finally {
      setIsScheduling(false);
    }
  };

  const TimeSlotPicker = ({ event }: { event: QuickEvent }) => {
    return (
      <div className="grid grid-cols-2 gap-2 mt-2">
        {suggestedSlots.slice(0, 4).map((slot, idx) => {
          const isSelected = event.suggestedTime?.getTime() === slot.getTime();
          const slotEndTime = dayjs(slot).add(event.duration, 'minutes');
          
          return (
            <button
              key={idx}
              onClick={() => updateEventTime(event.id, slot)}
              className={`
                relative p-3 rounded-lg border-2 transition-all duration-200
                ${isSelected 
                  ? 'border-purple-500 bg-purple-500/10 dark:bg-purple-500/20 shadow-md' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-700 dark:hover:border-purple-600 hover:bg-purple-700 dark:hover:bg-purple-950/30'
                }
              `}
            >
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <Clock className="h-3.5 w-3.5 text-purple-500" />
                  <span className={`text-sm font-semibold ${isSelected ? 'text-purple-600 dark:text-purple-400' : ''}`}>
                    {dayjs(slot).format('h:mm A')}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  to {slotEndTime.format('h:mm A')}
                </span>
              </div>
              {isSelected && (
                <div className="absolute -top-1 -right-1 bg-purple-500 rounded-full p-0.5">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  const CalendarPicker = () => {
    const daysInMonth = viewMonth.daysInMonth();
    const firstDayOfMonth = viewMonth.startOf('month').day();
    const today = dayjs();
    
    const days = [];
    // Previous month's days
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    // Current month's days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(i);
    }

    return (
      <Card className="absolute top-full mt-2 right-0 z-50 p-4 w-80 shadow-xl bg-background/95 backdrop-blur-xl border-2">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMonth(viewMonth.subtract(1, 'month'))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="font-semibold">
            {viewMonth.format('MMMM YYYY')}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setViewMonth(viewMonth.add(1, 'month'))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, idx) => {
            if (!day) {
              return <div key={`empty-${idx}`} />;
            }

            const date = viewMonth.date(day);
            const isSelected = date.isSame(dayjs(selectedDate), 'day');
            const isToday = date.isSame(today, 'day');
            const isPast = date.isBefore(today, 'day');

            return (
              <button
                key={day}
                onClick={() => {
                  setSelectedDate(date.toDate());
                  setShowCalendar(false);
                }}
                className={`
                  aspect-square rounded-lg text-sm font-medium transition-all
                  ${isSelected 
                    ? 'bg-purple-500 text-white shadow-md' 
                    : isToday
                    ? 'bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 border-2 border-purple-500'
                    : isPast
                    ? 'text-muted-foreground hover:bg-accent'
                    : 'hover:bg-accent'
                  }
                `}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mt-4 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => {
              setSelectedDate(new Date());
              setViewMonth(dayjs());
              setShowCalendar(false);
            }}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => setShowCalendar(false)}
          >
            Close
          </Button>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="mb-2 hover:bg-accent"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="h-6 w-6 text-yellow-500" />
            Quick Schedule
          </h2>
          <p className="text-muted-foreground">
            Batch schedule multiple events at once
          </p>
        </div>
        
        {/* Enhanced Date Picker */}
        <div className="relative flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedDate(dayjs(selectedDate).subtract(1, 'day').toDate())}
            className="border-2 hover:border-purple-300 dark:hover:border-purple-600 h-10 w-10"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className="relative"
          >
            <Card className="px-4 py-2.5 min-w-[200px] cursor-pointer hover:border-purple-300 dark:hover:border-purple-600 transition-colors">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-purple-500" />
                <div className="flex-1">
                  <div className="text-sm font-semibold">
                    {dayjs(selectedDate).format('dddd')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {dayjs(selectedDate).format('MMMM D, YYYY')}
                  </div>
                </div>
              </div>
            </Card>
          </button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSelectedDate(dayjs(selectedDate).add(1, 'day').toDate())}
            className="border-2 hover:border-purple-300 dark:hover:border-purple-600 h-10 w-10"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setSelectedDate(new Date())}
            className="border-2 hover:border-purple-300 dark:hover:border-purple-600 font-medium"
          >
            Today
          </Button>

          {/* Calendar Dropdown */}
          {showCalendar && <CalendarPicker />}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Template Library */}
        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Quick Add from Templates
          </h3>
          
          {displayTemplates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No templates yet</p>
              <Button 
                variant="link" 
                onClick={() => window.open('/templates', '_blank')}
              >
                Create your first template →
              </Button>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {displayTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => addTemplateToQueue(template)}
                  className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: template.color }}
                      />
                      <div>
                        <p className="font-medium text-sm">{template.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {template.duration} min · {template.category}
                        </p>
                      </div>
                    </div>
                    <Plus className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          )}

          <Button
            variant="outline"
            className="w-full mt-4"
            onClick={addCustomEvent}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Custom Event
          </Button>
        </Card>

        {/* Right: Schedule Queue */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Schedule Queue ({quickEvents.length})
            </h3>
            {quickEvents.length > 0 && (
              <Button
                onClick={scheduleAll}
                disabled={isScheduling}
                className="bg-gradient-to-r from-purple-500 to-blue-500"
              >
                <Zap className="h-4 w-4 mr-2" />
                Schedule All
              </Button>
            )}
          </div>

          {quickEvents.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Zap className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>Add events to get started</p>
              <p className="text-sm mt-1">
                Click templates or add custom events
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {quickEvents.map((event, idx) => (
                <Card key={event.id} className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full mt-1"
                          style={{ backgroundColor: event.color }}
                        />
                        <div>
                          <input
                            type="text"
                            value={event.title}
                            onChange={(e) => {
                              setQuickEvents(quickEvents.map(qe =>
                                qe.id === event.id ? { ...qe, title: e.target.value } : qe
                              ));
                            }}
                            className="font-medium bg-transparent border-none outline-none"
                          />
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {event.duration} min
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {event.category}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <AutoScheduleButton
                          task={{
                            title: event.title,
                            duration: event.duration,
                            priority: 'medium',
                            type: event.category === 'work' ? 'focus' : 'routine',
                          }}
                          onSchedule={(startTime, endTime, date) => {
                            updateEventTime(event.id, new Date(startTime));
                            toast.success('Auto-scheduled!', {
                              description: `${event.title} at ${dayjs(startTime).format('h:mm A')}`,
                            });
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => duplicateEvent(event)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFromQueue(event.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Time Slot Picker */}
                    <div className="pt-2 border-t dark:border-gray-800">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          ⏰ Select time slot:
                        </p>
                        {!event.suggestedTime && (
                          <Badge variant="secondary" className="text-xs">
                            Auto: {dayjs(suggestedSlots[idx] || new Date()).format('h:mm A')}
                          </Badge>
                        )}
                      </div>
                      <TimeSlotPicker event={event} />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Suggested Time Slots */}
          {suggestedSlots.length > 0 && quickEvents.length > 0 && (
            <div className="mt-4 p-3  dark:bg-blue-950 rounded-lg">
              <p className="text-sm font-medium mb-2">
                📍 Available slots on {dayjs(selectedDate).format('MMM D')}:
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestedSlots.slice(0, 6).map((slot, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {dayjs(slot).format('h:mm A')}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Instructions */}
      <Card className="p-4 bg-gradient-to-r  dark:from-purple-950 dark:to-blue-950">
        <h4 className="font-semibold text-sm mb-2">💡 How to use Quick Schedule:</h4>
        <ol className="text-sm space-y-1 text-muted-foreground list-decimal list-inside">
          <li>Select a date above</li>
          <li>Click templates to add them to the queue</li>
          <li>Customize event titles and times as needed</li>
          <li>Click "Schedule All" to batch create all events</li>
          <li>Events will be placed in suggested time slots automatically</li>
        </ol>
      </Card>
    </div>
  );
}
