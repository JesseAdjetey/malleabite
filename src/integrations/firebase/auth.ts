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
  signInWithRedirect
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
}

export interface SignUpCredentials extends SignInCredentials {
  displayName?: string;
}

// Auth functions
export const signIn = async (credentials: SignInCredentials): Promise<UserCredential> => {
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

export const signInWithGoogle = async (): Promise<UserCredential> => {
  const provider = new GoogleAuthProvider();

  if (isNative) {
    // On native, use redirect flow (popup blocked in WebView)
    // The onAuthStateChanged listener will pick up the signed-in user
    return await signInWithRedirect(auth, provider) as unknown as UserCredential;
  }

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
