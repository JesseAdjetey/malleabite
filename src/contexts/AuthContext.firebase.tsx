import * as React from 'react';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  User,
  signIn as firebaseSignIn,
  signUp as firebaseSignUp,
  signOutUser,
  onAuthStateChange,
  AuthError
} from '@/integrations/firebase/auth';
import { toast } from '@/components/ui/use-toast';

interface AuthContextType {
  user: User | null;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<{success: boolean; isConfirmationEmailSent: boolean}>;
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
      console.log('Firebase auth state changed:', firebaseUser?.email);
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
      
      await firebaseSignIn({ email, password });
      
      toast({
        title: "Success!",
        description: "You have been signed in successfully.",
      });
    } catch (firebaseError: any) {
      const errorMessage = firebaseError.message || 'An error occurred during sign in';
      setError(errorMessage);
      toast({
        title: "Error signing in",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const userCredential = await firebaseSignUp({ 
        email, 
        password,
        displayName: name
      });
      
      // Firebase automatically sends email verification
      const isConfirmationEmailSent = !userCredential.user.emailVerified;
      
      toast({
        title: "Account created!",
        description: isConfirmationEmailSent 
          ? "Please check your email to verify your account." 
          : "Your account has been created successfully.",
      });
      
      return { success: true, isConfirmationEmailSent };
    } catch (firebaseError: any) {
      const errorMessage = firebaseError.message || 'An error occurred during sign up';
      setError(errorMessage);
      toast({
        title: "Error creating account",
        description: errorMessage,
        variant: "destructive",
      });
      return { success: false, isConfirmationEmailSent: false };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      setError(null);
      
      await signOutUser();
      
      // State will be cleared automatically by the auth state listener
      toast({
        title: "Signed out",
        description: "You have been signed out successfully.",
      });
    } catch (firebaseError: any) {
      const errorMessage = firebaseError.message || 'An error occurred during sign out';
      setError(errorMessage);
      toast({
        title: "Error signing out",
        description: errorMessage,
        variant: "destructive",
      });
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
