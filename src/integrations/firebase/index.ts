// Firebase integration barrel export
// This file provides a centralized way to import all Firebase functionality

// Core Firebase setup
export { app as firebaseApp, auth, db, functions, storage } from './config';

// Authentication
export * from './auth';
export type { User, AuthError, SignInCredentials, SignUpCredentials } from './auth';

// Firestore database
export * from './firestore';
export type { 
  BaseDocument, 
  CalendarEvent, 
  Todo, 
  EisenhowerItem, 
  Reminder, 
  Alarm 
} from './firestore';

// Cloud Functions
export * from './functions';
export type {
  SchedulingRequest,
  SchedulingResponse,
} from './functions';

// Re-export Firebase types that are commonly used
export type { 
  Timestamp,
  DocumentReference,
  CollectionReference,
  QuerySnapshot,
  DocumentData 
} from 'firebase/firestore';

export type {
  User as FirebaseUser,
  UserCredential
} from 'firebase/auth';
