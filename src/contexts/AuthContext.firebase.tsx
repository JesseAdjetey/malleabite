import * as React from 'react';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  User,
  signIn as firebaseSignIn,
  signUp as firebaseSignUp,
  signInWithGoogle as firebaseSignInWithGoogle,
  signOutUser,
  onAuthStateChange,
  AuthError
} from '@/integrations/firebase/auth';
import { toast } from '@/components/ui/use-toast';
import { errorHandler, ErrorSeverity } from '@/lib/error-handler';
import { logger } from '@/lib/logger';

interface AuthContextType {
  user: User | null;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<{success: boolean; isConfirmationEmailSent: boolean}>;
  signInWithGoogle: () => Promise<void>;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  // Legacy compatibility for components that still expect session
  session: { user: User | null } | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Set up Firebase auth state listener
    const unsubscribe = onAuthStateChange((firebaseUser) => {
      logger.auth('Auth state changed', { 
        email: firebaseUser?.email,
        userId: firebaseUser?.uid 
      });
      setUser(firebaseUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const clearError = () => setError(null);

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      
      logger.info('Auth', 'Sign in attempt', { email });
      await firebaseSignIn({ email, password });
      
      logger.info('Auth', 'Sign in successful', { email });
      toast({
        title: "Success!",
        description: "You have been signed in successfully.",
      });
    } catch (firebaseError: any) {
      logger.error('Auth', 'Sign in failed', firebaseError, { email });
      
      errorHandler.handleAuthError(firebaseError);
      setError(firebaseError.message || 'An error occurred during sign in');
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      logger.info('Auth', 'Sign up attempt', { email, hasName: !!name });
      const userCredential = await firebaseSignUp({ 
        email, 
        password,
        displayName: name
      });
      
      // Firebase automatically sends email verification
      const isConfirmationEmailSent = !userCredential.user.emailVerified;
      
      logger.info('Auth', 'Sign up successful', { 
        email, 
        emailVerificationSent: isConfirmationEmailSent 
      });
      
      toast({
        title: "Account created!",
        description: isConfirmationEmailSent 
          ? "Please check your email to verify your account." 
          : "Your account has been created successfully.",
      });
      
      return { success: true, isConfirmationEmailSent };
    } catch (firebaseError: any) {
      logger.error('Auth', 'Sign up failed', firebaseError, { email });
      
      errorHandler.handleAuthError(firebaseError);
      setError(firebaseError.message || 'An error occurred during sign up');
      
      return { success: false, isConfirmationEmailSent: false };
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      setError(null);
      
      logger.info('Auth', 'Google sign in attempt');
      await firebaseSignInWithGoogle();
      
      logger.info('Auth', 'Google sign in successful');
      toast({
        title: "Success!",
        description: "You have been signed in with Google.",
      });
    } catch (firebaseError: any) {
      logger.error('Auth', 'Google sign in failed', firebaseError);
      
      errorHandler.handleAuthError(firebaseError);
      setError(firebaseError.message || 'An error occurred during Google sign in');
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      setError(null);
      
      logger.info('Auth', 'Sign out attempt', { userId: user?.uid });
      await signOutUser();
      
      logger.info('Auth', 'Sign out successful');
      // State will be cleared automatically by the auth state listener
      toast({
        title: "Signed out",
        description: "You have been signed out successfully.",
      });
    } catch (firebaseError: any) {
      logger.error('Auth', 'Sign out failed', firebaseError);
      
      errorHandler.handleAuthError(firebaseError);
      setError(firebaseError.message || 'An error occurred during sign out');
    } finally {
      setLoading(false);
    }
  };

  // Legacy compatibility - create a session-like object for components that expect it
  const session = user ? { user } : null;

  const value = {
    user,
    session, // Legacy compatibility
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    loading,
    error,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
