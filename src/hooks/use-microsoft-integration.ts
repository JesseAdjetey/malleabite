/**
 * Microsoft integration hook
 *
 * Covers: Microsoft To Do + Outlook Calendar
 * Handles: connection status, OAuth popup, task list selection,
 * sync (auto + manual), bi-directional task push, calendar sync.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { app } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { toast } from 'sonner';

const functions = getFunctions(app, 'us-central1');

// ─── Callable wrappers ────────────────────────────────────────────────────────

const callGetAuthUrl        = httpsCallable<{ origin: string }, { url: string }>(functions, 'microsoftGetAuthUrl');
const callGetStatus         = httpsCallable<void, MicrosoftStatus>(functions, 'microsoftGetStatus');
const callListTaskLists     = httpsCallable<void, { lists: MsTaskList[] }>(functions, 'microsoftListTaskLists');
const callSyncTasks         = httpsCallable<{ listId: string; msListId: string }, { synced: number }>(functions, 'microsoftSyncTasks');
const callPushTaskAction    = httpsCallable<MsTaskPushPayload, { ok?: boolean; msTaskId?: string }>(functions, 'microsoftPushTaskAction');
const callListCalendars     = httpsCallable<void, { calendars: MsCalendar[] }>(functions, 'microsoftListCalendars');
const callSyncCalendarEvents = httpsCallable<{ msCalendarId: string; windowDays?: number }, { synced: number }>(functions, 'microsoftSyncCalendarEvents');
const callDisconnect        = httpsCallable<void, { ok: boolean }>(functions, 'microsoftDisconnect');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MicrosoftStatus {
  connected: boolean;
  email?: string;
  displayName?: string;
  connectedAt?: string;
  lastTaskSyncAt?: string | null;
  lastCalendarSyncAt?: string | null;
  tokenStatus?: 'active' | 'needs_reauth';
}

export interface MsTaskList {
  id: string;
  displayName: string;
  isOwner?: boolean;
  isShared?: boolean;
  wellknownListName?: string;
  taskCount?: number | null;
}

export interface MsCalendar {
  id: string;
  name: string;
  color?: string;
  isDefaultCalendar?: boolean;
  canEdit?: boolean;
}

type MsTaskPushPayload =
  | { type: 'create'; listId: string; msListId: string; text: string; description?: string; deadline?: string }
  | { type: 'update'; msTaskId: string; msListId: string; text?: string; description?: string; deadline?: string | null }
  | { type: 'complete'; msTaskId: string; msListId: string }
  | { type: 'uncomplete'; msTaskId: string; msListId: string }
  | { type: 'delete'; msTaskId: string; msListId: string };

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMicrosoftIntegration(listId?: string, msListId?: string) {
  const { user } = useAuth();
  const [status, setStatus] = useState<MicrosoftStatus>({ connected: false });
  const [isSyncing, setIsSyncing] = useState(false);
  const [taskLists, setTaskLists] = useState<MsTaskList[]>([]);
  const [taskListsLoading, setTaskListsLoading] = useState(false);
  const [calendars, setCalendars] = useState<MsCalendar[]>([]);
  const [calendarsLoading, setCalendarsLoading] = useState(false);
  const autoSyncTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Real-time connection status listener ──────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const integrationRef = doc(db, 'users', user.uid, 'integrations', 'microsoft');
    const unsub = onSnapshot(integrationRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setStatus({
          connected: true,
          email: data.email,
          displayName: data.displayName,
          connectedAt: data.connectedAt,
          lastTaskSyncAt: data.lastTaskSyncAt,
          lastCalendarSyncAt: data.lastCalendarSyncAt,
          tokenStatus: data.tokenStatus,
        });
      } else {
        setStatus({ connected: false });
      }
    });
    return () => unsub();
  }, [user?.uid]);

  // ── Task sync ─────────────────────────────────────────────────────────────
  const syncTasks = useCallback(async (
    silent = false,
    explicitMsListId?: string,
    explicitListId?: string
  ) => {
    const mid = explicitMsListId ?? msListId;
    const lid = explicitListId ?? listId;
    if (!lid || !mid || !status.connected) return;
    setIsSyncing(true);
    try {
      const res = await callSyncTasks({ listId: lid, msListId: mid });
      if (!silent) toast.success(`Synced ${res.data.synced} tasks from Microsoft To Do`);
    } catch (err: any) {
      if (!silent) toast.error('Microsoft sync failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSyncing(false);
    }
  }, [listId, msListId, status.connected]);

  const syncTasksRef = useRef(syncTasks);
  useEffect(() => { syncTasksRef.current = syncTasks; }, [syncTasks]);

  // Auto-sync on mount + every 5 min when connected and linked
  useEffect(() => {
    if (!status.connected || !listId || !msListId) return;
    syncTasksRef.current(true);
    autoSyncTimer.current = setInterval(() => syncTasksRef.current(true), AUTO_SYNC_INTERVAL_MS);
    return () => {
      if (autoSyncTimer.current) clearInterval(autoSyncTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.connected, listId, msListId]);

  // ── Calendar sync ─────────────────────────────────────────────────────────
  const syncCalendar = useCallback(async (msCalendarId: string, silent = false) => {
    if (!status.connected) return;
    try {
      const res = await callSyncCalendarEvents({ msCalendarId });
      if (!silent) toast.success(`Synced ${res.data.synced} events from Outlook`);
    } catch (err: any) {
      if (!silent) toast.error('Outlook calendar sync failed: ' + (err?.message || 'Unknown error'));
    }
  }, [status.connected]);

  // ── Connect (open OAuth popup) ────────────────────────────────────────────
  const connect = useCallback(async () => {
    try {
      const origin = window.location.origin;
      const res = await callGetAuthUrl({ origin });
      const popup = window.open(res.data.url, 'microsoft_oauth', 'width=560,height=700,left=200,top=100');
      if (!popup) window.location.href = res.data.url;
    } catch (err: any) {
      toast.error('Failed to start Microsoft connection: ' + (err?.message || 'Unknown error'));
    }
  }, []);

  // ── Disconnect ────────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    try {
      await callDisconnect();
      toast.success('Microsoft disconnected');
    } catch (err: any) {
      toast.error('Failed to disconnect: ' + (err?.message || 'Unknown error'));
    }
  }, []);

  // ── Load task lists (for picker) ──────────────────────────────────────────
  const loadTaskLists = useCallback(async () => {
    setTaskListsLoading(true);
    try {
      const res = await callListTaskLists();
      setTaskLists(res.data.lists);
    } catch (err: any) {
      console.warn('Microsoft loadTaskLists failed:', err?.message);
      setTaskLists([]);
    } finally {
      setTaskListsLoading(false);
    }
  }, []);

  // ── Load calendars (for picker) ───────────────────────────────────────────
  const loadCalendars = useCallback(async () => {
    setCalendarsLoading(true);
    try {
      const res = await callListCalendars();
      setCalendars(res.data.calendars);
    } catch (err: any) {
      console.warn('Microsoft loadCalendars failed:', err?.message);
      setCalendars([]);
    } finally {
      setCalendarsLoading(false);
    }
  }, []);

  // ── Push actions (bi-directional tasks) ──────────────────────────────────

  const pushComplete = useCallback(async (msTaskId: string) => {
    if (!status.connected || !msTaskId || !msListId) return;
    try {
      await callPushTaskAction({ type: 'complete', msTaskId, msListId });
    } catch (err) {
      console.warn('MS complete push failed', err);
    }
  }, [status.connected, msListId]);

  const pushUncomplete = useCallback(async (msTaskId: string) => {
    if (!status.connected || !msTaskId || !msListId) return;
    try {
      await callPushTaskAction({ type: 'uncomplete', msTaskId, msListId });
    } catch (err) {
      console.warn('MS uncomplete push failed', err);
    }
  }, [status.connected, msListId]);

  const pushCreate = useCallback(async (params: {
    text: string;
    description?: string;
    deadline?: string;
  }): Promise<string | null> => {
    if (!status.connected || !listId || !msListId) return null;
    try {
      const res = await callPushTaskAction({ type: 'create', listId, msListId, ...params });
      return res.data.msTaskId || null;
    } catch (err) {
      console.warn('MS create push failed', err);
      return null;
    }
  }, [status.connected, listId, msListId]);

  const pushUpdate = useCallback(async (msTaskId: string, updates: {
    text?: string;
    description?: string;
    deadline?: string | null;
  }) => {
    if (!status.connected || !msTaskId || !msListId) return;
    try {
      await callPushTaskAction({ type: 'update', msTaskId, msListId, ...updates });
    } catch (err) {
      console.warn('MS update push failed', err);
    }
  }, [status.connected, msListId]);

  const pushDelete = useCallback(async (msTaskId: string) => {
    if (!status.connected || !msTaskId || !msListId) return;
    try {
      await callPushTaskAction({ type: 'delete', msTaskId, msListId });
    } catch (err) {
      console.warn('MS delete push failed', err);
    }
  }, [status.connected, msListId]);

  const isLinked = status.connected && !!msListId;
  const needsReauth = status.tokenStatus === 'needs_reauth';

  return {
    // Status
    status,
    isLinked,
    isSyncing,
    needsReauth,
    // Auth
    connect,
    disconnect,
    // Task lists
    taskLists,
    taskListsLoading,
    loadTaskLists,
    // Calendars
    calendars,
    calendarsLoading,
    loadCalendars,
    // Sync
    syncTasks: () => syncTasks(false),
    syncTasksWithIds: (mid: string, lid: string) => syncTasks(false, mid, lid),
    syncCalendar,
    // Push actions
    pushComplete,
    pushUncomplete,
    pushCreate,
    pushUpdate,
    pushDelete,
  };
}
