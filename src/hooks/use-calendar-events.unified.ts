// Unified calendar events hook that can use either Supabase or Firebase
import { shouldUseFirebase, logMigrationStatus } from '@/lib/migration-flags';
import { useEffect } from 'react';

// Import both implementations  
import { useCalendarEvents as useSupabaseCalendarEvents } from './use-calendar-events';
import { useCalendarEvents as useFirebaseCalendarEvents } from './use-calendar-events.firebase';

export const useCalendarEvents = () => {
  const shouldUseFirebaseCalendar = shouldUseFirebase('USE_FIREBASE_CALENDAR');
  
  useEffect(() => {
    logMigrationStatus('Calendar Events', shouldUseFirebaseCalendar ? 'firebase' : 'supabase');
  }, [shouldUseFirebaseCalendar]);

  if (shouldUseFirebaseCalendar) {
    return useFirebaseCalendarEvents();
  }
  
  return useSupabaseCalendarEvents();
};
