import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AnalyticsMetrics {
  totalEvents: number;
  completedEvents: number;
  totalTime: number; // in minutes
  eventsByCategory: Record<string, number>;
  eventsByColor: Record<string, number>;
  timeByCategory: Record<string, number>; // in minutes
  completionRate: number; // percentage
  averageEventDuration: number; // in minutes
  pomodoroSessions: number;
  focusTime: number; // in minutes
  meetingTime: number; // in minutes
  productivityScore: number; // 0-100
}

export interface DailyMetrics extends AnalyticsMetrics {
  date: string; // ISO date string
  hourlyDistribution: Record<number, number>; // hour (0-23) -> event count
  mostProductiveHour: number;
}

export interface WeeklyMetrics {
  weekStart: string; // ISO date string
  weekEnd: string;
  dailyMetrics: DailyMetrics[];
  totalMetrics: AnalyticsMetrics;
  busiestDay: string;
  trend: 'up' | 'down' | 'stable';
}

export interface AnalyticsPreferences {
  showProductivityScore: boolean;
  showInsights: boolean;
  defaultTimeRange: 'week' | 'month' | 'year' | 'all';
  exportFormat: 'csv' | 'pdf' | 'json';
}

interface AnalyticsState {
  // Current metrics
  currentMetrics: AnalyticsMetrics | null;
  dailyMetrics: DailyMetrics[];
  weeklyMetrics: WeeklyMetrics[];
  
  // UI State
  selectedTimeRange: 'week' | 'month' | 'year' | 'all';
  customDateRange: { start: Date | null; end: Date | null };
  isLoading: boolean;
  
  // Preferences
  preferences: AnalyticsPreferences;
  
  // Actions
  setCurrentMetrics: (metrics: AnalyticsMetrics) => void;
  addDailyMetrics: (metrics: DailyMetrics) => void;
  addWeeklyMetrics: (metrics: WeeklyMetrics) => void;
  setTimeRange: (range: 'week' | 'month' | 'year' | 'all') => void;
  setCustomDateRange: (start: Date | null, end: Date | null) => void;
  setLoading: (loading: boolean) => void;
  updatePreferences: (preferences: Partial<AnalyticsPreferences>) => void;
  clearMetrics: () => void;
}

const defaultMetrics: AnalyticsMetrics = {
  totalEvents: 0,
  completedEvents: 0,
  totalTime: 0,
  eventsByCategory: {},
  eventsByColor: {},
  timeByCategory: {},
  completionRate: 0,
  averageEventDuration: 0,
  pomodoroSessions: 0,
  focusTime: 0,
  meetingTime: 0,
  productivityScore: 0,
};

const defaultPreferences: AnalyticsPreferences = {
  showProductivityScore: true,
  showInsights: true,
  defaultTimeRange: 'week',
  exportFormat: 'csv',
};

export const useAnalyticsStore = create<AnalyticsState>()(
  persist(
    (set) => ({
      // Initial state
      currentMetrics: null,
      dailyMetrics: [],
      weeklyMetrics: [],
      selectedTimeRange: 'week',
      customDateRange: { start: null, end: null },
      isLoading: false,
      preferences: defaultPreferences,

      // Actions
      setCurrentMetrics: (metrics) =>
        set({ currentMetrics: metrics }),

      addDailyMetrics: (metrics) =>
        set((state) => ({
          dailyMetrics: [...state.dailyMetrics, metrics],
        })),

      addWeeklyMetrics: (metrics) =>
        set((state) => ({
          weeklyMetrics: [...state.weeklyMetrics, metrics],
        })),

      setTimeRange: (range) =>
        set({ selectedTimeRange: range }),

      setCustomDateRange: (start, end) =>
        set({ customDateRange: { start, end } }),

      setLoading: (loading) =>
        set({ isLoading: loading }),

      updatePreferences: (preferences) =>
        set((state) => ({
          preferences: { ...state.preferences, ...preferences },
        })),

      clearMetrics: () =>
        set({
          currentMetrics: defaultMetrics,
          dailyMetrics: [],
          weeklyMetrics: [],
        }),
    }),
    {
      name: 'malleabite-analytics-storage',
      partialize: (state) => ({
        preferences: state.preferences,
        selectedTimeRange: state.selectedTimeRange,
      }),
    }
  )
);
