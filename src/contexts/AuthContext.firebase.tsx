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
import { posthog } from '@/lib/posthog';

interface AuthContextType {
  user: User | null;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<{success: boolean; isConfirmationEmailSent: boolean}>;
  signInWithGoogle: (rememberMe?: boolean) => Promise<void>;
  loading: boolean;
  error: string | null;
  clearError: () => void;
  // Legacy compatibility for components that still expect session
  session: { user: User | null } | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Sign out after 30 minutes of inactivity
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_EVENTS = ['mousedown', 'keydown', 'touchstart', 'scroll'] as const;

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inactivityTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetInactivityTimer = React.useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => {
      signOutUser().catch(() => {});
    }, INACTIVITY_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    // Set up Firebase auth state listener
    const unsubscribe = onAuthStateChange((firebaseUser) => {
      logger.auth('Auth state changed', { signedIn: !!firebaseUser });
      setUser(firebaseUser);
      setLoading(false);

      if (firebaseUser) {
        // Identify user in PostHog
        posthog.identify(firebaseUser.uid, {
          email: firebaseUser.email ?? undefined,
          name: firebaseUser.displayName ?? undefined,
        });
        // Start inactivity timer when user signs in
        resetInactivityTimer();
        ACTIVITY_EVENTS.forEach(e => window.addEventListener(e, resetInactivityTimer, { passive: true }));
      } else {
        // Reset PostHog on sign out
        posthog.reset();
        // Clear timer on sign out
        if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
        ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetInactivityTimer));
      }
    });

    // Safety timeout: if auth hasn't resolved in 5 seconds, stop loading
    // This prevents infinite spinner on native when Firebase auth hangs
    const timeout = setTimeout(() => {
      setLoading((prev) => {
        if (prev) {
          console.warn('[DEBUG-AUTH] Auth loading timed out after 5s, setting loading=false');
          return false;
        }
        return prev;
      });
    }, 5000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      ACTIVITY_EVENTS.forEach(e => window.removeEventListener(e, resetInactivityTimer));
    };
  }, [resetInactivityTimer]);

  const clearError = () => setError(null);

  const signIn = async (email: string, password: string, rememberMe?: boolean) => {
    try {
      setLoading(true);
      setError(null);

      logger.info('Auth', 'Sign in attempt', {});
      await firebaseSignIn({ email, password, rememberMe });
      logger.info('Auth', 'Sign in successful', {});
      toast({
        title: "Success!",
        description: "You have been signed in successfully.",
      });
    } catch (firebaseError: any) {
      logger.error('Auth', 'Sign in failed', firebaseError, {});
      
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
      
      logger.info('Auth', 'Sign up attempt', { hasName: !!name });
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
      logger.error('Auth', 'Sign up failed', firebaseError, {});
      
      errorHandler.handleAuthError(firebaseError);
      setError(firebaseError.message || 'An error occurred during sign up');
      
      return { success: false, isConfirmationEmailSent: false };
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async (rememberMe = true) => {
    try {
      setLoading(true);
      setError(null);

      logger.info('Auth', 'Google sign in attempt');
      await firebaseSignInWithGoogle(rememberMe);
      
      logger.info('Auth', 'Google sign in successful');
      toast({
        title: "Success!",
        description: "You have been signed in with Google.",
      });
    } catch (firebaseError: any) {
      if (firebaseError.code === 'auth/popup-closed-by-user' || firebaseError.code === 'auth/cancelled-popup-request') {
        return; // User dismissed the popup — not an error
      }

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
