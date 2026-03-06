
import { useState, useCallback } from 'react';
import { CalendarEventType } from '@/lib/stores/types';
import { TodoDragData, createCalendarEventFromTodo, createTodoFromCalendarEvent } from '@/lib/dragdropHandlers';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { useTodos } from '@/hooks/use-todos';
import { useEisenhower } from '@/hooks/use-eisenhower';
import { useEntityLinks } from '@/hooks/use-entity-links';
import { toast } from 'sonner';
import dayjs from 'dayjs';

export function useTodoCalendarIntegration() {
  // Legacy dialog state — kept for backward compat but no longer the primary flow
  const [isTodoCalendarDialogOpen, setIsTodoCalendarDialogOpen] = useState(false);
  const [currentTodoData, setCurrentTodoData] = useState<TodoDragData | null>(null);
  const [currentDateTimeData, setCurrentDateTimeData] = useState<{ date: Date, startTime: string } | null>(null);
  
  const { addEvent, updateEvent, removeEvent } = useCalendarEvents();
  const { addTodo, linkTodoToEvent, deleteTodo, updateTodoTitle, unlinkTodoFromEvent } = useTodos();
  const { removeItem: removeEisenhowerItem } = useEisenhower();
  const { link: createEntityLinkFn, unlink, getLinksFor, getLinksForFast, areLinked } = useEntityLinks();
  
  // ─── Option B: INSTANT creation (no dialog) ─────────────────────────
  // Dragging a todo onto the calendar immediately creates both a linked
  // event and keeps the todo. An undo toast lets the user:
  //   - "Unlink" (keep both but remove the link)
  //   - "Remove todo" (delete the original todo, keep event only)
  const instantCreateEventFromTodo = useCallback(async (
    todoData: TodoDragData,
    date: Date,
    startTime: string
  ) => {
    const eventId = await createCalendarEventFromTodo(
      todoData,
      date,
      startTime,
      true, // always keep todo (Option B)
      {
        addEventFn: addEvent,
        updateEventFn: updateEvent,
        linkTodoToEventFn: linkTodoToEvent,
        deleteTodoFn: deleteTodo,
        onShowTodoCalendarDialog: () => {}, // unused in instant mode
        createEntityLinkFn,
      }
    );

    if (!eventId) return; // creation failed — error toast already shown

    const startDayjs = dayjs(date);
    const formattedTime = startDayjs.format('MMM D') + ' at ' + startTime;

    // Show undo toast with actions
    toast.success(`"${todoData.text}" → calendar`, {
      description: `Linked as both todo & event · ${formattedTime}`,
      duration: 6000,
      action: {
        label: 'Unlink',
        onClick: async () => {
          // Remove the link but keep both entities
          try {
            await unlinkTodoFromEvent(todoData.id);
            await updateEvent({
              id: eventId,
              todoId: undefined,
              isTodo: false,
            } as any);
            toast.info('Todo and event unlinked — both still exist');
          } catch {
            toast.error('Failed to unlink');
          }
        },
      },
      cancel: {
        label: 'Remove todo',
        onClick: async () => {
          // Delete the todo, keep the event
          try {
            if (todoData.source === 'eisenhower') {
              await removeEisenhowerItem(todoData.id);
            } else {
              await deleteTodo(todoData.id);
            }
            await updateEvent({
              id: eventId,
              todoId: undefined,
              isTodo: false,
            } as any);
            toast.info('Todo removed — calendar event kept');
          } catch {
            toast.error('Failed to remove todo');
          }
        },
      },
    });
  }, [addEvent, updateEvent, linkTodoToEvent, deleteTodo, createEntityLinkFn, unlinkTodoFromEvent, removeEisenhowerItem]);

  // ─── Legacy dialog flow (kept for backward compat) ──────────────────
  const showTodoCalendarDialog = useCallback((todoData: TodoDragData, date: Date, startTime: string) => {
    // Option B: Skip the dialog entirely, create instantly
    instantCreateEventFromTodo(todoData, date, startTime);
  }, [instantCreateEventFromTodo]);

  const hideTodoCalendarDialog = useCallback(() => {
    setIsTodoCalendarDialogOpen(false);
  }, []);
  
  // Legacy handlers — still work if dialog is somehow triggered
  const handleCreateBoth = useCallback(async () => {
    if (!currentTodoData || !currentDateTimeData) return;
    await instantCreateEventFromTodo(currentTodoData, currentDateTimeData.date, currentDateTimeData.startTime);
    hideTodoCalendarDialog();
  }, [currentTodoData, currentDateTimeData, instantCreateEventFromTodo, hideTodoCalendarDialog]);
  
  const handleCreateCalendarOnly = useCallback(async () => {
    if (!currentTodoData || !currentDateTimeData) return;
    
    const sourceAwareDeleteFn = async (id: string) => {
      if (currentTodoData.source === 'eisenhower') {
        await removeEisenhowerItem(id);
      } else {
        await deleteTodo(id);
      }
    };
    
    await createCalendarEventFromTodo(
      currentTodoData,
      currentDateTimeData.date,
      currentDateTimeData.startTime,
      false,
      {
        addEventFn: addEvent,
        updateEventFn: updateEvent,
        linkTodoToEventFn: linkTodoToEvent,
        deleteTodoFn: sourceAwareDeleteFn,
        onShowTodoCalendarDialog: () => {},
        createEntityLinkFn,
      }
    );
    
    hideTodoCalendarDialog();
  }, [currentTodoData, currentDateTimeData, addEvent, updateEvent, linkTodoToEvent, deleteTodo, removeEisenhowerItem, createEntityLinkFn, hideTodoCalendarDialog]);
  
  // ─── Option F: Create todo from calendar event ───────────────────────
  const handleCreateTodoFromEvent = useCallback(async (event: CalendarEventType): Promise<string | null> => {
    if (!event || !event.id || !event.title) {
      console.error("Invalid event object provided to createTodoFromEvent:", event);
      return null;
    }
    
    return await createTodoFromCalendarEvent(
      event,
      linkTodoToEvent,
      addTodo,
      createEntityLinkFn
    );
  }, [linkTodoToEvent, addTodo, createEntityLinkFn]);
  
  // ─── S2: Title sync ─────────────────────────────────────────────────
  const syncTitles = useCallback(async (eventId: string, todoId: string, newTitle: string): Promise<boolean> => {
    try {
      if (!updateTodoTitle) {
        console.error("updateTodoTitle function is not available");
        return false;
      }
      
      const result = await updateTodoTitle(todoId, newTitle);
      return result.success;
    } catch (error) {
      console.error("Error syncing titles:", error);
      return false;
    }
  }, [updateTodoTitle]);
  
  return {
    // Legacy dialog state (dialog no longer shows — instant mode)
    isTodoCalendarDialogOpen,
    showTodoCalendarDialog,
    hideTodoCalendarDialog,
    currentTodoData,
    handleCreateBoth,
    handleCreateCalendarOnly,

    // Core operations
    instantCreateEventFromTodo,
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
