import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { ProductivityMetrics, TimeDistribution } from '@/hooks/use-analytics-data';

const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4'];

interface DistributionTabProps {
  metrics: ProductivityMetrics;
  timeDistribution: TimeDistribution[];
}

export function DistributionTab({ metrics, timeDistribution }: DistributionTabProps) {
  const pieData = useMemo(() => {
    return timeDistribution
      .filter(t => t.minutes > 0)
      .map(t => ({
        name: t.category,
        value: Math.round(t.minutes),
        color: t.color,
      }));
  }, [timeDistribution]);

  const dailyData = useMemo(() => {
    return metrics.thisWeek.dailyBreakdown.map(d => ({
      date: d.date.slice(5), // MM-DD
      focus: Math.round(d.focusTimeMinutes),
      meeting: Math.round(d.meetingTimeMinutes),
      break: Math.round(d.breakTimeMinutes),
    }));
  }, [metrics]);

  const totalMinutes = timeDistribution.reduce((sum, t) => sum + t.minutes, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Donut Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Time by Category
            </CardTitle>
            <CardDescription>
              {(totalMinutes / 60).toFixed(1)} total hours this week
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={entry.name} fill={entry.color || COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`${(value / 60).toFixed(1)}h`, 'Time']}
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-12 text-muted-foreground">No time data for this period</div>
            )}
          </CardContent>
        </Card>

        {/* Stacked Bar Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Breakdown</CardTitle>
            <CardDescription>Focus, meeting, and break time per day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dailyData}>
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} label={{ value: 'min', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                  formatter={(value: number) => [`${value} min`]}
                />
                <Legend />
                <Bar dataKey="focus" stackId="a" fill="#6366f1" name="Focus" radius={[0, 0, 0, 0]} />
                <Bar dataKey="meeting" stackId="a" fill="#f59e0b" name="Meeting" />
                <Bar dataKey="break" stackId="a" fill="#10b981" name="Break" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Category Details */}
      <Card>
        <CardHeader>
          <CardTitle>Category Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {timeDistribution.map((item, i) => (
              <div key={item.category} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color || COLORS[i % COLORS.length] }} />
                <span className="text-sm flex-1">{item.category}</span>
                <span className="text-sm font-medium">{(item.minutes / 60).toFixed(1)}h</span>
                <div className="w-24 bg-secondary rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all"
                    style={{ width: `${item.percentage}%`, backgroundColor: item.color || COLORS[i % COLORS.length] }}
                  />
                </div>
                <span className="text-xs text-muted-foreground w-10 text-right">{item.percentage}%</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
