// Phase 1.2: Productivity Heatmap Component
// Calendar-style heatmap showing daily productivity levels

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DailyAnalytics } from '@/hooks/use-analytics-data';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

dayjs.extend(isBetween);

interface ProductivityHeatmapProps {
  data: DailyAnalytics[];
  title?: string;
  description?: string;
}

export default function ProductivityHeatmap({ 
  data,
  title = 'Productivity Heatmap',
  description = 'Daily productivity levels over time'
}: ProductivityHeatmapProps) {
  // Calculate productivity level (0-4) based on productive hours
  const getProductivityLevel = (hours: number): number => {
    if (hours === 0) return 0;
    if (hours < 2) return 1;
    if (hours < 4) return 2;
    if (hours < 6) return 3;
    return 4;
  };

  // Get color based on productivity level
  const getColor = (level: number): string => {
    const colors = [
      'bg-gray-100 dark:bg-gray-800', // 0 - no activity
      'bg-green-100 dark:bg-green-900/30', // 1 - low
      'bg-green-300 dark:bg-green-700/50', // 2 - medium
      'bg-green-500 dark:bg-green-600/70', // 3 - high
      'bg-green-700 dark:bg-green-500', // 4 - very high
    ];
    return colors[level];
  };

  // Sort data by date
  const sortedData = [...data].sort((a, b) => 
    dayjs(a.date).valueOf() - dayjs(b.date).valueOf()
  );

  // Group data by calendar weeks (Sunday to Saturday), preserving day of week alignment
  const weeks: Array<{ days: (DailyAnalytics | null)[]; weekStart: string; weekEnd: string; weekNumber: number }> = [];
  
  if (sortedData.length > 0) {
    const firstDate = dayjs(sortedData[0].date);
    const lastDate = dayjs(sortedData[sortedData.length - 1].date);
    
    // Start from the Sunday of the first week
    let currentWeekStart = firstDate.day(0); // 0 = Sunday
    const endDate = lastDate.day(6); // 6 = Saturday
    
    let weekNumber = 1;
    
    while (currentWeekStart.isBefore(endDate) || currentWeekStart.isSame(endDate, 'day')) {
      const weekDays: (DailyAnalytics | null)[] = [];
      
      // For each day of the week (Sun-Sat)
      for (let i = 0; i < 7; i++) {
        const currentDay = currentWeekStart.add(i, 'day');
        const dayData = sortedData.find(d => 
          dayjs(d.date).format('YYYY-MM-DD') === currentDay.format('YYYY-MM-DD')
        );
        weekDays.push(dayData || null);
      }
      
      const weekEnd = currentWeekStart.add(6, 'day');
      
      weeks.push({
        days: weekDays,
        weekStart: currentWeekStart.format('MMM D'),
        weekEnd: weekEnd.format('MMM D'),
        weekNumber
      });
      
      currentWeekStart = currentWeekStart.add(1, 'week');
      weekNumber++;
    }
  }

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {/* Day labels */}
          <div className="flex gap-2 mb-2">
            <div className="w-24"></div>
            {dayLabels.map((day) => (
              <div key={day} className="flex-1 text-center text-xs text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          {/* Heatmap grid */}
          <TooltipProvider>
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex gap-2">
                <div className="w-24 text-xs text-muted-foreground flex items-center">
                  <div>
                    <div className="font-medium">Week {week.weekNumber}</div>
                    <div className="text-[10px] opacity-70">{week.weekStart} - {week.weekEnd}</div>
                  </div>
                </div>
                {week.days.map((day, dayIndex) => {
                  if (!day) {
                    // Empty cell for days outside the data range
                    return (
                      <div
                        key={dayIndex}
                        className="flex-1 aspect-square rounded-md bg-gray-50 dark:bg-gray-900 opacity-30"
                      />
                    );
                  }
                  
                  const level = getProductivityLevel(day.productiveHours);
                  const color = getColor(level);
                  
                  return (
                    <Tooltip key={dayIndex}>
                      <TooltipTrigger asChild>
                        <div
                          className={`flex-1 aspect-square rounded-md ${color} transition-all hover:scale-110 hover:shadow-md cursor-pointer`}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-sm">
                          <p className="font-semibold mb-1">
                            {dayjs(day.date).format('ddd, MMM D, YYYY')}
                          </p>
                          <p>{day.productiveHours}h productive</p>
                          <p>{day.eventsCompleted} events</p>
                          {day.tasksCompleted > 0 && (
                            <p>{day.tasksCompleted} tasks completed</p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </TooltipProvider>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-4 border-t">
            <span className="text-xs text-muted-foreground">Less</span>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map((level) => (
                <div
                  key={level}
                  className={`w-4 h-4 rounded-sm ${getColor(level)}`}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
