// Browser console script to fix missing userId fields in Firestore
// Copy and paste this entire script into your browser console while logged into the app

async function fixMissingUserIds() {
  console.log('🔧 Starting userId repair process...');
  
  // Check if Firebase is available
  if (!window.firebase && !window.getAuth) {
    console.error('❌ Firebase not found. Make sure you are on the app page with Firebase loaded.');
    return;
  }
  
  // Get current user
  let currentUser;
  if (window.firebase?.auth) {
    currentUser = window.firebase.auth().currentUser;
  } else if (window.getAuth) {
    const auth = window.getAuth();
    currentUser = auth.currentUser;
  }
  
  if (!currentUser) {
    console.error('❌ No authenticated user found. Please login first.');
    return;
  }
  
  const userId = currentUser.uid;
  console.log(`👤 Current user ID: ${userId}`);
  
  // Get Firestore instance
  let db;
  if (window.firebase?.firestore) {
    db = window.firebase.firestore();
  } else if (window.getFirestore) {
    db = window.getFirestore();
  }
  
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
    console.log(`\n📁 Processing collection: ${collectionName}`);
    
    try {
      // Get all documents in collection
      let snapshot;
      if (window.firebase?.firestore) {
        snapshot = await db.collection(collectionName).get();
      } else {
        const { collection: getCollection, getDocs } = window;
        const collectionRef = getCollection(db, collectionName);
        snapshot = await getDocs(collectionRef);
      }
      
      console.log(`   📄 Found ${snapshot.size} documents`);
      
      if (snapshot.empty) {
        console.log(`   ✅ Collection is empty, skipping`);
        continue;
      }
      
      let fixedInCollection = 0;
      let errorsInCollection = 0;
      let batch;
      let batchCount = 0;
      
      if (window.firebase?.firestore) {
        batch = db.batch();
      } else {
        const { writeBatch } = window;
        batch = writeBatch(db);
      }
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Check if userId field is missing
        if (!data.userId) {
          // Try to infer userId from other fields
          let inferredUserId = userId; // Default to current user
          
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
            batch.commit().then(() => {
              console.log(`   💾 Committed batch of ${batchCount} updates`);
            }).catch(error => {
              console.error(`   ❌ Batch commit error:`, error);
              errorsInCollection++;
            });
            
            batchCount = 0;
            if (window.firebase?.firestore) {
              batch = db.batch();
            } else {
              const { writeBatch } = window;
              batch = writeBatch(db);
            }
          }
        }
      });
      
      // Commit remaining operations
      if (batchCount > 0) {
        await batch.commit();
        console.log(`   💾 Committed final batch of ${batchCount} updates`);
      }
      
      console.log(`   ✅ Fixed ${fixedInCollection} documents`);
      if (errorsInCollection > 0) {
        console.log(`   ❌ Errors: ${errorsInCollection}`);
      }
      
      totalFixed += fixedInCollection;
      totalErrors += errorsInCollection;
      
    } catch (error) {
      console.error(`   ❌ Error processing collection ${collectionName}:`, error);
      totalErrors++;
    }
    
    // Add small delay between collections
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n🎉 REPAIR COMPLETE!`);
  console.log(`   ✅ Total documents fixed: ${totalFixed}`);
  console.log(`   ❌ Total errors: ${totalErrors}`);
  
  if (totalFixed > 0) {
    console.log(`\n🔄 Please refresh the page to see the changes take effect.`);
  }
}

// Auto-run the function
console.log('🚀 Running userId repair script...');
fixMissingUserIds().catch(error => {
  console.error('❌ Script failed:', error);
});
