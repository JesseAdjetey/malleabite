// Firebase Authentication utilities and types
import {
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification,
  UserCredential,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithCredential,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { auth } from './config';
import { isNative } from '@/lib/platform';

export type User = FirebaseUser;

export interface AuthError {
  code: string;
  message: string;
}

export interface SignInCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface SignUpCredentials extends SignInCredentials {
  displayName?: string;
}

// Auth functions
export const signIn = async (credentials: SignInCredentials): Promise<UserCredential> => {
  const persistence = credentials.rememberMe === false
    ? browserSessionPersistence
    : browserLocalPersistence;
  await setPersistence(auth, persistence);
  return await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
};

export const signUp = async (credentials: SignUpCredentials): Promise<UserCredential> => {
  const userCredential = await createUserWithEmailAndPassword(
    auth, 
    credentials.email, 
    credentials.password
  );
  
  // Update profile with display name if provided
  if (credentials.displayName && userCredential.user) {
    await updateProfile(userCredential.user, {
      displayName: credentials.displayName
    });
  }
  
  // Send email verification
  if (userCredential.user) {
    await sendEmailVerification(userCredential.user);
  }
  
  return userCredential;
};

export const signInWithGoogle = async (rememberMe = true): Promise<UserCredential> => {
  const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
  await setPersistence(auth, persistence);
  if (isNative) {
    // Use the Capacitor Firebase Authentication plugin for native Google Sign-In
    const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
    const result = await FirebaseAuthentication.signInWithGoogle();
    
    // Use the credential from the native sign-in to authenticate with the Firebase web SDK
    const idToken = result.credential?.idToken;
    const accessToken = result.credential?.accessToken;
    if (!idToken) {
      throw new Error('Google Sign-In failed: no ID token returned');
    }
    const credential = GoogleAuthProvider.credential(idToken, accessToken);
    return await signInWithCredential(auth, credential);
  }

  // Web: use popup
  const provider = new GoogleAuthProvider();
  return await signInWithPopup(auth, provider);
};

export const signOutUser = async (): Promise<void> => {
  return await signOut(auth);
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

// Subscribe to auth state changes
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

// Helper function to check if user is authenticated
export const isAuthenticated = (): boolean => {
  return !!auth.currentUser;
};

// Get current user's ID token
export const getUserToken = async (): Promise<string | null> => {
  const user = auth.currentUser;
  if (user) {
    return await user.getIdToken();
  }
  return null;
};
