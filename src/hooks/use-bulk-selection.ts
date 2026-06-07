import { useCallback } from 'react';
import { CalendarEventType } from '@/lib/stores/types';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { useEventCRUD } from '@/hooks/use-event-crud';
import { useBulkSelectionStore } from '@/lib/stores/bulk-selection-store';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import dayjs from 'dayjs';

export type RecurringDeleteScope = 'single' | 'all' | 'thisAndFuture';

export function useBulkSelection() {
  const { events, addRecurrenceException } = useCalendarEvents();
  const { updateEvent, removeEvent, addEvent } = useEventCRUD();
  
  // Use global Zustand store for bulk selection state
  const {
    selectedIds,
    isBulkMode,
    toggleSelection: storeToggleSelection,
    selectAll: storeSelectAll,
    deselectAll,
    isSelected: storeIsSelected,
    enableBulkMode,
    disableBulkMode,
  } = useBulkSelectionStore();

  const toggleSelection = useCallback((eventId: string) => {
    storeToggleSelection(eventId);
  }, [storeToggleSelection]);

  const selectAll = useCallback(() => {
    storeSelectAll(events.map(e => e.id));
  }, [events, storeSelectAll]);

  const isSelected = useCallback((eventId: string) => {
    return storeIsSelected(eventId);
  }, [storeIsSelected]);

  const getSelectedEvents = useCallback((): CalendarEventType[] => {
    const byId = new Map(events.map(e => [e.id, e]));
    const resolved: CalendarEventType[] = [];

    for (const id of selectedIds) {
      // Direct hit: real stored event (parent, non-recurring, or synced)
      const direct = byId.get(id);
      if (direct) {
        resolved.push(direct);
        continue;
      }

      // Synthetic recurring-instance id: `${parentId}_${YYYY-MM-DD}`.
      // These are expanded in the grid but never stored, so a plain
      // `events.filter(... selectedIds.has(e.id))` silently dropped them —
      // which is why bulk-deleting recurring occurrences appeared to do nothing.
      // Reconstruct an instance-shaped event from its parent so downstream
      // recurring-scope handling (single / all / future) can act on it.
      const lastUnderscore = id.lastIndexOf('_');
      if (lastUnderscore > 0) {
        const parentId = id.slice(0, lastUnderscore);
        const instanceDate = id.slice(lastUnderscore + 1);
        const parent = byId.get(parentId);
        if (parent && /^\d{4}-\d{2}-\d{2}$/.test(instanceDate)) {
          resolved.push({
            ...parent,
            id,
            date: instanceDate,
            recurrenceParentId: parentId,
            isRecurring: false,
          } as CalendarEventType);
          continue;
        }
      }
      // Unresolvable id — skip silently (was already effectively skipped before)
    }

    return resolved;
  }, [events, selectedIds]);

  // Check if any selected events are recurring
  const hasRecurringEvents = useCallback((): boolean => {
    const selectedEvents = getSelectedEvents();
    return selectedEvents.some(event => 
      event.isRecurring || 
      event.recurrenceParentId || 
      (event.id && event.id.includes('_'))
    );
  }, [getSelectedEvents]);

  // Get all recurring events from selection
  const getRecurringEvents = useCallback((): CalendarEventType[] => {
    const selectedEvents = getSelectedEvents();
    return selectedEvents.filter(event => 
      event.isRecurring || 
      event.recurrenceParentId || 
      (event.id && event.id.includes('_'))
    );
  }, [getSelectedEvents]);

  // Bulk operations - updated to handle recurring events
  const bulkDelete = useCallback(async (recurringScope?: RecurringDeleteScope) => {
    const selectedEvents = getSelectedEvents();
    let failed = 0;
    // 'all' would otherwise call removeEvent(parentId) once per selected occurrence
    // of the same series — track parents we've already deleted to avoid redundant
    // (and error-logging) deletes.
    const deletedParents = new Set<string>();

    for (const event of selectedEvents) {
      try {
        // Synced Google/Microsoft events (id starts with 'synced_'). Pass the recurring
        // scope so removeEvent can delete the whole external series for 'all' instead of
        // just the one selected occurrence.
        if (event.id.startsWith('synced_')) {
          await removeEvent(event.id, recurringScope as 'single' | 'all' | 'thisAndFuture' | undefined);
          continue;
        }

        const isRecurring = Boolean(
          event.isRecurring || event.recurrenceParentId
        );

        if (isRecurring && recurringScope) {
          // Resolve parent id + instance date robustly (ids/dates may contain '_').
          const parentId = event.recurrenceParentId || event.id;
          const instanceDate = event.date || dayjs(event.startsAt).format('YYYY-MM-DD');

          if (recurringScope === 'single') {
            // Delete only this occurrence via a recurrence exception
            if (addRecurrenceException && parentId) {
              await addRecurrenceException(parentId, instanceDate);
            } else {
              await removeEvent(event.id);
            }
          } else {
            // 'all' or 'thisAndFuture' → delete the whole series (parent doc) once
            if (!deletedParents.has(parentId)) {
              deletedParents.add(parentId);
              await removeEvent(parentId);
            }
          }
        } else {
          // Non-recurring event - just delete
          await removeEvent(event.id);
        }
      } catch (err) {
        failed++;
        logger.error('useBulkSelection', 'Bulk delete failed for an event', { id: event.id, error: err });
      }
    }

    if (failed > 0) {
      toast.error(`${failed} event${failed !== 1 ? 's' : ''} could not be deleted`);
    } else if (selectedEvents.length > 0) {
      toast.success(`Deleted ${selectedEvents.length} event${selectedEvents.length !== 1 ? 's' : ''}`);
    }

    deselectAll();
  }, [getSelectedEvents, removeEvent, addRecurrenceException, deselectAll]);

  const bulkUpdateColor = useCallback(async (color: string) => {
    const selectedEvents = getSelectedEvents();
    const promises = selectedEvents.map(event =>
      updateEvent({ ...event, color })
    );
    await Promise.all(promises);
  }, [getSelectedEvents, updateEvent]);

  const bulkReschedule = useCallback(async (daysOffset: number) => {
    const selectedEvents = getSelectedEvents();
    const promises = selectedEvents.map(event => {
      const newStart = dayjs(event.startsAt).add(daysOffset, 'days').toISOString();
      const newEnd = dayjs(event.endsAt).add(daysOffset, 'days').toISOString();
      return updateEvent({
        ...event,
        startsAt: newStart,
        endsAt: newEnd,
      });
    });
    await Promise.all(promises);
  }, [getSelectedEvents, updateEvent]);

  const bulkDuplicate = useCallback(async () => {
    const selectedEvents = getSelectedEvents();
    
    const promises = selectedEvents.map(event => {
      const duplicated: CalendarEventType = {
        ...event,
        id: crypto.randomUUID(),
        title: `${event.title} (Copy)`,
      };
      return addEvent(duplicated);
    });
    
    await Promise.all(promises);
    deselectAll();
  }, [getSelectedEvents, addEvent, deselectAll]);

  return {
    // State
    selectedIds,
    selectedCount: selectedIds.size,
    isBulkMode,
    
    // Selection
    toggleSelection,
    selectAll,
    deselectAll,
    isSelected,
    getSelectedEvents,
    
    // Recurring event helpers
    hasRecurringEvents,
    getRecurringEvents,
    
    // Bulk operations
    bulkDelete,
    bulkUpdateColor,
    bulkReschedule,
    bulkDuplicate,
    
    // Mode
    enableBulkMode,
    disableBulkMode,
  };
}
