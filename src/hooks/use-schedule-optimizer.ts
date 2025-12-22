// Hook for AI Schedule Optimization
import { useState, useEffect, useMemo, useCallback } from 'react';
import { CalendarEventType } from '@/lib/stores/types';
import {
  analyzeUserPatterns,
  findOptimalTimeSlots,
  generateScheduleSuggestions,
  detectConflicts,
  suggestEventDuration,
  UserPatterns,
  TimeSlot,
  ScheduleSuggestion,
} from '@/lib/ai/schedule-optimizer';

export function useScheduleOptimizer(events: CalendarEventType[]) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Memoize user patterns - only recalculate when events change significantly
  const patterns = useMemo(() => {
    if (events.length === 0) return null;
    return analyzeUserPatterns(events);
  }, [events.length > 0 ? Math.floor(events.length / 10) : 0]); // Recalc every 10 events

  // Get suggestions
  const suggestions = useMemo(() => {
    if (!patterns) return [];
    return generateScheduleSuggestions(events, patterns);
  }, [events, patterns]);

  // Get conflicts
  const conflicts = useMemo(() => {
    return detectConflicts(events);
  }, [events]);

  // Find optimal times for a specific date
  const getOptimalTimes = useCallback((date: Date, duration?: number): TimeSlot[] => {
    if (!patterns) return [];
    return findOptimalTimeSlots(events, date, duration, patterns);
  }, [events, patterns]);

  // Suggest duration for event title
  const getDurationSuggestion = useCallback((title: string): number => {
    return suggestEventDuration(title);
  }, []);

  return {
    patterns,
    suggestions,
    conflicts,
    getOptimalTimes,
    getDurationSuggestion,
    isAnalyzing,
    hasConflicts: conflicts.length > 0,
    conflictCount: conflicts.length,
  };
}

export type { UserPatterns, TimeSlot, ScheduleSuggestion };
