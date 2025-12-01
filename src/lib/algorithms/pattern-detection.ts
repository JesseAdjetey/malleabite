// Phase 2.4: Pattern Detection Algorithm
// Analyzes user scheduling patterns to provide smart suggestions

import { CalendarEventType } from '@/lib/stores/types';
import dayjs from 'dayjs';

export interface SchedulingPattern {
  type: 'recurring' | 'time-preference' | 'duration-preference' | 'category-cluster';
  confidence: number; // 0-1
  description: string;
  suggestion: string;
  data: any;
}

export interface TimePreference {
  dayOfWeek: number; // 0-6
  hour: number; // 0-23
  category?: string;
  frequency: number;
}

export interface DurationPattern {
  category: string;
  averageDuration: number; // minutes
  standardDeviation: number;
  sampleSize: number;
}

export interface RecurringPattern {
  title: string;
  dayOfWeek?: number;
  timeOfDay?: number; // hour
  frequency: 'daily' | 'weekly' | 'monthly';
  lastOccurrence: string;
  nextSuggested: string;
}

/**
 * Detect time preferences for different event categories
 */
export function detectTimePreferences(events: CalendarEventType[]): TimePreference[] {
  const preferences: Map<string, TimePreference[]> = new Map();

  events.forEach((event) => {
    const start = dayjs(event.startsAt);
    const dayOfWeek = start.day();
    const hour = start.hour();
    const category = event.color || 'default'; // Using color as category

    const key = `${dayOfWeek}-${hour}-${category}`;
    const existing = preferences.get(key);

    if (existing && existing.length > 0) {
      existing[0].frequency++;
    } else {
      preferences.set(key, [{
        dayOfWeek,
        hour,
        category,
        frequency: 1,
      }]);
    }
  });

  // Filter patterns with frequency >= 3
  return Array.from(preferences.values())
    .flat()
    .filter(p => p.frequency >= 3)
    .sort((a, b) => b.frequency - a.frequency);
}

/**
 * Detect average durations for event types
 */
export function detectDurationPatterns(events: CalendarEventType[]): DurationPattern[] {
  const categoryDurations: Map<string, number[]> = new Map();

  events.forEach((event) => {
    const start = dayjs(event.startsAt);
    const end = dayjs(event.endsAt);
    const duration = end.diff(start, 'minutes');
    const category = event.title.toLowerCase();

    const existing = categoryDurations.get(category) || [];
    existing.push(duration);
    categoryDurations.set(category, existing);
  });

  const patterns: DurationPattern[] = [];

  categoryDurations.forEach((durations, category) => {
    if (durations.length >= 3) {
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const variance = durations.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / durations.length;
      const stdDev = Math.sqrt(variance);

      patterns.push({
        category,
        averageDuration: Math.round(avg),
        standardDeviation: Math.round(stdDev),
        sampleSize: durations.length,
      });
    }
  });

  return patterns.sort((a, b) => b.sampleSize - a.sampleSize);
}

/**
 * Detect recurring event patterns
 */
export function detectRecurringPatterns(events: CalendarEventType[]): RecurringPattern[] {
  const titleGroups: Map<string, CalendarEventType[]> = new Map();

  // Group events by normalized title
  events.forEach((event) => {
    const normalizedTitle = event.title.toLowerCase().trim();
    const existing = titleGroups.get(normalizedTitle) || [];
    existing.push(event);
    titleGroups.set(normalizedTitle, existing);
  });

  const patterns: RecurringPattern[] = [];

  titleGroups.forEach((eventGroup, title) => {
    if (eventGroup.length >= 3) {
      // Sort by date
      const sorted = eventGroup.sort((a, b) => 
        dayjs(a.startsAt).diff(dayjs(b.startsAt))
      );

      // Calculate intervals between events
      const intervals: number[] = [];
      for (let i = 1; i < sorted.length; i++) {
        const days = dayjs(sorted[i].startsAt).diff(dayjs(sorted[i - 1].startsAt), 'days');
        intervals.push(days);
      }

      // Determine frequency
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      let frequency: 'daily' | 'weekly' | 'monthly';
      
      if (avgInterval <= 2) frequency = 'daily';
      else if (avgInterval <= 9) frequency = 'weekly';
      else frequency = 'monthly';

      // Get common day of week
      const daysOfWeek = sorted.map(e => dayjs(e.startsAt).day());
      const mostCommonDay = mode(daysOfWeek);

      // Get common time of day
      const hours = sorted.map(e => dayjs(e.startsAt).hour());
      const mostCommonHour = mode(hours);

      const lastEvent = sorted[sorted.length - 1];
      const lastOccurrence = dayjs(lastEvent.startsAt);
      
      let nextSuggested = lastOccurrence;
      if (frequency === 'daily') nextSuggested = lastOccurrence.add(1, 'day');
      else if (frequency === 'weekly') nextSuggested = lastOccurrence.add(1, 'week');
      else nextSuggested = lastOccurrence.add(1, 'month');

      patterns.push({
        title,
        dayOfWeek: mostCommonDay,
        timeOfDay: mostCommonHour,
        frequency,
        lastOccurrence: lastOccurrence.toISOString(),
        nextSuggested: nextSuggested.toISOString(),
      });
    }
  });

  return patterns;
}

/**
 * Generate smart suggestions based on detected patterns
 */
export function generateSmartSuggestions(events: CalendarEventType[]): SchedulingPattern[] {
  const suggestions: SchedulingPattern[] = [];

  // Analyze recent events (last 30 days)
  const recentEvents = events.filter(e => 
    dayjs(e.startsAt).isAfter(dayjs().subtract(30, 'days'))
  );

  // 1. Recurring pattern suggestions
  const recurringPatterns = detectRecurringPatterns(recentEvents);
  recurringPatterns.slice(0, 3).forEach(pattern => {
    const nextDate = dayjs(pattern.nextSuggested);
    const isOverdue = nextDate.isBefore(dayjs());
    
    if (isOverdue || nextDate.diff(dayjs(), 'days') <= 2) {
      suggestions.push({
        type: 'recurring',
        confidence: 0.8,
        description: `"${pattern.title}" appears to be ${pattern.frequency}`,
        suggestion: `Schedule next "${pattern.title}" for ${nextDate.format('MMM D')} at ${pattern.timeOfDay}:00`,
        data: pattern,
      });
    }
  });

  // 2. Time preference suggestions
  const timePreferences = detectTimePreferences(recentEvents);
  const topPreference = timePreferences[0];
  
  if (topPreference && topPreference.frequency >= 5) {
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][topPreference.dayOfWeek];
    suggestions.push({
      type: 'time-preference',
      confidence: 0.7,
      description: `You often schedule events on ${dayName}s at ${topPreference.hour}:00`,
      suggestion: `Consider blocking this time for focused work`,
      data: topPreference,
    });
  }

  // 3. Duration suggestions
  const durationPatterns = detectDurationPatterns(recentEvents);
  durationPatterns.slice(0, 2).forEach(pattern => {
    if (pattern.sampleSize >= 5) {
      suggestions.push({
        type: 'duration-preference',
        confidence: 0.6,
        description: `"${pattern.category}" events typically last ${pattern.averageDuration} minutes`,
        suggestion: `Set default duration to ${pattern.averageDuration} min for similar events`,
        data: pattern,
      });
    }
  });

  // 4. Category clustering suggestions
  const morningEvents = recentEvents.filter(e => {
    const hour = dayjs(e.startsAt).hour();
    return hour >= 6 && hour < 12;
  });

  const afternoonEvents = recentEvents.filter(e => {
    const hour = dayjs(e.startsAt).hour();
    return hour >= 12 && hour < 17;
  });

  if (morningEvents.length > afternoonEvents.length * 1.5) {
    suggestions.push({
      type: 'category-cluster',
      confidence: 0.7,
      description: `You're most active in mornings (${morningEvents.length} vs ${afternoonEvents.length} events)`,
      suggestion: `Schedule important tasks in the morning when you're most productive`,
      data: { morningCount: morningEvents.length, afternoonCount: afternoonEvents.length },
    });
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}

/**
 * Helper: Find mode (most common value) in array
 */
function mode(arr: number[]): number | undefined {
  if (arr.length === 0) return undefined;
  
  const counts = new Map<number, number>();
  arr.forEach(val => {
    counts.set(val, (counts.get(val) || 0) + 1);
  });

  let maxCount = 0;
  let modeValue = arr[0];
  
  counts.forEach((count, val) => {
    if (count > maxCount) {
      maxCount = count;
      modeValue = val;
    }
  });

  return modeValue;
}

/**
 * Suggest best time to schedule a new event based on patterns
 */
export function suggestBestTime(
  eventTitle: string,
  duration: number,
  events: CalendarEventType[]
): { date: string; time: string; confidence: number; reason: string }[] {
  const patterns = generateSmartSuggestions(events);
  const timePrefs = detectTimePreferences(events);
  const suggestions: { date: string; time: string; confidence: number; reason: string }[] = [];

  // Check for recurring patterns matching the title
  const matchingRecurring = patterns.find(p => 
    p.type === 'recurring' && 
    (p.data as RecurringPattern).title.toLowerCase().includes(eventTitle.toLowerCase())
  );

  if (matchingRecurring) {
    const pattern = matchingRecurring.data as RecurringPattern;
    suggestions.push({
      date: dayjs(pattern.nextSuggested).format('YYYY-MM-DD'),
      time: `${pattern.timeOfDay?.toString().padStart(2, '0')}:00`,
      confidence: matchingRecurring.confidence,
      reason: `Based on your ${pattern.frequency} pattern`,
    });
  }

  // Suggest based on time preferences
  if (timePrefs.length > 0) {
    const topPref = timePrefs[0];
    const nextOccurrence = dayjs().day(topPref.dayOfWeek);
    
    suggestions.push({
      date: nextOccurrence.format('YYYY-MM-DD'),
      time: `${topPref.hour.toString().padStart(2, '0')}:00`,
      confidence: 0.6,
      reason: `You often schedule at this time`,
    });
  }

  return suggestions.slice(0, 3);
}
