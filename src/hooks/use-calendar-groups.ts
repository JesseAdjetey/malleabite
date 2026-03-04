// Calendar Groups Hook
// Manages calendar groups, connected calendars, and their ordering.
// Provides real-time Firestore listeners + CRUD operations.

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.unified';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';
import {
  CalendarGroup,
  ConnectedCalendar,
} from '@/types/calendar';
import * as calendarService from '@/lib/services/calendarService';

interface UseCalendarGroupsReturn {
  // Data
  groups: CalendarGroup[];
  calendars: ConnectedCalendar[];
  loading: boolean;
  error: string | null;
  initialized: boolean;

  // Group CRUD
  createGroup: (name: string, icon?: CalendarGroup['icon'], color?: string) => Promise<CalendarGroup | null>;
  updateGroup: (groupId: string, updates: Partial<CalendarGroup>) => Promise<void>;
  deleteGroup: (groupId: string, moveCalendarsToGroupId?: string) => Promise<void>;
  reorderGroups: (orderedGroupIds: string[]) => Promise<void>;

  // Calendar CRUD
  addCalendar: (data: Parameters<typeof calendarService.addConnectedCalendar>[1]) => Promise<ConnectedCalendar | null>;
  updateCalendar: (calendarId: string, updates: Partial<ConnectedCalendar>) => Promise<void>;
  deleteCalendar: (calendarId: string) => Promise<void>;
  moveCalendar: (calendarId: string, newGroupId: string, newOrder?: number) => Promise<void>;
  toggleCalendar: (calendarId: string, isActive: boolean) => Promise<void>;
  reorderCalendars: (orderedCalendarIds: string[]) => Promise<void>;

  // Helpers
  getGroupCalendars: (groupId: string) => ConnectedCalendar[];
  getActiveCalendars: () => ConnectedCalendar[];
  initialize: () => Promise<void>;
}

export function useCalendarGroups(): UseCalendarGroupsReturn {
  const { user } = useAuth();
  const [groups, setGroups] = useState<CalendarGroup[]>([]);
  const [calendars, setCalendars] = useState<ConnectedCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const unsubscribeRefs = useRef<(() => void)[]>([]);

  // ─── Real-time Listeners ────────────────────────────────────────────────

  useEffect(() => {
    if (!user?.uid) {
      setGroups([]);
      setCalendars([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const userId = user.uid;

    // Listen to groups
    const groupsRef = collection(db, `users/${userId}/calendarGroups`);
    const groupsQuery = query(groupsRef, orderBy('order', 'asc'));
    const unsubGroups = onSnapshot(groupsQuery, (snapshot) => {
      const groupData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as CalendarGroup));
      setGroups(groupData);
      setLoading(false);

      // If no groups exist, the user hasn't been initialized
      if (groupData.length === 0 && !initialized) {
        // Will be initialized via initialize()
      } else {
        setInitialized(true);
      }
    }, (err) => {
      logger.error('useCalendarGroups', 'Groups listener error', { error: err });
      setError('Failed to load calendar groups');
      setLoading(false);
    });

    // Listen to calendars
    const calendarsRef = collection(db, `users/${userId}/connectedCalendars`);
    const calendarsQuery = query(calendarsRef, orderBy('order', 'asc'));
    const unsubCalendars = onSnapshot(calendarsQuery, (snapshot) => {
      const calendarData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as ConnectedCalendar));
      setCalendars(calendarData);
    }, (err) => {
      logger.error('useCalendarGroups', 'Calendars listener error', { error: err });
    });

    unsubscribeRefs.current = [unsubGroups, unsubCalendars];

    return () => {
      unsubscribeRefs.current.forEach(unsub => unsub());
      unsubscribeRefs.current = [];
    };
  }, [user?.uid]);

  // ─── Initialize ─────────────────────────────────────────────────────────

  const initialize = useCallback(async () => {
    if (!user?.uid) return;
    try {
      setLoading(true);
      await calendarService.initializeCalendarModule(user.uid);
      setInitialized(true);
      logger.info('useCalendarGroups', 'Calendar module initialized');
    } catch (err) {
      logger.error('useCalendarGroups', 'Failed to initialize', { error: err });
      setError('Failed to initialize calendar groups');
    } finally {
      setLoading(false);
    }
  }, [user?.uid]);

  // Auto-initialize when user logs in but has no groups.
  // Uses a ref to prevent concurrent re-init attempts.
  const initAttemptRef = useRef(false);
  useEffect(() => {
    if (user?.uid && !loading && groups.length === 0 && !initAttemptRef.current) {
      initAttemptRef.current = true;
      setInitialized(false);
      initialize().finally(() => {
        // Allow re-init if groups still end up empty after a delay
        setTimeout(() => { initAttemptRef.current = false; }, 5000);
      });
    }
  }, [user?.uid, loading, groups.length, initialize]);

  // One-time dedup cleanup on mount
  const dedupRanRef = useRef(false);
  useEffect(() => {
    if (user?.uid && groups.length > 0 && !dedupRanRef.current) {
      dedupRanRef.current = true;
      calendarService.deduplicateGroups(user.uid).then((removed) => {
        if (removed > 0) {
          logger.info('useCalendarGroups', `Cleaned up ${removed} duplicate groups`);
        }
      });
    }
  }, [user?.uid, groups.length]);

  // ─── Group Operations ───────────────────────────────────────────────────

  const createGroup = useCallback(async (
    name: string,
    icon?: CalendarGroup['icon'],
    color?: string
  ): Promise<CalendarGroup | null> => {
    if (!user?.uid) return null;
    try {
      const newGroup = await calendarService.createGroup(user.uid, {
        name,
        icon: icon || 'folder',
        color,
        order: groups.length,
      });
      toast.success(`Created group "${name}"`);
      return newGroup;
    } catch (err) {
      toast.error('Failed to create group');
      return null;
    }
  }, [user?.uid, groups.length]);

  const updateGroup = useCallback(async (
    groupId: string,
    updates: Partial<CalendarGroup>
  ): Promise<void> => {
    if (!user?.uid) return;
    try {
      await calendarService.updateGroup(user.uid, groupId, updates);
    } catch (err) {
      toast.error('Failed to update group');
    }
  }, [user?.uid]);

  const deleteGroup = useCallback(async (
    groupId: string,
    moveCalendarsToGroupId?: string
  ): Promise<void> => {
    if (!user?.uid) return;
    try {
      await calendarService.deleteGroup(user.uid, groupId, moveCalendarsToGroupId);
      toast.success('Group deleted');
    } catch (err) {
      toast.error('Failed to delete group');
    }
  }, [user?.uid]);

  const reorderGroups = useCallback(async (
    orderedGroupIds: string[]
  ): Promise<void> => {
    if (!user?.uid) return;
    try {
      await calendarService.reorderGroups(user.uid, orderedGroupIds);
    } catch (err) {
      toast.error('Failed to reorder groups');
    }
  }, [user?.uid]);

  // ─── Calendar Operations ────────────────────────────────────────────────

  const addCalendar = useCallback(async (
    data: Parameters<typeof calendarService.addConnectedCalendar>[1]
  ): Promise<ConnectedCalendar | null> => {
    if (!user?.uid) return null;
    try {
      const newCalendar = await calendarService.addConnectedCalendar(user.uid, data);
      toast.success(`Added "${newCalendar.name}"`);
      return newCalendar;
    } catch (err) {
      toast.error('Failed to add calendar');
      return null;
    }
  }, [user?.uid]);

  const updateCalendar = useCallback(async (
    calendarId: string,
    updates: Partial<ConnectedCalendar>
  ): Promise<void> => {
    if (!user?.uid) return;
    try {
      await calendarService.updateConnectedCalendar(user.uid, calendarId, updates);
    } catch (err) {
      toast.error('Failed to update calendar');
    }
  }, [user?.uid]);

  const deleteCalendar = useCallback(async (
    calendarId: string
  ): Promise<void> => {
    if (!user?.uid) return;
    try {
      await calendarService.deleteConnectedCalendar(user.uid, calendarId);
      toast.success('Calendar removed');
    } catch (err) {
      toast.error('Failed to remove calendar');
    }
  }, [user?.uid]);

  const moveCalendar = useCallback(async (
    calendarId: string,
    newGroupId: string,
    newOrder?: number
  ): Promise<void> => {
    if (!user?.uid) return;
    try {
      await calendarService.moveCalendarToGroup(user.uid, calendarId, newGroupId, newOrder);
    } catch (err) {
      toast.error('Failed to move calendar');
    }
  }, [user?.uid]);

  const toggleCalendar = useCallback(async (
    calendarId: string,
    isActive: boolean
  ): Promise<void> => {
    if (!user?.uid) return;
    try {
      await calendarService.toggleCalendarActive(user.uid, calendarId, isActive);
    } catch (err) {
      toast.error('Failed to toggle calendar');
    }
  }, [user?.uid]);

  const reorderCalendars = useCallback(async (
    orderedCalendarIds: string[]
  ): Promise<void> => {
    if (!user?.uid) return;
    try {
      await calendarService.reorderCalendarsInGroup(user.uid, orderedCalendarIds);
    } catch (err) {
      toast.error('Failed to reorder calendars');
    }
  }, [user?.uid]);

  // ─── Helpers ────────────────────────────────────────────────────────────

  const getGroupCalendars = useCallback((groupId: string): ConnectedCalendar[] => {
    return calendars
      .filter(c => c.groupId === groupId)
      .sort((a, b) => a.order - b.order);
  }, [calendars]);

  const getActiveCalendars = useCallback((): ConnectedCalendar[] => {
    return calendars.filter(c => c.isActive);
  }, [calendars]);

  return {
    groups,
    calendars,
    loading,
    error,
    initialized,
    createGroup,
    updateGroup,
    deleteGroup,
    reorderGroups,
    addCalendar,
    updateCalendar,
    deleteCalendar,
    moveCalendar,
    toggleCalendar,
    reorderCalendars,
    getGroupCalendars,
    getActiveCalendars,
    initialize,
  };
}
