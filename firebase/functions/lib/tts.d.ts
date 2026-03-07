/**
 * Firebase Cloud Function that synthesizes speech using Google Cloud TTS.
 * Uses Application Default Credentials (ADC) — no API key needed since
 * Cloud Functions run in GCP with a service account.
 */
export declare const synthesizeSpeech: import("firebase-functions/v2/https").HttpsFunction;
