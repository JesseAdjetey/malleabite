/**
 * Canvas LMS integration hook
 *
 * - Connects / disconnects via Cloud Functions
 * - Real-time listeners on canvas_courses + canvas_assignments subcollections
 * - Sync on demand
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  getDoc,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { toast } from 'sonner';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CanvasCourse {
  id: string;
  name: string;
  courseCode: string;
  color: string;
  term: string | null;
  syncedAt: string;
}

export interface CanvasAssignment {
  id: string;
  courseId: string;
  courseName: string;
  courseColor: string;
  title: string;
  description: string | null;
  htmlUrl: string | null;
  dueAt: string | null;       // ISO string or null (no due date)
  pointsPossible: number | null;
  submissionTypes: string[];
  submitted: boolean;
  score: number | null;
  workflowState: string;
  syncedAt: string;
}

export interface CanvasStatus {
  connected: boolean;
  baseUrl?: string;
  displayName?: string;
  connectedAt?: string;
  lastSyncAt?: string | null;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useCanvasIntegration() {
  const { user } = useAuth();
  const functions = getFunctions();

  const [status, setStatus] = useState<CanvasStatus>({ connected: false });
  const [statusLoading, setStatusLoading] = useState(true);

  const [courses, setCourses] = useState<CanvasCourse[]>([]);
  const [assignments, setAssignments] = useState<CanvasAssignment[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);

  // ── Load connection status from Firestore ───────────────────────────────────
  useEffect(() => {
    if (!user?.uid) {
      setStatus({ connected: false });
      setStatusLoading(false);
      return;
    }

    const integrationRef = doc(db, 'users', user.uid, 'integrations', 'canvas');

    const unsub = onSnapshot(integrationRef, (snap) => {
      if (!snap.exists()) {
        setStatus({ connected: false });
      } else {
        const d = snap.data();
        setStatus({
          connected: true,
          baseUrl: d.baseUrl,
          displayName: d.displayName,
          connectedAt: d.connectedAt,
          lastSyncAt: d.lastSyncAt ?? null,
        });
      }
      setStatusLoading(false);
    });

    return () => unsub();
  }, [user?.uid]);

  // ── Real-time listeners for courses + assignments ───────────────────────────
  useEffect(() => {
    if (!user?.uid || !status.connected) {
      setCourses([]);
      setAssignments([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);

    const coursesUnsub = onSnapshot(
      query(collection(db, 'users', user.uid, 'canvas_courses'), orderBy('name')),
      (snap) => {
        setCourses(snap.docs.map(d => d.data() as CanvasCourse));
      }
    );

    const assignmentsUnsub = onSnapshot(
      query(collection(db, 'users', user.uid, 'canvas_assignments'), orderBy('dueAt')),
      (snap) => {
        setAssignments(snap.docs.map(d => d.data() as CanvasAssignment));
        setDataLoading(false);
      }
    );

    return () => {
      coursesUnsub();
      assignmentsUnsub();
    };
  }, [user?.uid, status.connected]);

  // ── Connect ─────────────────────────────────────────────────────────────────
  const connect = useCallback(async (baseUrl: string, token: string): Promise<boolean> => {
    if (!user?.uid) return false;
    setConnecting(true);
    try {
      const fn = httpsCallable(functions, 'canvasConnect');
      const result = await fn({ baseUrl, token }) as any;
      toast.success(
        `Canvas connected! Found ${result.data.courseCount} courses and ${result.data.assignmentCount} assignments.`
      );
      return true;
    } catch (err: any) {
      toast.error(err?.message || 'Failed to connect Canvas');
      return false;
    } finally {
      setConnecting(false);
    }
  }, [user?.uid, functions]);

  // ── Sync ────────────────────────────────────────────────────────────────────
  const sync = useCallback(async () => {
    if (!user?.uid || syncing) return;
    setSyncing(true);
    try {
      const fn = httpsCallable(functions, 'canvasSync');
      const result = await fn({}) as any;
      toast.success(`Synced ${result.data.assignmentCount} assignments across ${result.data.courseCount} courses`);
    } catch (err: any) {
      toast.error(err?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, [user?.uid, syncing, functions]);

  // ── Disconnect ──────────────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    if (!user?.uid) return;
    try {
      const fn = httpsCallable(functions, 'canvasDisconnect');
      await fn({});
      toast.success('Canvas disconnected');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to disconnect');
    }
  }, [user?.uid, functions]);

  // ── Derived: assignments grouped by course ──────────────────────────────────
  const assignmentsByCourse = courses.map(course => ({
    course,
    assignments: assignments
      .filter(a => a.courseId === course.id && !a.submitted && a.workflowState === 'published')
      .sort((a, b) => {
        // null dueAt goes to end
        if (!a.dueAt && !b.dueAt) return 0;
        if (!a.dueAt) return 1;
        if (!b.dueAt) return -1;
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      }),
  })).filter(g => g.assignments.length > 0);

  const upcomingCount = assignments.filter(a => !a.submitted && a.dueAt && new Date(a.dueAt) >= new Date()).length;

  return {
    status,
    statusLoading,
    courses,
    assignments,
    assignmentsByCourse,
    upcomingCount,
    dataLoading,
    syncing,
    connecting,
    connect,
    sync,
    disconnect,
  };
}
