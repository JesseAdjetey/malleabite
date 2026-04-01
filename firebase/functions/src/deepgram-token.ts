/**
 * Deepgram Temporary Token — issues short-lived (60s) Deepgram API tokens.
 *
 * The real DEEPGRAM_API_KEY never leaves the server. The client calls this
 * function to get a one-time token, connects the WebSocket with that token,
 * and the token expires automatically after 60 seconds.
 *
 * Requires Firebase Secret: DEEPGRAM_API_KEY
 * Set with: firebase functions:secrets:set DEEPGRAM_API_KEY
 */

import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { auditLog, trackFailure } from './audit-logger';

const deepgramApiKey = defineSecret('DEEPGRAM_API_KEY');

export const getDeepgramToken = onRequest(
  { secrets: [deepgramApiKey], cors: ['https://malleabite.com', 'https://app.malleabite.com'] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    // Require Firebase auth token
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }

    let uid: string;
    try {
      const decoded = await admin.auth().verifyIdToken(authHeader.slice(7));
      uid = decoded.uid;
    } catch {
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? 'unknown';
      trackFailure(`deepgram:${ip}`, 'auth.failed', undefined, ip);
      auditLog('auth.failed', { severity: 'WARNING', ip, endpoint: 'getDeepgramToken' });
      res.status(401).json({ error: 'Invalid auth token' });
      return;
    }
    auditLog('api.request', { userId: uid, endpoint: 'getDeepgramToken' });

    const key = deepgramApiKey.value();
    if (!key) {
      res.status(500).json({ error: 'Deepgram not configured' });
      return;
    }

    // Request a temporary token from Deepgram (TTL: 60 seconds, single use)
    const response = await fetch('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ttl_seconds: 60 }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('[DeepgramToken] Failed to create token:', err);
      res.status(502).json({ error: 'Failed to create Deepgram token' });
      return;
    }

    const data = await response.json() as { access_token: string };
    res.status(200).json({ token: data.access_token });
  }
);
