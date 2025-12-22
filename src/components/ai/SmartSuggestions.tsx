// Smart AI Suggestions Component
import React from 'react';
import { Brain, Clock, AlertTriangle, Lightbulb, TrendingUp, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScheduleSuggestion } from '@/hooks/use-schedule-optimizer';
import { cn } from '@/lib/utils';

interface SmartSuggestionsProps {
  suggestions: ScheduleSuggestion[];
  conflicts?: number;
  onDismiss?: (index: number) => void;
  className?: string;
}

const typeIcons = {
  optimal_time: Clock,
  conflict_resolution: AlertTriangle,
  productivity_tip: Lightbulb,
  pattern_insight: TrendingUp,
};

const priorityColors = {
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

export function SmartSuggestions({ 
  suggestions, 
  conflicts = 0,
  onDismiss,
  className 
}: SmartSuggestionsProps) {
  if (suggestions.length === 0 && conflicts === 0) {
    return null;
  }

  return (
    <Card className={cn("glass border-purple-500/20", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Brain className="h-4 w-4 text-purple-400" />
          <span>AI Insights</span>
          {conflicts > 0 && (
            <Badge variant="destructive" className="ml-auto text-xs">
              {conflicts} conflict{conflicts > 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {suggestions.map((suggestion, index) => {
          const Icon = typeIcons[suggestion.type];
          
          return (
            <div
              key={index}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border transition-all",
                priorityColors[suggestion.priority]
              )}
            >
              <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{suggestion.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {suggestion.description}
                </p>
              </div>
              {onDismiss && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
                  onClick={() => onDismiss(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          );
        })}
        
        {suggestions.length === 0 && conflicts > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <p className="text-sm text-red-400">
              You have {conflicts} scheduling conflict{conflicts > 1 ? 's' : ''} to resolve
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Mini version for header/sidebar
export function SmartSuggestionsBadge({ 
  suggestions, 
  conflicts = 0,
  onClick 
}: { 
  suggestions: ScheduleSuggestion[];
  conflicts?: number;
  onClick?: () => void;
}) {
  const highPriority = suggestions.filter(s => s.priority === 'high').length + conflicts;
  
  if (highPriority === 0 && suggestions.length === 0) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="relative"
    >
      <Brain className="h-4 w-4" />
      {highPriority > 0 && (
        <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center">
          {highPriority}
        </span>
      )}
    </Button>
  );
}
