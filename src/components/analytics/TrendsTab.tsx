import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ProductivityMetrics } from '@/hooks/use-analytics-data';

interface TrendsTabProps {
  metrics: ProductivityMetrics;
}

function TrendBadge({ value, label }: { value: number; label: string }) {
  const isPositive = value > 0;
  const isNeutral = value === 0;
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold mt-1">
              {isPositive ? '+' : ''}{value.toFixed(1)}%
            </p>
          </div>
          <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
            isNeutral ? 'bg-muted' : isPositive ? 'bg-green-500/20' : 'bg-red-500/20'
          }`}>
            {isNeutral ? (
              <Minus className="h-5 w-5 text-muted-foreground" />
            ) : isPositive ? (
              <TrendingUp className="h-5 w-5 text-green-500" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-500" />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function TrendsTab({ metrics }: TrendsTabProps) {
  const comparisonData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((day, i) => {
      const thisWeekDay = metrics.thisWeek.dailyBreakdown[i];
      const lastWeekDay = metrics.lastWeek.dailyBreakdown[i];
      return {
        day,
        thisWeek: thisWeekDay?.totalEventTime || 0,
        lastWeek: lastWeekDay?.totalEventTime || 0,
      };
    });
  }, [metrics]);

  const focusMeetingData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((day, i) => {
      const d = metrics.thisWeek.dailyBreakdown[i];
      return {
        day,
        meeting: d?.meetingTimeMinutes || 0,
      };
    });
  }, [metrics]);

  const thisWeekTotal = metrics.thisWeek.totalEventTime;
  const lastWeekTotal = metrics.lastWeek.totalEventTime;

  return (
    <div className="space-y-4">
      {/* Trend Badges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TrendBadge value={metrics.trends.eventsChange} label="Events" />
        <TrendBadge value={metrics.trends.productivityChange} label="Productivity" />
      </div>

      {/* Week over Week Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Week-over-Week Comparison</CardTitle>
          <CardDescription>
            This week: {(thisWeekTotal / 60).toFixed(1)}h vs Last week: {(lastWeekTotal / 60).toFixed(1)}h
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={comparisonData}>
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} label={{ value: 'min', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                formatter={(value: number) => [`${value} min`]}
              />
              <Legend />
              <Line type="monotone" dataKey="thisWeek" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} name="This Week" />
              <Line type="monotone" dataKey="lastWeek" stroke="#a1a1aa" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} name="Last Week" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Focus vs Meeting Time */}
      <Card>
        <CardHeader>
          <CardTitle>Focus vs Meeting Time</CardTitle>
          <CardDescription>Daily distribution of focused work and meetings</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={focusMeetingData}>
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} label={{ value: 'min', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                formatter={(value: number) => [`${value} min`]}
              />
              <Legend />
              <Area type="monotone" dataKey="meeting" stackId="1" fill="#f59e0b" fillOpacity={0.3} stroke="#f59e0b" name="Meeting" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
