// Firebase Firestore database operations and types
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  QuerySnapshot,
  DocumentData,
  WhereFilterOp,
  OrderByDirection,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment,
  writeBatch,
  runTransaction,
  DocumentReference,
  CollectionReference
} from 'firebase/firestore';
import { db } from './config';

// Collection names - centralized for easy maintenance
export const COLLECTIONS = {
  USERS: 'users',
  CALENDAR_EVENTS: 'calendar_events',
  TODOS: 'todos',
  EISENHOWER_ITEMS: 'eisenhower_items',
  REMINDERS: 'reminders',
  ALARMS: 'alarms',
  INVITES: 'invites',
  AI_SUGGESTIONS: 'ai_suggestions',
  POMODORO_SESSIONS: 'pomodoro_sessions',
  MODULE_INSTANCES: 'module_instances'
} as const;

// Base interfaces for Firestore documents
export interface BaseDocument {
  id?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface CalendarEvent extends BaseDocument {
  title: string;
  description?: string;
  startAt: Timestamp;
  endAt: Timestamp;
  userId: string;
  color?: string;
  isLocked?: boolean;
  isTodo?: boolean;
  todoId?: string;
  hasAlarm?: boolean;
  hasReminder?: boolean;
  
  // Google Calendar-style fields
  location?: string;
  meetingUrl?: string;
  meetingProvider?: 'zoom' | 'google_meet' | 'teams' | 'other';
  calendarId?: string;
  isAllDay?: boolean;
  visibility?: 'public' | 'private' | 'confidential';
  status?: 'confirmed' | 'tentative' | 'cancelled';
  timeZone?: string;
  
  // Recurring event fields
  isRecurring?: boolean;
  recurrenceRule?: {
    frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval?: number;
    count?: number;
    until?: Timestamp;
    byDay?: string[];
    byMonth?: number[];
    byMonthDay?: number[];
  };
  recurrenceParentId?: string;
  recurrenceExceptions?: string[];
  
  // Attendees
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted';
    optional?: boolean;
    organizer?: boolean;
  }>;
  
  // Reminders
  reminders?: Array<{
    method: 'email' | 'popup' | 'notification';
    minutes: number;
  }>;
  useDefaultReminders?: boolean;
  
  // Event type
  eventType?: 'default' | 'focusTime' | 'outOfOffice' | 'workingLocation';

  // Google Calendar 2-way sync
  googleEventId?: string;
  source?: string;
}

export interface Todo extends BaseDocument {
  text: string;
  completed: boolean;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: Timestamp;
  userId: string;
  moduleInstanceId?: string;
  eventId?: string;
}

export interface EisenhowerItem extends BaseDocument {
  text: string;
  quadrant: 'urgent-important' | 'urgent-not-important' | 'not-urgent-important' | 'not-urgent-not-important';
  userId: string;
  moduleInstanceId?: string;
  eventId?: string;
}

export interface Reminder extends BaseDocument {
  title: string;
  description?: string;
  reminderTime: Timestamp;
  isCompleted: boolean;
  userId: string;
  eventId?: string;
}

export interface Alarm extends BaseDocument {
  alarmTime: Timestamp;
  alarmType?: string;
  eventId?: string;
  isSnoozed?: boolean;
  snoozeUntil?: Timestamp;
  repeatInterval?: string;
}

// Generic CRUD operations
export class FirestoreService {
  // Create document
  static async create<T extends BaseDocument>(
    collectionName: string, 
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<DocumentReference> {
    const docData = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    return await addDoc(collection(db, collectionName), docData);
  }

  // Read document by ID
  static async getById<T extends BaseDocument>(
    collectionName: string, 
    id: string
  ): Promise<T | null> {
    const docRef = doc(db, collectionName, id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as T;
    }
    return null;
  }

  // Update document
  static async update<T extends BaseDocument>(
    collectionName: string, 
    id: string, 
    data: Partial<Omit<T, 'id' | 'createdAt'>>
  ): Promise<void> {
    const docRef = doc(db, collectionName, id);
    const updateData = {
      ...data,
      updatedAt: serverTimestamp()
    };
    
    return await updateDoc(docRef, updateData);
  }

  // Delete document
  static async delete(collectionName: string, id: string): Promise<void> {
    const docRef = doc(db, collectionName, id);
    return await deleteDoc(docRef);
  }

  // Query documents with filters
  static async query<T extends BaseDocument>(
    collectionName: string,
    filters?: Array<{
      field: string;
      operator: WhereFilterOp;
      value: any;
    }>,
    orderField?: string,
    orderDirection: OrderByDirection = 'asc',
    limitCount?: number
  ): Promise<T[]> {
    let q = query(collection(db, collectionName));

    // Apply filters
    if (filters) {
      filters.forEach(filter => {
        q = query(q, where(filter.field, filter.operator, filter.value));
      });
    }

    // Apply ordering
    if (orderField) {
      q = query(q, orderBy(orderField, orderDirection));
    }

    // Apply limit
    if (limitCount) {
      q = query(q, limit(limitCount));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as T));
  }

  // Real-time subscription to collection
  static subscribeToCollection<T extends BaseDocument>(
    collectionName: string,
    callback: (docs: T[]) => void,
    filters?: Array<{
      field: string;
      operator: WhereFilterOp;
      value: any;
    }>,
    orderField?: string,
    orderDirection: OrderByDirection = 'asc'
  ) {
    let q = query(collection(db, collectionName));

    // Apply filters
    if (filters) {
      filters.forEach(filter => {
        q = query(q, where(filter.field, filter.operator, filter.value));
      });
    }

    // Apply ordering
    if (orderField) {
      q = query(q, orderBy(orderField, orderDirection));
    }

    return onSnapshot(q, (querySnapshot) => {
      const docs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as T));
      callback(docs);
    });
  }

  // Real-time subscription to single document
  static subscribeToDocument<T extends BaseDocument>(
    collectionName: string,
    id: string,
    callback: (doc: T | null) => void
  ) {
    const docRef = doc(db, collectionName, id);
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        callback({ id: docSnap.id, ...docSnap.data() } as T);
      } else {
        callback(null);
      }
    });
  }

  // Batch operations
  static getBatch() {
    return writeBatch(db);
  }

  // Transaction operations
  static async runTransaction<T>(
    updateFunction: (transaction: any) => Promise<T>
  ): Promise<T> {
    return await runTransaction(db, updateFunction);
  }
}

// Export timestamp utilities
export const timestampFromDate = (date: Date): Timestamp => {
  return Timestamp.fromDate(date);
};

export const timestampToDate = (timestamp: Timestamp): Date => {
  return timestamp.toDate();
};

export const timestampNow = (): Timestamp => {
  return Timestamp.now();
};
