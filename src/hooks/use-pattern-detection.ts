import { useMemo } from 'react';
import { useCalendarEvents } from './use-calendar-events';
import { generateSmartSuggestions, detectRecurringPatterns } from '@/lib/algorithms/pattern-detection';

export interface PatternStats {
  totalPatterns: number;
  weeklyPatterns: number;
  monthlyPatterns: number;
  dailyPatterns: number;
  detectedPatterns: any[];
}

export function usePatternDetection(): PatternStats {
  const { events } = useCalendarEvents();

  const stats = useMemo(() => {
    if (!events || events.length === 0) {
      return {
        totalPatterns: 0,
        weeklyPatterns: 0,
        monthlyPatterns: 0,
        dailyPatterns: 0,
        detectedPatterns: [],
      };
    }

    // Detect patterns using the algorithm
    const detectedPatterns = generateSmartSuggestions(events);
    const recurringPatterns = detectRecurringPatterns(events);

    // Count patterns by type
    const weeklyRecurring = recurringPatterns.filter(
      p => p.frequency === 'weekly'
    );
    const monthlyRecurring = recurringPatterns.filter(
      p => p.frequency === 'monthly'
    );
    const dailyRecurring = recurringPatterns.filter(
      p => p.frequency === 'daily'
    );

    return {
      totalPatterns: detectedPatterns.length,
      weeklyPatterns: weeklyRecurring.length,
      monthlyPatterns: monthlyRecurring.length,
      dailyPatterns: dailyRecurring.length,
      detectedPatterns,
    };
  }, [events]);

  return stats;
}
