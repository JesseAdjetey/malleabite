// Firebase configuration and initialization
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// Validate required environment variables
const requiredEnvVars = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
];

const missingEnvVars = requiredEnvVars.filter(
  varName => !import.meta.env[varName]
);

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(', ')}\n` +
    'Please copy .env.example to .env and fill in your Firebase credentials.'
  );
}

// Firebase config object - now using environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'us-central1'); // Specify region explicitly
export const storage = getStorage(app);

// Connect to emulators in development mode - DISABLED for production testing
// Uncomment the block below if you want to use Firebase emulators
/*
if (import.meta.env.DEV) {
  let emulatorConnected = false;
  
  try {
    // Auth emulator - connect only once
    if (!emulatorConnected) {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    }
    
    // Firestore emulator - connect only once  
    if (!emulatorConnected) {
      connectFirestoreEmulator(db, 'localhost', 8080);
    }
    
    // Functions emulator - connect only once
    if (!emulatorConnected) {
      connectFunctionsEmulator(functions, 'localhost', 5001);
    }
    
    // Storage emulator - connect only once
    if (!emulatorConnected) {
      connectStorageEmulator(storage, 'localhost', 9199);
    }
    
    emulatorConnected = true;
  } catch (error) {
    // Emulators might already be connected, ignore errors
    console.log('Firebase emulators already connected or not available');
  }
}
*/

export default app;
