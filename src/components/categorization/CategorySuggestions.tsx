import { useState, useEffect } from 'react';
import { Wand2, Check } from 'lucide-react';
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
    if (confidence >= 0.8) return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (confidence >= 0.6) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
  };

  return (
    <div className="p-3 rounded-lg bg-black/30 backdrop-blur-sm border border-purple-500/30">
      <div className="flex items-center gap-2 mb-2">
        <Wand2 className="h-4 w-4 text-purple-400" />
        <span className="text-sm font-medium text-white">Smart Category Suggestions</span>
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
                  ? 'bg-purple-500/20 border-purple-400 shadow-sm'
                  : 'bg-white/5 border-white/10 hover:bg-white/10'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-lg flex-shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm capitalize text-white">
                        {suggestion.category}
                      </span>
                      <Badge
                        variant="secondary"
                        className={`text-xs px-1.5 py-0 ${getConfidenceColor(suggestion.confidence)}`}
                      >
                        {getConfidenceBadge(suggestion.confidence)}
                      </Badge>
                      {isSelected && (
                        <Check className="h-3 w-3 text-purple-400" />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      {suggestion.reason}
                    </p>
                  </div>
                </div>
                <div
                  className="w-6 h-6 rounded-full flex-shrink-0"
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
