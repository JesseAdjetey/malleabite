/**
 * Todoist OAuth + Sync Firebase Functions
 *
 * Architecture:
 * - Tokens stored encrypted in users/{uid}/integrations/todoist
 * - Todoist tokens do NOT expire (no refresh needed)
 * - Sync: Todoist is source of truth (external wins)
 * - Bi-directional: all write actions proxied through here
 */

import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';

// ─── Secrets ──────────────────────────────────────────────────────────────────

const todoistClientId = defineSecret('TODOIST_CLIENT_ID');
const todoistClientSecret = defineSecret('TODOIST_CLIENT_SECRET');
const todoistEncryptionKey = defineSecret('TODOIST_TOKEN_ENCRYPTION_KEY');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDb(): admin.firestore.Firestore {
  return admin.firestore();
}

function getProjectId(): string {
  return process.env.GCLOUD_PROJECT || admin.app().options.projectId || '';
}

function getCallbackUrl(): string {
  const projectId = getProjectId();
  if (!projectId) throw new Error('Firebase project ID unavailable');
  return `https://us-central1-${projectId}.cloudfunctions.net/todoistOAuthCallback`;
}

function getEncryptionKey(): Buffer {
  return createHash('sha256').update(todoistEncryptionKey.value()).digest();
}

function encryptString(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${authTag.toString('base64')}.${ciphertext.toString('base64')}`;
}

function decryptString(payload: string): string {
  const [ivB64, authTagB64, ciphertextB64] = payload.split('.');
  if (!ivB64 || !authTagB64 || !ciphertextB64) throw new Error('Invalid encrypted token payload');
  const decipher = createDecipheriv('aes-256-gcm', getEncryptionKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

function integrationDoc(uid: string) {
  return getDb().collection('users').doc(uid).collection('integrations').doc('todoist');
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoredTodoistIntegration {
  accessTokenEncrypted: string;
  todoistUserId: string;
  email: string;
  connectedAt: string;
  lastSyncedAt: string | null;
}

interface TodoistTask {
  id: string;
  content: string;
  description?: string;
  due?: { date: string } | null;
  is_completed: boolean;
  // v1 API uses camelCase
  project_id?: string;
  projectId?: string;
  labels?: string[];
  priority?: number;
}

interface TodoistProject {
  id: string;
  name: string;
  color?: string;
  is_inbox_project?: boolean;
  isInboxProject?: boolean; // v1 camelCase variant
}

// Helper: extract array from either plain array (v2) or paginated object (v1)
function extractList<T>(data: any): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && Array.isArray(data.results)) return data.results as T[];
  if (data && Array.isArray(data.items)) return data.items as T[];
  console.error('Unexpected Todoist response shape:', JSON.stringify(data).slice(0, 200));
  throw new HttpsError('internal', 'Unexpected response shape from Todoist API');
}

function taskProjectId(task: TodoistTask): string {
  return task.projectId || task.project_id || '';
}

async function getAccessToken(uid: string): Promise<string> {
  const snap = await integrationDoc(uid).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Todoist not connected');
  const data = snap.data() as StoredTodoistIntegration;
  return decryptString(data.accessTokenEncrypted);
}

async function todoistFetch(
  accessToken: string,
  path: string,
  options: RequestInit = {},
  baseUrl = 'https://api.todoist.com/api/v1'
): Promise<any> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => 'unknown');
    throw new HttpsError('internal', `Todoist API error ${res.status}: ${detail}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ─── 1. Get OAuth URL ─────────────────────────────────────────────────────────

export const todoistGetAuthUrl = onCall(
  { secrets: [todoistClientId, todoistEncryptionKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
    const uid = request.auth.uid;
    const origin = (request.data as { origin?: string })?.origin || '';

    // Store state + origin so callback can find uid and know where to postMessage
    const state = randomBytes(16).toString('hex');
    await getDb().collection('_todoistOAuthStates').doc(state).set({
      uid,
      origin,
      createdAt: new Date().toISOString(),
    });

    const params = new URLSearchParams({
      client_id: todoistClientId.value(),
      scope: 'data:read_write',
      state,
    });

    return {
      url: `https://todoist.com/oauth/authorize?${params.toString()}`,
    };
  }
);

// ─── 2. OAuth Callback — serves a self-closing HTML page ─────────────────────

function popupCloserHtml(success: boolean, origin: string, errorMsg = ''): string {
  const message = success
    ? JSON.stringify({ type: 'todoist_oauth', status: 'connected' })
    : JSON.stringify({ type: 'todoist_oauth', status: 'error', error: errorMsg });

  // Only postMessage to the known origin; fall back to '*' if origin is empty
  const targetOrigin = origin || '*';

  return `<!DOCTYPE html>
<html>
<head><title>Connecting Todoist…</title>
<style>
  body { font-family: system-ui, sans-serif; display: flex; align-items: center;
         justify-content: center; height: 100vh; margin: 0; background: #1a1a1a; color: #fff; }
  .box { text-align: center; }
  .icon { font-size: 2rem; margin-bottom: 0.5rem; }
  p { color: #aaa; font-size: 0.9rem; }
</style>
</head>
<body>
<div class="box">
  <div class="icon">${success ? '✅' : '❌'}</div>
  <p>${success ? 'Connected! Closing…' : 'Something went wrong. You can close this window.'}</p>
</div>
<script>
  try {
    if (window.opener) {
      window.opener.postMessage(${message}, ${JSON.stringify(targetOrigin)});
    }
  } catch(e) {}
  setTimeout(() => window.close(), 800);
</script>
</body>
</html>`;
}

export const todoistOAuthCallback = onRequest(
  { secrets: [todoistClientId, todoistClientSecret, todoistEncryptionKey] },
  async (req, res) => {
    const { code, state, error } = req.query as Record<string, string>;

    const sendHtml = (success: boolean, origin: string, errorMsg = '') => {
      res.setHeader('Content-Type', 'text/html');
      res.send(popupCloserHtml(success, origin, errorMsg));
    };

    if (error || !code || !state) {
      sendHtml(false, '', error || 'missing_params');
      return;
    }

    // Verify state and get uid + origin
    const stateDoc = getDb().collection('_todoistOAuthStates').doc(state);
    const stateSnap = await stateDoc.get();
    if (!stateSnap.exists) {
      sendHtml(false, '', 'invalid_state');
      return;
    }
    const { uid, origin: storedOrigin } = stateSnap.data() as { uid: string; origin: string };
    await stateDoc.delete();

    // Exchange code for access token
    const tokenRes = await fetch('https://todoist.com/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: todoistClientId.value(),
        client_secret: todoistClientSecret.value(),
        code,
        redirect_uri: getCallbackUrl(),
      }),
    });

    if (!tokenRes.ok) {
      sendHtml(false, storedOrigin, 'token_exchange_failed');
      return;
    }

    const { access_token } = await tokenRes.json() as { access_token: string; token_type: string };

    // Fetch Todoist user email via sync API
    const syncRes = await fetch('https://api.todoist.com/sync/v9/sync', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ sync_token: '*', resource_types: '["user"]' }),
    });
    let todoistEmail = '';
    let todoistUserId = '';
    if (syncRes.ok) {
      const syncData = await syncRes.json() as { user?: { id: number; email: string } };
      todoistEmail = syncData.user?.email || '';
      todoistUserId = String(syncData.user?.id || '');
    }

    const now = new Date().toISOString();
    await integrationDoc(uid).set({
      accessTokenEncrypted: encryptString(access_token),
      todoistUserId,
      email: todoistEmail,
      connectedAt: now,
      lastSyncedAt: null,
    } as StoredTodoistIntegration);

    sendHtml(true, storedOrigin);
  }
);

// ─── 3. List Todoist Projects (for project picker) ────────────────────────────

export const todoistListProjects = onCall(
  { secrets: [todoistEncryptionKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
    const uid = request.auth.uid;
    const accessToken = await getAccessToken(uid);

    // Fetch projects first — this must succeed
    const rawProjects = await todoistFetch(accessToken, '/projects');
    const projects = extractList<TodoistProject>(rawProjects);

    // Normalise inbox flag (v1 uses camelCase)
    const normalisedProjects = projects.map((p) => ({
      ...p,
      is_inbox_project: p.is_inbox_project || p.isInboxProject || false,
    }));

    // Fetch task counts separately — degrade gracefully if it fails
    let taskCountByProject: Record<string, number> = {};
    try {
      const rawTasks = await todoistFetch(accessToken, '/tasks');
      const allTasks = extractList<TodoistTask>(rawTasks);
      for (const task of allTasks) {
        const pid = taskProjectId(task);
        if (pid) taskCountByProject[pid] = (taskCountByProject[pid] || 0) + 1;
      }
    } catch {
      // Non-fatal — task counts just won't show
    }

    const projectsWithCount = normalisedProjects.map((p) => ({
      ...p,
      taskCount: taskCountByProject[p.id] ?? null,
    }));

    return { projects: projectsWithCount };
  }
);

// ─── 4. Sync Tasks (Todoist → Firestore) ─────────────────────────────────────

export const todoistSync = onCall(
  { secrets: [todoistEncryptionKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
    const uid = request.auth.uid;
    const { listId, projectId } = request.data as { listId: string; projectId: string };
    if (!listId || !projectId) throw new HttpsError('invalid-argument', 'listId and projectId required');

    const accessToken = await getAccessToken(uid);
    const db = getDb();

    // Fetch active tasks from the linked Todoist project
    const rawTasks = await todoistFetch(accessToken, `/tasks?project_id=${projectId}`);
    const tasks = extractList<TodoistTask>(rawTasks);

    // Fetch ALL existing Firestore items for this list (no projectId filter —
    // items created before the field existed would be missed and duplicated)
    const existingSnap = await db.collection('todo_items')
      .where('userId', '==', uid)
      .where('listId', '==', listId)
      .get();

    const existingByTodoistId = new Map<string, admin.firestore.QueryDocumentSnapshot>();
    // Extra copies of the same todoistId (from previous bad syncs) — will be deleted
    const duplicateDocs: admin.firestore.QueryDocumentSnapshot[] = [];
    for (const doc of existingSnap.docs) {
      const todoistId = doc.data().todoistId as string | undefined;
      if (!todoistId) continue; // not a Todoist-linked item — leave it alone
      if (existingByTodoistId.has(todoistId)) {
        duplicateDocs.push(doc); // mark extra copy for deletion
      } else {
        existingByTodoistId.set(todoistId, doc);
      }
    }

    const now = admin.firestore.Timestamp.now();
    const nowIso = now.toDate().toISOString();
    const batch = db.batch();
    const seenTodoistIds = new Set<string>();

    for (const task of tasks) {
      seenTodoistIds.add(task.id);
      const existing = existingByTodoistId.get(task.id);

      const payload = {
        text: task.content,
        description: task.description || '',
        completed: task.is_completed,
        deadline: task.due?.date || null,
        listId,
        userId: uid,
        todoistId: task.id,
        todoistProjectId: projectId,
        updatedAt: now, // Firestore Timestamp — consistent with client serverTimestamp()
      };

      if (existing) {
        batch.update(existing.ref, payload);
      } else {
        // Use a deterministic doc ID so concurrent syncs are idempotent:
        // two racing syncs writing to the same ID just overwrite each other → no duplicates.
        const deterministicId = `todoist_${uid}_${task.id}`;
        const newRef = db.collection('todo_items').doc(deterministicId);
        batch.set(newRef, {
          ...payload,
          createdAt: now, // Firestore Timestamp — MUST match type used by onSnapshot orderBy
          status: task.is_completed ? 'done' : 'todo',
          pinned: false,
        });
      }
    }

    // Delete Firestore items that no longer exist in Todoist
    for (const [todoistId, doc] of existingByTodoistId.entries()) {
      if (!seenTodoistIds.has(todoistId)) {
        batch.delete(doc.ref);
      }
    }

    // Delete duplicate Firestore docs for the same todoistId (from previous bad syncs)
    for (const doc of duplicateDocs) {
      batch.delete(doc.ref);
    }

    await batch.commit();

    // Update lastSyncedAt on the integration doc + the list doc
    await integrationDoc(uid).update({ lastSyncedAt: nowIso });
    await db.collection('todo_lists').doc(listId).update({
      lastTodoistSync: nowIso,
      todoistProjectId: projectId,
    });

    return { synced: tasks.length, deletedFromLocal: existingByTodoistId.size - seenTodoistIds.size };
  }
);

// ─── 5. Push Action (Malleabite → Todoist) ───────────────────────────────────

type PushAction =
  | { type: 'create'; listId: string; projectId: string; text: string; description?: string; deadline?: string }
  | { type: 'update'; todoistId: string; text?: string; description?: string; deadline?: string | null }
  | { type: 'complete'; todoistId: string }
  | { type: 'uncomplete'; todoistId: string }
  | { type: 'delete'; todoistId: string };

export const todoistPushAction = onCall(
  { secrets: [todoistEncryptionKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
    const uid = request.auth.uid;
    const action = request.data as PushAction;
    const accessToken = await getAccessToken(uid);

    switch (action.type) {
      case 'create': {
        // Use REST v2 for task creation — it correctly assigns project_id.
        // The /api/v1 endpoint ignores project_id on POST and sends tasks to Inbox.
        const body: Record<string, any> = {
          content: action.text,
          project_id: action.projectId,
        };
        if (action.description) body.description = action.description;
        if (action.deadline) body.due_date = action.deadline;

        console.log('[pushAction:create] body sent to REST v2:', JSON.stringify(body));
        const created = await todoistFetch(accessToken, '/tasks', {
          method: 'POST',
          body: JSON.stringify(body),
        }, 'https://api.todoist.com/rest/v2') as TodoistTask;
        console.log('[pushAction:create] Todoist response:', JSON.stringify(created));

        // Write back to Firestore with deterministic ID (same scheme as todoistSync)
        // so a concurrent auto-sync won't create a second copy for the same task.
        const ts = admin.firestore.Timestamp.now();
        const deterministicId = `todoist_${uid}_${created.id}`;
        await getDb().collection('todo_items').doc(deterministicId).set({
          text: action.text,
          description: action.description || '',
          completed: false,
          listId: action.listId,
          userId: uid,
          todoistId: created.id,
          todoistProjectId: action.projectId,
          _debug_sentProjectId: action.projectId,
          _debug_returnedProjectId: created.project_id || (created as any).projectId || null,
          deadline: action.deadline || null,
          createdAt: ts,
          updatedAt: ts,
          status: 'todo',
          pinned: false,
        });

        return { todoistId: created.id };
      }

      case 'update': {
        const body: Record<string, any> = {};
        if (action.text !== undefined) body.content = action.text;
        if (action.description !== undefined) body.description = action.description;
        if (action.deadline !== undefined) body.dueDate = action.deadline || null; // v1 camelCase

        await todoistFetch(accessToken, `/tasks/${action.todoistId}`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        return { ok: true };
      }

      case 'complete': {
        await todoistFetch(accessToken, `/tasks/${action.todoistId}/close`, { method: 'POST' });
        return { ok: true };
      }

      case 'uncomplete': {
        await todoistFetch(accessToken, `/tasks/${action.todoistId}/reopen`, { method: 'POST' });
        return { ok: true };
      }

      case 'delete': {
        await todoistFetch(accessToken, `/tasks/${action.todoistId}`, { method: 'DELETE' });
        return { ok: true };
      }

      default:
        throw new HttpsError('invalid-argument', 'Unknown action type');
    }
  }
);

// ─── 6. Disconnect ────────────────────────────────────────────────────────────

export const todoistDisconnect = onCall(
  { secrets: [todoistEncryptionKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
    const uid = request.auth.uid;
    await integrationDoc(uid).delete();
    return { ok: true };
  }
);

// ─── 7. Get connection status ─────────────────────────────────────────────────

export const todoistGetStatus = onCall(
  {},
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
    const uid = request.auth.uid;
    const snap = await integrationDoc(uid).get();
    if (!snap.exists) return { connected: false };
    const data = snap.data() as StoredTodoistIntegration;
    return {
      connected: true,
      email: data.email,
      connectedAt: data.connectedAt,
      lastSyncedAt: data.lastSyncedAt,
    };
  }
);
