import { create } from 'zustand';
import { CalendarPreferences } from '@/types/calendar';

interface CalendarPreferencesStore {
  preferences: CalendarPreferences | null;
  pendingUpdates: Partial<CalendarPreferences>;
  loading: boolean;
  error: string | null;
  setPreferences: (preferences: CalendarPreferences | null) => void;
  setPendingUpdates: (updates: Partial<CalendarPreferences>) => void;
  clearPendingUpdates: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const useCalendarPreferencesStore = create<CalendarPreferencesStore>((set) => ({
  preferences: null,
  pendingUpdates: {},
  loading: true,
  error: null,
  setPreferences: (preferences) => set({ preferences }),
  setPendingUpdates: (updates) => set((state) => ({
    pendingUpdates: { ...state.pendingUpdates, ...updates }
  })),
  clearPendingUpdates: () => set({ pendingUpdates: {} }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  clear: () => set({ preferences: null, pendingUpdates: {}, loading: true, error: null }),
}));
