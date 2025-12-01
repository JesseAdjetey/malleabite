// Updated browser console script for React Firebase apps
// Copy and paste this into browser console while logged into your app

async function fixUserIdsReactApp() {
  console.log('🔧 Starting React Firebase userId fix...');
  
  // Try multiple ways to access Firebase auth
  let auth = null;
  let user = null;
  
  // Method 1: Check if Firebase is available globally
  if (window.firebase) {
    console.log('Found window.firebase');
    auth = window.firebase.auth();
    user = auth.currentUser;
  }
  
  // Method 2: Check modern Firebase v9+ SDK
  if (!user && window.auth) {
    console.log('Found window.auth');
    auth = window.auth;
    user = auth.currentUser;
  }
  
  // Method 3: Try to access React context (look for __REACT_DEVTOOLS_GLOBAL_HOOK__)
  if (!user && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    console.log('Trying to find user through React context...');
    
    // Try to find React fiber with auth context
    const reactFiber = document.querySelector('#root')?._reactInternalInstance ||
                      document.querySelector('#root')?._reactInternals;
    
    if (reactFiber) {
      // This is a bit hacky but might work for finding the user in context
      console.log('Found React fiber, searching for user context...');
    }
  }
  
  // Method 4: Check localStorage for user info
  if (!user) {
    console.log('Checking localStorage for Firebase user...');
    const localStorageKeys = Object.keys(localStorage);
    const firebaseKeys = localStorageKeys.filter(key => 
      key.includes('firebase') || key.includes('Firebase')
    );
    
    console.log('Firebase localStorage keys:', firebaseKeys);
    
    for (const key of firebaseKeys) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (data && (data.uid || data.localId || data.user?.uid)) {
          console.log('Found user data in localStorage:', key);
          user = { uid: data.uid || data.localId || data.user?.uid };
          break;
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }
  }
  
  if (!user || !user.uid) {
    console.error('❌ Could not find authenticated user.');
    console.log('💡 Make sure you are:');
    console.log('   1. Logged into the app');
    console.log('   2. On the correct page with Firebase loaded');
    console.log('   3. Try refreshing the page and running again');
    return;
  }
  
  console.log(`👤 Found user: ${user.uid}`);
  
  // Get Firestore instance
  let db = null;
  
  // Try different ways to access Firestore
  if (window.firebase?.firestore) {
    db = window.firebase.firestore();
    console.log('Using Firebase v8 SDK');
  } else if (window.db) {
    db = window.db;
    console.log('Using window.db');
  } else if (window.getFirestore) {
    db = window.getFirestore(window.app || window.firebase?.app());
    console.log('Using Firebase v9+ SDK');
  }
  
  if (!db) {
    console.error('❌ Could not access Firestore.');
    console.log('💡 Try running this in the Network tab:');
    console.log('   Look for Firestore requests to confirm Firebase is loaded');
    return;
  }
  
  console.log('✅ Connected to Firestore');
  
  const collections = ['todos', 'calendar_events', 'eisenhower_items', 'reminders'];
  let totalFixed = 0;
  
  for (const collName of collections) {
    console.log(`\n📁 Processing ${collName}...`);
    
    try {
      let snapshot;
      
      // Try Firebase v8 style first
      if (db.collection) {
        snapshot = await db.collection(collName).get();
      } else if (window.getDocs && window.collection) {
        // Firebase v9+ style
        const collRef = window.collection(db, collName);
        snapshot = await window.getDocs(collRef);
      } else {
        console.error(`❌ Could not query ${collName}`);
        continue;
      }
      
      console.log(`   Found ${snapshot.size || snapshot.docs?.length || 0} documents`);
      
      if (snapshot.empty || (snapshot.docs && snapshot.docs.length === 0)) {
        console.log(`   ✅ ${collName} is empty, skipping`);
        continue;
      }
      
      let batch;
      if (db.batch) {
        batch = db.batch();
      } else if (window.writeBatch) {
        batch = window.writeBatch(db);
      } else {
        console.error(`❌ Could not create batch for ${collName}`);
        continue;
      }
      
      let count = 0;
      const docs = snapshot.docs || [];
      
      docs.forEach(doc => {
        const data = doc.data();
        if (!data.userId) {
          batch.update(doc.ref, { userId: user.uid });
          count++;
        }
      });
      
      if (count > 0) {
        await batch.commit();
        console.log(`   ✅ Fixed ${count} documents in ${collName}`);
        totalFixed += count;
      } else {
        console.log(`   ✅ No documents needed fixing in ${collName}`);
      }
      
    } catch (error) {
      console.error(`❌ Error processing ${collName}:`, error);
      if (error.code === 'permission-denied') {
        console.log(`   💡 This might be expected if ${collName} has no documents for your user`);
      }
    }
    
    // Small delay between collections
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n🎉 COMPLETE! Fixed ${totalFixed} total documents`);
  
  if (totalFixed > 0) {
    console.log('🔄 Please refresh the page to see changes');
  } else {
    console.log('✅ All documents already had userId fields');
  }
}

// Run the function
console.log('🚀 Starting enhanced userId fix...');
fixUserIdsReactApp().catch(error => {
  console.error('❌ Script failed:', error);
  console.log('💡 Try:');
  console.log('   1. Refresh the page');
  console.log('   2. Make sure you are logged in');
  console.log('   3. Run the script again');
});
