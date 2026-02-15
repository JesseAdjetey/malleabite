// QuickSchedule Component - Mobile-First Design
import { useState, useEffect } from 'react';
import { Calendar, Clock, Plus, Zap, Trash2, ChevronLeft, ChevronRight, LayoutTemplate, Check, Sparkles, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useTemplates } from '@/hooks/use-templates';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { findFreeTimeBlocks } from '@/lib/algorithms/time-blocks';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import type { EventTemplate } from '@/types/template';
import type { CalendarEventType } from '@/lib/stores/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { motion } from 'framer-motion';
import { springs } from '@/lib/animations';

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
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={springs.page}
      className="min-h-screen bg-background pb-24"
    >
      <div className="px-5 pt-6 max-w-lg mx-auto space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-large-title font-bold">Quick Schedule</h1>
          <p className="text-subheadline text-muted-foreground">Add multiple events at once</p>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => { haptics.selection(); goToPrevDay(); }}
            className="w-11 h-11 rounded-xl bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors active:scale-95"
          >
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </button>

          <div className="flex-1 py-3 px-4 rounded-2xl bg-card border border-border/50 text-center">
            <p className="text-subheadline font-semibold">{dayjs(selectedDate).format('dddd')}</p>
            <p className="text-caption1 text-muted-foreground">{dayjs(selectedDate).format('MMMM D, YYYY')}</p>
          </div>

          <button
            onClick={() => { haptics.selection(); goToNextDay(); }}
            className="w-11 h-11 rounded-xl bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors active:scale-95"
          >
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>

          <button
            onClick={() => { haptics.light(); goToToday(); }}
            className={cn(
              "px-4 h-11 rounded-xl font-medium text-subheadline transition-colors active:scale-95",
              isToday
                ? "bg-primary/10 text-primary"
                : "bg-muted/60 hover:bg-muted text-foreground"
            )}
          >
            Today
          </button>
        </div>

        {/* How it works */}
        {quickEvents.length === 0 && (
          <div className="p-4 rounded-2xl bg-card border border-border/50">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="text-subheadline font-semibold mb-1">How Quick Schedule Works</h3>
                <p className="text-caption1 text-muted-foreground leading-relaxed">
                  Add multiple events to a queue, pick times for each, then schedule them all at once! Perfect for planning your entire day in seconds.
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border/40">
              <div className="flex items-center justify-between text-caption2">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-primary">1</span>
                  </div>
                  <span className="text-muted-foreground">Add events</span>
                </div>
                <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-primary">2</span>
                  </div>
                  <span className="text-muted-foreground">Choose times</span>
                </div>
                <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-primary">3</span>
                  </div>
                  <span className="text-muted-foreground">Schedule all!</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Templates Section */}
        <div className="space-y-2">
          <p className="text-caption1 font-medium text-muted-foreground uppercase tracking-wider px-1">
            Quick Add from Templates
          </p>

          {displayTemplates.length === 0 ? (
            <div className="p-6 rounded-2xl bg-card border border-border/50 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <LayoutTemplate className="h-7 w-7 text-primary" />
              </div>
              <h3 className="text-headline font-semibold mb-1">Create Your First Template</h3>
              <p className="text-caption1 text-muted-foreground mb-4">
                Save time with reusable event templates
              </p>

              <div className="rounded-2xl bg-muted/40 border border-border/50 overflow-hidden divide-y divide-border/40 mb-4 text-left">
                {[
                  { num: '1', text: 'Quick Batch Scheduling', sub: 'Schedule multiple events instantly' },
                  { num: '2', text: 'Consistent Routines', sub: 'Maintain your productivity patterns' },
                  { num: '3', text: 'Save Time', sub: 'Never recreate the same event twice' },
                ].map((item) => (
                  <div key={item.num} className="flex items-center gap-3 p-3">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-bold text-caption1">{item.num}</span>
                    </div>
                    <div>
                      <p className="text-subheadline font-medium">{item.text}</p>
                      <p className="text-caption2 text-muted-foreground">{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => { haptics.light(); navigate('/templates'); }}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-[0.97]"
              >
                Create Template
              </button>
            </div>
          ) : (
            <div className="rounded-2xl bg-card border border-border/50 overflow-hidden divide-y divide-border/40">
              {displayTemplates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => { haptics.light(); addTemplateToQueue(template); }}
                  className="w-full flex items-center gap-3 p-3.5 transition-colors hover:bg-muted/40 active:bg-muted/60"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: template.color + '18' }}
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: template.color }}
                    />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-subheadline font-medium truncate">{template.name}</p>
                    <p className="text-caption1 text-muted-foreground">
                      {template.duration}m · {template.category}
                    </p>
                  </div>
                  <Plus className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Add Custom Event Button */}
        <button
          onClick={() => { haptics.light(); addCustomEvent(); }}
          className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-border text-muted-foreground hover:bg-muted/40 transition-all active:scale-[0.97]"
        >
          <Plus className="h-5 w-5" />
          <span className="font-medium text-subheadline">Add Custom Event</span>
        </button>

        {/* Queue Section */}
        {quickEvents.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Clock className="h-4 w-4 text-primary" />
              <p className="text-caption1 font-medium text-muted-foreground uppercase tracking-wider">Schedule Queue</p>
              <Badge variant="secondary" className="text-caption2 ml-1">{quickEvents.length}</Badge>
            </div>

            <div className="space-y-3">
              {quickEvents.map((event) => (
                <div key={event.id} className="p-4 rounded-2xl bg-card border border-border/50 space-y-3">
                  {/* Event Header */}
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: event.color + '18' }}
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
                        className="w-full font-medium text-subheadline bg-transparent border-none outline-none"
                      />
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-caption2 h-5 px-2">
                          {event.duration}m
                        </Badge>
                        <Badge variant="outline" className="text-caption2 h-5 px-2">
                          {event.category}
                        </Badge>
                      </div>
                    </div>
                    <button
                      onClick={() => { haptics.light(); removeFromQueue(event.id); }}
                      className="w-9 h-9 rounded-lg bg-muted/60 hover:bg-destructive/10 flex items-center justify-center transition-colors group active:scale-95"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-destructive" />
                    </button>
                  </div>

                  {/* Time Slots */}
                  <div className="pt-3 border-t border-border/40">
                    <p className="text-caption1 text-muted-foreground mb-2">Select time:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {suggestedSlots.slice(0, 4).map((slot, slotIdx) => {
                        const isSelected = event.suggestedTime?.getTime() === slot.getTime();
                        const endTime = dayjs(slot).add(event.duration, 'minutes');

                        return (
                          <button
                            key={slotIdx}
                            onClick={() => { haptics.selection(); updateEventTime(event.id, slot); }}
                            className={cn(
                              "p-3 rounded-xl text-left transition-all active:scale-[0.97]",
                              isSelected
                                ? "bg-primary/10 border-2 border-primary"
                                : "bg-muted/40 border border-border/50 hover:bg-muted/60"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-subheadline font-medium">{dayjs(slot).format('h:mm A')}</p>
                                <p className="text-caption2 text-muted-foreground">to {endTime.format('h:mm A')}</p>
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
              onClick={() => { haptics.medium(); scheduleAll(); }}
              disabled={isScheduling}
              className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-headline flex items-center justify-center gap-2 transition-all active:scale-[0.97] disabled:opacity-50"
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
    </motion.div>
  );
}
