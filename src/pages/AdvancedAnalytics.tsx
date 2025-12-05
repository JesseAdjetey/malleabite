import { useState } from 'react';
import { useAnalyticsData } from '@/hooks/use-analytics-data';
import { useAnalyticsStore } from '@/lib/stores/analytics-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  Target,
  Zap,
  Calendar,
  Download,
  Activity,
  Brain,
} from 'lucide-react';

export default function AdvancedAnalytics() {
  const {
    metrics,
    timeDistribution,
    loading,
  } = useAnalyticsData();

  const {
    selectedTimeRange,
    setTimeRange,
    preferences,
  } = useAnalyticsStore();

  const [activeTab, setActiveTab] = useState('overview');

  // Handle export
  const handleExport = (format: 'csv' | 'json') => {
    if (!metrics) return;

    const timestamp = new Date().toISOString().split('T')[0];
    let content: string;
    let filename: string;
    let mimeType: string;

    // Create simple metrics for export
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
      // Convert to CSV
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
        ['Events Change', exportData.trends.eventsChange.toString() + '%'],
        ['Productivity Change', exportData.trends.productivityChange.toString() + '%'],
        ['Focus Time Change', exportData.trends.focusTimeChange.toString() + '%'],
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Activity className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              No Data Available
            </CardTitle>
            <CardDescription>
              Start adding events to your calendar to see analytics
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      <div className="container mx-auto p-6 max-w-7xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Advanced Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Deep insights into your productivity and time management
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
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Events */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Total Events
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.thisWeek.totalEvents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.trends.eventsChange >= 0 ? '+' : ''}
              {metrics.trends.eventsChange.toFixed(1)}% from last week
            </p>
          </CardContent>
        </Card>

        {/* Total Time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Total Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(metrics.thisWeek.totalEventTime / 60).toFixed(1)}h
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.trends.productivityChange >= 0 ? '+' : ''}
              {metrics.trends.productivityChange.toFixed(1)}% from last week
            </p>
          </CardContent>
        </Card>

        {/* Tasks Completed */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Tasks Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.thisWeek.tasksCompleted}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.thisMonth.completionRate.toFixed(0)}% completion rate
            </p>
          </CardContent>
        </Card>

        {/* Focus Time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Focus Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(metrics.thisWeek.dailyBreakdown.reduce((sum, d) => sum + d.focusTimeMinutes, 0) / 60).toFixed(1)}h
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.trends.focusTimeChange >= 0 ? '+' : ''}
              {metrics.trends.focusTimeChange.toFixed(1)}% from last week
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">
            <Activity className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="distribution">
            <BarChart3 className="h-4 w-4 mr-2" />
            Distribution
          </TabsTrigger>
          <TabsTrigger value="trends">
            <TrendingUp className="h-4 w-4 mr-2" />
            Trends
          </TabsTrigger>
          <TabsTrigger value="insights">
            <Brain className="h-4 w-4 mr-2" />
            Insights
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Weekly Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Weekly Summary
                </CardTitle>
                <CardDescription>
                  {metrics.thisWeek.weekStart} - {metrics.thisWeek.weekEnd}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Average event duration</span>
                  <span className="font-semibold">{metrics.thisWeek.averageEventDuration} min</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Most productive day</span>
                  <span className="font-semibold">{metrics.thisWeek.mostProductiveDay}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Most productive hour</span>
                  <span className="font-semibold">{metrics.thisWeek.mostProductiveHour}:00</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Pomodoro sessions</span>
                  <span className="font-semibold">{metrics.thisWeek.pomodoroSessions}</span>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Monthly Summary
                </CardTitle>
                <CardDescription>Current month performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total events</span>
                  <span className="font-semibold">{metrics.thisMonth.totalEvents}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Total hours</span>
                  <span className="font-semibold">{metrics.thisMonth.totalHours}h</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Average daily events</span>
                  <span className="font-semibold">{metrics.thisMonth.averageDailyEvents}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Completion rate</span>
                  <span className="font-semibold">{metrics.thisMonth.completionRate.toFixed(0)}%</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Time Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Time Distribution</CardTitle>
              <CardDescription>How you spend your time this week</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {timeDistribution.map((item) => (
                  <div key={item.category} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.category}
                      </span>
                      <span className="font-semibold">
                        {(item.minutes / 60).toFixed(1)}h ({item.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: item.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Distribution Tab */}
        <TabsContent value="distribution" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Coming Soon</CardTitle>
              <CardDescription>
                Advanced charts and visualizations are being built
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <BarChart3 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Time distribution charts, category breakdowns, and heatmaps will be available soon
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Coming Soon</CardTitle>
              <CardDescription>
                Trend analysis and performance tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <TrendingUp className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Weekly comparisons, productivity trends, and goal tracking will be available soon
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Coming Soon</CardTitle>
              <CardDescription>
                AI-powered productivity insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Brain className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Personalized recommendations and productivity insights will be available soon
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}
