import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import type { CalendarEventType } from '@/lib/stores/types';

dayjs.extend(isBetween);

export type ConflictSeverity = 'critical' | 'warning' | 'info';

export interface EventConflict {
  id: string;
  severity: ConflictSeverity;
  type: 'overlap' | 'tight-schedule' | 'double-booking' | 'travel-time';
  message: string;
  conflictingEvents: CalendarEventType[];
  suggestions: string[];
}

export interface ConflictAnalysis {
  hasConflicts: boolean;
  conflicts: EventConflict[];
  score: number; // 0-100, where 100 is no conflicts
}

/**
 * Detect conflicts for a single event against all other events
 */
export function detectEventConflicts(
  event: CalendarEventType,
  allEvents: CalendarEventType[],
  bufferMinutes: number = 15
): ConflictAnalysis {
  const conflicts: EventConflict[] = [];
  const eventStart = dayjs(event.startsAt);
  const eventEnd = dayjs(event.endsAt);

  // Filter out the current event and get events on the same day
  const otherEvents = allEvents.filter(e => 
    e.id !== event.id && 
    dayjs(e.startsAt).isSame(eventStart, 'day')
  );

  otherEvents.forEach(otherEvent => {
    const otherStart = dayjs(otherEvent.startsAt);
    const otherEnd = dayjs(otherEvent.endsAt);

    // Check for complete overlap (Critical)
    if (
      (eventStart.isBetween(otherStart, otherEnd, null, '[)') ||
       eventEnd.isBetween(otherStart, otherEnd, null, '(]') ||
       (eventStart.isSameOrBefore(otherStart) && eventEnd.isSameOrAfter(otherEnd)))
    ) {
      conflicts.push({
        id: `overlap-${event.id}-${otherEvent.id}`,
        severity: 'critical',
        type: 'overlap',
        message: `Overlaps with "${otherEvent.title}"`,
        conflictingEvents: [otherEvent],
        suggestions: [
          `Move to ${otherEnd.format('h:mm A')} - ${otherEnd.add(eventEnd.diff(eventStart, 'minute'), 'minute').format('h:mm A')}`,
          `Shorten duration to ${otherStart.diff(eventStart, 'minute')} minutes`,
          `Move to next available slot`,
        ],
      });
    }
    // Check for tight schedule (Warning)
    else if (
      Math.abs(eventStart.diff(otherEnd, 'minute')) < bufferMinutes ||
      Math.abs(otherStart.diff(eventEnd, 'minute')) < bufferMinutes
    ) {
      const gap = Math.min(
        Math.abs(eventStart.diff(otherEnd, 'minute')),
        Math.abs(otherStart.diff(eventEnd, 'minute'))
      );
      
      conflicts.push({
        id: `tight-${event.id}-${otherEvent.id}`,
        severity: 'warning',
        type: 'tight-schedule',
        message: `Only ${gap} min gap with "${otherEvent.title}"`,
        conflictingEvents: [otherEvent],
        suggestions: [
          `Add ${bufferMinutes - gap} more minutes buffer`,
          `Move event to create proper spacing`,
        ],
      });
    }
  });

  // Calculate conflict score
  const criticalCount = conflicts.filter(c => c.severity === 'critical').length;
  const warningCount = conflicts.filter(c => c.severity === 'warning').length;
  const score = Math.max(0, 100 - (criticalCount * 40) - (warningCount * 15));

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    score,
  };
}

/**
 * Detect all conflicts in a date range
 */
export function detectAllConflicts(
  events: CalendarEventType[],
  startDate: string,
  endDate: string,
  bufferMinutes: number = 15
): Map<string, ConflictAnalysis> {
  const conflictMap = new Map<string, ConflictAnalysis>();
  
  const rangeEvents = events.filter(event => {
    const eventDate = dayjs(event.startsAt);
    return eventDate.isBetween(dayjs(startDate), dayjs(endDate), 'day', '[]');
  });

  rangeEvents.forEach(event => {
    const analysis = detectEventConflicts(event, events, bufferMinutes);
    if (analysis.hasConflicts) {
      conflictMap.set(event.id, analysis);
    }
  });

  return conflictMap;
}

/**
 * Find alternative time slots that don't conflict
 */
export function findAlternativeSlots(
  event: CalendarEventType,
  allEvents: CalendarEventType[],
  maxSuggestions: number = 5
): Date[] {
  const suggestions: Date[] = [];
  const eventDuration = dayjs(event.endsAt).diff(dayjs(event.startsAt), 'minute');
  const eventDate = dayjs(event.startsAt).startOf('day');
  
  // Work hours: 8 AM to 6 PM
  const workStart = 8;
  const workEnd = 18;
  
  for (let hour = workStart; hour < workEnd && suggestions.length < maxSuggestions; hour++) {
    for (let minute = 0; minute < 60 && suggestions.length < maxSuggestions; minute += 30) {
      const slotStart = eventDate.hour(hour).minute(minute);
      const slotEnd = slotStart.add(eventDuration, 'minute');
      
      // Skip if outside work hours
      if (slotEnd.hour() >= workEnd) continue;
      
      // Check if this slot conflicts
      const hasConflict = allEvents.some(e => {
        if (e.id === event.id) return false;
        const eStart = dayjs(e.startsAt);
        const eEnd = dayjs(e.endsAt);
        return (
          slotStart.isBetween(eStart, eEnd, null, '[)') ||
          slotEnd.isBetween(eStart, eEnd, null, '(]') ||
          (slotStart.isSameOrBefore(eStart) && slotEnd.isSameOrAfter(eEnd))
        );
      });
      
      if (!hasConflict) {
        suggestions.push(slotStart.toDate());
      }
    }
  }
  
  return suggestions;
}

/**
 * Calculate daily conflict score
 */
export function calculateDailyConflictScore(
  events: CalendarEventType[],
  date: string
): number {
  const dayEvents = events.filter(e => 
    dayjs(e.startsAt).isSame(dayjs(date), 'day')
  );
  
  let totalScore = 0;
  let count = 0;
  
  dayEvents.forEach(event => {
    const analysis = detectEventConflicts(event, events);
    totalScore += analysis.score;
    count++;
  });
  
  return count > 0 ? Math.round(totalScore / count) : 100;
}
