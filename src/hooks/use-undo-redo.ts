import { useEffect, useCallback } from 'react';
import { useUndoRedoStore, UndoableAction } from '@/lib/stores/undo-redo-store';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { useTodos } from '@/hooks/use-todos';
import { CalendarEventType } from '@/lib/stores/types';
import { toast } from 'sonner';

/**
 * Hook that provides undo/redo functionality for calendar and todo operations
 */
export function useUndoRedo() {
  const store = useUndoRedoStore();
  const { pushAction, undo, redo, canUndo, canRedo, getLastAction, undoStack, redoStack } = store;
  const { addEvent, removeEvent, updateEvent } = useCalendarEvents();
  const { addTodo, deleteTodo, toggleTodo } = useTodos();

  // Execute the undo operation
  const executeUndo = useCallback(async (action: UndoableAction) => {
    switch (action.type) {
      case 'CREATE_EVENT': {
        // To undo create, we delete the event
        const eventId = action.redoData.id;
        await removeEvent(eventId);
        break;
      }
      case 'DELETE_EVENT': {
        // To undo delete, we recreate the event
        const event = action.undoData as CalendarEventType;
        await addEvent(event);
        break;
      }
      case 'UPDATE_EVENT': {
        // To undo update, we restore the previous state
        const previousEvent = action.undoData as CalendarEventType;
        await updateEvent(previousEvent);
        break;
      }
      case 'CREATE_TODO': {
        // To undo create, we delete the todo
        const todoId = action.redoData.id;
        await deleteTodo(todoId);
        break;
      }
      case 'DELETE_TODO': {
        // To undo delete, we recreate the todo
        const todoData = action.undoData;
        await addTodo(todoData.text, todoData.listId);
        break;
      }
      case 'COMPLETE_TODO': {
        // To undo complete, we toggle it back
        const todoId = action.undoData.id;
        await toggleTodo(todoId);
        break;
      }
      case 'BULK_DELETE_EVENTS': {
        // To undo bulk delete, we recreate all events
        const events = action.undoData as CalendarEventType[];
        for (const event of events) {
          await addEvent(event);
        }
        break;
      }
      default:
        console.warn('Unknown action type for undo:', action.type);
    }
  }, [removeEvent, addEvent, updateEvent, deleteTodo, addTodo, toggleTodo]);

  // Execute the redo operation
  const executeRedo = useCallback(async (action: UndoableAction) => {
    switch (action.type) {
      case 'CREATE_EVENT': {
        // To redo create, we recreate the event
        const event = action.redoData as CalendarEventType;
        await addEvent(event);
        break;
      }
      case 'DELETE_EVENT': {
        // To redo delete, we delete the event again
        const eventId = action.undoData.id;
        await removeEvent(eventId);
        break;
      }
      case 'UPDATE_EVENT': {
        // To redo update, we apply the new state
        const newEvent = action.redoData as CalendarEventType;
        await updateEvent(newEvent);
        break;
      }
      case 'CREATE_TODO': {
        // To redo create, we recreate the todo
        const todoData = action.redoData;
        await addTodo(todoData.text, todoData.listId);
        break;
      }
      case 'DELETE_TODO': {
        // To redo delete, we delete the todo again
        const todoId = action.undoData.id;
        await deleteTodo(todoId);
        break;
      }
      case 'COMPLETE_TODO': {
        // To redo complete, we toggle it again
        const todoId = action.undoData.id;
        await toggleTodo(todoId);
        break;
      }
      case 'BULK_DELETE_EVENTS': {
        // To redo bulk delete, we delete all events again
        const events = action.undoData as CalendarEventType[];
        for (const event of events) {
          await removeEvent(event.id);
        }
        break;
      }
      default:
        console.warn('Unknown action type for redo:', action.type);
    }
  }, [addEvent, removeEvent, updateEvent, addTodo, deleteTodo, toggleTodo]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Ctrl/Cmd + Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo()) {
          const action = undo();
          if (action) {
            try {
              await executeUndo(action);
              toast.success(`Undid: ${action.description}`);
            } catch (error) {
              toast.error('Failed to undo action');
              console.error('Undo failed:', error);
            }
          }
        } else {
          toast.info('Nothing to undo');
        }
      }

      // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y for redo
      if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
        e.preventDefault();
        if (canRedo()) {
          const action = redo();
          if (action) {
            try {
              await executeRedo(action);
              toast.success(`Redid: ${action.description}`);
            } catch (error) {
              toast.error('Failed to redo action');
              console.error('Redo failed:', error);
            }
          }
        } else {
          toast.info('Nothing to redo');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, undo, redo, executeUndo, executeRedo]);

  // Utility functions for tracking actions
  const trackCreateEvent = useCallback((event: CalendarEventType) => {
    pushAction({
      type: 'CREATE_EVENT',
      description: `Created event "${event.title}"`,
      undoData: null,
      redoData: event,
    });
  }, [pushAction]);

  const trackDeleteEvent = useCallback((event: CalendarEventType) => {
    pushAction({
      type: 'DELETE_EVENT',
      description: `Deleted event "${event.title}"`,
      undoData: event,
      redoData: null,
    });
  }, [pushAction]);

  const trackUpdateEvent = useCallback((previousEvent: CalendarEventType, newEvent: CalendarEventType) => {
    pushAction({
      type: 'UPDATE_EVENT',
      description: `Updated event "${newEvent.title}"`,
      undoData: previousEvent,
      redoData: newEvent,
    });
  }, [pushAction]);

  const trackCreateTodo = useCallback((todo: { id: string; text: string; listId?: string }) => {
    pushAction({
      type: 'CREATE_TODO',
      description: `Created todo "${todo.text}"`,
      undoData: null,
      redoData: todo,
    });
  }, [pushAction]);

  const trackDeleteTodo = useCallback((todo: { id: string; text: string; listId?: string }) => {
    pushAction({
      type: 'DELETE_TODO',
      description: `Deleted todo "${todo.text}"`,
      undoData: todo,
      redoData: null,
    });
  }, [pushAction]);

  const trackCompleteTodo = useCallback((todo: { id: string; text: string }) => {
    pushAction({
      type: 'COMPLETE_TODO',
      description: `Completed todo "${todo.text}"`,
      undoData: todo,
      redoData: null,
    });
  }, [pushAction]);

  const trackBulkDeleteEvents = useCallback((events: CalendarEventType[]) => {
    pushAction({
      type: 'BULK_DELETE_EVENTS',
      description: `Deleted ${events.length} events`,
      undoData: events,
      redoData: null,
    });
  }, [pushAction]);

  return {
    // State - use stack length for reactive updates
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    lastAction: getLastAction(),
    
    // Manual undo/redo (for buttons)
    performUndo: async () => {
      if (canUndo()) {
        const action = undo();
        if (action) {
          try {
            await executeUndo(action);
            toast.success(`Undid: ${action.description}`);
          } catch (error) {
            toast.error('Failed to undo action');
          }
        }
      }
    },
    performRedo: async () => {
      if (canRedo()) {
        const action = redo();
        if (action) {
          try {
            await executeRedo(action);
            toast.success(`Redid: ${action.description}`);
          } catch (error) {
            toast.error('Failed to redo action');
          }
        }
      }
    },
    
    // Tracking functions
    trackCreateEvent,
    trackDeleteEvent,
    trackUpdateEvent,
    trackCreateTodo,
    trackDeleteTodo,
    trackCompleteTodo,
    trackBulkDeleteEvents,
  };
}
