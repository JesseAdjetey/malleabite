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
import ProductivityHeatmap from '@/components/analytics/ProductivityHeatmap';
import WeeklySummary from '@/components/analytics/WeeklySummary';
import { TimeDistributionChart } from '@/components/analytics/TimeDistributionChart';
import { CategoryBreakdown } from '@/components/analytics/CategoryBreakdown';
import MobileNavigation from '@/components/MobileNavigation';
import { cn } from '@/lib/utils';

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
      <div className="min-h-screen bg-background flex items-center justify-center pb-20">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <BarChart2 className="h-8 w-8 text-primary" />
          </div>
          <p className="text-muted-foreground">Loading your analytics...</p>
        </div>
        <MobileNavigation />
      </div>
    );
  }

  // Empty State
  if (!metrics) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="px-4 pt-6 max-w-lg mx-auto">
          <h1 className="text-2xl font-bold mb-2">Analytics</h1>
          <p className="text-muted-foreground mb-8">Track your productivity journey</p>

          {/* Empty State Hero */}
          <div className="p-8 rounded-3xl bg-gradient-to-br from-primary/20 via-purple-600/10 to-transparent border border-primary/20 text-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <BarChart2 className="h-10 w-10 text-primary" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Start Tracking</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Create events in your calendar to see insights and trends
            </p>
            <button
              onClick={() => navigate('/')}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium transition-all active:scale-[0.98]"
            >
              Go to Calendar
            </button>
          </div>

          {/* Feature Preview */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: TrendingUp, label: 'Trends' },
              { icon: Clock, label: 'Time' },
              { icon: Flame, label: 'Streaks' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                <Icon className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <MobileNavigation />
      </div>
    );
  }

  const { thisWeek, trends } = metrics;

  // Stat Card Component
  const StatCard = ({ 
    value, 
    label, 
    change, 
    icon: Icon,
    gradient 
  }: { 
    value: string | number; 
    label: string; 
    change?: number;
    icon: any;
    gradient: string;
  }) => (
    <div className={cn(
      "p-4 rounded-2xl border border-white/10 relative overflow-hidden",
      gradient
    )}>
      <div className="absolute top-3 right-3 opacity-20">
        <Icon className="h-8 w-8" />
      </div>
      <p className="text-xs text-white/70 mb-1">{label}</p>
      <p className="text-2xl font-bold mb-1">{value}</p>
      {change !== undefined && (
        <div className="flex items-center gap-1">
          {change >= 0 ? (
            <TrendingUp className="h-3 w-3 text-green-400" />
          ) : (
            <TrendingDown className="h-3 w-3 text-red-400" />
          )}
          <span className={cn(
            "text-xs font-medium",
            change >= 0 ? "text-green-400" : "text-red-400"
          )}>
            {change >= 0 ? '+' : ''}{change}%
          </span>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4 pt-6 max-w-lg mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="hidden md:flex w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 items-center justify-center transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold">Analytics</h1>
              <p className="text-sm text-muted-foreground">Your productivity insights</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isSyncing && (
              <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <button
              onClick={() => handleExport('json')}
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
            >
              <Download className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="relative">
          <button
            onClick={() => setShowTimeSelector(!showTimeSelector)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm"
          >
            <Calendar className="h-4 w-4 text-primary" />
            {timeRangeLabels[selectedTimeRange]}
            <ChevronDown className={cn(
              "h-4 w-4 transition-transform",
              showTimeSelector && "rotate-180"
            )} />
          </button>
          
          {showTimeSelector && (
            <div className="absolute top-12 left-0 z-10 p-2 rounded-2xl bg-background border border-white/10 shadow-xl">
              {Object.entries(timeRangeLabels).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setTimeRange(key as any);
                    setShowTimeSelector(false);
                  }}
                  className={cn(
                    "w-full px-4 py-2 text-left text-sm rounded-xl transition-colors",
                    selectedTimeRange === key ? "bg-primary/20 text-primary" : "hover:bg-white/5"
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
            gradient="bg-gradient-to-br from-blue-600/20 to-blue-900/10"
          />
          <StatCard
            value={`${Math.round((thisWeek.totalEventTime / 60) * 10) / 10}h`}
            label="Hours"
            change={trends.productivityChange}
            icon={Clock}
            gradient="bg-gradient-to-br from-purple-600/20 to-purple-900/10"
          />
          <StatCard
            value={thisWeek.tasksCompleted}
            label="Completed"
            icon={CheckCircle2}
            gradient="bg-gradient-to-br from-green-600/20 to-green-900/10"
          />
          <StatCard
            value={`${Math.round(thisWeek.dailyBreakdown.reduce((sum, d) => sum + d.focusTimeMinutes, 0) / 60 * 10) / 10}h`}
            label="Focus Time"
            change={trends.focusTimeChange}
            icon={Zap}
            gradient="bg-gradient-to-br from-orange-600/20 to-orange-900/10"
          />
        </div>

        {/* Insights Cards */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
            Insights
          </p>
          
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-600/10 to-transparent border border-blue-500/20 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Activity className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium">Most Productive Day</p>
              <p className="text-xs text-muted-foreground">
                {dayjs(thisWeek.mostProductiveDay).format('dddd, MMM D')}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-600/10 to-transparent border border-purple-500/20 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Clock className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm font-medium">Peak Hour</p>
              <p className="text-xs text-muted-foreground">
                {thisWeek.mostProductiveHour}:00 - {thisWeek.mostProductiveHour + 1}:00
              </p>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-r from-green-600/10 to-transparent border border-green-500/20 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Target className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm font-medium">Avg Event Duration</p>
              <p className="text-xs text-muted-foreground">
                {thisWeek.averageEventDuration} minutes
              </p>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="space-y-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
            Weekly Overview
          </p>
          <div className="rounded-2xl overflow-hidden border border-white/10">
            <TimeChart data={thisWeek.dailyBreakdown} type="area" />
          </div>
        </div>

        {/* Category Breakdown */}
        {chartMetrics && (
          <div className="space-y-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
              Categories
            </p>
            <div className="rounded-2xl overflow-hidden border border-white/10">
              <CategoryBreakdown metrics={chartMetrics} events={events} />
            </div>
          </div>
        )}

      </div>
      <MobileNavigation />
    </div>
  );
}
