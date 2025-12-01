// Browser-based userId fix script
// Run this in your browser's console while logged into the application

async function fixMissingUserIds() {
  console.log('🔧 Starting browser-based userId repair...');
  
  // Get current user
  const auth = window.firebase?.auth?.() || window.getAuth?.();
  if (!auth?.currentUser) {
    console.error('❌ No authenticated user found. Please login first.');
    return;
  }
  
  const currentUserId = auth.currentUser.uid;
  console.log(`👤 Current user ID: ${currentUserId}`);
  
  // Get Firestore instance
  const db = window.firebase?.firestore?.() || window.getFirestore?.();
  if (!db) {
    console.error('❌ Firestore not available. Make sure Firebase is loaded.');
    return;
  }
  
  const collections = [
    'todos',
    'calendar_events', 
    'eisenhower_items',
    'reminders',
    'alarms',
    'ai_suggestions',
    'module_instances',
    'pomodoro_sessions'
  ];
  
  const fallbackFields = ['user_id', 'ownerId', 'senderId', 'recipientId'];
  
  let totalFixed = 0;
  let totalErrors = 0;
  
  for (const collectionName of collections) {
    console.log(`\n📂 Processing collection: ${collectionName}`);
    
    try {
      const collectionRef = db.collection(collectionName);
      const snapshot = await collectionRef.get();
      
      if (snapshot.empty) {
        console.log(`   ⚪ Collection is empty`);
        continue;
      }
      
      console.log(`   📊 Found ${snapshot.size} documents`);
      
      let fixedInCollection = 0;
      let errorsInCollection = 0;
      
      const batch = db.batch();
      let batchCount = 0;
      
      for (const doc of snapshot.docs) {
        const data = doc.data();
        
        // Skip if userId already exists
        if (data.userId) {
          continue;
        }
        
        // Try to find userId from fallback fields, or use current user
        let inferredUserId = currentUserId; // Default to current user
        
        for (const field of fallbackFields) {
          if (data[field]) {
            inferredUserId = data[field];
            break;
          }
        }
        
        console.log(`   🔄 Fixing document ${doc.id}: adding userId = ${inferredUserId}`);
        batch.update(doc.ref, { userId: inferredUserId });
        batchCount++;
        fixedInCollection++;
        
        // Commit batch every 500 operations (Firestore limit)
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`   💾 Committed batch of ${batchCount} updates`);
          batchCount = 0;
        }
      }
      
      // Commit remaining operations
      if (batchCount > 0) {
        await batch.commit();
        console.log(`   💾 Committed final batch of ${batchCount} updates`);
      }
      
      console.log(`   ✅ Fixed ${fixedInCollection} documents`);
      if (errorsInCollection > 0) {
        console.log(`   ❌ Could not fix ${errorsInCollection} documents`);
      }
      
      totalFixed += fixedInCollection;
      totalErrors += errorsInCollection;
      
    } catch (error) {
      console.error(`   ❌ Error processing collection ${collectionName}:`, error.message);
      totalErrors++;
    }
  }
  
  console.log('\n🎯 Summary:');
  console.log(`   ✅ Total documents fixed: ${totalFixed}`);
  console.log(`   ❌ Total errors: ${totalErrors}`);
  
  if (totalFixed > 0) {
    console.log('\n🎉 Repair completed! Refresh the page to see if the data loads properly.');
  } else if (totalErrors === 0) {
    console.log('\n✨ All documents already have userId fields - no repairs needed!');
  } else {
    console.log('\n⚠️  Some documents could not be repaired. Check the logs above for details.');
  }
}

// Run the fix
fixMissingUserIds().catch(error => {
  console.error('💥 Script failed:', error);
});
