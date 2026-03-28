import { useState, useEffect } from 'react';
import { useCalendarEvents } from './use-calendar-events';
import { CalendarEventType } from '@/lib/stores/types';

export interface CountdownEvent {
  event: CalendarEventType;
  days: number;
  hours: number;
  minutes: number;
  totalMinutesLeft: number;
  progressPercent: number; // 0-100, how far along we are to the event
}

function computeCountdown(event: CalendarEventType): CountdownEvent | null {
  const now = Date.now();
  const start = new Date(event.startsAt).getTime();
  const created = event.createdAt ? new Date(event.createdAt).getTime() : now;

  if (start <= now) return null; // Event has already started

  const msLeft = start - now;
  const totalMs = start - created;
  const progressPercent = totalMs > 0 ? Math.min(100, Math.round(((totalMs - msLeft) / totalMs) * 100)) : 0;

  const totalMinutesLeft = Math.floor(msLeft / 60000);
  const days = Math.floor(msLeft / 86400000);
  const hours = Math.floor((msLeft % 86400000) / 3600000);
  const minutes = Math.floor((msLeft % 3600000) / 60000);

  return { event, days, hours, minutes, totalMinutesLeft, progressPercent };
}

export function useCountdownEvents() {
  const { events } = useCalendarEvents();
  const [countdowns, setCountdowns] = useState<CountdownEvent[]>([]);

  useEffect(() => {
    const countdownEvents = (events ?? []).filter(
      (e) => e.countdownEnabled && new Date(e.startsAt).getTime() > Date.now()
    );

    const compute = () => {
      const results: CountdownEvent[] = [];
      for (const event of countdownEvents) {
        const c = computeCountdown(event);
        if (c) results.push(c);
      }
      results.sort((a, b) => a.totalMinutesLeft - b.totalMinutesLeft);
      setCountdowns(results);
    };

    compute();
    const interval = setInterval(compute, 60000); // update every minute
    return () => clearInterval(interval);
  }, [events]);

  return countdowns;
}
