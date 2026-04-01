import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import type { CalendarEventType } from '@/lib/stores/types';
import type { ReschedulingPreferences } from '@/lib/stores/settings-store';

dayjs.extend(isBetween);

export type ConflictSeverity = 'critical' | 'warning' | 'info';

export type ConflictType =
  | 'overlap'
  | 'double-booking'
  | 'tight-schedule'
  | 'travel-time'
  | 'back-to-back'
  | 'outside-work-hours';

export interface EventConflict {
  id: string;
  severity: ConflictSeverity;
  type: ConflictType;
  message: string;
  conflictingEvents: CalendarEventType[];
  suggestions: string[];
  /**
   * false when one or both events are isLocked — auto-resolve must never fire.
   */
  canAutoResolve: boolean;
}

export interface ConflictAnalysis {
  hasConflicts: boolean;
  conflicts: EventConflict[];
  /** 0–100; 100 = no conflicts */
  score: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isEventInScope(
  event: CalendarEventType,
  conflictCalendarIds: string[] | null,
  conflictExcludedCalendarIds?: string[],
): boolean {
  // Exclusion list takes priority — if the calendar is excluded, skip it
  if (conflictExcludedCalendarIds?.length && event.calendarId) {
    if (conflictExcludedCalendarIds.includes(event.calendarId)) return false;
  }
  // Legacy inclusion filter (null = all)
  if (conflictCalendarIds === null) return true;
  if (!event.calendarId) return true; // unassigned events always participate
  return conflictCalendarIds.includes(event.calendarId);
}

function eventsHardOverlap(a: CalendarEventType, b: CalendarEventType): boolean {
  const aStart = dayjs(a.startsAt).valueOf();
  const aEnd   = dayjs(a.endsAt).valueOf();
  const bStart = dayjs(b.startsAt).valueOf();
  const bEnd   = dayjs(b.endsAt).valueOf();
  return aStart < bEnd && bStart < aEnd;
}

function gapMinutes(a: CalendarEventType, b: CalendarEventType): number {
  const aEnd   = dayjs(a.endsAt);
  const bStart = dayjs(b.startsAt);
  const bEnd   = dayjs(b.endsAt);
  const aStart = dayjs(a.startsAt);
  // gap = absolute difference between the nearest endpoints
  return Math.min(
    Math.abs(bStart.diff(aEnd, 'minute')),
    Math.abs(aStart.diff(bEnd, 'minute')),
  );
}

// ─── Main detector ──────────────────────────────────────────────────────────

/**
 * Detect conflicts for a single event against all other events,
 * respecting the user's rescheduling preferences.
 */
export function detectEventConflicts(
  event: CalendarEventType,
  allEvents: CalendarEventType[],
  prefs: Pick<
    ReschedulingPreferences,
    | 'conflictCalendarIds'
    | 'minBufferMinutes'
    | 'travelTimeBuffer'
    | 'focusBlockBuffer'
    | 'maxConsecutiveMeetings'
    | 'workdayStart'
    | 'workdayEnd'
    | 'workDays'
  >,
): ConflictAnalysis {
  const conflicts: EventConflict[] = [];
  const eventStart = dayjs(event.startsAt);
  const eventEnd   = dayjs(event.endsAt);

  const excluded = (prefs as any).conflictExcludedCalendarIds as string[] | undefined;

  // Skip if this event is out of scope
  if (!isEventInScope(event, prefs.conflictCalendarIds, excluded)) {
    return { hasConflicts: false, conflicts: [], score: 100 };
  }

  // Filter: same day, different id, in scope
  const sameDay = allEvents.filter(
    (e) =>
      e.id !== event.id &&
      dayjs(e.startsAt).isSame(eventStart, 'day') &&
      isEventInScope(e, prefs.conflictCalendarIds, excluded),
  );

  // ── 1. Hard overlap & travel-time ─────────────────────────────────────────
  for (const other of sameDay) {
    const otherStart = dayjs(other.startsAt);
    const otherEnd   = dayjs(other.endsAt);

    if (eventsHardOverlap(event, other)) {
      const canAutoResolve = !event.isLocked && !other.isLocked;
      const duration = eventEnd.diff(eventStart, 'minute');

      conflicts.push({
        id: `overlap-${event.id}-${other.id}`,
        severity: 'critical',
        type: 'overlap',
        message: `Overlaps with "${other.title}"`,
        conflictingEvents: [other],
        canAutoResolve,
        suggestions: canAutoResolve
          ? [
              `Move to ${otherEnd.format('h:mm A')} – ${otherEnd.add(duration, 'minute').format('h:mm A')}`,
              `Shorten duration to ${otherStart.diff(eventStart, 'minute')} min`,
              'Move to next available slot',
            ]
          : ['Both events are locked — resolve manually'],
      });
      continue; // don't double-report this pair as a tight-schedule too
    }

    // ── 2. Travel-time buffer ────────────────────────────────────────────────
    const needsTravelBuffer =
      (event.location || other.location) && prefs.travelTimeBuffer > 0;
    const requiredBuffer = needsTravelBuffer
      ? prefs.travelTimeBuffer
      : prefs.minBufferMinutes;

    if (requiredBuffer > 0) {
      const gap = gapMinutes(event, other);
      if (gap < requiredBuffer && gap >= 0) {
        const type: ConflictType = needsTravelBuffer ? 'travel-time' : 'tight-schedule';
        const severity: ConflictSeverity = needsTravelBuffer ? 'warning' : 'warning';
        const canAutoResolve = !event.isLocked && !other.isLocked;

        conflicts.push({
          id: `${type}-${event.id}-${other.id}`,
          severity,
          type,
          message: needsTravelBuffer
            ? `Only ${gap} min gap — not enough travel time before "${other.title}"`
            : `Only ${gap} min gap with "${other.title}" (minimum ${requiredBuffer} min)`,
          conflictingEvents: [other],
          canAutoResolve,
          suggestions: [
            `Add ${requiredBuffer - gap} more minutes of buffer`,
            'Move one of the events to create spacing',
          ],
        });
      }
    }
  }

  // ── 3. Back-to-back consecutive meetings ──────────────────────────────────
  if (prefs.maxConsecutiveMeetings > 0) {
    // Count how many events end within 5 min before this one starts
    const consecutive = sameDay.filter((e) => {
      const gap = eventStart.diff(dayjs(e.endsAt), 'minute');
      return gap >= 0 && gap <= 5;
    }).length;

    if (consecutive >= prefs.maxConsecutiveMeetings) {
      conflicts.push({
        id: `back-to-back-${event.id}`,
        severity: 'warning',
        type: 'back-to-back',
        message: `${consecutive + 1} consecutive meetings — consider a break`,
        conflictingEvents: [],
        canAutoResolve: !event.isLocked,
        suggestions: [
          'Add a 10–15 min break between meetings',
          'Move this event to a later slot',
        ],
      });
    }
  }

  // ── 4. Outside work hours ─────────────────────────────────────────────────
  const dayOfWeek = eventStart.day();
  if (!prefs.workDays.includes(dayOfWeek)) {
    conflicts.push({
      id: `outside-hours-${event.id}`,
      severity: 'info',
      type: 'outside-work-hours',
      message: 'Scheduled on a non-work day',
      conflictingEvents: [],
      canAutoResolve: !event.isLocked,
      suggestions: ['Move to a weekday'],
    });
  } else if (
    eventStart.hour() < prefs.workdayStart ||
    eventEnd.hour() > prefs.workdayEnd ||
    (eventEnd.hour() === prefs.workdayEnd && eventEnd.minute() > 0)
  ) {
    conflicts.push({
      id: `outside-hours-${event.id}`,
      severity: 'info',
      type: 'outside-work-hours',
      message: `Outside work hours (${prefs.workdayStart}:00 – ${prefs.workdayEnd}:00)`,
      conflictingEvents: [],
      canAutoResolve: !event.isLocked,
      suggestions: ['Move within your defined work hours'],
    });
  }

  // ── Score ──────────────────────────────────────────────────────────────────
  const criticalCount = conflicts.filter((c) => c.severity === 'critical').length;
  const warningCount  = conflicts.filter((c) => c.severity === 'warning').length;
  const score = Math.max(0, 100 - criticalCount * 40 - warningCount * 15);

  return { hasConflicts: conflicts.length > 0, conflicts, score };
}

// ─── Batch detector ─────────────────────────────────────────────────────────

/**
 * Detect all conflicts across a date range, keyed by event ID.
 * Only returns entries for events that have at least one conflict.
 */
export function detectAllConflicts(
  events: CalendarEventType[],
  startDate: string,
  endDate: string,
  prefs: Parameters<typeof detectEventConflicts>[2],
): Map<string, ConflictAnalysis> {
  const conflictMap = new Map<string, ConflictAnalysis>();

  const rangeEvents = events.filter((e) => {
    const d = dayjs(e.startsAt);
    return d.isBetween(dayjs(startDate), dayjs(endDate), 'day', '[]');
  });

  for (const event of rangeEvents) {
    const analysis = detectEventConflicts(event, events, prefs);
    if (analysis.hasConflicts) {
      conflictMap.set(event.id, analysis);
    }
  }

  return conflictMap;
}

// ─── Alternative slot finder ─────────────────────────────────────────────────

export interface AlternativeSlot {
  start: string; // ISO
  end: string;   // ISO
  date: string;  // YYYY-MM-DD
  score: number; // 0–100
  label: string; // human-readable e.g. "Today 3:00 PM"
}

/**
 * Find alternative time slots for a given event that have no hard overlaps.
 * Respects snap-to-minutes, work hours, and work days from prefs.
 */
export function findAlternativeSlots(
  event: CalendarEventType,
  allEvents: CalendarEventType[],
  prefs: Pick<
    ReschedulingPreferences,
    | 'workdayStart'
    | 'workdayEnd'
    | 'workDays'
    | 'snapToMinutes'
    | 'autoSearchDays'
    | 'minBufferMinutes'
    | 'conflictCalendarIds'
  >,
  maxSuggestions = 5,
): AlternativeSlot[] {
  const slots: AlternativeSlot[] = [];
  const duration = dayjs(event.endsAt).diff(dayjs(event.startsAt), 'minute');
  const snap = prefs.snapToMinutes;

  for (let dayOffset = 0; dayOffset < prefs.autoSearchDays && slots.length < maxSuggestions; dayOffset++) {
    const date = dayjs().add(dayOffset, 'day');
    const dow = date.day();

    if (!prefs.workDays.includes(dow)) continue;

    for (
      let hour = prefs.workdayStart;
      hour < prefs.workdayEnd && slots.length < maxSuggestions;
      hour++
    ) {
      for (
        let minute = 0;
        minute < 60 && slots.length < maxSuggestions;
        minute += snap
      ) {
        const slotStart = date.hour(hour).minute(minute).second(0).millisecond(0);
        const slotEnd   = slotStart.add(duration, 'minute');

        // Don't go past end of work day
        if (slotEnd.hour() > prefs.workdayEnd) continue;

        // Check no hard overlap with any scoped event
        const excludedAlt = (prefs as any).conflictExcludedCalendarIds as string[] | undefined;
        const hasConflict = allEvents.some((e) => {
          if (e.id === event.id) return false;
          if (!isEventInScope(e, prefs.conflictCalendarIds, excludedAlt)) return false;
          const eStart = dayjs(e.startsAt).valueOf();
          const eEnd   = dayjs(e.endsAt).valueOf();
          const sStart = slotStart.valueOf();
          const sEnd   = slotEnd.valueOf();
          // include buffer gap
          const buf = prefs.minBufferMinutes * 60 * 1000;
          return sStart < eEnd + buf && eStart < sEnd + buf;
        });

        if (!hasConflict) {
          const isToday  = dayOffset === 0;
          const isTomorrow = dayOffset === 1;
          const dayLabel = isToday
            ? 'Today'
            : isTomorrow
            ? 'Tomorrow'
            : date.format('ddd MMM D');

          // Score: prefer earlier today, morning slots, exact day match
          let score = 70;
          if (isToday) score += 20;
          else if (isTomorrow) score += 10;
          if (hour >= 9 && hour <= 11) score += 5; // morning bonus
          score = Math.min(100, score);

          slots.push({
            start: slotStart.toISOString(),
            end:   slotEnd.toISOString(),
            date:  date.format('YYYY-MM-DD'),
            score,
            label: `${dayLabel} ${slotStart.format('h:mm A')} – ${slotEnd.format('h:mm A')}`,
          });
        }
      }
    }
  }

  return slots.sort((a, b) => b.score - a.score).slice(0, maxSuggestions);
}

// ─── Daily score helper ──────────────────────────────────────────────────────

export function calculateDailyConflictScore(
  events: CalendarEventType[],
  date: string,
  prefs: Parameters<typeof detectEventConflicts>[2],
): number {
  const dayEvents = events.filter((e) =>
    dayjs(e.startsAt).isSame(dayjs(date), 'day'),
  );

  if (dayEvents.length === 0) return 100;

  const total = dayEvents.reduce((sum, e) => {
    return sum + detectEventConflicts(e, events, prefs).score;
  }, 0);

  return Math.round(total / dayEvents.length);
}
