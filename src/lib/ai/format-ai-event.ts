// Shared utility to format AI-generated event data for the calendar system
import dayjs from 'dayjs';
import type { CalendarEventType } from '@/lib/stores/types';
import { logger } from '@/lib/logger';

/**
 * Transforms raw AI event data into a properly formatted CalendarEventType.
 * Handles ISO datetime strings, HH:MM parsing, and description formatting
 * required by the addEvent system.
 */
export function formatAIEvent(event: Partial<CalendarEventType> & { start?: string; end?: string }): CalendarEventType {
  let startsAt = event.startsAt || event.start || '';
  let endsAt = event.endsAt || event.end || '';
  let eventDate = event.date;
  let description = event.description || '';

  // If startsAt is an ISO datetime string, parse it
  if (typeof startsAt === 'string' && startsAt.includes('T')) {
    const startDayjs = dayjs(startsAt);
    const endDayjs = dayjs(endsAt);

    const startTimeStr = startDayjs.format('HH:mm');
    const endTimeStr = endDayjs.format('HH:mm');

    // Update to HH:MM format for validation
    startsAt = startTimeStr;
    endsAt = endTimeStr;

    // Date must be a Date object for addEvent
    eventDate = startDayjs.toDate();

    // Prepend time to description for addEvent parsing logic
    description = `${startTimeStr} - ${endTimeStr} | ${description}`;
  }

  const formattedEvent: CalendarEventType = {
    id: event.id || crypto.randomUUID(),
    title: event.title || '',
    description,
    date: eventDate,
    startsAt,
    endsAt,
    color: event.color || 'bg-purple-500/70',
    isLocked: event.isLocked || false,
    isTodo: event.isTodo || false,
    hasAlarm: event.hasAlarm || false,
    hasReminder: event.hasReminder || false,
    todoId: event.todoId,
    isRecurring: event.isRecurring,
    recurrenceRule: event.recurrenceRule,
    calendarId: event.calendarId,
  };

  logger.debug('formatAIEvent', 'Formatted event', {
    title: formattedEvent.title,
    startsAt: formattedEvent.startsAt,
    endsAt: formattedEvent.endsAt,
  });

  return formattedEvent;
}
