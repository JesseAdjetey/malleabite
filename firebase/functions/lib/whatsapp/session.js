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
exports.getPendingAction = getPendingAction;
exports.setPendingAction = setPendingAction;
exports.clearPendingAction = clearPendingAction;
exports.setLastCreated = setLastCreated;
exports.undoLastCreated = undoLastCreated;
/**
 * Session management for WhatsApp conversations.
 *
 * Stores pending actions so the bot can propose something,
 * wait for user confirmation, then execute.
 *
 * Firestore collection:
 *   whatsapp_sessions/{phoneNumber} → { pendingAction, lastCreatedId, lastCreatedType, updatedAt }
 */
const admin = __importStar(require("firebase-admin"));
const db = () => admin.firestore();
const SESSIONS = 'whatsapp_sessions';
const SESSION_TTL_MS = 15 * 60 * 1000; // 15 min — pending actions expire
// ─── Get / Set Pending Action ─────────────────────────────────────────────────
async function getPendingAction(phone) {
    const doc = await db().collection(SESSIONS).doc(phone).get();
    if (!doc.exists)
        return null;
    const data = doc.data();
    // Check TTL
    if (Date.now() - data.updatedAt > SESSION_TTL_MS) {
        await clearPendingAction(phone);
        return null;
    }
    return data.pendingAction ?? null;
}
async function setPendingAction(phone, action) {
    await db().collection(SESSIONS).doc(phone).set({ pendingAction: action, updatedAt: Date.now() }, { merge: true });
}
async function clearPendingAction(phone) {
    await db().collection(SESSIONS).doc(phone).set({ pendingAction: null, updatedAt: Date.now() }, { merge: true });
}
// ─── Track Last Created (for Undo) ───────────────────────────────────────────
async function setLastCreated(phone, docId, type, collection) {
    await db().collection(SESSIONS).doc(phone).set({
        lastCreatedId: docId,
        lastCreatedType: type,
        lastCreatedCollection: collection,
        updatedAt: Date.now(),
    }, { merge: true });
}
async function undoLastCreated(phone) {
    const doc = await db().collection(SESSIONS).doc(phone).get();
    if (!doc.exists)
        return { success: false };
    const data = doc.data();
    if (!data.lastCreatedId || !data.lastCreatedCollection)
        return { success: false };
    // Check TTL — only allow undo within 15 min
    if (Date.now() - data.updatedAt > SESSION_TTL_MS) {
        return { success: false };
    }
    try {
        await db().collection(data.lastCreatedCollection).doc(data.lastCreatedId).delete();
        await db().collection(SESSIONS).doc(phone).set({ lastCreatedId: null, lastCreatedType: null, lastCreatedCollection: null, updatedAt: Date.now() }, { merge: true });
        return { success: true, type: data.lastCreatedType ?? undefined };
    }
    catch {
        return { success: false };
    }
}
//# sourceMappingURL=session.js.map