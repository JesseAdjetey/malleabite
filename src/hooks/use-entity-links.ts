/**
 * ═══════════════════════════════════════════════════════════════════════════
 * useEntityLinks — The unified React hook for entity relationships
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This hook is the primary API for the UI layer to:
 *   - Create links between entities (drag-drop, context menus, dialogs)
 *   - Remove links (unlink actions)
 *   - Query what's linked to a given entity
 *   - Subscribe to real-time link changes
 *   - Trigger sync propagation (title, time, completion)
 *
 * Usage:
 *   const { link, unlink, getLinksFor, allLinks } = useEntityLinks();
 *
 *   // Link a todo to an event
 *   await link({ sourceType: 'todo', sourceId: todoId, targetType: 'event', targetId: eventId, relation: 'mirror' });
 *
 *   // Get all links for an entity
 *   const refs = getLinksFor('event', eventId);
 *
 *   // Unlink
 *   await unlink(linkId);
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { toast } from 'sonner';
import {
  EntityLink,
  EntityType,
  EntityRef,
  CreateEntityLinkInput,
  UpdateEntityLinkInput,
  ENTITY_TYPE_LABELS,
} from '@/lib/entity-links/types';
import {
  createEntityLink,
  removeEntityLink,
  removeAllLinksForEntity,
  subscribeToUserLinks,
  getEntityRefsFromLinks,
  updateEntityLink,
} from '@/lib/entity-links/service';
import {
  syncTitleChange,
  syncTimeChange,
  syncCompletionChange,
  getCascadeDeleteTargets,
  EntityUpdaters,
} from '@/lib/entity-links/sync';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEntityLinks() {
  const { user } = useAuth();
  const [allLinks, setAllLinks] = useState<EntityLink[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── Real-time subscription to ALL user links ───────────────────────
  useEffect(() => {
    if (!user?.uid) {
      setAllLinks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeToUserLinks(user.uid, (links) => {
      setAllLinks(links);
      setLoading(false);
    });

    return unsub;
  }, [user?.uid]);

  // ─── Link two entities ──────────────────────────────────────────────
  const link = useCallback(
    async (input: CreateEntityLinkInput): Promise<string | null> => {
      if (!user?.uid) {
        toast.error('Please sign in to link items');
        return null;
      }

      const result = await createEntityLink(user.uid, input);

      if (result.success && result.linkId) {
        const sourceLabel = ENTITY_TYPE_LABELS[input.sourceType];
        const targetLabel = ENTITY_TYPE_LABELS[input.targetType];
        toast.success(`${sourceLabel} linked to ${targetLabel}`);
        return result.linkId;
      } else {
        toast.error(`Failed to link: ${result.error || 'Unknown error'}`);
        return null;
      }
    },
    [user?.uid]
  );

  // ─── Unlink by link ID ─────────────────────────────────────────────
  const unlink = useCallback(
    async (linkId: string, showToast = true): Promise<boolean> => {
      if (!user?.uid) return false;

      // Find the link data for legacy FK cleanup
      const linkData = allLinks.find((l) => l.id === linkId);
      const result = await removeEntityLink(linkId, linkData);

      if (result.success && showToast) {
        toast.success('Items unlinked');
      }
      return result.success;
    },
    [user?.uid, allLinks]
  );

  // ─── Unlink all links for an entity ────────────────────────────────
  const unlinkAll = useCallback(
    async (
      entityType: EntityType,
      entityId: string,
      cascade = false
    ): Promise<boolean> => {
      if (!user?.uid) return false;

      const result = await removeAllLinksForEntity(
        user.uid,
        entityType,
        entityId,
        cascade
      );

      if (result.success && result.removedLinks > 0) {
        toast.success(
          `Removed ${result.removedLinks} link${result.removedLinks !== 1 ? 's' : ''}`
        );
      }

      return result.success;
    },
    [user?.uid]
  );

  // ─── Update a link's sync rules ────────────────────────────────────
  const updateLink = useCallback(
    async (linkId: string, updates: UpdateEntityLinkInput): Promise<boolean> => {
      const result = await updateEntityLink(linkId, updates);
      return result.success;
    },
    []
  );

  // ─── Get EntityRef badges for a specific entity ────────────────────
  const getLinksFor = useCallback(
    (entityType: EntityType, entityId: string): EntityRef[] => {
      const relevantLinks = allLinks.filter(
        (l) =>
          (l.sourceType === entityType && l.sourceId === entityId) ||
          (l.targetType === entityType && l.targetId === entityId)
      );
      return getEntityRefsFromLinks(relevantLinks, entityType, entityId);
    },
    [allLinks]
  );

  // ─── Check if two specific entities are linked ─────────────────────
  const areLinked = useCallback(
    (typeA: EntityType, idA: string, typeB: EntityType, idB: string): boolean => {
      return allLinks.some(
        (l) =>
          (l.sourceType === typeA &&
            l.sourceId === idA &&
            l.targetType === typeB &&
            l.targetId === idB) ||
          (l.sourceType === typeB &&
            l.sourceId === idB &&
            l.targetType === typeA &&
            l.targetId === idA)
      );
    },
    [allLinks]
  );

  // ─── Find the link record between two entities ─────────────────────
  const findLink = useCallback(
    (typeA: EntityType, idA: string, typeB: EntityType, idB: string): EntityLink | undefined => {
      return allLinks.find(
        (l) =>
          (l.sourceType === typeA &&
            l.sourceId === idA &&
            l.targetType === typeB &&
            l.targetId === idB) ||
          (l.sourceType === typeB &&
            l.sourceId === idB &&
            l.targetType === typeA &&
            l.targetId === idA)
      );
    },
    [allLinks]
  );

  // ─── Sync propagation methods (pass in updaters from calling hook) ─
  const propagateTitle = useCallback(
    async (
      entityType: EntityType,
      entityId: string,
      newTitle: string,
      updaters: EntityUpdaters
    ) => {
      if (!user?.uid) return;
      await syncTitleChange(user.uid, entityType, entityId, newTitle, updaters);
    },
    [user?.uid]
  );

  const propagateTime = useCallback(
    async (
      entityType: EntityType,
      entityId: string,
      newStart: string,
      newEnd: string,
      updaters: EntityUpdaters
    ) => {
      if (!user?.uid) return;
      await syncTimeChange(user.uid, entityType, entityId, newStart, newEnd, updaters);
    },
    [user?.uid]
  );

  const propagateCompletion = useCallback(
    async (
      entityType: EntityType,
      entityId: string,
      completed: boolean,
      updaters: EntityUpdaters
    ) => {
      if (!user?.uid) return;
      await syncCompletionChange(user.uid, entityType, entityId, completed, updaters);
    },
    [user?.uid]
  );

  const getCascadeTargets = useCallback(
    async (entityType: EntityType, entityId: string) => {
      if (!user?.uid) return [];
      return getCascadeDeleteTargets(user.uid, entityType, entityId);
    },
    [user?.uid]
  );

  // ─── Convenience: link count for an entity ─────────────────────────
  const getLinkCount = useCallback(
    (entityType: EntityType, entityId: string): number => {
      return allLinks.filter(
        (l) =>
          (l.sourceType === entityType && l.sourceId === entityId) ||
          (l.targetType === entityType && l.targetId === entityId)
      ).length;
    },
    [allLinks]
  );

  // ─── Indexed lookup for performance ────────────────────────────────
  const linkIndex = useMemo(() => {
    const index = new Map<string, EntityLink[]>();

    for (const link of allLinks) {
      const sourceKey = `${link.sourceType}:${link.sourceId}`;
      const targetKey = `${link.targetType}:${link.targetId}`;

      if (!index.has(sourceKey)) index.set(sourceKey, []);
      if (!index.has(targetKey)) index.set(targetKey, []);

      index.get(sourceKey)!.push(link);
      index.get(targetKey)!.push(link);
    }

    return index;
  }, [allLinks]);

  const getLinksForFast = useCallback(
    (entityType: EntityType, entityId: string): EntityRef[] => {
      const key = `${entityType}:${entityId}`;
      const relevantLinks = linkIndex.get(key) || [];
      return getEntityRefsFromLinks(relevantLinks, entityType, entityId);
    },
    [linkIndex]
  );

  return {
    // State
    allLinks,
    loading,
    linkIndex,

    // Core operations
    link,
    unlink,
    unlinkAll,
    updateLink,

    // Query
    getLinksFor,
    getLinksForFast,
    areLinked,
    findLink,
    getLinkCount,

    // Sync propagation
    propagateTitle,
    propagateTime,
    propagateCompletion,
    getCascadeTargets,
  };
}
