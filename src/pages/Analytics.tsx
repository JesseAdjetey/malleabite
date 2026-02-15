// Analytics Page - Mobile-First Design
import React, { useState, useMemo } from 'react';
import { useAnalyticsData } from '@/hooks/use-analytics-data';
import { useAnalyticsStore } from '@/lib/stores/analytics-store';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  Target,
  Activity,
  Zap,
  Download,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Flame,
  BarChart2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import TimeChart from '@/components/analytics/TimeChart';
import { CategoryBreakdown } from '@/components/analytics/CategoryBreakdown';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { motion } from 'framer-motion';
import { springs } from '@/lib/animations';

export default function Analytics() {
  const { metrics, timeDistribution, loading, isSyncing } = useAnalyticsData();
  const { events } = useCalendarEvents();
  const { selectedTimeRange, setTimeRange } = useAnalyticsStore();
  const [showTimeSelector, setShowTimeSelector] = useState(false);
  const navigate = useNavigate();

  // Derive AnalyticsMetrics from ProductivityMetrics for chart components
  const chartMetrics = useMemo(() => {
    if (!metrics) return null;
    
    const { thisWeek } = metrics;
    const totalTime = thisWeek.dailyBreakdown.reduce((sum, d) => sum + d.totalEventTime, 0);
    const focusTime = thisWeek.dailyBreakdown.reduce((sum, d) => sum + d.focusTimeMinutes, 0);
    const meetingTime = thisWeek.dailyBreakdown.reduce((sum, d) => sum + d.meetingTimeMinutes, 0);
    
    const eventsByCategory: Record<string, number> = {};
    events.forEach(event => {
      const text = `${event.title} ${event.description}`.toLowerCase();
      let category = 'other';
      
      if (text.includes('work') || text.includes('meeting')) category = 'work';
      else if (text.includes('personal') || text.includes('home')) category = 'personal';
      else if (text.includes('health') || text.includes('exercise') || text.includes('gym')) category = 'health';
      else if (text.includes('learn') || text.includes('study') || text.includes('course')) category = 'learning';
      else if (text.includes('social') || text.includes('friend')) category = 'social';
      else if (text.includes('entertainment') || text.includes('fun')) category = 'entertainment';
      
      eventsByCategory[category] = (eventsByCategory[category] || 0) + 1;
    });

    return {
      totalEvents: thisWeek.totalEvents,
      completedEvents: thisWeek.tasksCompleted,
      totalTime,
      eventsByCategory,
      eventsByColor: {},
      timeByCategory: {},
      completionRate: thisWeek.totalEvents > 0 ? (thisWeek.tasksCompleted / thisWeek.totalEvents) * 100 : 0,
      averageEventDuration: thisWeek.averageEventDuration,
      pomodoroSessions: 0,
      focusTime,
      meetingTime,
      productivityScore: 0,
    };
  }, [metrics, events]);

  const handleExport = (format: 'csv' | 'json') => {
    if (!metrics) return;
    const timestamp = new Date().toISOString().split('T')[0];
    const exportData = {
      weekStart: metrics.thisWeek.weekStart,
      weekEnd: metrics.thisWeek.weekEnd,
      totalEvents: metrics.thisWeek.totalEvents,
      totalTime: (metrics.thisWeek.totalEventTime / 60).toFixed(1) + ' hours',
      tasksCompleted: metrics.thisWeek.tasksCompleted,
      trends: metrics.trends,
    };
    const content = JSON.stringify(exportData, null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `malleabite-analytics-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const timeRangeLabels: Record<string, string> = {
    week: 'This Week',
    month: 'This Month',
    year: 'This Year',
    all: 'All Time'
  };

  // Loading State
  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -30 }}
        transition={springs.page}
        className="min-h-screen bg-background flex items-center justify-center pb-20"
      >
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <BarChart2 className="h-8 w-8 text-primary" />
          </div>
          <p className="text-muted-foreground text-subheadline">Loading your analytics...</p>
        </div>
      </motion.div>
    );
  }

  // Empty State
  if (!metrics) {
    return (
      <motion.div
        initial={{ opacity: 0, x: 30 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -30 }}
        transition={springs.page}
        className="min-h-screen bg-background pb-24 overflow-y-auto overflow-x-hidden"
      >
        <div className="px-5 pt-6 max-w-lg mx-auto">
          <h1 className="text-large-title font-bold mb-1">Analytics</h1>
          <p className="text-subheadline text-muted-foreground mb-8">Track your productivity journey</p>

          <div className="p-8 rounded-2xl bg-card border border-border/50 text-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <BarChart2 className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-title3 font-semibold mb-2">Start Tracking</h2>
            <p className="text-subheadline text-muted-foreground mb-6">
              Create events in your calendar to see insights and trends
            </p>
            <button
              onClick={() => { haptics.light(); navigate('/'); }}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-[0.97]"
            >
              Go to Calendar
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: TrendingUp, label: 'Trends' },
              { icon: Clock, label: 'Time' },
              { icon: Flame, label: 'Streaks' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="p-4 rounded-2xl bg-card border border-border/50 text-center">
                <Icon className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-caption1 text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  const { thisWeek, trends } = metrics;

  // Stat Card Component
  const StatCard = ({
    value,
    label,
    change,
    icon: Icon,
    iconColor,
    bgColor,
  }: {
    value: string | number;
    label: string;
    change?: number;
    icon: any;
    iconColor: string;
    bgColor: string;
  }) => (
    <div className="p-4 rounded-2xl bg-card border border-border/50 relative overflow-hidden">
      <div className={cn("absolute top-3 right-3 w-9 h-9 rounded-xl flex items-center justify-center", bgColor)}>
        <Icon className={cn("h-4.5 w-4.5", iconColor)} />
      </div>
      <p className="text-caption1 text-muted-foreground mb-1">{label}</p>
      <p className="text-title2 font-bold mb-1">{value}</p>
      {change !== undefined && (
        <div className="flex items-center gap-1">
          {change >= 0 ? (
            <TrendingUp className="h-3 w-3 text-emerald-500" />
          ) : (
            <TrendingDown className="h-3 w-3 text-red-500" />
          )}
          <span className={cn(
            "text-caption1 font-medium",
            change >= 0 ? "text-emerald-500" : "text-red-500"
          )}>
            {change >= 0 ? '+' : ''}{change}%
          </span>
        </div>
      )}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={springs.page}
      className="min-h-screen bg-background pb-24 overflow-y-auto overflow-x-hidden"
    >
      <div className="px-5 pt-6 max-w-lg mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-large-title font-bold">Analytics</h1>
            <p className="text-subheadline text-muted-foreground">Your productivity insights</p>
          </div>

          <div className="flex items-center gap-2">
            {isSyncing && (
              <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <button
              onClick={() => { haptics.light(); handleExport('json'); }}
              className="w-10 h-10 rounded-xl bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors active:scale-95"
            >
              <Download className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Time Range Selector — iOS segmented pill */}
        <div className="relative">
          <button
            onClick={() => setShowTimeSelector(!showTimeSelector)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted/60 border border-border/50 text-subheadline font-medium"
          >
            <Calendar className="h-4 w-4 text-primary" />
            {timeRangeLabels[selectedTimeRange]}
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              showTimeSelector && "rotate-180"
            )} />
          </button>

          {showTimeSelector && (
            <div className="absolute top-14 left-0 z-10 p-1.5 rounded-2xl bg-card border border-border/50 shadow-xl min-w-[160px]">
              {Object.entries(timeRangeLabels).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    haptics.selection();
                    setTimeRange(key as any);
                    setShowTimeSelector(false);
                  }}
                  className={cn(
                    "w-full px-4 py-2.5 text-left text-subheadline rounded-xl transition-colors",
                    selectedTimeRange === key ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/60"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            value={thisWeek.totalEvents}
            label="Events"
            change={trends.eventsChange}
            icon={Calendar}
            iconColor="text-blue-500"
            bgColor="bg-blue-500/10"
          />
          <StatCard
            value={`${Math.round((thisWeek.totalEventTime / 60) * 10) / 10}h`}
            label="Hours"
            change={trends.productivityChange}
            icon={Clock}
            iconColor="text-purple-500"
            bgColor="bg-purple-500/10"
          />
          <StatCard
            value={thisWeek.tasksCompleted}
            label="Completed"
            icon={CheckCircle2}
            iconColor="text-emerald-500"
            bgColor="bg-emerald-500/10"
          />
          <StatCard
            value={`${Math.round(thisWeek.dailyBreakdown.reduce((sum, d) => sum + d.focusTimeMinutes, 0) / 60 * 10) / 10}h`}
            label="Focus Time"
            change={trends.focusTimeChange}
            icon={Zap}
            iconColor="text-orange-500"
            bgColor="bg-orange-500/10"
          />
        </div>

        {/* Insights Cards — grouped list style */}
        <div className="space-y-2">
          <p className="text-caption1 font-medium text-muted-foreground uppercase tracking-wider px-1">
            Insights
          </p>

          <div className="rounded-2xl bg-card border border-border/50 overflow-hidden divide-y divide-border/40">
            <div className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Activity className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-subheadline font-medium">Most Productive Day</p>
                <p className="text-caption1 text-muted-foreground">
                  {dayjs(thisWeek.mostProductiveDay).format('dddd, MMM D')}
                </p>
              </div>
            </div>

            <div className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <Clock className="h-5 w-5 text-purple-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-subheadline font-medium">Peak Hour</p>
                <p className="text-caption1 text-muted-foreground">
                  {thisWeek.mostProductiveHour}:00 - {thisWeek.mostProductiveHour + 1}:00
                </p>
              </div>
            </div>

            <div className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <Target className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-subheadline font-medium">Avg Event Duration</p>
                <p className="text-caption1 text-muted-foreground">
                  {thisWeek.averageEventDuration} minutes
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="space-y-2">
          <p className="text-caption1 font-medium text-muted-foreground uppercase tracking-wider px-1">
            Weekly Overview
          </p>
          <div className="rounded-2xl overflow-hidden bg-card border border-border/50">
            <TimeChart data={thisWeek.dailyBreakdown} type="area" />
          </div>
        </div>

        {/* Category Breakdown */}
        {chartMetrics && (
          <div className="space-y-2">
            <p className="text-caption1 font-medium text-muted-foreground uppercase tracking-wider px-1">
              Categories
            </p>
            <div className="rounded-2xl overflow-hidden bg-card border border-border/50">
              <CategoryBreakdown metrics={chartMetrics} events={events} />
            </div>
          </div>
        )}

      </div>
    </motion.div>
  );
}
