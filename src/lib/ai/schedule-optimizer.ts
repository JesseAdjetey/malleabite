// AI-Powered Schedule Optimization Engine
import { CalendarEventType } from '@/lib/stores/types';
import dayjs from 'dayjs';

export interface TimeSlot {
  start: Date;
  end: Date;
  score: number;
  reason: string;
}

export interface ScheduleSuggestion {
  type: 'optimal_time' | 'conflict_resolution' | 'productivity_tip' | 'pattern_insight';
  title: string;
  description: string;
  suggestedTime?: TimeSlot;
  priority: 'high' | 'medium' | 'low';
  actionable: boolean;
}

export interface UserPatterns {
  preferredWorkHours: { start: number; end: number };
  mostProductiveHours: number[];
  averageEventDuration: number;
  commonCategories: string[];
  busyDays: number[]; // 0-6, Sunday-Saturday
}

// Analyze user's calendar patterns
export function analyzeUserPatterns(events: CalendarEventType[]): UserPatterns {
  if (events.length === 0) {
    return getDefaultPatterns();
  }

  const eventsByHour: Record<number, number> = {};
  const eventsByDay: Record<number, number> = {};
  const categories: Record<string, number> = {};
  let totalDuration = 0;
  let eventCount = 0;

  events.forEach(event => {
    const start = dayjs(event.startsAt);
    const end = event.endsAt ? dayjs(event.endsAt) : start.add(1, 'hour');
    
    // Track hours
    const hour = start.hour();
    eventsByHour[hour] = (eventsByHour[hour] || 0) + 1;
    
    // Track days
    const day = start.day();
    eventsByDay[day] = (eventsByDay[day] || 0) + 1;
    
    // Track categories
    const category = event.color || 'default';
    categories[category] = (categories[category] || 0) + 1;
    
    // Track duration
    const duration = end.diff(start, 'minute');
    if (duration > 0 && duration < 480) { // Max 8 hours
      totalDuration += duration;
      eventCount++;
    }
  });

  // Find most productive hours (top 3)
  const sortedHours = Object.entries(eventsByHour)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([hour]) => parseInt(hour));

  // Find busiest days
  const busyDays = Object.entries(eventsByDay)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([day]) => parseInt(day));

  // Find common categories
  const commonCategories = Object.entries(categories)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([cat]) => cat);

  // Calculate preferred work hours
  const hours = Object.keys(eventsByHour).map(Number).sort((a, b) => a - b);
  const workStart = hours.length > 0 ? Math.min(...hours) : 9;
  const workEnd = hours.length > 0 ? Math.max(...hours) + 1 : 17;

  return {
    preferredWorkHours: { start: workStart, end: workEnd },
    mostProductiveHours: sortedHours.length > 0 ? sortedHours : [9, 10, 14],
    averageEventDuration: eventCount > 0 ? Math.round(totalDuration / eventCount) : 60,
    commonCategories,
    busyDays,
  };
}

function getDefaultPatterns(): UserPatterns {
  return {
    preferredWorkHours: { start: 9, end: 17 },
    mostProductiveHours: [9, 10, 14],
    averageEventDuration: 60,
    commonCategories: ['bg-blue-500/70', 'bg-green-500/70'],
    busyDays: [1, 2, 3], // Monday, Tuesday, Wednesday
  };
}

// Find optimal time slots for a new event
export function findOptimalTimeSlots(
  events: CalendarEventType[],
  date: Date,
  duration: number = 60, // minutes
  patterns: UserPatterns
): TimeSlot[] {
  const targetDate = dayjs(date);
  const slots: TimeSlot[] = [];
  
  // Get events for this day
  const dayEvents = events.filter(event => 
    dayjs(event.startsAt).isSame(targetDate, 'day')
  );

  // Generate potential slots
  for (let hour = patterns.preferredWorkHours.start; hour < patterns.preferredWorkHours.end; hour++) {
    const slotStart = targetDate.hour(hour).minute(0).second(0);
    const slotEnd = slotStart.add(duration, 'minute');
    
    // Check if slot is within work hours
    if (slotEnd.hour() > patterns.preferredWorkHours.end) continue;
    
    // Check for conflicts
    const hasConflict = dayEvents.some(event => {
      const eventStart = dayjs(event.startsAt);
      const eventEnd = event.endsAt ? dayjs(event.endsAt) : eventStart.add(1, 'hour');
      return slotStart.isBefore(eventEnd) && slotEnd.isAfter(eventStart);
    });
    
    if (hasConflict) continue;
    
    // Calculate score based on productivity patterns
    let score = 50; // Base score
    let reason = 'Available time slot';
    
    // Boost for productive hours
    if (patterns.mostProductiveHours.includes(hour)) {
      score += 30;
      reason = 'Your most productive hour';
    }
    
    // Boost for morning slots (fresh start)
    if (hour >= 9 && hour <= 11) {
      score += 10;
      reason = score > 70 ? reason : 'Morning focus time';
    }
    
    // Slight penalty for right after lunch
    if (hour === 13) {
      score -= 10;
    }
    
    // Boost for slots with buffer time
    const hasBufferBefore = !dayEvents.some(event => {
      const eventEnd = event.endsAt ? dayjs(event.endsAt) : dayjs(event.startsAt).add(1, 'hour');
      return eventEnd.isSame(slotStart) || eventEnd.add(15, 'minute').isAfter(slotStart);
    });
    
    if (hasBufferBefore) {
      score += 5;
    }
    
    slots.push({
      start: slotStart.toDate(),
      end: slotEnd.toDate(),
      score: Math.min(100, Math.max(0, score)),
      reason,
    });
  }
  
  // Sort by score
  return slots.sort((a, b) => b.score - a.score).slice(0, 5);
}

// Generate smart scheduling suggestions
export function generateScheduleSuggestions(
  events: CalendarEventType[],
  patterns: UserPatterns
): ScheduleSuggestion[] {
  const suggestions: ScheduleSuggestion[] = [];
  const today = dayjs();
  const weekEvents = events.filter(event => 
    dayjs(event.startsAt).isAfter(today) && 
    dayjs(event.startsAt).isBefore(today.add(7, 'day'))
  );

  // Check for overloaded days
  const eventsByDay: Record<string, number> = {};
  weekEvents.forEach(event => {
    const day = dayjs(event.startsAt).format('YYYY-MM-DD');
    eventsByDay[day] = (eventsByDay[day] || 0) + 1;
  });

  Object.entries(eventsByDay).forEach(([day, count]) => {
    if (count > 6) {
      suggestions.push({
        type: 'productivity_tip',
        title: 'Overloaded Day Detected',
        description: `${dayjs(day).format('dddd')} has ${count} events. Consider rescheduling some to maintain productivity.`,
        priority: 'high',
        actionable: true,
      });
    }
  });

  // Check for back-to-back meetings
  const sortedEvents = [...weekEvents].sort((a, b) => 
    dayjs(a.startsAt).valueOf() - dayjs(b.startsAt).valueOf()
  );

  let backToBackCount = 0;
  for (let i = 0; i < sortedEvents.length - 1; i++) {
    const currentEnd = sortedEvents[i].endsAt 
      ? dayjs(sortedEvents[i].endsAt) 
      : dayjs(sortedEvents[i].startsAt).add(1, 'hour');
    const nextStart = dayjs(sortedEvents[i + 1].startsAt);
    
    if (currentEnd.isSame(nextStart) || currentEnd.add(5, 'minute').isAfter(nextStart)) {
      backToBackCount++;
    }
  }

  if (backToBackCount >= 3) {
    suggestions.push({
      type: 'productivity_tip',
      title: 'Add Buffer Time',
      description: `You have ${backToBackCount} back-to-back events this week. Consider adding 10-15 minute breaks between meetings.`,
      priority: 'medium',
      actionable: true,
    });
  }

  // Pattern-based insights
  if (patterns.mostProductiveHours.length > 0) {
    const productiveHoursFormatted = patterns.mostProductiveHours
      .map(h => dayjs().hour(h).format('ha'))
      .join(', ');
    
    suggestions.push({
      type: 'pattern_insight',
      title: 'Your Peak Hours',
      description: `You're most active at ${productiveHoursFormatted}. Schedule important work during these times.`,
      priority: 'low',
      actionable: false,
    });
  }

  // Check for empty days (might want to batch)
  const daysThisWeek = Array.from({ length: 5 }, (_, i) => 
    today.add(i, 'day').format('YYYY-MM-DD')
  );
  
  const emptyDays = daysThisWeek.filter(day => !eventsByDay[day] || eventsByDay[day] === 0);
  
  if (emptyDays.length >= 2) {
    suggestions.push({
      type: 'optimal_time',
      title: 'Available Focus Days',
      description: `You have ${emptyDays.length} days with no events. Perfect for deep work or project time.`,
      priority: 'low',
      actionable: false,
    });
  }

  return suggestions.slice(0, 5); // Max 5 suggestions
}

// Detect scheduling conflicts
export function detectConflicts(events: CalendarEventType[]): {
  event1: CalendarEventType;
  event2: CalendarEventType;
  overlapMinutes: number;
}[] {
  const conflicts: { event1: CalendarEventType; event2: CalendarEventType; overlapMinutes: number }[] = [];
  
  const sortedEvents = [...events].sort((a, b) => 
    dayjs(a.startsAt).valueOf() - dayjs(b.startsAt).valueOf()
  );

  for (let i = 0; i < sortedEvents.length; i++) {
    for (let j = i + 1; j < sortedEvents.length; j++) {
      const event1 = sortedEvents[i];
      const event2 = sortedEvents[j];
      
      const start1 = dayjs(event1.startsAt);
      const end1 = event1.endsAt ? dayjs(event1.endsAt) : start1.add(1, 'hour');
      const start2 = dayjs(event2.startsAt);
      const end2 = event2.endsAt ? dayjs(event2.endsAt) : start2.add(1, 'hour');
      
      // Check if same day
      if (!start1.isSame(start2, 'day')) continue;
      
      // Check for overlap
      if (start1.isBefore(end2) && end1.isAfter(start2)) {
        const overlapStart = start1.isAfter(start2) ? start1 : start2;
        const overlapEnd = end1.isBefore(end2) ? end1 : end2;
        const overlapMinutes = overlapEnd.diff(overlapStart, 'minute');
        
        if (overlapMinutes > 0) {
          conflicts.push({ event1, event2, overlapMinutes });
        }
      }
    }
  }
  
  return conflicts;
}

// Smart event duration suggestion based on title
export function suggestEventDuration(title: string): number {
  const lowerTitle = title.toLowerCase();
  
  // Quick items
  if (lowerTitle.includes('quick') || lowerTitle.includes('brief') || lowerTitle.includes('sync')) {
    return 15;
  }
  
  // Calls and standups
  if (lowerTitle.includes('standup') || lowerTitle.includes('call') || lowerTitle.includes('check-in')) {
    return 15;
  }
  
  // Regular meetings
  if (lowerTitle.includes('meeting') || lowerTitle.includes('1:1') || lowerTitle.includes('one-on-one')) {
    return 30;
  }
  
  // Longer sessions
  if (lowerTitle.includes('workshop') || lowerTitle.includes('training') || lowerTitle.includes('session')) {
    return 60;
  }
  
  // Very long events
  if (lowerTitle.includes('all-day') || lowerTitle.includes('offsite') || lowerTitle.includes('retreat')) {
    return 480; // 8 hours
  }
  
  // Interviews
  if (lowerTitle.includes('interview')) {
    return 45;
  }
  
  // Focus time
  if (lowerTitle.includes('focus') || lowerTitle.includes('deep work') || lowerTitle.includes('project')) {
    return 120;
  }
  
  // Default
  return 60;
}
