/**
 * getMallyRealtimeToken
 *
 * Creates a short-lived OpenAI Realtime ephemeral token so the browser can
 * connect directly to the OpenAI WebRTC endpoint without ever seeing the
 * full API key. Token is valid for 60 seconds — enough to complete the SDP
 * handshake.
 */

import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

const openaiKey = defineSecret('OPENAI_API_KEY');

export const getMallyRealtimeToken = onRequest(
  {
    cors: true,
    region: 'us-central1',
    secrets: [openaiKey],
    memory: '256MiB',
    timeoutSeconds: 15,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const voice = req.body?.voice || 'alloy';
    const validVoices = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];
    const safeVoice = validVoices.includes(voice) ? voice : 'nova';

    try {
      const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey.value()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview-2024-12-17',
          voice: safeVoice,
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        console.error('[getMallyRealtimeToken] OpenAI error:', response.status, err);
        res.status(502).json({ error: 'Failed to create session' });
        return;
      }

      const data = await response.json();
      res.json({
        token: data.client_secret.value,
        expiresAt: data.client_secret.expires_at,
      });
    } catch (err: any) {
      console.error('[getMallyRealtimeToken] Error:', err.message);
      res.status(500).json({ error: 'Internal error' });
    }
  }
);
