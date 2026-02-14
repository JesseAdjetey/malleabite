// Utilities for handling recurring events
import { CalendarEventType, RecurrenceRule } from '@/lib/stores/types';

/**
 * Generate recurring event instances based on the recurrence rule
 * @param baseEvent The base event with recurrence settings
 * @param startDate Start date for generation
 * @param endDate End date for generation
 * @returns Array of generated event instances
 */
export function generateRecurringInstances(
  baseEvent: CalendarEventType,
  startDate: Date,
  endDate: Date
): CalendarEventType[] {
  if (!baseEvent.isRecurring || !baseEvent.recurrenceRule) {
    return [baseEvent];
  }

  const instances: CalendarEventType[] = [];
  const rule = baseEvent.recurrenceRule;
  
  // Calculate event duration for consistent instance lengths
  const originalStart = new Date(baseEvent.startsAt);
  const originalEnd = new Date(baseEvent.endsAt);
  const duration = originalEnd.getTime() - originalStart.getTime();

  let currentDate = new Date(originalStart);
  let instanceCount = 0;
  const maxInstances = rule.count || 365; // Default to 365 occurrences max

  // Generate instances up to endDate or count limit
  while (currentDate <= endDate && instanceCount < maxInstances) {
    // Check if this date should be skipped (in exceptions)
    const dateStr = currentDate.toISOString().split('T')[0];
    if (baseEvent.recurrenceExceptions?.includes(dateStr)) {
      currentDate = getNextOccurrence(currentDate, rule);
      continue;
    }

    // Check if instance matches the recurrence rule
    if (matchesRecurrenceRule(currentDate, originalStart, rule)) {
      // Create instance
      const instanceStart = new Date(currentDate);
      const instanceEnd = new Date(instanceStart.getTime() + duration);

      instances.push({
        ...baseEvent,
        id: `${baseEvent.id}_${dateStr}`,
        startsAt: instanceStart.toISOString(),
        endsAt: instanceEnd.toISOString(),
        recurrenceParentId: baseEvent.id,
        isRecurring: false, // Instances themselves are not recurring
        recurrenceRule: undefined,
      });

      instanceCount++;
    }

    // Move to next potential occurrence
    currentDate = getNextOccurrence(currentDate, rule);

    // Stop if we've passed the rule's end date
    if (rule.endDate && currentDate > new Date(rule.endDate)) {
      break;
    }
  }

  return instances;
}

/**
 * Check if a date matches the recurrence rule criteria
 */
// Map byDay string codes to JS day numbers (0=Sun, 1=Mon, ...)
const BY_DAY_MAP: Record<string, number> = {
  SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6,
};

function matchesRecurrenceRule(
  date: Date,
  originalDate: Date,
  rule: RecurrenceRule
): boolean {
  // Support both 'frequency' (standard) and 'freq' (legacy AI-generated field)
  const frequency = rule.frequency || (rule as any).freq;
  switch (frequency) {
    case 'daily':
      return true; // All dates match for daily

    case 'weekly': {
      // Check byDay string array first (e.g. ["MO","WE","FR"] from AI)
      if (rule.byDay && rule.byDay.length > 0) {
        const dayNums = rule.byDay.map(d => BY_DAY_MAP[d.toUpperCase()]).filter(n => n !== undefined);
        if (dayNums.length > 0) return dayNums.includes(date.getDay());
      }
      if (!rule.daysOfWeek || rule.daysOfWeek.length === 0) {
        // If no specific days, match the original day of week
        return date.getDay() === originalDate.getDay();
      }
      // Check if current day is in the specified days
      return rule.daysOfWeek.includes(date.getDay());
    }

    case 'monthly':
      if (rule.dayOfMonth) {
        return date.getDate() === rule.dayOfMonth;
      }
      // Default to matching original day of month
      return date.getDate() === originalDate.getDate();

    case 'yearly':
      if (rule.monthOfYear !== undefined && rule.dayOfMonth) {
        return date.getMonth() === rule.monthOfYear && 
               date.getDate() === rule.dayOfMonth;
      }
      // Default to matching original month and day
      return date.getMonth() === originalDate.getMonth() &&
             date.getDate() === originalDate.getDate();

    default:
      return false;
  }
}

/**
 * Get the next occurrence date based on recurrence rule
 */
function getNextOccurrence(currentDate: Date, rule: RecurrenceRule): Date {
  const next = new Date(currentDate);
  // Support both 'frequency' (standard) and 'freq' (legacy AI-generated field)
  const frequency = rule.frequency || (rule as any).freq;

  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + (rule.interval || 1));
      break;

    case 'weekly':
      // When byDay is set, step 1 day at a time so we can match each day
      if (rule.byDay && rule.byDay.length > 1) {
        next.setDate(next.getDate() + 1);
      } else {
        next.setDate(next.getDate() + (7 * (rule.interval || 1)));
      }
      break;

    case 'monthly':
      next.setMonth(next.getMonth() + (rule.interval || 1));
      break;

    case 'yearly':
      next.setFullYear(next.getFullYear() + (rule.interval || 1));
      break;
  }

  return next;
}

/**
 * Check if a new recurring event would conflict with existing events
 * @param newEvent The new recurring event to check
 * @param existingEvents Array of existing events
 * @param checkRange How many months ahead to check
 * @returns Array of conflicts
 */
export function checkRecurringConflicts(
  newEvent: CalendarEventType,
  existingEvents: CalendarEventType[],
  checkRange: number = 3
): Array<{ date: string; conflictingEvent: CalendarEventType }> {
  if (!newEvent.isRecurring) {
    return [];
  }

  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + checkRange);

  // Generate instances for the check range
  const instances = generateRecurringInstances(newEvent, startDate, endDate);
  const conflicts: Array<{ date: string; conflictingEvent: CalendarEventType }> = [];

  // Check each instance against existing events
  for (const instance of instances) {
    const instanceStart = new Date(instance.startsAt);
    const instanceEnd = new Date(instance.endsAt);

    for (const existing of existingEvents) {
      // Skip if same event
      if (existing.id === newEvent.id) continue;

      const existingStart = new Date(existing.startsAt);
      const existingEnd = new Date(existing.endsAt);

      // Check for time overlap
      if (instanceStart < existingEnd && instanceEnd > existingStart) {
        conflicts.push({
          date: instanceStart.toISOString().split('T')[0],
          conflictingEvent: existing
        });
      }
    }
  }

  return conflicts;
}

/**
 * Format recurrence rule for display
 */
export function formatRecurrenceRule(rule: RecurrenceRule): string {
  // Support both 'frequency' (standard) and 'freq' (legacy AI-generated field)
  const frequency = rule.frequency || (rule as any).freq || 'weekly';
  const { interval = 1, daysOfWeek, dayOfMonth, monthOfYear, endDate, count } = rule;

  let description = '';

  // Frequency description
  if (interval === 1) {
    description = frequency;
  } else {
    description = `every ${interval} ${frequency === 'daily' ? 'days' : frequency === 'weekly' ? 'weeks' : frequency === 'monthly' ? 'months' : 'years'}`;
  }

  // Days specification — check both daysOfWeek (numbers) and byDay (strings)
  if (frequency === 'weekly') {
    if (rule.byDay && rule.byDay.length > 0) {
      description += ` on ${rule.byDay.join(', ')}`;
    } else if (daysOfWeek && daysOfWeek.length > 0) {
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const days = daysOfWeek.map(d => dayNames[d]).join(', ');
      description += ` on ${days}`;
    }
  }

  if (frequency === 'monthly' && dayOfMonth) {
    description += ` on day ${dayOfMonth}`;
  }

  if (frequency === 'yearly' && monthOfYear !== undefined && dayOfMonth) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    description += ` on ${monthNames[monthOfYear]} ${dayOfMonth}`;
  }

  // End condition
  if (endDate) {
    const end = new Date(endDate);
    description += ` until ${end.toLocaleDateString()}`;
  } else if (count) {
    description += ` for ${count} occurrences`;
  }

  return description;
}

/**
 * Parse a natural language recurrence description into a RecurrenceRule
 * This is a helper for AI-generated recurrence patterns
 */
export function parseRecurrenceDescription(description: string): RecurrenceRule | null {
  const lower = description.toLowerCase();
  
  // Daily patterns
  if (lower.includes('every day') || lower.includes('daily')) {
    return { frequency: 'daily', interval: 1 };
  }
  
  // Weekday patterns (Mon-Fri)
  if (lower.includes('weekday') || lower.includes('monday to friday') || 
      lower.includes('mon-fri') || lower.includes('mon - fri') ||
      lower.includes('every weekday')) {
    return { 
      frequency: 'weekly', 
      interval: 1,
      daysOfWeek: [1, 2, 3, 4, 5] // Monday through Friday
    };
  }
  
  // Weekend patterns (Sat-Sun)
  if (lower.includes('weekend') || lower.includes('saturday and sunday') ||
      lower.includes('sat and sun')) {
    return { 
      frequency: 'weekly', 
      interval: 1,
      daysOfWeek: [0, 6] // Saturday and Sunday
    };
  }
  
  // Weekly patterns
  if (lower.includes('every week') || lower.includes('weekly')) {
    const daysOfWeek = extractDaysOfWeek(lower);
    return { 
      frequency: 'weekly', 
      interval: 1,
      daysOfWeek: daysOfWeek.length > 0 ? daysOfWeek : undefined
    };
  }
  
  // Biweekly
  if (lower.includes('every 2 weeks') || lower.includes('biweekly') || lower.includes('bi-weekly')) {
    return { frequency: 'weekly', interval: 2 };
  }
  
  // Monthly patterns
  if (lower.includes('every month') || lower.includes('monthly')) {
    return { frequency: 'monthly', interval: 1 };
  }
  
  // Yearly patterns
  if (lower.includes('every year') || lower.includes('yearly') || lower.includes('annually')) {
    return { frequency: 'yearly', interval: 1 };
  }
  
  return null;
}

/**
 * Extract days of week from natural language
 */
function extractDaysOfWeek(text: string): number[] {
  const dayMap: Record<string, number> = {
    'sunday': 0, 'sun': 0,
    'monday': 1, 'mon': 1,
    'tuesday': 2, 'tue': 2, 'tues': 2,
    'wednesday': 3, 'wed': 3,
    'thursday': 4, 'thu': 4, 'thur': 4, 'thurs': 4,
    'friday': 5, 'fri': 5,
    'saturday': 6, 'sat': 6
  };
  
  const days: Set<number> = new Set();
  
  // Handle "weekday" specifically
  if (text.includes('weekday')) {
    return [1, 2, 3, 4, 5];
  }
  
  // Handle "weekend" specifically
  if (text.includes('weekend')) {
    return [0, 6];
  }
  
  for (const [key, value] of Object.entries(dayMap)) {
    // Use word boundaries to avoid false matches
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(text)) {
      days.add(value);
    }
  }
  
  return Array.from(days).sort((a, b) => a - b);
}
