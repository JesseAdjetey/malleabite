// Phase 1.2 + 3.1: Unified Analytics Dashboard
// Comprehensive productivity metrics, charts, insights, and export capabilities

import React, { useState, useMemo } from 'react';
import { useAnalyticsData } from '@/hooks/use-analytics-data';
import { useAnalyticsStore } from '@/lib/stores/analytics-store';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Clock, 
  Target,
  Activity,
  Zap,
  Download,
  CheckCircle2,
  Home
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import TimeChart from '@/components/analytics/TimeChart';
import ProductivityHeatmap from '@/components/analytics/ProductivityHeatmap';
import WeeklySummary from '@/components/analytics/WeeklySummary';
import { TimeDistributionChart } from '@/components/analytics/TimeDistributionChart';
import { CategoryBreakdown } from '@/components/analytics/CategoryBreakdown';
import { SmartSuggestions } from '@/components/suggestions/SmartSuggestions';
import MobileNavigation from '@/components/MobileNavigation';
import { LearningInsights } from '@/components/ai/LearningInsights';
import { ProductivityScore } from '@/components/insights/ProductivityScore';

export default function Analytics() {
  const { metrics, timeDistribution, loading, isSyncing } = useAnalyticsData();
  const { events } = useCalendarEvents();
  const { selectedTimeRange, setTimeRange } = useAnalyticsStore();
  const [activeTab, setActiveTab] = useState('overview');
  const navigate = useNavigate();

  // Derive AnalyticsMetrics from ProductivityMetrics for chart components
  const chartMetrics = useMemo(() => {
    if (!metrics) return null;
    
    const { thisWeek } = metrics;
    const totalTime = thisWeek.dailyBreakdown.reduce((sum, d) => sum + d.totalEventTime, 0);
    const focusTime = thisWeek.dailyBreakdown.reduce((sum, d) => sum + d.focusTimeMinutes, 0);
    const meetingTime = thisWeek.dailyBreakdown.reduce((sum, d) => sum + d.meetingTimeMinutes, 0);
    
    // Count events by category (derived from title keywords)
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

  // Handle export
  const handleExport = (format: 'csv' | 'json') => {
    if (!metrics) return;

    const timestamp = new Date().toISOString().split('T')[0];
    let content: string;
    let filename: string;
    let mimeType: string;

    // Create export data
    const exportData = {
      weekStart: metrics.thisWeek.weekStart,
      weekEnd: metrics.thisWeek.weekEnd,
      totalEvents: metrics.thisWeek.totalEvents,
      totalTime: (metrics.thisWeek.totalEventTime / 60).toFixed(1) + ' hours',
      tasksCompleted: metrics.thisWeek.tasksCompleted,
      averageEventDuration: metrics.thisWeek.averageEventDuration + ' minutes',
      mostProductiveDay: metrics.thisWeek.mostProductiveDay,
      mostProductiveHour: metrics.thisWeek.mostProductiveHour + ':00',
      monthlyTotalEvents: metrics.thisMonth.totalEvents,
      monthlyTotalHours: metrics.thisMonth.totalHours,
      completionRate: metrics.thisMonth.completionRate.toFixed(1) + '%',
      trends: metrics.trends,
    };

    if (format === 'csv') {
      const rows = [
        ['Metric', 'Value'],
        ['Week Start', exportData.weekStart],
        ['Week End', exportData.weekEnd],
        ['Total Events', exportData.totalEvents.toString()],
        ['Total Time', exportData.totalTime],
        ['Tasks Completed', exportData.tasksCompleted.toString()],
        ['Average Event Duration', exportData.averageEventDuration],
        ['Most Productive Day', exportData.mostProductiveDay],
        ['Most Productive Hour', exportData.mostProductiveHour],
        ['Monthly Total Events', exportData.monthlyTotalEvents.toString()],
        ['Monthly Total Hours', exportData.monthlyTotalHours.toString()],
        ['Completion Rate', exportData.completionRate],
      ];
      content = rows.map((row) => row.join(',')).join('\n');
      filename = `malleabite-analytics-${timestamp}.csv`;
      mimeType = 'text/csv';
    } else {
      content = JSON.stringify(exportData, null, 2);
      filename = `malleabite-analytics-${timestamp}.json`;
      mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="flex items-center gap-2 p-4 border-b border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="gap-2"
          >
            <Home className="h-4 w-4" />
            Dashboard
          </Button>
        </div>
        
        <div className="flex-1 flex items-center justify-center py-12 px-6">
          <div className="text-center max-w-2xl">
            <h3 className="text-4xl font-bold mb-4 bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
              Your Analytics Dashboard
            </h3>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed max-w-xl mx-auto">
              Track your productivity journey with powerful insights and beautiful visualizations
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 text-left">
              <div className="glass-card rounded-xl p-4">
                <h4 className="font-semibold text-sm mb-1">Productivity Trends</h4>
                <p className="text-xs text-muted-foreground">Track your progress over time</p>
              </div>
              
              <div className="glass-card rounded-xl p-4">
                <h4 className="font-semibold text-sm mb-1">Time Allocation</h4>
                <p className="text-xs text-muted-foreground">See where your time goes</p>
              </div>
              
              <div className="glass-card rounded-xl p-4">
                <h4 className="font-semibold text-sm mb-1">Weekly Insights</h4>
                <p className="text-xs text-muted-foreground">Compare week-over-week</p>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                size="lg"
                onClick={() => navigate('/calendar')}
              >
                <Calendar className="w-5 h-5 mr-2" />
                Go to Calendar
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="border-violet-500/30 hover:bg-violet-500/10"
                onClick={() => navigate('/')}
              >
                <Home className="w-5 h-5 mr-2" />
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { thisWeek, lastWeek, thisMonth, trends } = metrics;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-7xl mx-auto relative">
      {/* Back to Dashboard Button */}
      <Button
        onClick={() => navigate('/')}
        variant="ghost"
        size="sm"
        className="glass hover:bg-white/20 text-white backdrop-blur-md gap-2"
      >
        <Home className="h-4 w-4" />
        <span>Dashboard</span>
      </Button>
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
            Productivity Analytics
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Track your progress and optimize your schedule
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Time Range Selector */}
          <Select value={selectedTimeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-28 sm:w-36">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>

          {/* Export Button */}
          <Button variant="outline" size="sm" onClick={() => handleExport('csv')}>
            <Download className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
          
          {isSyncing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              <span className="hidden sm:inline">Syncing...</span>
            </div>
          )}
        </div>
      </div>

      {/* Smart Suggestions */}
      <SmartSuggestions />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* This Week Events */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Events This Week</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{thisWeek.totalEvents}</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              {trends.eventsChange >= 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                  <span className="text-green-500">+{trends.eventsChange}%</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                  <span className="text-red-500">{trends.eventsChange}%</span>
                </>
              )}
              <span className="ml-1 hidden sm:inline">from last week</span>
            </p>
          </CardContent>
        </Card>

        {/* Total Hours */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Productive Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">
              {Math.round((thisWeek.totalEventTime / 60) * 10) / 10}h
            </div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              {trends.productivityChange >= 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                  <span className="text-green-500">+{trends.productivityChange}%</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                  <span className="text-red-500">{trends.productivityChange}%</span>
                </>
              )}
              <span className="ml-1 hidden sm:inline">from last week</span>
            </p>
          </CardContent>
        </Card>

        {/* Tasks Completed */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Tasks Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{thisWeek.tasksCompleted}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {thisMonth.completionRate > 0 && (
                <span>{thisMonth.completionRate.toFixed(0)}% <span className="hidden sm:inline">completion rate</span></span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Focus Time */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Focus Time</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">
              {Math.round(
                (thisWeek.dailyBreakdown.reduce((sum, d) => sum + d.focusTimeMinutes, 0) / 60) * 10
              ) / 10}h
            </div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              {trends.focusTimeChange >= 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                  <span className="text-green-500">+{trends.focusTimeChange}%</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                  <span className="text-red-500">{trends.focusTimeChange}%</span>
                </>
              )}
              <span className="ml-1 hidden sm:inline">from last week</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="productivity">Productivity Score</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TimeChart data={thisWeek.dailyBreakdown} type="area" />
            {chartMetrics && <TimeDistributionChart metrics={chartMetrics} />}
          </div>

          <ProductivityHeatmap data={thisWeek.dailyBreakdown} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {chartMetrics && <CategoryBreakdown metrics={chartMetrics} events={events} />}
            <WeeklySummary data={thisWeek.dailyBreakdown} />
          </div>

          {/* Productivity Insights */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Productivity Insights</CardTitle>
              <CardDescription>Key patterns and recommendations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3 p-3 dark:bg-blue-950/20 rounded-lg">
                <Activity className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Most Productive Day</p>
                  <p className="text-xs text-muted-foreground">
                    {dayjs(thisWeek.mostProductiveDay).format('dddd, MMM D')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3  dark:bg-purple-950/20 rounded-lg">
                <Clock className="h-5 w-5 text-purple-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Peak Performance Hour</p>
                  <p className="text-xs text-muted-foreground">
                    {thisWeek.mostProductiveHour}:00 - {thisWeek.mostProductiveHour + 1}:00
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3  dark:bg-green-950/20 rounded-lg">
                <Target className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Average Event Duration</p>
                  <p className="text-xs text-muted-foreground">
                    {thisWeek.averageEventDuration} minutes
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Daily Breakdown */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Daily Breakdown</CardTitle>
              <CardDescription>Events and productivity per day</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {thisWeek.dailyBreakdown.map((day) => (
                  <div key={day.date} className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-12 text-center">
                        <p className="text-xs text-muted-foreground">{dayjs(day.date).format('ddd')}</p>
                        <p className="text-sm font-medium">{dayjs(day.date).format('DD')}</p>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-sm  dark:bg-blue-900/30 px-2 py-1 rounded">
                          {day.eventsCompleted} events
                        </span>
                        {day.tasksCompleted > 0 && (
                          <span className="text-sm bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">
                            {day.tasksCompleted} tasks
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{day.productiveHours}h</p>
                      <p className="text-xs text-muted-foreground">productive</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Productivity Score Tab */}
        <TabsContent value="productivity">
          <ProductivityScore />
        </TabsContent>

        {/* AI Insights Tab */}
        <TabsContent value="insights">
          <LearningInsights />
        </TabsContent>

        {/* Weekly Tab */}
        <TabsContent value="weekly">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Weekly Summary</CardTitle>
              <CardDescription>
                {dayjs(thisWeek.weekStart).format('MMM D')} - {dayjs(thisWeek.weekEnd).format('MMM D, YYYY')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Events</p>
                    <p className="text-2xl font-bold">{thisWeek.totalEvents}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Time</p>
                    <p className="text-2xl font-bold">{Math.round((thisWeek.totalEventTime / 60) * 10) / 10}h</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Tasks Completed</p>
                    <p className="text-2xl font-bold">{thisWeek.tasksCompleted}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Duration</p>
                    <p className="text-2xl font-bold">{thisWeek.averageEventDuration}m</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monthly Tab */}
        <TabsContent value="monthly">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Monthly Summary</CardTitle>
              <CardDescription>{dayjs().format('MMMM YYYY')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Events</p>
                    <p className="text-2xl font-bold">{thisMonth.totalEvents}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Hours</p>
                    <p className="text-2xl font-bold">{thisMonth.totalHours}h</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Daily Average</p>
                    <p className="text-2xl font-bold">{thisMonth.averageDailyEvents}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Completion Rate</p>
                    <p className="text-2xl font-bold">{Math.round(thisMonth.completionRate)}%</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <MobileNavigation />
      </div>
    </div>
  );
}
