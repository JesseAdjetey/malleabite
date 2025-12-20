
export type ModuleType = 'todo' | 'pomodoro' | 'alarms' | 'reminders' | 'eisenhower' | 'invites';

export interface ModuleInstance {
  type: ModuleType;
  title: string;
  minimized?: boolean; // New property to track minimized state
  pageId?: string; // Reference to which page this module belongs to
  listId?: string; // For todo modules - reference to the specific todo list
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
  date?: string; // Derived from startsAt for backward compatibility
  
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
};

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
}
