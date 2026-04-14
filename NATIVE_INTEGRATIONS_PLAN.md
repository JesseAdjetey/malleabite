# Native Platform Integrations Plan

**Goal:** Connect Malleabite's Reminders module (and others) to native platform ecosystems — Apple and Google — for bidirectional sync and deeper OS integration.

**Existing foundation:**
- iOS + Android Capacitor projects already initialized
- `@capacitor/local-notifications` already installed
- Google OAuth pattern established (`google-calendar-oauth.ts`)
- `apple` already defined as a `CalendarSource` in `calendar.ts` (not yet wired)
- `RemindersModule.tsx` + `AlarmsModule.tsx` fully built internally

---

## Apple Ecosystem Options

### ✅ Option 1 — Apple Reminders via EventKit (iOS/macOS) [PRIORITY]
**How:** Custom Capacitor iOS plugin wrapping Apple's `EventKit` framework (`EKReminder`).
**What you get:** True bidirectional sync with the native Reminders app. Create, read, update, delete reminders directly from Malleabite. Reminders created in the Apple Reminders app appear in Malleabite, and vice versa.
**Requires:**
- Apple Developer account ✅ (already have)
- `NSRemindersUsageDescription` in iOS `Info.plist`
- Custom Capacitor plugin (~200 lines Swift + JS bridge)
- Permission request flow in app

**Effort:** Medium (2–4 weeks)
**Files to create:**
- `ios/App/App/Plugins/RemindersPlugin.swift`
- `src/hooks/use-apple-reminders.ts`
- Firebase Cloud Function not needed — all local on-device

---

### ✅ Option 2 — Apple Calendar via EventKit (iOS) [PRIORITY]
**How:** Same custom EventKit plugin as above — `EKEvent` instead of `EKReminder`. The `CalendarSource = 'apple'` type already exists in `calendar.ts`.
**What you get:** Read/write Apple Calendar events from Malleabite.
**Requires:** Same plugin as Reminders — extend it to cover both `EKEvent` + `EKReminder`.
**Effort:** Low marginal cost (done alongside Option 1)

---

### ✅ Option 3 — iCloud CalDAV (Web + iOS fallback)
**How:** Firebase Cloud Function acts as CalDAV proxy to `caldav.icloud.com`. User authenticates with an App-Specific Password (generated in Apple ID settings). Works from web and any platform (not just iOS).
**What you get:** Calendar + Reminders sync even from the web/desktop version of Malleabite.
**Requires:**
- New Firebase Cloud Function (`apple-caldav.ts`)
- App-Specific Password from user's Apple ID
- `node-ical` / `tsdav` npm package in functions
**Effort:** Medium (1–2 weeks)
**Note:** Lower fidelity than EventKit (no push, polling only). Best as web fallback.

---

### ✅ Option 4 — Apple Shortcuts Deep Link (Mally Actions)
**How:** URL scheme `shortcuts://run-shortcut?name=NAME&input=INPUT`. Tap a Mally Action → opens Shortcuts app and runs a named shortcut.
**What you get:** Users can build any automation in Shortcuts and trigger it from a calendar event in Malleabite. E.g. "Open Zoom link + turn on Do Not Disturb + start music".
**Requires:** No plugin needed — just add `open_shortcut` as a new MallyAction type using the existing `open_app` URL scheme mechanism.
**Effort:** Very Low (< 1 day — extend ActionBuilder.tsx + action-runner-store.ts)

---

### Option 5 — Apple HealthKit (Stretch)
**How:** `@capacitor-community/health` plugin (community, well-maintained).
**What you get:** Read step count, sleep data, heart rate → could surface in Pomodoro/wellness stats.
**Requires:** `HealthKit` entitlement + privacy descriptions + additional App Store review justification
**Effort:** Medium. Defer until core integrations are stable.

---

## Google / Android Ecosystem Options

### ✅ Option 6 — Google Tasks API [PRIORITY]
**How:** Firebase Cloud Function reusing the existing Google OAuth pattern (`google-calendar-oauth.ts`). Google Tasks is part of the same OAuth2 scope family.
**What you get:** Bidirectional sync of Malleabite reminders with Google Tasks (shows up in Gmail sidebar, Google Calendar, Android Reminders app).
**Scope needed:** `https://www.googleapis.com/auth/tasks`
**Requires:**
- New Firebase Cloud Function (`google-tasks.ts`) — CRUD via Google Tasks REST API
- New hook `src/hooks/use-google-tasks.ts`
- Add Google Tasks toggle to RemindersModule settings
**Effort:** Low–Medium (1 week) — pattern is already established

---

### ✅ Option 7 — Android Clock App (SET_ALARM intent)
**How:** Custom Capacitor Android plugin that fires `android.intent.action.SET_ALARM` or `android.intent.action.SET_TIMER`. This opens the native Clock app pre-filled with the alarm time.
**What you get:** One-tap "Send to Android Clock" from the AlarmsModule.
**Requires:**
- Custom Capacitor Android plugin (~50 lines Kotlin)
- New method on existing alarms hook
**Effort:** Very Low (< 1 day)
**Platforms:** Android only (gracefully hidden on iOS)

---

### Option 8 — Android/Google Health Connect (Stretch)
**How:** `@capacitor-community/health` plugin (same one as HealthKit, handles both).
**What you get:** Activity/sleep data in Pomodoro or dashboard.
**Effort:** Medium. Same as HealthKit, defer.

---

## Implementation Phases

### Phase 1 — Quick Wins (< 1 week each, no new native code for most)
| Item | Effort | Module |
|------|--------|--------|
| Apple Shortcuts Mally Action | 1 day | ActionBuilder + Mally |
| Android Clock SET_ALARM plugin | 1 day | AlarmsModule |
| Google Tasks API Cloud Function | 1 week | RemindersModule |

### Phase 2 — Apple EventKit Plugin (2–4 weeks)
| Item | Effort |
|------|--------|
| Swift Capacitor plugin (Reminders + Calendar) | 2 weeks |
| Permission + onboarding flow | 3 days |
| `use-apple-reminders.ts` hook + sync logic | 1 week |
| RemindersModule "Connect Apple Reminders" toggle | 3 days |
| Conflict resolution (local wins vs. remote wins) | 3 days |

### Phase 3 — iCloud CalDAV Web Fallback (1–2 weeks)
| Item | Effort |
|------|--------|
| Firebase Cloud Function CalDAV proxy | 1 week |
| App-Specific Password auth flow in settings | 3 days |
| Polling sync (every 5 min) | 2 days |

### Phase 4 — Polish + HealthKit (Stretch)
| Item | Effort |
|------|--------|
| HealthKit + Health Connect plugin | 2 weeks |
| Pomodoro/wellness stats from health data | 1 week |

---

## Technical Decisions

### Conflict Resolution (Phase 2)
- **Strategy:** Last-write-wins with a `syncedAt` timestamp per reminder
- Apple Reminders is the source of truth for items originating there; Malleabite is source of truth for items created here
- Store `externalId` (EKReminder identifier) on Firestore reminder docs

### Sync Trigger
- **iOS:** Use `EKEventStoreChangedNotification` for real-time push updates (native, free)
- **Google Tasks:** Webhooks not available on free tier; poll on app foreground + every 5 min

### Data Model Addition (Firestore reminders)
```typescript
// Add to existing Reminder type
externalId?: string;          // EKReminder.calendarItemIdentifier or Google Task ID
externalSource?: 'apple' | 'google_tasks';
lastSyncedAt?: Timestamp;
syncStatus?: 'synced' | 'pending' | 'conflict';
```

### Privacy / Permissions
- iOS: Add `NSRemindersUsageDescription` + `NSCalendarsUsageDescription` to `Info.plist`
- Android: No special permission needed for SET_ALARM intent
- Google Tasks: Add scope to Google OAuth consent screen in Firebase Console

---

## Files to Create / Modify

### New Files
- `ios/App/App/Plugins/AppleDataPlugin.swift` — EventKit bridge (Reminders + Calendar)
- `ios/App/App/Plugins/AppleDataPlugin.m` — Capacitor plugin registration
- `src/hooks/use-apple-reminders.ts` — iOS Capacitor bridge hook
- `src/hooks/use-google-tasks.ts` — Google Tasks REST hook
- `firebase/functions/src/google-tasks.ts` — Cloud Functions for Tasks API
- `firebase/functions/src/apple-caldav.ts` — CalDAV proxy (Phase 3)

### Modified Files
- `src/components/modules/RemindersModule.tsx` — add sync toggle + status indicators
- `src/components/modules/AlarmsModule.tsx` — add "Open in Clock" button (Android)
- `firebase/functions/src/index.ts` — register new Cloud Functions
- `src/types/calendar.ts` — no change needed (apple source already defined)
- `ios/App/App/Info.plist` — add permission strings
- `ios/App/App/AppDelegate.swift` — register plugin

---

## Start Here (Recommended First Task)

**Google Tasks API** — highest value, lowest risk, no native code, reuses existing patterns.

1. Enable Google Tasks API in Google Cloud Console (same project as Calendar)
2. Add `tasks` scope to `google-calendar-oauth.ts` consent screen
3. Create `firebase/functions/src/google-tasks.ts` with CRUD endpoints
4. Create `src/hooks/use-google-tasks.ts` 
5. Add "Sync with Google Tasks" toggle in RemindersModule settings panel

This takes ~1 week and proves the sync pattern before tackling native EventKit.
