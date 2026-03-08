"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateWhatsAppLinkCode = exports.whatsappWebhook = void 0;
/**
 * WhatsApp Webhook — Firebase Cloud Function
 *
 * Handles:
 *  GET  → Meta webhook verification challenge
 *  POST → Incoming messages from WhatsApp users
 */
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const message_handler_1 = require("./whatsapp/message-handler");
// Secrets — stored in Firebase Functions secrets manager
const whatsappAccessToken = (0, params_1.defineSecret)('WHATSAPP_ACCESS_TOKEN');
const whatsappVerifyToken = (0, params_1.defineSecret)('WHATSAPP_VERIFY_TOKEN');
const whatsappPhoneNumberId = (0, params_1.defineSecret)('WHATSAPP_PHONE_NUMBER_ID');
const geminiApiKey = (0, params_1.defineSecret)('GEMINI_API_KEY');
// Real-time data secrets — declare here, add to secrets[] after setting them in Secret Manager:
//   firebase functions:secrets:set OPENWEATHER_API_KEY
//   firebase functions:secrets:set ALPHAVANTAGE_API_KEY
//   firebase functions:secrets:set AVIATIONSTACK_API_KEY
//   firebase functions:secrets:set BRAVE_SEARCH_API_KEY
// Then uncomment and add to the secrets array below.
// const openweatherApiKey = defineSecret('OPENWEATHER_API_KEY');
// const alphaVantageApiKey = defineSecret('ALPHAVANTAGE_API_KEY');
// const aviationstackApiKey = defineSecret('AVIATIONSTACK_API_KEY');
// const braveSearchApiKey = defineSecret('BRAVE_SEARCH_API_KEY');
/**
 * Main WhatsApp webhook endpoint.
 * URL: https://us-central1-malleabite-97d35.cloudfunctions.net/whatsappWebhook
 */
exports.whatsappWebhook = (0, https_1.onRequest)({
    secrets: [whatsappAccessToken, whatsappVerifyToken, whatsappPhoneNumberId, geminiApiKey],
    cors: false,
    // Allow larger payloads for media messages
    invoker: 'public', // Meta needs to call this without auth
}, async (request, response) => {
    try {
        // ─── GET: Webhook Verification ──────────────────────────────────────────
        if (request.method === 'GET') {
            const mode = request.query['hub.mode'];
            const token = request.query['hub.verify_token'];
            const challenge = request.query['hub.challenge'];
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
                    if (change.field !== 'messages')
                        continue;
                    const value = change.value;
                    const messages = value?.messages || [];
                    // metadata and contacts available for future use
                    // const metadata = value?.metadata;
                    // const contacts = value?.contacts || [];
                    for (const message of messages) {
                        const from = message.from; // sender's phone number
                        const messageId = message.id;
                        const isGroup = !!message.group_id || !!value?.group_id;
                        const isForwarded = !!(message.context?.forwarded || message.context?.frequently_forwarded);
                        console.log(`📩 Message from ${from}: type=${message.type}${isForwarded ? ' (forwarded)' : ''}`);
                        // Process asynchronously — we already sent 200
                        await (0, message_handler_1.handleIncomingMessage)({
                            phoneNumberId: whatsappPhoneNumberId.value().trim(),
                            accessToken: whatsappAccessToken.value().trim(),
                            from,
                            messageId,
                            isGroup,
                            groupId: message.group_id || value?.group_id,
                            isForwarded,
                        }, message).catch((err) => {
                            console.error('Error handling message:', err);
                        });
                    }
                }
            }
            return;
        }
        // Other methods
        response.status(405).send('Method Not Allowed');
    }
    catch (error) {
        console.error('Webhook error:', error);
        response.status(200).send('OK'); // Always 200 to prevent Meta retries
    }
});
/**
 * Generate a WhatsApp link code — callable from the web app.
 * Authenticated users can call this to get a 6-digit code for linking.
 */
const https_2 = require("firebase-functions/v2/https");
const account_linking_1 = require("./whatsapp/account-linking");
exports.generateWhatsAppLinkCode = (0, https_2.onCall)(async (request) => {
    if (!request.auth) {
        throw new https_2.HttpsError('unauthenticated', 'Must be signed in');
    }
    const userId = request.auth.uid;
    const code = (0, account_linking_1.generateLinkCode)();
    await (0, account_linking_1.storeLinkCode)(userId, code);
    return { code, expiresInSeconds: 600 };
});
//# sourceMappingURL=whatsapp-webhook.js.map