# Firebase Migration Guide for Malleabite

## Overview
This guide outlines the step-by-step process to migrate Malleabite from Supabase to Firebase.

## Prerequisites

1. **Firebase Project Setup**
   - Create a new Firebase project at https://console.firebase.google.com
   - Enable Authentication (Email/Password)
   - Enable Firestore Database
   - Enable Cloud Functions
   - Enable Storage (if needed)

2. **Firebase Configuration**
   - Get your Firebase config object from Project Settings
   - Replace the placeholder values in `src/integrations/firebase/config.ts`

## Migration Progress

### ✅ Phase 1: Firebase Infrastructure Setup
- [x] Install Firebase SDK
- [x] Create Firebase configuration structure
- [x] Set up authentication utilities
- [x] Set up Firestore database utilities
- [x] Set up Cloud Functions utilities

### 🔄 Phase 2: Authentication Migration
- [x] Create Firebase AuthContext (`AuthContext.firebase.tsx`)
- [ ] Switch main AuthContext to use Firebase
- [ ] Test authentication flow
- [ ] Update ProtectedRoute component

### 📝 Phase 3: Database Operations Migration
- [x] Create Firebase calendar events hook (`use-calendar-events.firebase.ts`)
- [ ] Migrate todos hook
- [ ] Migrate eisenhower hook
- [ ] Migrate reminders hook
- [ ] Migrate other data hooks

### 🔄 Phase 4: Real-time Subscriptions
- [x] Implement Firestore real-time listeners in calendar events
- [ ] Replace Supabase subscriptions in todos
- [ ] Replace Supabase subscriptions in other components

### ⚡ Phase 5: Cloud Functions Migration
- [ ] Create Firebase Cloud Functions for:
  - [ ] `processScheduling` (replaces `process-scheduling`)
  - [ ] `transcribeAudio` (replaces `transcribe-audio`)
- [ ] Update AI components to use Firebase functions

### 🧹 Phase 6: Cleanup
- [ ] Remove Supabase dependencies
- [ ] Update package.json
- [ ] Update environment variables
- [ ] Final testing

## Database Schema Migration

### Firestore Collection Structure
```
users/
  {userId}/
    - displayName: string
    - email: string
    - createdAt: timestamp
    - updatedAt: timestamp

calendar_events/
  {eventId}/
    - title: string
    - description?: string
    - startAt: timestamp
    - endAt: timestamp
    - userId: string
    - color?: string
    - isLocked?: boolean
    - isTodo?: boolean
    - todoId?: string
    - hasAlarm?: boolean
    - hasReminder?: boolean
    - createdAt: timestamp
    - updatedAt: timestamp

todos/
  {todoId}/
    - text: string
    - completed: boolean
    - priority?: string
    - dueDate?: timestamp
    - userId: string
    - moduleInstanceId?: string
    - eventId?: string
    - createdAt: timestamp
    - updatedAt: timestamp

eisenhower_items/
  {itemId}/
    - text: string
    - quadrant: string
    - userId: string
    - moduleInstanceId?: string
    - eventId?: string
    - createdAt: timestamp
    - updatedAt: timestamp

reminders/
  {reminderId}/
    - title: string
    - description?: string
    - reminderTime: timestamp
    - isCompleted: boolean
    - userId: string
    - eventId?: string
    - createdAt: timestamp
    - updatedAt: timestamp

alarms/
  {alarmId}/
    - alarmTime: timestamp
    - alarmType?: string
    - eventId?: string
    - isSnoozed?: boolean
    - snoozeUntil?: timestamp
    - repeatInterval?: string
    - createdAt: timestamp
    - updatedAt: timestamp
```

## Security Rules Example
```javascript
// Firestore Security Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can read/write their own data
    match /{collection}/{document} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
    }
    
    // Users can create documents with their own userId
    match /{collection}/{document} {
      allow create: if request.auth != null && 
        request.resource.data.userId == request.auth.uid;
    }
  }
}
```

## Environment Variables
Create a `.env.local` file:
```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id

# Anthropic Claude API (for AI features)
VITE_ANTHROPIC_API_KEY=your_anthropic_key
```

## Testing Strategy

1. **Unit Tests**: Test individual Firebase utilities
2. **Integration Tests**: Test auth flow and data operations
3. **E2E Tests**: Test complete user workflows
4. **Performance Tests**: Compare performance with Supabase

## Rollback Plan

1. Keep Supabase integration files until migration is complete
2. Use feature flags to switch between Supabase and Firebase
3. Maintain data backups during migration
4. Document any breaking changes

## Data Migration
- Export data from Supabase using their CLI or direct SQL
- Transform data to match Firestore structure
- Import data using Firebase Admin SDK or batch writes
- Verify data integrity after migration

## Notes
- Firebase uses different field naming conventions (camelCase vs snake_case)
- Timestamps are handled differently between Supabase and Firebase
- Real-time subscriptions have different APIs
- Authentication state management differs slightly
