import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Clock, CheckCircle2 } from 'lucide-react';
import type { AnalyticsMetrics } from '@/lib/stores/analytics-store';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';

dayjs.extend(duration);

interface CategoryBreakdownProps {
  metrics: AnalyticsMetrics;
  events: any[];
}

const COLORS = {
  work: '#8b5cf6',
  personal: '#06b6d4',
  health: '#10b981',
  learning: '#f59e0b',
  social: '#ec4899',
  entertainment: '#6366f1',
  other: '#64748b',
};

export function CategoryBreakdown({ metrics, events }: CategoryBreakdownProps) {
  const categoryStats = useMemo(() => {
    const stats = new Map<string, {
      count: number;
      completed: number;
      totalTime: number;
      avgDuration: number;
    }>();

    events.forEach(event => {
      const category = event.category || 'other';
      const existing = stats.get(category) || {
        count: 0,
        completed: 0,
        totalTime: 0,
        avgDuration: 0,
      };

      const duration = dayjs(event.endsAt).diff(dayjs(event.startsAt), 'minute');
      
      stats.set(category, {
        count: existing.count + 1,
        completed: existing.completed + (event.completed ? 1 : 0),
        totalTime: existing.totalTime + duration,
        avgDuration: 0, // Will calculate after
      });
    });

    // Calculate averages
    stats.forEach((value, key) => {
      value.avgDuration = Math.round(value.totalTime / value.count);
    });

    return Array.from(stats.entries())
      .map(([category, data]) => ({
        category: category.charAt(0).toUpperCase() + category.slice(1),
        categoryKey: category,
        ...data,
        completionRate: Math.round((data.completed / data.count) * 100),
        color: COLORS[category as keyof typeof COLORS] || COLORS.other,
      }))
      .sort((a, b) => b.count - a.count);
  }, [events]);

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border-2 border-purple-500 rounded-lg p-3 shadow-lg">
          <p className="font-semibold mb-2">{data.category}</p>
          <div className="space-y-1 text-sm">
            <p className="text-muted-foreground">
              Events: <span className="font-medium text-foreground">{data.count}</span>
            </p>
            <p className="text-muted-foreground">
              Total Time: <span className="font-medium text-foreground">{formatTime(data.totalTime)}</span>
            </p>
            <p className="text-muted-foreground">
              Avg Duration: <span className="font-medium text-foreground">{formatTime(data.avgDuration)}</span>
            </p>
            <p className="text-muted-foreground">
              Completion: <span className="font-medium text-foreground">{data.completionRate}%</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (categoryStats.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-purple-500" />
          Category Breakdown
        </h3>
        <div className="h-[400px] flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No category data available</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <TrendingUp className="h-5 w-5 text-purple-500" />
        Category Breakdown
      </h3>

      {/* Bar Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={categoryStats}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
          <XAxis
            dataKey="category"
            tick={{ fontSize: 12 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" radius={[8, 8, 0, 0]}>
            {categoryStats.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Detailed Stats */}
      <div className="mt-6 space-y-3">
        {categoryStats.map((cat) => (
          <div
            key={cat.categoryKey}
            className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: cat.color }}
              />
              <div>
                <p className="font-medium">{cat.category}</p>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                  <span className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {cat.count} events
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(cat.totalTime)}
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {cat.completionRate}% complete
                  </span>
                </div>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">
              Avg: {formatTime(cat.avgDuration)}
            </Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}
