/**
 * @ Mention Reference System
 * 
 * Allows users to reference specific app entities (modules, events, pages, tasks, etc.)
 * in their AI chat messages via @mentions. Each reference resolves to a structured
 * object with the entity's ID so the AI can target it precisely.
 *
 * Tab structure: One tab per module type + Events + Pages.
 * Drill-down: Clicking a chevron drills into children (e.g., list → items).
 */

/**
 * Tab IDs — one per module type, plus general entity tabs.
 */
export type MentionTabId =
  | 'todo-lists'
  | 'pomodoro'
  | 'alarms'
  | 'eisenhower'
  | 'invites'
  | 'events'
  | 'calendars'
  | 'pages';

/**
 * Granular entity type for the actual thing being referenced
 */
export type MentionEntityType =
  | 'todo-list'      // A whole todo list
  | 'todo-item'      // A specific todo
  | 'pomodoro'       // A pomodoro timer instance
  | 'alarm'          // An individual alarm
  | 'reminder'       // An individual reminder
  | 'eisenhower-item' // An item in the matrix
  | 'invite'         // A specific invite
  | 'event'          // A calendar event
  | 'calendar'       // A user calendar (e.g. Work, Personal)
  | 'template'       // An event template
  | 'page'           // A sidebar page
  | 'module';        // A module instance on a page

/**
 * Lucide icon name keys (resolved to components in the UI layer)
 */
export type IconName =
  | 'list-todo'
  | 'check-square'
  | 'timer'
  | 'bell'
  | 'bell-ring'
  | 'grid-2x2'
  | 'mail'
  | 'calendar'
  | 'file-text'
  | 'layers'
  | 'circle-dot'
  | 'send'
  | 'inbox'
  | 'bookmark'
  | 'palette';

export interface MentionReference {
  /** Unique ID for this mention instance (React keys / dedup) */
  mentionId: string;
  /** The actual entity ID */
  entityId: string;
  /** What kind of entity */
  entityType: MentionEntityType;
  /** Which tab it came from */
  tabId: MentionTabId;
  /** Human-readable label, e.g. "School" */
  label: string;
  /** Compact label for chip, e.g. "list:School" */
  shortLabel: string;
  /** Lucide icon name */
  iconName: IconName;
  /** Optional color accent */
  color?: string;
}

/** An item in the mention popover */
export interface MentionOption {
  entityId: string;
  entityType: MentionEntityType;
  label: string;
  iconName: IconName;
  color?: string;
  description?: string;
  /** If true, this item has children the user can drill into */
  drillable?: boolean;
  /** Children for drill-down (loaded lazily) */
  children?: MentionOption[];
}

/** Serialized reference sent to the AI backend */
export interface SerializedReference {
  entityId: string;
  entityType: MentionEntityType;
  label: string;
}

/**
 * Convert a MentionOption into a MentionReference chip
 */
export function createMentionReference(option: MentionOption, tabId: MentionTabId): MentionReference {
  const prefixMap: Record<MentionEntityType, string> = {
    'todo-list': 'list',
    'todo-item': 'task',
    'pomodoro': 'pomodoro',
    'alarm': 'alarm',
    'reminder': 'reminder',
    'eisenhower-item': 'priority',
    'invite': 'invite',
    'event': 'event',
    'calendar': 'calendar',
    'template': 'template',
    'page': 'page',
    'module': 'module',
  };
  const prefix = prefixMap[option.entityType] || option.entityType;

  return {
    mentionId: crypto.randomUUID(),
    entityId: option.entityId,
    entityType: option.entityType,
    tabId,
    label: option.label,
    shortLabel: `${prefix}:${option.label}`,
    iconName: option.iconName,
    color: option.color,
  };
}

/**
 * Serialize references for the AI request payload
 */
export function serializeReferences(refs: MentionReference[]): SerializedReference[] {
  return refs.map(r => ({
    entityId: r.entityId,
    entityType: r.entityType,
    label: r.label,
  }));
}
