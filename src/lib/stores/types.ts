
export type ModuleType = 'todo' | 'pomodoro' | 'alarms' | 'reminders' | 'eisenhower' | 'booking' | 'canvas';

/**
 * Module size levels:
 * 0 = collapsed (header bar only)
 * 1 = normal (default, in grid)
 * 2 = sidebar fill (covers entire sidebar panel)
 * 3 = fullscreen (covers entire screen)
 */
export type SizeLevel = 0 | 1 | 2 | 3;

// ─── Group Meet Types ──────────────────────────────────────────────────────────

export interface GroupMeetSlot {
  start: string; // ISO string
  end: string;   // ISO string
}

export interface GroupMeetParticipant {
  id: string;
  email: string;
  name: string;
  isAppUser: boolean;
  userId?: string;
  responded: boolean;
  availableSlots: GroupMeetSlot[];
  respondedAt?: string;
}

export interface GroupMeetSession {
  id: string;
  organizerId: string;
  organizerName: string;
  title: string;
  duration: number; // minutes
  window: { start: string; end: string };
  locationType: 'video' | 'in_person' | 'phone';
  organizerFreeSlots: GroupMeetSlot[];
  participants: GroupMeetParticipant[];
  proposedSlots: (GroupMeetSlot & { votes: number })[];
  confirmedSlot: GroupMeetSlot | null;
  status: 'collecting' | 'confirmed' | 'expired' | 'cancelled';
  autoConfirm: boolean;
  moduleInstanceIds: string[]; // which Booking module instances show this
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ModuleInstance {
  id: string; // Unique identifier for this module instance — stable across reorders
  type: ModuleType;
  title: string;
  minimized?: boolean; // Legacy collapse state — kept for backwards compat, derived from sizeLevel === 0
  sizeLevel?: SizeLevel; // 0=collapsed, 1=normal(default), 2=sidebar-fill, 3=fullscreen
  pageId?: string; // Reference to which page this module belongs to
  listId?: string; // For todo modules - reference to the specific todo list
  instanceId?: string; // Unique ID for stateful modules (e.g. Pomodoro) to scope state per-instance
  // Collaboration fields
  sharedFromInstanceId?: string; // If this is a shared copy, points to owner's module instance ID
  sharedListId?: string; // For shared todo modules - the owner's list ID
  sharedRole?: 'viewer' | 'editor'; // Role granted to current user on this shared module
  sharedOwnerName?: string; // Display name of the module owner (for UI)
  // Todoist integration
  todoistProjectId?: string; // If set, this Todo module is linked to a Todoist project
  // Microsoft To Do integration
  msListId?: string; // If set, this Todo module is linked to a Microsoft To Do list
  // Google Tasks integration
  googleTaskListId?: string; // If set, this Todo module is linked to a Google Tasks list
}

/** Generate a unique module ID */
export function generateModuleId(): string {
  return crypto.randomUUID();
}

/** Ensure a module has an id — assigns one if missing (migration helper) */
export function ensureModuleId(module: any): ModuleInstance {
  if (!module.id) {
    return { ...module, id: generateModuleId() };
  }
  return module as ModuleInstance;
}

export interface SidebarPage {
  id: string;
  title: string;
  icon?: string;
  modules: ModuleInstance[];
  createdAt: string;
  updatedAt: string;
  userId: string;
  isDefault?: boolean;
  // Page sharing fields
  sharedFromPageId?: string;   // points to owner's sidebar_pages/{id}
  sharedRole?: 'viewer' | 'editor';
  sharedOwnerName?: string;
}

export type CalendarEventType = {
  id: string;
  title: string;
  description: string;
  isLocked?: boolean;
  isTodo?: boolean;
  hasAlarm?: boolean;
  hasReminder?: boolean;
  participants?: string[];
  color?: string;
  todoId?: string; // Reference to the original todo item

  // Updated fields to match the database schema
  startsAt: string; // ISO string format
  endsAt: string; // ISO string format

  // Optional date field for backward compatibility
  date?: string | Date; // Derived from startsAt for backward compatibility

  // Additional fields for UI display
  timeStart?: string; // Derived from startsAt
  timeEnd?: string; // Derived from endsAt

  // Recurring event fields
  isRecurring?: boolean;
  recurrenceRule?: RecurrenceRule;
  recurrenceParentId?: string; // For instances of recurring events
  recurrenceExceptions?: string[]; // ISO dates to skip

  // NEW: Google Calendar-style fields
  calendarId?: string; // Which calendar this event belongs to
  isAllDay?: boolean; // All-day event flag
  location?: string; // Event location (address, room, etc.)
  meetingUrl?: string; // Video conferencing URL (Zoom, Meet, Teams)
  meetingProvider?: 'zoom' | 'google_meet' | 'teams' | 'other';

  // Time zone support
  timeZone?: string; // IANA time zone (e.g., 'America/New_York')

  // Status and visibility
  status?: 'confirmed' | 'tentative' | 'cancelled';
  visibility?: 'public' | 'private' | 'confidential';

  // Guest/attendee management
  attendees?: EventAttendee[];
  guestsCanModify?: boolean;
  guestsCanInviteOthers?: boolean;
  guestsCanSeeOtherGuests?: boolean;

  // Reminder settings per event
  reminders?: EventReminder[];
  useDefaultReminders?: boolean;

  // Event metadata
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  etag?: string; // For sync conflict detection

  // Focus time / Out of office
  eventType?: 'default' | 'focusTime' | 'outOfOffice' | 'workingLocation';
  focusTimeDeclineMessage?: string;

  // Google Calendar 2-way sync
  googleEventId?: string;  // Google Calendar event ID for sync correlation
  source?: 'malleabite' | 'google';  // Where the event originated

  // Archiving support
  isArchived?: boolean;
  folderName?: string;
  userId?: string;

  // Countdown feature
  countdownEnabled?: boolean;
  countdownReminderIntervalDays?: number; // How often to send reminders (default: 2)

  // Mally Actions — automated action sequences that run when the event starts
  mallyActions?: MallyAction[];
};

// ─── Mally Actions ──────────────────────────────────────────────────────────

export type MallyActionType =
  | 'open_url'
  | 'open_app'
  | 'start_pomodoro'
  | 'create_todo'
  | 'show_reminder'
  | 'open_shortcut';

export interface MallyAction {
  id: string;
  type: MallyActionType;
  order: number;
  // open_url
  url?: string;
  label?: string;
  // open_app — URL scheme (e.g. "spotify:", "obsidian://", "ms-word://")
  appScheme?: string;
  appName?: string;
  // start_pomodoro
  pomodoroLabel?: string;
  pomodoroMinutes?: number;
  // create_todo
  todoTitle?: string;
  // show_reminder
  message?: string;
  // open_shortcut — Apple Shortcuts (iOS/macOS)
  shortcutName?: string;
  shortcutInput?: string;
}

// Event attendee type
export interface EventAttendee {
  email: string;
  displayName?: string;
  responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  optional?: boolean;
  organizer?: boolean;
  self?: boolean;
  comment?: string;
}

// Event reminder type
export interface EventReminder {
  method: 'email' | 'popup' | 'notification';
  minutes: number; // Minutes before event
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number; // e.g., every 2 weeks
  daysOfWeek?: number[]; // 0 = Sunday, 6 = Saturday (for weekly)
  dayOfMonth?: number; // 1-31 (for monthly)
  monthOfYear?: number; // 1-12 (for yearly)
  endDate?: string; // ISO string - when recurrence ends
  count?: number; // Number of occurrences

  // Added for compatibility with Firebase/Google Calendar schema
  until?: string; // ISO string (alias for endDate)
  byDay?: string[]; // ["MO", "TU"] etc
  byMonth?: number[]; // [1, 2] etc
  byMonthDay?: number[]; // [1, 15] etc
}
