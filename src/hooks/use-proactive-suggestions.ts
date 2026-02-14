import { useState, useEffect, useRef, useMemo } from 'react';
import dayjs from 'dayjs';
import { CalendarEventType } from '@/lib/stores/types';
import { TodoItem } from '@/hooks/use-todo-lists';
import { detectConflicts } from '@/lib/ai/schedule-optimizer';

export interface ProactiveSuggestion {
  id: string;
  type: 'conflict' | 'back_to_back' | 'upcoming' | 'busy_day' | 'todo_backlog' | 'free_block';
  priority: 'high' | 'medium' | 'low';
  message: string;
  prompt: string;
  iconName: 'AlertTriangle' | 'Clock' | 'Bell' | 'Calendar' | 'CheckSquare' | 'Zap';
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function analyzeSuggestions(
  events: CalendarEventType[],
  todos: TodoItem[]
): ProactiveSuggestion[] {
  const now = dayjs();
  const suggestions: ProactiveSuggestion[] = [];

  const futureEvents = events.filter(e => !e.isArchived && dayjs(e.startsAt).isAfter(now));
  const todayStr = now.format('YYYY-MM-DD');
  const tomorrowStr = now.add(1, 'day').format('YYYY-MM-DD');

  // --- 1. Conflicts (high) ---
  try {
    const conflicts = detectConflicts(events);
    if (conflicts.length > 0) {
      const count = conflicts.length;
      suggestions.push({
        id: `conflict-${count}`,
        type: 'conflict',
        priority: 'high',
        message: count === 1
          ? `1 scheduling conflict detected`
          : `${count} scheduling conflicts detected`,
        prompt: count === 1
          ? 'I have a scheduling conflict today. Can you show me and help resolve it?'
          : `I have ${count} scheduling conflicts. Can you help me resolve them?`,
        iconName: 'AlertTriangle',
      });
    }
  } catch {
    // detectConflicts may throw on edge cases — skip gracefully
  }

  // --- 2. Upcoming event within 30 min (high) ---
  const upcoming = futureEvents
    .filter(e => {
      const minsUntil = dayjs(e.startsAt).diff(now, 'minute');
      return minsUntil >= 0 && minsUntil <= 30;
    })
    .sort((a, b) => dayjs(a.startsAt).valueOf() - dayjs(b.startsAt).valueOf())[0];

  if (upcoming) {
    const minsUntil = dayjs(upcoming.startsAt).diff(now, 'minute');
    const timeStr = minsUntil <= 1 ? 'now' : `in ${minsUntil} min`;
    suggestions.push({
      id: `upcoming-${upcoming.id}`,
      type: 'upcoming',
      priority: 'high',
      message: `"${upcoming.title}" starts ${timeStr}`,
      prompt: `Tell me about my upcoming event: ${upcoming.title} starting at ${dayjs(upcoming.startsAt).format('h:mm A')}`,
      iconName: 'Bell',
    });
  }

  // --- 3. Back-to-back meetings (high) ---
  for (const dayStr of [todayStr, tomorrowStr]) {
    const dayEvents = events
      .filter(e => !e.isArchived && (e.date === dayStr || dayjs(e.startsAt).format('YYYY-MM-DD') === dayStr))
      .sort((a, b) => dayjs(a.startsAt).valueOf() - dayjs(b.startsAt).valueOf());

    const backToBackPairs = dayEvents.filter((e, i) => {
      if (i === 0) return false;
      const prev = dayEvents[i - 1];
      const gap = dayjs(e.startsAt).diff(dayjs(prev.endsAt), 'minute');
      return gap >= 0 && gap < 10;
    });

    if (backToBackPairs.length >= 2) {
      const label = dayStr === todayStr ? 'today' : 'tomorrow';
      const count = backToBackPairs.length + 1;
      suggestions.push({
        id: `back-to-back-${dayStr}`,
        type: 'back_to_back',
        priority: 'high',
        message: `${count} back-to-back meetings ${label} — no breaks`,
        prompt: `I have ${count} back-to-back meetings ${label} with no breaks. Can you add 10-minute buffer time between them?`,
        iconName: 'Clock',
      });
    }
  }

  // --- 4. Busy day (medium) ---
  for (const dayStr of [todayStr, tomorrowStr]) {
    const count = events.filter(
      e => !e.isArchived && (e.date === dayStr || dayjs(e.startsAt).format('YYYY-MM-DD') === dayStr)
    ).length;

    if (count >= 5) {
      const label = dayStr === todayStr ? 'Today' : 'Tomorrow';
      const dayName = dayStr === todayStr ? 'today' : 'tomorrow';
      // Only add if no back-to-back suggestion already for this day
      const alreadyHas = suggestions.some(s => s.id === `back-to-back-${dayStr}`);
      if (!alreadyHas) {
        suggestions.push({
          id: `busy-day-${dayStr}`,
          type: 'busy_day',
          priority: 'medium',
          message: `${label} is packed — ${count} events scheduled`,
          prompt: `I have ${count} events ${dayName}. Can you give me an overview and suggest how to manage my time?`,
          iconName: 'Calendar',
        });
      }
    }
  }

  // --- 5. Todo backlog (medium) ---
  const incompleteTodos = todos.filter(t => !t.completed);
  if (incompleteTodos.length >= 10) {
    suggestions.push({
      id: `todo-backlog-${incompleteTodos.length}`,
      type: 'todo_backlog',
      priority: 'medium',
      message: `${incompleteTodos.length} tasks waiting — want to schedule some?`,
      prompt: `I have ${incompleteTodos.length} incomplete tasks. Can you help me prioritize and schedule the most important ones on my calendar?`,
      iconName: 'CheckSquare',
    });
  }

  // --- 6. Free block this afternoon (low) ---
  const afternoonStart = now.hour() < 12 ? now.hour(12).minute(0).second(0) : now;
  const afternoonEnd = now.hour(17).minute(0).second(0);

  if (afternoonStart.isBefore(afternoonEnd)) {
    const todayEvents = events
      .filter(e => !e.isArchived && dayjs(e.startsAt).format('YYYY-MM-DD') === todayStr)
      .sort((a, b) => dayjs(a.startsAt).valueOf() - dayjs(b.startsAt).valueOf());

    let longestFreeMinutes = 0;
    let cursor = afternoonStart;

    for (const e of todayEvents) {
      const eStart = dayjs(e.startsAt);
      const eEnd = dayjs(e.endsAt);
      if (eEnd.isBefore(cursor)) continue;
      if (eStart.isAfter(cursor)) {
        const gap = eStart.diff(cursor, 'minute');
        if (gap > longestFreeMinutes) longestFreeMinutes = gap;
      }
      if (eEnd.isAfter(cursor)) cursor = eEnd;
    }
    // Check remaining time after last event
    const remaining = afternoonEnd.diff(cursor, 'minute');
    if (remaining > longestFreeMinutes) longestFreeMinutes = remaining;

    if (longestFreeMinutes >= 120) {
      const hours = Math.floor(longestFreeMinutes / 60);
      suggestions.push({
        id: `free-block-${todayStr}`,
        type: 'free_block',
        priority: 'low',
        message: `${hours}h free this afternoon — block focus time?`,
        prompt: `I have ${hours} hours free this afternoon. Can you schedule a focus block for deep work?`,
        iconName: 'Zap',
      });
    }
  }

  // Sort: high → medium → low, then stable order within priority
  suggestions.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  return suggestions.slice(0, 5);
}

interface UseProactiveSuggestionsProps {
  events: CalendarEventType[];
  todos: TodoItem[];
}

export function useProactiveSuggestions({ events, todos }: UseProactiveSuggestionsProps) {
  const dismissedRef = useRef<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<ProactiveSuggestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Track lengths to avoid re-running on every render
  const eventsLen = events.length;
  const todosLen = todos.length;

  const runAnalysis = () => {
    const raw = analyzeSuggestions(events, todos);
    const filtered = raw.filter(s => !dismissedRef.current.has(s.id));
    setSuggestions(filtered);
    setCurrentIndex(0);
  };

  // Run on mount and when event/todo counts change
  useEffect(() => {
    if (eventsLen === 0 && todosLen === 0) return;
    runAnalysis();
  }, [eventsLen, todosLen]);

  // Re-check every 10 minutes for staleness + every 1 minute for upcoming
  useEffect(() => {
    const tenMin = setInterval(runAnalysis, 10 * 60 * 1000);
    const oneMin = setInterval(() => {
      // Only re-run if there might be an upcoming event surfacing
      const now = dayjs();
      const hasImminent = events.some(e => {
        const mins = dayjs(e.startsAt).diff(now, 'minute');
        return mins >= 0 && mins <= 30;
      });
      if (hasImminent) runAnalysis();
    }, 60 * 1000);

    return () => {
      clearInterval(tenMin);
      clearInterval(oneMin);
    };
  }, [events, todos]);

  const dismiss = (id: string) => {
    dismissedRef.current.add(id);
    setSuggestions(prev => {
      const next = prev.filter(s => s.id !== id);
      setCurrentIndex(i => Math.min(i, Math.max(0, next.length - 1)));
      return next;
    });
  };

  const next = () => {
    setCurrentIndex(i => (i + 1) % Math.max(1, suggestions.length));
  };

  return { suggestions, currentIndex, dismiss, next };
}
