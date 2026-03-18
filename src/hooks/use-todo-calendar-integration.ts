
import { useState, useCallback } from 'react';
import { CalendarEventType } from '@/lib/stores/types';
import { TodoDragData, createTodoFromCalendarEvent } from '@/lib/dragdropHandlers';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { useTodos } from '@/hooks/use-todos';
import { useEisenhower } from '@/hooks/use-eisenhower';
import { useEntityLinks } from '@/hooks/use-entity-links';
import { PERSONAL_CALENDAR_ID } from '@/lib/stores/calendar-filter-store';
import { useEventStore } from '@/lib/stores/event-store';
import { useDateStore } from '@/lib/stores/date-store';
import { useEventHighlightStore } from '@/lib/stores/event-highlight-store';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { nanoid } from '@/lib/utils';
import type { EntityType, EntityRef } from '@/lib/entity-links/types';

export function useTodoCalendarIntegration() {
  // Drop dialog state
  const [isTodoCalendarDialogOpen, setIsTodoCalendarDialogOpen] = useState(false);
  const [currentTodoData, setCurrentTodoData] = useState<TodoDragData | null>(null);
  const [currentDateTimeData, setCurrentDateTimeData] = useState<{ date: Date; startTime: string } | null>(null);

  // Already-linked warning state
  const [isLinkedWarningOpen, setIsLinkedWarningOpen] = useState(false);
  const [linkedEventRefs, setLinkedEventRefs] = useState<EntityRef[]>([]);

  const { addEvent, updateEvent, removeEvent } = useCalendarEvents();
  const { addTodo, linkTodoToEvent, deleteTodo, updateTodoTitle, unlinkTodoFromEvent } = useTodos();
  const { removeItem: removeEisenhowerItem } = useEisenhower();
  const { link: createEntityLinkFn, unlink, getLinksFor, getLinksForFast, areLinked } = useEntityLinks();

  // ─── Open the drop dialog (with duplicate-check) ─────────────────────
  const showTodoCalendarDialog = useCallback(
    (todoData: TodoDragData, date: Date, startTime: string) => {
      setCurrentTodoData(todoData);
      setCurrentDateTimeData({ date, startTime });

      // Check if this todo already has linked calendar events
      const entityType: EntityType = todoData.source === 'eisenhower' ? 'eisenhower' : 'todo';
      const existingEventRefs = getLinksForFast(entityType, todoData.id).filter(
        ref => ref.type === 'event'
      );

      if (existingEventRefs.length > 0) {
        setLinkedEventRefs(existingEventRefs);
        setIsLinkedWarningOpen(true);
      } else {
        setIsTodoCalendarDialogOpen(true);
      }
    },
    [getLinksForFast]
  );

  const hideTodoCalendarDialog = useCallback(() => {
    setIsTodoCalendarDialogOpen(false);
  }, []);

  // ─── Linked-warning handlers ─────────────────────────────────────────
  const hideLinkedWarning = useCallback(() => {
    setIsLinkedWarningOpen(false);
  }, []);

  const scheduleAnywayFromWarning = useCallback(() => {
    setIsLinkedWarningOpen(false);
    setIsTodoCalendarDialogOpen(true);
  }, []);

  const navigateToLinkedEvent = useCallback((eventId: string) => {
    const event = useEventStore.getState().events.find(e => e.id === eventId);
    if (event) {
      const eventDate = dayjs(event.startsAt || (event.date as string));
      // Update both date (week/day view) and month index (month view)
      useDateStore.getState().setDate(eventDate);
      useDateStore.getState().setMonth(eventDate.month());
      // Highlight the event so it pulses visually on the calendar
      useEventHighlightStore.getState().setHighlight(eventId, event.startsAt);
    } else {
      toast.error('Event not found on calendar');
    }
    setIsLinkedWarningOpen(false);
  }, []);

  // ─── Confirm handler: create event(s) in selected calendars ─────────
  const handleTodoDropConfirm = useCallback(
    async (keepAsTodo: boolean, calendarIds: string[]) => {
      if (!currentTodoData || !currentDateTimeData) return;

      const { date, startTime } = currentDateTimeData;
      const day = dayjs(date);
      const [startHourStr, startMinStr] = startTime.split(':');
      const startHour = parseInt(startHourStr, 10);
      const startMinute = parseInt(startMinStr || '0', 10);

      let startDateTime = day.hour(startHour).minute(startMinute).second(0);
      let endDateTime = startDateTime.add(1, 'hour');

      // If the time already passed today, nudge to next available slot
      const now = dayjs();
      if (startDateTime.isBefore(now) && startDateTime.isSame(now, 'day')) {
        const nextSlot = now.minute() < 30 ? 30 : 0;
        const nextHour = now.minute() < 30 ? now.hour() : now.hour() + 1;
        startDateTime = now.hour(nextHour).minute(nextSlot).second(0);
        endDateTime = startDateTime.add(1, 'hour');
        toast.info('Time adjusted', {
          description: `${startTime} already passed — scheduled for ${startDateTime.format('h:mm A')} instead.`,
          duration: 4000,
        });
      }

      const finalDate = startDateTime.format('YYYY-MM-DD');
      const finalStart = startDateTime.format('HH:mm');
      const finalEnd = endDateTime.format('HH:mm');
      const targetIds = calendarIds.length > 0 ? calendarIds : [PERSONAL_CALENDAR_ID];

      let firstEventId: string | null = null;

      for (const calendarId of targetIds) {
        const newEvent: CalendarEventType = {
          id: nanoid(),
          title: currentTodoData.text,
          date: finalDate,
          description: `${finalStart} - ${finalEnd} | ${currentTodoData.text}`,
          color: 'bg-purple-500/70',
          isTodo: keepAsTodo,
          todoId: keepAsTodo ? currentTodoData.id : undefined,
          startsAt: startDateTime.toISOString(),
          endsAt: endDateTime.toISOString(),
          calendarId,
        } as CalendarEventType;

        const response = await addEvent(newEvent);

        if (response?.success) {
          const eventId = response.data?.id ?? response.data?.[0]?.id;
          if (eventId) {
            if (keepAsTodo) {
              // Link to the todo (for each calendar the event lives in)
              await linkTodoToEvent(currentTodoData.id, eventId, currentTodoData.collectionName);

              if (createEntityLinkFn) {
                const sourceEntityType: EntityType =
                  currentTodoData.source === 'eisenhower' ? 'eisenhower' : 'todo';
                await createEntityLinkFn({
                  sourceType: sourceEntityType,
                  sourceId: currentTodoData.id,
                  sourceTitle: currentTodoData.text,
                  targetType: 'event',
                  targetId: eventId,
                  targetTitle: currentTodoData.text,
                  relation: 'mirror',
                  metadata: { createdVia: 'drag-and-drop' },
                });
              }
            }

            if (firstEventId === null) firstEventId = eventId;
          }
        }
      }

      // Delete todo if "event only" was chosen
      if (!keepAsTodo && firstEventId) {
        if (currentTodoData.source === 'eisenhower') {
          await removeEisenhowerItem(currentTodoData.id);
        } else {
          await deleteTodo(currentTodoData.id);
        }
      }

      // Single success toast
      const calCount = targetIds.length;
      toast.success(
        `"${currentTodoData.text}" added to ${calCount === 1 ? 'calendar' : `${calCount} calendars`}`,
        {
          description: `${startDateTime.format('MMM D, YYYY')} at ${startDateTime.format('h:mm A')}${keepAsTodo ? ' · Kept as todo' : ''}`,
          duration: 5000,
        }
      );

      setIsTodoCalendarDialogOpen(false);
    },
    [
      currentTodoData,
      currentDateTimeData,
      addEvent,
      linkTodoToEvent,
      createEntityLinkFn,
      deleteTodo,
      removeEisenhowerItem,
    ]
  );

  // ─── Legacy handlers (kept for backward compat) ──────────────────────
  const handleCreateBoth = useCallback(async () => {
    if (!currentTodoData || !currentDateTimeData) return;
    await handleTodoDropConfirm(true, [PERSONAL_CALENDAR_ID]);
  }, [currentTodoData, currentDateTimeData, handleTodoDropConfirm]);

  const handleCreateCalendarOnly = useCallback(async () => {
    if (!currentTodoData || !currentDateTimeData) return;
    await handleTodoDropConfirm(false, [PERSONAL_CALENDAR_ID]);
  }, [currentTodoData, currentDateTimeData, handleTodoDropConfirm]);

  // ─── Option F: Create todo from calendar event ───────────────────────
  const handleCreateTodoFromEvent = useCallback(
    async (event: CalendarEventType): Promise<string | null> => {
      if (!event || !event.id || !event.title) {
        console.error('Invalid event object provided to createTodoFromEvent:', event);
        return null;
      }
      return await createTodoFromCalendarEvent(event, linkTodoToEvent, addTodo, createEntityLinkFn);
    },
    [linkTodoToEvent, addTodo, createEntityLinkFn]
  );

  // ─── S2: Title sync ─────────────────────────────────────────────────
  const syncTitles = useCallback(
    async (eventId: string, todoId: string, newTitle: string): Promise<boolean> => {
      try {
        if (!updateTodoTitle) {
          console.error('updateTodoTitle function is not available');
          return false;
        }
        const result = await updateTodoTitle(todoId, newTitle);
        return result.success;
      } catch (error) {
        console.error('Error syncing titles:', error);
        return false;
      }
    },
    [updateTodoTitle]
  );

  return {
    // Drop dialog state
    isTodoCalendarDialogOpen,
    currentTodoData,
    currentDateTimeData,
    showTodoCalendarDialog,
    hideTodoCalendarDialog,

    // Already-linked warning state
    isLinkedWarningOpen,
    linkedEventRefs,
    hideLinkedWarning,
    scheduleAnywayFromWarning,
    navigateToLinkedEvent,

    // Primary confirm handler (used by TodoDropDialog)
    handleTodoDropConfirm,

    // Legacy handlers
    handleCreateBoth,
    handleCreateCalendarOnly,

    // Core operations
    handleCreateTodoFromEvent,
    syncTitles,

    // Entity link utilities
    entityLinks: {
      link: createEntityLinkFn,
      unlink,
      getLinksFor,
      getLinksForFast,
      areLinked,
    },
  };
}
