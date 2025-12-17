// Agenda/Schedule View - Google Calendar-style chronological event list
import React, { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import isToday from 'dayjs/plugin/isToday';
import isTomorrow from 'dayjs/plugin/isTomorrow';
import { Calendar, Clock, MapPin, Users, Video, ChevronDown, ChevronRight, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { CalendarEventType } from '@/lib/stores/types';
import { cn } from '@/lib/utils';

dayjs.extend(relativeTime);
dayjs.extend(isToday);
dayjs.extend(isTomorrow);

interface AgendaViewProps {
  events: CalendarEventType[];
  startDate?: Date;
  endDate?: Date;
  daysToShow?: number;
  onEventClick?: (event: CalendarEventType) => void;
  onDateClick?: (date: Date) => void;
  className?: string;
}

interface GroupedEvents {
  [dateKey: string]: CalendarEventType[];
}

export function AgendaView({
  events,
  startDate = new Date(),
  endDate,
  daysToShow = 30,
  onEventClick,
  onDateClick,
  className,
}: AgendaViewProps) {
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [showPastEvents, setShowPastEvents] = useState(false);

  // Calculate end date if not provided
  const effectiveEndDate = useMemo(() => {
    if (endDate) return endDate;
    return dayjs(startDate).add(daysToShow, 'day').toDate();
  }, [startDate, endDate, daysToShow]);

  // Group events by date and sort
  const groupedEvents = useMemo(() => {
    const now = dayjs();
    const start = showPastEvents 
      ? dayjs(startDate).startOf('day')
      : now.startOf('day');
    const end = dayjs(effectiveEndDate).endOf('day');

    // Filter and sort events
    const filteredEvents = events
      .filter(event => {
        const eventDate = dayjs(event.startsAt);
        return eventDate.isAfter(start) || eventDate.isSame(start, 'day');
      })
      .filter(event => {
        const eventDate = dayjs(event.startsAt);
        return eventDate.isBefore(end);
      })
      .sort((a, b) => dayjs(a.startsAt).diff(dayjs(b.startsAt)));

    // Group by date
    const grouped: GroupedEvents = {};
    filteredEvents.forEach(event => {
      const dateKey = dayjs(event.startsAt).format('YYYY-MM-DD');
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });

    return grouped;
  }, [events, startDate, effectiveEndDate, showPastEvents]);

  // Get sorted date keys
  const sortedDates = useMemo(() => {
    return Object.keys(groupedEvents).sort();
  }, [groupedEvents]);

  // Toggle date expansion
  const toggleDate = (dateKey: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  };

  // Format date header
  const formatDateHeader = (dateStr: string) => {
    const date = dayjs(dateStr);
    if (date.isToday()) return 'Today';
    if (date.isTomorrow()) return 'Tomorrow';
    return date.format('dddd, MMMM D');
  };

  // Get relative date label
  const getRelativeLabel = (dateStr: string) => {
    const date = dayjs(dateStr);
    if (date.isToday() || date.isTomorrow()) return null;
    if (date.isSame(dayjs(), 'week')) return 'This week';
    if (date.isSame(dayjs().add(1, 'week'), 'week')) return 'Next week';
    return null;
  };

  if (sortedDates.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center h-96 text-center", className)}>
        <Calendar className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <h3 className="text-lg font-medium text-foreground/70">No upcoming events</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Your schedule is clear for the next {daysToShow} days
        </p>
        {!showPastEvents && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="mt-4"
            onClick={() => setShowPastEvents(true)}
          >
            Show past events
          </Button>
        )}
      </div>
    );
  }

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="space-y-1 p-4">
        {sortedDates.map((dateKey, index) => {
          const dayEvents = groupedEvents[dateKey];
          const isExpanded = !expandedDates.has(dateKey); // Default expanded
          const relativeLabel = getRelativeLabel(dateKey);
          const date = dayjs(dateKey);

          return (
            <div key={dateKey} className="relative">
              {/* Week separator */}
              {relativeLabel && index > 0 && (
                <div className="sticky top-0 z-10 py-2 bg-background/95 backdrop-blur">
                  <span className="text-xs font-medium text-primary uppercase tracking-wider">
                    {relativeLabel}
                  </span>
                </div>
              )}

              {/* Date header */}
              <div 
                className={cn(
                  "sticky top-0 z-10 flex items-center gap-3 py-2 bg-background/95 backdrop-blur cursor-pointer hover:bg-white/5 rounded transition-colors",
                  date.isToday() && "text-primary"
                )}
                onClick={() => toggleDate(dateKey)}
              >
                <div className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  
                  <div className={cn(
                    "flex flex-col items-center justify-center w-12 h-12 rounded-lg",
                    date.isToday() 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-white/5"
                  )}>
                    <span className="text-[10px] font-medium uppercase">
                      {date.format('ddd')}
                    </span>
                    <span className="text-xl font-semibold">
                      {date.format('D')}
                    </span>
                  </div>
                </div>

                <div className="flex-1">
                  <h3 className="font-medium">{formatDateHeader(dateKey)}</h3>
                  <p className="text-xs text-muted-foreground">
                    {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Events for this date */}
              {isExpanded && (
                <div className="ml-[60px] space-y-2 py-2 border-l border-border/50 pl-4">
                  {dayEvents.map(event => (
                    <AgendaEventCard
                      key={event.id}
                      event={event}
                      onClick={() => onEventClick?.(event)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

// Individual event card in agenda view
interface AgendaEventCardProps {
  event: CalendarEventType;
  onClick?: () => void;
}

function AgendaEventCard({ event, onClick }: AgendaEventCardProps) {
  const startTime = dayjs(event.startsAt);
  const endTime = dayjs(event.endsAt);
  const duration = endTime.diff(startTime, 'minute');
  const isMultiDay = !startTime.isSame(endTime, 'day');
  const isPast = endTime.isBefore(dayjs());

  // Format duration nicely
  const formatDuration = () => {
    if (event.isAllDay) return 'All day';
    if (duration < 60) return `${duration}m`;
    const hours = Math.floor(duration / 60);
    const mins = duration % 60;
    return mins ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div
      className={cn(
        "group relative flex gap-3 p-3 rounded-lg border bg-card hover:bg-white/5 cursor-pointer transition-all",
        isPast && "opacity-60"
      )}
      onClick={onClick}
    >
      {/* Color indicator */}
      <div 
        className="w-1 rounded-full self-stretch shrink-0"
        style={{ backgroundColor: event.color || '#3b82f6' }}
      />

      <div className="flex-1 min-w-0">
        {/* Title and time */}
        <div className="flex items-start justify-between gap-2">
          <h4 className={cn(
            "font-medium truncate",
            event.status === 'cancelled' && "line-through text-muted-foreground"
          )}>
            {event.title}
          </h4>
          <Badge variant="outline" className="shrink-0 text-xs">
            {formatDuration()}
          </Badge>
        </div>

        {/* Time range */}
        <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {event.isAllDay ? (
            <span>All day</span>
          ) : (
            <span>
              {startTime.format('h:mm A')} – {endTime.format('h:mm A')}
              {isMultiDay && ` (${endTime.format('MMM D')})`}
            </span>
          )}
        </div>

        {/* Location */}
        {event.location && (
          <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span className="truncate">{event.location}</span>
          </div>
        )}

        {/* Video meeting */}
        {event.meetingUrl && (
          <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
            <Video className="h-3.5 w-3.5 text-blue-400" />
            <span className="truncate capitalize">
              {event.meetingProvider || 'Video meeting'}
            </span>
          </div>
        )}

        {/* Participants/Attendees */}
        {(event.attendees?.length || event.participants?.length) && (
          <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>
              {event.attendees?.length || event.participants?.length} guest(s)
            </span>
          </div>
        )}

        {/* Description preview */}
        {event.description && (
          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
            {event.description}
          </p>
        )}

        {/* Tags/badges */}
        <div className="flex items-center gap-2 mt-2">
          {event.isRecurring && (
            <Badge variant="secondary" className="text-[10px]">
              Recurring
            </Badge>
          )}
          {event.eventType === 'focusTime' && (
            <Badge variant="secondary" className="text-[10px] bg-purple-500/20 text-purple-300">
              Focus Time
            </Badge>
          )}
          {event.eventType === 'outOfOffice' && (
            <Badge variant="secondary" className="text-[10px] bg-orange-500/20 text-orange-300">
              Out of Office
            </Badge>
          )}
          {event.visibility === 'private' && (
            <Badge variant="secondary" className="text-[10px]">
              Private
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

export default AgendaView;
