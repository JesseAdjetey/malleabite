
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getWeekDays } from "@/lib/getTime";
import { useDateStore, useEventStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import { ScrollArea } from "@/components/ui/scroll-area";
import AddEventButton from "@/components/calendar/AddEventButton";
import EventForm from "@/components/calendar/EventForm";
import EventDetails from "@/components/calendar/EventDetails";
import WeekHeader from "./calendar/week-view/WeekHeader";
import TimeColumn from "./calendar/week-view/TimeColumn";
import DayColumn from "./calendar/week-view/DayColumn";
import {
  handleDragOver,
  RecurringDropResult,
} from "./calendar/week-view/DragDropHandlers";
import { formatMinutesAsTime, getTimeInMinutes, getTimeInfo } from "./calendar/event-utils/touch-handlers";
import { nanoid } from "nanoid";
import { useEventCRUD } from "@/hooks/use-event-crud";
import { CalendarEventType } from "@/lib/stores/types";
import { toast } from "sonner";
import { useTodos } from "@/hooks/use-todos";
import TodoDropDialog from "@/components/calendar/integration/TodoDropDialog";
import TodoLinkedWarningDialog from "@/components/calendar/integration/TodoLinkedWarningDialog";
import { useTodoCalendarIntegration } from "@/hooks/use-todo-calendar-integration";
import { useBulkSelection } from "@/hooks/use-bulk-selection";
import { useBulkDragGhosts } from "@/hooks/use-bulk-drag-ghosts";
import { BulkActionToolbar } from "@/components/calendar";
import { generateRecurringInstances } from "@/lib/utils/recurring-events";
import { RecurringEventEditDialog } from "@/components/calendar/RecurringEventEditDialog";
import { EditScope } from "@/hooks/use-recurring-events";
import { useUndoRedo } from "@/hooks/use-undo-redo";
import { useCalendarFilterStore } from "@/lib/stores/calendar-filter-store";
import { useTemplateModeStore } from "@/lib/stores/template-mode-store";
import { WeekAllDayRow, splitAllDayEvents } from "@/components/calendar/AllDaySection";
import { useWeekRangeStore } from "@/lib/stores/week-range-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { logCalendarPerf } from "@/lib/perf/calendar-perf";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigationDirection } from "@/hooks/use-navigation-direction";

const WeekView = () => {
  const [currentTime, setCurrentTime] = useState(dayjs());
  const { userSelectedDate } = useDateStore();
  const {
    openEventSummary,
    toggleEventLock,
    isEventSummaryOpen,
    closeEventSummary,
    events,
  } = useEventStore();
  const { updateEvent, addEvent, addRecurrenceException, removeEvent } = useEventCRUD();
  const { linkTodoToEvent, deleteTodo } = useTodos();
  const {
    isBulkMode,
    selectedIds,
    selectedCount,
    toggleSelection,
    isSelected,
    deselectAll,
    bulkDelete,
    bulkUpdateColor,
    bulkReschedule,
    bulkDuplicate,
    hasRecurringEvents,
    getRecurringEvents,
    enableBulkMode,
    disableBulkMode,
  } = useBulkSelection();

  // Calendar filtering — subscribe to both the function AND the data so React
  // knows to re-render when hiddenCalendarIds changes (function ref is stable).
  const hiddenCalendarIds = useCalendarFilterStore(state => state.hiddenCalendarIds);
  const isCalendarVisible = useCalendarFilterStore(state => state.isCalendarVisible);

  // Template mode
  const isTemplateMode = useTemplateModeStore(s => s.isTemplateMode);
  const draftEvents = useTemplateModeStore(s => s.draftEvents);
  const addDraftEvent = useTemplateModeStore(s => s.addDraftEvent);
  const updateDraftEvent = useTemplateModeStore(s => s.updateDraftEvent);

  // Undo/redo functionality - keyboard shortcuts are handled automatically
  const { trackCreateEvent, trackDeleteEvent, trackUpdateEvent, trackBulkDeleteEvents } = useUndoRedo();

  // Week range ribbon
  const { rangeStart, rangeEnd } = useWeekRangeStore();
  const isMobile = useIsMobile();

  // Navigation direction for slide animations
  const weekKey = userSelectedDate.startOf('week').format('YYYY-MM-DD');
  const directionRef = useNavigationDirection(weekKey);

  // Track transitions — uses window.innerWidth for initial value to avoid the
  // !!undefined → false false-start from useIsMobile on first render.
  const prevIsMobileRef = useRef<boolean | null>(null);

  // One-time mount check: if we're on desktop but the store still has a mobile
  // auto-range from a previous session (component was unmounted while on mobile),
  // reset to the saved desktop range or full week.
  useEffect(() => {
    const currentlyMobile = window.innerWidth < 768;
    const store = useWeekRangeStore.getState();
    if (!currentlyMobile && store.wasAutoMobile) {
      if (store.savedDesktopRange) {
        store.setRange(store.savedDesktopRange.start, store.savedDesktopRange.end);
        store.setSavedDesktopRange(null);
      } else {
        store.resetRange();
      }
      store.setWasAutoMobile(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const store = useWeekRangeStore.getState();
    if (prevIsMobileRef.current === null) {
      // Use real window width so we don't confuse !!undefined=false with "desktop"
      const actuallyMobile = window.innerWidth < 768;
      prevIsMobileRef.current = actuallyMobile;
      if (actuallyMobile && store.rangeStart === 0 && store.rangeEnd === 6 && !store.wasAutoMobile) {
        const todayIdx = dayjs().day();
        const start = Math.max(0, Math.min(todayIdx - 1, 4));
        store.setRange(start, start + 2);
        store.setWasAutoMobile(true);
      }
      return;
    }
    const wasDesktop = !prevIsMobileRef.current;
    prevIsMobileRef.current = isMobile;
    if (wasDesktop && isMobile) {
      // Desktop → Mobile: persist the desktop range so it survives remounts
      store.setSavedDesktopRange({ start: store.rangeStart, end: store.rangeEnd });
      const todayIdx = dayjs().day();
      const start = Math.max(0, Math.min(todayIdx - 1, 4));
      store.setRange(start, start + 2);
      store.setWasAutoMobile(true);
    } else if (!wasDesktop && !isMobile) {
      // Mobile → Desktop: restore saved range or full week
      if (store.savedDesktopRange) {
        store.setRange(store.savedDesktopRange.start, store.savedDesktopRange.end);
        store.setSavedDesktopRange(null);
      } else {
        store.resetRange();
      }
      store.setWasAutoMobile(false);
    }
  }, [isMobile]);

  // Bulk drag ghost animation
  const { ghostsPortal, draggingBulkEventId } = useBulkDragGhosts({
    isBulkMode,
    selectedIds,
    events,
  });

  const [formOpen, setFormOpen] = useState(false);
  const [selectedTime, setSelectedTime] = useState<
    { date: Date; startTime: string; isAllDay?: boolean } | undefined
  >();
  const [todoData, setTodoData] = useState<any>(null);
  const [pendingTimeSelection, setPendingTimeSelection] = useState<{
    day: dayjs.Dayjs;
    hour: dayjs.Dayjs;
    isAllDay?: boolean;
  } | null>(null);

  // State for recurring event drop dialog
  const [recurringDropDialogOpen, setRecurringDropDialogOpen] = useState(false);
  const [pendingRecurringDrop, setPendingRecurringDrop] = useState<RecurringDropResult | null>(null);
  const [recurringEventForDialog, setRecurringEventForDialog] = useState<CalendarEventType | null>(null);

  const {
    isTodoCalendarDialogOpen,
    currentTodoData,
    currentDateTimeData,
    showTodoCalendarDialog,
    hideTodoCalendarDialog,
    handleTodoDropConfirm,
    handleCreateTodoFromEvent,
    isLinkedWarningOpen,
    linkedEventRefs,
    hideLinkedWarning,
    scheduleAnywayFromWarning,
    navigateToLinkedEvent,
  } = useTodoCalendarIntegration();

  // Handler for when a recurring event is dropped
  const handleRecurringEventDrop = useCallback((result: RecurringDropResult) => {
    if (!result.isRecurring) return;

    // Find the parent event to show in dialog
    const parentEvent = events.find(e =>
      e.id === result.parentId ||
      e.id.startsWith(result.parentId || '')
    );

    if (parentEvent) {
      setRecurringEventForDialog(parentEvent);
      setPendingRecurringDrop(result);
      setRecurringDropDialogOpen(true);
    } else if (result.newEvent) {
      // If we can't find parent, just create the single instance
      addEvent(result.newEvent);
      toast.success("Event moved");
    }
  }, [events, addEvent]);

  // Handle confirmation from recurring event dialog
  const handleRecurringDropConfirm = useCallback(async (scope: EditScope) => {
    if (!pendingRecurringDrop || !pendingRecurringDrop.newEvent) return;

    const { parentId, originalDate, newEvent } = pendingRecurringDrop;

    try {
      if (scope === 'single') {
        if (parentId?.startsWith('synced_')) {
          // Synced Google event: update the original occurrence directly via the bridge
          const originalEvent = events.find(e => e.id === parentId);
          if (originalEvent) {
            await updateEvent({ ...originalEvent, startsAt: newEvent.startsAt, endsAt: newEvent.endsAt, date: newEvent.date });
          }
        } else {
          // Move only this occurrence - create new event and add exception to parent
          await addEvent(newEvent);
          if (parentId && originalDate && addRecurrenceException) {
            await addRecurrenceException(parentId, originalDate);
          }
        }
        toast.success("This occurrence has been moved");
      } else if (scope === 'all') {
        // Move all occurrences - update the parent event's time
        const parentEvent = events.find(e => e.id === parentId);
        if (parentEvent) {
          const updatedParent = {
            ...parentEvent,
            startsAt: newEvent.startsAt,
            endsAt: newEvent.endsAt,
            date: newEvent.date,
          };
          await updateEvent(updatedParent);
          toast.success("All occurrences have been updated");
        }
      } else if (scope === 'thisAndFuture') {
        // Move this and future - add exception to parent and create new recurring event
        if (parentId && originalDate && addRecurrenceException) {
          await addRecurrenceException(parentId, originalDate);
        }
        // Create a new recurring event from this date forward
        const parentEvent = events.find(e => e.id === parentId);
        if (parentEvent) {
          const newRecurring: CalendarEventType = {
            ...newEvent,
            isRecurring: true,
            recurrenceRule: parentEvent.recurrenceRule,
          };
          await addEvent(newRecurring);
          toast.success("This and future occurrences have been moved");
        } else {
          await addEvent(newEvent);
          toast.success("Event moved");
        }
      }
    } catch (error) {
      console.error("Error handling recurring drop:", error);
      toast.error("Failed to move event");
    }

    setPendingRecurringDrop(null);
    setRecurringEventForDialog(null);
  }, [pendingRecurringDrop, events, addEvent, updateEvent, addRecurrenceException]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(dayjs());
    }, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (pendingTimeSelection) {
      const { day, hour, isAllDay } = pendingTimeSelection;

      setSelectedTime({
        date: day.toDate(),
        startTime: hour.format("HH:00"),
        isAllDay,
      });

      setTimeout(() => {
        setFormOpen(true);
        setPendingTimeSelection(null);
      }, 0);
    }
  }, [pendingTimeSelection]);

  // Keyboard shortcut: `b` toggles bulk mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (e.key === 'b' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (isBulkMode) disableBulkMode();
        else enableBulkMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBulkMode, enableBulkMode, disableBulkMode]);

  // Get week days for the current view — full week for event expansion, ranged for display
  const weekDays = getWeekDays(userSelectedDate);
  const visibleWeekDays = weekDays.slice(rangeStart, rangeEnd + 1);
  const visibleDayCount = rangeEnd - rangeStart + 1;

  // Expand recurring events into instances for the current week view
  const expandedEvents = useMemo(() => {
    if (!weekDays.length) {
      return events.filter(event => isCalendarVisible(event.calendarId));
    }

    // weekDays returns { currentDate, today } objects, not dayjs directly
    const weekStart = weekDays[0].currentDate.startOf('day').toDate();
    const weekEnd = weekDays[weekDays.length - 1].currentDate.endOf('day').toDate();

    const allInstances: CalendarEventType[] = [];

    // First filter by calendar visibility, then expand recurring events
    const visibleEvents = events.filter(event => isCalendarVisible(event.calendarId));

    visibleEvents.forEach(event => {
      if (event.isRecurring && event.recurrenceRule) {
        try {
          const instances = generateRecurringInstances(event, weekStart, weekEnd);
          allInstances.push(...instances);
        } catch (e) {
          console.error('Error generating recurring instances:', e);
          allInstances.push(event);
        }
      } else {
        allInstances.push(event);
      }
    });

    return allInstances;
  }, [events, userSelectedDate, isCalendarVisible, hiddenCalendarIds]);

  // Merge template draft events into display when in template mode
  const displayEvents = useMemo(() => {
    if (!isTemplateMode || draftEvents.length === 0) return expandedEvents;
    // Tag draft events so they can be visually distinguished
    const tagged = draftEvents.map(e => ({ ...e, _isDraft: true } as CalendarEventType & { _isDraft?: boolean }));
    return [...expandedEvents, ...tagged];
  }, [expandedEvents, isTemplateMode, draftEvents]);

  // Split display events into all-day and timed events
  const { allDayEvents: allDisplayAllDay, timedEvents: timedDisplayEvents } = useMemo(
    () => splitAllDayEvents(displayEvents),
    [displayEvents]
  );

  const timedEventsByDay = useMemo(() => {
    const startedAt = performance.now();
    const grouped = new Map<string, CalendarEventType[]>();

    timedDisplayEvents.forEach((event) => {
      const rawDate = event.date || (event.startsAt ? dayjs(event.startsAt).format("YYYY-MM-DD") : '');
      const dayKey = rawDate instanceof Date ? dayjs(rawDate).format("YYYY-MM-DD") : rawDate as string;
      if (!dayKey) return;

      const list = grouped.get(dayKey);
      if (list) {
        list.push(event);
      } else {
        grouped.set(dayKey, [event]);
      }
    });

    logCalendarPerf(
      'week-view-events-by-day',
      'WeekView timedEventsByDay build',
      performance.now() - startedAt,
      {
        timedEvents: timedDisplayEvents.length,
        dayBuckets: grouped.size,
      }
    );

    return grouped;
  }, [timedDisplayEvents]);

  const handleTimeSlotClick = (day: dayjs.Dayjs, hour: dayjs.Dayjs) => {
    setTodoData(null);
    setPendingTimeSelection({ day, hour });
  };

  const openEventForm = (todoData: any, date: Date, startTime: string) => {
    console.log(
      "Opening event form with todo data:",
      todoData,
      date,
      startTime
    );
    setTodoData(todoData);

    const dayObj = dayjs(date);
    const hourObj = dayjs(date).hour(parseInt(startTime.split(":")[0]));

    setPendingTimeSelection({ day: dayObj, hour: hourObj });
  };

  const handleDrop = (e: React.DragEvent, day: dayjs.Dayjs, hour: dayjs.Dayjs) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("🎯 DROP EVENT FIRED on week-view");
    console.log("🎯 Available data types:", e.dataTransfer.types);
    try {
      let dataString = e.dataTransfer.getData('application/json');
      console.log("🎯 DROP - application/json:", dataString);

      if (!dataString) {
        dataString = e.dataTransfer.getData('text/plain');
        console.log("🎯 DROP - text/plain fallback:", dataString);
      }

      if (!dataString) {
        dataString = e.dataTransfer.getData('text');
        console.log("🎯 DROP - text fallback:", dataString);
      }

      if (!dataString) {
        console.error("❌ No data found in drag event");
        return;
      }

      const data = JSON.parse(dataString);
      console.log("🎯 DROP - Parsed data:", data);

      if (data.source === 'todo-module' || data.source === 'eisenhower') {
        console.log("✅ Todo/Eisenhower drop detected, showing dialog...");
        const rect = e.currentTarget.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const hourHeight = rect.height;
        const minutesWithinHour = Math.floor((relativeY / hourHeight) * 60);

        const snappedMinutes = minutesWithinHour < 30 ? 0 : 30;

        const baseHour = hour.hour();
        const startTime = `${baseHour.toString().padStart(2, '0')}:${snappedMinutes.toString().padStart(2, '0')}`;

        console.log("📅 Calling showTodoCalendarDialog with:", data, day.toDate(), startTime);
        showTodoCalendarDialog(data, day.toDate(), startTime);
        return;
      }

      // Don't process if the event is locked
      if (data.isLocked) {
        toast.info("Event is locked. Unlock it first to move.");
        return;
      }

      // Calculate precise drop time based on cursor position
      const rect = e.currentTarget.getBoundingClientRect();
      const relativeY = e.clientY - rect.top;
      const hourHeight = rect.height;
      const minutesWithinHour = Math.floor((relativeY / hourHeight) * 60);
      const snappedMinutes = minutesWithinHour < 30 ? 0 : 30;
      const baseHour = hour.hour();
      const totalMinutes = baseHour * 60 + snappedMinutes;
      const newStartTime = formatMinutesAsTime(totalMinutes);

      const oldStartMinutes = getTimeInMinutes(data.timeStart);
      const oldEndMinutes = getTimeInMinutes(data.timeEnd);
      const durationMinutes = Math.max(oldEndMinutes - oldStartMinutes, 30);
      const newEndMinutes = totalMinutes + durationMinutes;
      const newEndTime = formatMinutesAsTime(newEndMinutes);

      const descriptionParts = (data.description || '').split('|');
      const descriptionText = descriptionParts.length > 1 ? descriptionParts[1].trim() : (data.description || '');

      // ── BULK DRAG MODE: move all selected events by the same time+day delta ──
      if (isBulkMode && selectedIds.has(data.id)) {
        // Day delta: how many whole days the dragged event shifted
        const oldDay = dayjs(data.date || data.startsAt).startOf('day');
        const dayDelta = day.startOf('day').diff(oldDay, 'day');
        // Time-of-day delta in minutes
        const timeDeltaMinutes = totalMinutes - oldStartMinutes;

        const updatePromises: Promise<any>[] = [];

        for (const selectedId of selectedIds) {
          // Find the event in current display data (includes recurring instances)
          const selEvent = displayEvents.find(e => e.id === selectedId)
            ?? events.find(e => e.id === selectedId);
          if (!selEvent) continue;

          const selTimeInfo = getTimeInfo(selEvent.description, selEvent.startsAt, selEvent.endsAt);
          const selStartMin = getTimeInMinutes(selTimeInfo.start);
          const selEndMin = getTimeInMinutes(selTimeInfo.end);
          const selDuration = Math.max(selEndMin - selStartMin, 15);

          // Apply the same time-of-day and day deltas
          const newSelStartMin = Math.max(0, Math.min(23 * 60 + 45, selStartMin + timeDeltaMinutes));
          const newSelEndMin = newSelStartMin + selDuration;
          const newSelStartStr = formatMinutesAsTime(newSelStartMin);
          const newSelEndStr = formatMinutesAsTime(newSelEndMin);

          const newSelDay = dayjs(selEvent.date || selEvent.startsAt).startOf('day').add(dayDelta, 'day');

          const selDescParts = (selEvent.description || '').split('|');
          const selDescText = selDescParts.length > 1 ? selDescParts[1].trim() : (selEvent.description || '');

          // For recurring instances use the parent ID; for regular events use the event's own ID
          const baseEvent = selEvent.recurrenceParentId
            ? (events.find(e => e.id === selEvent.recurrenceParentId) ?? selEvent)
            : selEvent;

          const updatedSel: CalendarEventType = {
            ...baseEvent,
            date: newSelDay.format('YYYY-MM-DD'),
            description: `${newSelStartStr} - ${newSelEndStr} | ${selDescText}`,
            startsAt: newSelDay
              .hour(parseInt(newSelStartStr.split(':')[0]))
              .minute(parseInt(newSelStartStr.split(':')[1]))
              .toISOString(),
            endsAt: newSelDay
              .hour(parseInt(newSelEndStr.split(':')[0]))
              .minute(parseInt(newSelEndStr.split(':')[1]))
              .toISOString(),
          };

          updatePromises.push(updateEvent(updatedSel));
        }

        Promise.all(updatePromises)
          .then(() => toast.success(`Moved ${updatePromises.length} event${updatePromises.length !== 1 ? 's' : ''}`))
          .catch(err => {
            console.error('Bulk move error:', err);
            toast.error('Some events could not be moved');
          });
        return;
      }

      // ── Template Mode: route drags to draft store, not Firestore ──
      if (isTemplateMode && data.id && data._isDraft) {
        const updatedDraft: CalendarEventType = {
          ...data,
          date: day.format('YYYY-MM-DD'),
          description: `${newStartTime} - ${newEndTime} | ${descriptionText}`,
          startsAt: day.hour(parseInt(newStartTime.split(':')[0])).minute(parseInt(newStartTime.split(':')[1])).toISOString(),
          endsAt: day.hour(parseInt(newEndTime.split(':')[0])).minute(parseInt(newEndTime.split(':')[1])).toISOString(),
        };
        updateDraftEvent(updatedDraft);
        toast.success(`Draft event moved to ${day.format("MMM D")} at ${newStartTime}`);
        return;
      }

      // In template mode, block moving real (non-draft) events
      if (isTemplateMode) {
        toast.info("Exit template mode to move calendar events.");
        return;
      }

      // DUPLICATE MODE: Alt/Option held → create a copy (checked before recurring
      // so that Alt+drag on imported/recurring events always duplicates, never moves)
      if (e.altKey) {
        const duplicateEvent: CalendarEventType = {
          id: nanoid(),
          title: data.title,
          date: day.format('YYYY-MM-DD'),
          description: `${newStartTime} - ${newEndTime} | ${descriptionText}`,
          color: data.color || 'bg-purple-500/70',
          startsAt: day.hour(parseInt(newStartTime.split(':')[0])).minute(parseInt(newStartTime.split(':')[1])).toISOString(),
          endsAt: day.hour(parseInt(newEndTime.split(':')[0])).minute(parseInt(newEndTime.split(':')[1])).toISOString(),
          isRecurring: false,
          isTodo: data.isTodo,
          hasAlarm: data.hasAlarm,
          hasReminder: data.hasReminder,
          // Preserve calendar association so the duplicate syncs to the right
          // Google calendar — but deliberately omit googleEventId so a fresh
          // Google event is created instead of overwriting the original.
          calendarId: data.calendarId,
          participants: data.participants,
        };
        addEvent(duplicateEvent).then((response: { success: boolean }) => {
          if (response.success) {
            toast.success(`Event duplicated to ${day.format("MMM D")} at ${newStartTime}`);
          } else {
            toast.error("Failed to duplicate event");
          }
        });
        return;
      }

      // Check if this is a recurring event instance
      const isRecurringInstance = data.isRecurring || data.recurrenceParentId || (data.id && data.id.includes('_'));

      if (isRecurringInstance) {
        const isSyncedEvent = data.id?.startsWith('synced_');
        const parentId = data.recurrenceParentId || (isSyncedEvent ? data.id : (data.id.includes('_') ? data.id.split('_')[0] : data.id));
        const originalDate = (!isSyncedEvent && data.id.includes('_')) ? data.id.split('_')[1] : dayjs(data.startsAt).format('YYYY-MM-DD');
        const newEvent: CalendarEventType = {
          id: nanoid(),
          title: data.title,
          date: day.format('YYYY-MM-DD'),
          description: `${newStartTime} - ${newEndTime} | ${descriptionText}`,
          color: data.color || 'bg-purple-500/70',
          startsAt: day.hour(parseInt(newStartTime.split(':')[0])).minute(parseInt(newStartTime.split(':')[1])).toISOString(),
          endsAt: day.hour(parseInt(newEndTime.split(':')[0])).minute(parseInt(newEndTime.split(':')[1])).toISOString(),
          isRecurring: false,
        };
        handleRecurringEventDrop({ isRecurring: true, parentId, originalDate, newEvent });
        return;
      }

      // MOVE MODE: update the existing event (never add)
      if (!data.id) {
        toast.error("Failed to move event: missing ID");
        return;
      }

      const realEventId = data.id.includes('_') ? data.id.split('_')[0] : data.id;
      const updatedEvent: CalendarEventType = {
        ...data,
        id: realEventId,
        date: day.format('YYYY-MM-DD'),
        description: `${newStartTime} - ${newEndTime} | ${descriptionText}`,
        startsAt: day.hour(parseInt(newStartTime.split(':')[0])).minute(parseInt(newStartTime.split(':')[1])).toISOString(),
        endsAt: day.hour(parseInt(newEndTime.split(':')[0])).minute(parseInt(newEndTime.split(':')[1])).toISOString(),
      };

      // Optimistic update: move the event in local state immediately so there's
      // no visible snap-back between drag-end and the async Firestore/Google write.
      const originalSnapshot: CalendarEventType = { ...data, id: realEventId };
      useEventStore.getState().updateEvent(updatedEvent);

      updateEvent(updatedEvent).then(response => {
        if (response?.success !== false) {
          toast.success(`Event moved to ${day.format("MMM D")} at ${newStartTime}`);
        } else {
          useEventStore.getState().updateEvent(originalSnapshot); // revert
          toast.error("Failed to move event");
        }
      }).catch(err => {
        useEventStore.getState().updateEvent(originalSnapshot); // revert
        console.error("Error moving event:", err);
        toast.error("Failed to move event");
      });
    } catch (error) {
      console.error("❌ Error handling drop:", error);
      toast.error("Failed to process drop event");
    }
  };

  const handleUpdateEvent = async (event: CalendarEventType): Promise<void> => {
    await updateEvent(event);
  };

  const handleAddEvent = async (event: CalendarEventType): Promise<void> => {
    await addEvent(event);
  };

  const handleSaveEvent = async (event: CalendarEventType) => {
    // In template mode, save to draft events (not Firestore)
    if (isTemplateMode) {
      addDraftEvent(event);
      setFormOpen(false);
      toast.success(`Draft event "${event.title}" added to template`);
      return;
    }
    try {
      if (event.isTodo && !event.todoId) {
        const newTodoId = await handleCreateTodoFromEvent(event);
        if (newTodoId) {
          event.todoId = newTodoId;
        }
      }

      const response = await addEvent(event);

      if (response.success) {
        trackCreateEvent(event); // Track for undo
        setFormOpen(false);
        toast.success(`${event.title} has been added to your calendar.`);
      } else {
        toast.error(response.error
          ? String(response.error)
          : "Failed to add event");
      }
    } catch (error) {
      console.error("Error adding event:", error);
      toast.error("An unexpected error occurred");
    }
  };

  // Context menu handlers
  const handleDeleteEvent = async (eventId: string) => {
    const event = events.find(e => e.id === eventId);
    const result = await removeEvent(eventId);
    if (result.success) {
      if (event) trackDeleteEvent(event); // Track for undo
      toast.success("Event deleted");
    } else {
      toast.error("Failed to delete event");
    }
  };

  const handleColorChange = async (eventId: string, color: string) => {
    const event = events.find(e => e.id === eventId);
    if (event) {
      const previousEvent = { ...event };
      const updatedEvent = { ...event, color };
      await updateEvent(updatedEvent);
      trackUpdateEvent(previousEvent, updatedEvent); // Track for undo
      toast.success("Color updated");
    }
  };

  const handleResizeEvent = useCallback(async (event: CalendarEventType, newStart: Date, newEnd: Date) => {
    const newStartTime = dayjs(newStart).format('HH:mm');
    const newEndTime = dayjs(newEnd).format('HH:mm');
    const descriptionParts = (event.description || '').split('|');
    const descriptionText = descriptionParts.length > 1 ? descriptionParts[1].trim() : (event.description || '');

    // Recurring instance → show the recurring edit dialog (same flow as drag-drop)
    const isRecurringInstance = event.isRecurring || event.recurrenceParentId ||
      (!event.id.startsWith('synced_') && event.id.includes('_'));

    if (isRecurringInstance) {
      const parentId = event.recurrenceParentId ||
        (event.id.includes('_') ? event.id.split('_')[0] : event.id);
      const originalDate = event.id.includes('_')
        ? event.id.split('_')[1]
        : dayjs(event.startsAt as string).format('YYYY-MM-DD');
      const newEvent: CalendarEventType = {
        id: nanoid(),
        title: event.title,
        date: (event.date ? dayjs(event.date).format('YYYY-MM-DD') : dayjs(newStart).format('YYYY-MM-DD')),
        description: `${newStartTime} - ${newEndTime} | ${descriptionText}`,
        color: event.color || 'bg-purple-500/70',
        startsAt: newStart.toISOString(),
        endsAt: newEnd.toISOString(),
        isRecurring: false,
        calendarId: event.calendarId,
      };
      handleRecurringEventDrop({ isRecurring: true, parentId, originalDate, newEvent });
      return;
    }

    const updatedEvent: CalendarEventType = {
      ...event,
      description: `${newStartTime} - ${newEndTime} | ${descriptionText}`,
      startsAt: newStart.toISOString(),
      endsAt: newEnd.toISOString(),
    };
    // Optimistic update: apply new size immediately so there's no snap-back flicker
    useEventStore.getState().updateEvent(updatedEvent);
    await updateEvent(updatedEvent);
  }, [updateEvent, handleRecurringEventDrop]);


  return (
    <>
      <div className="glass mx-2 mt-2 mb-3 rounded-xl overflow-hidden border border-purple-200 dark:border-white/10 shadow-sm bg-gradient-to-r from-purple-50/80 to-purple-100/50 dark:from-secondary/50 dark:to-secondary/50">
        <WeekHeader userSelectedDate={userSelectedDate} />
      </div>

      {/* All-Day Events Row — slides with the week */}
      <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={`allday-${weekKey}`}
        initial={{ opacity: 0, x: directionRef.current * 40 }}
        animate={{ opacity: 1, x: 0, transition: { type: "spring", damping: 28, stiffness: 280 } }}
        exit={{ opacity: 0, x: directionRef.current * -40, transition: { duration: 0.12 } }}
      >
      <WeekAllDayRow
        weekDays={visibleWeekDays}
        allDayEvents={allDisplayAllDay}
        onEventClick={openEventSummary}
        onAllDayCellClick={(day) => {
          setTodoData(null);
          const hour = day.hour(0);
          setPendingTimeSelection({ day, hour, isAllDay: true });
        }}
        onAllDayEventDrop={async (event, newDate) => {
          const newDateStr = newDate.format('YYYY-MM-DD');
          await updateEvent({
            ...event,
            date: newDateStr,
            startsAt: newDate.startOf('day').toISOString(),
            endsAt: newDate.endOf('day').toISOString(),
          });
        }}
        isBulkMode={isBulkMode}
        isSelected={isSelected}
        onToggleSelection={toggleSelection}
        onDeleteEvent={handleDeleteEvent}
        onColorChange={handleColorChange}
        onLockToggle={toggleEventLock}
      />
      </motion.div>
      </AnimatePresence>

      <div className="mx-2 mb-2 rounded-2xl overflow-hidden">
        <ScrollArea className="h-[calc(100vh-170px)]">
          {/* Sticky day column labels — matches the grid below for clear mapping */}
          <div
            className="sticky top-0 z-10 bg-gradient-to-b from-background via-background to-background/80 backdrop-blur-sm px-4 pt-1.5 pb-1 border-b border-purple-100/50 dark:border-white/5 overflow-hidden"
            style={{ display: 'grid', gridTemplateColumns: `auto repeat(${visibleDayCount}, 1fr)` }}
          >
            <div className="w-16" />
            <AnimatePresence mode="popLayout" initial={false}>
              {visibleWeekDays.map(({ currentDate, today }, i) => (
                <motion.div
                  key={`label-${weekKey}-${i}`}
                  initial={{ opacity: 0, x: directionRef.current * 30 }}
                  animate={{ opacity: 1, x: 0, transition: { type: "spring", damping: 28, stiffness: 300, delay: i * 0.022 } }}
                  exit={{ opacity: 0, x: directionRef.current * -30, transition: { duration: 0.1 } }}
                  className={cn(
                    "text-center text-[11px] font-medium",
                    today ? "text-primary" : "text-muted-foreground/70"
                  )}
                >
                  {currentDate.format("ddd D")}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="px-4 py-2" style={{ display: 'grid', gridTemplateColumns: `auto repeat(${visibleDayCount}, 1fr)` }}>
            <TimeColumn />
            {visibleWeekDays.map(({ currentDate }, index) => {
              const dayEvents = timedEventsByDay.get(currentDate.format("YYYY-MM-DD")) || [];

              return (
                <DayColumn
                  key={`${weekKey}-${index}`}
                  currentDate={currentDate}
                  dayEvents={dayEvents}
                  currentTime={currentTime}
                  onTimeSlotClick={handleTimeSlotClick}
                  onDragOver={handleDragOver}
                  onDrop={(e, day, hour) => handleDrop(e, day, hour)}
                  openEventSummary={openEventSummary}
                  toggleEventLock={toggleEventLock}
                  isBulkMode={isBulkMode}
                  isSelected={isSelected}
                  onToggleSelection={toggleSelection}
                  onShiftClickEvent={(eventId) => {
                    enableBulkMode();
                    toggleSelection(eventId);
                  }}
                  draggingBulkEventId={draggingBulkEventId}
                  onDeleteEvent={handleDeleteEvent}
                  onColorChange={handleColorChange}
                  onResizeEvent={handleResizeEvent}
                />
              );
            })}
          </div>
        </ScrollArea>
      </div>
      <AddEventButton />

      {isBulkMode && selectedCount > 0 && (
        <BulkActionToolbar
          selectedCount={selectedCount}
          onDelete={bulkDelete}
          onUpdateColor={bulkUpdateColor}
          onReschedule={bulkReschedule}
          onDuplicate={bulkDuplicate}
          onDeselectAll={deselectAll}
          hasRecurringEvents={hasRecurringEvents()}
          recurringCount={getRecurringEvents().length}
        />
      )}

      <EventForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setTodoData(null);
        }}
        initialTime={selectedTime}
        todoData={todoData}
        onSave={handleSaveEvent}
      />

      <EventDetails open={isEventSummaryOpen} onClose={closeEventSummary} />

      <TodoDropDialog
        open={isTodoCalendarDialogOpen}
        onClose={hideTodoCalendarDialog}
        todoTitle={currentTodoData?.text || ''}
        date={currentDateTimeData?.date || null}
        startTime={currentDateTimeData?.startTime || null}
        onConfirm={handleTodoDropConfirm}
      />

      <TodoLinkedWarningDialog
        open={isLinkedWarningOpen}
        onClose={hideLinkedWarning}
        todoTitle={currentTodoData?.text || ''}
        linkedEventRefs={linkedEventRefs}
        onNavigateToEvent={navigateToLinkedEvent}
        onScheduleAnyway={scheduleAnywayFromWarning}
      />

      {/* Bulk drag ghost copies */}
      {ghostsPortal}

      {/* Recurring Event Edit Dialog for drag-drop operations */}
      {recurringEventForDialog && (
        <RecurringEventEditDialog
          open={recurringDropDialogOpen}
          onOpenChange={setRecurringDropDialogOpen}
          event={recurringEventForDialog}
          action="edit"
          onConfirm={handleRecurringDropConfirm}
          onCancel={() => {
            setPendingRecurringDrop(null);
            setRecurringEventForDialog(null);
          }}
        />
      )}
    </>
  );
};

export default WeekView;
