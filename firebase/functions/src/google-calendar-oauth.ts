import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';

const googleClientId = defineSecret('GOOGLE_CLIENT_ID');
const googleClientSecret = defineSecret('GOOGLE_CLIENT_SECRET');
const googleTokenEncryptionKey = defineSecret('GOOGLE_TOKEN_ENCRYPTION_KEY');

function getGoogleClientIdValue(): string {
  return googleClientId.value().trim();
}

function getGoogleClientSecretValue(): string {
  return googleClientSecret.value().trim();
}

const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

const OAUTH_STATE_COLLECTION = '_googleOAuthStates';

interface GoogleOAuthState {
  uid: string;
  origin: string;
  createdAt: string;
  loginHint?: string;
}

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

interface StoredGoogleAccount {
  googleAccountId: string;
  googleSubject: string;
  email: string;
  displayName: string;
  pictureUrl?: string;
  scopes: string[];
  accessTokenEncrypted: string;
  refreshTokenEncrypted?: string;
  accessTokenExpiresAt: string;
  tokenStatus: 'active' | 'needs_reauth' | 'revoked';
  lastRefreshAt: string;
  lastRefreshError?: string;
  createdAt: string;
  updatedAt: string;
}

interface GoogleCalendarListItem {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
}

function getDb(): admin.firestore.Firestore {
  return admin.firestore();
}

function getProjectId(): string {
  return process.env.GCLOUD_PROJECT || admin.app().options.projectId || '';
}

function getCallbackUrl(): string {
  const projectId = getProjectId();
  if (!projectId) {
    throw new Error('Firebase project ID is unavailable for Google OAuth callback');
  }
  return `https://us-central1-${projectId}.cloudfunctions.net/googleCalendarOAuthCallback`;
}

function accountDoc(uid: string, googleAccountId: string) {
  return getDb().collection('users').doc(uid).collection('googleAccounts').doc(googleAccountId);
}

function stateDoc(state: string) {
  return getDb().collection(OAUTH_STATE_COLLECTION).doc(state);
}

function getEncryptionKey(): Buffer {
  return createHash('sha256').update(googleTokenEncryptionKey.value()).digest();
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
  if (!ivB64 || !authTagB64 || !ciphertextB64) {
    throw new Error('Invalid encrypted token payload');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivB64, 'base64')
  );
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ]);
  return plaintext.toString('utf8');
}

async function exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: getGoogleClientIdValue(),
      client_secret: getGoogleClientSecretValue(),
      redirect_uri: getCallbackUrl(),
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => 'unknown error');
    throw new Error(`Failed to exchange Google auth code: ${detail}`);
  }

  return response.json() as Promise<GoogleTokenResponse>;
}

async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => 'unknown error');
    throw new Error(`Failed to fetch Google user info: ${detail}`);
  }

  return response.json() as Promise<GoogleUserInfo>;
}

async function saveGoogleAccount(params: {
  uid: string;
  userInfo: GoogleUserInfo;
  tokens: GoogleTokenResponse;
}): Promise<StoredGoogleAccount> {
  const { uid, userInfo, tokens } = params;
  const googleAccountId = userInfo.sub;
  const now = new Date().toISOString();
  const ref = accountDoc(uid, googleAccountId);
  const existing = await ref.get();
  const existingData = existing.exists ? (existing.data() as StoredGoogleAccount) : undefined;

  const payload: StoredGoogleAccount = {
    googleAccountId,
    googleSubject: userInfo.sub,
    email: userInfo.email,
    displayName: userInfo.name || userInfo.email,
    pictureUrl: userInfo.picture,
    scopes: (tokens.scope || GOOGLE_SCOPES).split(' ').filter(Boolean),
    accessTokenEncrypted: encryptString(tokens.access_token),
    refreshTokenEncrypted: tokens.refresh_token
      ? encryptString(tokens.refresh_token)
      : existingData?.refreshTokenEncrypted,
    accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    tokenStatus: 'active',
    lastRefreshAt: now,
    lastRefreshError: '',
    createdAt: existingData?.createdAt || now,
    updatedAt: now,
  };

  await ref.set(payload, { merge: true });
  return payload;
}

async function refreshGoogleAccessToken(uid: string, googleAccountId: string): Promise<{ account: StoredGoogleAccount; accessToken: string; expiresIn: number }> {
  const ref = accountDoc(uid, googleAccountId);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error(`Google account ${googleAccountId} not found`);
  }

  const account = snapshot.data() as StoredGoogleAccount;
  if (!account.refreshTokenEncrypted) {
    await ref.set({ tokenStatus: 'needs_reauth', lastRefreshError: 'Missing refresh token', updatedAt: new Date().toISOString() }, { merge: true });
    throw new Error('Google account requires reconnection');
  }

  const refreshToken = decryptString(account.refreshTokenEncrypted);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: getGoogleClientIdValue(),
      client_secret: getGoogleClientSecretValue(),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => 'unknown error');
    const now = new Date().toISOString();
    const tokenStatus = detail.includes('invalid_grant') ? 'needs_reauth' : account.tokenStatus;
    await ref.set({ lastRefreshError: detail, tokenStatus, updatedAt: now }, { merge: true });
    throw new Error(`Failed to refresh Google access token: ${detail}`);
  }

  const tokens = await response.json() as GoogleTokenResponse;
  const now = new Date().toISOString();
  const updatedAccount: StoredGoogleAccount = {
    ...account,
    accessTokenEncrypted: encryptString(tokens.access_token),
    accessTokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    tokenStatus: 'active',
    lastRefreshAt: now,
    lastRefreshError: '',
    updatedAt: now,
  };
  await ref.set(updatedAccount, { merge: true });

  return {
    account: updatedAccount,
    accessToken: tokens.access_token,
    expiresIn: tokens.expires_in,
  };
}

export async function getValidAccessToken(uid: string, googleAccountId: string): Promise<{ account: StoredGoogleAccount; accessToken: string; expiresIn: number }> {
  const snapshot = await accountDoc(uid, googleAccountId).get();
  if (!snapshot.exists) {
    throw new Error(`Google account ${googleAccountId} not found`);
  }

  const account = snapshot.data() as StoredGoogleAccount;
  const expiresSoon = Date.now() >= (new Date(account.accessTokenExpiresAt).getTime() - 5 * 60 * 1000);
  if (!expiresSoon) {
    const expiresIn = Math.max(60, Math.floor((new Date(account.accessTokenExpiresAt).getTime() - Date.now()) / 1000));
    return {
      account,
      accessToken: decryptString(account.accessTokenEncrypted),
      expiresIn,
    };
  }

  return refreshGoogleAccessToken(uid, googleAccountId);
}

async function fetchGoogleCalendars(accessToken: string): Promise<GoogleCalendarListItem[]> {
  const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => 'unknown error');
    throw new Error(`Failed to fetch Google calendars: ${detail}`);
  }

  const data = await response.json() as { items?: GoogleCalendarListItem[] };
  return data.items || [];
}

function renderCallbackPage(origin: string, payload: Record<string, unknown>): string {
  const json = JSON.stringify(payload).replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Google Calendar Connection</title>
    <style>
      body { font-family: system-ui, sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; background:#0b1020; color:#f8fafc; }
      .card { text-align:center; padding:24px; max-width:420px; }
    </style>
  </head>
  <body>
    <div class="card">
      <p id="status">Finishing Google Calendar connection...</p>
    </div>
    <script>
      const payload = ${json};
      try {
        if (window.opener) {
          window.opener.postMessage(payload, ${JSON.stringify(origin)});
        }
      } catch (err) {
        console.error('Failed to notify opener', err);
      }
      const status = document.getElementById('status');
      if (status) {
        status.textContent = payload.type === 'success'
          ? 'Google Calendar connected. You can close this window.'
          : 'Google Calendar connection failed. You can close this window.';
      }
      setTimeout(() => window.close(), 1200);
    </script>
  </body>
</html>`;
}

export const getGoogleCalendarAuthUrl = onCall(
  {
    region: 'us-central1',
    secrets: [googleClientId],
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'You must be signed in to connect Google Calendar.');
    }

    const origin = typeof request.data?.origin === 'string' ? request.data.origin : '';
    const loginHint = typeof request.data?.loginHint === 'string' ? request.data.loginHint : undefined;
    if (!origin) {
      throw new HttpsError('invalid-argument', 'Missing origin for Google OAuth flow.');
    }

    const state = randomBytes(24).toString('hex');
    const statePayload: GoogleOAuthState = {
      uid: request.auth.uid,
      origin,
      createdAt: new Date().toISOString(),
      loginHint,
    };
    await stateDoc(state).set(statePayload);

    const params = new URLSearchParams({
      client_id: getGoogleClientIdValue(),
      redirect_uri: getCallbackUrl(),
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      scope: GOOGLE_SCOPES,
      state,
    });
    if (loginHint) {
      params.set('login_hint', loginHint);
    }

    return {
      authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      callbackUrl: getCallbackUrl(),
      state,
    };
  }
);

export const googleCalendarOAuthCallback = onRequest(
  {
    region: 'us-central1',
    secrets: [googleClientId, googleClientSecret, googleTokenEncryptionKey],
  },
  async (req, res) => {
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const oauthError = typeof req.query.error === 'string' ? req.query.error : '';

    const snapshot = state ? await stateDoc(state).get() : null;
    const stateData = snapshot?.exists ? (snapshot.data() as GoogleOAuthState) : null;
    const origin = stateData?.origin || '*';

    if (!stateData) {
      res.status(400).send(renderCallbackPage(origin, {
        source: 'malleabite-google-oauth',
        type: 'error',
        error: 'Invalid or expired Google OAuth state.',
      }));
      return;
    }

    await stateDoc(state).delete().catch(() => undefined);

    if (oauthError) {
      res.status(400).send(renderCallbackPage(origin, {
        source: 'malleabite-google-oauth',
        type: 'error',
        error: oauthError,
      }));
      return;
    }

    if (!code) {
      res.status(400).send(renderCallbackPage(origin, {
        source: 'malleabite-google-oauth',
        type: 'error',
        error: 'Google did not return an authorization code.',
      }));
      return;
    }

    try {
      const tokens = await exchangeCodeForTokens(code);
      const userInfo = await fetchGoogleUserInfo(tokens.access_token);
      const account = await saveGoogleAccount({
        uid: stateData.uid,
        userInfo,
        tokens,
      });

      res.status(200).send(renderCallbackPage(origin, {
        source: 'malleabite-google-oauth',
        type: 'success',
        accessToken: tokens.access_token,
        expiresIn: tokens.expires_in,
        email: account.email,
        googleAccountId: account.googleAccountId,
        displayName: account.displayName,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Google OAuth error';
      res.status(500).send(renderCallbackPage(origin, {
        source: 'malleabite-google-oauth',
        type: 'error',
        error: message,
      }));
    }
  }
);

export const refreshGoogleCalendarAccessToken = onCall(
  {
    region: 'us-central1',
    secrets: [googleClientId, googleClientSecret, googleTokenEncryptionKey],
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'You must be signed in to refresh Google Calendar access.');
    }

    const googleAccountId = typeof request.data?.googleAccountId === 'string' ? request.data.googleAccountId : '';
    if (!googleAccountId) {
      throw new HttpsError('invalid-argument', 'Missing googleAccountId for token refresh.');
    }

    try {
      const refreshed = await refreshGoogleAccessToken(request.auth.uid, googleAccountId);
      return {
        googleAccountId,
        email: refreshed.account.email,
        accessToken: refreshed.accessToken,
        expiresIn: refreshed.expiresIn,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to refresh Google access token';
      throw new HttpsError('failed-precondition', message);
    }
  }
);

export const listGoogleCalendarsForAccount = onCall(
  {
    region: 'us-central1',
    secrets: [googleClientId, googleClientSecret, googleTokenEncryptionKey],
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'You must be signed in to list Google calendars.');
    }

    const googleAccountId = typeof request.data?.googleAccountId === 'string' ? request.data.googleAccountId : '';
    if (!googleAccountId) {
      throw new HttpsError('invalid-argument', 'Missing googleAccountId for Google calendar listing.');
    }

    try {
      const valid = await getValidAccessToken(request.auth.uid, googleAccountId);
      const calendars = await fetchGoogleCalendars(valid.accessToken);
      return {
        googleAccountId,
        email: valid.account.email,
        displayName: valid.account.displayName,
        calendars,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list Google calendars';
      throw new HttpsError('failed-precondition', message);
    }
  }
);

// ─── Google Tasks incremental auth URL ───────────────────────────────────────
// Requests ONLY the tasks scope. Uses include_granted_scopes=true so users who
// already connected Google Calendar just get a small incremental consent prompt
// rather than a full re-auth flow. Keeps Tasks consent completely separate from
// the calendar OAuth so adding Tasks doesn't affect your verified calendar scopes.

const TASKS_SCOPE = 'https://www.googleapis.com/auth/tasks';

export const getGoogleTasksAuthUrl = onCall(
  {
    region: 'us-central1',
    secrets: [googleClientId],
  },
  async (request) => {
    if (!request.auth?.uid) {
      throw new HttpsError('unauthenticated', 'You must be signed in to connect Google Tasks.');
    }

    const origin = typeof request.data?.origin === 'string' ? request.data.origin : '';
    const googleAccountId = typeof request.data?.googleAccountId === 'string' ? request.data.googleAccountId : undefined;
    if (!origin) {
      throw new HttpsError('invalid-argument', 'Missing origin.');
    }

    const state = randomBytes(24).toString('hex');
    await stateDoc(state).set({
      uid: request.auth.uid,
      origin,
      createdAt: new Date().toISOString(),
      flow: 'tasks', // so the callback knows what this is for
    });

    const params = new URLSearchParams({
      client_id: getGoogleClientIdValue(),
      redirect_uri: getCallbackUrl(),
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true', // incremental — stacks on top of existing calendar grants
      scope: TASKS_SCOPE,
      state,
    });
    if (googleAccountId) {
      params.set('login_hint', googleAccountId);
    }

    return {
      authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      callbackUrl: getCallbackUrl(),
      state,
    };
  }
);