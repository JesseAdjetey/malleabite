/**
 * ═══════════════════════════════════════════════════════════════════════════
 * UNIFIED ENTITY LINK SYSTEM — Core Types
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * This is the single source of truth for how entities in Malleabite connect.
 *
 * Instead of scattered FK fields (todoId on events, event_id on todos,
 * linkedEventId on alarms, etc.), all relationships flow through a
 * normalized link graph stored in the `entity_links` Firestore collection.
 *
 * Any entity can link to any other entity. Links are bidirectional by nature
 * (stored once, queryable from either side). Sync rules on each link
 * determine what properties propagate between connected entities.
 *
 * Entity types: event, todo, alarm, reminder, eisenhower
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Timestamp } from 'firebase/firestore';

// ---------------------------------------------------------------------------
// Entity taxonomy
// ---------------------------------------------------------------------------

/** All entity types in the system that can participate in links */
export type EntityType = 'event' | 'todo' | 'alarm' | 'reminder' | 'eisenhower';

/** Describes how two entities relate */
export type LinkRelation =
  | 'mirror'          // Bidirectional sync — the same "thing" viewed in two frameworks
                      //   e.g., a todo dragged to calendar: both represent the same task
  | 'triggers'        // One entity triggers/fires for another
                      //   e.g., an alarm set for a calendar event
  | 'reminds'         // A reminder attached to an entity
                      //   e.g., a 15-min-before reminder on a todo's due time
  | 'subtask_of'      // Hierarchical: one entity is a subtask of another
  | 'related';        // Loose association (user says "these are related")

// ---------------------------------------------------------------------------
// Sync rules — what propagates across a link
// ---------------------------------------------------------------------------

/** Fine-grained control over what stays in sync between linked entities */
export interface LinkSyncRules {
  /** When either entity's title changes, propagate to the other */
  syncTitle?: boolean;
  /** When a todo is completed, mark the mirror event as done (and vice versa) */
  syncCompletion?: boolean;
  /** When event time changes, update the linked alarm/reminder time */
  syncTime?: boolean;
  /** When either entity is deleted, also delete the linked entity */
  cascadeDelete?: boolean;
}

/** Default sync rules per relation type */
export const DEFAULT_SYNC_RULES: Record<LinkRelation, LinkSyncRules> = {
  mirror: {
    syncTitle: true,
    syncCompletion: true,
    syncTime: true,
    cascadeDelete: false, // user chooses
  },
  triggers: {
    syncTitle: false,
    syncCompletion: false,
    syncTime: true,       // alarm time follows event time
    cascadeDelete: true,  // delete alarm when event is deleted
  },
  reminds: {
    syncTitle: false,
    syncCompletion: false,
    syncTime: true,
    cascadeDelete: true,
  },
  subtask_of: {
    syncTitle: false,
    syncCompletion: false,
    syncTime: false,
    cascadeDelete: false,
  },
  related: {
    syncTitle: false,
    syncCompletion: false,
    syncTime: false,
    cascadeDelete: false,
  },
};

// ---------------------------------------------------------------------------
// The EntityLink record
// ---------------------------------------------------------------------------

/**
 * A single link between two entities, stored in Firestore `entity_links`.
 *
 * Links are stored once but are bidirectional:
 *  - Querying by sourceType+sourceId finds "outgoing" links
 *  - Querying by targetType+targetId finds "incoming" links
 *  - For display purposes, direction is mostly irrelevant — any link
 *    involving an entity ID shows up in that entity's link list.
 *
 * Source = the entity that initiated the link action (e.g., the todo that
 * was dragged onto the calendar). Target = the entity that was created or
 * linked to (e.g., the calendar event).
 */
export interface EntityLink {
  id: string;
  userId: string;

  // Source entity
  sourceType: EntityType;
  sourceId: string;
  sourceTitle?: string; // Denormalized for quick display without fetching

  // Target entity
  targetType: EntityType;
  targetId: string;
  targetTitle?: string; // Denormalized for quick display without fetching

  // Relationship metadata
  relation: LinkRelation;
  syncRules: LinkSyncRules;

  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Extensible metadata (e.g., "createdVia: 'drag-and-drop'")
  metadata?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Input types for creating / updating links
// ---------------------------------------------------------------------------

/** Input for creating a new entity link */
export interface CreateEntityLinkInput {
  sourceType: EntityType;
  sourceId: string;
  sourceTitle?: string;
  targetType: EntityType;
  targetId: string;
  targetTitle?: string;
  relation: LinkRelation;
  /** Override default sync rules for this relation */
  syncRules?: Partial<LinkSyncRules>;
  metadata?: Record<string, any>;
}

/** Input for updating an existing link's sync rules or metadata */
export interface UpdateEntityLinkInput {
  syncRules?: Partial<LinkSyncRules>;
  metadata?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/** Filter for querying links */
export interface EntityLinkQuery {
  entityType: EntityType;
  entityId: string;
  /** Optionally filter by the type of the *other* entity in the link */
  linkedEntityType?: EntityType;
  /** Optionally filter by relation type */
  relation?: LinkRelation;
}

/** A resolved link with the full entity data attached (for UI display) */
export interface ResolvedEntityLink extends EntityLink {
  /** The resolved entity on the "other side" of the link */
  resolvedEntity?: {
    type: EntityType;
    id: string;
    title: string;
    data: any; // The full entity object (CalendarEventType | TodoType | Alarm | etc.)
  };
}

// ---------------------------------------------------------------------------
// Entity reference — lightweight pointer used in UI chips/badges
// ---------------------------------------------------------------------------

/** Minimal reference to a linked entity, suitable for badge / chip display */
export interface EntityRef {
  type: EntityType;
  id: string;
  title: string;
  relation: LinkRelation;
  linkId: string; // ID of the EntityLink record, for unlink actions
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ENTITY_LINKS_COLLECTION = 'entity_links';

/** Human-readable labels for entity types */
export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  event: 'Calendar Event',
  todo: 'To-Do',
  alarm: 'Alarm',
  reminder: 'Reminder',
  eisenhower: 'Priority Task',
};

/** Icons for entity types (Lucide icon names) */
export const ENTITY_TYPE_ICONS: Record<EntityType, string> = {
  event: 'calendar',
  todo: 'check-square',
  alarm: 'bell-ring',
  reminder: 'clock',
  eisenhower: 'grid-2x2',
};

/** Colors for entity types */
export const ENTITY_TYPE_COLORS: Record<EntityType, string> = {
  event: 'bg-blue-500',
  todo: 'bg-purple-500',
  alarm: 'bg-orange-500',
  reminder: 'bg-green-500',
  eisenhower: 'bg-red-500',
};
