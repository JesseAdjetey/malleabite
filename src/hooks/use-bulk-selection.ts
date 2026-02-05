import { useCallback } from 'react';
import { CalendarEventType } from '@/lib/stores/types';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { useBulkSelectionStore } from '@/lib/stores/bulk-selection-store';
import dayjs from 'dayjs';

export type RecurringDeleteScope = 'single' | 'all' | 'thisAndFuture';

export function useBulkSelection() {
  const { events, updateEvent, removeEvent, addEvent, addRecurrenceException } = useCalendarEvents();
  
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
    return events.filter(e => selectedIds.has(e.id));
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
    
    for (const event of selectedEvents) {
      const isRecurring = event.isRecurring || event.recurrenceParentId || (event.id && event.id.includes('_'));
      
      if (isRecurring && recurringScope) {
        // Handle recurring event based on scope
        const parentId = event.recurrenceParentId ||
          (event.id.includes('_') ? event.id.split('_')[0] : event.id);
        const instanceDate = event.id.includes('_')
          ? event.id.split('_')[1]
          : dayjs(event.startsAt).format('YYYY-MM-DD');
          
        if (recurringScope === 'single') {
          // Delete only this occurrence
          if (addRecurrenceException && parentId) {
            await addRecurrenceException(parentId, instanceDate);
          } else {
            await removeEvent(event.id);
          }
        } else if (recurringScope === 'all') {
          // Delete the parent event
          await removeEvent(parentId);
        } else if (recurringScope === 'thisAndFuture') {
          // For now, delete parent (simplified)
          await removeEvent(parentId);
        }
      } else {
        // Non-recurring event - just delete
        await removeEvent(event.id);
      }
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
