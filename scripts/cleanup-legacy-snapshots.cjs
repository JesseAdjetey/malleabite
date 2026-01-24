// Script to clean up legacy calendar snapshot data from Firestore
// Run with: node scripts/cleanup-legacy-snapshots.cjs

const admin = require('firebase-admin');

// Initialize Firebase Admin (uses application default credentials or service account)
// If running locally, set GOOGLE_APPLICATION_CREDENTIALS environment variable
// to point to your service account key file

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

async function cleanupLegacySnapshots() {
    console.log('Starting cleanup of legacy snapshot data...\n');

    // 1. Delete all documents in 'calendar_snapshots' collection
    const snapshotsRef = db.collection('calendar_snapshots');
    const snapshotsQuery = await snapshotsRef.get();

    console.log(`Found ${snapshotsQuery.size} documents in 'calendar_snapshots'`);

    if (snapshotsQuery.size > 0) {
        const batch1 = db.batch();
        snapshotsQuery.docs.forEach(doc => {
            batch1.delete(doc.ref);
        });
        await batch1.commit();
        console.log(`  Deleted ${snapshotsQuery.size} calendar_snapshots documents`);
    }

    // 2. Delete all documents in 'snapshot_events' collection
    const snapshotEventsRef = db.collection('snapshot_events');
    const snapshotEventsQuery = await snapshotEventsRef.get();

    console.log(`Found ${snapshotEventsQuery.size} documents in 'snapshot_events'`);

    if (snapshotEventsQuery.size > 0) {
        // Firestore batches are limited to 500 operations
        const batchSize = 500;
        const docs = snapshotEventsQuery.docs;

        for (let i = 0; i < docs.length; i += batchSize) {
            const batch = db.batch();
            const chunk = docs.slice(i, i + batchSize);
            chunk.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
            console.log(`  Deleted batch ${Math.ceil((i + 1) / batchSize)} (${Math.min(i + batchSize, docs.length)}/${docs.length})`);
        }
    }

    console.log('\n✅ Legacy snapshot data cleanup complete!');
    console.log('The new archiving system uses isArchived/folderName fields on calendar_events instead.');
}

cleanupLegacySnapshots()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Error during cleanup:', err);
        process.exit(1);
    });
