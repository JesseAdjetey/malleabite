// Event Search Hook - Full-text search across calendar events
import { useState, useCallback, useMemo } from 'react';
import { CalendarEventType } from '@/lib/stores/types';
import dayjs from 'dayjs';

export interface SearchFilters {
  query: string;
  dateFrom?: Date;
  dateTo?: Date;
  calendarIds?: string[];
  attendees?: string[];
  hasLocation?: boolean;
  isRecurring?: boolean;
}

export interface SearchResult {
  event: CalendarEventType;
  matchedFields: ('title' | 'description' | 'location' | 'attendees')[];
  relevanceScore: number;
}

export function useEventSearch(events: CalendarEventType[]) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({ query: '' });
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem('eventSearchHistory');
    return saved ? JSON.parse(saved) : [];
  });

  // Save search to history
  const saveToHistory = useCallback((query: string) => {
    if (!query.trim()) return;
    
    setSearchHistory(prev => {
      const updated = [query, ...prev.filter(q => q !== query)].slice(0, 10);
      localStorage.setItem('eventSearchHistory', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Clear search history
  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    localStorage.removeItem('eventSearchHistory');
  }, []);

  // Calculate relevance score based on match quality
  const calculateRelevance = useCallback((
    event: CalendarEventType, 
    query: string
  ): { score: number; matchedFields: SearchResult['matchedFields'] } => {
    const queryLower = query.toLowerCase();
    const words = queryLower.split(/\s+/).filter(w => w.length > 0);
    let score = 0;
    const matchedFields: SearchResult['matchedFields'] = [];

    // Title matches (highest weight)
    const titleLower = event.title.toLowerCase();
    if (titleLower === queryLower) {
      score += 100; // Exact match
      matchedFields.push('title');
    } else if (titleLower.includes(queryLower)) {
      score += 80; // Contains full query
      matchedFields.push('title');
    } else {
      const titleWordMatches = words.filter(w => titleLower.includes(w)).length;
      if (titleWordMatches > 0) {
        score += 50 * (titleWordMatches / words.length);
        matchedFields.push('title');
      }
    }

    // Description matches (medium weight)
    const descLower = (event.description || '').toLowerCase();
    if (descLower.includes(queryLower)) {
      score += 40;
      matchedFields.push('description');
    } else {
      const descWordMatches = words.filter(w => descLower.includes(w)).length;
      if (descWordMatches > 0) {
        score += 20 * (descWordMatches / words.length);
        matchedFields.push('description');
      }
    }

    // Location matches (if available)
    const locationLower = ((event as any).location || '').toLowerCase();
    if (locationLower && locationLower.includes(queryLower)) {
      score += 30;
      matchedFields.push('location');
    }

    // Attendee matches
    const attendees = event.participants || [];
    const attendeeMatch = attendees.some(a => 
      a.toLowerCase().includes(queryLower)
    );
    if (attendeeMatch) {
      score += 25;
      matchedFields.push('attendees');
    }

    // Boost recent events slightly
    const eventDate = dayjs(event.startsAt);
    const today = dayjs();
    const daysDiff = Math.abs(eventDate.diff(today, 'day'));
    if (daysDiff <= 7) score += 5;
    else if (daysDiff <= 30) score += 2;

    return { score, matchedFields };
  }, []);

  // Search function
  const search = useCallback((
    query: string,
    additionalFilters?: Partial<SearchFilters>
  ): SearchResult[] => {
    const currentFilters = { ...filters, ...additionalFilters, query };
    
    if (!query.trim() && !currentFilters.dateFrom && !currentFilters.dateTo) {
      return [];
    }

    let filtered = events;

    // Apply date filters
    if (currentFilters.dateFrom) {
      const fromDate = dayjs(currentFilters.dateFrom).startOf('day');
      filtered = filtered.filter(e => 
        dayjs(e.startsAt).isAfter(fromDate) || dayjs(e.startsAt).isSame(fromDate)
      );
    }

    if (currentFilters.dateTo) {
      const toDate = dayjs(currentFilters.dateTo).endOf('day');
      filtered = filtered.filter(e => 
        dayjs(e.startsAt).isBefore(toDate) || dayjs(e.startsAt).isSame(toDate)
      );
    }

    // Apply recurring filter
    if (currentFilters.isRecurring !== undefined) {
      filtered = filtered.filter(e => !!e.isRecurring === currentFilters.isRecurring);
    }

    // Apply calendar filter
    if (currentFilters.calendarIds?.length) {
      filtered = filtered.filter(e => 
        currentFilters.calendarIds!.includes((e as any).calendarId || 'default')
      );
    }

    // Apply text search
    if (query.trim()) {
      const results: SearchResult[] = [];
      
      for (const event of filtered) {
        const { score, matchedFields } = calculateRelevance(event, query);
        if (score > 0) {
          results.push({ event, matchedFields, relevanceScore: score });
        }
      }

      // Sort by relevance, then by date
      return results.sort((a, b) => {
        if (b.relevanceScore !== a.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
        return dayjs(a.event.startsAt).isBefore(dayjs(b.event.startsAt)) ? -1 : 1;
      });
    }

    // No text search, just return filtered events
    return filtered.map(event => ({
      event,
      matchedFields: [],
      relevanceScore: 0
    }));
  }, [events, filters, calculateRelevance]);

  // Real-time search results (debounced in component)
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return search(searchQuery);
  }, [searchQuery, search]);

  // Quick search suggestions based on history and upcoming events
  const suggestions = useMemo(() => {
    const suggestions: Array<{ type: 'history' | 'upcoming'; text: string }> = [];

    // Add search history
    searchHistory.slice(0, 5).forEach(query => {
      suggestions.push({ type: 'history', text: query });
    });

    // Add upcoming event titles as suggestions
    const upcoming = events
      .filter(e => dayjs(e.startsAt).isAfter(dayjs()))
      .sort((a, b) => dayjs(a.startsAt).diff(dayjs(b.startsAt)))
      .slice(0, 5);

    upcoming.forEach(event => {
      if (!suggestions.some(s => s.text.toLowerCase() === event.title.toLowerCase())) {
        suggestions.push({ type: 'upcoming', text: event.title });
      }
    });

    return suggestions.slice(0, 10);
  }, [events, searchHistory]);

  return {
    searchQuery,
    setSearchQuery,
    searchResults,
    search,
    filters,
    setFilters,
    searchHistory,
    saveToHistory,
    clearHistory,
    suggestions,
    resultCount: searchResults.length,
  };
}

export default useEventSearch;
