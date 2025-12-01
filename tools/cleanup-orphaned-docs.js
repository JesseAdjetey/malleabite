// Browser console script to delete all orphaned documents
// Run this after logging into your new account

async function cleanOrphanedDocuments() {
  console.log('🧹 Starting cleanup of orphaned documents...');
  
  // Get current user
  const auth = window.getAuth?.() || window.firebase?.auth?.();
  const user = auth?.currentUser;
  if (!user) {
    console.error('❌ Please login first');
    return;
  }
  
  console.log(`👤 Current user: ${user.uid}`);
  
  // Get Firestore
  const db = window.getFirestore?.() || window.firebase?.firestore?.();
  if (!db) {
    console.error('❌ Firestore not available');
    return;
  }
  
  const collections = ['todos', 'calendar_events', 'eisenhower_items', 'reminders', 'alarms'];
  let totalDeleted = 0;
  
  for (const collName of collections) {
    console.log(`\n📁 Cleaning ${collName}...`);
    
    try {
      let snapshot;
      if (window.getDocs && window.collection) {
        snapshot = await window.getDocs(window.collection(db, collName));
      } else if (db.collection) {
        snapshot = await db.collection(collName).get();
      }
      
      console.log(`   Found ${snapshot.size || snapshot.docs?.length || 0} documents`);
      
      if (snapshot.empty || (snapshot.docs && snapshot.docs.length === 0)) {
        console.log(`   ✅ ${collName} is empty`);
        continue;
      }
      
      let batch;
      if (window.writeBatch) {
        batch = window.writeBatch(db);
      } else if (db.batch) {
        batch = db.batch();
      }
      
      let count = 0;
      const docs = snapshot.docs || [];
      
      docs.forEach(doc => {
        const data = doc.data();
        // Delete documents that have userId pointing to deleted users
        if (data.userId && data.userId !== user.uid) {
          batch.delete(doc.ref);
          count++;
        }
      });
      
      if (count > 0) {
        await batch.commit();
        console.log(`   🗑️ Deleted ${count} orphaned documents from ${collName}`);
        totalDeleted += count;
      } else {
        console.log(`   ✅ No orphaned documents in ${collName}`);
      }
      
    } catch (error) {
      console.error(`❌ Error cleaning ${collName}:`, error);
    }
  }
  
  console.log(`\n🎉 CLEANUP COMPLETE! Deleted ${totalDeleted} total orphaned documents`);
  console.log('🔄 Refresh the page to see the clean state');
}

cleanOrphanedDocuments();
