import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { CalendarEventType } from '@/lib/stores/types';
import { AnalyticsMetrics, DailyMetrics, WeeklyMetrics } from '@/lib/stores/analytics-store';

dayjs.extend(isBetween);

/**
 * Calculate comprehensive analytics metrics from calendar events
 */
export function calculateMetrics(events: CalendarEventType[]): AnalyticsMetrics {
  if (!events || events.length === 0) {
    return {
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
  }

  const totalEvents = events.length;
  const completedEvents = events.filter((e) => e.isTodo).length; // Count todo items
  const completionRate = totalEvents > 0 ? (completedEvents / totalEvents) * 100 : 0;

  // Calculate time metrics
  let totalTime = 0;
  let focusTime = 0;
  let meetingTime = 0;
  let pomodoroSessions = 0;
  const eventsByCategory: Record<string, number> = {};
  const eventsByColor: Record<string, number> = {};
  const timeByCategory: Record<string, number> = {};

  events.forEach((event) => {
    const start = dayjs(event.startsAt);
    const end = dayjs(event.endsAt);
    const duration = end.diff(start, 'minute');

    totalTime += duration;

    // Category tracking (use color as category for now)
    const category = event.color || 'uncategorized';
    eventsByCategory[category] = (eventsByCategory[category] || 0) + 1;
    timeByCategory[category] = (timeByCategory[category] || 0) + duration;

    // Color tracking
    const color = event.color || 'blue';
    eventsByColor[color] = (eventsByColor[color] || 0) + 1;

    // Focus vs Meeting time (heuristic based on title)
    const title = event.title.toLowerCase();
    const isMeeting = title.includes('meeting') || 
                      title.includes('call') || 
                      title.includes('interview');
    
    if (isMeeting) {
      meetingTime += duration;
    } else {
      focusTime += duration;
    }

    // Pomodoro detection (25-minute sessions)
    if (duration >= 20 && duration <= 30) {
      pomodoroSessions++;
    }
  });

  const averageEventDuration = totalEvents > 0 ? totalTime / totalEvents : 0;

  // Calculate productivity score (0-100)
  const productivityScore = calculateProductivityScore({
    completionRate,
    focusTime,
    meetingTime,
    totalTime,
    averageEventDuration,
    pomodoroSessions,
  });

  return {
    totalEvents,
    completedEvents,
    totalTime,
    eventsByCategory,
    eventsByColor,
    timeByCategory,
    completionRate,
    averageEventDuration,
    pomodoroSessions,
    focusTime,
    meetingTime,
    productivityScore,
  };
}

/**
 * Calculate daily metrics with hourly distribution
 */
export function calculateDailyMetrics(
  date: Date,
  events: CalendarEventType[]
): DailyMetrics {
  const dayStart = dayjs(date).startOf('day');
  const dayEnd = dayjs(date).endOf('day');

  // Filter events for this day
  const dayEvents = events.filter((event) => {
    const eventStart = dayjs(event.startsAt);
    return eventStart.isBetween(dayStart, dayEnd, null, '[]');
  });

  const baseMetrics = calculateMetrics(dayEvents);

  // Calculate hourly distribution
  const hourlyDistribution: Record<number, number> = {};
  dayEvents.forEach((event) => {
    const hour = dayjs(event.startsAt).hour();
    hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;
  });

  // Find most productive hour
  let mostProductiveHour = 9; // default
  let maxEvents = 0;
  Object.entries(hourlyDistribution).forEach(([hour, count]) => {
    if (count > maxEvents) {
      maxEvents = count;
      mostProductiveHour = parseInt(hour);
    }
  });

  return {
    ...baseMetrics,
    date: dayStart.toISOString(),
    hourlyDistribution,
    mostProductiveHour,
  };
}

/**
 * Calculate weekly metrics with daily breakdown
 */
export function calculateWeeklyMetrics(
  weekStart: Date,
  events: CalendarEventType[]
): WeeklyMetrics {
  const start = dayjs(weekStart).startOf('week');
  const end = start.endOf('week');

  // Calculate daily metrics for each day of the week
  const dailyMetrics: DailyMetrics[] = [];
  for (let i = 0; i < 7; i++) {
    const date = start.add(i, 'day').toDate();
    dailyMetrics.push(calculateDailyMetrics(date, events));
  }

  // Filter events for this week
  const weekEvents = events.filter((event) => {
    const eventStart = dayjs(event.startsAt);
    return eventStart.isBetween(start, end, null, '[]');
  });

  const totalMetrics = calculateMetrics(weekEvents);

  // Find busiest day
  let busiestDay = start.format('YYYY-MM-DD');
  let maxDayEvents = 0;
  dailyMetrics.forEach((day) => {
    if (day.totalEvents > maxDayEvents) {
      maxDayEvents = day.totalEvents;
      busiestDay = day.date;
    }
  });

  // Calculate trend (compare to previous week if available)
  const trend: 'up' | 'down' | 'stable' = 'stable'; // TODO: Implement trend calculation

  return {
    weekStart: start.toISOString(),
    weekEnd: end.toISOString(),
    dailyMetrics,
    totalMetrics,
    busiestDay,
    trend,
  };
}

/**
 * Calculate productivity score based on multiple factors
 */
function calculateProductivityScore(factors: {
  completionRate: number;
  focusTime: number;
  meetingTime: number;
  totalTime: number;
  averageEventDuration: number;
  pomodoroSessions: number;
}): number {
  let score = 0;

  // Factor 1: Completion rate (0-30 points)
  score += (factors.completionRate / 100) * 30;

  // Factor 2: Focus vs Meeting time ratio (0-25 points)
  if (factors.totalTime > 0) {
    const focusRatio = factors.focusTime / factors.totalTime;
    score += focusRatio * 25;
  }

  // Factor 3: Optimal event duration (0-20 points)
  // Ideal: 45-90 minutes (deep work sessions)
  const idealDuration = 60;
  const durationScore = Math.max(
    0,
    20 - Math.abs(factors.averageEventDuration - idealDuration) / 3
  );
  score += durationScore;

  // Factor 4: Pomodoro sessions (0-15 points)
  const pomodoroScore = Math.min(15, factors.pomodoroSessions * 2);
  score += pomodoroScore;

  // Factor 5: Total productive time (0-10 points)
  // Optimal: 4-6 hours of deep work per day
  const optimalDailyMinutes = 5 * 60; // 5 hours
  const timeScore = Math.min(
    10,
    (factors.focusTime / optimalDailyMinutes) * 10
  );
  score += timeScore;

  return Math.round(Math.min(100, Math.max(0, score)));
}

/**
 * Get time range filter for events
 */
export function getTimeRangeFilter(
  range: 'week' | 'month' | 'year' | 'all',
  customStart?: Date,
  customEnd?: Date
): { start: Date; end: Date } | null {
  if (customStart && customEnd) {
    return { start: customStart, end: customEnd };
  }

  const now = dayjs();

  switch (range) {
    case 'week':
      return {
        start: now.startOf('week').toDate(),
        end: now.endOf('week').toDate(),
      };
    case 'month':
      return {
        start: now.startOf('month').toDate(),
        end: now.endOf('month').toDate(),
      };
    case 'year':
      return {
        start: now.startOf('year').toDate(),
        end: now.endOf('year').toDate(),
      };
    case 'all':
      return null; // No filter
    default:
      return null;
  }
}

/**
 * Filter events by time range
 */
export function filterEventsByTimeRange(
  events: CalendarEventType[],
  range: 'week' | 'month' | 'year' | 'all',
  customStart?: Date,
  customEnd?: Date
): CalendarEventType[] {
  const filter = getTimeRangeFilter(range, customStart, customEnd);

  if (!filter) {
    return events; // Return all events
  }

  const { start, end } = filter;
  return events.filter((event) => {
    const eventStart = dayjs(event.startsAt);
    return eventStart.isBetween(start, end, null, '[]');
  });
}

/**
 * Export metrics to CSV format
 */
export function exportToCSV(metrics: AnalyticsMetrics): string {
  const rows = [
    ['Metric', 'Value'],
    ['Total Events', metrics.totalEvents.toString()],
    ['Completed Events', metrics.completedEvents.toString()],
    ['Completion Rate', `${metrics.completionRate.toFixed(1)}%`],
    ['Total Time (hours)', (metrics.totalTime / 60).toFixed(1)],
    ['Average Event Duration (minutes)', metrics.averageEventDuration.toFixed(0)],
    ['Focus Time (hours)', (metrics.focusTime / 60).toFixed(1)],
    ['Meeting Time (hours)', (metrics.meetingTime / 60).toFixed(1)],
    ['Pomodoro Sessions', metrics.pomodoroSessions.toString()],
    ['Productivity Score', metrics.productivityScore.toString()],
    [],
    ['Events by Category', 'Count'],
    ...Object.entries(metrics.eventsByCategory).map(([category, count]) => [
      category,
      count.toString(),
    ]),
    [],
    ['Time by Category (hours)', 'Hours'],
    ...Object.entries(metrics.timeByCategory).map(([category, minutes]) => [
      category,
      (minutes / 60).toFixed(1),
    ]),
  ];

  return rows.map((row) => row.join(',')).join('\n');
}

/**
 * Export metrics to JSON format
 */
export function exportToJSON(metrics: AnalyticsMetrics): string {
  return JSON.stringify(metrics, null, 2);
}
