// AutoSchedule Button Component
// Provides one-click optimal scheduling for tasks

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Clock, Calendar, TrendingUp, CheckCircle2, X } from 'lucide-react';
import { optimizeSchedule, TaskToSchedule } from '@/lib/algorithms/schedule-optimizer';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import dayjs from 'dayjs';
import { toast } from 'sonner';

interface AutoScheduleButtonProps {
  task: {
    title: string;
    duration: number;
    priority?: 'high' | 'medium' | 'low';
    type?: 'meeting' | 'focus' | 'break' | 'routine';
    deadline?: Date;
    preferredTimeOfDay?: 'morning' | 'afternoon' | 'evening';
  };
  onSchedule?: (startTime: string, endTime: string, date: string) => void;
}

export function AutoScheduleButton({ task, onSchedule }: AutoScheduleButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { events } = useCalendarEvents();

  const handleAutoSchedule = () => {
    setLoading(true);

    // Convert task to TaskToSchedule format
    const taskToSchedule: TaskToSchedule = {
      id: `temp-${Date.now()}`,
      title: task.title,
      duration: task.duration,
      priority: task.priority || 'medium',
      type: task.type || 'focus',
      deadline: task.deadline,
      preferredTimeOfDay: task.preferredTimeOfDay,
    };

    // Run optimizer
    const result = optimizeSchedule([taskToSchedule], events);

    setLoading(false);

    if (result.suggestions.length > 0) {
      // Auto-schedule was successful
      const suggestion = result.suggestions[0];
      
      if (onSchedule) {
        onSchedule(
          suggestion.suggestedSlot.start,
          suggestion.suggestedSlot.end,
          suggestion.suggestedSlot.date
        );
      }

      toast.success('Auto-scheduled successfully!', {
        description: `Best time: ${dayjs(suggestion.suggestedSlot.start).format('MMM D, h:mm A')}`,
      });
      setOpen(false);
    } else {
      toast.error('Could not find optimal time slot', {
        description: 'Try adjusting the duration or preferences.',
      });
    }
  };

  const getSuggestions = () => {
    const taskToSchedule: TaskToSchedule = {
      id: `temp-${Date.now()}`,
      title: task.title,
      duration: task.duration,
      priority: task.priority || 'medium',
      type: task.type || 'focus',
      deadline: task.deadline,
      preferredTimeOfDay: task.preferredTimeOfDay,
    };

    const result = optimizeSchedule([taskToSchedule], events);
    return result.suggestions[0] || null;
  };

  const suggestion = open ? getSuggestions() : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Sparkles className="h-4 w-4" />
          Auto-Schedule
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI-Powered Scheduling
          </DialogTitle>
          <DialogDescription>
            We've analyzed your calendar to find the optimal time for "{task.title}"
          </DialogDescription>
        </DialogHeader>

        {suggestion ? (
          <div className="space-y-4">
            {/* Best Suggestion */}
            <Card className="p-4 border-2 border-purple-500 bg-purple-50 dark:bg-purple-950/20">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="default" className="bg-purple-500">
                      Best Match
                    </Badge>
                    <Badge variant="outline">
                      Score: {suggestion.suggestedSlot.score}/100
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-lg">
                    {dayjs(suggestion.suggestedSlot.start).format('dddd, MMMM D')}
                  </h3>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {dayjs(suggestion.suggestedSlot.start).format('h:mm A')}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    to {dayjs(suggestion.suggestedSlot.end).format('h:mm A')}
                  </div>
                </div>
              </div>

              {/* Reasoning */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Why this time is optimal:</p>
                {suggestion.suggestedSlot.reasoning.map((reason, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{reason}</span>
                  </div>
                ))}
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
                <div className="text-center">
                  <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-xs text-muted-foreground">Duration</div>
                  <div className="font-semibold">{task.duration} min</div>
                </div>
                <div className="text-center">
                  <Calendar className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-xs text-muted-foreground">Days Away</div>
                  <div className="font-semibold">
                    {dayjs(suggestion.suggestedSlot.start).diff(dayjs(), 'day')} days
                  </div>
                </div>
                <div className="text-center">
                  <TrendingUp className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-xs text-muted-foreground">Quality</div>
                  <div className="font-semibold">
                    {suggestion.suggestedSlot.score >= 80
                      ? 'Excellent'
                      : suggestion.suggestedSlot.score >= 60
                        ? 'Good'
                        : 'Fair'}
                  </div>
                </div>
              </div>
            </Card>

            {/* Alternative Slots */}
            {suggestion.alternativeSlots.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Alternative Time Slots</h4>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {suggestion.alternativeSlots.map((alt, index) => (
                    <Card
                      key={index}
                      className="p-3 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors cursor-pointer border-2 border-transparent hover:border-purple-200 dark:hover:border-purple-800"
                      onClick={() => {
                        if (onSchedule) {
                          onSchedule(alt.start, alt.end, alt.date);
                        }
                        toast.success('Scheduled!', {
                          description: `${dayjs(alt.start).format('MMM D, h:mm A')}`,
                        });
                        setOpen(false);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">
                            {dayjs(alt.start).format('ddd, MMM D')}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {dayjs(alt.start).format('h:mm A')} - {dayjs(alt.end).format('h:mm A')}
                          </div>
                        </div>
                        <Badge variant="secondary">Score: {alt.score}/100</Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleAutoSchedule}
                disabled={loading}
                className="flex-1 bg-purple-500 hover:bg-purple-600"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {loading ? 'Scheduling...' : 'Schedule at Best Time'}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-muted-foreground">
              No available time slots found. Try adjusting the duration or date range.
            </p>
            <Button variant="outline" onClick={() => setOpen(false)} className="mt-4">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
