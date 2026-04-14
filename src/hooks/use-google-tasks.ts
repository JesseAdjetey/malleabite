/**
 * Google Tasks integration hook
 *
 * Mirrors useTodoistIntegration exactly.
 * - Connection state read from users/{uid}/integrations/googleTasks (Firestore real-time)
 * - Sync: Google Tasks → todo_items (server-side Cloud Function, same as Todoist)
 * - Push actions: bi-directional (create/complete/uncomplete/delete/update)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { app } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { toast } from 'sonner';

const functions = getFunctions(app, 'us-central1');

const callGetStatus     = httpsCallable<void, GoogleTasksStatus>(functions, 'googleTasksGetStatus');
const callListTaskLists = httpsCallable<{ googleAccountId: string }, { taskLists: GoogleTaskList[] }>(functions, 'googleTasksListTaskLists');
const callConnect       = httpsCallable<{ googleAccountId: string; taskListId: string; taskListTitle: string }, { connected: boolean; email: string; taskListTitle: string }>(functions, 'googleTasksConnect');
const callSync          = httpsCallable<{ listId: string }, { synced: number; deletedFromLocal: number }>(functions, 'googleTasksSync');
const callPushAction    = httpsCallable<GoogleTasksPushPayload, { ok?: boolean; googleTaskId?: string }>(functions, 'googleTasksPushAction');
const callDisconnect    = httpsCallable<void, { ok: boolean }>(functions, 'googleTasksDisconnect');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GoogleTaskList {
  id: string;
  title: string;
  updated: string;
}

export interface GoogleTasksStatus {
  connected: boolean;
  googleAccountId?: string;
  taskListId?: string;
  taskListTitle?: string;
  email?: string;
  connectedAt?: string;
  lastSyncedAt?: string | null;
}

type GoogleTasksPushPayload =
  | { type: 'create'; listId: string; text: string; description?: string; deadline?: string }
  | { type: 'update'; googleTaskId: string; text?: string; description?: string; deadline?: string | null }
  | { type: 'complete'; googleTaskId: string }
  | { type: 'uncomplete'; googleTaskId: string }
  | { type: 'delete'; googleTaskId: string };

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGoogleTasksIntegration(listId?: string, linkedTaskListId?: string) {
  const { user } = useAuth();
  const [status, setStatus] = useState<GoogleTasksStatus>({ connected: false });
  const [isSyncing, setIsSyncing] = useState(false);
  const [taskLists, setTaskLists] = useState<GoogleTaskList[]>([]);
  const [taskListsLoading, setTaskListsLoading] = useState(false);
  const autoSyncTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Real-time connection status ───────────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const integrationRef = doc(db, 'users', user.uid, 'integrations', 'googleTasks');
    const unsub = onSnapshot(integrationRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setStatus({
          connected: true,
          googleAccountId: data.googleAccountId,
          taskListId: data.taskListId,
          taskListTitle: data.taskListTitle,
          email: data.email,
          connectedAt: data.connectedAt,
          lastSyncedAt: data.lastSyncedAt,
        });
      } else {
        setStatus({ connected: false });
      }
    });
    return () => unsub();
  }, [user?.uid]);

  // ── isLinked: connected AND this todo list is the one being synced ────────
  const isLinked = status.connected && !!listId && !!linkedTaskListId;

  // ── Sync ──────────────────────────────────────────────────────────────────
  const sync = useCallback(async (silent = false) => {
    if (!listId || !status.connected) return;
    setIsSyncing(true);
    try {
      const res = await callSync({ listId });
      if (!silent) {
        toast.success(`Synced ${res.data.synced} tasks from Google Tasks`);
      }
    } catch (err: any) {
      if (!silent) toast.error('Google Tasks sync failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSyncing(false);
    }
  }, [listId, status.connected]);

  const syncRef = useRef(sync);
  useEffect(() => { syncRef.current = sync; }, [sync]);

  // Auto-sync on mount + every 5 min when connected and linked
  useEffect(() => {
    if (!status.connected || !listId || !linkedTaskListId) return;

    syncRef.current(true);

    autoSyncTimer.current = setInterval(() => syncRef.current(true), AUTO_SYNC_INTERVAL_MS);
    return () => {
      if (autoSyncTimer.current) clearInterval(autoSyncTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.connected, listId, linkedTaskListId]);

  // ── Load task lists (for picker) ──────────────────────────────────────────
  const loadTaskLists = useCallback(async (googleAccountId: string) => {
    setTaskListsLoading(true);
    try {
      const res = await callListTaskLists({ googleAccountId });
      setTaskLists(res.data.taskLists);
    } catch (err: any) {
      console.warn('Google Tasks loadTaskLists failed:', err?.message);
      setTaskLists([]);
    } finally {
      setTaskListsLoading(false);
    }
  }, []);

  // ── Connect ───────────────────────────────────────────────────────────────
  const connect = useCallback(async (googleAccountId: string, taskListId: string, taskListTitle: string) => {
    try {
      await callConnect({ googleAccountId, taskListId, taskListTitle });
      toast.success(`Connected to Google Tasks — "${taskListTitle}"`);
    } catch (err: any) {
      toast.error('Failed to connect Google Tasks: ' + (err?.message || 'Unknown error'));
    }
  }, []);

  // ── Disconnect ────────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    try {
      await callDisconnect();
      toast.success('Google Tasks disconnected');
    } catch (err: any) {
      toast.error('Failed to disconnect: ' + (err?.message || 'Unknown error'));
    }
  }, []);

  // ── Push actions ──────────────────────────────────────────────────────────

  const pushCreate = useCallback(async (params: {
    text: string;
    description?: string;
    deadline?: string;
  }): Promise<string | null> => {
    if (!status.connected || !listId) return null;
    try {
      const res = await callPushAction({ type: 'create', listId, ...params });
      return res.data.googleTaskId || null;
    } catch (err) {
      console.warn('[GoogleTasks] pushCreate failed', err);
      return null;
    }
  }, [status.connected, listId]);

  const pushComplete = useCallback(async (googleTaskId: string) => {
    if (!status.connected || !googleTaskId) return;
    try {
      await callPushAction({ type: 'complete', googleTaskId });
    } catch (err) {
      console.warn('[GoogleTasks] pushComplete failed', err);
    }
  }, [status.connected]);

  const pushUncomplete = useCallback(async (googleTaskId: string) => {
    if (!status.connected || !googleTaskId) return;
    try {
      await callPushAction({ type: 'uncomplete', googleTaskId });
    } catch (err) {
      console.warn('[GoogleTasks] pushUncomplete failed', err);
    }
  }, [status.connected]);

  const pushDelete = useCallback(async (googleTaskId: string) => {
    if (!status.connected || !googleTaskId) return;
    try {
      await callPushAction({ type: 'delete', googleTaskId });
    } catch (err) {
      console.warn('[GoogleTasks] pushDelete failed', err);
    }
  }, [status.connected]);

  const pushUpdate = useCallback(async (googleTaskId: string, updates: { text?: string; description?: string; deadline?: string | null }) => {
    if (!status.connected || !googleTaskId) return;
    try {
      await callPushAction({ type: 'update', googleTaskId, ...updates });
    } catch (err) {
      console.warn('[GoogleTasks] pushUpdate failed', err);
    }
  }, [status.connected]);

  return {
    status,
    isLinked,
    isSyncing,
    taskLists,
    taskListsLoading,
    loadTaskLists,
    connect,
    disconnect,
    sync,
    pushCreate,
    pushComplete,
    pushUncomplete,
    pushDelete,
    pushUpdate,
  };
}
