// Event Search Bar Component - Google Calendar-style search
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Clock, Calendar, Filter, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { useEventSearch, SearchResult } from '@/hooks/use-event-search';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useEventStore } from '@/lib/store';

interface SearchBarProps {
  className?: string;
  onResultSelect?: (event: SearchResult['event']) => void;
}

export function SearchBar({ className, onResultSelect }: SearchBarProps) {
  const { events } = useCalendarEvents();
  const { openEventSummary } = useEventStore();
  const navigate = useNavigate();
  
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    saveToHistory,
    clearHistory,
    suggestions,
    filters,
    setFilters,
  } = useEventSearch(events);

  const [isOpen, setIsOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle keyboard shortcut (/)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          inputRef.current?.focus();
          setIsOpen(true);
        }
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  const [debouncedQuery, setDebouncedQuery] = useState(searchQuery);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelect = useCallback((event: SearchResult['event']) => {
    saveToHistory(searchQuery);
    setIsOpen(false);
    setSearchQuery('');
    
    if (onResultSelect) {
      onResultSelect(event);
    } else {
      // Default behavior: navigate to calendar and select event
      openEventSummary(event);
      navigate('/calendar');
    }
  }, [searchQuery, saveToHistory, setSearchQuery, onResultSelect, openEventSummary, navigate]);

  const handleClear = () => {
    setSearchQuery('');
    setFilters({ query: '' });
    inputRef.current?.focus();
  };

  const formatEventDate = (dateStr: string) => {
    const date = dayjs(dateStr);
    const today = dayjs();
    
    if (date.isSame(today, 'day')) return 'Today';
    if (date.isSame(today.add(1, 'day'), 'day')) return 'Tomorrow';
    if (date.isSame(today.subtract(1, 'day'), 'day')) return 'Yesterday';
    if (date.isSame(today, 'week')) return date.format('dddd');
    if (date.isSame(today, 'year')) return date.format('MMM D');
    return date.format('MMM D, YYYY');
  };

  const formatEventTime = (startsAt: string, endsAt: string) => {
    const start = dayjs(startsAt);
    const end = dayjs(endsAt);
    return `${start.format('h:mm A')} - ${end.format('h:mm A')}`;
  };

  // Highlight matching text
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, i) => 
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-500/30 text-white rounded px-0.5">
          {part}
        </mark>
      ) : part
    );
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search events... (Press / to focus)"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className={cn(
            "pl-10 pr-20 bg-background/50 border-white/10",
            "focus:bg-background focus:border-primary/50",
            "transition-all duration-200"
          )}
        />
        
        {/* Right side buttons */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleClear}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <Filter className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Search Results Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50">
          <div className="bg-popover border border-white/10 rounded-lg shadow-xl overflow-hidden max-h-[400px] overflow-y-auto">
            
            {/* Advanced Filters */}
            {showAdvanced && (
              <div className="p-3 border-b border-white/10 bg-black/20">
                <div className="flex flex-wrap gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        <Calendar className="h-3 w-3 mr-1" />
                        {filters.dateFrom ? dayjs(filters.dateFrom).format('MMM D') : 'From'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={filters.dateFrom}
                        onSelect={(date) => setFilters({ ...filters, dateFrom: date })}
                      />
                    </PopoverContent>
                  </Popover>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 text-xs">
                        <Calendar className="h-3 w-3 mr-1" />
                        {filters.dateTo ? dayjs(filters.dateTo).format('MMM D') : 'To'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarPicker
                        mode="single"
                        selected={filters.dateTo}
                        onSelect={(date) => setFilters({ ...filters, dateTo: date })}
                      />
                    </PopoverContent>
                  </Popover>

                  <Button
                    variant={filters.isRecurring ? "secondary" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setFilters({ 
                      ...filters, 
                      isRecurring: filters.isRecurring === true ? undefined : true 
                    })}
                  >
                    Recurring only
                  </Button>

                  {(filters.dateFrom || filters.dateTo || filters.isRecurring !== undefined) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-red-400"
                      onClick={() => setFilters({ query: searchQuery })}
                    >
                      Clear filters
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Search Results */}
            {debouncedQuery.trim() && searchResults.length > 0 && (
              <div className="py-2">
                <div className="px-3 py-1 text-xs text-muted-foreground">
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                </div>
                {searchResults.slice(0, 10).map(({ event, matchedFields }) => (
                  <button
                    key={event.id}
                    className={cn(
                      "w-full px-3 py-2 text-left hover:bg-white/5",
                      "flex items-start gap-3 transition-colors"
                    )}
                    onClick={() => handleSelect(event)}
                  >
                    <div 
                      className="w-3 h-3 rounded-full mt-1.5 flex-shrink-0"
                      style={{ backgroundColor: event.color || '#3b82f6' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {highlightMatch(event.title, debouncedQuery)}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>{formatEventDate(event.startsAt)}</span>
                        <span>•</span>
                        <span>{formatEventTime(event.startsAt, event.endsAt)}</span>
                      </div>
                      {event.description && matchedFields.includes('description') && (
                        <div className="text-xs text-muted-foreground/70 truncate mt-0.5">
                          {highlightMatch(event.description.slice(0, 100), debouncedQuery)}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {matchedFields.map(field => (
                        <Badge key={field} variant="outline" className="text-[10px] h-4">
                          {field}
                        </Badge>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* No Results */}
            {debouncedQuery.trim() && searchResults.length === 0 && (
              <div className="px-3 py-8 text-center text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No events found</p>
                <p className="text-xs mt-1">Try different keywords or adjust filters</p>
              </div>
            )}

            {/* Suggestions (when no query) */}
            {!debouncedQuery.trim() && suggestions.length > 0 && (
              <div className="py-2">
                {suggestions.some(s => s.type === 'history') && (
                  <>
                    <div className="px-3 py-1 text-xs text-muted-foreground flex justify-between">
                      <span>Recent searches</span>
                      <button 
                        className="text-primary hover:underline"
                        onClick={clearHistory}
                      >
                        Clear
                      </button>
                    </div>
                    {suggestions
                      .filter(s => s.type === 'history')
                      .map((suggestion, i) => (
                        <button
                          key={`history-${i}`}
                          className="w-full px-3 py-2 text-left hover:bg-white/5 flex items-center gap-2"
                          onClick={() => setSearchQuery(suggestion.text)}
                        >
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>{suggestion.text}</span>
                        </button>
                      ))
                    }
                  </>
                )}
                
                {suggestions.some(s => s.type === 'upcoming') && (
                  <>
                    <div className="px-3 py-1 text-xs text-muted-foreground mt-2">
                      Upcoming events
                    </div>
                    {suggestions
                      .filter(s => s.type === 'upcoming')
                      .map((suggestion, i) => (
                        <button
                          key={`upcoming-${i}`}
                          className="w-full px-3 py-2 text-left hover:bg-white/5 flex items-center gap-2"
                          onClick={() => setSearchQuery(suggestion.text)}
                        >
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span>{suggestion.text}</span>
                        </button>
                      ))
                    }
                  </>
                )}
              </div>
            )}

            {/* Keyboard hint */}
            <div className="px-3 py-2 border-t border-white/10 bg-black/20 flex justify-between text-[10px] text-muted-foreground">
              <span>↑↓ to navigate • Enter to select • Esc to close</span>
              <span>Press / to search from anywhere</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchBar;
