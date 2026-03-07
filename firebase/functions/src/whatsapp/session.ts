/**
 * Session management for WhatsApp conversations.
 *
 * Stores pending actions so the bot can propose something,
 * wait for user confirmation, then execute.
 *
 * Firestore collection:
 *   whatsapp_sessions/{phoneNumber} → { pendingAction, lastCreatedId, lastCreatedType, updatedAt }
 */
import * as admin from 'firebase-admin';

const db = () => admin.firestore();
const SESSIONS = 'whatsapp_sessions';
const SESSION_TTL_MS = 15 * 60 * 1000; // 15 min — pending actions expire

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PendingAction {
  type: 'create_event' | 'create_todo';
  // Event fields
  title?: string;
  start?: string;   // ISO string
  end?: string;      // ISO string
  description?: string;
  isAllDay?: boolean;
  // Todo fields
  text?: string;
  listId?: string;    // resolved list ID (or null for default)
  listName?: string;  // human-readable list name
}

interface SessionData {
  pendingAction?: PendingAction | null;
  lastCreatedId?: string | null;       // Firestore doc ID of last created item
  lastCreatedType?: 'event' | 'todo' | null;
  lastCreatedCollection?: string | null; // 'calendar_events' or 'todo_items' or 'todos'
  updatedAt: number;
}

// ─── Get / Set Pending Action ─────────────────────────────────────────────────

export async function getPendingAction(phone: string): Promise<PendingAction | null> {
  const doc = await db().collection(SESSIONS).doc(phone).get();
  if (!doc.exists) return null;

  const data = doc.data() as SessionData;

  // Check TTL
  if (Date.now() - data.updatedAt > SESSION_TTL_MS) {
    await clearPendingAction(phone);
    return null;
  }

  return data.pendingAction ?? null;
}

export async function setPendingAction(phone: string, action: PendingAction): Promise<void> {
  await db().collection(SESSIONS).doc(phone).set(
    { pendingAction: action, updatedAt: Date.now() },
    { merge: true }
  );
}

export async function clearPendingAction(phone: string): Promise<void> {
  await db().collection(SESSIONS).doc(phone).set(
    { pendingAction: null, updatedAt: Date.now() },
    { merge: true }
  );
}

// ─── Track Last Created (for Undo) ───────────────────────────────────────────

export async function setLastCreated(
  phone: string,
  docId: string,
  type: 'event' | 'todo',
  collection: string
): Promise<void> {
  await db().collection(SESSIONS).doc(phone).set(
    {
      lastCreatedId: docId,
      lastCreatedType: type,
      lastCreatedCollection: collection,
      updatedAt: Date.now(),
    },
    { merge: true }
  );
}

export async function undoLastCreated(phone: string): Promise<{ success: boolean; type?: string }> {
  const doc = await db().collection(SESSIONS).doc(phone).get();
  if (!doc.exists) return { success: false };

  const data = doc.data() as SessionData;
  if (!data.lastCreatedId || !data.lastCreatedCollection) return { success: false };

  // Check TTL — only allow undo within 15 min
  if (Date.now() - data.updatedAt > SESSION_TTL_MS) {
    return { success: false };
  }

  try {
    await db().collection(data.lastCreatedCollection).doc(data.lastCreatedId).delete();
    await db().collection(SESSIONS).doc(phone).set(
      { lastCreatedId: null, lastCreatedType: null, lastCreatedCollection: null, updatedAt: Date.now() },
      { merge: true }
    );
    return { success: true, type: data.lastCreatedType ?? undefined };
  } catch {
    return { success: false };
  }
}
