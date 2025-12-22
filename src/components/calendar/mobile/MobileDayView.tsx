// Mobile-optimized day/agenda view with pull-to-refresh
import { useState } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useSwipeable } from 'react-swipeable';

interface MobileDayViewProps {
  currentDate: Date;
  events: any[];
  onDateChange: (date: Date) => void;
  onEventClick: (event: any) => void;
  onAddEvent: (date: Date) => void;
}

export function MobileDayView({
  currentDate,
  events,
  onDateChange,
  onEventClick,
  onAddEvent,
}: MobileDayViewProps) {
  const [isPulling, setIsPulling] = useState(false);

  // Swipe handlers for day navigation
  const handlers = useSwipeable({
    onSwipedLeft: () => handleNextDay(),
    onSwipedRight: () => handlePrevDay(),
    preventScrollOnSwipe: true,
    trackMouse: false,
  });

  const handlePrevDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 1);
    onDateChange(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 1);
    onDateChange(newDate);
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  // Group events by hour
  const getEventsForHour = (hour: number) => {
    return events.filter((event) => {
      const eventDate = new Date(event.startsAt || event.start_date);
      return (
        eventDate.getDate() === currentDate.getDate() &&
        eventDate.getMonth() === currentDate.getMonth() &&
        eventDate.getFullYear() === currentDate.getFullYear() &&
        eventDate.getHours() === hour
      );
    });
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const isToday = () => {
    const today = new Date();
    return (
      currentDate.getDate() === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  const dateString = currentDate.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="flex items-center justify-between p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevDay}
            className="h-10 w-10"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <h2 className="text-lg font-semibold">{dateString}</h2>
            {!isToday() && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToday}
                className="h-6 text-xs"
              >
                Today
              </Button>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextDay}
            className="h-10 w-10"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Timeline with swipe support */}
      <ScrollArea className="flex-1" {...handlers}>
        <div className="p-4 space-y-2">
          {hours.map((hour) => {
            const hourEvents = getEventsForHour(hour);
            const timeString = new Date(2000, 0, 1, hour).toLocaleTimeString('en-US', {
              hour: 'numeric',
              hour12: true,
            });

            return (
              <div key={hour} className="flex gap-3">
                {/* Time label */}
                <div className="w-16 flex-shrink-0 text-sm text-muted-foreground pt-1">
                  {timeString}
                </div>

                {/* Events or empty slot */}
                <div className="flex-1 min-h-[60px] border-l-2 border-muted pl-3">
                  {hourEvents.length > 0 ? (
                    <div className="space-y-2">
                      {hourEvents.map((event, i) => (
                        <button
                          key={i}
                          onClick={() => onEventClick(event)}
                          className={cn(
                            'w-full text-left p-3 rounded-lg transition-all',
                            'active:scale-98 min-h-[52px]',
                            'bg-primary/10 border border-primary/20',
                            'hover:bg-primary/20'
                          )}
                        >
                          <div className="font-semibold text-sm">
                            {event.title}
                          </div>
                          {event.description && (
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              {event.description}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        const date = new Date(currentDate);
                        date.setHours(hour, 0, 0, 0);
                        onAddEvent(date);
                      }}
                      className={cn(
                        'w-full h-[52px] rounded-lg border-2 border-dashed',
                        'border-muted hover:border-primary/50 transition-colors',
                        'active:bg-muted/50'
                      )}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Floating action button */}
      <Button
        size="icon"
        onClick={() => onAddEvent(currentDate)}
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
}
