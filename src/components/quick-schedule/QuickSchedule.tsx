// QuickSchedule Component - Mobile-First Design
import { useState, useEffect } from 'react';
import { Calendar, Clock, Plus, Zap, Trash2, ChevronLeft, ChevronRight, LayoutTemplate, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTemplates } from '@/hooks/use-templates';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { findFreeTimeBlocks } from '@/lib/algorithms/time-blocks';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { EventTemplate } from '@/types/template';
import type { CalendarEventType } from '@/lib/stores/types';
import { toast } from 'sonner';
import MobileNavigation from '@/components/MobileNavigation';
import { cn } from '@/lib/utils';

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
  const { favoriteTemplates, mostUsedTemplates, useTemplate } = useTemplates();
  const { events, addEvent } = useCalendarEvents();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [quickEvents, setQuickEvents] = useState<QuickEvent[]>([]);
  const [isScheduling, setIsScheduling] = useState(false);
  const [suggestedSlots, setSuggestedSlots] = useState<Date[]>([]);

  const displayTemplates = favoriteTemplates.length > 0 
    ? favoriteTemplates 
    : mostUsedTemplates;

  // Find available time slots
  useEffect(() => {
    const dateStr = dayjs(selectedDate).format('YYYY-MM-DD');
    const analysis = findFreeTimeBlocks(dateStr, events);
    
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
    toast.success(`Added "${template.name}"`);
  };

  const addCustomEvent = () => {
    const quickEvent: QuickEvent = {
      id: `quick-${Date.now()}-${Math.random()}`,
      title: 'New Event',
      duration: 60,
      color: '#8b5cf6',
      category: 'work',
    };
    setQuickEvents([...quickEvents, quickEvent]);
  };

  const removeFromQueue = (id: string) => {
    setQuickEvents(quickEvents.filter(e => e.id !== id));
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
        
        if (quickEvent.templateId) {
          await useTemplate(quickEvent.templateId);
        }

        currentTime = dayjs(endTime).add(15, 'minutes').toDate();
        successCount++;
      }

      toast.success(`Scheduled ${successCount} events!`);
      setQuickEvents([]);
    } catch (error) {
      console.error('Error scheduling events:', error);
      toast.error('Failed to schedule some events');
    } finally {
      setIsScheduling(false);
    }
  };

  // Date Navigation
  const goToPrevDay = () => setSelectedDate(dayjs(selectedDate).subtract(1, 'day').toDate());
  const goToNextDay = () => setSelectedDate(dayjs(selectedDate).add(1, 'day').toDate());
  const goToToday = () => setSelectedDate(new Date());

  const isToday = dayjs(selectedDate).isSame(dayjs(), 'day');

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4 pt-6 max-w-lg mx-auto space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="hidden md:flex w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 items-center justify-center transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">Quick Schedule</h1>
              <p className="text-sm text-muted-foreground">Batch schedule events</p>
            </div>
          </div>
        </div>

        {/* Date Selector */}
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={goToPrevDay}
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          
          <div className="flex-1 py-3 px-4 rounded-2xl bg-white/5 border border-white/10 text-center">
            <p className="font-semibold">{dayjs(selectedDate).format('dddd')}</p>
            <p className="text-xs text-muted-foreground">{dayjs(selectedDate).format('MMMM D, YYYY')}</p>
          </div>
          
          <button
            onClick={goToNextDay}
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          
          <button
            onClick={goToToday}
            className={cn(
              "px-4 h-10 rounded-xl font-medium text-sm transition-colors",
              isToday 
                ? "bg-primary/20 text-primary border border-primary/30" 
                : "bg-white/5 hover:bg-white/10 border border-white/10"
            )}
          >
            Today
          </button>
        </div>

        {/* Templates Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium">Quick Add from Templates</p>
            </div>
          </div>
          
          {displayTemplates.length === 0 ? (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-primary/10 via-purple-600/5 to-transparent border border-primary/20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
                <LayoutTemplate className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-semibold mb-1">Create Your First Template</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Save time with reusable event templates
              </p>
              
              {/* Benefits */}
              <div className="space-y-2 mb-4 text-left">
                {[
                  { num: '1', text: 'Quick Batch Scheduling', sub: 'Schedule multiple events instantly' },
                  { num: '2', text: 'Consistent Routines', sub: 'Maintain your productivity patterns' },
                  { num: '3', text: 'Save Time', sub: 'Never recreate the same event twice' },
                ].map((item) => (
                  <div key={item.num} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold text-xs">{item.num}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.text}</p>
                      <p className="text-[10px] text-muted-foreground">{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              <button
                onClick={() => navigate('/templates')}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium transition-all active:scale-[0.98]"
              >
                Create Template
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {displayTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => addTemplateToQueue(template)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 transition-all hover:bg-white/10 active:scale-[0.98]"
                >
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: template.color + '30' }}
                  >
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: template.color }}
                    />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-medium text-sm">{template.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {template.duration}m · {template.category}
                    </p>
                  </div>
                  <Plus className="h-5 w-5 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Add Custom Event Button */}
        <button
          onClick={addCustomEvent}
          className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-white/20 text-muted-foreground hover:bg-white/5 hover:border-white/30 transition-all"
        >
          <Plus className="h-5 w-5" />
          <span className="font-medium">Add Custom Event</span>
        </button>

        {/* Queue Section */}
        {quickEvents.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <p className="text-sm font-medium">Schedule Queue</p>
                <Badge variant="secondary" className="text-xs">{quickEvents.length}</Badge>
              </div>
            </div>
            
            <div className="space-y-2">
              {quickEvents.map((event, idx) => (
                <div key={event.id} className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3">
                  {/* Event Header */}
                  <div className="flex items-start gap-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: event.color + '30' }}
                    >
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: event.color }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={event.title}
                        onChange={(e) => {
                          setQuickEvents(quickEvents.map(qe =>
                            qe.id === event.id ? { ...qe, title: e.target.value } : qe
                          ));
                        }}
                        className="w-full font-medium text-sm bg-transparent border-none outline-none"
                      />
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px] h-5 px-2 bg-white/5">
                          {event.duration}m
                        </Badge>
                        <Badge variant="outline" className="text-[10px] h-5 px-2 bg-white/5">
                          {event.category}
                        </Badge>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromQueue(event.id)}
                      className="w-8 h-8 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center transition-colors group"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-red-400" />
                    </button>
                  </div>

                  {/* Time Slots */}
                  <div className="pt-3 border-t border-white/10">
                    <p className="text-xs text-muted-foreground mb-2">Select time:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {suggestedSlots.slice(0, 4).map((slot, slotIdx) => {
                        const isSelected = event.suggestedTime?.getTime() === slot.getTime();
                        const endTime = dayjs(slot).add(event.duration, 'minutes');
                        
                        return (
                          <button
                            key={slotIdx}
                            onClick={() => updateEventTime(event.id, slot)}
                            className={cn(
                              "p-3 rounded-xl text-left transition-all",
                              isSelected 
                                ? "bg-primary/20 border-2 border-primary" 
                                : "bg-white/5 border border-white/10 hover:bg-white/10"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">{dayjs(slot).format('h:mm A')}</p>
                                <p className="text-[10px] text-muted-foreground">to {endTime.format('h:mm A')}</p>
                              </div>
                              {isSelected && (
                                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                  <Check className="h-3 w-3 text-white" />
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Schedule All Button */}
            <button
              onClick={scheduleAll}
              disabled={isScheduling}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-purple-600 text-white font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {isScheduling ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Scheduling...
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5" />
                  Schedule All ({quickEvents.length})
                </>
              )}
            </button>
          </div>
        )}
      </div>
      
      <MobileNavigation />
    </div>
  );
}
