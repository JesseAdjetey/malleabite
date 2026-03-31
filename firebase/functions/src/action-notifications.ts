import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as functionsV1 from 'firebase-functions/v1';
import * as admin from 'firebase-admin';

/** How far before the event start we send the push notification */
const TRIGGER_BEFORE_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Firestore trigger: when a calendar event is created, updated, or deleted,
 * maintain a corresponding doc in `scheduled_push_notifications`.
 */
export const onCalendarEventActionWritten = onDocumentWritten(
  'calendar_events/{eventId}',
  async (event) => {
    const db = admin.firestore();
    const eventId = event.params.eventId;
    const afterSnap = event.data?.after;
    const afterData = afterSnap?.exists ? afterSnap.data() : null;
    const userId = afterData?.userId;

    // Use a deterministic doc ID so updates overwrite the old scheduled notification
    const notifDocId = userId ? `${eventId}_${userId}` : eventId;
    const notifRef = db.collection('scheduled_push_notifications').doc(notifDocId);

    // Event deleted or mallyActions removed → cancel the pending notification
    if (!afterData || !afterData.mallyActions || afterData.mallyActions.length === 0) {
      await notifRef.delete().catch(() => {});
      return;
    }

    if (!userId) return;

    // Parse event start time (stored as ISO string in `startsAt`)
    const startsAt: string | undefined = afterData.startsAt;
    if (!startsAt) return;

    const startMs = new Date(startsAt).getTime();
    if (isNaN(startMs)) return;

    const triggerMs = startMs - TRIGGER_BEFORE_MS;

    // Already past — nothing to schedule
    if (triggerMs <= Date.now()) return;

    const scheduledFor = admin.firestore.Timestamp.fromMillis(triggerMs);

    await notifRef.set({
      userId,
      eventId,
      eventTitle: afterData.title || '',
      scheduledFor,
      sent: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
);

/**
 * Scheduled function: runs every minute, finds due notifications, sends FCM push.
 * Uses v1 pubsub API to avoid CLI compatibility issues with v2 onSchedule.
 */
export const sendPendingActionNotifications = functionsV1.pubsub
  .schedule('every 1 minutes')
  .onRun(async () => {
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  // Find all pending notifications that are due
  const snapshot = await db
    .collection('scheduled_push_notifications')
    .where('scheduledFor', '<=', now)
    .where('sent', '==', false)
    .limit(50)
    .get();

  if (snapshot.empty) return;

  const promises: Promise<void>[] = [];

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const { userId, eventId, eventTitle } = data;

    promises.push(
      (async () => {
        try {
          // Look up the user's FCM token
          const tokenSnap = await db.collection('fcm_tokens').doc(userId).get();

          if (!tokenSnap.exists || !tokenSnap.data()?.token) {
            // No token registered — mark sent to avoid infinite retries
            await docSnap.ref.update({ sent: true, sentAt: admin.firestore.FieldValue.serverTimestamp() });
            return;
          }

          const { token } = tokenSnap.data()!;

          await admin.messaging().send({
            token,
            // Raw data for the service worker background handler
            data: {
              type: 'mally_action',
              eventId: eventId || '',
              eventTitle: eventTitle || '',
              body: 'Tap to run your scheduled actions',
            },
            // Web push config (fallback display when SW doesn't override)
            webpush: {
              notification: {
                title: `\u26A1 ${eventTitle}`,
                body: 'Tap to run your scheduled actions',
                icon: '/assets/logo.png',
                requireInteraction: true,
              },
              fcmOptions: {
                link: `/?pendingActionEvent=${eventId}`,
              },
            },
            // Android
            android: {
              notification: {
                title: `\u26A1 ${eventTitle}`,
                body: 'Tap to run your scheduled actions',
                icon: 'ic_notification',
                clickAction: 'FLUTTER_NOTIFICATION_CLICK',
              },
            },
            // iOS (APNs)
            apns: {
              payload: {
                aps: {
                  alert: {
                    title: `\u26A1 ${eventTitle}`,
                    body: 'Tap to run your scheduled actions',
                  },
                  sound: 'default',
                  badge: 1,
                },
              },
            },
          });

          await docSnap.ref.update({
            sent: true,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (err: any) {
          console.error(`[FCM] Failed to send for event ${eventId}:`, err?.message);

          // If the token is no longer valid, remove it so we don't keep retrying
          if (
            err?.code === 'messaging/registration-token-not-registered' ||
            err?.code === 'messaging/invalid-registration-token'
          ) {
            await db.collection('fcm_tokens').doc(userId).delete().catch(() => {});
          }

          // Mark as sent with error to avoid infinite retry loop
          await docSnap.ref.update({
            sent: true,
            error: err?.message || 'unknown',
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
          }).catch(() => {});
        }
      })()
    );
  }

  await Promise.all(promises);

  // Clean up old sent notifications (> 2 hours old) to keep the collection lean
  const cutoff = admin.firestore.Timestamp.fromMillis(Date.now() - 2 * 60 * 60 * 1000);
  const oldSnap = await db
    .collection('scheduled_push_notifications')
    .where('sent', '==', true)
    .where('sentAt', '<=', cutoff)
    .limit(100)
    .get();

  await Promise.all(oldSnap.docs.map((d) => d.ref.delete()));
});
