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
import * as admin from 'firebase-admin';

const db = () => admin.firestore();
const LINK_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ─── Generate link code (called from the web app via callable) ────────────────

export function generateLinkCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function storeLinkCode(userId: string, code: string): Promise<void> {
  const now = Date.now();
  await db().collection('whatsapp_link_codes').doc(code).set({
    userId,
    createdAt: now,
    expiresAt: now + LINK_CODE_TTL_MS,
  });
}

// ─── Verify & redeem a link code ──────────────────────────────────────────────

export interface LinkResult {
  success: boolean;
  userId?: string;
  error?: string;
}

export async function redeemLinkCode(
  phoneNumber: string,
  code: string
): Promise<LinkResult> {
  const codeDoc = await db().collection('whatsapp_link_codes').doc(code).get();

  if (!codeDoc.exists) {
    return { success: false, error: 'Invalid code. Please generate a new one in the Malleabite app.' };
  }

  const data = codeDoc.data()!;

  if (Date.now() > data.expiresAt) {
    await codeDoc.ref.delete();
    return { success: false, error: 'Code expired. Please generate a new one in the Malleabite app.' };
  }

  const userId = data.userId as string;

  // Link the phone number to the user
  await db().collection('whatsapp_users').doc(phoneNumber).set({
    userId,
    linkedAt: Date.now(),
    displayName: null,
  });

  // Also store the reverse mapping on the user doc
  await db().collection('users').doc(userId).set(
    { whatsappPhone: phoneNumber, whatsappLinkedAt: Date.now() },
    { merge: true }
  );

  // Clean up the used code
  await codeDoc.ref.delete();

  return { success: true, userId };
}

// ─── Lookup linked user ───────────────────────────────────────────────────────

export async function getLinkedUserId(phoneNumber: string): Promise<string | null> {
  const doc = await db().collection('whatsapp_users').doc(phoneNumber).get();
  if (!doc.exists) return null;
  return doc.data()?.userId ?? null;
}

// ─── Unlink account ──────────────────────────────────────────────────────────

export async function unlinkAccount(phoneNumber: string): Promise<boolean> {
  const doc = await db().collection('whatsapp_users').doc(phoneNumber).get();
  if (!doc.exists) return false;

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
