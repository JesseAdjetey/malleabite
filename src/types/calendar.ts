// Calendar Module Types
// Defines data structures for calendar groups, connected calendars,
// preferences, and synced events.

// ─── Calendar Source Providers ───────────────────────────────────────────────

export type CalendarSource = 'google' | 'microsoft' | 'apple';

export type CalendarSourceMeta = {
  id: CalendarSource;
  label: string;
  icon: string;       // Lucide icon name
  authUrl?: string;
  color: string;       // Default brand color
};

export const CALENDAR_SOURCES: Record<CalendarSource, CalendarSourceMeta> = {
  google: {
    id: 'google',
    label: 'Google Calendar',
    icon: 'calendar',
    color: '#4285F4',
  },
  microsoft: {
    id: 'microsoft',
    label: 'Microsoft Outlook',
    icon: 'mail',
    color: '#0078D4',
  },
  apple: {
    id: 'apple',
    label: 'Apple Calendar',
    icon: 'apple',
    color: '#333333',
  },
};

// ─── Calendar Group ─────────────────────────────────────────────────────────

export type GroupIcon = 'briefcase' | 'user' | 'users' | 'heart' | 'star' | 'folder' | 'globe' | 'zap';

export const GROUP_ICON_OPTIONS: { value: GroupIcon; label: string }[] = [
  { value: 'briefcase', label: 'Work' },
  { value: 'user', label: 'Personal' },
  { value: 'users', label: 'Family / Team' },
  { value: 'heart', label: 'Health' },
  { value: 'star', label: 'Favorites' },
  { value: 'folder', label: 'Projects' },
  { value: 'globe', label: 'Travel' },
  { value: 'zap', label: 'Productivity' },
];

export const DEFAULT_GROUP_COLORS = [
  '#3B82F6', // Blue
  '#8B5CF6', // Purple (brand)
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316', // Orange
];

export interface CalendarGroup {
  id: string;
  name: string;
  icon: GroupIcon;
  color: string;          // Hex color for group badge/accent
  order: number;          // Sort order (0-indexed)
  createdAt: string;      // ISO timestamp
  updatedAt: string;      // ISO timestamp
  isDefault: boolean;     // Default groups (Work, Personal, Family)
}

// The 3 default groups every new user starts with
export const DEFAULT_GROUPS: Omit<CalendarGroup, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'Work', icon: 'briefcase', color: '#3B82F6', order: 0, isDefault: true },
  { name: 'Personal', icon: 'user', color: '#8B5CF6', order: 1, isDefault: true },
  { name: 'Family', icon: 'users', color: '#10B981', order: 2, isDefault: true },
];

// ─── Connected Calendar ─────────────────────────────────────────────────────

export interface ConnectedCalendar {
  id: string;
  source: CalendarSource;
  sourceCalendarId: string;    // Google's calendar ID, Microsoft graph ID, etc.
  groupId: string;             // Reference to CalendarGroup
  googleAccountId?: string;    // Backend-managed Google account record ID
  accountEmail: string;        // Email of the connected account
  accountName: string;         // Display name
  name: string;                // Calendar display name (e.g. "Work Calendar")
  color: string;               // Calendar-specific color (hex)
  isActive: boolean;           // Currently visible on calendar view
  order: number;               // Sort within group
  syncEnabled: boolean;        // Whether to auto-sync
  syncInterval: number;        // Sync interval in minutes (default: 15)
  lastSyncAt?: string;         // Last successful sync timestamp
  lastSyncError?: string;      // Last sync error message (if any)
  eventCount?: number;         // Cached count of events for display
  accessToken?: string;        // OAuth access token (encrypted in Firestore)
  refreshToken?: string;       // OAuth refresh token (encrypted in Firestore)
  tokenExpiry?: string;        // Token expiry timestamp
  createdAt: string;
  updatedAt: string;
}

// ─── Calendar Preferences ───────────────────────────────────────────────────

export interface CalendarPreferences {
  userId: string;
  groupOrder: string[];        // Ordered list of group IDs
  expandedGroups: string[];    // Which groups are expanded in dropdown
  visibleCalendars: string[];  // Calendar IDs currently visible
  primaryCalendarId?: string;  // Default calendar for new events
  defaultGroupId?: string;     // Default group for new calendars
  syncStrategy: 'all' | 'active'; // Sync all calendars or just active ones
  lastGlobalSync?: string;     // Last time all calendars were synced
  updatedAt: string;
}

// ─── Synced Calendar Event ──────────────────────────────────────────────────
// Events fetched from external sources, cached locally

export interface SyncedCalendarEvent {
  id: string;
  calendarId: string;          // Reference to ConnectedCalendar
  externalId: string;          // Event ID from source (Google, Microsoft)
  title: string;
  description?: string;
  location?: string;
  startTime: string;           // ISO timestamp
  endTime: string;             // ISO timestamp
  isAllDay: boolean;
  color?: string;              // Override color (or inherit from calendar)
  status: 'confirmed' | 'tentative' | 'cancelled';
  recurring?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    endDate?: string;
  };
  attendees?: {
    email: string;
    name?: string;
    status: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  }[];
  meetingUrl?: string;
  source: CalendarSource;
  syncedAt: string;            // When this event was last synced
  etag?: string;               // For sync conflict detection
}

// ─── Calendar Template ──────────────────────────────────────────────────────
// Pre-defined event patterns users can apply to their calendar

export interface CalendarTemplateEvent {
  title: string;
  description?: string;
  dayOfWeek: number;           // 0 = Sunday, 6 = Saturday
  startTime: string;           // "HH:mm" format
  endTime: string;             // "HH:mm" format
  color?: string;
  isAllDay?: boolean;
  location?: string;
  // Recurrence — stored so templates can produce recurring events on apply
  isRecurring?: boolean;
  recurrenceRule?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    daysOfWeek?: number[];
    dayOfMonth?: number;
    monthOfYear?: number;
    endDate?: string;
    count?: number;
  };
}

export interface CalendarTemplate {
  id: string;
  name: string;
  description?: string;
  events: CalendarTemplateEvent[];
  targetCalendarId?: string;   // Which calendar to apply events to
  targetGroupId?: string;      // Which group this template belongs to
  isActive: boolean;           // Currently applied to calendar
  createdAt: string;
  updatedAt: string;
}

// ─── UI State Types ─────────────────────────────────────────────────────────

export interface CalendarDropdownState {
  isOpen: boolean;
  expandedGroups: string[];
  draggingCalendarId: string | null;
  draggingGroupId: string | null;
  editingGroupId: string | null;
}

export interface AddCalendarStep {
  step: 'select-source' | 'authenticate' | 'select-calendars' | 'assign-group' | 'done';
  source?: CalendarSource;
  availableCalendars?: {
    id: string;
    name: string;
    color: string;
    primary: boolean;
  }[];
  selectedCalendarIds?: string[];
  targetGroupId?: string;
}

// ─── Helper Functions ───────────────────────────────────────────────────────

/** Generate a new CalendarGroup from partial input */
export function createCalendarGroup(
  partial: Partial<CalendarGroup> & Pick<CalendarGroup, 'name'>
): Omit<CalendarGroup, 'id'> {
  const now = new Date().toISOString();
  return {
    name: partial.name,
    icon: partial.icon || 'folder',
    color: partial.color || DEFAULT_GROUP_COLORS[Math.floor(Math.random() * DEFAULT_GROUP_COLORS.length)],
    order: partial.order ?? 999,
    createdAt: now,
    updatedAt: now,
    isDefault: partial.isDefault ?? false,
  };
}

/** Generate a new ConnectedCalendar from partial input */
export function createConnectedCalendar(
  partial: Partial<ConnectedCalendar> & Pick<ConnectedCalendar, 'source' | 'groupId' | 'name' | 'accountEmail'>
): Omit<ConnectedCalendar, 'id'> {
  const now = new Date().toISOString();
  return {
    source: partial.source,
    sourceCalendarId: partial.sourceCalendarId || '',
    groupId: partial.groupId,
    googleAccountId: partial.googleAccountId,
    accountEmail: partial.accountEmail,
    accountName: partial.accountName || partial.accountEmail,
    name: partial.name,
    color: partial.color || DEFAULT_GROUP_COLORS[0],
    isActive: partial.isActive ?? true,
    order: partial.order ?? 999,
    syncEnabled: partial.syncEnabled ?? true,
    syncInterval: partial.syncInterval ?? 15,
    createdAt: now,
    updatedAt: now,
  };
}
