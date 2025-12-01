// Phase 1.2: Analytics Data Collection Hook
// Tracks productivity metrics and event statistics for analytics dashboard

import { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc,
  setDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { CalendarEventType } from '@/lib/stores/types';
import { useCalendarEvents } from './use-calendar-events';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(isBetween);

export interface DailyAnalytics {
  date: string; // YYYY-MM-DD
  eventsCompleted: number;
  totalEventTime: number; // minutes
  pomodoroSessions: number;
  tasksCompleted: number;
  productiveHours: number;
  focusTimeMinutes: number;
  meetingTimeMinutes: number;
  breakTimeMinutes: number;
}

export interface WeeklyAnalytics {
  weekStart: string; // YYYY-MM-DD (Monday)
  weekEnd: string; // YYYY-MM-DD (Sunday)
  totalEvents: number;
  totalEventTime: number;
  averageEventDuration: number;
  mostProductiveDay: string;
  mostProductiveHour: number;
  pomodoroSessions: number;
  tasksCompleted: number;
  dailyBreakdown: DailyAnalytics[];
}

export interface ProductivityMetrics {
  thisWeek: WeeklyAnalytics;
  lastWeek: WeeklyAnalytics;
  thisMonth: {
    totalEvents: number;
    totalHours: number;
    completionRate: number;
    averageDailyEvents: number;
  };
  trends: {
    eventsChange: number; // % change from last week
    productivityChange: number; // % change from last week
    focusTimeChange: number; // % change from last week
  };
}

export interface TimeDistribution {
  category: string;
  minutes: number;
  percentage: number;
  color: string;
}

/**
 * Calculate time spent on events for a given day
 */
function calculateDailyMetrics(
  events: CalendarEventType[],
  date: string
): DailyAnalytics {
  const dayEvents = events.filter((e) => {
    const eventDate = dayjs(e.startsAt).format('YYYY-MM-DD');
    return eventDate === date;
  });

  let totalEventTime = 0;
  let meetingTime = 0;
  let focusTime = 0;
  let breakTime = 0;
  
  dayEvents.forEach((event) => {
    const start = dayjs(event.startsAt);
    const end = dayjs(event.endsAt);
    const duration = end.diff(start, 'minute');
    
    totalEventTime += duration;
    
    // Categorize by event type (based on title/description keywords)
    const eventText = `${event.title} ${event.description}`.toLowerCase();
    if (eventText.includes('meeting') || eventText.includes('call')) {
      meetingTime += duration;
    } else if (eventText.includes('break') || eventText.includes('lunch')) {
      breakTime += duration;
    } else {
      focusTime += duration;
    }
  });

  return {
    date,
    eventsCompleted: dayEvents.length,
    totalEventTime,
    pomodoroSessions: 0, // TODO: Track from Pomodoro module
    tasksCompleted: dayEvents.filter((e) => e.isTodo).length,
    productiveHours: Math.round((totalEventTime / 60) * 10) / 10,
    focusTimeMinutes: focusTime,
    meetingTimeMinutes: meetingTime,
    breakTimeMinutes: breakTime,
  };
}

/**
 * Calculate weekly analytics
 */
function calculateWeeklyMetrics(
  events: CalendarEventType[],
  weekStart: Date
): WeeklyAnalytics {
  const start = dayjs(weekStart).startOf('week');
  const end = start.endOf('week');
  
  const weekEvents = events.filter((e) => {
    const eventDate = dayjs(e.startsAt);
    return eventDate.isBetween(start, end, 'day', '[]');
  });

  // Calculate daily breakdown
  const dailyBreakdown: DailyAnalytics[] = [];
  for (let i = 0; i < 7; i++) {
    const date = start.add(i, 'day').format('YYYY-MM-DD');
    dailyBreakdown.push(calculateDailyMetrics(events, date));
  }

  // Find most productive day
  const mostProductiveDay = dailyBreakdown.reduce((max, day) => 
    day.totalEventTime > max.totalEventTime ? day : max
  , dailyBreakdown[0]);

  // Find most productive hour (across all days)
  const hourDistribution: Record<number, number> = {};
  weekEvents.forEach((event) => {
    const hour = dayjs(event.startsAt).hour();
    hourDistribution[hour] = (hourDistribution[hour] || 0) + 1;
  });
  const mostProductiveHour = Object.entries(hourDistribution)
    .reduce((max, [hour, count]) => count > max.count ? { hour: Number(hour), count } : max, { hour: 9, count: 0 })
    .hour;

  const totalEventTime = dailyBreakdown.reduce((sum, day) => sum + day.totalEventTime, 0);
  const averageEventDuration = weekEvents.length > 0 
    ? Math.round(totalEventTime / weekEvents.length) 
    : 0;

  return {
    weekStart: start.format('YYYY-MM-DD'),
    weekEnd: end.format('YYYY-MM-DD'),
    totalEvents: weekEvents.length,
    totalEventTime,
    averageEventDuration,
    mostProductiveDay: mostProductiveDay.date,
    mostProductiveHour,
    pomodoroSessions: 0, // TODO: Track from Pomodoro module
    tasksCompleted: weekEvents.filter((e) => e.isTodo).length,
    dailyBreakdown,
  };
}

/**
 * Main analytics hook
 */
export function useAnalyticsData() {
  const { user } = useAuth();
  const { events, loading } = useCalendarEvents();
  const [isSyncing, setIsSyncing] = useState(false);

  // Calculate metrics from events
  const metrics = useMemo<ProductivityMetrics | null>(() => {
    if (loading || events.length === 0) return null;

    const today = dayjs();
    const thisWeekStart = today.startOf('week').toDate();
    const lastWeekStart = today.subtract(1, 'week').startOf('week').toDate();
    
    const thisWeek = calculateWeeklyMetrics(events, thisWeekStart);
    const lastWeek = calculateWeeklyMetrics(events, lastWeekStart);

    // Monthly metrics
    const monthStart = today.startOf('month');
    const monthEvents = events.filter((e) => {
      const eventDate = dayjs(e.startsAt);
      return eventDate.isSame(monthStart, 'month');
    });
    
    const totalMonthTime = monthEvents.reduce((sum, e) => {
      const duration = dayjs(e.endsAt).diff(dayjs(e.startsAt), 'minute');
      return sum + duration;
    }, 0);
    
    const daysInMonth = today.daysInMonth();

    // Calculate trends
    const eventsChange = lastWeek.totalEvents > 0
      ? ((thisWeek.totalEvents - lastWeek.totalEvents) / lastWeek.totalEvents) * 100
      : 0;
    
    const productivityChange = lastWeek.totalEventTime > 0
      ? ((thisWeek.totalEventTime - lastWeek.totalEventTime) / lastWeek.totalEventTime) * 100
      : 0;
    
    const thisFocusTime = thisWeek.dailyBreakdown.reduce((sum, d) => sum + d.focusTimeMinutes, 0);
    const lastFocusTime = lastWeek.dailyBreakdown.reduce((sum, d) => sum + d.focusTimeMinutes, 0);
    const focusTimeChange = lastFocusTime > 0
      ? ((thisFocusTime - lastFocusTime) / lastFocusTime) * 100
      : 0;

    return {
      thisWeek,
      lastWeek,
      thisMonth: {
        totalEvents: monthEvents.length,
        totalHours: Math.round((totalMonthTime / 60) * 10) / 10,
        completionRate: monthEvents.length > 0 
          ? (monthEvents.filter(e => e.isTodo).length / monthEvents.length) * 100 
          : 0,
        averageDailyEvents: Math.round((monthEvents.length / daysInMonth) * 10) / 10,
      },
      trends: {
        eventsChange: Math.round(eventsChange * 10) / 10,
        productivityChange: Math.round(productivityChange * 10) / 10,
        focusTimeChange: Math.round(focusTimeChange * 10) / 10,
      },
    };
  }, [events, loading]);

  // Calculate time distribution
  const timeDistribution = useMemo<TimeDistribution[]>(() => {
    if (!metrics) return [];
    
    const { focusTimeMinutes, meetingTimeMinutes, breakTimeMinutes } = 
      metrics.thisWeek.dailyBreakdown.reduce((acc, day) => ({
        focusTimeMinutes: acc.focusTimeMinutes + day.focusTimeMinutes,
        meetingTimeMinutes: acc.meetingTimeMinutes + day.meetingTimeMinutes,
        breakTimeMinutes: acc.breakTimeMinutes + day.breakTimeMinutes,
      }), { focusTimeMinutes: 0, meetingTimeMinutes: 0, breakTimeMinutes: 0 });
    
    const total = focusTimeMinutes + meetingTimeMinutes + breakTimeMinutes;
    
    if (total === 0) return [];
    
    return [
      {
        category: 'Focus Time',
        minutes: focusTimeMinutes,
        percentage: Math.round((focusTimeMinutes / total) * 100),
        color: '#3b82f6', // blue
      },
      {
        category: 'Meetings',
        minutes: meetingTimeMinutes,
        percentage: Math.round((meetingTimeMinutes / total) * 100),
        color: '#8b5cf6', // purple
      },
      {
        category: 'Breaks',
        minutes: breakTimeMinutes,
        percentage: Math.round((breakTimeMinutes / total) * 100),
        color: '#10b981', // green
      },
    ].filter(item => item.minutes > 0);
  }, [metrics]);

  // Save analytics to Firestore (optional - for persistent storage)
  const saveAnalytics = async () => {
    if (!user?.uid || !metrics) return;
    
    try {
      setIsSyncing(true);
      const today = dayjs().format('YYYY-MM-DD');
      const analyticsRef = doc(db, 'analytics', `${user.uid}_${today}`);
      
      await setDoc(analyticsRef, {
        user_id: user.uid,
        date: today,
        ...metrics.thisWeek.dailyBreakdown.find(d => d.date === today),
        updated_at: serverTimestamp(),
      }, { merge: true });
      
      setIsSyncing(false);
    } catch (error) {
      console.error('Error saving analytics:', error);
      setIsSyncing(false);
    }
  };

  // Auto-save analytics at end of day (optional)
  useEffect(() => {
    if (metrics && user?.uid) {
      // Save analytics once per day
      const timer = setTimeout(() => {
        saveAnalytics();
      }, 60000); // Wait 1 minute after page load
      
      return () => clearTimeout(timer);
    }
  }, [metrics, user?.uid]);

  return {
    metrics,
    timeDistribution,
    loading,
    isSyncing,
    saveAnalytics,
  };
}

/**
 * Hook for fetching historical analytics data from Firestore
 */
export function useHistoricalAnalytics(startDate: Date, endDate: Date) {
  const { user } = useAuth();
  const [data, setData] = useState<DailyAnalytics[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setData([]);
      setLoading(false);
      return;
    }

    const start = dayjs(startDate).format('YYYY-MM-DD');
    const end = dayjs(endDate).format('YYYY-MM-DD');

    const analyticsQuery = query(
      collection(db, 'analytics'),
      where('user_id', '==', user.uid),
      where('date', '>=', start),
      where('date', '<=', end)
    );

    const unsubscribe = onSnapshot(analyticsQuery, (snapshot) => {
      const analyticsData = snapshot.docs.map(doc => doc.data() as DailyAnalytics);
      setData(analyticsData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching historical analytics:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid, startDate, endDate]);

  return { data, loading };
}
