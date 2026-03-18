export declare const onGroupMeetUpdated: import("firebase-functions/core").CloudFunction<import("firebase-functions/v2/firestore").FirestoreEvent<import("firebase-functions/v2/firestore").Change<import("firebase-functions/v2/firestore").QueryDocumentSnapshot> | undefined, {
    sessionId: string;
}>>;
export declare const confirmGroupMeetSlot: import("firebase-functions/v2/https").HttpsFunction;
