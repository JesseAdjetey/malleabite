/**
 * Main WhatsApp webhook endpoint.
 * URL: https://us-central1-malleabite-97d35.cloudfunctions.net/whatsappWebhook
 */
export declare const whatsappWebhook: import("firebase-functions/v2/https").HttpsFunction;
export declare const generateWhatsAppLinkCode: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    code: string;
    expiresInSeconds: number;
}>, unknown>;
