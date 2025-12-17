// Find a Time Feature - Show overlapping availability for meeting attendees
import { useState, useCallback, useMemo } from 'react';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { CalendarEventType } from '@/lib/stores/types';
import { useWorkingHours } from './use-working-hours';

dayjs.extend(isBetween);

export interface Attendee {
  id: string;
  email: string;
  displayName?: string;
  events: CalendarEventType[];
  workingHours?: {
    [day: number]: { start: string; end: string }[];
  };
}

export interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
  conflicts: string[]; // attendee IDs that have conflicts
  score: number; // 0-1, higher is better
}

export interface FindTimeResult {
  date: Date;
  slots: TimeSlot[];
  bestSlots: TimeSlot[];
}

export interface FindTimeOptions {
  duration: number; // minutes
  startDate: Date;
  endDate: Date;
  startHour?: number; // earliest time to consider (default 9)
  endHour?: number; // latest time to consider (default 17)
  slotInterval?: number; // minutes between slots (default 30)
  excludeWeekends?: boolean;
  requiredAttendees?: string[]; // IDs of attendees that must be available
  preferredTimes?: 'morning' | 'afternoon' | 'any';
}

export function useFindTime(attendees: Attendee[]) {
  const { workingHours: myWorkingHours } = useWorkingHours();
  const [results, setResults] = useState<FindTimeResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Check if a time slot conflicts with an attendee's events
  const hasConflict = useCallback((
    attendee: Attendee,
    slotStart: Date,
    slotEnd: Date
  ): boolean => {
    return attendee.events.some(event => {
      const eventStart = dayjs(event.startsAt);
      const eventEnd = dayjs(event.endsAt);
      const start = dayjs(slotStart);
      const end = dayjs(slotEnd);

      // Check for overlap
      return (
        start.isBetween(eventStart, eventEnd, null, '[)') ||
        end.isBetween(eventStart, eventEnd, null, '(]') ||
        (start.isSameOrBefore(eventStart) && end.isSameOrAfter(eventEnd))
      );
    });
  }, []);

  // Check if a time slot is within working hours
  const isWithinWorkingHours = useCallback((
    attendee: Attendee,
    slotStart: Date,
    slotEnd: Date
  ): boolean => {
    const dayOfWeek = slotStart.getDay();
    const hours = attendee.workingHours?.[dayOfWeek];
    
    if (!hours || hours.length === 0) {
      // Default to 9-17 if no working hours set
      const hour = slotStart.getHours();
      return hour >= 9 && hour < 17;
    }

    const timeStr = dayjs(slotStart).format('HH:mm');
    const endTimeStr = dayjs(slotEnd).format('HH:mm');

    return hours.some(window => 
      timeStr >= window.start && endTimeStr <= window.end
    );
  }, []);

  // Calculate slot quality score
  const calculateScore = useCallback((
    slot: TimeSlot,
    options: FindTimeOptions,
    attendees: Attendee[]
  ): number => {
    let score = 1.0;

    // Penalty for conflicts
    const conflictRatio = slot.conflicts.length / attendees.length;
    score -= conflictRatio * 0.5;

    // Preference for time of day
    const hour = slot.start.getHours();
    if (options.preferredTimes === 'morning' && hour >= 9 && hour < 12) {
      score += 0.1;
    } else if (options.preferredTimes === 'afternoon' && hour >= 13 && hour < 17) {
      score += 0.1;
    }

    // Slight preference for on-the-hour times
    if (slot.start.getMinutes() === 0) {
      score += 0.05;
    }

    // Penalty for very early or very late
    if (hour < 9 || hour >= 17) {
      score -= 0.2;
    }

    return Math.max(0, Math.min(1, score));
  }, []);

  // Find available times
  const findAvailableTimes = useCallback(async (
    options: FindTimeOptions
  ): Promise<FindTimeResult[]> => {
    setLoading(true);
    const results: FindTimeResult[] = [];

    try {
      const {
        duration,
        startDate,
        endDate,
        startHour = 9,
        endHour = 17,
        slotInterval = 30,
        excludeWeekends = true,
        requiredAttendees = [],
      } = options;

      let currentDate = dayjs(startDate).startOf('day');
      const end = dayjs(endDate).endOf('day');

      while (currentDate.isBefore(end)) {
        const dayOfWeek = currentDate.day();
        
        // Skip weekends if requested
        if (excludeWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
          currentDate = currentDate.add(1, 'day');
          continue;
        }

        const slots: TimeSlot[] = [];
        let slotTime = currentDate.hour(startHour).minute(0);
        const dayEnd = currentDate.hour(endHour).minute(0);

        while (slotTime.add(duration, 'minute').isSameOrBefore(dayEnd)) {
          const slotStart = slotTime.toDate();
          const slotEnd = slotTime.add(duration, 'minute').toDate();

          // Check each attendee for conflicts
          const conflicts: string[] = [];
          let allRequiredAvailable = true;

          for (const attendee of attendees) {
            const hasEventConflict = hasConflict(attendee, slotStart, slotEnd);
            const withinHours = isWithinWorkingHours(attendee, slotStart, slotEnd);

            if (hasEventConflict || !withinHours) {
              conflicts.push(attendee.id);
              
              if (requiredAttendees.includes(attendee.id)) {
                allRequiredAvailable = false;
              }
            }
          }

          const slot: TimeSlot = {
            start: slotStart,
            end: slotEnd,
            available: conflicts.length === 0,
            conflicts,
            score: 0,
          };

          // Only include slots where all required attendees are available
          if (allRequiredAvailable) {
            slot.score = calculateScore(slot, options, attendees);
            slots.push(slot);
          }

          slotTime = slotTime.add(slotInterval, 'minute');
        }

        // Get best slots for this day (top 3 by score)
        const bestSlots = slots
          .filter(s => s.available)
          .sort((a, b) => b.score - a.score)
          .slice(0, 3);

        results.push({
          date: currentDate.toDate(),
          slots,
          bestSlots,
        });

        currentDate = currentDate.add(1, 'day');
      }

      setResults(results);
      return results;
    } finally {
      setLoading(false);
    }
  }, [attendees, hasConflict, isWithinWorkingHours, calculateScore]);

  // Get summary of availability
  const getAvailabilitySummary = useMemo(() => {
    if (results.length === 0) return null;

    const totalSlots = results.reduce((sum, r) => sum + r.slots.length, 0);
    const availableSlots = results.reduce(
      (sum, r) => sum + r.slots.filter(s => s.available).length,
      0
    );
    const bestOverallSlots = results
      .flatMap(r => r.bestSlots)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return {
      totalSlots,
      availableSlots,
      availabilityPercentage: totalSlots > 0 ? (availableSlots / totalSlots) * 100 : 0,
      bestOverallSlots,
      daysWithAvailability: results.filter(r => r.bestSlots.length > 0).length,
    };
  }, [results]);

  // Quick suggest - get the next best available time
  const suggestNextAvailable = useCallback(async (
    duration: number,
    startFrom: Date = new Date()
  ): Promise<TimeSlot | null> => {
    const results = await findAvailableTimes({
      duration,
      startDate: startFrom,
      endDate: dayjs(startFrom).add(14, 'day').toDate(),
      excludeWeekends: true,
    });

    for (const dayResult of results) {
      if (dayResult.bestSlots.length > 0) {
        return dayResult.bestSlots[0];
      }
    }

    return null;
  }, [findAvailableTimes]);

  return {
    results,
    loading,
    findAvailableTimes,
    getAvailabilitySummary,
    suggestNextAvailable,
  };
}

export default useFindTime;
