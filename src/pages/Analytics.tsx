// Phase 1.2 + 3.1: Unified Analytics Dashboard
// Comprehensive productivity metrics, charts, insights, and export capabilities

import React, { useState } from 'react';
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
  CheckCircle2
} from 'lucide-react';
import dayjs from 'dayjs';
import TimeChart from '@/components/analytics/TimeChart';
import ProductivityHeatmap from '@/components/analytics/ProductivityHeatmap';
import WeeklySummary from '@/components/analytics/WeeklySummary';
import { TimeDistributionChart } from '@/components/analytics/TimeDistributionChart';
import { CategoryBreakdown } from '@/components/analytics/CategoryBreakdown';
import { SmartSuggestions } from '@/components/suggestions/SmartSuggestions';
import { LearningInsights } from '@/components/ai/LearningInsights';
import { ProductivityScore } from '@/components/insights/ProductivityScore';

export default function Analytics() {
  const { metrics, timeDistribution, loading, isSyncing } = useAnalyticsData();
  const { events } = useCalendarEvents();
  const { selectedTimeRange, setTimeRange, currentMetrics } = useAnalyticsStore();
  const [activeTab, setActiveTab] = useState('overview');

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
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-md">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Analytics Data Yet</h3>
          <p className="text-muted-foreground">
            Start creating events and completing tasks to see your productivity insights here.
          </p>
        </div>
      </div>
    );
  }

  const { thisWeek, lastWeek, thisMonth, trends } = metrics;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Productivity Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Track your progress and optimize your schedule
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <Select value={selectedTimeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-36">
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
          <Button variant="outline" onClick={() => handleExport('csv')}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          
          {isSyncing && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              <span>Syncing...</span>
            </div>
          )}
        </div>
      </div>

      {/* Smart Suggestions */}
      <SmartSuggestions />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* This Week Events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Events This Week</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{thisWeek.totalEvents}</div>
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
              <span className="ml-1">from last week</span>
            </p>
          </CardContent>
        </Card>

        {/* Total Hours */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productive Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
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
              <span className="ml-1">from last week</span>
            </p>
          </CardContent>
        </Card>

        {/* Tasks Completed */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{thisWeek.tasksCompleted}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {thisMonth.completionRate > 0 && (
                <span>{thisMonth.completionRate.toFixed(0)}% completion rate</span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Focus Time */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Focus Time</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
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
              <span className="ml-1">from last week</span>
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
            <TimeDistributionChart metrics={currentMetrics} />
          </div>

          <ProductivityHeatmap data={thisWeek.dailyBreakdown} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CategoryBreakdown metrics={currentMetrics} events={events} />
            <WeeklySummary data={thisWeek.dailyBreakdown} />
          </div>

          {/* Productivity Insights */}
          <Card>
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
          <Card>
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
          <Card>
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
          <Card>
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
    </div>
  );
}
