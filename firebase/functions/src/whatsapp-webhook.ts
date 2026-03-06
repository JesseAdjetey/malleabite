/**
 * WhatsApp Webhook — Firebase Cloud Function
 *
 * Handles:
 *  GET  → Meta webhook verification challenge
 *  POST → Incoming messages from WhatsApp users
 */
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { handleIncomingMessage } from './whatsapp/message-handler';

// Secrets — stored in Firebase Functions secrets manager
const whatsappAccessToken = defineSecret('WHATSAPP_ACCESS_TOKEN');
const whatsappVerifyToken = defineSecret('WHATSAPP_VERIFY_TOKEN');
const whatsappPhoneNumberId = defineSecret('WHATSAPP_PHONE_NUMBER_ID');

/**
 * Main WhatsApp webhook endpoint.
 * URL: https://us-central1-malleabite-97d35.cloudfunctions.net/whatsappWebhook
 */
export const whatsappWebhook = onRequest(
  {
    secrets: [whatsappAccessToken, whatsappVerifyToken, whatsappPhoneNumberId],
    cors: false,
    // Allow larger payloads for media messages
    invoker: 'public', // Meta needs to call this without auth
  },
  async (request, response) => {
    try {
      // ─── GET: Webhook Verification ──────────────────────────────────────────
      if (request.method === 'GET') {
        const mode = request.query['hub.mode'] as string;
        const token = request.query['hub.verify_token'] as string;
        const challenge = request.query['hub.challenge'] as string;

        if (mode === 'subscribe' && token === whatsappVerifyToken.value()) {
          console.log('✅ Webhook verified successfully');
          response.status(200).send(challenge);
          return;
        }

        console.warn('❌ Webhook verification failed — token mismatch');
        response.status(403).send('Forbidden');
        return;
      }

      // ─── POST: Incoming Messages ────────────────────────────────────────────
      if (request.method === 'POST') {
        const body = request.body;

        // Meta sends a specific structure
        if (body?.object !== 'whatsapp_business_account') {
          response.status(404).send('Not Found');
          return;
        }

        // Always respond 200 quickly — Meta will retry on failure
        response.status(200).send('OK');

        // Process each entry (usually just one)
        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            if (change.field !== 'messages') continue;

            const value = change.value;
            const messages = value?.messages || [];
            // metadata and contacts available for future use
            // const metadata = value?.metadata;
            // const contacts = value?.contacts || [];

            for (const message of messages) {
              const from = message.from; // sender's phone number
              const messageId = message.id;
              const isGroup = !!message.group_id || !!value?.group_id;

              console.log(`📩 Message from ${from}: type=${message.type}`);

              // Process asynchronously — we already sent 200
              await handleIncomingMessage(
                {
                  phoneNumberId: whatsappPhoneNumberId.value(),
                  accessToken: whatsappAccessToken.value(),
                  from,
                  messageId,
                  isGroup,
                  groupId: message.group_id || value?.group_id,
                },
                message
              ).catch((err) => {
                console.error('Error handling message:', err);
              });
            }
          }
        }

        return;
      }

      // Other methods
      response.status(405).send('Method Not Allowed');
    } catch (error) {
      console.error('Webhook error:', error);
      response.status(200).send('OK'); // Always 200 to prevent Meta retries
    }
  }
);

/**
 * Generate a WhatsApp link code — callable from the web app.
 * Authenticated users can call this to get a 6-digit code for linking.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { generateLinkCode, storeLinkCode } from './whatsapp/account-linking';

export const generateWhatsAppLinkCode = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in');
  }

  const userId = request.auth.uid;
  const code = generateLinkCode();
  await storeLinkCode(userId, code);

  return { code, expiresInSeconds: 600 };
});
