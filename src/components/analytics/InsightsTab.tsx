import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Lightbulb,
  Sun,
  Clock,
  TrendingUp,
  TrendingDown,
  Shield,
  Target,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { ProductivityMetrics, TimeDistribution } from '@/hooks/use-analytics-data';

interface InsightsTabProps {
  metrics: ProductivityMetrics;
  timeDistribution: TimeDistribution[];
}

interface Insight {
  icon: React.ReactNode;
  title: string;
  description: string;
  type: 'positive' | 'warning' | 'neutral';
}

export function InsightsTab({ metrics, timeDistribution }: InsightsTabProps) {
  const insights = useMemo<Insight[]>(() => {
    const result: Insight[] = [];
    const { thisWeek, trends } = metrics;

    // Most productive day
    if (thisWeek.mostProductiveDay) {
      result.push({
        icon: <Sun className="h-5 w-5" />,
        title: `${thisWeek.mostProductiveDay} is your power day`,
        description: `You get the most done on ${thisWeek.mostProductiveDay}s. Consider scheduling your most important tasks then.`,
        type: 'positive',
      });
    }

    // Peak hour
    if (thisWeek.mostProductiveHour !== undefined) {
      const hour = thisWeek.mostProductiveHour;
      const period = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      result.push({
        icon: <Clock className="h-5 w-5" />,
        title: `Peak productivity at ${displayHour}:00 ${period}`,
        description: `You're most active around ${displayHour} ${period}. Protect this time for deep work and avoid scheduling meetings here.`,
        type: 'neutral',
      });
    }

    // Focus vs meeting ratio
    const focusMinutes = thisWeek.dailyBreakdown.reduce((s, d) => s + d.focusTimeMinutes, 0);
    const meetingMinutes = thisWeek.dailyBreakdown.reduce((s, d) => s + d.meetingTimeMinutes, 0);
    if (meetingMinutes > focusMinutes && focusMinutes + meetingMinutes > 0) {
      result.push({
        icon: <AlertTriangle className="h-5 w-5" />,
        title: 'Meetings outweigh focus time',
        description: `You spent ${Math.round(meetingMinutes / 60)}h in meetings vs ${Math.round(focusMinutes / 60)}h of focus time. Consider blocking off dedicated focus hours.`,
        type: 'warning',
      });
    } else if (focusMinutes > meetingMinutes * 2 && focusMinutes > 0) {
      result.push({
        icon: <Shield className="h-5 w-5" />,
        title: 'Great focus-to-meeting ratio',
        description: `You maintained a strong focus-to-meeting ratio this week. Keep protecting your deep work time.`,
        type: 'positive',
      });
    }

    // Trend insights
    if (trends.eventsChange > 20) {
      result.push({
        icon: <TrendingUp className="h-5 w-5" />,
        title: 'Activity is ramping up',
        description: `Your events increased by ${trends.eventsChange.toFixed(0)}% compared to last week. Make sure to balance workload with rest.`,
        type: 'neutral',
      });
    } else if (trends.eventsChange < -20) {
      result.push({
        icon: <TrendingDown className="h-5 w-5" />,
        title: 'Lighter week than usual',
        description: `Activity dropped by ${Math.abs(trends.eventsChange).toFixed(0)}% from last week. This could be a good time for planning and reflection.`,
        type: 'neutral',
      });
    }

    if (trends.focusTimeChange > 15) {
      result.push({
        icon: <Zap className="h-5 w-5" />,
        title: 'Focus time is trending up',
        description: `You increased focus time by ${trends.focusTimeChange.toFixed(0)}% this week. Great momentum for deep work.`,
        type: 'positive',
      });
    } else if (trends.focusTimeChange < -15) {
      result.push({
        icon: <Target className="h-5 w-5" />,
        title: 'Focus time dropped',
        description: `Focus time decreased by ${Math.abs(trends.focusTimeChange).toFixed(0)}%. Try blocking uninterrupted time slots this week.`,
        type: 'warning',
      });
    }

    // Average event duration insight
    if (thisWeek.averageEventDuration > 90) {
      result.push({
        icon: <Clock className="h-5 w-5" />,
        title: 'Long events this week',
        description: `Your average event is ${thisWeek.averageEventDuration} minutes. Consider breaking longer sessions into focused 60-minute blocks.`,
        type: 'neutral',
      });
    }

    // If not many insights, add a general one
    if (result.length < 3) {
      result.push({
        icon: <Lightbulb className="h-5 w-5" />,
        title: 'Keep building data',
        description: 'The more you use Malleabite, the more personalized your insights become. Keep adding events and tracking your time.',
        type: 'neutral',
      });
    }

    return result;
  }, [metrics, timeDistribution]);

  const typeStyles = {
    positive: 'border-green-500/30 bg-green-500/5',
    warning: 'border-amber-500/30 bg-amber-500/5',
    neutral: 'border-border',
  };

  const iconStyles = {
    positive: 'bg-green-500/20 text-green-500',
    warning: 'bg-amber-500/20 text-amber-500',
    neutral: 'bg-primary/20 text-primary',
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Productivity Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {insights.map((insight, i) => (
            <div
              key={i}
              className={`flex items-start gap-4 p-4 rounded-lg border ${typeStyles[insight.type]}`}
            >
              <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${iconStyles[insight.type]}`}>
                {insight.icon}
              </div>
              <div>
                <h4 className="font-medium">{insight.title}</h4>
                <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
