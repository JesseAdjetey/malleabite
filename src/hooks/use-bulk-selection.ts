import { useState, useCallback } from 'react';
import { CalendarEventType } from '@/lib/stores/types';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import dayjs from 'dayjs';

export function useBulkSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkMode, setIsBulkMode] = useState(false);
  const { events, updateEvent, removeEvent, addEvent } = useCalendarEvents();

  const toggleSelection = useCallback((eventId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(events.map(e => e.id)));
  }, [events]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback((eventId: string) => {
    return selectedIds.has(eventId);
  }, [selectedIds]);

  const getSelectedEvents = useCallback((): CalendarEventType[] => {
    return events.filter(e => selectedIds.has(e.id));
  }, [events, selectedIds]);

  // Bulk operations
  const bulkDelete = useCallback(async () => {
    const promises = Array.from(selectedIds).map(id => removeEvent(id));
    await Promise.all(promises);
    setSelectedIds(new Set());
  }, [selectedIds, removeEvent]);

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
    setSelectedIds(new Set());
  }, [getSelectedEvents, addEvent]);

  const enableBulkMode = useCallback(() => {
    setIsBulkMode(true);
  }, []);

  const disableBulkMode = useCallback(() => {
    setIsBulkMode(false);
    setSelectedIds(new Set());
  }, []);

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
