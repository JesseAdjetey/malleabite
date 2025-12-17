// Keyboard Shortcuts Hook - Google Calendar-style navigation
import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

// Define all available shortcuts
export type ShortcutAction =
  // Navigation
  | 'goToToday'
  | 'goToNextPeriod'
  | 'goToPrevPeriod'
  | 'goToDate'
  // View switching
  | 'dayView'
  | 'weekView'
  | 'monthView'
  | 'yearView'
  | 'scheduleView'
  | 'customView'
  // Actions
  | 'createEvent'
  | 'search'
  | 'refresh'
  | 'settings'
  | 'print'
  | 'showShortcuts'
  // Event actions
  | 'deleteEvent'
  | 'editEvent'
  | 'saveEvent'
  | 'cancelEdit'
  | 'duplicateEvent'
  // Selection
  | 'selectNext'
  | 'selectPrevious'
  | 'selectEvent'
  // Sidebar
  | 'toggleSidebar'
  | 'toggleCalendarList'
  | 'toggleMiniCalendar';

// Shortcut definition
export interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  category: 'navigation' | 'views' | 'actions' | 'events' | 'selection' | 'sidebar';
}

// Default shortcuts matching Google Calendar
export const DEFAULT_SHORTCUTS: Record<ShortcutAction, Shortcut> = {
  // Navigation
  goToToday: { key: 't', description: 'Go to today', category: 'navigation' },
  goToNextPeriod: { key: 'j', description: 'Go to next period', category: 'navigation' },
  goToPrevPeriod: { key: 'k', description: 'Go to previous period', category: 'navigation' },
  goToDate: { key: 'g', description: 'Go to a specific date', category: 'navigation' },
  
  // View switching
  dayView: { key: 'd', description: 'Day view', category: 'views' },
  weekView: { key: 'w', description: 'Week view', category: 'views' },
  monthView: { key: 'm', description: 'Month view', category: 'views' },
  yearView: { key: 'y', description: 'Year view', category: 'views' },
  scheduleView: { key: 'a', description: 'Schedule/Agenda view', category: 'views' },
  customView: { key: 'x', description: 'Custom view', category: 'views' },
  
  // Actions
  createEvent: { key: 'c', description: 'Create new event', category: 'actions' },
  search: { key: '/', description: 'Search', category: 'actions' },
  refresh: { key: 'r', description: 'Refresh calendar', category: 'actions' },
  settings: { key: 's', description: 'Open settings', category: 'actions' },
  print: { key: 'p', ctrl: true, description: 'Print', category: 'actions' },
  showShortcuts: { key: '?', shift: true, description: 'Show keyboard shortcuts', category: 'actions' },
  
  // Event actions
  deleteEvent: { key: 'Delete', description: 'Delete selected event', category: 'events' },
  editEvent: { key: 'e', description: 'Edit selected event', category: 'events' },
  saveEvent: { key: 's', ctrl: true, description: 'Save event', category: 'events' },
  cancelEdit: { key: 'Escape', description: 'Cancel/Close dialog', category: 'events' },
  duplicateEvent: { key: 'd', ctrl: true, description: 'Duplicate event', category: 'events' },
  
  // Selection
  selectNext: { key: 'Tab', description: 'Select next event', category: 'selection' },
  selectPrevious: { key: 'Tab', shift: true, description: 'Select previous event', category: 'selection' },
  selectEvent: { key: 'Enter', description: 'Open selected event', category: 'selection' },
  
  // Sidebar
  toggleSidebar: { key: '[', description: 'Toggle sidebar', category: 'sidebar' },
  toggleCalendarList: { key: ']', description: 'Toggle calendar list', category: 'sidebar' },
  toggleMiniCalendar: { key: '\\', description: 'Toggle mini calendar', category: 'sidebar' },
};

// Group shortcuts by category for display
export const SHORTCUT_CATEGORIES = {
  navigation: 'Navigation',
  views: 'Views',
  actions: 'Actions',
  events: 'Event Actions',
  selection: 'Selection',
  sidebar: 'Sidebar',
};

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  shortcuts?: Partial<Record<ShortcutAction, Shortcut>>;
  onAction?: (action: ShortcutAction) => void;
  // View callbacks
  onViewChange?: (view: 'day' | 'week' | 'month' | 'year' | 'schedule') => void;
  // Date callbacks
  onDateChange?: (date: Date) => void;
  currentDate?: Date;
  currentView?: 'day' | 'week' | 'month' | 'year' | 'schedule';
  // Event callbacks
  onCreateEvent?: () => void;
  onDeleteEvent?: () => void;
  onEditEvent?: () => void;
  onSaveEvent?: () => void;
  // Other callbacks
  onSearch?: () => void;
  onRefresh?: () => void;
  onToggleSidebar?: () => void;
  onShowShortcuts?: () => void;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const {
    enabled = true,
    shortcuts = DEFAULT_SHORTCUTS,
    onAction,
    onViewChange,
    onDateChange,
    currentDate = new Date(),
    currentView = 'month',
    onCreateEvent,
    onDeleteEvent,
    onEditEvent,
    onSaveEvent,
    onSearch,
    onRefresh,
    onToggleSidebar,
    onShowShortcuts,
  } = options;

  const navigate = useNavigate();
  const activeShortcuts = { ...DEFAULT_SHORTCUTS, ...shortcuts };
  
  // Track if user is in an input field
  const isTypingRef = useRef(false);

  // Check if a keyboard event matches a shortcut
  const matchesShortcut = useCallback((event: KeyboardEvent, shortcut: Shortcut): boolean => {
    const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase() ||
                       event.key === shortcut.key;
    const ctrlMatches = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
    const shiftMatches = !!shortcut.shift === event.shiftKey;
    const altMatches = !!shortcut.alt === event.altKey;

    return keyMatches && ctrlMatches && shiftMatches && altMatches;
  }, []);

  // Navigate to next/previous period based on current view
  const navigatePeriod = useCallback((direction: 'next' | 'prev') => {
    const amount = direction === 'next' ? 1 : -1;
    let newDate: Date;

    switch (currentView) {
      case 'day':
        newDate = dayjs(currentDate).add(amount, 'day').toDate();
        break;
      case 'week':
        newDate = dayjs(currentDate).add(amount, 'week').toDate();
        break;
      case 'year':
        newDate = dayjs(currentDate).add(amount, 'year').toDate();
        break;
      case 'month':
      default:
        newDate = dayjs(currentDate).add(amount, 'month').toDate();
        break;
    }

    onDateChange?.(newDate);
  }, [currentDate, currentView, onDateChange]);

  // Handle keyboard events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // Check if user is typing in an input
    const target = event.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || 
                    target.tagName === 'TEXTAREA' || 
                    target.isContentEditable;
    
    isTypingRef.current = isInput;

    // Allow certain shortcuts even when typing
    const allowedWhileTyping: ShortcutAction[] = ['cancelEdit', 'saveEvent'];

    // Find matching action
    let matchedAction: ShortcutAction | null = null;
    
    for (const [action, shortcut] of Object.entries(activeShortcuts)) {
      if (matchesShortcut(event, shortcut)) {
        matchedAction = action as ShortcutAction;
        break;
      }
    }

    if (!matchedAction) return;

    // Check if we should process this shortcut
    if (isInput && !allowedWhileTyping.includes(matchedAction)) {
      return;
    }

    // Prevent default for matching shortcuts
    event.preventDefault();

    // Notify listeners
    onAction?.(matchedAction);

    // Execute action
    switch (matchedAction) {
      // Navigation
      case 'goToToday':
        onDateChange?.(new Date());
        break;
      case 'goToNextPeriod':
        navigatePeriod('next');
        break;
      case 'goToPrevPeriod':
        navigatePeriod('prev');
        break;
        
      // View switching
      case 'dayView':
        onViewChange?.('day');
        break;
      case 'weekView':
        onViewChange?.('week');
        break;
      case 'monthView':
        onViewChange?.('month');
        break;
      case 'yearView':
        onViewChange?.('year');
        break;
      case 'scheduleView':
        onViewChange?.('schedule');
        break;
        
      // Actions
      case 'createEvent':
        onCreateEvent?.();
        break;
      case 'search':
        onSearch?.();
        break;
      case 'refresh':
        onRefresh?.();
        break;
      case 'settings':
        navigate('/settings');
        break;
      case 'showShortcuts':
        onShowShortcuts?.();
        break;
        
      // Event actions
      case 'deleteEvent':
        onDeleteEvent?.();
        break;
      case 'editEvent':
        onEditEvent?.();
        break;
      case 'saveEvent':
        onSaveEvent?.();
        break;
      case 'cancelEdit':
        // Usually handled by the dialog/form
        break;
        
      // Sidebar
      case 'toggleSidebar':
        onToggleSidebar?.();
        break;
    }
  }, [
    enabled,
    activeShortcuts,
    matchesShortcut,
    onAction,
    onViewChange,
    onDateChange,
    onCreateEvent,
    onDeleteEvent,
    onEditEvent,
    onSaveEvent,
    onSearch,
    onRefresh,
    onToggleSidebar,
    onShowShortcuts,
    navigatePeriod,
    navigate,
  ]);

  // Register event listener
  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, handleKeyDown]);

  // Format shortcut for display
  const formatShortcut = useCallback((shortcut: Shortcut): string => {
    const parts: string[] = [];
    
    if (shortcut.ctrl) parts.push('Ctrl');
    if (shortcut.alt) parts.push('Alt');
    if (shortcut.shift) parts.push('Shift');
    if (shortcut.meta) parts.push('⌘');
    
    // Format key nicely
    let key = shortcut.key;
    if (key === ' ') key = 'Space';
    if (key === 'Escape') key = 'Esc';
    if (key === 'Delete') key = 'Del';
    if (key === 'ArrowUp') key = '↑';
    if (key === 'ArrowDown') key = '↓';
    if (key === 'ArrowLeft') key = '←';
    if (key === 'ArrowRight') key = '→';
    
    parts.push(key.length === 1 ? key.toUpperCase() : key);
    
    return parts.join('+');
  }, []);

  // Get all shortcuts grouped by category
  const getShortcutsByCategory = useCallback(() => {
    const grouped: Record<string, Array<{ action: ShortcutAction; shortcut: Shortcut; formatted: string }>> = {};
    
    for (const [action, shortcut] of Object.entries(activeShortcuts)) {
      const category = shortcut.category;
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push({
        action: action as ShortcutAction,
        shortcut,
        formatted: formatShortcut(shortcut),
      });
    }
    
    return grouped;
  }, [activeShortcuts, formatShortcut]);

  return {
    shortcuts: activeShortcuts,
    formatShortcut,
    getShortcutsByCategory,
    isTyping: isTypingRef.current,
  };
}

export default useKeyboardShortcuts;
