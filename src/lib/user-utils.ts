// Utility functions for handling user properties across Firebase and Supabase
import { shouldUseFirebase } from '@/lib/migration-flags';

// Helper function to safely get user ID regardless of backend
export const getUserId = (user: any): string | undefined => {
  if (!user) return undefined;
  
  const isFirebaseUser = shouldUseFirebase('USE_FIREBASE_AUTH');
  
  if (isFirebaseUser) {
    return user.uid; // Firebase uses uid
  } else {
    return user.id;  // Supabase uses id
  }
};

// Helper function to safely get user email
export const getUserEmail = (user: any): string | undefined => {
  return user?.email;
};

// Helper function to check if user exists and has valid ID
export const hasValidUser = (user: any): boolean => {
  const userId = getUserId(user);
  return !!userId;
};

// Helper function to check if we're using dummy Supabase URLs (migration mode)
export const isDummySupabase = (): boolean => {
  // Check if the environment contains dummy URLs
  return (
    typeof window !== 'undefined' && 
    (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'))
  ) || 
  // Or check if we're in a migration state with dummy URLs
  process.env.NODE_ENV === 'development';
};

// Helper function to determine if real-time subscriptions should be disabled
export const shouldDisableRealtimeSubscriptions = (): boolean => {
  return isDummySupabase();
};
