// Phase 1.1: Smart Conflict Detection Hook
// Detects overlapping calendar events and provides conflict resolution suggestions

import { useMemo } from 'react';
import { CalendarEventType } from '@/lib/stores/types';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';

dayjs.extend(isBetween);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

export interface EventConflict {
  eventId: string;
  conflictingEventIds: string[];
  severity: 'high' | 'medium' | 'low'; // high = complete overlap, medium = partial, low = back-to-back
  suggestions: string[];
}

export interface ConflictDetectionResult {
  hasConflicts: boolean;
  conflicts: EventConflict[];
  totalConflicts: number;
  conflictingEventIds: Set<string>;
}

/**
 * Detects if two events overlap in time
 */
export function eventsOverlap(
  event1: CalendarEventType,
  event2: CalendarEventType
): boolean {
  if (!event1.startsAt || !event1.endsAt || !event2.startsAt || !event2.endsAt) {
    return false;
  }

  const start1 = dayjs(event1.startsAt);
  const end1 = dayjs(event1.endsAt);
  const start2 = dayjs(event2.startsAt);
  const end2 = dayjs(event2.endsAt);

  // Check if events overlap
  // Event1 starts before Event2 ends AND Event1 ends after Event2 starts
  return start1.isBefore(end2) && end1.isAfter(start2);
}

/**
 * Calculate conflict severity
 */
export function getConflictSeverity(
  event1: CalendarEventType,
  event2: CalendarEventType
): 'high' | 'medium' | 'low' {
  const start1 = dayjs(event1.startsAt);
  const end1 = dayjs(event1.endsAt);
  const start2 = dayjs(event2.startsAt);
  const end2 = dayjs(event2.endsAt);

  // Complete overlap - one event is entirely within another
  if (
    (start1.isSameOrBefore(start2) && end1.isSameOrAfter(end2)) ||
    (start2.isSameOrBefore(start1) && end2.isSameOrAfter(end1))
  ) {
    return 'high';
  }

  // Partial overlap - events overlap significantly (>50% of shorter event)
  const overlapStart = start1.isAfter(start2) ? start1 : start2;
  const overlapEnd = end1.isBefore(end2) ? end1 : end2;
  const overlapMinutes = overlapEnd.diff(overlapStart, 'minute');
  
  const event1Duration = end1.diff(start1, 'minute');
  const event2Duration = end2.diff(start2, 'minute');
  const shorterDuration = Math.min(event1Duration, event2Duration);
  
  if (overlapMinutes / shorterDuration > 0.5) {
    return 'medium';
  }

  // Low overlap - back-to-back or minimal overlap
  return 'low';
}

/**
 * Generate conflict resolution suggestions
 */
export function generateSuggestions(
  event: CalendarEventType,
  conflictingEvent: CalendarEventType
): string[] {
  const suggestions: string[] = [];
  const start = dayjs(event.startsAt);
  const end = dayjs(event.endsAt);
  const conflictStart = dayjs(conflictingEvent.startsAt);
  const conflictEnd = dayjs(conflictingEvent.endsAt);
  const duration = end.diff(start, 'minute');

  // Suggestion 1: Move to after conflicting event
  const afterConflict = conflictEnd.add(15, 'minute'); // Add 15min buffer
  suggestions.push(
    `Move to ${afterConflict.format('h:mm A')} - ${afterConflict.add(duration, 'minute').format('h:mm A')}`
  );

  // Suggestion 2: Move to before conflicting event
  const beforeConflict = conflictStart.subtract(duration + 15, 'minute');
  if (beforeConflict.isAfter(start.startOf('day').add(6, 'hour'))) {
    // Only suggest if not too early
    suggestions.push(
      `Move to ${beforeConflict.format('h:mm A')} - ${conflictStart.subtract(15, 'minute').format('h:mm A')}`
    );
  }

  // Suggestion 3: Move to next day same time
  const nextDay = start.add(1, 'day');
  suggestions.push(
    `Move to tomorrow at ${start.format('h:mm A')}`
  );

  // Suggestion 4: Shorten duration if high overlap
  const severity = getConflictSeverity(event, conflictingEvent);
  if (severity === 'high' || severity === 'medium') {
    suggestions.push('Consider shortening this event to avoid conflict');
  }

  return suggestions.slice(0, 3); // Return top 3 suggestions
}

/**
 * Main hook for conflict detection
 */
export function useConflictDetection(
  events: CalendarEventType[],
  currentEvent?: CalendarEventType
): ConflictDetectionResult {
  const result = useMemo(() => {
    const conflicts: EventConflict[] = [];
    const conflictingEventIds = new Set<string>();

    // If checking a specific event (e.g., during creation/edit)
    if (currentEvent) {
      const conflictingEvents = events.filter(
        (e) => e.id !== currentEvent.id && eventsOverlap(currentEvent, e)
      );

      if (conflictingEvents.length > 0) {
        const conflictingIds = conflictingEvents.map((e) => e.id);
        conflictingIds.forEach((id) => conflictingEventIds.add(id));

        const severity = conflictingEvents.reduce((maxSeverity, conflictingEvent) => {
          const currentSeverity = getConflictSeverity(currentEvent, conflictingEvent);
          if (currentSeverity === 'high') return 'high';
          if (currentSeverity === 'medium' && maxSeverity !== 'high') return 'medium';
          return maxSeverity;
        }, 'low' as 'high' | 'medium' | 'low');

        const suggestions = conflictingEvents.length === 1
          ? generateSuggestions(currentEvent, conflictingEvents[0])
          : ['Multiple conflicts detected. Consider rescheduling.'];

        conflicts.push({
          eventId: currentEvent.id || 'new-event',
          conflictingEventIds: conflictingIds,
          severity,
          suggestions,
        });
      }
    } else {
      // Check all events for conflicts
      const checkedPairs = new Set<string>();

      events.forEach((event1, index) => {
        const eventConflicts: string[] = [];

        events.forEach((event2, index2) => {
          if (index >= index2) return; // Skip self and already checked pairs

          const pairKey = `${event1.id}-${event2.id}`;
          const reversePairKey = `${event2.id}-${event1.id}`;

          if (checkedPairs.has(pairKey) || checkedPairs.has(reversePairKey)) {
            return;
          }

          if (eventsOverlap(event1, event2)) {
            eventConflicts.push(event2.id);
            conflictingEventIds.add(event1.id);
            conflictingEventIds.add(event2.id);
            checkedPairs.add(pairKey);
          }
        });

        if (eventConflicts.length > 0) {
          const firstConflict = events.find((e) => e.id === eventConflicts[0]);
          const severity = firstConflict
            ? getConflictSeverity(event1, firstConflict)
            : 'medium';

          const suggestions = eventConflicts.length === 1 && firstConflict
            ? generateSuggestions(event1, firstConflict)
            : ['Multiple conflicts detected. Review your schedule.'];

          conflicts.push({
            eventId: event1.id,
            conflictingEventIds: eventConflicts,
            severity,
            suggestions,
          });
        }
      });
    }

    return {
      hasConflicts: conflicts.length > 0,
      conflicts,
      totalConflicts: conflicts.length,
      conflictingEventIds,
    };
  }, [events, currentEvent]);

  return result;
}

/**
 * Helper to get all conflicts for a specific event
 */
export function getEventConflicts(
  eventId: string,
  conflictResult: ConflictDetectionResult
): EventConflict | undefined {
  return conflictResult.conflicts.find((c) => c.eventId === eventId);
}

/**
 * Helper to check if an event has conflicts
 */
export function hasEventConflict(
  eventId: string,
  conflictResult: ConflictDetectionResult
): boolean {
  return conflictResult.conflictingEventIds.has(eventId);
}
