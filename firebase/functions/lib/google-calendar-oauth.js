"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.listGoogleCalendarsForAccount = exports.refreshGoogleCalendarAccessToken = exports.googleCalendarOAuthCallback = exports.getGoogleCalendarAuthUrl = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
const node_crypto_1 = require("node:crypto");
const googleClientId = (0, params_1.defineSecret)('GOOGLE_CLIENT_ID');
const googleClientSecret = (0, params_1.defineSecret)('GOOGLE_CLIENT_SECRET');
const googleTokenEncryptionKey = (0, params_1.defineSecret)('GOOGLE_TOKEN_ENCRYPTION_KEY');
function getGoogleClientIdValue() {
    return googleClientId.value().trim();
}
function getGoogleClientSecretValue() {
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
function getDb() {
    return admin.firestore();
}
function getProjectId() {
    return process.env.GCLOUD_PROJECT || admin.app().options.projectId || '';
}
function getCallbackUrl() {
    const projectId = getProjectId();
    if (!projectId) {
        throw new Error('Firebase project ID is unavailable for Google OAuth callback');
    }
    return `https://us-central1-${projectId}.cloudfunctions.net/googleCalendarOAuthCallback`;
}
function accountDoc(uid, googleAccountId) {
    return getDb().collection('users').doc(uid).collection('googleAccounts').doc(googleAccountId);
}
function stateDoc(state) {
    return getDb().collection(OAUTH_STATE_COLLECTION).doc(state);
}
function getEncryptionKey() {
    return (0, node_crypto_1.createHash)('sha256').update(googleTokenEncryptionKey.value()).digest();
}
function encryptString(value) {
    const iv = (0, node_crypto_1.randomBytes)(12);
    const cipher = (0, node_crypto_1.createCipheriv)('aes-256-gcm', getEncryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${authTag.toString('base64')}.${ciphertext.toString('base64')}`;
}
function decryptString(payload) {
    const [ivB64, authTagB64, ciphertextB64] = payload.split('.');
    if (!ivB64 || !authTagB64 || !ciphertextB64) {
        throw new Error('Invalid encrypted token payload');
    }
    const decipher = (0, node_crypto_1.createDecipheriv)('aes-256-gcm', getEncryptionKey(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
    const plaintext = Buffer.concat([
        decipher.update(Buffer.from(ciphertextB64, 'base64')),
        decipher.final(),
    ]);
    return plaintext.toString('utf8');
}
async function exchangeCodeForTokens(code) {
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
    return response.json();
}
async function fetchGoogleUserInfo(accessToken) {
    const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
        const detail = await response.text().catch(() => 'unknown error');
        throw new Error(`Failed to fetch Google user info: ${detail}`);
    }
    return response.json();
}
async function saveGoogleAccount(params) {
    const { uid, userInfo, tokens } = params;
    const googleAccountId = userInfo.sub;
    const now = new Date().toISOString();
    const ref = accountDoc(uid, googleAccountId);
    const existing = await ref.get();
    const existingData = existing.exists ? existing.data() : undefined;
    const payload = {
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
async function refreshGoogleAccessToken(uid, googleAccountId) {
    const ref = accountDoc(uid, googleAccountId);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
        throw new Error(`Google account ${googleAccountId} not found`);
    }
    const account = snapshot.data();
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
    const tokens = await response.json();
    const now = new Date().toISOString();
    const updatedAccount = {
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
async function getValidAccessToken(uid, googleAccountId) {
    const snapshot = await accountDoc(uid, googleAccountId).get();
    if (!snapshot.exists) {
        throw new Error(`Google account ${googleAccountId} not found`);
    }
    const account = snapshot.data();
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
async function fetchGoogleCalendars(accessToken) {
    const response = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
        const detail = await response.text().catch(() => 'unknown error');
        throw new Error(`Failed to fetch Google calendars: ${detail}`);
    }
    const data = await response.json();
    return data.items || [];
}
function renderCallbackPage(origin, payload) {
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
exports.getGoogleCalendarAuthUrl = (0, https_1.onCall)({
    region: 'us-central1',
    secrets: [googleClientId],
}, async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError('unauthenticated', 'You must be signed in to connect Google Calendar.');
    }
    const origin = typeof request.data?.origin === 'string' ? request.data.origin : '';
    const loginHint = typeof request.data?.loginHint === 'string' ? request.data.loginHint : undefined;
    if (!origin) {
        throw new https_1.HttpsError('invalid-argument', 'Missing origin for Google OAuth flow.');
    }
    const state = (0, node_crypto_1.randomBytes)(24).toString('hex');
    const statePayload = {
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
});
exports.googleCalendarOAuthCallback = (0, https_1.onRequest)({
    region: 'us-central1',
    secrets: [googleClientId, googleClientSecret, googleTokenEncryptionKey],
}, async (req, res) => {
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const oauthError = typeof req.query.error === 'string' ? req.query.error : '';
    const snapshot = state ? await stateDoc(state).get() : null;
    const stateData = snapshot?.exists ? snapshot.data() : null;
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
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown Google OAuth error';
        res.status(500).send(renderCallbackPage(origin, {
            source: 'malleabite-google-oauth',
            type: 'error',
            error: message,
        }));
    }
});
exports.refreshGoogleCalendarAccessToken = (0, https_1.onCall)({
    region: 'us-central1',
    secrets: [googleClientId, googleClientSecret, googleTokenEncryptionKey],
}, async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError('unauthenticated', 'You must be signed in to refresh Google Calendar access.');
    }
    const googleAccountId = typeof request.data?.googleAccountId === 'string' ? request.data.googleAccountId : '';
    if (!googleAccountId) {
        throw new https_1.HttpsError('invalid-argument', 'Missing googleAccountId for token refresh.');
    }
    try {
        const refreshed = await refreshGoogleAccessToken(request.auth.uid, googleAccountId);
        return {
            googleAccountId,
            email: refreshed.account.email,
            accessToken: refreshed.accessToken,
            expiresIn: refreshed.expiresIn,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to refresh Google access token';
        throw new https_1.HttpsError('failed-precondition', message);
    }
});
exports.listGoogleCalendarsForAccount = (0, https_1.onCall)({
    region: 'us-central1',
    secrets: [googleClientId, googleClientSecret, googleTokenEncryptionKey],
}, async (request) => {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError('unauthenticated', 'You must be signed in to list Google calendars.');
    }
    const googleAccountId = typeof request.data?.googleAccountId === 'string' ? request.data.googleAccountId : '';
    if (!googleAccountId) {
        throw new https_1.HttpsError('invalid-argument', 'Missing googleAccountId for Google calendar listing.');
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
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to list Google calendars';
        throw new https_1.HttpsError('failed-precondition', message);
    }
});
//# sourceMappingURL=google-calendar-oauth.js.map