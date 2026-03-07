/**
 * useMirrorSync — S2 full mirror sync for linked entities
 *
 * Provides wrapper functions that, after performing the primary update,
 * automatically propagate changes to linked entities via the entity-link
 * sync engine.
 *
 * Usage: call the returned wrapper functions instead of the raw CRUD
 * functions whenever you want sync to happen automatically.
 */

import { useCallback } from 'react';
import { useEntityLinks } from '@/hooks/use-entity-links';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { useTodos } from '@/hooks/use-todos';
import { CalendarEventType } from '@/lib/stores/types';
import { EntityUpdaters } from '@/lib/entity-links/sync';
import { toast } from 'sonner';

// Green colour convention for "completed" events
const COMPLETED_EVENT_COLOR = '#22c55e';

export function useMirrorSync() {
  const { updateEvent, removeEvent } = useCalendarEvents();
  const { toggleTodo, deleteTodo, updateTodoTitle, todos } = useTodos();
  const {
    propagateTitle,
    propagateCompletion,
    getCascadeTargets,
    getLinksForFast,
    unlink,
  } = useEntityLinks();

  // ── Shared updater map passed into the sync engine ────────────────
  const buildUpdaters = useCallback((): EntityUpdaters => ({
    updateEventTitle: async (eventId: string, title: string) => {
      await updateEvent({ id: eventId, title } as CalendarEventType);
    },
    updateTodoTitle: async (todoId: string, title: string) => {
      if (updateTodoTitle) await updateTodoTitle(todoId, title);
    },

    completeEvent: async (eventId: string, completed: boolean) => {
      // Express completion via colour (no boolean field on CalendarEventType)
      await updateEvent({
        id: eventId,
        color: completed ? COMPLETED_EVENT_COLOR : undefined,
      } as CalendarEventType);
    },
    completeTodo: async (todoId: string, _completed: boolean) => {
      // toggleTodo already flips the boolean — we just need to call it
      // BUT we must verify the current state to avoid double-toggling
      const todo = todos.find(t => t.id === todoId);
      if (!todo) return;
      // Only toggle if the desired state differs from current state
      if (todo.completed !== _completed) {
        await toggleTodo(todoId);
      }
    },

    deleteEvent: async (eventId: string) => {
      await removeEvent(eventId);
    },
    deleteTodo: async (todoId: string) => {
      await deleteTodo(todoId);
    },
  }), [updateEvent, updateTodoTitle, toggleTodo, removeEvent, deleteTodo, todos]);

  // ── Title sync ────────────────────────────────────────────────────
  /** Call after updating an event title. */
  const syncEventTitle = useCallback(async (eventId: string, newTitle: string) => {
    await propagateTitle('event', eventId, newTitle, buildUpdaters());
  }, [propagateTitle, buildUpdaters]);

  /** Call after updating a todo title. */
  const syncTodoTitle = useCallback(async (todoId: string, newTitle: string) => {
    await propagateTitle('todo', todoId, newTitle, buildUpdaters());
  }, [propagateTitle, buildUpdaters]);

  // ── Completion sync ───────────────────────────────────────────────
  /** Call after toggling a todo complete. */
  const syncTodoCompletion = useCallback(async (todoId: string, completed: boolean) => {
    await propagateCompletion('todo', todoId, completed, buildUpdaters());
  }, [propagateCompletion, buildUpdaters]);

  /** Call after "completing" an event (via the Complete button). */
  const syncEventCompletion = useCallback(async (eventId: string, completed: boolean) => {
    await propagateCompletion('event', eventId, completed, buildUpdaters());
  }, [propagateCompletion, buildUpdaters]);

  // ── Cascade-delete helper ─────────────────────────────────────────
  /**
   * Returns the list of linked entities that would be deleted if the
   * source entity is deleted. The caller can prompt the user.
   */
  const getDeleteTargets = useCallback(async (
    entityType: 'event' | 'todo',
    entityId: string
  ) => {
    return getCascadeTargets(entityType, entityId);
  }, [getCascadeTargets]);

  /**
   * Delete a linked entity and all cascade targets (or just unlink, per user choice).
   * `mode`:
   *   - 'cascade'  — delete linked entities too
   *   - 'unlink'   — remove links but keep the other entities
   */
  const deleteWithSync = useCallback(async (
    entityType: 'event' | 'todo',
    entityId: string,
    mode: 'cascade' | 'unlink' = 'unlink',
  ) => {
    const links = getLinksForFast(entityType, entityId);

    if (mode === 'cascade') {
      const updaters = buildUpdaters();
      for (const ref of links) {
        if (ref.type === 'event') await updaters.deleteEvent?.(ref.id);
        if (ref.type === 'todo') await updaters.deleteTodo?.(ref.id);
        if (ref.type === 'alarm') await updaters.deleteAlarm?.(ref.id);
        if (ref.type === 'reminder') await updaters.deleteReminder?.(ref.id);
        // Remove the link record itself
        await unlink(ref.linkId);
      }
    } else {
      // Just remove links (keep other entities)
      for (const ref of links) {
        await unlink(ref.linkId);
      }
    }

    // Now delete the primary entity
    if (entityType === 'event') await removeEvent(entityId);
    if (entityType === 'todo') await deleteTodo(entityId);
  }, [getLinksForFast, buildUpdaters, unlink, removeEvent, deleteTodo]);

  return {
    // Title sync
    syncEventTitle,
    syncTodoTitle,
    // Completion sync
    syncTodoCompletion,
    syncEventCompletion,
    // Delete
    getDeleteTargets,
    deleteWithSync,
    // Re-export for convenience
    getLinksForFast,
  };
}
