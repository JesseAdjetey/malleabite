/**
 * Picovoice Access Key — returns the key to authenticated users at runtime.
 *
 * The key is stored in Firebase Secrets (never in the client bundle).
 * The client fetches it once before initialising PorcupineWorker.
 *
 * Requires Firebase Secret: PICOVOICE_ACCESS_KEY
 * Set with: firebase functions:secrets:set PICOVOICE_ACCESS_KEY
 */

import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';

const picovoiceAccessKey = defineSecret('PICOVOICE_ACCESS_KEY');

export const getPicovoiceKey = onRequest(
  { secrets: [picovoiceAccessKey], cors: ['https://malleabite.com', 'https://www.malleabite.com', 'https://app.malleabite.com'] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthenticated' });
      return;
    }

    try {
      await admin.auth().verifyIdToken(authHeader.slice(7));
    } catch {
      res.status(401).json({ error: 'Invalid auth token' });
      return;
    }

    const key = picovoiceAccessKey.value();
    if (!key) {
      res.status(500).json({ error: 'Picovoice not configured' });
      return;
    }

    res.status(200).json({ accessKey: key });
  }
);
