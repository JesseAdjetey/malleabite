// Firebase-only configuration (Supabase migration completed)
export const MIGRATION_FLAGS = {
  // All features now use Firebase exclusively
  USE_FIREBASE_AUTH: true,
  USE_FIREBASE_CALENDAR: true,
  USE_FIREBASE_TODOS: true,
  USE_FIREBASE_EISENHOWER: true,
  USE_FIREBASE_REMINDERS: true,
  USE_FIREBASE_AI_FUNCTIONS: true,
  
  // Development helpers
  ENABLE_MIGRATION_LOGS: false, // Disabled since migration is complete
  ENABLE_PERFORMANCE_COMPARISON: false,
} as const;

// Helper function to check if we should use Firebase for a feature
export const shouldUseFirebase = (feature: keyof typeof MIGRATION_FLAGS): boolean => {
  return MIGRATION_FLAGS[feature] === true;
};

// Helper to log migration status (now just logs Firebase usage)
export const logMigrationStatus = (feature: string, backend: 'firebase') => {
  if (MIGRATION_FLAGS.ENABLE_MIGRATION_LOGS) {
    console.log(`✅ ${feature} using ${backend.toUpperCase()}`);
  }
};

export default MIGRATION_FLAGS;
