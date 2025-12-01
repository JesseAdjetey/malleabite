// Production-ready data creation utilities
// Ensures all documents have proper userId and metadata fields

import { serverTimestamp, Timestamp } from 'firebase/firestore';

// Base interface for all user documents
interface BaseUserDocument {
  userId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Helper to create document with required fields
export const createUserDocument = <T extends Record<string, any>>(
  userId: string,
  data: T
): T & BaseUserDocument => {
  if (!userId) {
    throw new Error('userId is required for all documents');
  }

  return {
    ...data,
    userId,
    createdAt: serverTimestamp() as Timestamp,
    updatedAt: serverTimestamp() as Timestamp,
  };
};

// Helper to update document with updatedAt
export const updateUserDocument = <T extends Record<string, any>>(
  data: T
): T & { updatedAt: Timestamp } => {
  return {
    ...data,
    updatedAt: serverTimestamp() as Timestamp,
  };
};

// Production-ready todo interface
export interface Todo extends BaseUserDocument {
  id?: string;
  text: string;
  completed: boolean;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: Timestamp;
  tags?: string[];
}

// Production-ready calendar event interface
export interface CalendarEvent extends BaseUserDocument {
  id?: string;
  title: string;
  description?: string;
  startsAt: Timestamp;
  endsAt?: Timestamp;
  color?: string;
  isLocked?: boolean;
  isTodo?: boolean;
  hasAlarm?: boolean;
  hasReminder?: boolean;
  location?: string;
  attendees?: string[];
  recurringRule?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    endDate?: Timestamp;
  };
}

// Production-ready Eisenhower item interface
export interface EisenhowerItem extends BaseUserDocument {
  id?: string;
  text: string;
  quadrant: 1 | 2 | 3 | 4; // Important/Urgent matrix
  completed?: boolean;
  eventId?: string; // Link to calendar event if converted
}

// Production-ready reminder interface
export interface Reminder extends BaseUserDocument {
  id?: string;
  title: string;
  description?: string;
  reminderTime: Timestamp;
  eventId?: string;
  soundId?: string;
  isActive: boolean;
  recurring?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    interval: number;
  };
}

// Production-ready alarm interface
export interface Alarm extends BaseUserDocument {
  id?: string;
  title: string;
  time: string; // HH:MM format
  days: number[]; // 0-6 for Sunday-Saturday
  isActive: boolean;
  soundId?: string;
  snoozeEnabled: boolean;
  snoozeDuration: number; // minutes
}

// Production-ready invite interface
export interface Invite extends BaseUserDocument {
  id?: string;
  senderId: string;
  recipientId: string;
  eventId: string;
  status: 'pending' | 'accepted' | 'declined';
  message?: string;
  respondedAt?: Timestamp;
}

// Validation helpers
export const validateUserId = (userId: string): boolean => {
  return typeof userId === 'string' && userId.length > 0;
};

export const validateRequiredFields = <T extends BaseUserDocument>(
  document: T,
  requiredFields: (keyof T)[]
): boolean => {
  return requiredFields.every(field => 
    document[field] !== undefined && document[field] !== null
  );
};

// Factory functions for creating documents
export const createTodo = (userId: string, text: string, additional?: Partial<Todo>): Todo => {
  if (!validateUserId(userId)) {
    throw new Error('Invalid userId provided');
  }
  
  return createUserDocument(userId, {
    text: text.trim(),
    completed: false,
    priority: 'medium',
    ...additional,
  });
};

export const createCalendarEvent = (
  userId: string, 
  title: string, 
  startsAt: Timestamp,
  additional?: Partial<CalendarEvent>
): CalendarEvent => {
  if (!validateUserId(userId)) {
    throw new Error('Invalid userId provided');
  }
  
  return createUserDocument(userId, {
    title: title.trim(),
    startsAt,
    color: '#3b82f6',
    isLocked: false,
    isTodo: false,
    hasAlarm: false,
    hasReminder: false,
    ...additional,
  });
};

export const createEisenhowerItem = (
  userId: string,
  text: string,
  quadrant: 1 | 2 | 3 | 4,
  additional?: Partial<EisenhowerItem>
): EisenhowerItem => {
  if (!validateUserId(userId)) {
    throw new Error('Invalid userId provided');
  }
  
  return createUserDocument(userId, {
    text: text.trim(),
    quadrant,
    completed: false,
    ...additional,
  });
};

export const createReminder = (
  userId: string,
  title: string,
  reminderTime: Timestamp,
  additional?: Partial<Reminder>
): Reminder => {
  if (!validateUserId(userId)) {
    throw new Error('Invalid userId provided');
  }
  
  return createUserDocument(userId, {
    title: title.trim(),
    reminderTime,
    isActive: true,
    soundId: 'default',
    ...additional,
  });
};

export const createAlarm = (
  userId: string,
  title: string,
  time: string,
  days: number[],
  additional?: Partial<Alarm>
): Alarm => {
  if (!validateUserId(userId)) {
    throw new Error('Invalid userId provided');
  }
  
  return createUserDocument(userId, {
    title: title.trim(),
    time,
    days,
    isActive: true,
    soundId: 'default',
    snoozeEnabled: true,
    snoozeDuration: 5,
    ...additional,
  });
};
