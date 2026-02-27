import { useState, useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import { CalendarEventType } from '@/lib/stores/types';
import { TodoItem } from '@/hooks/use-todo-lists';
import { detectConflicts } from '@/lib/ai/schedule-optimizer';
import { UserMemory } from '@/hooks/use-user-memory';

export interface ProactiveSuggestion {
  id: string;
  type: 'conflict' | 'back_to_back' | 'upcoming' | 'busy_day' | 'todo_backlog' | 'free_block'
  | 'no_lunch' | 'wellness' | 'streak' | 'habit_reminder' | 'goal_nudge';
  priority: 'high' | 'medium' | 'low';
  message: string;
  prompt: string;
  iconName: 'AlertTriangle' | 'Clock' | 'Bell' | 'Calendar' | 'CheckSquare' | 'Zap'
  | 'Star' | 'Heart';
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

function analyzeSuggestions(
  events: CalendarEventType[],
  todos: TodoItem[],
  memory?: UserMemory | null
): ProactiveSuggestion[] {
  const now = dayjs();
  const suggestions: ProactiveSuggestion[] = [];

  const futureEvents = events.filter(e => !e.isArchived && dayjs(e.startsAt).isAfter(now));
  const todayStr = now.format('YYYY-MM-DD');
  const tomorrowStr = now.add(1, 'day').format('YYYY-MM-DD');

  // Helper: get events for a specific day
  const eventsForDay = (dayStr: string) =>
    events.filter(e => !e.isArchived && (e.date === dayStr || dayjs(e.startsAt).format('YYYY-MM-DD') === dayStr))
      .sort((a, b) => dayjs(a.startsAt).valueOf() - dayjs(b.startsAt).valueOf());

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
          ? '1 scheduling conflict detected'
          : `${count} scheduling conflicts detected`,
        prompt: count === 1
          ? 'I have a scheduling conflict today. Can you show me and help resolve it?'
          : `I have ${count} scheduling conflicts. Can you help me resolve them?`,
        iconName: 'AlertTriangle',
      });
    }
  } catch {
    // detectConflicts may throw on edge cases
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
    const dayEvents = eventsForDay(dayStr);

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
        message: `${count} back-to-back meetings ${label} - no breaks`,
        prompt: `I have ${count} back-to-back meetings ${label} with no breaks. Can you add 10-minute buffer time between them?`,
        iconName: 'Clock',
      });
    }
  }

  // --- 4. No lunch break (high) ---
  for (const dayStr of [todayStr, tomorrowStr]) {
    const dayEvents = eventsForDay(dayStr);
    if (dayEvents.length < 3) continue;

    const lunchStart = dayjs(`${dayStr}T12:00:00`);
    const lunchEnd = dayjs(`${dayStr}T14:00:00`);

    let hasLunchGap = false;
    let cursor = lunchStart;
    while (cursor.isBefore(lunchEnd)) {
      const slotEnd = cursor.add(30, 'minute');
      const isOccupied = dayEvents.some(e => {
        const eStart = dayjs(e.startsAt);
        const eEnd = dayjs(e.endsAt);
        return eStart.isBefore(slotEnd) && eEnd.isAfter(cursor);
      });
      if (!isOccupied) {
        hasLunchGap = true;
        break;
      }
      cursor = slotEnd;
    }

    if (!hasLunchGap) {
      const label = dayStr === todayStr ? 'today' : 'tomorrow';
      const alreadyHasB2B = suggestions.some(s => s.id === `back-to-back-${dayStr}`);
      if (!alreadyHasB2B) {
        suggestions.push({
          id: `no-lunch-${dayStr}`,
          type: 'no_lunch',
          priority: 'high',
          message: `No lunch break ${label} - meetings cover 12-2pm`,
          prompt: `I don't have a lunch break ${label}. Can you move something to open up at least 30 minutes between 12 and 2pm?`,
          iconName: 'Heart',
        });
      }
    }
  }

  // --- 5. Busy day (medium) ---
  for (const dayStr of [todayStr, tomorrowStr]) {
    const count = events.filter(
      e => !e.isArchived && (e.date === dayStr || dayjs(e.startsAt).format('YYYY-MM-DD') === dayStr)
    ).length;

    if (count >= 5) {
      const label = dayStr === todayStr ? 'Today' : 'Tomorrow';
      const dayName = dayStr === todayStr ? 'today' : 'tomorrow';
      const alreadyHas = suggestions.some(s => s.id === `back-to-back-${dayStr}` || s.id === `no-lunch-${dayStr}`);
      if (!alreadyHas) {
        suggestions.push({
          id: `busy-day-${dayStr}`,
          type: 'busy_day',
          priority: 'medium',
          message: `${label} is packed - ${count} events scheduled`,
          prompt: `I have ${count} events ${dayName}. Can you give me an overview and suggest how to manage my time?`,
          iconName: 'Calendar',
        });
      }
    }
  }

  // --- 6. Todo backlog (medium) ---
  const incompleteTodos = todos.filter(t => !t.completed);
  if (incompleteTodos.length >= 10) {
    suggestions.push({
      id: `todo-backlog-${incompleteTodos.length}`,
      type: 'todo_backlog',
      priority: 'medium',
      message: `${incompleteTodos.length} tasks waiting - want to schedule some?`,
      prompt: `I have ${incompleteTodos.length} incomplete tasks. Can you help me prioritize and schedule the most important ones on my calendar?`,
      iconName: 'CheckSquare',
    });
  }

  // --- 7. Work Hours Check (medium) - memory-aware ---
  if (memory?.preferences?.workHoursStart || memory?.preferences?.workHoursEnd) {
    const { workHoursStart, workHoursEnd } = memory.preferences;
    for (const dayStr of [todayStr, tomorrowStr]) {
      const dayEvents = eventsForDay(dayStr);
      const outsideHours = dayEvents.filter(e => {
        const eStart = dayjs(e.startsAt);
        const eEnd = dayjs(e.endsAt);
        if (workHoursStart) {
          const [h, m] = workHoursStart.split(':').map(Number);
          if (eStart.hour() < h || (eStart.hour() === h && eStart.minute() < m)) return true;
        }
        if (workHoursEnd) {
          const [h, m] = workHoursEnd.split(':').map(Number);
          if (eEnd.hour() > h || (eEnd.hour() === h && eEnd.minute() > m)) return true;
        }
        return false;
      });

      if (outsideHours.length > 0) {
        const label = dayStr === todayStr ? 'today' : 'tomorrow';
        suggestions.push({
          id: `work-hours-${dayStr}`,
          type: 'wellness',
          priority: 'medium',
          message: `${outsideHours.length} events ${label} are outside your preferred hours (${workHoursStart || '?'}-${workHoursEnd || '?'})`,
          prompt: `I have events ${label} that fall outside my preferred work hours. Can you help me reschedule them to fit within ${workHoursStart || '9 AM'} and ${workHoursEnd || '5 PM'}?`,
          iconName: 'Clock',
        });
      }
    }
  }

  // --- 8. Break Interval Check (medium) - memory-aware ---
  if (memory?.preferences?.breakInterval) {
    const minBreak = memory.preferences.breakInterval;
    for (const dayStr of [todayStr, tomorrowStr]) {
      const dayEvents = eventsForDay(dayStr);
      let breakViolationCount = 0;

      for (let i = 1; i < dayEvents.length; i++) {
        const prev = dayEvents[i - 1];
        const curr = dayEvents[i];
        const gap = dayjs(curr.startsAt).diff(dayjs(prev.endsAt), 'minute');
        if (gap >= 0 && gap < minBreak) {
          breakViolationCount++;
        }
      }

      if (breakViolationCount >= 2 && !suggestions.some(s => s.id === `back-to-back-${dayStr}`)) {
        const label = dayStr === todayStr ? 'today' : 'tomorrow';
        suggestions.push({
          id: `break-interval-${dayStr}`,
          type: 'wellness',
          priority: 'medium',
          message: `Multiple meetings ${label} lack your preferred ${minBreak}m break`,
          prompt: `Several of my meetings ${label} don't have the ${minBreak}-minute break I prefer. Can you help me shift them to create proper breathing room?`,
          iconName: 'Heart',
        });
      }
    }
  }

  // --- 9. Wellness / burnout (medium) - memory-aware ---
  if (memory) {
    const highMeetingDays = memory.patterns?.highMeetingDays;
    if (highMeetingDays && highMeetingDays.length >= 3) {
      suggestions.push({
        id: 'wellness-heavy-week',
        type: 'wellness',
        priority: 'medium',
        message: `Heavy schedule detected across ${highMeetingDays.length} days this week`,
        prompt: 'I\'ve been having heavy schedules lately. Can you analyze my week and suggest where to add recovery time or lighter days?',
        iconName: 'Heart',
      });
    }

    // Stress observation from memory
    const recentObs = memory.observations || [];
    const stressObs = recentObs.filter(o =>
      /stress|overwhelm|burnout|exhaust|too much|overload/i.test(o)
    );
    if (stressObs.length >= 2) {
      suggestions.push({
        id: 'wellness-stress-pattern',
        type: 'wellness',
        priority: 'medium',
        message: 'Mally noticed you\'ve been stressed - want a schedule check-up?',
        prompt: 'I\'ve been feeling stressed lately. Can you do a full productivity health check - look at my schedule, workload, and suggest improvements?',
        iconName: 'Heart',
      });
    }
  }

  // --- 8. Goal nudge (low) - memory-aware ---
  if (memory?.goals?.primaryGoal) {
    const goal = memory.goals.primaryGoal;
    const todayCount = eventsForDay(todayStr).length;
    if (todayCount <= 2) {
      suggestions.push({
        id: 'goal-nudge',
        type: 'goal_nudge',
        priority: 'low',
        message: `Light day - time to work on "${goal.length > 35 ? goal.slice(0, 35) + '...' : goal}"?`,
        prompt: `My main goal is "${goal}". I have a relatively open day - can you help me plan focused time to make progress on it?`,
        iconName: 'Star',
      });
    }
  }

  // --- 9. Habit reminder (low) - memory-aware ---
  if (memory?.preferences?.deepWorkPreference) {
    const pref = memory.preferences.deepWorkPreference;
    const todayEvts = eventsForDay(todayStr);
    const hasFocusBlock = todayEvts.some(e =>
      /focus|deep work|concentration|heads down/i.test(e.title || '')
    );
    if (!hasFocusBlock && todayEvts.length >= 3) {
      suggestions.push({
        id: 'habit-deep-work',
        type: 'habit_reminder',
        priority: 'low',
        message: `No focus block today - you prefer ${pref}`,
        prompt: `I don't have a deep work block scheduled today. I usually prefer ${pref} for focused work. Can you find a slot and block it off?`,
        iconName: 'Zap',
      });
    }
  }

  // --- 10. Free block this afternoon (low) ---
  const afternoonStart = now.hour() < 12 ? now.hour(12).minute(0).second(0) : now;
  const afternoonEnd = now.hour(17).minute(0).second(0);

  if (afternoonStart.isBefore(afternoonEnd)) {
    const todayEvts = events
      .filter(e => !e.isArchived && dayjs(e.startsAt).format('YYYY-MM-DD') === todayStr)
      .sort((a, b) => dayjs(a.startsAt).valueOf() - dayjs(b.startsAt).valueOf());

    let longestFreeMinutes = 0;
    let cursor = afternoonStart;

    for (const e of todayEvts) {
      const eStart = dayjs(e.startsAt);
      const eEnd = dayjs(e.endsAt);
      if (eEnd.isBefore(cursor)) continue;
      if (eStart.isAfter(cursor)) {
        const gap = eStart.diff(cursor, 'minute');
        if (gap > longestFreeMinutes) longestFreeMinutes = gap;
      }
      if (eEnd.isAfter(cursor)) cursor = eEnd;
    }
    const remaining = afternoonEnd.diff(cursor, 'minute');
    if (remaining > longestFreeMinutes) longestFreeMinutes = remaining;

    if (longestFreeMinutes >= 120) {
      const hours = Math.floor(longestFreeMinutes / 60);
      suggestions.push({
        id: `free-block-${todayStr}`,
        type: 'free_block',
        priority: 'low',
        message: `${hours}h free this afternoon - block focus time?`,
        prompt: `I have ${hours} hours free this afternoon. Can you schedule a focus block for deep work?`,
        iconName: 'Zap',
      });
    }
  }

  // Sort: high > medium > low
  suggestions.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);

  return suggestions.slice(0, 6);
}

interface UseProactiveSuggestionsProps {
  events: CalendarEventType[];
  todos: TodoItem[];
  memory?: UserMemory | null;
}

export function useProactiveSuggestions({ events, todos, memory }: UseProactiveSuggestionsProps) {
  const dismissedRef = useRef<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<ProactiveSuggestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const eventsLen = events.length;
  const todosLen = todos.length;
  const memoryUpdatedAt = memory?.updatedAt;

  const runAnalysis = () => {
    const raw = analyzeSuggestions(events, todos, memory);
    const filtered = raw.filter(s => !dismissedRef.current.has(s.id));
    setSuggestions(filtered);
    setCurrentIndex(0);
  };

  // Run on mount and when data changes
  useEffect(() => {
    if (eventsLen === 0 && todosLen === 0) return;
    runAnalysis();
  }, [eventsLen, todosLen, memoryUpdatedAt]);

  // Re-check every 10 min + every 1 min for upcoming
  useEffect(() => {
    const tenMin = setInterval(runAnalysis, 10 * 60 * 1000);
    const oneMin = setInterval(() => {
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
  }, [events, todos, memory]);

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
