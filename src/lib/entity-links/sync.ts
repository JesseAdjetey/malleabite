/**
 * ═══════════════════════════════════════════════════════════════════════════
 * UNIFIED ENTITY LINK SYSTEM — Sync Engine
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Handles property propagation across linked entities.
 * When a title, time, or completion status changes on one entity,
 * the sync engine pushes those changes to all linked entities
 * whose sync rules allow it.
 *
 * This is a pure-function module — it receives the entity update
 * functions as parameters so it stays decoupled from specific hooks.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { EntityLink, EntityType } from './types';
import { getLinksForEntity, updateLinkTitles } from './service';

// ---------------------------------------------------------------------------
// Types for entity update functions (injected by hooks)
// ---------------------------------------------------------------------------

export interface EntityUpdaters {
  updateEventTitle?: (eventId: string, title: string) => Promise<any>;
  updateTodoTitle?: (todoId: string, title: string) => Promise<any>;
  updateAlarmTitle?: (alarmId: string, title: string) => Promise<any>;
  updateReminderTitle?: (reminderId: string, title: string) => Promise<any>;
  updateEisenhowerTitle?: (itemId: string, title: string) => Promise<any>;

  updateEventTime?: (eventId: string, startsAt: string, endsAt: string) => Promise<any>;
  updateAlarmTime?: (alarmId: string, time: string) => Promise<any>;
  updateReminderTime?: (reminderId: string, time: string) => Promise<any>;

  completeEvent?: (eventId: string, completed: boolean) => Promise<any>;
  completeTodo?: (todoId: string, completed: boolean) => Promise<any>;
  completeEisenhower?: (itemId: string, completed: boolean) => Promise<any>;

  deleteEvent?: (eventId: string) => Promise<any>;
  deleteTodo?: (todoId: string) => Promise<any>;
  deleteAlarm?: (alarmId: string) => Promise<any>;
  deleteReminder?: (reminderId: string) => Promise<any>;
  deleteEisenhower?: (itemId: string) => Promise<any>;
}

// ---------------------------------------------------------------------------
// Title sync
// ---------------------------------------------------------------------------

/**
 * When an entity's title changes, propagate to all linked entities
 * that have syncTitle enabled.
 */
export async function syncTitleChange(
  userId: string,
  changedType: EntityType,
  changedId: string,
  newTitle: string,
  updaters: EntityUpdaters
): Promise<void> {
  try {
    const links = await getLinksForEntity(userId, changedType, changedId);

    // Update denormalized titles on link docs
    await updateLinkTitles(userId, changedType, changedId, newTitle);

    // Propagate to linked entities
    for (const link of links) {
      if (!link.syncRules.syncTitle) continue;

      const isSource = link.sourceType === changedType && link.sourceId === changedId;
      const otherType = isSource ? link.targetType : link.sourceType;
      const otherId = isSource ? link.targetId : link.sourceId;

      await propagateTitle(otherType, otherId, newTitle, updaters);
    }
  } catch (error) {
    console.error('[EntityLinks/Sync] Title sync failed:', error);
  }
}

async function propagateTitle(
  type: EntityType,
  id: string,
  title: string,
  updaters: EntityUpdaters
): Promise<void> {
  switch (type) {
    case 'event':
      await updaters.updateEventTitle?.(id, title);
      break;
    case 'todo':
      await updaters.updateTodoTitle?.(id, title);
      break;
    case 'alarm':
      await updaters.updateAlarmTitle?.(id, title);
      break;
    case 'reminder':
      await updaters.updateReminderTitle?.(id, title);
      break;
    case 'eisenhower':
      await updaters.updateEisenhowerTitle?.(id, title);
      break;
  }
}

// ---------------------------------------------------------------------------
// Time sync
// ---------------------------------------------------------------------------

/**
 * When an event's time changes, propagate to linked alarms/reminders
 * that have syncTime enabled.
 */
export async function syncTimeChange(
  userId: string,
  changedType: EntityType,
  changedId: string,
  newStartTime: string, // ISO string
  newEndTime: string,   // ISO string
  updaters: EntityUpdaters
): Promise<void> {
  try {
    const links = await getLinksForEntity(userId, changedType, changedId);

    for (const link of links) {
      if (!link.syncRules.syncTime) continue;

      const isSource = link.sourceType === changedType && link.sourceId === changedId;
      const otherType = isSource ? link.targetType : link.sourceType;
      const otherId = isSource ? link.targetId : link.sourceId;

      switch (otherType) {
        case 'alarm':
          await updaters.updateAlarmTime?.(otherId, newStartTime);
          break;
        case 'reminder':
          await updaters.updateReminderTime?.(otherId, newStartTime);
          break;
        case 'event':
          await updaters.updateEventTime?.(otherId, newStartTime, newEndTime);
          break;
        // Todos don't have a "time" field to sync
      }
    }
  } catch (error) {
    console.error('[EntityLinks/Sync] Time sync failed:', error);
  }
}

// ---------------------------------------------------------------------------
// Completion sync
// ---------------------------------------------------------------------------

/**
 * When a todo is completed/uncompleted, propagate to linked entities
 * that have syncCompletion enabled.
 */
export async function syncCompletionChange(
  userId: string,
  changedType: EntityType,
  changedId: string,
  completed: boolean,
  updaters: EntityUpdaters
): Promise<void> {
  try {
    const links = await getLinksForEntity(userId, changedType, changedId);

    for (const link of links) {
      if (!link.syncRules.syncCompletion) continue;

      const isSource = link.sourceType === changedType && link.sourceId === changedId;
      const otherType = isSource ? link.targetType : link.sourceType;
      const otherId = isSource ? link.targetId : link.sourceId;

      switch (otherType) {
        case 'event':
          await updaters.completeEvent?.(otherId, completed);
          break;
        case 'todo':
          await updaters.completeTodo?.(otherId, completed);
          break;
        case 'eisenhower':
          await updaters.completeEisenhower?.(otherId, completed);
          break;
        // Alarms/reminders don't have completion state
      }
    }
  } catch (error) {
    console.error('[EntityLinks/Sync] Completion sync failed:', error);
  }
}

// ---------------------------------------------------------------------------
// Cascade delete helpers
// ---------------------------------------------------------------------------

/**
 * Get entities that should be cascade-deleted when the given entity is deleted.
 * Does NOT actually delete them — returns the list for the hook to handle.
 */
export async function getCascadeDeleteTargets(
  userId: string,
  entityType: EntityType,
  entityId: string
): Promise<Array<{ type: EntityType; id: string; linkId: string }>> {
  const links = await getLinksForEntity(userId, entityType, entityId);
  const targets: Array<{ type: EntityType; id: string; linkId: string }> = [];

  for (const link of links) {
    if (!link.syncRules.cascadeDelete) continue;

    const isSource = link.sourceType === entityType && link.sourceId === entityId;
    targets.push({
      type: isSource ? link.targetType : link.sourceType,
      id: isSource ? link.targetId : link.sourceId,
      linkId: link.id,
    });
  }

  return targets;
}
