import { useEffect, useRef } from 'react';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { useActionRunnerStore } from '@/lib/stores/action-runner-store';

/** How far before the event start to show the runner (2 minutes) */
const TRIGGER_BEFORE_MS = 2 * 60 * 1000;
/** How long after the event start to still allow triggering (5 minutes) */
const TRIGGER_AFTER_MS = 5 * 60 * 1000;
/** How often to check for upcoming events */
const CHECK_INTERVAL_MS = 30 * 1000;

/**
 * Runs in the background to detect calendar events with mallyActions that are
 * about to start. When found, it pushes the event into the action runner store,
 * which causes <ActionRunnerModal> to appear.
 */
export function useActionScheduler() {
  const { events } = useCalendarEvents();
  const { setPending, hasExecuted, markExecuted, pendingEvent } = useActionRunnerStore();

  // Keep a stable ref to avoid stale closures inside setInterval
  const eventsRef = useRef(events);
  const hasExecutedRef = useRef(hasExecuted);
  const markExecutedRef = useRef(markExecuted);
  const pendingEventRef = useRef(pendingEvent);

  useEffect(() => { eventsRef.current = events; }, [events]);
  useEffect(() => { hasExecutedRef.current = hasExecuted; }, [hasExecuted]);
  useEffect(() => { markExecutedRef.current = markExecuted; }, [markExecuted]);
  useEffect(() => { pendingEventRef.current = pendingEvent; }, [pendingEvent]);

  useEffect(() => {
    const check = () => {
      // Don't queue another event if one is already pending
      if (pendingEventRef.current) return;

      const now = Date.now();

      for (const event of eventsRef.current) {
        if (!event.mallyActions?.length) continue;
        if (hasExecutedRef.current(event.id)) continue;

        const startsAt = new Date(event.startsAt).getTime();
        const msUntilStart = startsAt - now;

        // Trigger window: from 2 min before start to 5 min after start
        if (msUntilStart <= TRIGGER_BEFORE_MS && msUntilStart > -TRIGGER_AFTER_MS) {
          markExecutedRef.current(event.id);
          setPending(event);
          return; // show one at a time
        }
      }
    };

    // Run immediately on mount, then on interval
    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [setPending]); // setPending is stable (zustand)
}
