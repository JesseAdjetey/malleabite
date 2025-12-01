const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
try {
  if (admin.apps.length === 0) {
    admin.initializeApp({
      projectId: 'malleabite-97d35'
    });
  }
  console.log('✅ Firebase Admin initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Firebase Admin:', error.message);
  process.exit(1);
}

const db = admin.firestore();

async function quickTest() {
  console.log('🔍 Testing Firestore connection...');
  
  try {
    // Test connection with a simple query
    const testRef = db.collection('todos').limit(1);
    const snapshot = await testRef.get();
    
    console.log(`✅ Connection successful! Found ${snapshot.size} document(s) in todos collection`);
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const data = doc.data();
      console.log(`📋 Sample document ID: ${doc.id}`);
      console.log(`📋 Has userId: ${data.userId ? '✅' : '❌'}`);
      console.log(`📋 Available fields: ${Object.keys(data).join(', ')}`);
      
      // If no userId, try to add it
      if (!data.userId) {
        console.log('🔧 Attempting to fix this document...');
        
        // Find a fallback userId
        const fallbacks = ['user_id', 'ownerId', 'senderId', 'recipientId'];
        let foundUserId = null;
        
        for (const field of fallbacks) {
          if (data[field]) {
            foundUserId = data[field];
            console.log(`💡 Found potential userId in field '${field}': ${foundUserId}`);
            break;
          }
        }
        
        if (foundUserId) {
          await doc.ref.update({ userId: foundUserId });
          console.log('✅ Document updated with userId!');
        } else {
          console.log('❌ No fallback userId found');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

quickTest()
  .then(() => {
    console.log('🎉 Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
