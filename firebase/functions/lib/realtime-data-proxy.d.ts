/**
 * Realtime Data Proxy — keeps API keys server-side only.
 *
 * The frontend calls this single endpoint with { action, params },
 * and this function dispatches to the appropriate external API.
 */
export declare const realtimeDataProxy: import("firebase-functions/v2/https").HttpsFunction;
