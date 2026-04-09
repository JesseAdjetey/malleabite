/**
 * Todoist integration hook
 *
 * Handles: connection status, OAuth flow, project listing,
 * sync (auto + manual), and bi-directional push actions.
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

const callGetAuthUrl   = httpsCallable<{ origin: string }, { url: string }>(functions, 'todoistGetAuthUrl');
const callListProjects = httpsCallable<void, { projects: TodoistProject[] }>(functions, 'todoistListProjects');
const callSync         = httpsCallable<{ listId: string; projectId: string }, { synced: number }>(functions, 'todoistSync');
const callPushAction   = httpsCallable<TodoistPushPayload, { ok?: boolean; todoistId?: string }>(functions, 'todoistPushAction');
const callDisconnect   = httpsCallable<void, { ok: boolean }>(functions, 'todoistDisconnect');
const callGetStatus    = httpsCallable<void, TodoistStatus>(functions, 'todoistGetStatus');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TodoistProject {
  id: string;
  name: string;
  color?: string;
  is_inbox_project?: boolean;
  taskCount?: number;
}

export interface TodoistStatus {
  connected: boolean;
  email?: string;
  connectedAt?: string;
  lastSyncedAt?: string | null;
}

type TodoistPushPayload =
  | { type: 'create'; listId: string; projectId: string; text: string; description?: string; deadline?: string }
  | { type: 'update'; todoistId: string; text?: string; description?: string; deadline?: string | null }
  | { type: 'complete'; todoistId: string }
  | { type: 'uncomplete'; todoistId: string }
  | { type: 'delete'; todoistId: string };

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTodoistIntegration(listId?: string, todoistProjectId?: string) {
  const { user } = useAuth();
  const [status, setStatus] = useState<TodoistStatus>({ connected: false });
  const [isSyncing, setIsSyncing] = useState(false);
  const [projects, setProjects] = useState<TodoistProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const autoSyncTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Real-time connection status listener ─────────────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const integrationRef = doc(db, 'users', user.uid, 'integrations', 'todoist');
    const unsub = onSnapshot(integrationRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setStatus({
          connected: true,
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

  // ── Sync — accepts explicit IDs to avoid stale closure on first link ───────
  const sync = useCallback(async (silent = false, explicitProjectId?: string, explicitListId?: string) => {
    const pid = explicitProjectId ?? todoistProjectId;
    const lid = explicitListId ?? listId;
    if (!lid || !pid || !status.connected) return;
    setIsSyncing(true);
    try {
      const res = await callSync({ listId: lid, projectId: pid });
      if (!silent) {
        toast.success(`Synced ${res.data.synced} tasks from Todoist`);
      }
    } catch (err: any) {
      if (!silent) toast.error('Todoist sync failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSyncing(false);
    }
  }, [listId, todoistProjectId, status.connected]);

  // Keep a ref to sync so the interval closure always calls the latest version
  // without adding `sync` to the effect deps (which would re-trigger on every render
  // that recreates the callback, causing multiple concurrent syncs).
  const syncRef = useRef(sync);
  useEffect(() => { syncRef.current = sync; }, [sync]);

  // Auto-sync on mount + every 5 min when connected and linked
  useEffect(() => {
    if (!status.connected || !listId || !todoistProjectId) return;

    // Initial sync
    syncRef.current(true);

    // Periodic sync
    autoSyncTimer.current = setInterval(() => syncRef.current(true), AUTO_SYNC_INTERVAL_MS);
    return () => {
      if (autoSyncTimer.current) clearInterval(autoSyncTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.connected, listId, todoistProjectId]);

  // ── Connect (open OAuth popup) ───────────────────────────────────────────────
  const connect = useCallback(async () => {
    try {
      const origin = window.location.origin;
      const res = await callGetAuthUrl({ origin });
      const popup = window.open(res.data.url, 'todoist_oauth', 'width=560,height=680,left=200,top=100');
      if (!popup) {
        // Fallback: redirect current window
        window.location.href = res.data.url;
      }
    } catch (err: any) {
      toast.error('Failed to start Todoist connection: ' + (err?.message || 'Unknown error'));
    }
  }, []);

  // ── Disconnect ───────────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    try {
      await callDisconnect();
      toast.success('Todoist disconnected');
    } catch (err: any) {
      toast.error('Failed to disconnect: ' + (err?.message || 'Unknown error'));
    }
  }, []);

  // ── Load projects (for picker) ───────────────────────────────────────────────
  // No status.connected guard — caller decides when to invoke.
  // The Firebase callable will return unauthenticated error if not connected.
  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const res = await callListProjects();
      setProjects(res.data.projects);
    } catch (err: any) {
      // Don't toast here — let the sheet handle empty state + retry button
      console.warn('Todoist loadProjects failed:', err?.message);
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  // ── Push actions (bi-directional) ────────────────────────────────────────────

  const pushComplete = useCallback(async (todoistId: string) => {
    if (!status.connected || !todoistId) return;
    try {
      await callPushAction({ type: 'complete', todoistId });
    } catch (err) {
      console.warn('Todoist complete push failed', err);
    }
  }, [status.connected]);

  const pushUncomplete = useCallback(async (todoistId: string) => {
    if (!status.connected || !todoistId) return;
    try {
      await callPushAction({ type: 'uncomplete', todoistId });
    } catch (err) {
      console.warn('Todoist uncomplete push failed', err);
    }
  }, [status.connected]);

  const pushCreate = useCallback(async (params: {
    text: string;
    description?: string;
    deadline?: string;
  }): Promise<string | null> => {
    if (!status.connected) { console.warn('[Todoist] pushCreate: not connected'); return null; }
    if (!listId) { console.warn('[Todoist] pushCreate: no listId'); return null; }
    if (!todoistProjectId) { console.warn('[Todoist] pushCreate: no projectId'); return null; }
    try {
      const res = await callPushAction({
        type: 'create',
        listId,
        projectId: todoistProjectId,
        ...params,
      });
      return res.data.todoistId || null;
    } catch (err) {
      console.warn('Todoist create push failed', err);
      return null;
    }
  }, [status.connected, listId, todoistProjectId]);

  const pushUpdate = useCallback(async (todoistId: string, updates: {
    text?: string;
    description?: string;
    deadline?: string | null;
  }) => {
    if (!status.connected || !todoistId) return;
    try {
      await callPushAction({ type: 'update', todoistId, ...updates });
    } catch (err) {
      console.warn('Todoist update push failed', err);
    }
  }, [status.connected]);

  const pushDelete = useCallback(async (todoistId: string) => {
    if (!status.connected || !todoistId) return;
    try {
      await callPushAction({ type: 'delete', todoistId });
    } catch (err) {
      console.warn('Todoist delete push failed', err);
    }
  }, [status.connected]);

  const isLinked = status.connected && !!todoistProjectId;

  return {
    // Status
    status,
    isLinked,
    isSyncing,
    // Auth
    connect,
    disconnect,
    // Projects
    projects,
    projectsLoading,
    loadProjects,
    // Sync
    sync: () => sync(false),
    syncProject: (projectId: string, lid: string) => sync(false, projectId, lid),
    // Push actions
    pushComplete,
    pushUncomplete,
    pushCreate,
    pushUpdate,
    pushDelete,
  };
}
