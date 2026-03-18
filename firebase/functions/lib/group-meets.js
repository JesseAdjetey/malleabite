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
exports.confirmGroupMeetSlot = exports.onGroupMeetUpdated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
// ─── Slot resolution ──────────────────────────────────────────────────────────
function resolveSlots(session) {
    const responded = session.participants.filter(p => p.responded);
    if (responded.length === 0)
        return [];
    return session.organizerFreeSlots
        .map(slot => {
        const votes = responded.filter(p => p.availableSlots.some(s => s.start === slot.start && s.end === slot.end)).length;
        return { ...slot, votes };
    })
        .filter(s => s.votes > 0)
        .sort((a, b) => {
        if (b.votes !== a.votes)
            return b.votes - a.votes;
        const hourA = new Date(a.start).getHours();
        const hourB = new Date(b.start).getHours();
        const scoreA = -Math.abs(hourA - 10);
        const scoreB = -Math.abs(hourB - 10);
        if (scoreB !== scoreA)
            return scoreB - scoreA;
        return new Date(a.start).getTime() - new Date(b.start).getTime();
    });
}
// ─── Trigger: recompute proposed slots when participants update ───────────────
exports.onGroupMeetUpdated = (0, firestore_1.onDocumentUpdated)('group_meets/{sessionId}', async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after)
        return;
    if (after.status !== 'collecting')
        return;
    // Only run if a participant just responded
    const newResponse = after.participants.filter(p => p.responded).length >
        before.participants.filter(p => p.responded).length;
    if (!newResponse)
        return;
    const proposed = resolveSlots(after);
    const allResponded = after.participants.every(p => p.responded);
    const shouldAutoConfirm = after.autoConfirm && allResponded && proposed.length > 0;
    const update = {
        proposedSlots: proposed,
        updatedAt: new Date().toISOString(),
    };
    if (shouldAutoConfirm) {
        update.confirmedSlot = proposed[0];
        update.status = 'confirmed';
        // Create calendar events for all app users
        await createCalendarEventsForConfirmed(event.params.sessionId, { ...after, confirmedSlot: proposed[0] });
    }
    await event.data.after.ref.update(update);
});
// ─── On confirm: create calendar events for all app users ────────────────────
async function createCalendarEventsForConfirmed(sessionId, session) {
    if (!session.confirmedSlot)
        return;
    const db = admin.firestore();
    const slot = session.confirmedSlot;
    // Collect all user IDs (organizer + app users among participants)
    const userIds = [
        session.organizerId,
        ...session.participants.filter(p => p.isAppUser && p.userId).map(p => p.userId),
    ];
    const batch = db.batch();
    for (const uid of userIds) {
        const eventRef = db.collection('calendar_events').doc();
        batch.set(eventRef, {
            userId: uid,
            title: session.title,
            startsAt: slot.start,
            endsAt: slot.end,
            description: `Group meeting organised by ${session.organizerName}`,
            status: 'confirmed',
            source: 'malleabite',
            groupMeetSessionId: sessionId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        });
    }
    await batch.commit();
    // Send confirmation emails to non-app participants (email-only guests)
    const emailGuests = session.participants.filter(p => !p.isAppUser && p.responded);
    for (const guest of emailGuests) {
        await sendConfirmationEmail(guest, session, slot);
    }
}
// ─── Email confirmation (basic — extend with SendGrid/Resend as needed) ───────
async function sendConfirmationEmail(guest, session, slot) {
    // TODO: integrate with SendGrid / Resend
    // For now just log — the guest page shows confirmed state via Firestore listener
    console.log(`[group-meets] Send confirmation to ${guest.email} for "${session.title}" at ${slot.start}`);
}
// ─── HTTP: confirm a slot manually (organizer picks from proposed) ────────────
exports.confirmGroupMeetSlot = (0, https_1.onRequest)({ cors: true }, async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    const { sessionId, slot, organizerId } = req.body;
    if (!sessionId || !slot || !organizerId) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
    }
    const db = admin.firestore();
    const sessionRef = db.collection('group_meets').doc(sessionId);
    const snap = await sessionRef.get();
    if (!snap.exists) {
        res.status(404).json({ error: 'Session not found' });
        return;
    }
    const session = snap.data();
    if (session.organizerId !== organizerId) {
        res.status(403).json({ error: 'Not authorised' });
        return;
    }
    await sessionRef.update({
        confirmedSlot: slot,
        status: 'confirmed',
        updatedAt: new Date().toISOString(),
    });
    await createCalendarEventsForConfirmed(sessionId, { ...session, confirmedSlot: slot });
    res.json({ success: true });
});
//# sourceMappingURL=group-meets.js.map