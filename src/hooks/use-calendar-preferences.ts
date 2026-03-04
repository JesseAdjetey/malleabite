// Calendar Preferences Hook
// Manages user preferences for calendar display: visibility, expanded groups, primary calendar.
// Persists to Firestore with optimistic local updates for snappy UI.

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  doc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.unified';
import { logger } from '@/lib/logger';
import { CalendarPreferences } from '@/types/calendar';
import * as calendarService from '@/lib/services/calendarService';
import { useCalendarFilterStore } from '@/lib/stores/calendar-filter-store';

interface UseCalendarPreferencesReturn {
  preferences: CalendarPreferences | null;
  loading: boolean;

  // Visibility
  visibleCalendars: string[];
  toggleCalendarVisibility: (calendarId: string) => Promise<void>;
  setVisibleCalendars: (calendarIds: string[]) => Promise<void>;

  // Groups expanded state
  expandedGroups: string[];
  toggleGroupExpanded: (groupId: string) => Promise<void>;
  setExpandedGroups: (groupIds: string[]) => Promise<void>;

  // Primary calendar
  primaryCalendarId: string | undefined;
  setPrimaryCalendar: (calendarId: string) => Promise<void>;

  // Group ordering
  groupOrder: string[];
  setGroupOrder: (orderedGroupIds: string[]) => Promise<void>;

  // Sync strategy
  syncStrategy: 'all' | 'active';
  setSyncStrategy: (strategy: 'all' | 'active') => Promise<void>;
}

export function useCalendarPreferences(): UseCalendarPreferencesReturn {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<CalendarPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const unsubRef = useRef<(() => void) | null>(null);

  // Debounce timer for batching rapid preference changes
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUpdatesRef = useRef<Partial<CalendarPreferences>>({});

  // ─── Real-time Listener ─────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.uid) {
      setPreferences(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const prefsRef = doc(db, `users/${user.uid}/calendarPreferences`, 'settings');

    const unsub = onSnapshot(prefsRef, (snapshot) => {
      if (snapshot.exists()) {
        setPreferences({
          userId: user.uid,
          ...snapshot.data(),
        } as CalendarPreferences);
      } else {
        // No preferences yet - will be created on first interaction
        setPreferences(null);
      }
      setLoading(false);
    }, (err) => {
      logger.error('useCalendarPreferences', 'Listener error', { error: err });
      setLoading(false);
    });

    unsubRef.current = unsub;
    return () => {
      unsub();
      unsubRef.current = null;
    };
  }, [user?.uid]);

  // ─── Debounced Save ─────────────────────────────────────────────────────

  const debouncedSave = useCallback((updates: Partial<CalendarPreferences>) => {
    if (!user?.uid) return;

    // Merge with pending updates
    pendingUpdatesRef.current = { ...pendingUpdatesRef.current, ...updates };

    // Clear existing timer
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Save after 300ms of no changes (batches rapid toggles)
    saveTimeoutRef.current = setTimeout(async () => {
      const pending = pendingUpdatesRef.current;
      pendingUpdatesRef.current = {};
      try {
        await calendarService.updateCalendarPreferences(user.uid, pending);
      } catch (err) {
        logger.error('useCalendarPreferences', 'Failed to save preferences', { error: err });
      }
    }, 300);
  }, [user?.uid]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // ─── Optimistic Update Helper ───────────────────────────────────────────

  const optimisticUpdate = useCallback((updates: Partial<CalendarPreferences>) => {
    // Apply locally immediately for snappy UI.
    // If preferences haven't been loaded from Firestore yet (null), create a
    // minimal local object so the optimistic state isn't silently dropped.
    setPreferences(prev =>
      prev
        ? { ...prev, ...updates }
        : { userId: user?.uid || '', ...updates } as CalendarPreferences
    );
    // Then persist
    debouncedSave(updates);
  }, [debouncedSave, user?.uid]);

  // ─── Visibility ─────────────────────────────────────────────────────────

  const visibleCalendars = preferences?.visibleCalendars ?? [];

  const toggleCalendarVisibility = useCallback(async (calendarId: string) => {
    let current = preferences?.visibleCalendars ?? [];

    // If visibleCalendars is empty (never explicitly set), we treat ALL calendars
    // as visible. To properly toggle one OFF, we first populate the list with
    // all known calendar IDs so the removal is meaningful.
    if (current.length === 0) {
      const { accounts } = useCalendarFilterStore.getState();
      current = accounts.map(a => a.id);
    }

    const updated = current.includes(calendarId)
      ? current.filter(id => id !== calendarId)
      : [...current, calendarId];
    optimisticUpdate({ visibleCalendars: updated });
  }, [preferences?.visibleCalendars, optimisticUpdate]);

  const setVisibleCalendars = useCallback(async (calendarIds: string[]) => {
    optimisticUpdate({ visibleCalendars: calendarIds });
  }, [optimisticUpdate]);

  // ─── Expanded Groups ───────────────────────────────────────────────────

  const expandedGroups = preferences?.expandedGroups ?? [];

  const toggleGroupExpanded = useCallback(async (groupId: string) => {
    const current = preferences?.expandedGroups ?? [];
    const updated = current.includes(groupId)
      ? current.filter(id => id !== groupId)
      : [...current, groupId];
    optimisticUpdate({ expandedGroups: updated });
  }, [preferences?.expandedGroups, optimisticUpdate]);

  const setExpandedGroups = useCallback(async (groupIds: string[]) => {
    optimisticUpdate({ expandedGroups: groupIds });
  }, [optimisticUpdate]);

  // ─── Primary Calendar ──────────────────────────────────────────────────

  const primaryCalendarId = preferences?.primaryCalendarId;

  const setPrimaryCalendar = useCallback(async (calendarId: string) => {
    optimisticUpdate({ primaryCalendarId: calendarId });
  }, [optimisticUpdate]);

  // ─── Group Order ───────────────────────────────────────────────────────

  const groupOrder = preferences?.groupOrder ?? [];

  const setGroupOrder = useCallback(async (orderedGroupIds: string[]) => {
    optimisticUpdate({ groupOrder: orderedGroupIds });
  }, [optimisticUpdate]);

  // ─── Sync Strategy ─────────────────────────────────────────────────────

  const syncStrategy = preferences?.syncStrategy ?? 'active';

  const setSyncStrategy = useCallback(async (strategy: 'all' | 'active') => {
    optimisticUpdate({ syncStrategy: strategy });
  }, [optimisticUpdate]);

  return {
    preferences,
    loading,
    visibleCalendars,
    toggleCalendarVisibility,
    setVisibleCalendars,
    expandedGroups,
    toggleGroupExpanded,
    setExpandedGroups,
    primaryCalendarId,
    setPrimaryCalendar,
    groupOrder,
    setGroupOrder,
    syncStrategy,
    setSyncStrategy,
  };
}
