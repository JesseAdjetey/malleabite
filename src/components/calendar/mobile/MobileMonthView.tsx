// Mobile-optimized month view with swipe gestures
import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSwipeable } from 'react-swipeable';

interface MobileMonthViewProps {
  currentDate: Date;
  events: any[];
  onDateChange: (date: Date) => void;
  onEventClick: (event: any) => void;
  onAddEvent: (date: Date) => void;
}

export function MobileMonthView({
  currentDate,
  events,
  onDateChange,
  onEventClick,
  onAddEvent,
}: MobileMonthViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Swipe handlers for month navigation
  const handlers = useSwipeable({
    onSwipedLeft: () => handleNextMonth(),
    onSwipedRight: () => handlePrevMonth(),
    preventScrollOnSwipe: true,
    trackMouse: false,
  });

  const handlePrevMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() - 1);
    onDateChange(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + 1);
    onDateChange(newDate);
  };

  // Get calendar days for current month
  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];

    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    // Add all days in month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const getEventsForDate = (date: Date | null) => {
    if (!date) return [];
    return events.filter((event) => {
      const eventDate = new Date(event.startsAt || event.start_date);
      return (
        eventDate.getDate() === date.getDate() &&
        eventDate.getMonth() === date.getMonth() &&
        eventDate.getFullYear() === date.getFullYear()
      );
    });
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const days = getDaysInMonth();
  const monthName = currentDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header with month navigation */}
      <div className="flex items-center justify-between p-4 border-b">
        <Button
          variant="ghost"
          size="icon"
          onClick={handlePrevMonth}
          className="h-10 w-10"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-lg font-semibold">{monthName}</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleNextMonth}
          className="h-10 w-10"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
          <div
            key={i}
            className="text-center py-2 text-xs font-semibold text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid with swipe support */}
      <div {...handlers} className="flex-1 overflow-hidden">
        <div className="grid grid-cols-7 h-full">
          {days.map((date, index) => {
            const dayEvents = getEventsForDate(date);
            const isSelected = selectedDate && date && 
              selectedDate.getDate() === date.getDate() &&
              selectedDate.getMonth() === date.getMonth();

            return (
              <button
                key={index}
                onClick={() => {
                  if (date) {
                    setSelectedDate(date);
                    onAddEvent(date);
                  }
                }}
                disabled={!date}
                className={cn(
                  'relative border-r border-b min-h-[60px] p-1 transition-colors',
                  'active:bg-muted/50',
                  !date && 'bg-muted/20 cursor-default',
                  isToday(date) && 'bg-primary/5',
                  isSelected && 'ring-2 ring-primary ring-inset'
                )}
                style={{ minHeight: '60px' }} // Touch target
              >
                {date && (
                  <>
                    <div
                      className={cn(
                        'text-sm font-medium mb-1',
                        isToday(date) && 'text-primary font-bold'
                      )}
                    >
                      {date.getDate()}
                    </div>
                    {dayEvents.length > 0 && (
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map((event, i) => (
                          <div
                            key={i}
                            className="h-1 rounded-full bg-primary/60"
                            style={{ width: '80%' }}
                          />
                        ))}
                        {dayEvents.length > 2 && (
                          <div className="text-[10px] text-muted-foreground">
                            +{dayEvents.length - 2}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating action button */}
      <Button
        size="icon"
        onClick={() => onAddEvent(selectedDate || new Date())}
        className="fixed bottom-20 right-4 h-14 w-14 rounded-full shadow-lg"
      >
        <Plus className="h-6 w-6" />
      </Button>
    </div>
  );
}
