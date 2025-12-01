// Phase 1.2: Weekly Summary Chart Component
// Bar chart showing weekly breakdown of events and tasks

import React from 'react';
import {
  BarChart,
  Bar,
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

interface WeeklySummaryProps {
  data: DailyAnalytics[];
  title?: string;
  description?: string;
}

export default function WeeklySummary({ 
  data,
  title = 'Weekly Summary',
  description = 'Events and tasks completed per day'
}: WeeklySummaryProps) {
  // Transform data for chart
  const chartData = data.map((day) => ({
    date: dayjs(day.date).format('ddd'),
    fullDate: dayjs(day.date).format('MMM D'),
    Events: day.eventsCompleted,
    Tasks: day.tasksCompleted,
    'Productive Hours': day.productiveHours,
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
              <span className="font-medium">
                {entry.name === 'Productive Hours' ? `${entry.value}h` : entry.value}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis 
              dataKey="date" 
              className="text-xs"
              tick={{ fill: 'currentColor' }}
            />
            <YAxis 
              className="text-xs"
              tick={{ fill: 'currentColor' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="Events" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Tasks" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Productive Hours" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
