// Productivity Score Visualization Component
// Shows large score display, trend chart, and breakdown of factors

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  Clock,
  Target,
  Zap,
  Award,
} from 'lucide-react';
import { useAnalyticsStore } from '@/lib/stores/analytics-store';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { calculateMetrics } from '@/lib/utils/analytics-calculator';
import dayjs from 'dayjs';

interface ScoreFactor {
  name: string;
  value: number;
  max: number;
  description: string;
  icon: any;
  color: string;
}

export function ProductivityScore() {
  const { currentMetrics } = useAnalyticsStore();
  const { events } = useCalendarEvents();

  // Calculate current score
  const score = currentMetrics?.productivityScore || 0;

  // Calculate previous week's score for trend
  const previousWeekScore = useMemo(() => {
    const lastWeekStart = dayjs().subtract(1, 'week').startOf('week');
    const lastWeekEnd = dayjs().subtract(1, 'week').endOf('week');

    const lastWeekEvents = events.filter((e) => {
      const eventDate = dayjs(e.date);
      return eventDate.isAfter(lastWeekStart) && eventDate.isBefore(lastWeekEnd);
    });

    const metrics = calculateMetrics(lastWeekEvents);
    return metrics.productivityScore;
  }, [events]);

  // Calculate trend
  const trend = score - previousWeekScore;
  const trendPercentage = previousWeekScore > 0 ? (trend / previousWeekScore) * 100 : 0;

  // Score breakdown factors
  const factors: ScoreFactor[] = useMemo(() => {
    if (!currentMetrics) return [];

    const completionScore = (currentMetrics.completionRate / 100) * 30;
    const focusRatio =
      currentMetrics.totalTime > 0 ? currentMetrics.focusTime / currentMetrics.totalTime : 0;
    const focusScore = focusRatio * 25;

    const idealDuration = 60;
    const durationScore = Math.max(
      0,
      20 - Math.abs(currentMetrics.averageEventDuration - idealDuration) / 3
    );

    const pomodoroScore = Math.min(15, currentMetrics.pomodoroSessions * 2);

    const optimalDailyMinutes = 5 * 60;
    const timeScore = Math.min(10, (currentMetrics.focusTime / optimalDailyMinutes) * 10);

    return [
      {
        name: 'Task Completion',
        value: Math.round(completionScore),
        max: 30,
        description: `${Math.round(currentMetrics.completionRate)}% of events completed`,
        icon: CheckCircle2,
        color: 'green',
      },
      {
        name: 'Focus Time',
        value: Math.round(focusScore),
        max: 25,
        description: `${Math.round(focusRatio * 100)}% time in deep work`,
        icon: Target,
        color: 'blue',
      },
      {
        name: 'Optimal Duration',
        value: Math.round(durationScore),
        max: 20,
        description: `Avg ${Math.round(currentMetrics.averageEventDuration)} min per event`,
        icon: Clock,
        color: 'purple',
      },
      {
        name: 'Pomodoro Sessions',
        value: Math.round(pomodoroScore),
        max: 15,
        description: `${currentMetrics.pomodoroSessions} focused sessions`,
        icon: Zap,
        color: 'yellow',
      },
      {
        name: 'Total Productive Time',
        value: Math.round(timeScore),
        max: 10,
        description: `${Math.round(currentMetrics.focusTime / 60)} hours of focus time`,
        icon: TrendingUp,
        color: 'indigo',
      },
    ];
  }, [currentMetrics]);

  // Score rating and color
  const getScoreRating = (score: number) => {
    if (score >= 90) return { label: 'Exceptional', color: 'text-green-600 dark:text-green-400' };
    if (score >= 80) return { label: 'Excellent', color: 'text-green-600 dark:text-green-400' };
    if (score >= 70) return { label: 'Great', color: 'text-blue-600 dark:text-blue-400' };
    if (score >= 60) return { label: 'Good', color: 'text-blue-600 dark:text-blue-400' };
    if (score >= 50) return { label: 'Fair', color: 'text-yellow-600 dark:text-yellow-400' };
    if (score >= 40) return { label: 'Needs Work', color: 'text-orange-600 dark:text-orange-400' };
    return { label: 'Low', color: 'text-red-600 dark:text-red-400' };
  };

  const rating = getScoreRating(score);

  // Circle progress
  const circumference = 2 * Math.PI * 70;
  const progressOffset = circumference - (score / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* Main Score Display */}
      <Card className="p-8 text-center bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Award className="h-6 w-6 text-purple-500" />
          <h2 className="text-xl font-semibold">Productivity Score</h2>
        </div>

        {/* Score Circle */}
        <div className="relative w-48 h-48 mx-auto my-6">
          <svg className="w-full h-full transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="96"
              cy="96"
              r="70"
              stroke="currentColor"
              strokeWidth="12"
              fill="none"
              className="text-gray-200 dark:text-gray-700"
            />
            {/* Progress circle */}
            <circle
              cx="96"
              cy="96"
              r="70"
              stroke="currentColor"
              strokeWidth="12"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={progressOffset}
              strokeLinecap="round"
              className="text-purple-500 transition-all duration-1000"
            />
          </svg>
          {/* Score text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-5xl font-bold text-purple-600 dark:text-purple-400">{score}</div>
            <div className="text-sm text-muted-foreground">out of 100</div>
          </div>
        </div>

        {/* Rating Badge */}
        <Badge variant="default" className={`text-lg px-4 py-1 ${rating.color}`}>
          {rating.label}
        </Badge>

        {/* Trend Indicator */}
        {previousWeekScore > 0 && (
          <div className="flex items-center justify-center gap-2 mt-4 text-sm">
            {trend > 0 ? (
              <>
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-green-600 dark:text-green-400 font-medium">
                  +{Math.abs(trend)} points ({Math.abs(Math.round(trendPercentage))}%)
                </span>
                <span className="text-muted-foreground">from last week</span>
              </>
            ) : trend < 0 ? (
              <>
                <TrendingDown className="h-4 w-4 text-red-500" />
                <span className="text-red-600 dark:text-red-400 font-medium">
                  {trend} points ({Math.abs(Math.round(trendPercentage))}%)
                </span>
                <span className="text-muted-foreground">from last week</span>
              </>
            ) : (
              <>
                <Minus className="h-4 w-4 text-gray-500" />
                <span className="text-muted-foreground">No change from last week</span>
              </>
            )}
          </div>
        )}
      </Card>

      {/* Score Breakdown */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Score Breakdown</h3>
        <div className="space-y-3">
          {factors.map((factor, index) => {
            const Icon = factor.icon;
            const percentage = (factor.value / factor.max) * 100;

            return (
              <Card key={index} className="p-4 hover:bg-accent/50 dark:hover:bg-accent/20 transition-colors border-2 border-transparent hover:border-purple-200 dark:hover:border-purple-800">
                <div className="flex items-start gap-3 mb-2">
                  <div
                    className={`p-2 rounded-lg bg-${factor.color}-100 dark:bg-${factor.color}-950`}
                  >
                    <Icon
                      className={`h-4 w-4 text-${factor.color}-600 dark:text-${factor.color}-400`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-medium">{factor.name}</h4>
                      <Badge variant="secondary">
                        {factor.value}/{factor.max}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{factor.description}</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`bg-${factor.color}-500 h-2 rounded-full transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Tips to Improve */}
      <Card className="p-4 border-l-4 border-purple-500">
        <div className="flex items-start gap-3">
          <TrendingUp className="h-5 w-5 text-purple-500 mt-0.5" />
          <div>
            <h4 className="font-semibold mb-2">Tips to Improve Your Score</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {score < 70 && (
                <>
                  <li>• Complete more of your scheduled tasks to boost completion rate</li>
                  <li>• Block out dedicated focus time for deep work sessions</li>
                  <li>• Use 25-minute Pomodoro sessions for better concentration</li>
                </>
              )}
              {score >= 70 && score < 90 && (
                <>
                  <li>• Maintain your current productivity habits</li>
                  <li>• Try to increase your focus time ratio</li>
                  <li>• Optimize event durations for peak efficiency</li>
                </>
              )}
              {score >= 90 && (
                <>
                  <li>• Excellent work! Keep up your productivity habits</li>
                  <li>• Share your strategies with your team</li>
                  <li>• Consider mentoring others on time management</li>
                </>
              )}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
