import { useState, useEffect } from 'react';
import { Lightbulb, TrendingUp, Clock, Calendar, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { generateSmartSuggestions, SchedulingPattern } from '@/lib/algorithms/pattern-detection';
import dayjs from 'dayjs';

export function SmartSuggestions() {
  const { events } = useCalendarEvents();
  const [suggestions, setSuggestions] = useState<SchedulingPattern[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    if (events.length > 0) {
      const patterns = generateSmartSuggestions(events);
      setSuggestions(patterns);
    }
  }, [events]);

  const visibleSuggestions = suggestions.filter((_, idx) => 
    !dismissedIds.has(idx.toString())
  );

  const dismissSuggestion = (index: number) => {
    setDismissedIds(new Set([...dismissedIds, index.toString()]));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'recurring':
        return <Calendar className="h-4 w-4" />;
      case 'time-preference':
        return <Clock className="h-4 w-4" />;
      case 'duration-preference':
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Lightbulb className="h-4 w-4" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-500';
    if (confidence >= 0.6) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  if (visibleSuggestions.length === 0) {
    return null;
  }

  return (
    <Card className="p-4 bg-gradient-to-br  dark:from-purple-950 dark:to-blue-950  dark:border-purple-800">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          <h3 className="font-semibold">Smart Suggestions</h3>
          <Badge variant="secondary" className="text-xs">
            {visibleSuggestions.length}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Hide' : 'Show'}
        </Button>
      </div>

      {isExpanded && (
        <div className="space-y-2">
          {visibleSuggestions.slice(0, 3).map((suggestion, index) => (
            <div
              key={index}
              className="p-3 rounded-lg  dark:bg-black/20 border  dark:border-purple-800"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getIcon(suggestion.type)}
                    <span className="text-sm font-medium">{suggestion.description}</span>
                    <div
                      className={`w-2 h-2 rounded-full ${getConfidenceColor(suggestion.confidence)}`}
                      title={`${Math.round(suggestion.confidence * 100)}% confidence`}
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">{suggestion.suggestion}</p>
                  
                  {/* Additional context based on pattern type */}
                  {suggestion.type === 'recurring' && suggestion.data.nextSuggested && (
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {dayjs(suggestion.data.nextSuggested).format('MMM D, h:mm A')}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {suggestion.data.frequency}
                      </Badge>
                    </div>
                  )}

                  {suggestion.type === 'time-preference' && suggestion.data.dayOfWeek !== undefined && (
                    <div className="mt-2">
                      <Badge variant="outline" className="text-xs">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][suggestion.data.dayOfWeek]}s at {suggestion.data.hour}:00
                      </Badge>
                    </div>
                  )}

                  {suggestion.type === 'duration-preference' && (
                    <div className="mt-2">
                      <Badge variant="outline" className="text-xs">
                        Avg: {suggestion.data.averageDuration} min
                      </Badge>
                    </div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => dismissSuggestion(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}

          {visibleSuggestions.length > 3 && (
            <p className="text-xs text-center text-muted-foreground mt-2">
              +{visibleSuggestions.length - 3} more suggestions
            </p>
          )}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-800">
        <p className="text-xs text-muted-foreground">
          💡 Based on your scheduling patterns from the last 30 days
        </p>
      </div>
    </Card>
  );
}
