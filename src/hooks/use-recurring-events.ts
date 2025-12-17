// Recurring Event Editing Hook - Edit single, all, or future occurrences
import { useState, useCallback } from 'react';
import dayjs from 'dayjs';
import { CalendarEventType, RecurrenceRule } from '@/lib/stores/types';
import { toast } from 'sonner';

export type EditScope = 'single' | 'all' | 'thisAndFuture';

export interface RecurringEditResult {
  success: boolean;
  affectedEvents: CalendarEventType[];
  newEvents?: CalendarEventType[];
  deletedEventIds?: string[];
}

export interface RecurringDeleteResult {
  success: boolean;
  deletedEventIds: string[];
  updatedParent?: CalendarEventType;
}

export function useRecurringEvents() {
  const [isProcessing, setIsProcessing] = useState(false);

  // Generate a new ID for split events
  const generateId = useCallback(() => crypto.randomUUID(), []);

  // Edit a recurring event with scope
  const editRecurringEvent = useCallback(async (
    event: CalendarEventType,
    updates: Partial<CalendarEventType>,
    scope: EditScope,
    occurrenceDate: Date,
    updateEventFn: (event: CalendarEventType) => Promise<void>,
    createEventFn: (event: CalendarEventType) => Promise<void>,
    deleteEventFn: (id: string) => Promise<void>
  ): Promise<RecurringEditResult> => {
    setIsProcessing(true);
    
    try {
      const affectedEvents: CalendarEventType[] = [];
      const newEvents: CalendarEventType[] = [];
      const deletedEventIds: string[] = [];

      switch (scope) {
        case 'single': {
          // Create an exception for this occurrence
          // The original event remains unchanged, but we add this date to exceptions
          // and create a new one-off event for this date
          
          const exceptionDate = dayjs(occurrenceDate).format('YYYY-MM-DD');
          
          // Update parent to add exception
          const parentUpdates: Partial<CalendarEventType> = {
            recurrenceExceptions: [
              ...(event.recurrenceExceptions || []),
              exceptionDate,
            ],
          };
          
          const updatedParent = { ...event, ...parentUpdates };
          await updateEventFn(updatedParent);
          affectedEvents.push(updatedParent);
          
          // Create new one-off event for this occurrence
          const singleEvent: CalendarEventType = {
            ...event,
            ...updates,
            id: generateId(),
            isRecurring: false,
            recurrenceRule: undefined,
            recurrenceParentId: event.id,
            recurrenceExceptions: undefined,
            startsAt: dayjs(occurrenceDate)
              .hour(dayjs(event.startsAt).hour())
              .minute(dayjs(event.startsAt).minute())
              .toISOString(),
            endsAt: dayjs(occurrenceDate)
              .hour(dayjs(event.endsAt).hour())
              .minute(dayjs(event.endsAt).minute())
              .toISOString(),
          };
          
          await createEventFn(singleEvent);
          newEvents.push(singleEvent);
          
          toast.success('This occurrence updated');
          break;
        }

        case 'all': {
          // Update the recurring event series - all occurrences
          const updatedEvent = { ...event, ...updates };
          await updateEventFn(updatedEvent);
          affectedEvents.push(updatedEvent);
          
          toast.success('All occurrences updated');
          break;
        }

        case 'thisAndFuture': {
          // Split the series: end the original at this occurrence
          // and create a new series starting from this occurrence
          
          const splitDate = dayjs(occurrenceDate).subtract(1, 'day').format('YYYY-MM-DD');
          
          // Update original series to end before this occurrence
          const originalUpdates: Partial<CalendarEventType> = {
            recurrenceRule: event.recurrenceRule ? {
              ...event.recurrenceRule,
              endDate: splitDate,
            } : undefined,
          };
          
          const updatedOriginal = { ...event, ...originalUpdates };
          await updateEventFn(updatedOriginal);
          affectedEvents.push(updatedOriginal);
          
          // Create new series starting from this occurrence
          const newSeries: CalendarEventType = {
            ...event,
            ...updates,
            id: generateId(),
            startsAt: dayjs(occurrenceDate)
              .hour(dayjs(event.startsAt).hour())
              .minute(dayjs(event.startsAt).minute())
              .toISOString(),
            endsAt: dayjs(occurrenceDate)
              .hour(dayjs(event.endsAt).hour())
              .minute(dayjs(event.endsAt).minute())
              .toISOString(),
            recurrenceRule: event.recurrenceRule ? {
              ...event.recurrenceRule,
              // Keep original end date or count if set
              endDate: event.recurrenceRule.endDate,
              count: event.recurrenceRule.count,
            } : undefined,
            recurrenceExceptions: [],
          };
          
          await createEventFn(newSeries);
          newEvents.push(newSeries);
          
          toast.success('This and future occurrences updated');
          break;
        }
      }

      return {
        success: true,
        affectedEvents,
        newEvents,
        deletedEventIds,
      };
    } catch (error) {
      console.error('Failed to edit recurring event:', error);
      toast.error('Failed to update event');
      return {
        success: false,
        affectedEvents: [],
      };
    } finally {
      setIsProcessing(false);
    }
  }, [generateId]);

  // Delete a recurring event with scope
  const deleteRecurringEvent = useCallback(async (
    event: CalendarEventType,
    scope: EditScope,
    occurrenceDate: Date,
    updateEventFn: (event: CalendarEventType) => Promise<void>,
    deleteEventFn: (id: string) => Promise<void>
  ): Promise<RecurringDeleteResult> => {
    setIsProcessing(true);
    
    try {
      const deletedEventIds: string[] = [];
      let updatedParent: CalendarEventType | undefined;

      switch (scope) {
        case 'single': {
          // Add this date to exceptions
          const exceptionDate = dayjs(occurrenceDate).format('YYYY-MM-DD');
          
          updatedParent = {
            ...event,
            recurrenceExceptions: [
              ...(event.recurrenceExceptions || []),
              exceptionDate,
            ],
          };
          
          await updateEventFn(updatedParent);
          toast.success('This occurrence deleted');
          break;
        }

        case 'all': {
          // Delete the entire series
          await deleteEventFn(event.id);
          deletedEventIds.push(event.id);
          
          // Also delete any exception events that reference this parent
          // This would need to be handled by querying for recurrenceParentId
          
          toast.success('All occurrences deleted');
          break;
        }

        case 'thisAndFuture': {
          // End the series at this occurrence
          const endDate = dayjs(occurrenceDate).subtract(1, 'day').format('YYYY-MM-DD');
          
          updatedParent = {
            ...event,
            recurrenceRule: event.recurrenceRule ? {
              ...event.recurrenceRule,
              endDate,
              count: undefined, // Clear count since we're using end date
            } : undefined,
          };
          
          await updateEventFn(updatedParent);
          toast.success('This and future occurrences deleted');
          break;
        }
      }

      return {
        success: true,
        deletedEventIds,
        updatedParent,
      };
    } catch (error) {
      console.error('Failed to delete recurring event:', error);
      toast.error('Failed to delete event');
      return {
        success: false,
        deletedEventIds: [],
      };
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Generate occurrence dates for a recurring event
  const generateOccurrences = useCallback((
    event: CalendarEventType,
    startDate: Date,
    endDate: Date
  ): Date[] => {
    if (!event.isRecurring || !event.recurrenceRule) {
      return [new Date(event.startsAt)];
    }

    const occurrences: Date[] = [];
    const rule = event.recurrenceRule;
    const exceptions = new Set(event.recurrenceExceptions || []);
    
    let currentDate = dayjs(event.startsAt);
    const end = dayjs(endDate);
    const ruleEnd = rule.endDate ? dayjs(rule.endDate) : null;
    const maxOccurrences = rule.count || 1000;
    let count = 0;

    while (
      currentDate.isBefore(end) && 
      count < maxOccurrences &&
      (!ruleEnd || currentDate.isSameOrBefore(ruleEnd))
    ) {
      const dateStr = currentDate.format('YYYY-MM-DD');
      
      if (currentDate.isSameOrAfter(dayjs(startDate)) && !exceptions.has(dateStr)) {
        // Check day of week for weekly recurrence
        if (rule.frequency === 'weekly' && rule.daysOfWeek) {
          if (rule.daysOfWeek.includes(currentDate.day())) {
            occurrences.push(currentDate.toDate());
            count++;
          }
        } else {
          occurrences.push(currentDate.toDate());
          count++;
        }
      }

      // Move to next occurrence based on frequency
      switch (rule.frequency) {
        case 'daily':
          currentDate = currentDate.add(rule.interval, 'day');
          break;
        case 'weekly':
          currentDate = currentDate.add(1, 'day');
          // If we're doing specific days, iterate daily
          // Otherwise, jump by week interval
          if (!rule.daysOfWeek && currentDate.day() === dayjs(event.startsAt).day()) {
            currentDate = currentDate.add((rule.interval - 1) * 7, 'day');
          }
          break;
        case 'monthly':
          currentDate = currentDate.add(rule.interval, 'month');
          break;
        case 'yearly':
          currentDate = currentDate.add(rule.interval, 'year');
          break;
      }
    }

    return occurrences;
  }, []);

  // Check if a date is an occurrence of a recurring event
  const isOccurrence = useCallback((
    event: CalendarEventType,
    date: Date
  ): boolean => {
    if (!event.isRecurring) {
      return dayjs(event.startsAt).isSame(dayjs(date), 'day');
    }

    const exceptions = new Set(event.recurrenceExceptions || []);
    const dateStr = dayjs(date).format('YYYY-MM-DD');
    
    if (exceptions.has(dateStr)) {
      return false;
    }

    const occurrences = generateOccurrences(
      event,
      dayjs(date).subtract(1, 'day').toDate(),
      dayjs(date).add(1, 'day').toDate()
    );

    return occurrences.some(occ => dayjs(occ).isSame(dayjs(date), 'day'));
  }, [generateOccurrences]);

  return {
    isProcessing,
    editRecurringEvent,
    deleteRecurringEvent,
    generateOccurrences,
    isOccurrence,
  };
}

export default useRecurringEvents;
