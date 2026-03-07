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

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  ts: number;
}

interface SessionData {
  pendingAction?: PendingAction | null;
  chatHistory?: ChatMessage[] | null;
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

// ─── Chat History ─────────────────────────────────────────────────────────────

const MAX_HISTORY = 10; // keep last N messages (5 turns)
const HISTORY_TTL_MS = 10 * 60 * 1000; // 10 min — history expires after inactivity

export async function getChatHistory(phone: string): Promise<ChatMessage[]> {
  const doc = await db().collection(SESSIONS).doc(phone).get();
  if (!doc.exists) return [];
  const data = doc.data() as SessionData;

  // Expire old history
  if (!data.chatHistory || !data.chatHistory.length) return [];
  const lastMsg = data.chatHistory[data.chatHistory.length - 1];
  if (Date.now() - lastMsg.ts > HISTORY_TTL_MS) {
    await db().collection(SESSIONS).doc(phone).set(
      { chatHistory: null },
      { merge: true }
    );
    return [];
  }
  return data.chatHistory;
}

export async function appendChatHistory(
  phone: string,
  userMsg: string,
  modelMsg: string
): Promise<void> {
  const existing = await getChatHistory(phone);
  const now = Date.now();
  const updated = [
    ...existing,
    { role: 'user' as const, text: userMsg, ts: now },
    { role: 'model' as const, text: modelMsg, ts: now },
  ].slice(-MAX_HISTORY);

  await db().collection(SESSIONS).doc(phone).set(
    { chatHistory: updated, updatedAt: now },
    { merge: true }
  );
}

export async function clearChatHistory(phone: string): Promise<void> {
  await db().collection(SESSIONS).doc(phone).set(
    { chatHistory: null },
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
