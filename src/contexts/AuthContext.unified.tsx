// Firebase-only AuthContext (Supabase completely removed)
import * as React from 'react';

// Import Firebase implementation only
import { AuthProvider as FirebaseAuthProvider, useAuth as useFirebaseAuth } from './AuthContext.firebase';

// Export Firebase implementation as the unified implementation
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  return <FirebaseAuthProvider>{children}</FirebaseAuthProvider>;
};

// Export Firebase auth hook as the unified hook
export const useAuth = () => {
  return useFirebaseAuth();
};
