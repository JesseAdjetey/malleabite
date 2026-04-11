# Malleabite External Integration Plan

## Status: Phase 1 — Todoist COMPLETED ✅

---

## Module Integration Feasibility

| Module | Feasibility | Notes |
|--------|-------------|-------|
| Todo | HIGH | Start here — best APIs, most user value |
| Reminders | MEDIUM | Piggybacks on Todo integrations |
| Pomodoro | MEDIUM | Push sessions to Toggl/Clockify |
| Eisenhower | LOW-MEDIUM | Depends on Todo integration first |
| Alarms | LOW | Device-local, skip for now |
| Booking | MEDIUM | Google Calendar free/busy |

---

## Execution Phases

| Phase | Integration | Status |
|-------|-------------|--------|
| 1 | Todo ← Todoist | ✅ DONE |
| 2 | Todo ← Microsoft To Do + Outlook Calendar | ✅ DONE |
| 2b | Todo ← Google Tasks | ⬜ (deferred — requires Google re-verification) |
| 3 | Reminders ← piggyback on Phase 2 | ⬜ |
| 4 | Pomodoro → Toggl (push sessions) | ⬜ |
| 5 | Eisenhower ← pull from connected Todo source | ⬜ |
| 6 | Booking ← Google Calendar free/busy | ⬜ |

---

## Architecture Decisions (locked in)

- **Auth model**: Firebase Functions as OAuth broker — Functions handle token exchange, tokens stored encrypted in Firestore, never exposed to client
- **Sync model**: Auto-sync on open + periodic background sync + manual "sync" button
- **Conflict resolution**: External service always wins (external service = source of truth, Malleabite mirrors it)
- **Pattern reference**: Follow the same pattern as `firebase/functions/src/google-calendar-oauth.ts`

---

## Phase 1: Todoist — COMPLETED

### What was built
- Firebase Function: `todoist_oauth_init` — redirects user to Todoist OAuth
- Firebase Function: `todoist_oauth_callback` — exchanges code for tokens, encrypts + stores in Firestore
- Firebase Function: `sync_todoist_tasks` — pulls tasks from Todoist API into `todo_items` Firestore collection
- Hook: `src/hooks/use-todoist-integration.ts` — manages integration state, triggers sync
- UI: Todoist connect/disconnect + sync button inside Todo module settings
- Firestore: `user_integrations/{userId}/services/todoist` — stores encrypted tokens + sync metadata
- Field mapping: Todoist task → TodoItem (content→text, due→deadline, priority, is_completed, etc.)
- Todoist `task_id` stored on TodoItem for tracking

### Key files
- `firebase/functions/src/todoist-oauth.ts`
- `src/hooks/use-todoist-integration.ts`
- `src/components/modules/todoist/` — UI components

---

## Phase 2: Microsoft To Do + Google Tasks — NEXT

### Microsoft To Do
- API: MS Graph API (verbose but well-documented)
- Auth: Azure AD OAuth2 (more complex setup than Todoist)
- Features: Tasks, steps (subtasks), due dates, reminders
- Maps to: TodoItem fields cleanly

### Google Tasks
- API: Google Tasks REST API
- Auth: Google Cloud Console OAuth2 (same Google project as Calendar)
- Features: Tasks, due dates (no subtasks)
- Maps to: TodoItem fields (simpler than Todoist)

### Questions to resolve before starting Phase 2
1. Start with Microsoft To Do or Google Tasks first?
2. Should one external list/tasklist map to exactly one Malleabite Todo module, or allow mixing?
3. Sync all lists or let users selectively link specific lists to specific modules?
4. Should tasks created in Malleabite push back to the external service (bidirectional) or pull-only?

---

## Phase 3: Reminders

- No dedicated API for reminders
- Strategy: pull from MS To Do reminder fields or Google Tasks due dates
- Dependent on Phase 2 being complete

---

## Phase 4: Pomodoro → Toggl

- API: Toggl Track REST API
- Direction: push only (Malleabite → Toggl)
- Each completed Pomodoro session = a time entry in Toggl
- Auth: Toggl API key (simpler than OAuth)

---

## Phase 5: Eisenhower ← Todo source

- No external Eisenhower apps exist
- Strategy: pull tasks FROM connected Todoist/MS To Do source
- Let users drag tasks into quadrants as a view layer
- Dependent on Phase 1 or 2

---

## Phase 6: Booking ← Google Calendar

- Use existing Google Calendar OAuth (already built)
- Expose free/busy slots from Calendar in Booking module
- Cal.com also worth exploring (open source, clean REST API)

---

## Firestore Schema (integrations)

```
user_integrations/{userId}/services/{serviceName}
  - accessToken (encrypted)
  - refreshToken (encrypted)
  - expiresAt
  - connectedAt
  - lastSyncAt
  - syncEnabled: boolean
```

---

## Notes

- Todoist integration files: `src/components/modules/todoist/` and `src/hooks/use-todoist-integration.ts`
- All OAuth functions follow the pattern in `firebase/functions/src/google-calendar-oauth.ts`
- Token encryption uses the same approach as Calendar tokens
