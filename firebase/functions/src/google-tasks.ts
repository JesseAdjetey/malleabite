/**
 * Google Tasks integration — Firebase Cloud Functions
 *
 * Architecture mirrors the Todoist integration:
 * - Connection state stored at users/{uid}/integrations/googleTasks
 * - Reuses Google OAuth tokens from users/{uid}/googleAccounts/{googleAccountId}
 * - Server-side sync writes to todo_items collection (same as Todoist)
 * - Bi-directional: push actions mirror changes back to Google Tasks
 *
 * Google Tasks REST API: https://developers.google.com/tasks/reference/rest
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { getValidAccessToken } from './google-calendar-oauth';

const googleClientId = defineSecret('GOOGLE_CLIENT_ID');
const googleClientSecret = defineSecret('GOOGLE_CLIENT_SECRET');
const googleTokenEncryptionKey = defineSecret('GOOGLE_TOKEN_ENCRYPTION_KEY');

const TASKS_BASE = 'https://www.googleapis.com/tasks/v1';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GoogleTaskList {
  id: string;
  title: string;
  updated: string;
}

interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  updated: string;
}

interface StoredGoogleTasksIntegration {
  googleAccountId: string;
  taskListId: string;
  taskListTitle: string;
  email: string;
  connectedAt: string;
  lastSyncedAt: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDb() {
  return admin.firestore();
}

function integrationDoc(uid: string) {
  return getDb().collection('users').doc(uid).collection('integrations').doc('googleTasks');
}

async function tasksRequest<T>(path: string, accessToken: string, options: RequestInit = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${TASKS_BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => 'unknown error');
    if (response.status === 401) {
      throw new HttpsError('unauthenticated', `Google Tasks auth expired — please reconnect Google. (${detail})`);
    }
    if (response.status === 403) {
      throw new HttpsError('permission-denied', `Google Tasks not authorized. Re-connect Google and grant Tasks access. (${detail})`);
    }
    throw new HttpsError('internal', `Google Tasks API error ${response.status}: ${detail}`);
  }

  if (response.status === 204) return {} as T;
  return response.json() as Promise<T>;
}

// ─── 1. Get connection status ─────────────────────────────────────────────────

export const googleTasksGetStatus = onCall(
  { region: 'us-central1', secrets: [googleClientId, googleClientSecret, googleTokenEncryptionKey] },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Must be signed in.');

    const snap = await integrationDoc(request.auth.uid).get();
    if (!snap.exists) {
      return { connected: false };
    }

    const data = snap.data() as StoredGoogleTasksIntegration;
    return {
      connected: true,
      googleAccountId: data.googleAccountId,
      taskListId: data.taskListId,
      taskListTitle: data.taskListTitle,
      email: data.email,
      connectedAt: data.connectedAt,
      lastSyncedAt: data.lastSyncedAt,
    };
  }
);

// ─── 2. List task lists (for picker) ─────────────────────────────────────────

export const googleTasksListTaskLists = onCall(
  { region: 'us-central1', secrets: [googleClientId, googleClientSecret, googleTokenEncryptionKey] },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Must be signed in.');

    const googleAccountId = typeof request.data?.googleAccountId === 'string'
      ? request.data.googleAccountId : '';
    if (!googleAccountId) throw new HttpsError('invalid-argument', 'Missing googleAccountId.');

    const { accessToken } = await getValidAccessToken(request.auth.uid, googleAccountId);
    const data = await tasksRequest<{ items?: GoogleTaskList[] }>('/users/@me/lists', accessToken);

    return { taskLists: data.items || [] };
  }
);

// ─── 3. Connect (store config) ────────────────────────────────────────────────

export const googleTasksConnect = onCall(
  { region: 'us-central1', secrets: [googleClientId, googleClientSecret, googleTokenEncryptionKey] },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Must be signed in.');

    const { googleAccountId, taskListId, taskListTitle } = request.data as {
      googleAccountId: string;
      taskListId: string;
      taskListTitle: string;
    };
    if (!googleAccountId || !taskListId) {
      throw new HttpsError('invalid-argument', 'Missing googleAccountId or taskListId.');
    }

    // Validate the token works and get the email
    const { account } = await getValidAccessToken(request.auth.uid, googleAccountId);

    const payload: StoredGoogleTasksIntegration = {
      googleAccountId,
      taskListId,
      taskListTitle: taskListTitle || 'My Tasks',
      email: account.email,
      connectedAt: new Date().toISOString(),
      lastSyncedAt: null,
    };

    await integrationDoc(request.auth.uid).set(payload);

    return { connected: true, email: account.email, taskListTitle: payload.taskListTitle };
  }
);

// ─── 4. Sync: Google Tasks → todo_items ──────────────────────────────────────

export const googleTasksSync = onCall(
  { region: 'us-central1', secrets: [googleClientId, googleClientSecret, googleTokenEncryptionKey] },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Must be signed in.');
    const uid = request.auth.uid;

    const { listId } = request.data as { listId: string };
    if (!listId) throw new HttpsError('invalid-argument', 'Missing listId (Firestore todo list ID).');

    const snap = await integrationDoc(uid).get();
    if (!snap.exists) throw new HttpsError('failed-precondition', 'Google Tasks not connected.');

    const integration = snap.data() as StoredGoogleTasksIntegration;
    const { accessToken } = await getValidAccessToken(uid, integration.googleAccountId);
    const db = getDb();

    // Fetch incomplete tasks from the linked Google Tasks list
    const params = new URLSearchParams({ showCompleted: 'false', showHidden: 'false', maxResults: '100' });
    const tasksData = await tasksRequest<{ items?: GoogleTask[] }>(
      `/lists/${encodeURIComponent(integration.taskListId)}/tasks?${params}`,
      accessToken
    );
    const tasks = tasksData.items || [];

    // Fetch ALL existing Firestore items for this list that have a googleTaskId
    const existingSnap = await db.collection('todo_items')
      .where('userId', '==', uid)
      .where('listId', '==', listId)
      .get();

    const existingByGoogleTaskId = new Map<string, admin.firestore.QueryDocumentSnapshot>();
    const duplicateDocs: admin.firestore.QueryDocumentSnapshot[] = [];

    for (const doc of existingSnap.docs) {
      const googleTaskId = doc.data().googleTaskId as string | undefined;
      if (!googleTaskId) continue; // locally created item — leave alone
      if (existingByGoogleTaskId.has(googleTaskId)) {
        duplicateDocs.push(doc);
      } else {
        existingByGoogleTaskId.set(googleTaskId, doc);
      }
    }

    const now = admin.firestore.Timestamp.now();
    const nowIso = now.toDate().toISOString();
    const batch = db.batch();
    const seenGoogleTaskIds = new Set<string>();

    for (const task of tasks) {
      seenGoogleTaskIds.add(task.id);
      const existing = existingByGoogleTaskId.get(task.id);

      const payload = {
        text: task.title,
        description: task.notes || '',
        completed: false,
        deadline: task.due ? task.due.substring(0, 10) : null,
        listId,
        userId: uid,
        googleTaskId: task.id,
        googleTaskListId: integration.taskListId,
        updatedAt: now,
      };

      if (existing) {
        batch.update(existing.ref, payload);
      } else {
        // Deterministic ID — concurrent syncs are idempotent
        const deterministicId = `gtask_${uid}_${task.id}`;
        const newRef = db.collection('todo_items').doc(deterministicId);
        batch.set(newRef, {
          ...payload,
          createdAt: now,
          status: 'todo',
          pinned: false,
        });
      }
    }

    // Remove items that were deleted in Google Tasks
    for (const [googleTaskId, doc] of existingByGoogleTaskId.entries()) {
      if (!seenGoogleTaskIds.has(googleTaskId)) {
        batch.delete(doc.ref);
      }
    }

    for (const doc of duplicateDocs) {
      batch.delete(doc.ref);
    }

    await batch.commit();

    const nowIsoStr = nowIso;
    await integrationDoc(uid).update({ lastSyncedAt: nowIsoStr });
    await db.collection('todo_lists').doc(listId).update({
      lastGoogleTasksSync: nowIsoStr,
      googleTaskListId: integration.taskListId,
    });

    return {
      synced: tasks.length,
      deletedFromLocal: existingByGoogleTaskId.size - seenGoogleTaskIds.size,
    };
  }
);

// ─── 5. Push action (Malleabite → Google Tasks) ───────────────────────────────

type PushAction =
  | { type: 'create'; listId: string; text: string; description?: string; deadline?: string }
  | { type: 'update'; googleTaskId: string; text?: string; description?: string; deadline?: string | null }
  | { type: 'complete'; googleTaskId: string }
  | { type: 'uncomplete'; googleTaskId: string }
  | { type: 'delete'; googleTaskId: string };

export const googleTasksPushAction = onCall(
  { region: 'us-central1', secrets: [googleClientId, googleClientSecret, googleTokenEncryptionKey] },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Must be signed in.');
    const uid = request.auth.uid;
    const action = request.data as PushAction;

    const snap = await integrationDoc(uid).get();
    if (!snap.exists) throw new HttpsError('failed-precondition', 'Google Tasks not connected.');

    const integration = snap.data() as StoredGoogleTasksIntegration;
    const { accessToken } = await getValidAccessToken(uid, integration.googleAccountId);
    const taskListId = integration.taskListId;
    const db = getDb();

    switch (action.type) {
      case 'create': {
        const body: Partial<GoogleTask> = { title: action.text };
        if (action.description) body.notes = action.description;
        if (action.deadline) body.due = new Date(action.deadline).toISOString();

        const created = await tasksRequest<GoogleTask>(
          `/lists/${encodeURIComponent(taskListId)}/tasks`,
          accessToken,
          { method: 'POST', body: JSON.stringify(body) }
        );

        // Write to Firestore with deterministic ID
        const deterministicId = `gtask_${uid}_${created.id}`;
        const now = admin.firestore.Timestamp.now();
        await db.collection('todo_items').doc(deterministicId).set({
          text: action.text,
          description: action.description || '',
          completed: false,
          deadline: action.deadline || null,
          listId: action.listId,
          userId: uid,
          googleTaskId: created.id,
          googleTaskListId: taskListId,
          createdAt: now,
          updatedAt: now,
          status: 'todo',
          pinned: false,
        });

        return { googleTaskId: created.id };
      }

      case 'complete': {
        await tasksRequest<GoogleTask>(
          `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(action.googleTaskId)}`,
          accessToken,
          { method: 'PATCH', body: JSON.stringify({ id: action.googleTaskId, status: 'completed' }) }
        );
        return { ok: true };
      }

      case 'uncomplete': {
        await tasksRequest<GoogleTask>(
          `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(action.googleTaskId)}`,
          accessToken,
          { method: 'PATCH', body: JSON.stringify({ id: action.googleTaskId, status: 'needsAction' }) }
        );
        return { ok: true };
      }

      case 'update': {
        const patch: Partial<GoogleTask> = { id: action.googleTaskId };
        if (action.text !== undefined) patch.title = action.text;
        if (action.description !== undefined) patch.notes = action.description;
        if (action.deadline !== undefined) {
          patch.due = action.deadline ? new Date(action.deadline).toISOString() : undefined;
        }
        await tasksRequest<GoogleTask>(
          `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(action.googleTaskId)}`,
          accessToken,
          { method: 'PATCH', body: JSON.stringify(patch) }
        );
        return { ok: true };
      }

      case 'delete': {
        await tasksRequest<void>(
          `/lists/${encodeURIComponent(taskListId)}/tasks/${encodeURIComponent(action.googleTaskId)}`,
          accessToken,
          { method: 'DELETE' }
        );
        return { ok: true };
      }

      default:
        throw new HttpsError('invalid-argument', 'Unknown action type.');
    }
  }
);

// ─── 6. Disconnect ────────────────────────────────────────────────────────────

export const googleTasksDisconnect = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Must be signed in.');
    await integrationDoc(request.auth.uid).delete();
    return { ok: true };
  }
);
