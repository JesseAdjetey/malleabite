/**
 * Microsoft OAuth + Sync Firebase Functions
 *
 * Covers:
 *   - Microsoft To Do  (Tasks.ReadWrite + Tasks.ReadWrite.Shared)
 *   - Outlook Calendar (Calendars.ReadWrite + Calendars.ReadWrite.Shared) — read-only display
 *
 * Architecture:
 *   - Tokens stored encrypted in users/{uid}/integrations/microsoft
 *   - Refresh tokens kept; access tokens auto-refreshed 5 min before expiry
 *   - MS To Do is source of truth (external wins on sync)
 *   - Bi-directional for tasks: all write actions proxied here
 *   - Calendar: read-only (pull Outlook events into calendar_events collection)
 */

import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';

// ─── Secrets ──────────────────────────────────────────────────────────────────

const msClientId     = defineSecret('MICROSOFT_CLIENT_ID');
const msClientSecret = defineSecret('MICROSOFT_CLIENT_SECRET');
const msEncryptionKey = defineSecret('MICROSOFT_TOKEN_ENCRYPTION_KEY');

// ─── Scopes ───────────────────────────────────────────────────────────────────

const MS_SCOPES = [
  'openid',
  'email',
  'profile',
  'offline_access',
  'User.Read',
  'MailboxSettings.Read',
  'Tasks.ReadWrite',
  'Tasks.ReadWrite.Shared',
  'Calendars.ReadWrite',
  'Calendars.ReadWrite.Shared',
].join(' ');

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
  return `https://us-central1-${projectId}.cloudfunctions.net/microsoftOAuthCallback`;
}

function getEncryptionKey(): Buffer {
  return createHash('sha256').update(msEncryptionKey.value()).digest();
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
  return getDb().collection('users').doc(uid).collection('integrations').doc('microsoft');
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoredMicrosoftIntegration {
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string;
  accessTokenExpiresAt: string;
  microsoftUserId: string;
  email: string;
  displayName: string;
  connectedAt: string;
  lastTaskSyncAt: string | null;
  lastCalendarSyncAt: string | null;
  tokenStatus: 'active' | 'needs_reauth';
}

interface MsTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

interface MsUserInfo {
  id: string;
  mail?: string;
  userPrincipalName?: string;
  displayName?: string;
}

interface MsTaskList {
  id: string;
  displayName: string;
  isOwner?: boolean;
  isShared?: boolean;
  wellknownListName?: string;
}

interface MsTask {
  id: string;
  title: string;
  body?: { content?: string; contentType?: string };
  dueDateTime?: { dateTime: string; timeZone: string } | null;
  status: 'notStarted' | 'inProgress' | 'completed' | 'waitingOnOthers' | 'deferred';
  importance?: 'low' | 'normal' | 'high';
  lastModifiedDateTime?: string;
  createdDateTime?: string;
}

interface MsCalendar {
  id: string;
  name: string;
  color?: string;
  isDefaultCalendar?: boolean;
  canEdit?: boolean;
}

interface MsCalendarEvent {
  id: string;
  subject: string;
  body?: { content?: string; contentType?: string };
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isAllDay?: boolean;
  location?: { displayName?: string };
  organizer?: { emailAddress?: { name?: string; address?: string } };
  webLink?: string;
  isCancelled?: boolean;
}

// ─── Token helpers ────────────────────────────────────────────────────────────

async function exchangeCodeForTokens(code: string): Promise<MsTokenResponse> {
  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: msClientId.value(),
      client_secret: msClientSecret.value(),
      code,
      redirect_uri: getCallbackUrl(),
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => 'unknown');
    throw new Error(`MS token exchange failed: ${detail}`);
  }
  return res.json() as Promise<MsTokenResponse>;
}

async function refreshAccessToken(uid: string): Promise<{ accessToken: string; integration: StoredMicrosoftIntegration }> {
  const snap = await integrationDoc(uid).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Microsoft not connected');
  const integration = snap.data() as StoredMicrosoftIntegration;

  const refreshToken = decryptString(integration.refreshTokenEncrypted);
  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: msClientId.value(),
      client_secret: msClientSecret.value(),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: MS_SCOPES,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => 'unknown');
    const tokenStatus = detail.includes('invalid_grant') ? 'needs_reauth' : integration.tokenStatus;
    await integrationDoc(uid).update({ tokenStatus, updatedAt: new Date().toISOString() });
    throw new HttpsError('failed-precondition', `MS token refresh failed: ${detail}`);
  }

  const tokens = await res.json() as MsTokenResponse;
  const now = new Date().toISOString();
  const updated: Partial<StoredMicrosoftIntegration> = {
    accessTokenEncrypted: encryptString(tokens.access_token),
    accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    tokenStatus: 'active',
  };
  if (tokens.refresh_token) {
    updated.refreshTokenEncrypted = encryptString(tokens.refresh_token);
  }
  await integrationDoc(uid).update({ ...updated, updatedAt: now });

  return {
    accessToken: tokens.access_token,
    integration: { ...integration, ...updated } as StoredMicrosoftIntegration,
  };
}

async function getValidAccessToken(uid: string): Promise<string> {
  const snap = await integrationDoc(uid).get();
  if (!snap.exists) throw new HttpsError('not-found', 'Microsoft not connected');
  const integration = snap.data() as StoredMicrosoftIntegration;

  if (integration.tokenStatus === 'needs_reauth') {
    throw new HttpsError('failed-precondition', 'Microsoft account needs reconnection');
  }

  // Refresh if expiring within 5 minutes
  const expiresSoon = Date.now() >= (new Date(integration.accessTokenExpiresAt).getTime() - 5 * 60 * 1000);
  if (expiresSoon) {
    const { accessToken } = await refreshAccessToken(uid);
    return accessToken;
  }

  return decryptString(integration.accessTokenEncrypted);
}

// ─── MS Graph fetch helper ────────────────────────────────────────────────────

async function graphFetch(
  accessToken: string,
  path: string,
  options: RequestInit = {}
): Promise<any> {
  const url = path.startsWith('http') ? path : `https://graph.microsoft.com/v1.0${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => 'unknown');
    throw new HttpsError('internal', `MS Graph error ${res.status}: ${detail}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Handles @odata.nextLink pagination — returns all items across pages
async function graphFetchAll<T>(accessToken: string, initialPath: string): Promise<T[]> {
  const items: T[] = [];
  let url: string | null = initialPath.startsWith('http')
    ? initialPath
    : `https://graph.microsoft.com/v1.0${initialPath}`;

  while (url) {
    const data = await graphFetch(accessToken, url);
    if (data?.value && Array.isArray(data.value)) {
      items.push(...(data.value as T[]));
    }
    url = data?.['@odata.nextLink'] || null;
  }
  return items;
}

// ─── Popup closer HTML ────────────────────────────────────────────────────────

function popupCloserHtml(success: boolean, origin: string, errorMsg = ''): string {
  const message = success
    ? JSON.stringify({ type: 'microsoft_oauth', status: 'connected' })
    : JSON.stringify({ type: 'microsoft_oauth', status: 'error', error: errorMsg });
  const targetOrigin = origin || '*';
  return `<!DOCTYPE html>
<html>
<head><title>Connecting Microsoft…</title>
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
  <p>${success ? 'Microsoft connected! Closing…' : 'Something went wrong. You can close this window.'}</p>
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

// ─── 1. Get OAuth URL ─────────────────────────────────────────────────────────

export const microsoftGetAuthUrl = onCall(
  { region: 'us-central1', secrets: [msClientId, msEncryptionKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
    const uid = request.auth.uid;
    const origin = (request.data as { origin?: string })?.origin || '';

    const state = randomBytes(16).toString('hex');
    await getDb().collection('_microsoftOAuthStates').doc(state).set({
      uid,
      origin,
      createdAt: new Date().toISOString(),
    });

    const params = new URLSearchParams({
      client_id: msClientId.value(),
      response_type: 'code',
      redirect_uri: getCallbackUrl(),
      scope: MS_SCOPES,
      response_mode: 'query',
      state,
      prompt: 'select_account',
    });

    return {
      url: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`,
    };
  }
);

// ─── 2. OAuth Callback ────────────────────────────────────────────────────────

export const microsoftOAuthCallback = onRequest(
  { region: 'us-central1', secrets: [msClientId, msClientSecret, msEncryptionKey] },
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

    const stateRef = getDb().collection('_microsoftOAuthStates').doc(state);
    const stateSnap = await stateRef.get();
    if (!stateSnap.exists) {
      sendHtml(false, '', 'invalid_state');
      return;
    }
    const { uid, origin: storedOrigin } = stateSnap.data() as { uid: string; origin: string };
    await stateRef.delete();

    try {
      const tokens = await exchangeCodeForTokens(code);
      if (!tokens.refresh_token) {
        sendHtml(false, storedOrigin, 'no_refresh_token');
        return;
      }

      // Fetch user info from Graph
      const userInfo = await graphFetch(tokens.access_token, '/me') as MsUserInfo;
      const email = userInfo.mail || userInfo.userPrincipalName || '';
      const displayName = userInfo.displayName || email;

      const now = new Date().toISOString();
      await integrationDoc(uid).set({
        accessTokenEncrypted: encryptString(tokens.access_token),
        refreshTokenEncrypted: encryptString(tokens.refresh_token),
        accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        microsoftUserId: userInfo.id,
        email,
        displayName,
        connectedAt: now,
        lastTaskSyncAt: null,
        lastCalendarSyncAt: null,
        tokenStatus: 'active',
      } as StoredMicrosoftIntegration);

      sendHtml(true, storedOrigin);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      sendHtml(false, storedOrigin, msg);
    }
  }
);

// ─── 3. Get connection status ─────────────────────────────────────────────────

export const microsoftGetStatus = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
    const snap = await integrationDoc(request.auth.uid).get();
    if (!snap.exists) return { connected: false };
    const data = snap.data() as StoredMicrosoftIntegration;
    return {
      connected: true,
      email: data.email,
      displayName: data.displayName,
      connectedAt: data.connectedAt,
      lastTaskSyncAt: data.lastTaskSyncAt,
      lastCalendarSyncAt: data.lastCalendarSyncAt,
      tokenStatus: data.tokenStatus,
    };
  }
);

// ─── 4. List MS To Do task lists ──────────────────────────────────────────────

export const microsoftListTaskLists = onCall(
  { region: 'us-central1', secrets: [msClientId, msClientSecret, msEncryptionKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
    const uid = request.auth.uid;
    const accessToken = await getValidAccessToken(uid);

    const lists = await graphFetchAll<MsTaskList>(accessToken, '/me/todo/lists');

    // Fetch task count per list — degrade gracefully
    const listsWithCount = await Promise.all(
      lists.map(async (list) => {
        try {
          const tasks = await graphFetchAll<MsTask>(accessToken, `/me/todo/lists/${list.id}/tasks?$filter=status ne 'completed'`);
          return { ...list, taskCount: tasks.length };
        } catch {
          return { ...list, taskCount: null };
        }
      })
    );

    return { lists: listsWithCount };
  }
);

// ─── 5. Sync Tasks (MS To Do → Firestore) ────────────────────────────────────

export const microsoftSyncTasks = onCall(
  { region: 'us-central1', secrets: [msClientId, msClientSecret, msEncryptionKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
    const uid = request.auth.uid;
    const { listId, msListId } = request.data as { listId: string; msListId: string };
    if (!listId || !msListId) throw new HttpsError('invalid-argument', 'listId and msListId required');

    const accessToken = await getValidAccessToken(uid);
    const db = getDb();

    // Fetch ALL tasks (including completed) from this MS To Do list
    const tasks = await graphFetchAll<MsTask>(accessToken, `/me/todo/lists/${msListId}/tasks`);

    // Fetch existing Firestore items linked to this MS list
    const existingSnap = await db.collection('todo_items')
      .where('userId', '==', uid)
      .where('listId', '==', listId)
      .get();

    const existingByMsId = new Map<string, admin.firestore.QueryDocumentSnapshot>();
    const duplicateDocs: admin.firestore.QueryDocumentSnapshot[] = [];
    for (const docSnap of existingSnap.docs) {
      const msTaskId = docSnap.data().msTaskId as string | undefined;
      if (!msTaskId) continue; // not MS-linked — leave alone
      if (existingByMsId.has(msTaskId)) {
        duplicateDocs.push(docSnap);
      } else {
        existingByMsId.set(msTaskId, docSnap);
      }
    }

    const now = admin.firestore.Timestamp.now();
    const nowIso = now.toDate().toISOString();
    const batch = db.batch();
    const seenMsIds = new Set<string>();

    for (const task of tasks) {
      seenMsIds.add(task.id);
      const existing = existingByMsId.get(task.id);
      const isCompleted = task.status === 'completed';

      // Extract due date — MS returns ISO dateTime, we store YYYY-MM-DD
      let deadline: string | null = null;
      if (task.dueDateTime?.dateTime) {
        deadline = task.dueDateTime.dateTime.split('T')[0];
      }

      const payload = {
        text: task.title,
        description: task.body?.content || '',
        completed: isCompleted,
        deadline,
        listId,
        userId: uid,
        msTaskId: task.id,
        msListId,
        updatedAt: now,
      };

      if (existing) {
        batch.update(existing.ref, payload);
      } else {
        const deterministicId = `ms_${uid}_${task.id}`;
        const newRef = db.collection('todo_items').doc(deterministicId);
        batch.set(newRef, {
          ...payload,
          createdAt: now,
          status: isCompleted ? 'done' : 'todo',
          pinned: false,
        });
      }
    }

    // Delete Firestore items no longer in MS To Do
    for (const [msTaskId, docSnap] of existingByMsId.entries()) {
      if (!seenMsIds.has(msTaskId)) {
        batch.delete(docSnap.ref);
      }
    }
    for (const docSnap of duplicateDocs) {
      batch.delete(docSnap.ref);
    }

    await batch.commit();

    // Update sync timestamps
    await integrationDoc(uid).update({ lastTaskSyncAt: nowIso });
    await db.collection('todo_lists').doc(listId).update({
      lastMicrosoftSync: nowIso,
      msListId,
    });

    return {
      synced: tasks.length,
      deletedFromLocal: existingByMsId.size - seenMsIds.size,
    };
  }
);

// ─── 6. Push Task Action (Malleabite → MS To Do) ─────────────────────────────

type MsTaskPushAction =
  | { type: 'create'; listId: string; msListId: string; text: string; description?: string; deadline?: string }
  | { type: 'update'; msTaskId: string; msListId: string; text?: string; description?: string; deadline?: string | null }
  | { type: 'complete'; msTaskId: string; msListId: string }
  | { type: 'uncomplete'; msTaskId: string; msListId: string }
  | { type: 'delete'; msTaskId: string; msListId: string };

export const microsoftPushTaskAction = onCall(
  { region: 'us-central1', secrets: [msClientId, msClientSecret, msEncryptionKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
    const uid = request.auth.uid;
    const action = request.data as MsTaskPushAction;
    const accessToken = await getValidAccessToken(uid);
    const db = getDb();

    switch (action.type) {
      case 'create': {
        const body: Record<string, any> = { title: action.text };
        if (action.description) {
          body.body = { content: action.description, contentType: 'text' };
        }
        if (action.deadline) {
          body.dueDateTime = { dateTime: `${action.deadline}T00:00:00`, timeZone: 'UTC' };
        }

        const created = await graphFetch(accessToken, `/me/todo/lists/${action.msListId}/tasks`, {
          method: 'POST',
          body: JSON.stringify(body),
        }) as MsTask;

        // Write to Firestore immediately with deterministic ID
        const ts = admin.firestore.Timestamp.now();
        const deterministicId = `ms_${uid}_${created.id}`;
        await db.collection('todo_items').doc(deterministicId).set({
          text: action.text,
          description: action.description || '',
          completed: false,
          listId: action.listId,
          userId: uid,
          msTaskId: created.id,
          msListId: action.msListId,
          deadline: action.deadline || null,
          createdAt: ts,
          updatedAt: ts,
          status: 'todo',
          pinned: false,
        });

        return { msTaskId: created.id };
      }

      case 'update': {
        const body: Record<string, any> = {};
        if (action.text !== undefined) body.title = action.text;
        if (action.description !== undefined) {
          body.body = { content: action.description, contentType: 'text' };
        }
        if (action.deadline !== undefined) {
          body.dueDateTime = action.deadline
            ? { dateTime: `${action.deadline}T00:00:00`, timeZone: 'UTC' }
            : null;
        }
        await graphFetch(accessToken, `/me/todo/lists/${action.msListId}/tasks/${action.msTaskId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        return { ok: true };
      }

      case 'complete': {
        await graphFetch(accessToken, `/me/todo/lists/${action.msListId}/tasks/${action.msTaskId}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'completed' }),
        });
        return { ok: true };
      }

      case 'uncomplete': {
        await graphFetch(accessToken, `/me/todo/lists/${action.msListId}/tasks/${action.msTaskId}`, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'notStarted' }),
        });
        return { ok: true };
      }

      case 'delete': {
        await graphFetch(accessToken, `/me/todo/lists/${action.msListId}/tasks/${action.msTaskId}`, {
          method: 'DELETE',
        });
        return { ok: true };
      }

      default:
        throw new HttpsError('invalid-argument', 'Unknown action type');
    }
  }
);

// ─── 7. List Outlook Calendars ────────────────────────────────────────────────

export const microsoftListCalendars = onCall(
  { region: 'us-central1', secrets: [msClientId, msClientSecret, msEncryptionKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
    const uid = request.auth.uid;
    const accessToken = await getValidAccessToken(uid);

    const calendars = await graphFetchAll<MsCalendar>(accessToken, '/me/calendars');
    return { calendars };
  }
);

// ─── 8. Sync Outlook Calendar Events (read-only) ──────────────────────────────

export const microsoftSyncCalendarEvents = onCall(
  { region: 'us-central1', secrets: [msClientId, msClientSecret, msEncryptionKey] },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
    const uid = request.auth.uid;
    const { msCalendarId, windowDays = 60 } = request.data as {
      msCalendarId: string;
      windowDays?: number;
    };
    if (!msCalendarId) throw new HttpsError('invalid-argument', 'msCalendarId required');

    const accessToken = await getValidAccessToken(uid);
    const db = getDb();

    // Fetch events in a rolling window: 7 days ago → windowDays ahead
    const startDt = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const endDt = new Date(Date.now() + windowDays * 24 * 60 * 60 * 1000).toISOString();

    const events = await graphFetchAll<MsCalendarEvent>(
      accessToken,
      `/me/calendars/${msCalendarId}/calendarView?startDateTime=${startDt}&endDateTime=${endDt}&$select=id,subject,body,start,end,isAllDay,location,organizer,webLink,isCancelled`
    );

    const now = admin.firestore.Timestamp.now();
    const nowIso = now.toDate().toISOString();
    const batch = db.batch();

    // Fetch existing MS-sourced events for this user
    const existingSnap = await db.collection('calendar_events')
      .where('userId', '==', uid)
      .where('source', '==', 'microsoft')
      .where('msCalendarId', '==', msCalendarId)
      .get();

    const existingByMsEventId = new Map<string, admin.firestore.QueryDocumentSnapshot>();
    for (const docSnap of existingSnap.docs) {
      const msEventId = docSnap.data().msEventId as string | undefined;
      if (msEventId) existingByMsEventId.set(msEventId, docSnap);
    }

    const seenIds = new Set<string>();

    for (const event of events) {
      if (event.isCancelled) continue;
      seenIds.add(event.id);

      const payload = {
        title: event.subject,
        description: event.body?.content || '',
        startDate: event.start.dateTime,
        endDate: event.end.dateTime,
        isAllDay: event.isAllDay || false,
        location: event.location?.displayName || '',
        organizerName: event.organizer?.emailAddress?.name || '',
        organizerEmail: event.organizer?.emailAddress?.address || '',
        webLink: event.webLink || '',
        source: 'microsoft',
        msEventId: event.id,
        msCalendarId,
        userId: uid,
        updatedAt: now,
      };

      const existing = existingByMsEventId.get(event.id);
      if (existing) {
        batch.update(existing.ref, payload);
      } else {
        const deterministicId = `ms_cal_${uid}_${event.id}`;
        batch.set(db.collection('calendar_events').doc(deterministicId), {
          ...payload,
          createdAt: now,
        });
      }
    }

    // Remove events no longer in the window
    for (const [msEventId, docSnap] of existingByMsEventId.entries()) {
      if (!seenIds.has(msEventId)) {
        batch.delete(docSnap.ref);
      }
    }

    await batch.commit();
    await integrationDoc(uid).update({ lastCalendarSyncAt: nowIso });

    return { synced: seenIds.size };
  }
);

// ─── 9. Disconnect ────────────────────────────────────────────────────────────

export const microsoftDisconnect = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
    await integrationDoc(request.auth.uid).delete();
    return { ok: true };
  }
);
