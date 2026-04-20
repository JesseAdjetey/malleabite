/**
 * Apple Reminders integration hook
 *
 * Mirrors the Todoist/Google Tasks pattern for the Reminders module.
 * - Only active on iOS (gracefully no-ops on web/Android)
 * - Pull sync: Apple Reminders → Firestore reminders collection
 * - Push: create/complete/delete on Apple Reminders when user acts in Malleabite
 * - Connection state persisted in localStorage (no server needed — all on-device)
 */

import { useState, useCallback, useEffect } from 'react';
import {
  collection, query, where, getDocs,
  addDoc, updateDoc, deleteDoc, doc,
  serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { toast } from 'sonner';
import {
  isAppleDataAvailable,
  requestRemindersPermission,
  getAppleReminders,
  getAppleReminderLists,
  createAppleReminder,
  updateAppleReminder,
  deleteAppleReminder,
  completeAppleReminder,
  AppleReminder,
  AppleReminderList,
} from '@/lib/native-apple';

const STORAGE_KEY = 'malleabite_apple_reminders_connected';

function listStorageKey(instanceId?: string) {
  return instanceId
    ? `malleabite_apple_reminders_list_${instanceId}`
    : 'malleabite_apple_reminders_list';
}

export interface AppleRemindersStatus {
  connected: boolean;
  available: boolean; // false on Android/web
  lastSyncedAt: string | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAppleReminders(instanceId?: string) {
  const { user } = useAuth();
  const available = isAppleDataAvailable();

  const [connected, setConnected] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [lists, setLists] = useState<AppleReminderList[]>([]);
  const [selectedListId, setSelectedListIdState] = useState<string | null>(() => {
    try { return localStorage.getItem(listStorageKey(instanceId)) ?? null; } catch { return null; }
  });

  const status: AppleRemindersStatus = { connected, available, lastSyncedAt };
  const isLinked = connected && available;

  const setSelectedListId = useCallback((id: string | null) => {
    setSelectedListIdState(id);
    try {
      if (id) localStorage.setItem(listStorageKey(instanceId), id);
      else localStorage.removeItem(listStorageKey(instanceId));
    } catch {}
  }, [instanceId]);

  const fetchLists = useCallback(async () => {
    if (!available) return;
    try {
      const fetched = await getAppleReminderLists();
      setLists(fetched);
    } catch (err) {
      console.warn('[AppleReminders] fetchLists failed', err);
    }
  }, [available]);

  // ── Connect: request permission + store state ─────────────────────────────

  const connect = useCallback(async (): Promise<boolean> => {
    if (!available) {
      toast.error('Apple Reminders is only available on iOS or macOS.');
      return false;
    }
    const granted = await requestRemindersPermission();
    if (!granted) {
      toast.error('Reminders permission denied. Enable it in Settings → Malleabite.');
      return false;
    }
    localStorage.setItem(STORAGE_KEY, 'true');
    setConnected(true);
    // Fetch lists immediately so the picker is populated
    try {
      const fetched = await getAppleReminderLists();
      setLists(fetched);
    } catch {}
    return true;
  }, [available]);

  // ── Disconnect ────────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setConnected(false);
    toast.success('Disconnected from Apple Reminders');
  }, []);

  // ── Pull sync: Apple Reminders → Firestore ────────────────────────────────

  const pullSync = useCallback(async (silent = false): Promise<{ added: number; updated: number }> => {
    if (!user || !isLinked) return { added: 0, updated: 0 };
    setIsSyncing(true);
    try {
      const appleReminders = await getAppleReminders(selectedListId ?? undefined);
      if (!appleReminders.length) {
        if (!silent) toast.success('No pending Apple Reminders to sync');
        return { added: 0, updated: 0 };
      }

      // Fetch existing Firestore reminders that came from Apple
      const q = query(
        collection(db, 'reminders'),
        where('userId', '==', user.uid),
        where('externalSource', '==', 'apple_reminders'),
      );
      const existingSnap = await getDocs(q);
      const existingByAppleId = new Map(
        existingSnap.docs
          .filter(d => d.data().externalId)
          .map(d => [d.data().externalId as string, d])
      );

      let added = 0;
      let updated = 0;
      const seenIds = new Set<string>();

      for (const ar of appleReminders) {
        seenIds.add(ar.id);
        const dueDate = ar.dueDate ? Timestamp.fromDate(new Date(ar.dueDate)) : null;

        const payload: Record<string, any> = {
          userId: user.uid,
          title: ar.title,
          description: ar.notes || null,
          reminderTime: dueDate ?? Timestamp.fromDate(new Date(Date.now() + 60 * 60 * 1000)),
          eventId: null,
          timeBeforeMinutes: null,
          timeAfterMinutes: null,
          soundId: 'default',
          isActive: true,
          status: 'pending',
          recurrence: 'none',
          customDays: [],
          externalId: ar.id,
          externalSource: 'apple_reminders',
          lastSyncedAt: serverTimestamp(),
          syncStatus: 'synced',
        };
        if (instanceId) payload.moduleInstanceId = instanceId;

        const existing = existingByAppleId.get(ar.id);
        if (existing) {
          await updateDoc(existing.ref, {
            title: payload.title,
            description: payload.description,
            reminderTime: payload.reminderTime,
            lastSyncedAt: serverTimestamp(),
            syncStatus: 'synced',
          });
          updated++;
        } else {
          payload.createdAt = serverTimestamp();
          await addDoc(collection(db, 'reminders'), payload);
          added++;
        }
      }

      // Remove Firestore reminders whose Apple counterpart is gone
      for (const [appleId, docSnap] of existingByAppleId.entries()) {
        if (!seenIds.has(appleId)) {
          await deleteDoc(docSnap.ref);
        }
      }

      const now = new Date().toISOString();
      setLastSyncedAt(now);
      if (!silent) toast.success(`Synced ${added + updated} reminders from Apple`);
      return { added, updated };
    } catch (err: any) {
      if (!silent) toast.error('Apple Reminders sync failed: ' + (err?.message || 'Unknown'));
      return { added: 0, updated: 0 };
    } finally {
      setIsSyncing(false);
    }
  }, [user, isLinked, instanceId, selectedListId]);

  // Auto-sync + fetch lists when connected
  useEffect(() => {
    if (!isLinked || !user) return;
    fetchLists();
    pullSync(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLinked, user?.uid]);

  // ── Push: create on Apple ─────────────────────────────────────────────────

  const pushCreate = useCallback(async (params: {
    title: string;
    description?: string;
    reminderTime?: Timestamp | string;
    flagged?: boolean;
  }): Promise<string | null> => {
    if (!isLinked) return null;
    try {
      let dueDate: string | undefined;
      if (params.reminderTime) {
        const d = params.reminderTime instanceof Timestamp
          ? params.reminderTime.toDate()
          : new Date(params.reminderTime as string);
        dueDate = d.toISOString();
      }
      const created = await createAppleReminder({
        title: params.title,
        notes: params.description,
        dueDate,
        listId: selectedListId ?? undefined,
        flagged: params.flagged,
      });
      return created?.id ?? null;
    } catch (err) {
      console.warn('[AppleReminders] pushCreate failed', err);
      return null;
    }
  }, [isLinked, selectedListId]);

  // ── Push: complete on Apple ───────────────────────────────────────────────

  const pushComplete = useCallback(async (appleId: string) => {
    if (!isLinked || !appleId) return;
    try { await completeAppleReminder(appleId); }
    catch (err) { console.warn('[AppleReminders] pushComplete failed', err); }
  }, [isLinked]);

  // ── Push: delete on Apple ─────────────────────────────────────────────────

  const pushDelete = useCallback(async (appleId: string) => {
    if (!isLinked || !appleId) return;
    try { await deleteAppleReminder(appleId); }
    catch (err) { console.warn('[AppleReminders] pushDelete failed', err); }
  }, [isLinked]);

  return {
    status,
    isLinked,
    isSyncing,
    lists,
    selectedListId,
    setSelectedListId,
    fetchLists,
    connect,
    disconnect,
    pullSync,
    pushCreate,
    pushComplete,
    pushDelete,
  };
}
