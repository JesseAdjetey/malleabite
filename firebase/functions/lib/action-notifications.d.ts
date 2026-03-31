import * as functionsV1 from 'firebase-functions/v1';
/**
 * Firestore trigger: when a calendar event is created, updated, or deleted,
 * maintain a corresponding doc in `scheduled_push_notifications`.
 */
export declare const onCalendarEventActionWritten: import("firebase-functions/core").CloudFunction<import("firebase-functions/v2/firestore").FirestoreEvent<functionsV1.Change<import("firebase-functions/v2/firestore").DocumentSnapshot> | undefined, {
    eventId: string;
}>>;
/**
 * Scheduled function: runs every minute, finds due notifications, sends FCM push.
 * Uses v1 pubsub API to avoid CLI compatibility issues with v2 onSchedule.
 */
export declare const sendPendingActionNotifications: functionsV1.CloudFunction<unknown>;
