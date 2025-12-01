// Learning Insights Dashboard
// Shows detected patterns, preferences, and AI-powered suggestions

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Brain,
  Clock,
  TrendingUp,
  Users,
  Coffee,
  Zap,
  Target,
  Calendar,
  Sun,
  Moon,
  CloudRain,
} from 'lucide-react';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(isBetween);

interface Pattern {
  type: string;
  description: string;
  confidence: number;
  icon: any;
  color: string;
  suggestion?: string;
}

export function LearningInsights() {
  const { events } = useCalendarEvents();

  // Analyze patterns from events
  const patterns = useMemo(() => {
    const detectedPatterns: Pattern[] = [];

    if (events.length === 0) {
      return [];
    }

    // 1. Preferred Meeting Times
    const meetingHours: Record<number, number> = {};
    events.forEach((event) => {
      const hour = dayjs(event.startsAt).hour();
      meetingHours[hour] = (meetingHours[hour] || 0) + 1;
    });

    const mostCommonHour = Object.entries(meetingHours).sort(
      ([, a], [, b]) => (b as number) - (a as number)
    )[0];

    if (mostCommonHour) {
      const [hour, count] = mostCommonHour;
      const confidence = Math.min(100, (count / events.length) * 100);
      detectedPatterns.push({
        type: 'Preferred Time',
        description: `You schedule most events around ${formatHour(Number(hour))}`,
        confidence,
        icon: Clock,
        color: 'blue',
        suggestion: `Continue scheduling important tasks during this peak productivity window.`,
      });
    }

    // 2. Morning vs Evening Person
    const morningEvents = events.filter((e) => dayjs(e.startsAt).hour() < 12).length;
    const afternoonEvents = events.filter(
      (e) => dayjs(e.startsAt).hour() >= 12 && dayjs(e.startsAt).hour() < 17
    ).length;
    const eveningEvents = events.filter((e) => dayjs(e.startsAt).hour() >= 17).length;

    if (morningEvents > afternoonEvents && morningEvents > eveningEvents) {
      detectedPatterns.push({
        type: 'Morning Person',
        description: `${Math.round((morningEvents / events.length) * 100)}% of events are before noon`,
        confidence: (morningEvents / events.length) * 100,
        icon: Sun,
        color: 'yellow',
        suggestion: 'Schedule your most important tasks in the morning for maximum productivity.',
      });
    } else if (eveningEvents > morningEvents) {
      detectedPatterns.push({
        type: 'Evening Person',
        description: `${Math.round((eveningEvents / events.length) * 100)}% of events are after 5 PM`,
        confidence: (eveningEvents / events.length) * 100,
        icon: Moon,
        color: 'purple',
        suggestion: 'Your productivity peaks later in the day. Reserve evenings for deep work.',
      });
    }

    // 3. Average Event Duration
    const avgDuration =
      events.reduce((sum, e) => {
        return sum + dayjs(e.endsAt).diff(dayjs(e.startsAt), 'minute');
      }, 0) / events.length;

    if (avgDuration < 30) {
      detectedPatterns.push({
        type: 'Quick Tasks',
        description: `Average event is ${Math.round(avgDuration)} minutes`,
        confidence: 85,
        icon: Zap,
        color: 'green',
        suggestion: 'You prefer short, focused sessions. Try time-blocking in 25-minute intervals.',
      });
    } else if (avgDuration > 90) {
      detectedPatterns.push({
        type: 'Deep Work Sessions',
        description: `Average event is ${Math.round(avgDuration)} minutes`,
        confidence: 85,
        icon: Target,
        color: 'indigo',
        suggestion: 'You work best in long, uninterrupted blocks. Protect these from interruptions.',
      });
    }

    // 4. Weekly Pattern
    const dayOfWeek: Record<number, number> = {};
    events.forEach((event) => {
      const day = dayjs(event.date).day();
      dayOfWeek[day] = (dayOfWeek[day] || 0) + 1;
    });

    const busiestDay = Object.entries(dayOfWeek).sort(
      ([, a], [, b]) => (b as number) - (a as number)
    )[0];

    if (busiestDay) {
      const [day, count] = busiestDay;
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
        Number(day)
      ];
      detectedPatterns.push({
        type: 'Busiest Day',
        description: `${dayName} is your busiest day with ${count} events`,
        confidence: 80,
        icon: Calendar,
        color: 'red',
        suggestion: `Consider moving non-urgent tasks from ${dayName} to lighter days.`,
      });
    }

    // 5. Break Pattern Detection
    const eventsWithBreaks = events.filter((event, index) => {
      if (index === 0) return false;
      const prevEvent = events[index - 1];
      if (dayjs(event.date).isSame(prevEvent.date, 'day')) {
        const gap = dayjs(event.startsAt).diff(dayjs(prevEvent.endsAt), 'minute');
        return gap >= 15 && gap <= 60;
      }
      return false;
    });

    if (eventsWithBreaks.length > events.length * 0.3) {
      detectedPatterns.push({
        type: 'Break Conscious',
        description: `You schedule breaks between ${Math.round((eventsWithBreaks.length / events.length) * 100)}% of events`,
        confidence: 75,
        icon: Coffee,
        color: 'orange',
        suggestion: 'Great job taking breaks! Consistent breaks improve focus and prevent burnout.',
      });
    }

    // 6. Completion Pattern (if available)
    const completedEvents = events.filter((e: any) => e.completed).length;
    if (completedEvents > 0) {
      const completionRate = (completedEvents / events.length) * 100;
      if (completionRate >= 80) {
        detectedPatterns.push({
          type: 'High Achiever',
          description: `${Math.round(completionRate)}% completion rate`,
          confidence: completionRate,
          icon: TrendingUp,
          color: 'green',
          suggestion: "You're crushing it! Keep up the excellent task completion habits.",
        });
      } else if (completionRate < 50) {
        detectedPatterns.push({
          type: 'Needs Focus',
          description: `${Math.round(completionRate)}% completion rate`,
          confidence: 100 - completionRate,
          icon: Target,
          color: 'yellow',
          suggestion: 'Try reducing daily commitments and focusing on fewer, high-impact tasks.',
        });
      }
    }

    // Sort by confidence
    return detectedPatterns.sort((a, b) => b.confidence - a.confidence);
  }, [events]);

  // AI Recommendations
  const recommendations = useMemo(() => {
    const recs: Array<{ title: string; description: string; action: string }> = [];

    // Based on event count
    const recentEvents = events.filter((e) =>
      dayjs(e.date).isAfter(dayjs().subtract(7, 'day'))
    ).length;

    if (recentEvents < 5) {
      recs.push({
        title: 'Schedule More Consistently',
        description: 'You have fewer than 5 events this week.',
        action: 'Use Quick Schedule to plan your week ahead.',
      });
    } else if (recentEvents > 30) {
      recs.push({
        title: 'Consider Simplifying',
        description: 'You have over 30 events this week.',
        action: 'Review your commitments and delegate or postpone non-essential tasks.',
      });
    }

    // Time of day recommendations
    const lateNightEvents = events.filter((e) => dayjs(e.startsAt).hour() >= 22).length;
    if (lateNightEvents > 3) {
      recs.push({
        title: 'Protect Your Sleep',
        description: 'You have several late-night events scheduled.',
        action: 'Try to move non-urgent tasks earlier to maintain healthy sleep patterns.',
      });
    }

    // Buffer time
    const tightSchedule = events.filter((event, index) => {
      if (index === 0) return false;
      const prevEvent = events[index - 1];
      if (dayjs(event.date).isSame(prevEvent.date, 'day')) {
        const gap = dayjs(event.startsAt).diff(dayjs(prevEvent.endsAt), 'minute');
        return gap < 10;
      }
      return false;
    }).length;

    if (tightSchedule > 5) {
      recs.push({
        title: 'Add Buffer Time',
        description: `${tightSchedule} back-to-back events with no breaks.`,
        action: 'Schedule 15-minute buffers between meetings to recharge and prepare.',
      });
    }

    return recs;
  }, [events]);

  if (patterns.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Brain className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">Learning Your Patterns</h3>
        <p className="text-muted-foreground max-w-md mx-auto">
          Schedule more events for AI to detect your productivity patterns and provide personalized
          insights.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Brain className="h-5 w-5 text-purple-500" />
          <h2 className="text-2xl font-bold">AI Learning Insights</h2>
        </div>
        <p className="text-muted-foreground">
          Detected patterns from {events.length} events across your calendar
        </p>
      </div>

      {/* Detected Patterns */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Detected Patterns</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {patterns.map((pattern, index) => {
            const Icon = pattern.icon;
            return (
              <Card key={index} className="p-4 hover:bg-accent/50 dark:hover:bg-accent/20 transition-colors">
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2 rounded-lg bg-${pattern.color}-100 dark:bg-${pattern.color}-950`}
                  >
                    <Icon className={`h-5 w-5 text-${pattern.color}-600 dark:text-${pattern.color}-400`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{pattern.type}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {Math.round(pattern.confidence)}% confidence
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{pattern.description}</p>
                    {pattern.suggestion && (
                      <p className="text-sm bg-muted p-2 rounded-md">{pattern.suggestion}</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* AI Recommendations */}
      {recommendations.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3">Smart Recommendations</h3>
          <div className="space-y-3">
            {recommendations.map((rec, index) => (
              <Card key={index} className="p-4 border-l-4 border-purple-500">
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-purple-500 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">{rec.title}</h4>
                    <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">Action:</span>
                      <span className="text-muted-foreground">{rec.action}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Learning Progress */}
      <Card className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
        <div className="flex items-center gap-3">
          <Brain className="h-8 w-8 text-purple-500" />
          <div className="flex-1">
            <h4 className="font-semibold mb-1">AI Learning Progress</h4>
            <p className="text-sm text-muted-foreground">
              The more you use Malleabite, the better our AI understands your preferences and can
              provide personalized suggestions.
            </p>
          </div>
          <Badge variant="default" className="bg-purple-500">
            {patterns.length} Patterns
          </Badge>
        </div>
      </Card>
    </div>
  );
}

// Helper function
function formatHour(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}
