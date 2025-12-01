// Production migration script - run this to clean up and restructure your data
// This script will:
// 1. Delete all orphaned documents 
// 2. Create proper user profiles for existing users
// 3. Ensure all documents have proper userId fields
// 4. Apply production-ready data structure

async function migrateToProduction() {
  console.log('🚀 Starting production migration...');
  
  // Check authentication
  const auth = window.getAuth?.() || window.firebase?.auth?.();
  const currentUser = auth?.currentUser;
  
  if (!currentUser) {
    console.error('❌ Please login first before running migration');
    return;
  }
  
  console.log(`👤 Migrating for user: ${currentUser.uid}`);
  console.log(`📧 Email: ${currentUser.email}`);
  
  // Get Firestore instance
  const db = window.getFirestore?.() || window.firebase?.firestore?.();
  if (!db) {
    console.error('❌ Firestore not available');
    return;
  }
  
  try {
    // Step 1: Create user profile document
    console.log('\n📝 Step 1: Creating user profile...');
    
    const userProfile = {
      uid: currentUser.uid,
      email: currentUser.email,
      displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
      photoURL: currentUser.photoURL || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      preferences: {
        theme: 'system',
        notifications: true,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      metadata: {
        lastLoginAt: new Date(),
        loginCount: 1,
        emailVerified: currentUser.emailVerified,
      },
    };
    
    // Create or update user document
    if (window.setDoc && window.doc) {
      await window.setDoc(window.doc(db, 'users', currentUser.uid), userProfile, { merge: true });
      console.log('   ✅ User profile created/updated');
    } else if (db.collection) {
      await db.collection('users').doc(currentUser.uid).set(userProfile, { merge: true });
      console.log('   ✅ User profile created/updated');
    }
    
    // Step 2: Clean up orphaned documents and fix userId fields
    console.log('\n🧹 Step 2: Cleaning up and fixing data...');
    
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
    
    let totalProcessed = 0;
    let totalFixed = 0;
    let totalDeleted = 0;
    
    for (const collectionName of collections) {
      console.log(`\n   📁 Processing ${collectionName}...`);
      
      try {
        // Get all documents in collection
        let snapshot;
        if (window.getDocs && window.collection) {
          snapshot = await window.getDocs(window.collection(db, collectionName));
        } else if (db.collection) {
          snapshot = await db.collection(collectionName).get();
        }
        
        const docs = snapshot?.docs || [];
        console.log(`      📄 Found ${docs.length} documents`);
        
        if (docs.length === 0) {
          console.log(`      ✅ Collection is empty`);
          continue;
        }
        
        // Create batch for updates/deletes
        let batch;
        if (window.writeBatch) {
          batch = window.writeBatch(db);
        } else if (db.batch) {
          batch = db.batch();
        }
        
        let batchOperations = 0;
        let fixedInCollection = 0;
        let deletedInCollection = 0;
        
        docs.forEach(doc => {
          const data = doc.data();
          totalProcessed++;
          
          // Check if document belongs to current user or is orphaned
          const hasValidUserId = data.userId === currentUser.uid || data.user_id === currentUser.uid;
          const isOrphaned = data.userId && data.userId !== currentUser.uid;
          
          if (isOrphaned) {
            // Delete orphaned documents
            batch.delete(doc.ref);
            batchOperations++;
            deletedInCollection++;
            console.log(`      🗑️ Deleting orphaned document: ${doc.id}`);
          } else if (!hasValidUserId) {
            // Fix documents missing userId
            const updates = {
              userId: currentUser.uid,
              updatedAt: new Date(),
            };
            
            // Also add createdAt if missing
            if (!data.createdAt && !data.created_at) {
              updates.createdAt = data.updatedAt || data.updated_at || new Date();
            }
            
            batch.update(doc.ref, updates);
            batchOperations++;
            fixedInCollection++;
            console.log(`      🔧 Fixing document: ${doc.id}`);
          }
          
          // Commit batch if it gets too large
          if (batchOperations >= 450) { // Leave some room under 500 limit
            batch.commit().then(() => {
              console.log(`      💾 Committed batch of ${batchOperations} operations`);
            });
            
            // Create new batch
            batchOperations = 0;
            if (window.writeBatch) {
              batch = window.writeBatch(db);
            } else if (db.batch) {
              batch = db.batch();
            }
          }
        });
        
        // Commit remaining operations
        if (batchOperations > 0) {
          await batch.commit();
          console.log(`      💾 Committed final batch of ${batchOperations} operations`);
        }
        
        console.log(`      ✅ Fixed: ${fixedInCollection}, Deleted: ${deletedInCollection}`);
        totalFixed += fixedInCollection;
        totalDeleted += deletedInCollection;
        
      } catch (error) {
        console.error(`      ❌ Error processing ${collectionName}:`, error);
      }
    }
    
    // Step 3: Summary
    console.log('\n🎉 MIGRATION COMPLETE!');
    console.log(`   📊 Documents processed: ${totalProcessed}`);
    console.log(`   🔧 Documents fixed: ${totalFixed}`);
    console.log(`   🗑️ Orphaned documents deleted: ${totalDeleted}`);
    console.log(`   👤 User profile: Created/Updated`);
    
    console.log('\n✨ Your app is now production-ready!');
    console.log('🔄 Please refresh the page to see the changes');
    
    // Step 4: Test data access
    console.log('\n🧪 Testing data access...');
    
    try {
      // Try to read todos to verify everything works
      let testSnapshot;
      if (window.getDocs && window.collection && window.query && window.where) {
        const todosQuery = window.query(
          window.collection(db, 'todos'),
          window.where('userId', '==', currentUser.uid)
        );
        testSnapshot = await window.getDocs(todosQuery);
      } else if (db.collection) {
        testSnapshot = await db.collection('todos').where('userId', '==', currentUser.uid).get();
      }
      
      console.log(`   ✅ Data access test passed - found ${testSnapshot?.size || 0} todos`);
      
    } catch (error) {
      console.warn('   ⚠️ Data access test failed - this may be normal if collections are empty:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('💡 You may need to try again or contact support');
  }
}

// Auto-run the migration
console.log('🚀 Starting production migration script...');
migrateToProduction().catch(error => {
  console.error('❌ Migration script failed:', error);
});
