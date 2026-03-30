/**
 * vapiLlm — OpenAI-compatible chat completions endpoint for VAPI custom LLM.
 *
 * VAPI sends a standard OpenAI `POST /chat/completions` request (with streaming).
 * We forward the messages to Gemini and stream back an OpenAI-compatible SSE response
 * so VAPI can use our Gemini backend for voice conversations.
 *
 * VAPI auth: VAPI sends `Authorization: Bearer <vapi-server-secret>` — we verify this
 * against the VAPI_SERVER_SECRET Firebase secret to prevent unauthorized access.
 */
export declare const vapiLlm: import("firebase-functions/v2/https").HttpsFunction;
