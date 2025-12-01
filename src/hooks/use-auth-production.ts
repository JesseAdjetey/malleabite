// Production-ready user management hook
import { useState, useEffect } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  updateProfile
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { auth, db } from '@/integrations/firebase/config';
import { toast } from 'sonner';

// User profile interface
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  photoURL?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isActive: boolean;
  preferences: {
    theme: 'light' | 'dark' | 'system';
    notifications: boolean;
    timezone: string;
  };
  metadata: {
    lastLoginAt?: Timestamp;
    loginCount: number;
    emailVerified: boolean;
  };
}

// Auth context interface
export interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signUp: (email: string, password: string, displayName: string) => Promise<{ success: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<{ success: boolean; error?: string }>;
  clearError: () => void;
}

export const useAuth = (): AuthContextType => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create user profile document in Firestore
  const createUserProfile = async (user: FirebaseUser, displayName: string): Promise<UserProfile> => {
    const userProfile: UserProfile = {
      uid: user.uid,
      email: user.email!,
      displayName: displayName,
      photoURL: user.photoURL || null,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
      isActive: true,
      preferences: {
        theme: 'system',
        notifications: true,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      metadata: {
        lastLoginAt: serverTimestamp() as Timestamp,
        loginCount: 1,
        emailVerified: user.emailVerified,
      },
    };

    try {
      await setDoc(doc(db, 'users', user.uid), userProfile);
      console.log('✅ User profile created:', user.uid);
      return userProfile;
    } catch (error) {
      console.error('❌ Error creating user profile:', error);
      throw error;
    }
  };

  // Fetch user profile from Firestore
  const fetchUserProfile = async (uid: string): Promise<UserProfile | null> => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        return userDoc.data() as UserProfile;
      }
      return null;
    } catch (error) {
      console.error('❌ Error fetching user profile:', error);
      return null;
    }
  };

  // Update user profile
  const updateUserProfile = async (updates: Partial<UserProfile>): Promise<{ success: boolean; error?: string }> => {
    if (!user) {
      return { success: false, error: 'No authenticated user' };
    }

    try {
      const updatedData = {
        ...updates,
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'users', user.uid), updatedData, { merge: true });
      
      // Update local state
      if (userProfile) {
        setUserProfile({ ...userProfile, ...updatedData } as UserProfile);
      }

      toast.success('Profile updated successfully');
      return { success: true };
    } catch (error: any) {
      console.error('❌ Error updating user profile:', error);
      setError(error.message);
      toast.error('Failed to update profile');
      return { success: false, error: error.message };
    }
  };

  // Sign up function
  const signUp = async (email: string, password: string, displayName: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      setError(null);

      // Create Firebase Auth user
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update the user's display name in Firebase Auth
      await updateProfile(newUser, { displayName });

      // Create user profile in Firestore
      const profile = await createUserProfile(newUser, displayName);
      setUserProfile(profile);

      toast.success('Account created successfully!');
      return { success: true };
    } catch (error: any) {
      console.error('❌ Sign up error:', error);
      setError(error.message);
      toast.error(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Sign in function
  const signIn = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      setError(null);

      const { user: signedInUser } = await signInWithEmailAndPassword(auth, email, password);
      
      // Update login metadata
      await setDoc(doc(db, 'users', signedInUser.uid), {
        'metadata.lastLoginAt': serverTimestamp(),
        'metadata.loginCount': userProfile ? userProfile.metadata.loginCount + 1 : 1,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      toast.success('Signed in successfully!');
      return { success: true };
    } catch (error: any) {
      console.error('❌ Sign in error:', error);
      setError(error.message);
      toast.error(error.message);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  // Sign out function
  const signOut = async (): Promise<void> => {
    try {
      await firebaseSignOut(auth);
      setUser(null);
      setUserProfile(null);
      toast.success('Signed out successfully');
    } catch (error: any) {
      console.error('❌ Sign out error:', error);
      setError(error.message);
      toast.error('Failed to sign out');
    }
  };

  // Clear error
  const clearError = () => setError(null);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setLoading(true);
        
        if (firebaseUser) {
          setUser(firebaseUser);
          
          // Fetch or create user profile
          let profile = await fetchUserProfile(firebaseUser.uid);
          
          if (!profile) {
            // Create profile if it doesn't exist (for existing users)
            profile = await createUserProfile(firebaseUser, firebaseUser.displayName || 'User');
          }
          
          setUserProfile(profile);
        } else {
          setUser(null);
          setUserProfile(null);
        }
      } catch (error: any) {
        console.error('❌ Auth state change error:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  return {
    user,
    userProfile,
    loading,
    error,
    signUp,
    signIn,
    signOut,
    updateUserProfile,
    clearError,
  };
};
