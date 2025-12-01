import { useState, useEffect } from 'react';
import { Sparkles, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { classifyEvent, getCategoryColor, getCategoryIcon, type CategorySuggestion, type EventCategory } from '@/lib/algorithms/event-classifier';

interface CategorySuggestionsProps {
  title: string;
  description?: string;
  location?: string;
  currentCategory?: EventCategory;
  onSelectCategory: (category: EventCategory) => void;
}

export function CategorySuggestions({
  title,
  description,
  location,
  currentCategory,
  onSelectCategory,
}: CategorySuggestionsProps) {
  const [suggestions, setSuggestions] = useState<CategorySuggestion[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (title && title.length >= 3) {
      const results = classifyEvent(title, description, location);
      setSuggestions(results);
      setIsVisible(results.length > 0 && results[0].confidence >= 0.4);
    } else {
      setSuggestions([]);
      setIsVisible(false);
    }
  }, [title, description, location]);

  if (!isVisible || suggestions.length === 0) {
    return null;
  }

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100';
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100';
  };

  return (
    <div className="p-3 rounded-lg bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 border border-purple-200 dark:border-purple-800">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-purple-600 dark:text-purple-400" />
        <span className="text-sm font-medium">Smart Category Suggestions</span>
      </div>

      <div className="space-y-2">
        {suggestions.slice(0, 3).map((suggestion, idx) => {
          const isSelected = currentCategory === suggestion.category;
          const color = getCategoryColor(suggestion.category);
          const icon = getCategoryIcon(suggestion.category);

          return (
            <button
              key={idx}
              onClick={() => onSelectCategory(suggestion.category)}
              className={`w-full text-left p-2 rounded-md border transition-all ${
                isSelected
                  ? 'bg-white dark:bg-gray-800 border-purple-400 shadow-sm'
                  : 'bg-white/50 dark:bg-gray-800/50 border-purple-200 dark:border-purple-800 hover:bg-white dark:hover:bg-gray-800'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-lg">{icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm capitalize">
                        {suggestion.category}
                      </span>
                      <Badge
                        variant="secondary"
                        className={`text-xs ${getConfidenceColor(suggestion.confidence)}`}
                      >
                        {getConfidenceBadge(suggestion.confidence)}
                      </Badge>
                      {isSelected && (
                        <Check className="h-3 w-3 text-purple-600" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {suggestion.reason}
                    </p>
                  </div>
                </div>
                <div
                  className="w-8 h-8 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        💡 Click a suggestion to apply. The system learns from your choices!
      </p>
    </div>
  );
}
