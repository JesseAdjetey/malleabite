import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Card } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import type { AnalyticsMetrics } from '@/lib/stores/analytics-store';

interface TimeDistributionChartProps {
  metrics: AnalyticsMetrics;
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

export function TimeDistributionChart({ metrics }: TimeDistributionChartProps) {
  const chartData = useMemo(() => {
    if (!metrics.eventsByCategory) return [];
    
    return Object.entries(metrics.eventsByCategory)
      .map(([category, count]) => ({
        name: category.charAt(0).toUpperCase() + category.slice(1),
        value: count,
        color: COLORS[category as keyof typeof COLORS] || COLORS.other,
      }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [metrics.eventsByCategory]);

  const totalEvents = chartData.reduce((sum, item) => sum + item.value, 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      const percentage = ((data.value / totalEvents) * 100).toFixed(1);
      return (
        <div className="bg-background border-2 border-purple-500 rounded-lg p-3 shadow-lg">
          <p className="font-semibold">{data.name}</p>
          <p className="text-sm text-muted-foreground">
            {data.value} events ({percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null; // Hide labels for small slices
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        className="text-xs font-semibold"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  if (chartData.length === 0) {
    return (
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-purple-500" />
          Time Distribution
        </h3>
        <div className="h-[300px] flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No data available</p>
            <p className="text-sm mt-1">Create some events to see your time distribution</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5 text-purple-500" />
        Time Distribution by Category
      </h3>
      
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={renderCustomLabel}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value, entry: any) => (
              <span className="text-sm">
                {value} ({entry.payload.value})
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>

      <div className="mt-4 pt-4 border-t">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Total Events</p>
            <p className="text-2xl font-bold">{totalEvents}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Categories</p>
            <p className="text-2xl font-bold">{chartData.length}</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
