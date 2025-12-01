const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// This will use Application Default Credentials or GOOGLE_APPLICATION_CREDENTIALS
try {
  // Use default credentials if available
  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: 'malleabite-97d35'
    });
  }
  console.log('✅ Firebase Admin initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error.message);
  console.log('💡 Make sure you are logged in with: firebase login');
  process.exit(1);
}

const db = admin.firestore();

// Collections to fix and their fallback fields
const COLLECTIONS_TO_FIX = [
  'todos',
  'calendar_events', 
  'eisenhower_items',
  'reminders',
  'alarms',
  'ai_suggestions',
  'module_instances',
  'pomodoro_sessions'
];

const FALLBACK_FIELDS = ['user_id', 'ownerId', 'senderId', 'recipientId'];

async function fixMissingUserIds() {
  console.log('🔧 Starting userId field repair process...\n');
  
  let totalFixed = 0;
  let totalErrors = 0;

  for (const collectionName of COLLECTIONS_TO_FIX) {
    console.log(`📂 Processing collection: ${collectionName}`);
    
    try {
      const collectionRef = db.collection(collectionName);
      const snapshot = await collectionRef.get();
      
      if (snapshot.empty) {
        console.log(`   ⚪ Collection is empty\n`);
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
        
        // Try to find userId from fallback fields
        let inferredUserId = null;
        for (const field of FALLBACK_FIELDS) {
          if (data[field]) {
            inferredUserId = data[field];
            break;
          }
        }
        
        if (inferredUserId) {
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
        } else {
          console.log(`   ⚠️  Cannot infer userId for document ${doc.id} - no fallback fields found`);
          errorsInCollection++;
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
      console.log('');
      
      totalFixed += fixedInCollection;
      totalErrors += errorsInCollection;
      
    } catch (error) {
      console.error(`   ❌ Error processing collection ${collectionName}:`, error.message);
      totalErrors++;
    }
  }
  
  console.log('🎯 Summary:');
  console.log(`   ✅ Total documents fixed: ${totalFixed}`);
  console.log(`   ❌ Total errors: ${totalErrors}`);
  
  if (totalFixed > 0) {
    console.log('\n🎉 Repair completed! The permission errors should now be resolved.');
    console.log('   Try refreshing your application to see if the data loads properly.');
  } else if (totalErrors === 0) {
    console.log('\n✨ All documents already have userId fields - no repairs needed!');
  } else {
    console.log('\n⚠️  Some documents could not be repaired. Check the logs above for details.');
  }
}

// Run the fix
fixMissingUserIds()
  .then(() => {
    console.log('\n🏁 Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
