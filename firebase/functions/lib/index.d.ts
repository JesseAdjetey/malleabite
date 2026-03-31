export { stripeWebhook, createCheckoutSession, createPortalSession, } from './stripe-webhooks';
export { synthesizeSpeech } from './tts';
export { processSchedulingStream } from './scheduling';
export { vapiLlm } from './vapi-llm';
export { whatsappWebhook, generateWhatsAppLinkCode } from './whatsapp-webhook';
export { onGroupMeetUpdated, confirmGroupMeetSlot } from './group-meets';
export { getGoogleCalendarAuthUrl, googleCalendarOAuthCallback, refreshGoogleCalendarAccessToken, listGoogleCalendarsForAccount, } from './google-calendar-oauth';
export { onCalendarEventActionWritten, sendPendingActionNotifications, } from './action-notifications';
/**
 * Process AI requests for intelligent scheduling with Gemini AI
 */
export declare const processAIRequest: import("firebase-functions/v2/https").HttpsFunction;
/**
 * Audio transcription using Gemini
 */
export declare const transcribeAudio: import("firebase-functions/v2/https").HttpsFunction;
/**
 * Helper to create calendar event directly (for testing/bypass)
 */
export declare const createCalendarEvent: import("firebase-functions/v2/https").HttpsFunction;
/**
 * Translate an array of English texts to a target language using Gemini.
 * Body: { texts: string[], targetLang: string }
 * Returns: { translations: { [source]: translated } }
 */
export declare const translateText: import("firebase-functions/v2/https").HttpsFunction;
