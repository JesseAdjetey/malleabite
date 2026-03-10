export { stripeWebhook, createCheckoutSession, createPortalSession, } from './stripe-webhooks';
export { synthesizeSpeech } from './tts';
export { processSchedulingStream } from './scheduling';
export { whatsappWebhook, generateWhatsAppLinkCode } from './whatsapp-webhook';
export { getGoogleCalendarAuthUrl, googleCalendarOAuthCallback, refreshGoogleCalendarAccessToken, listGoogleCalendarsForAccount, } from './google-calendar-oauth';
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
