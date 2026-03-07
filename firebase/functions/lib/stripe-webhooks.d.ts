/**
 * Stripe webhook endpoint to handle subscription events
 * Triggered by Stripe when subscription status changes
 */
export declare const stripeWebhook: import("firebase-functions/v2/https").HttpsFunction;
/**
 * Create Stripe checkout session
 * Called from client when user wants to subscribe
 */
export declare const createCheckoutSession: import("firebase-functions/v2/https").HttpsFunction;
/**
 * Create billing portal session
 * Allows users to manage their subscription
 */
export declare const createPortalSession: import("firebase-functions/v2/https").HttpsFunction;
