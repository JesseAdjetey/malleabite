// Firebase configuration and initialization
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

// Firebase config object
const firebaseConfig = {
  apiKey: "AIzaSyBJN1TZnchrGUNzgkyo6p1QEqaH3ceflVE",
  authDomain: "malleabite-97d35.firebaseapp.com",
  projectId: "malleabite-97d35",
  storageBucket: "malleabite-97d35.firebasestorage.app",
  messagingSenderId: "879274801325",
  appId: "1:879274801325:web:894f87dd217dee470fae24",
  measurementId: "G-FY8VC4Y2WX"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
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
