import { useCallback } from 'react';
import { CalendarEventType } from '@/lib/stores/types';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { useBulkSelectionStore } from '@/lib/stores/bulk-selection-store';
import dayjs from 'dayjs';

export function useBulkSelection() {
  const { events, updateEvent, removeEvent, addEvent } = useCalendarEvents();
  
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

  // Bulk operations
  const bulkDelete = useCallback(async () => {
    const promises = Array.from(selectedIds).map(id => removeEvent(id));
    await Promise.all(promises);
    deselectAll();
  }, [selectedIds, removeEvent, deselectAll]);

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
