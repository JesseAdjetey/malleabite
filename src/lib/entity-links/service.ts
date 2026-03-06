/**
 * ═══════════════════════════════════════════════════════════════════════════
 * UNIFIED ENTITY LINK SYSTEM — Firebase Service Layer
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * All CRUD operations for the `entity_links` Firestore collection.
 * This is the low-level layer — hooks wrap these functions with
 * React state and real-time subscriptions.
 *
 * Every relationship between entities (todo↔event, event↔alarm, etc.)
 * flows through this service. It also handles:
 *   - Denormalized FK backfill (sets todoId/event_id for backward compat)
 *   - Cascade operations (delete linked entities when configured)
 *   - Title/time/completion propagation through linked entities
 * ═══════════════════════════════════════════════════════════════════════════
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import {
  EntityLink,
  EntityType,
  LinkRelation,
  LinkSyncRules,
  CreateEntityLinkInput,
  UpdateEntityLinkInput,
  EntityLinkQuery,
  EntityRef,
  ENTITY_LINKS_COLLECTION,
  DEFAULT_SYNC_RULES,
} from './types';

// ---------------------------------------------------------------------------
// Collection reference
// ---------------------------------------------------------------------------

const linksCollection = () => collection(db, ENTITY_LINKS_COLLECTION);

// ---------------------------------------------------------------------------
// CREATE
// ---------------------------------------------------------------------------

/**
 * Create a link between two entities.
 * Returns the new link's Firestore document ID.
 *
 * Automatically applies default sync rules for the relation type,
 * merged with any overrides provided.
 */
export async function createEntityLink(
  userId: string,
  input: CreateEntityLinkInput
): Promise<{ success: boolean; linkId?: string; error?: string }> {
  try {
    // Prevent duplicate links between the same pair
    const existing = await findExistingLink(
      userId,
      input.sourceType,
      input.sourceId,
      input.targetType,
      input.targetId
    );
    if (existing) {
      return { success: true, linkId: existing.id }; // idempotent
    }

    const syncRules: LinkSyncRules = {
      ...DEFAULT_SYNC_RULES[input.relation],
      ...input.syncRules,
    };

    const linkData: Omit<EntityLink, 'id'> = {
      userId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceTitle: input.sourceTitle || '',
      targetType: input.targetType,
      targetId: input.targetId,
      targetTitle: input.targetTitle || '',
      relation: input.relation,
      syncRules,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
      metadata: input.metadata || {},
    };

    const docRef = await addDoc(linksCollection(), linkData);

    // Backfill legacy FK fields for backward compatibility
    await backfillLegacyFKs(
      input.sourceType,
      input.sourceId,
      input.targetType,
      input.targetId,
      input.relation
    );

    return { success: true, linkId: docRef.id };
  } catch (error: any) {
    console.error('[EntityLinks] Failed to create link:', error);
    return { success: false, error: error.message };
  }
}

// ---------------------------------------------------------------------------
// READ
// ---------------------------------------------------------------------------

/**
 * Get all links involving a specific entity (as source OR target).
 * Returns both directions in a single flat array.
 */
export async function getLinksForEntity(
  userId: string,
  entityType: EntityType,
  entityId: string
): Promise<EntityLink[]> {
  try {
    // Query as source
    const asSourceQ = query(
      linksCollection(),
      where('userId', '==', userId),
      where('sourceType', '==', entityType),
      where('sourceId', '==', entityId)
    );

    // Query as target
    const asTargetQ = query(
      linksCollection(),
      where('userId', '==', userId),
      where('targetType', '==', entityType),
      where('targetId', '==', entityId)
    );

    const [sourceSnap, targetSnap] = await Promise.all([
      getDocs(asSourceQ),
      getDocs(asTargetQ),
    ]);

    const links: EntityLink[] = [];
    const seen = new Set<string>();

    for (const snap of [sourceSnap, targetSnap]) {
      snap.forEach((doc) => {
        if (!seen.has(doc.id)) {
          seen.add(doc.id);
          links.push({ id: doc.id, ...doc.data() } as EntityLink);
        }
      });
    }

    return links;
  } catch (error) {
    console.error('[EntityLinks] Failed to get links:', error);
    return [];
  }
}

/**
 * Subscribe to real-time link changes for a user.
 * Fires callback whenever any link owned by this user changes.
 */
export function subscribeToUserLinks(
  userId: string,
  callback: (links: EntityLink[]) => void
): Unsubscribe {
  const q = query(linksCollection(), where('userId', '==', userId));

  return onSnapshot(q, (snapshot) => {
    const links = snapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as EntityLink)
    );
    callback(links);
  });
}

/**
 * Subscribe to links for a specific entity (both directions).
 * More targeted than subscribeToUserLinks — only fires for links
 * involving this entity.
 */
export function subscribeToEntityLinks(
  userId: string,
  entityType: EntityType,
  entityId: string,
  callback: (links: EntityLink[]) => void
): Unsubscribe {
  // We need two listeners (source + target) and merge
  const links = new Map<string, EntityLink>();
  let sourceLinks: EntityLink[] = [];
  let targetLinks: EntityLink[] = [];

  const emit = () => {
    links.clear();
    for (const l of [...sourceLinks, ...targetLinks]) {
      links.set(l.id, l);
    }
    callback(Array.from(links.values()));
  };

  const asSourceQ = query(
    linksCollection(),
    where('userId', '==', userId),
    where('sourceType', '==', entityType),
    where('sourceId', '==', entityId)
  );
  const asTargetQ = query(
    linksCollection(),
    where('userId', '==', userId),
    where('targetType', '==', entityType),
    where('targetId', '==', entityId)
  );

  const unsub1 = onSnapshot(asSourceQ, (snap) => {
    sourceLinks = snap.docs.map((d) => ({ id: d.id, ...d.data() } as EntityLink));
    emit();
  });
  const unsub2 = onSnapshot(asTargetQ, (snap) => {
    targetLinks = snap.docs.map((d) => ({ id: d.id, ...d.data() } as EntityLink));
    emit();
  });

  return () => {
    unsub1();
    unsub2();
  };
}

/**
 * Get lightweight EntityRef objects for all entities linked to a given entity.
 * Used for badge/chip display in the UI.
 */
export function getEntityRefsFromLinks(
  links: EntityLink[],
  selfType: EntityType,
  selfId: string
): EntityRef[] {
  return links.map((link) => {
    // Determine which side is "the other entity"
    const isSource = link.sourceType === selfType && link.sourceId === selfId;
    return {
      type: isSource ? link.targetType : link.sourceType,
      id: isSource ? link.targetId : link.sourceId,
      title: isSource ? (link.targetTitle || '') : (link.sourceTitle || ''),
      relation: link.relation,
      linkId: link.id,
    };
  });
}

// ---------------------------------------------------------------------------
// UPDATE
// ---------------------------------------------------------------------------

/**
 * Update a link's sync rules or metadata.
 */
export async function updateEntityLink(
  linkId: string,
  updates: UpdateEntityLinkInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const ref = doc(db, ENTITY_LINKS_COLLECTION, linkId);
    await updateDoc(ref, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error: any) {
    console.error('[EntityLinks] Failed to update link:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update the denormalized title on all links involving an entity.
 * Call this whenever an entity's title changes.
 */
export async function updateLinkTitles(
  userId: string,
  entityType: EntityType,
  entityId: string,
  newTitle: string
): Promise<void> {
  try {
    const links = await getLinksForEntity(userId, entityType, entityId);
    const batch = writeBatch(db);

    for (const link of links) {
      const ref = doc(db, ENTITY_LINKS_COLLECTION, link.id);
      if (link.sourceType === entityType && link.sourceId === entityId) {
        batch.update(ref, { sourceTitle: newTitle, updatedAt: serverTimestamp() });
      }
      if (link.targetType === entityType && link.targetId === entityId) {
        batch.update(ref, { targetTitle: newTitle, updatedAt: serverTimestamp() });
      }
    }

    await batch.commit();
  } catch (error) {
    console.error('[EntityLinks] Failed to update link titles:', error);
  }
}

// ---------------------------------------------------------------------------
// DELETE
// ---------------------------------------------------------------------------

/**
 * Remove a specific link by ID.
 * Also clears legacy FK fields on the previously linked entities.
 */
export async function removeEntityLink(
  linkId: string,
  link?: EntityLink
): Promise<{ success: boolean; error?: string }> {
  try {
    // If we have the full link data, clear legacy FKs
    if (link) {
      await clearLegacyFKs(
        link.sourceType,
        link.sourceId,
        link.targetType,
        link.targetId
      );
    }

    await deleteDoc(doc(db, ENTITY_LINKS_COLLECTION, linkId));
    return { success: true };
  } catch (error: any) {
    console.error('[EntityLinks] Failed to remove link:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Remove ALL links involving a specific entity.
 * Used when an entity is being deleted.
 * If cascade is true, also deletes linked entities (per their sync rules).
 */
export async function removeAllLinksForEntity(
  userId: string,
  entityType: EntityType,
  entityId: string,
  cascade: boolean = false
): Promise<{
  success: boolean;
  removedLinks: number;
  cascadedEntities: Array<{ type: EntityType; id: string }>;
}> {
  const result = { success: true, removedLinks: 0, cascadedEntities: [] as Array<{ type: EntityType; id: string }> };

  try {
    const links = await getLinksForEntity(userId, entityType, entityId);
    const batch = writeBatch(db);

    for (const link of links) {
      // Determine the "other" entity
      const isSource = link.sourceType === entityType && link.sourceId === entityId;
      const otherType = isSource ? link.targetType : link.sourceType;
      const otherId = isSource ? link.targetId : link.sourceId;

      // Check if we should cascade delete
      if (cascade && link.syncRules.cascadeDelete) {
        result.cascadedEntities.push({ type: otherType, id: otherId });
        // The actual entity deletion is handled by the caller (hook layer)
        // because we don't have access to entity-specific delete fns here
      }

      // Clear legacy FKs
      await clearLegacyFKs(link.sourceType, link.sourceId, link.targetType, link.targetId);

      // Delete the link doc
      batch.delete(doc(db, ENTITY_LINKS_COLLECTION, link.id));
      result.removedLinks++;
    }

    await batch.commit();
    return result;
  } catch (error: any) {
    console.error('[EntityLinks] Failed to remove all links:', error);
    return { ...result, success: false };
  }
}

// ---------------------------------------------------------------------------
// FIND / QUERY helpers
// ---------------------------------------------------------------------------

/**
 * Check if a link already exists between two specific entities.
 */
async function findExistingLink(
  userId: string,
  sourceType: EntityType,
  sourceId: string,
  targetType: EntityType,
  targetId: string
): Promise<EntityLink | null> {
  // Check both directions
  const q1 = query(
    linksCollection(),
    where('userId', '==', userId),
    where('sourceType', '==', sourceType),
    where('sourceId', '==', sourceId),
    where('targetType', '==', targetType),
    where('targetId', '==', targetId)
  );
  const q2 = query(
    linksCollection(),
    where('userId', '==', userId),
    where('sourceType', '==', targetType),
    where('sourceId', '==', targetId),
    where('targetType', '==', sourceType),
    where('targetId', '==', sourceId)
  );

  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

  if (!snap1.empty) {
    const d = snap1.docs[0];
    return { id: d.id, ...d.data() } as EntityLink;
  }
  if (!snap2.empty) {
    const d = snap2.docs[0];
    return { id: d.id, ...d.data() } as EntityLink;
  }

  return null;
}

/**
 * Find all links between two specific entity types for a user.
 * Useful for e.g. "show me all todo↔event links".
 */
export async function findLinksBetweenTypes(
  userId: string,
  typeA: EntityType,
  typeB: EntityType
): Promise<EntityLink[]> {
  const q = query(
    linksCollection(),
    where('userId', '==', userId),
    where('sourceType', '==', typeA),
    where('targetType', '==', typeB)
  );
  const reverseQ = query(
    linksCollection(),
    where('userId', '==', userId),
    where('sourceType', '==', typeB),
    where('targetType', '==', typeA)
  );

  const [snap, reverseSnap] = await Promise.all([
    getDocs(q),
    getDocs(reverseQ),
  ]);

  const links: EntityLink[] = [];
  const seen = new Set<string>();

  for (const s of [snap, reverseSnap]) {
    s.forEach((d) => {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        links.push({ id: d.id, ...d.data() } as EntityLink);
      }
    });
  }

  return links;
}

// ---------------------------------------------------------------------------
// Legacy FK backfill — maintain backward compatibility
// ---------------------------------------------------------------------------

/**
 * When a link is created, set the old-style FK fields on both entities
 * so existing code that reads `event.todoId` or `todo.event_id` still works.
 */
async function backfillLegacyFKs(
  sourceType: EntityType,
  sourceId: string,
  targetType: EntityType,
  targetId: string,
  relation: LinkRelation
): Promise<void> {
  try {
    const batch = writeBatch(db);
    let hasBatchOps = false;

    // Helper: only add batch.update if the document actually exists
    const safeUpdate = async (colName: string, docId: string, data: Record<string, any>) => {
      try {
        const { getDoc: gd } = await import('firebase/firestore');
        const snap = await gd(doc(db, colName, docId));
        if (snap.exists()) {
          batch.update(doc(db, colName, docId), data);
          hasBatchOps = true;
        } else {
          console.log(`[backfillLegacyFKs] ${colName}/${docId} not found, skipping`);
        }
      } catch (e) {
        console.warn(`[backfillLegacyFKs] Error checking ${colName}/${docId}:`, e);
      }
    };

    // For todo types, check both 'todos' and 'todo_items' collections
    const safeTodoUpdate = async (todoId: string, data: Record<string, any>) => {
      const { getDoc: gd } = await import('firebase/firestore');
      // Try 'todos' first
      const snap1 = await gd(doc(db, 'todos', todoId)).catch(() => null);
      if (snap1?.exists()) {
        batch.update(doc(db, 'todos', todoId), data);
        hasBatchOps = true;
        return;
      }
      // Fallback to 'todo_items'
      const snap2 = await gd(doc(db, 'todo_items', todoId)).catch(() => null);
      if (snap2?.exists()) {
        // todo_items uses 'eventId' not 'event_id'
        const mappedData = { ...data };
        if ('event_id' in mappedData) {
          mappedData.eventId = mappedData.event_id;
          delete mappedData.event_id;
        }
        batch.update(doc(db, 'todo_items', todoId), mappedData);
        hasBatchOps = true;
        return;
      }
      console.log(`[backfillLegacyFKs] Todo ${todoId} not found in todos or todo_items, skipping`);
    };

    // todo ↔ event mirror link
    if (relation === 'mirror') {
      if (sourceType === 'todo' && targetType === 'event') {
        await safeTodoUpdate(sourceId, { event_id: targetId });
        await safeUpdate('calendar_events', targetId, { todoId: sourceId, isTodo: true });
      } else if (sourceType === 'event' && targetType === 'todo') {
        await safeUpdate('calendar_events', sourceId, { todoId: targetId, isTodo: true });
        await safeTodoUpdate(targetId, { event_id: sourceId });
      } else if (sourceType === 'eisenhower' && targetType === 'event') {
        await safeUpdate('eisenhower_items', sourceId, { event_id: targetId });
        await safeUpdate('calendar_events', targetId, { todoId: sourceId, isTodo: true });
      }
    }

    // alarm ↔ event / alarm ↔ todo
    if (relation === 'triggers') {
      if (sourceType === 'alarm' && targetType === 'event') {
        await safeUpdate('alarms', sourceId, { linkedEventId: targetId });
        await safeUpdate('calendar_events', targetId, { hasAlarm: true });
      } else if (sourceType === 'alarm' && targetType === 'todo') {
        await safeUpdate('alarms', sourceId, { linkedTodoId: targetId });
      } else if (sourceType === 'event' && targetType === 'alarm') {
        await safeUpdate('alarms', targetId, { linkedEventId: sourceId });
        await safeUpdate('calendar_events', sourceId, { hasAlarm: true });
      } else if (sourceType === 'todo' && targetType === 'alarm') {
        await safeUpdate('alarms', targetId, { linkedTodoId: sourceId });
      }
    }

    // reminder ↔ event
    if (relation === 'reminds') {
      if (sourceType === 'reminder' && targetType === 'event') {
        await safeUpdate('reminders', sourceId, { eventId: targetId });
        await safeUpdate('calendar_events', targetId, { hasReminder: true });
      } else if (sourceType === 'event' && targetType === 'reminder') {
        await safeUpdate('reminders', targetId, { eventId: sourceId });
        await safeUpdate('calendar_events', sourceId, { hasReminder: true });
      }
    }

    if (hasBatchOps) {
      await batch.commit();
    }
  } catch (error) {
    // Non-critical — legacy compat, log but don't fail the link creation
    console.warn('[EntityLinks] Legacy FK backfill failed (non-critical):', error);
  }
}

/**
 * When a link is removed, clear the old-style FK fields.
 */
async function clearLegacyFKs(
  sourceType: EntityType,
  sourceId: string,
  targetType: EntityType,
  targetId: string
): Promise<void> {
  try {
    const batch = writeBatch(db);

    if (sourceType === 'todo' && targetType === 'event') {
      batch.update(doc(db, 'todos', sourceId), { event_id: null });
      batch.update(doc(db, 'calendar_events', targetId), { todoId: null, isTodo: false });
    } else if (sourceType === 'event' && targetType === 'todo') {
      batch.update(doc(db, 'calendar_events', sourceId), { todoId: null, isTodo: false });
      batch.update(doc(db, 'todos', targetId), { event_id: null });
    } else if (sourceType === 'eisenhower' && targetType === 'event') {
      batch.update(doc(db, 'eisenhower_items', sourceId), { event_id: null });
      batch.update(doc(db, 'calendar_events', targetId), { todoId: null, isTodo: false });
    } else if (sourceType === 'alarm' && targetType === 'event') {
      batch.update(doc(db, 'alarms', sourceId), { linkedEventId: null });
    } else if (sourceType === 'alarm' && targetType === 'todo') {
      batch.update(doc(db, 'alarms', sourceId), { linkedTodoId: null });
    } else if (sourceType === 'event' && targetType === 'alarm') {
      batch.update(doc(db, 'alarms', targetId), { linkedEventId: null });
    } else if (sourceType === 'todo' && targetType === 'alarm') {
      batch.update(doc(db, 'alarms', targetId), { linkedTodoId: null });
    } else if (sourceType === 'reminder' && targetType === 'event') {
      batch.update(doc(db, 'reminders', sourceId), { eventId: null });
    } else if (sourceType === 'event' && targetType === 'reminder') {
      batch.update(doc(db, 'reminders', targetId), { eventId: null });
    }

    await batch.commit();
  } catch (error) {
    console.warn('[EntityLinks] Legacy FK clear failed (non-critical):', error);
  }
}
