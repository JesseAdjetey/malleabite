# Firebase Collection Structure for Malleabite App

## Overview
This document outlines the complete Firebase Firestore collection### 8. **ai_suggestions**
**Collection Nam### 9. **module_instances**
**Collection Name**: `module_instances` 
**Purpose**: Store user's module configurations and layouts
```typescript
interface ModuleInstance extends BaseDocument {
  moduleType: string;       // Type of module (calendar, todos, etc.)
  title: string;            // User-defined title
  position: { x: number; y: number; }; // Position on dashboard
  size: { width: number; height: number; }; // Module dimensions
  configuration: object;    // Module-specific settings
  userId: string;           // References the user who owns this module
}
```

### 10. **pomodoro_sessions**gestions`
**Purpose**: Store AI-generated suggestions and recommendations
```typescript
interface AISuggestion extends BaseDocument {
  type: 'event' | 'todo' | 'optimization'; // Type of suggestion
  title: string;            // Suggestion title
  description: string;      // Detailed suggestion
  confidence: number;       // AI confidence score (0-1)
  isApplied: boolean;       // Whether user applied the suggestion
  userId: string;           // References the user who owns this suggestion
  relatedEventId?: string;  // Link to related event if applicable
  relatedTodoId?: string;   // Link to related todo if applicable
}
```

### 9. **module_instances**ed by the Malleabite productivity application.

## Collections

### 1. **users**
**Collection Name**: `users`
**Purpose**: Store user profile and account information
```typescript
interface User extends BaseDocument {
  email: string;
  displayName?: string;
  photoURL?: string;
  // Additional user profile fields
}
```

### 2. **calendar_events** 
**Collection Name**: `calendar_events`
**Purpose**: Store calendar events and appointments
```typescript
interface CalendarEvent extends BaseDocument {
  title: string;
  description?: string;
  startAt: Timestamp;
  endAt: Timestamp;
  userId: string;           // References the user who owns this event
  color?: string;           // Hex color for the event
  isLocked?: boolean;       // Whether the event can be modified
  isTodo?: boolean;         // If this event is linked to a todo
  todoId?: string;          // Reference to linked todo
  hasAlarm?: boolean;       // Whether the event has an alarm
  hasReminder?: boolean;    // Whether the event has a reminder
}
```

### 3. **todos**
**Collection Name**: `todos`
**Purpose**: Store todo items and tasks
```typescript
interface Todo extends BaseDocument {
  text: string;             // Todo description/title
  completed: boolean;       // Completion status
  priority?: 'low' | 'medium' | 'high';
  dueDate?: Timestamp;      // Optional due date
  userId: string;           // References the user who owns this todo
  moduleInstanceId?: string; // Link to module instance if applicable
  eventId?: string;         // Link to calendar event if applicable
}
```

### 4. **eisenhower_items**
**Collection Name**: `eisenhower_items`
**Purpose**: Store items in the Eisenhower Matrix (urgent/important quadrants)
```typescript
interface EisenhowerItem extends BaseDocument {
  text: string;             // Item description
  quadrant: 'urgent-important' | 'urgent-not-important' | 'not-urgent-important' | 'not-urgent-not-important';
  userId: string;           // References the user who owns this item
  moduleInstanceId?: string; // Link to module instance if applicable
  eventId?: string;         // Link to calendar event if applicable
}
```

### 5. **reminders**
**Collection Name**: `reminders`
**Purpose**: Store reminder notifications
```typescript
interface Reminder extends BaseDocument {
  title: string;
  description?: string;
  reminderTime: Timestamp;  // When to trigger the reminder
  isCompleted: boolean;     // Whether reminder was acknowledged
  userId: string;           // References the user who owns this reminder
  eventId?: string;         // Link to calendar event if applicable
}
```

### 6. **invites**
**Collection Name**: `invites`
**Purpose**: Store calendar event invitations for collaboration
```typescript
interface Invite extends BaseDocument {
  eventId: string;          // References the calendar event
  eventTitle: string;       // Title of the event being shared
  eventDescription?: string; // Description of the event
  eventDate: string;        // Date of the event
  eventStartTime: string;   // Start time of the event
  eventEndTime?: string;    // End time of the event
  senderId: string;         // User who sent the invite
  senderEmail: string;      // Email of the sender
  senderName?: string;      // Display name of the sender
  recipientId: string;      // User who received the invite
  recipientEmail: string;   // Email of the recipient
  recipientName?: string;   // Display name of the recipient
  status: 'pending' | 'accepted' | 'declined'; // Invite status
  message?: string;         // Optional message from sender
}
```

### 7. **alarms**
**Collection Name**: `alarms`
**Purpose**: Store alarm notifications for calendar events
```typescript
interface Alarm extends BaseDocument {
  eventId: string;          // References the calendar event
  alarmTime: Timestamp;     // When to trigger the alarm
  isTriggered: boolean;     // Whether alarm was fired
  userId: string;           // References the user who owns this alarm
}
```

### 8. **ai_suggestions**

### 7. **invites** (Future Feature)
**Collection Name**: `invites`
**Purpose**: Store calendar event invitations
```typescript
interface Invite extends BaseDocument {
  eventId: string;          // Reference to calendar event
  fromUserId: string;       // User who sent the invite
  toUserId: string;         // User who received the invite
  status: 'pending' | 'accepted' | 'declined';
  message?: string;         // Optional invite message
}
```

### 8. **ai_suggestions** (Future Feature)
**Collection Name**: `ai_suggestions`
**Purpose**: Store AI-generated suggestions and recommendations
```typescript
interface AISuggestion extends BaseDocument {
  userId: string;
  suggestionType: 'schedule' | 'todo' | 'priority';
  content: string;
  isImplemented: boolean;
  confidence: number;       // AI confidence score
}
```

### 9. **pomodoro_sessions** (Future Feature)
**Collection Name**: `pomodoro_sessions`
**Purpose**: Store Pomodoro timer sessions
```typescript
interface PomodoroSession extends BaseDocument {
  userId: string;
  taskDescription: string;
  duration: number;         // Session length in minutes
  completedAt?: Timestamp;  // When session was completed
  wasCompleted: boolean;    // Whether session finished successfully
}
```

### 10. **module_instances** (Future Feature)
**Collection Name**: `module_instances`
**Purpose**: Store modular component instances and configurations
```typescript
interface ModuleInstance extends BaseDocument {
  userId: string;
  moduleType: string;       // Type of module (todo, calendar, etc.)
  configuration: object;    // Module-specific configuration
  isActive: boolean;        // Whether module is currently active
}
```

## Common Fields (BaseDocument)

All collections inherit these common fields:
```typescript
interface BaseDocument {
  id?: string;              // Auto-generated document ID
  createdAt?: Timestamp;    // Auto-set creation timestamp
  updatedAt?: Timestamp;    // Auto-updated modification timestamp
}
```

## Security Rules

Each collection should have security rules ensuring:
- Users can only read/write their own data (filtered by `userId`)
- Proper authentication is required
- Data validation on required fields

## Indexes

The following composite indexes are recommended for optimal query performance:
- `calendar_events`: `userId` + `startAt`
- `todos`: `userId` + `completed` + `createdAt`
- `eisenhower_items`: `userId` + `quadrant`
- `reminders`: `userId` + `reminderTime`

## Current Implementation Status

✅ **Active Collections** (Currently Used):
- `calendar_events` - Fully implemented with real-time updates
- `todos` - Fully implemented with real-time updates  
- `eisenhower_items` - Fully implemented with real-time updates
- `invites` - Fully implemented with Firebase backend

🔄 **Planned Collections** (Future Features):
- `users` - For user profiles
- `reminders` - For notification system
- `alarms` - For event alarms
- `ai_suggestions` - For AI recommendations
- `pomodoro_sessions` - For productivity tracking
- `module_instances` - For modular architecture

## Data Flow

1. **User Authentication** → Firebase Auth
2. **User Data Isolation** → All queries filtered by `userId`
3. **Real-time Updates** → Firestore onSnapshot listeners
4. **Cross-Collection References** → `eventId`, `todoId` for linking
