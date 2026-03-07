"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLinkCode = generateLinkCode;
exports.storeLinkCode = storeLinkCode;
exports.redeemLinkCode = redeemLinkCode;
exports.getLinkedUserId = getLinkedUserId;
exports.unlinkAccount = unlinkAccount;
/**
 * Account linking: connects a WhatsApp phone number to a Malleabite user (Firebase UID).
 *
 * Flow:
 *  1. User generates a 6-digit code in the web app (stored in Firestore with TTL)
 *  2. User sends the code to the WhatsApp bot
 *  3. Bot verifies the code and links the WhatsApp number → Firebase UID
 *
 * Firestore collections used:
 *  - whatsapp_link_codes/{code}  → { userId, createdAt, expiresAt }
 *  - whatsapp_users/{phoneNumber} → { userId, linkedAt, displayName }
 */
const admin = __importStar(require("firebase-admin"));
const db = () => admin.firestore();
const LINK_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
// ─── Generate link code (called from the web app via callable) ────────────────
function generateLinkCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
async function storeLinkCode(userId, code) {
    const now = Date.now();
    await db().collection('whatsapp_link_codes').doc(code).set({
        userId,
        createdAt: now,
        expiresAt: now + LINK_CODE_TTL_MS,
    });
}
async function redeemLinkCode(phoneNumber, code) {
    const codeDoc = await db().collection('whatsapp_link_codes').doc(code).get();
    if (!codeDoc.exists) {
        return { success: false, error: 'Invalid code. Please generate a new one in the Malleabite app.' };
    }
    const data = codeDoc.data();
    if (Date.now() > data.expiresAt) {
        await codeDoc.ref.delete();
        return { success: false, error: 'Code expired. Please generate a new one in the Malleabite app.' };
    }
    const userId = data.userId;
    // Link the phone number to the user
    await db().collection('whatsapp_users').doc(phoneNumber).set({
        userId,
        linkedAt: Date.now(),
        displayName: null,
    });
    // Also store the reverse mapping on the user doc
    await db().collection('users').doc(userId).set({ whatsappPhone: phoneNumber, whatsappLinkedAt: Date.now() }, { merge: true });
    // Clean up the used code
    await codeDoc.ref.delete();
    return { success: true, userId };
}
// ─── Lookup linked user ───────────────────────────────────────────────────────
async function getLinkedUserId(phoneNumber) {
    const doc = await db().collection('whatsapp_users').doc(phoneNumber).get();
    if (!doc.exists)
        return null;
    return doc.data()?.userId ?? null;
}
// ─── Unlink account ──────────────────────────────────────────────────────────
async function unlinkAccount(phoneNumber) {
    const doc = await db().collection('whatsapp_users').doc(phoneNumber).get();
    if (!doc.exists)
        return false;
    const userId = doc.data()?.userId;
    await doc.ref.delete();
    if (userId) {
        await db().collection('users').doc(userId).update({
            whatsappPhone: admin.firestore.FieldValue.delete(),
            whatsappLinkedAt: admin.firestore.FieldValue.delete(),
        });
    }
    return true;
}
//# sourceMappingURL=account-linking.js.map