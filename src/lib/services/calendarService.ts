// Calendar Service - Firestore operations for calendar groups, calendars, and preferences
// All CRUD operations for the calendar module live here.

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { logger } from '@/lib/logger';
import {
  CalendarGroup,
  ConnectedCalendar,
  CalendarPreferences,
  SyncedCalendarEvent,
  CalendarTemplate,
  DEFAULT_GROUPS,
  createCalendarGroup,
  createConnectedCalendar,
} from '@/types/calendar';

// ─── Collection Paths ───────────────────────────────────────────────────────

const groupsPath = (userId: string) => `users/${userId}/calendarGroups`;
const calendarsPath = (userId: string) => `users/${userId}/connectedCalendars`;
const preferencesPath = (userId: string) => `users/${userId}/calendarPreferences`;
const syncedEventsPath = (userId: string) => `users/${userId}/syncedEvents`;
const templatesPath = (userId: string) => `users/${userId}/calendarTemplates`;

// ─── Groups ─────────────────────────────────────────────────────────────────

/**
 * Get all calendar groups for a user, sorted by order.
 */
export async function getCalendarGroups(userId: string): Promise<CalendarGroup[]> {
  try {
    const ref = collection(db, groupsPath(userId));
    const q = query(ref, orderBy('order', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CalendarGroup));
  } catch (error) {
    logger.error('CalendarService', 'Failed to fetch calendar groups', { error });
    return [];
  }
}

/**
 * Create a single calendar group.
 */
export async function createGroup(
  userId: string,
  groupData: Partial<CalendarGroup> & Pick<CalendarGroup, 'name'>
): Promise<CalendarGroup> {
  try {
    const ref = collection(db, groupsPath(userId));
    const newDoc = doc(ref);
    const group = createCalendarGroup(groupData);
    await setDoc(newDoc, group);
    logger.info('CalendarService', `Created group: ${group.name}`, { groupId: newDoc.id });
    return { id: newDoc.id, ...group };
  } catch (error) {
    logger.error('CalendarService', 'Failed to create group', { error });
    throw error;
  }
}

/**
 * Update an existing calendar group.
 */
export async function updateGroup(
  userId: string,
  groupId: string,
  updates: Partial<CalendarGroup>
): Promise<void> {
  try {
    const ref = doc(db, groupsPath(userId), groupId);
    await updateDoc(ref, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
    logger.info('CalendarService', `Updated group: ${groupId}`);
  } catch (error) {
    logger.error('CalendarService', 'Failed to update group', { error });
    throw error;
  }
}

/**
 * Delete a calendar group. Optionally move its calendars to another group.
 */
export async function deleteGroup(
  userId: string,
  groupId: string,
  moveCalendarsToGroupId?: string
): Promise<void> {
  try {
    const batch = writeBatch(db);

    // If moving calendars to another group, update them first
    if (moveCalendarsToGroupId) {
      const calendars = await getConnectedCalendars(userId);
      const calendarsInGroup = calendars.filter(c => c.groupId === groupId);
      for (const cal of calendarsInGroup) {
        const calRef = doc(db, calendarsPath(userId), cal.id);
        batch.update(calRef, {
          groupId: moveCalendarsToGroupId,
          updatedAt: new Date().toISOString(),
        });
      }
    } else {
      // Delete all calendars in this group
      const calendars = await getConnectedCalendars(userId);
      const calendarsInGroup = calendars.filter(c => c.groupId === groupId);
      for (const cal of calendarsInGroup) {
        const calRef = doc(db, calendarsPath(userId), cal.id);
        batch.delete(calRef);
      }
    }

    // Delete the group itself
    const groupRef = doc(db, groupsPath(userId), groupId);
    batch.delete(groupRef);

    await batch.commit();
    logger.info('CalendarService', `Deleted group: ${groupId}`);
  } catch (error) {
    logger.error('CalendarService', 'Failed to delete group', { error });
    throw error;
  }
}

/**
 * Reorder groups by writing new order values.
 */
export async function reorderGroups(
  userId: string,
  orderedGroupIds: string[]
): Promise<void> {
  try {
    const batch = writeBatch(db);
    orderedGroupIds.forEach((groupId, index) => {
      const ref = doc(db, groupsPath(userId), groupId);
      batch.update(ref, { order: index, updatedAt: new Date().toISOString() });
    });
    await batch.commit();
    logger.info('CalendarService', 'Reordered groups');
  } catch (error) {
    logger.error('CalendarService', 'Failed to reorder groups', { error });
    throw error;
  }
}

// Module-level singleton lock to prevent concurrent initialization
let _initPromise: Promise<CalendarGroup[]> | null = null;

/**
 * Initialize default groups (Work, Personal, Family) for a new user.
 * Uses a singleton lock so concurrent calls (e.g. from multiple hook instances)
 * won't create duplicates.
 */
export async function initializeDefaultGroups(userId: string): Promise<CalendarGroup[]> {
  // If already initializing, return the same promise (prevents race condition)
  if (_initPromise) return _initPromise;

  _initPromise = _initializeDefaultGroupsImpl(userId).finally(() => {
    _initPromise = null;
  });

  return _initPromise;
}

async function _initializeDefaultGroupsImpl(userId: string): Promise<CalendarGroup[]> {
  try {
    // Check if groups already exist
    const existing = await getCalendarGroups(userId);
    if (existing.length > 0) {
      logger.info('CalendarService', 'Default groups already exist, skipping initialization');
      return existing;
    }

    const batch = writeBatch(db);
    const createdGroups: CalendarGroup[] = [];
    const now = new Date().toISOString();

    // Name-based dedup: only create groups that don't already exist
    const existingNames = new Set(existing.map(g => g.name.toLowerCase()));

    for (const defaultGroup of DEFAULT_GROUPS) {
      if (existingNames.has(defaultGroup.name.toLowerCase())) continue;

      const ref = doc(collection(db, groupsPath(userId)));
      const group: Omit<CalendarGroup, 'id'> = {
        ...defaultGroup,
        createdAt: now,
        updatedAt: now,
      };
      batch.set(ref, group);
      createdGroups.push({ id: ref.id, ...group });
    }

    if (createdGroups.length > 0) {
      await batch.commit();
      logger.info('CalendarService', `Initialized ${createdGroups.length} default groups`);
    }
    return [...existing, ...createdGroups];
  } catch (error) {
    logger.error('CalendarService', 'Failed to initialize default groups', { error });
    throw error;
  }
}

/**
 * Deduplicate groups by name. Keeps the first of each name, deletes extras.
 * Call once after login to clean up any existing duplicates.
 */
export async function deduplicateGroups(userId: string): Promise<number> {
  try {
    const groups = await getCalendarGroups(userId);
    const seen = new Map<string, string>(); // name → first id
    const toDelete: string[] = [];

    for (const group of groups) {
      const key = group.name.toLowerCase();
      if (seen.has(key)) {
        toDelete.push(group.id);
      } else {
        seen.set(key, group.id);
      }
    }

    if (toDelete.length === 0) return 0;

    // Before deleting duplicate groups, reassign their calendars to the
    // surviving group of the same name so calendars don't become orphaned.
    const calendars = await getConnectedCalendars(userId);
    const deleteSet = new Set(toDelete);
    const batch = writeBatch(db);

    for (const cal of calendars) {
      if (deleteSet.has(cal.groupId)) {
        // Find the surviving group with the same name
        const deadGroup = groups.find(g => g.id === cal.groupId);
        const key = deadGroup?.name.toLowerCase() || '';
        const survivorId = seen.get(key);
        if (survivorId && survivorId !== cal.groupId) {
          batch.update(doc(db, calendarsPath(userId), cal.id), {
            groupId: survivorId,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    for (const id of toDelete) {
      batch.delete(doc(db, groupsPath(userId), id));
    }
    await batch.commit();
    logger.info('CalendarService', `Deduplicated ${toDelete.length} duplicate groups (calendars reassigned)`);
    return toDelete.length;
  } catch (error) {
    logger.error('CalendarService', 'Failed to deduplicate groups', { error });
    return 0;
  }
}

/**
 * Find calendars whose groupId doesn't match any existing group and reassign
 * them to the best matching group (by name heuristic) or the first group.
 * Call once on startup to recover from prior orphaning bugs.
 */
export async function adoptOrphanedCalendars(userId: string): Promise<number> {
  try {
    const groups = await getCalendarGroups(userId);
    if (groups.length === 0) return 0;

    const calendars = await getConnectedCalendars(userId);
    const groupIds = new Set(groups.map(g => g.id));
    const orphaned = calendars.filter(c => !groupIds.has(c.groupId));

    if (orphaned.length === 0) return 0;

    // Build a lookup: lowercase group name → group id
    const nameToGroup = new Map<string, string>();
    for (const g of groups) {
      nameToGroup.set(g.name.toLowerCase(), g.id);
    }

    const batch = writeBatch(db);
    for (const cal of orphaned) {
      // Try to match by calendar name (e.g. "Personal" calendar → "Personal" group)
      let targetGroupId = nameToGroup.get(cal.name.toLowerCase());

      // Fallback: try to match by source type (google → "Work", personal → "Personal")
      if (!targetGroupId) {
        if (cal.id === 'personal' || cal.sourceCalendarId === 'personal') {
          targetGroupId = nameToGroup.get('personal');
        } else if (cal.source === 'google') {
          targetGroupId = nameToGroup.get('work');
        }
      }

      // Final fallback: first group
      if (!targetGroupId) {
        targetGroupId = groups[0].id;
      }

      batch.update(doc(db, calendarsPath(userId), cal.id), {
        groupId: targetGroupId,
        updatedAt: new Date().toISOString(),
      });
      logger.info('CalendarService', `Adopted orphaned calendar "${cal.name}" → group ${targetGroupId}`);
    }

    await batch.commit();
    logger.info('CalendarService', `Adopted ${orphaned.length} orphaned calendar(s)`);
    return orphaned.length;
  } catch (error) {
    logger.error('CalendarService', 'Failed to adopt orphaned calendars', { error });
    return 0;
  }
}

// ─── Connected Calendars ────────────────────────────────────────────────────

/**
 * Get all connected calendars for a user, sorted by order.
 */
export async function getConnectedCalendars(userId: string): Promise<ConnectedCalendar[]> {
  try {
    const ref = collection(db, calendarsPath(userId));
    const q = query(ref, orderBy('order', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ConnectedCalendar));
  } catch (error) {
    logger.error('CalendarService', 'Failed to fetch connected calendars', { error });
    return [];
  }
}

/**
 * Add a new connected calendar.
 */
export async function addConnectedCalendar(
  userId: string,
  calendarData: Partial<ConnectedCalendar> & Pick<ConnectedCalendar, 'source' | 'groupId' | 'name' | 'accountEmail'>
): Promise<ConnectedCalendar> {
  try {
    const ref = collection(db, calendarsPath(userId));
    const newDoc = doc(ref);
    const calendar = createConnectedCalendar(calendarData);
    await setDoc(newDoc, calendar);
    logger.info('CalendarService', `Added calendar: ${calendar.name}`, { calendarId: newDoc.id });
    return { id: newDoc.id, ...calendar };
  } catch (error) {
    logger.error('CalendarService', 'Failed to add connected calendar', { error });
    throw error;
  }
}

/**
 * Update a connected calendar.
 */
export async function updateConnectedCalendar(
  userId: string,
  calendarId: string,
  updates: Partial<ConnectedCalendar>
): Promise<void> {
  try {
    const ref = doc(db, calendarsPath(userId), calendarId);
    // Strip undefined values — Firestore rejects them
    const cleanUpdates = JSON.parse(JSON.stringify({
      ...updates,
      updatedAt: new Date().toISOString(),
    }));
    await updateDoc(ref, cleanUpdates);
    logger.info('CalendarService', `Updated calendar: ${calendarId}`);
  } catch (error) {
    logger.error('CalendarService', 'Failed to update calendar', { error });
    throw error;
  }
}

/**
 * Delete a connected calendar and its synced events.
 */
export async function deleteConnectedCalendar(
  userId: string,
  calendarId: string
): Promise<void> {
  try {
    const batch = writeBatch(db);

    // Delete synced events for this calendar
    const eventsRef = collection(db, syncedEventsPath(userId));
    const eventSnapshot = await getDocs(
      query(eventsRef)
    );
    for (const eventDoc of eventSnapshot.docs) {
      const data = eventDoc.data();
      if (data.calendarId === calendarId) {
        batch.delete(eventDoc.ref);
      }
    }

    // Delete the calendar itself
    const calRef = doc(db, calendarsPath(userId), calendarId);
    batch.delete(calRef);

    await batch.commit();
    logger.info('CalendarService', `Deleted calendar: ${calendarId}`);
  } catch (error) {
    logger.error('CalendarService', 'Failed to delete calendar', { error });
    throw error;
  }
}

/**
 * Move a calendar to a different group.
 */
export async function moveCalendarToGroup(
  userId: string,
  calendarId: string,
  newGroupId: string,
  newOrder?: number
): Promise<void> {
  try {
    const ref = doc(db, calendarsPath(userId), calendarId);
    const updates: Partial<ConnectedCalendar> = {
      groupId: newGroupId,
      updatedAt: new Date().toISOString(),
    };
    if (newOrder !== undefined) {
      updates.order = newOrder;
    }
    await updateDoc(ref, updates);
    logger.info('CalendarService', `Moved calendar ${calendarId} to group ${newGroupId}`);
  } catch (error) {
    logger.error('CalendarService', 'Failed to move calendar', { error });
    throw error;
  }
}

/**
 * Toggle calendar visibility (active/inactive).
 */
export async function toggleCalendarActive(
  userId: string,
  calendarId: string,
  isActive: boolean
): Promise<void> {
  try {
    const ref = doc(db, calendarsPath(userId), calendarId);
    await updateDoc(ref, {
      isActive,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('CalendarService', 'Failed to toggle calendar', { error });
    throw error;
  }
}

/**
 * Reorder calendars within a group.
 */
export async function reorderCalendarsInGroup(
  userId: string,
  orderedCalendarIds: string[]
): Promise<void> {
  try {
    const batch = writeBatch(db);
    orderedCalendarIds.forEach((calendarId, index) => {
      const ref = doc(db, calendarsPath(userId), calendarId);
      batch.update(ref, { order: index, updatedAt: new Date().toISOString() });
    });
    await batch.commit();
  } catch (error) {
    logger.error('CalendarService', 'Failed to reorder calendars', { error });
    throw error;
  }
}

// ─── Preferences ────────────────────────────────────────────────────────────

/**
 * Get calendar preferences for a user.
 */
export async function getCalendarPreferences(userId: string): Promise<CalendarPreferences | null> {
  try {
    const ref = doc(db, preferencesPath(userId), 'settings');
    const snapshot = await getDoc(ref);
    if (!snapshot.exists()) return null;
    return { userId, ...snapshot.data() } as CalendarPreferences;
  } catch (error) {
    logger.error('CalendarService', 'Failed to fetch preferences', { error });
    return null;
  }
}

/**
 * Update calendar preferences. Creates if doesn't exist.
 */
export async function updateCalendarPreferences(
  userId: string,
  updates: Partial<CalendarPreferences>
): Promise<void> {
  try {
    const ref = doc(db, preferencesPath(userId), 'settings');
    await setDoc(ref, {
      ...updates,
      userId,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (error) {
    logger.error('CalendarService', 'Failed to update preferences', { error });
    throw error;
  }
}

/**
 * Initialize default preferences for a new user.
 */
export async function initializeCalendarPreferences(
  userId: string,
  groupIds: string[]
): Promise<CalendarPreferences> {
  const prefs: CalendarPreferences = {
    userId,
    groupOrder: groupIds,
    expandedGroups: groupIds, // All expanded by default
    visibleCalendars: [],
    syncStrategy: 'active',
    updatedAt: new Date().toISOString(),
  };

  await updateCalendarPreferences(userId, prefs);
  return prefs;
}

// ─── Calendar Templates ─────────────────────────────────────────────────────

/**
 * Get all calendar templates for a user.
 */
export async function getCalendarTemplates(userId: string): Promise<CalendarTemplate[]> {
  try {
    const ref = collection(db, templatesPath(userId));
    const snapshot = await getDocs(ref);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CalendarTemplate));
  } catch (error) {
    logger.error('CalendarService', 'Failed to fetch templates', { error });
    return [];
  }
}

/**
 * Create a calendar template.
 */
export async function createCalendarTemplate(
  userId: string,
  template: Omit<CalendarTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<CalendarTemplate> {
  try {
    const ref = collection(db, templatesPath(userId));
    const newDoc = doc(ref);
    const now = new Date().toISOString();
    // Strip any undefined values — Firestore rejects them
    const raw = { ...template, createdAt: now, updatedAt: now };
    const data = JSON.parse(JSON.stringify(raw));
    await setDoc(newDoc, data);
    return { id: newDoc.id, ...data };
  } catch (error) {
    logger.error('CalendarService', 'Failed to create template', { error });
    throw error;
  }
}

/**
 * Update an existing calendar template.
 */
export async function updateCalendarTemplate(
  userId: string,
  templateId: string,
  data: Partial<Omit<CalendarTemplate, 'id' | 'createdAt'>>
): Promise<void> {
  try {
    const ref = doc(db, templatesPath(userId), templateId);
    // Strip undefined values from nested template event fields before updating Firestore.
    const sanitized = JSON.parse(JSON.stringify({
      ...data,
      updatedAt: new Date().toISOString(),
    }));
    await updateDoc(ref, sanitized);
  } catch (error) {
    logger.error('CalendarService', 'Failed to update template', { error });
    throw error;
  }
}

/**
 * Delete a calendar template.
 */
export async function deleteCalendarTemplate(
  userId: string,
  templateId: string
): Promise<void> {
  try {
    const ref = doc(db, templatesPath(userId), templateId);
    await deleteDoc(ref);
  } catch (error) {
    logger.error('CalendarService', 'Failed to delete template', { error });
    throw error;
  }
}

// ─── Synced Events ──────────────────────────────────────────────────────────

/**
 * Batch upsert synced events from an external calendar.
 */
export async function upsertSyncedEvents(
  userId: string,
  events: SyncedCalendarEvent[]
): Promise<number> {
  try {
    const batchSize = 400;
    let count = 0;

    for (let index = 0; index < events.length; index += batchSize) {
      const batch = writeBatch(db);
      const chunk = events.slice(index, index + batchSize);

      for (const event of chunk) {
        // Use externalId + calendarId as composite key
        const docId = `${event.calendarId}_${event.externalId}`;
        const ref = doc(db, syncedEventsPath(userId), docId);
        // Strip undefined values — Firestore rejects them
        const cleanEvent = JSON.parse(JSON.stringify({
          ...event,
          syncedAt: new Date().toISOString(),
        }));
        batch.set(ref, cleanEvent, { merge: true });
        count++;
      }

      await batch.commit();
    }

    logger.info('CalendarService', `Upserted ${count} synced events`);
    return count;
  } catch (error) {
    logger.error('CalendarService', 'Failed to upsert synced events', { error });
    throw error;
  }
}

/**
 * Replace the cached synced events for a specific connected calendar.
 * This removes stale events that no longer exist in the latest imported
 * result for that calendar, then upserts the fresh set.
 */
export async function replaceSyncedEventsForCalendar(
  userId: string,
  calendarId: string,
  events: SyncedCalendarEvent[]
): Promise<number> {
  try {
    const eventsRef = collection(db, syncedEventsPath(userId));
    const existingEventsQuery = query(eventsRef, where('calendarId', '==', calendarId));
    const snapshot = await getDocs(existingEventsQuery);
    const existingDocs = snapshot.docs;
    const nextExternalIds = new Set(events.map((event) => event.externalId));

    const deleteRefs = existingDocs.filter((docSnap) => {
      const data = docSnap.data();
      return !nextExternalIds.has(data.externalId);
    });

    if (events.length === 0) {
      for (let index = 0; index < deleteRefs.length; index += 400) {
        const batch = writeBatch(db);
        for (const docSnap of deleteRefs.slice(index, index + 400)) {
          batch.delete(docSnap.ref);
        }
        await batch.commit();
      }
      logger.info('CalendarService', `Replaced synced events for ${calendarId} with empty set`);
      return 0;
    }

    // Write fresh events first. This prevents accidental wipe-outs if a large
    // upsert fails partway (e.g. batch limits/network issues).
    const count = await upsertSyncedEvents(userId, events);

    // Remove stale events after successful upsert.
    for (let index = 0; index < deleteRefs.length; index += 400) {
      const batch = writeBatch(db);
      for (const docSnap of deleteRefs.slice(index, index + 400)) {
        batch.delete(docSnap.ref);
      }
      await batch.commit();
    }

    logger.info('CalendarService', `Replaced synced events for ${calendarId} with ${count} event(s)`);
    return count;
  } catch (error) {
    logger.error('CalendarService', 'Failed to replace synced events for calendar', {
      error,
      calendarId,
    });
    throw error;
  }
}

/**
 * After polling Google Calendar, update any local `calendar_events` documents
 * whose time has changed in Google (e.g. the user dragged the event in Google Calendar).
 * Matches by googleEventId ↔ externalId.
 */
export async function syncLocalEventsFromGoogle(
  userId: string,
  googleEvents: Array<{ externalId: string; startTime: string; endTime: string }>
): Promise<void> {
  if (!userId || googleEvents.length === 0) return;

  const valid = googleEvents.filter(e => e.externalId && e.startTime && e.endTime);
  if (valid.length === 0) return;

  const googleMap = new Map(valid.map(e => [e.externalId, e]));

  // Query only by userId (single-field, auto-indexed, satisfies security rules).
  // Composite queries (userId + googleEventId 'in') require a manual Firestore index.
  // Filter by googleEventId client-side instead.
  const snap = await getDocs(
    query(
      collection(db, 'calendar_events'),
      where('userId', '==', userId)
    )
  );
  if (snap.empty) return;

  const batch = writeBatch(db);
  let hasUpdates = false;

  const toMs = (v: any): number | null => {
    if (!v) return null;
    if (v instanceof Timestamp) return v.toMillis();
    if (typeof v === 'string') { const d = new Date(v); return isNaN(d.getTime()) ? null : d.getTime(); }
    return null;
  };

  for (const docSnap of snap.docs) {
    const local = docSnap.data();
    const google = googleMap.get(local.googleEventId);
    if (!google) continue;

    const localStartMs = toMs(local.startsAt);
    const googleStartMs = toMs(google.startTime);
    const localEndMs = toMs(local.endsAt);
    const googleEndMs = toMs(google.endTime);

    if (
      localStartMs !== null && googleStartMs !== null &&
      localEndMs !== null && googleEndMs !== null &&
      (localStartMs !== googleStartMs || localEndMs !== googleEndMs)
    ) {
      const newStart = Timestamp.fromDate(new Date(google.startTime));
      const newEnd = Timestamp.fromDate(new Date(google.endTime));
      batch.update(docSnap.ref, {
        startsAt: newStart,
        endsAt: newEnd,
        startAt: newStart,
        endAt: newEnd,
      });
      hasUpdates = true;
    }
  }

  if (hasUpdates) await batch.commit();
}

/**
 * Get synced events for specific calendars within a date range.
 */
export async function getSyncedEvents(
  userId: string,
  calendarIds: string[],
  startDate?: string,
  endDate?: string
): Promise<SyncedCalendarEvent[]> {
  try {
    if (calendarIds.length === 0) {
      return [];
    }

    const ref = collection(db, syncedEventsPath(userId));
    const uniqueCalendarIds = Array.from(new Set(calendarIds));
    const chunkSize = 10; // Firestore 'in' supports up to 10 values
    const allEvents: SyncedCalendarEvent[] = [];

    for (let index = 0; index < uniqueCalendarIds.length; index += chunkSize) {
      const idChunk = uniqueCalendarIds.slice(index, index + chunkSize);
      const constraints: ReturnType<typeof where>[] = [where('calendarId', 'in', idChunk)];

      if (startDate) {
        constraints.push(where('startTime', '>=', startDate));
      }
      if (endDate) {
        constraints.push(where('startTime', '<=', endDate));
      }

      const snapshot = await getDocs(query(ref, ...constraints));
      allEvents.push(...snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SyncedCalendarEvent)));
    }

    // Deduplicate in case overlapping queries ever occur
    const uniqueById = new Map<string, SyncedCalendarEvent>();
    for (const event of allEvents) {
      uniqueById.set(event.id, event);
    }

    return Array.from(uniqueById.values());
  } catch (error) {
    logger.error('CalendarService', 'Failed to fetch synced events', { error });
    return [];
  }
}

// ─── Full Initialization ────────────────────────────────────────────────────

/**
 * Full initialization for a user's calendar module.
 * Creates default groups, preferences, and the Personal calendar if they don't exist.
 */
export async function initializeCalendarModule(userId: string): Promise<{
  groups: CalendarGroup[];
  preferences: CalendarPreferences;
}> {
  const groups = await initializeDefaultGroups(userId);
  const groupIds = groups.map(g => g.id);

  let prefs = await getCalendarPreferences(userId);
  if (!prefs) {
    prefs = await initializeCalendarPreferences(userId, groupIds);
  }

  // Ensure a "Personal" ConnectedCalendar exists (source: owned by the user)
  // so it appears in the sidebar with a toggle.
  await ensurePersonalCalendar(userId, groups);

  return { groups, preferences: prefs };
}

/**
 * Create the built-in "Personal" calendar if it doesn't already exist.
 * Uses a well-known document ID 'personal' so it's stable across sessions.
 */
async function ensurePersonalCalendar(userId: string, groups: CalendarGroup[]): Promise<void> {
  try {
    const personalRef = doc(db, calendarsPath(userId), 'personal');
    const snap = await getDoc(personalRef);
    if (snap.exists()) return; // Already created

    // Put it in the "Personal" group if one exists, else first group
    const personalGroup = groups.find(g => g.name.toLowerCase() === 'personal');
    const targetGroupId = personalGroup?.id || groups[0]?.id || '';

    const now = new Date().toISOString();
    await setDoc(personalRef, {
      source: 'google' as any, // type placeholder — displayed as local
      sourceCalendarId: 'personal',
      groupId: targetGroupId,
      accountEmail: '',
      accountName: 'Local',
      name: 'Personal',
      color: '#8B5CF6',
      isActive: true,
      order: 0,
      syncEnabled: false,
      syncInterval: 0,
      createdAt: now,
      updatedAt: now,
    });
    logger.info('CalendarService', 'Created built-in Personal calendar');
  } catch (error) {
    logger.error('CalendarService', 'Failed to create Personal calendar', { error });
    // Non-fatal — continue
  }
}
