const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

// Simple test function
exports.helloWorld = functions.https.onCall(async (data, context) => {
  return {
    success: true,
    message: 'Hello from Firebase Functions!',
    timestamp: new Date().toISOString()
  };
});

// Simple test HTTP function
exports.ping = functions.https.onRequest((req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.json({
    success: true,
    message: 'Firebase Functions are working!',
    timestamp: new Date().toISOString()
  });
});
