// Phase 1.2: Time Distribution Chart Component
// Line/Area chart showing weekly event trends and time distribution

import React from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DailyAnalytics } from '@/hooks/use-analytics-data';
import dayjs from 'dayjs';

interface TimeChartProps {
  data: DailyAnalytics[];
  type?: 'line' | 'area';
  title?: string;
  description?: string;
}

export default function TimeChart({ 
  data, 
  type = 'area',
  title = 'Weekly Time Distribution',
  description = 'Hours spent on different activities'
}: TimeChartProps) {
  // Transform data for chart
  const chartData = data.map((day) => ({
    date: dayjs(day.date).format('ddd'),
    fullDate: dayjs(day.date).format('MMM D'),
    'Focus Time': Math.round((day.focusTimeMinutes / 60) * 10) / 10,
    'Meetings': Math.round((day.meetingTimeMinutes / 60) * 10) / 10,
    'Breaks': Math.round((day.breakTimeMinutes / 60) * 10) / 10,
    'Total': day.productiveHours,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg shadow-lg p-3">
          <p className="font-semibold mb-2">{data.fullDate}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 text-sm">
              <span className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}:
              </span>
              <span className="font-medium">{entry.value}h</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const Chart = type === 'line' ? LineChart : AreaChart;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <Chart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              className="text-xs"
              tick={{ fill: 'currentColor' }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: 'currentColor' }}
              label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {type === 'line' ? (
              <>
                <Line
                  type="monotone"
                  dataKey="Focus Time"
                  stroke="#3b82f6"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="Meetings"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="Breaks"
                  stroke="#10b981"
                  strokeWidth={2}
                />
              </>
            ) : (
              <>
                <Area
                  type="monotone"
                  dataKey="Focus Time"
                  stackId="1"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="Meetings"
                  stackId="1"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="Breaks"
                  stackId="1"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.6}
                />
              </>
            )}
          </Chart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
