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
  updateDoc,
  writeBatch,
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
  termEndAt?: string | null;
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

export interface CanvasCalendarEvent {
  id: string;
  courseId: string;
  courseName: string;
  courseColor: string;
  title: string;
  description: string | null;
  locationName: string | null;
  locationAddress: string | null;
  startAt: string | null;       // ISO
  endAt: string | null;         // ISO
  allDay: boolean;
  htmlUrl: string | null;
  syncedAt: string;
}

export interface CanvasAnnouncement {
  id: string;
  courseId: string;
  courseName: string;
  courseColor: string;
  title: string;
  message: string;            // already HTML-stripped server-side
  htmlUrl: string | null;
  author: string | null;
  postedAt: string | null;    // ISO string
  read: boolean;
  syncedAt: string;
}

export interface CanvasStatus {
  connected: boolean;
  baseUrl?: string;
  displayName?: string;
  connectedAt?: string;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
  lastSyncFailedCourseCount?: number;
}

export type AssignmentFilter = 'active' | 'all';

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useCanvasIntegration() {
  const { user } = useAuth();
  const functions = getFunctions();

  const [status, setStatus] = useState<CanvasStatus>({ connected: false });
  const [statusLoading, setStatusLoading] = useState(true);

  const [courses, setCourses] = useState<CanvasCourse[]>([]);
  const [assignments, setAssignments] = useState<CanvasAssignment[]>([]);
  const [announcements, setAnnouncements] = useState<CanvasAnnouncement[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CanvasCalendarEvent[]>([]);
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

    const unsub = onSnapshot(
      integrationRef,
      (snap) => {
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
            lastSyncError: d.lastSyncError ?? null,
            lastSyncFailedCourseCount: d.lastSyncFailedCourseCount ?? 0,
          });
        }
        setStatusLoading(false);
      },
      (err) => {
        console.error('[Canvas] integration status listener failed:', err);
        setStatus({ connected: false });
        setStatusLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  // ── Real-time listeners for courses + assignments ───────────────────────────
  useEffect(() => {
    if (!user?.uid || !status.connected) {
      setCourses([]);
      setAssignments([]);
      setAnnouncements([]);
      setCalendarEvents([]);
      setDataLoading(false);
      return;
    }

    setDataLoading(true);

    const coursesUnsub = onSnapshot(
      query(collection(db, 'users', user.uid, 'canvas_courses'), orderBy('name')),
      (snap) => {
        setCourses(snap.docs.map(d => d.data() as CanvasCourse));
      },
      (err) => {
        console.error('[Canvas] courses listener failed:', err);
        setCourses([]);
        setDataLoading(false);
      }
    );

    const assignmentsUnsub = onSnapshot(
      query(collection(db, 'users', user.uid, 'canvas_assignments'), orderBy('dueAt')),
      (snap) => {
        setAssignments(snap.docs.map(d => d.data() as CanvasAssignment));
        setDataLoading(false);
      },
      (err) => {
        console.error('[Canvas] assignments listener failed:', err);
        setAssignments([]);
        setDataLoading(false);
      }
    );

    const announcementsUnsub = onSnapshot(
      query(collection(db, 'users', user.uid, 'canvas_announcements'), orderBy('postedAt', 'desc')),
      (snap) => {
        setAnnouncements(snap.docs.map(d => d.data() as CanvasAnnouncement));
      },
      (err) => {
        console.error('[Canvas] announcements listener failed:', err);
        setAnnouncements([]);
      }
    );

    const calendarEventsUnsub = onSnapshot(
      query(collection(db, 'users', user.uid, 'canvas_calendar_events'), orderBy('startAt')),
      (snap) => {
        setCalendarEvents(snap.docs.map(d => d.data() as CanvasCalendarEvent));
      },
      (err) => {
        console.error('[Canvas] calendar events listener failed:', err);
        setCalendarEvents([]);
      }
    );

    return () => {
      coursesUnsub();
      assignmentsUnsub();
      announcementsUnsub();
      calendarEventsUnsub();
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

  // ── Announcements: mark read ────────────────────────────────────────────────
  const markAnnouncementRead = useCallback(async (announcementId: string) => {
    if (!user?.uid) return;
    try {
      await updateDoc(
        doc(db, 'users', user.uid, 'canvas_announcements', announcementId),
        { read: true }
      );
    } catch (err) {
      console.error('[Canvas] failed to mark announcement read:', err);
    }
  }, [user?.uid]);

  const markAllAnnouncementsRead = useCallback(async () => {
    if (!user?.uid) return;
    const unread = announcements.filter(a => !a.read);
    if (unread.length === 0) return;
    try {
      const batch = writeBatch(db);
      for (const a of unread) {
        batch.update(doc(db, 'users', user.uid!, 'canvas_announcements', a.id), { read: true });
      }
      await batch.commit();
    } catch (err) {
      console.error('[Canvas] failed to mark all announcements read:', err);
    }
  }, [user?.uid, announcements]);

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

  // ── Derived ─────────────────────────────────────────────────────────────────
  // Sort by dueAt with overdue first (since they're past now), then today/upcoming.
  // null dueAt goes to the very end so the actionable items lead.
  const sortByDue = (a: CanvasAssignment, b: CanvasAssignment) => {
    if (!a.dueAt && !b.dueAt) return 0;
    if (!a.dueAt) return 1;
    if (!b.dueAt) return -1;
    return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
  };

  // "Active" = unsubmitted, published, and either upcoming/today or overdue.
  // Excludes no-due-date assignments by default (they're usually legacy).
  const isActive = (a: CanvasAssignment) =>
    !a.submitted && a.workflowState === 'published' && !!a.dueAt;

  // "All unsubmitted" — used when the user toggles "Show no-due-date".
  const isAnyUnsubmitted = (a: CanvasAssignment) =>
    !a.submitted && a.workflowState === 'published';

  const groupByCourse = (predicate: (a: CanvasAssignment) => boolean) =>
    courses
      .map(course => ({
        course,
        assignments: assignments.filter(a => a.courseId === course.id && predicate(a)).sort(sortByDue),
      }))
      .filter(g => g.assignments.length > 0);

  const activeAssignmentsByCourse = groupByCourse(isActive);
  const allAssignmentsByCourse = groupByCourse(isAnyUnsubmitted);

  // Headline count must match what's rendered: active list above.
  const activeCount = activeAssignmentsByCourse.reduce((n, g) => n + g.assignments.length, 0);

  // How many extra "no due date" assignments would show if the user toggled.
  const noDueDateCount = allAssignmentsByCourse.reduce((n, g) => n + g.assignments.length, 0) - activeCount;

  // Grades: anything with a numeric score. Most recent first.
  const gradedAssignments = assignments
    .filter(a => a.score !== null && a.pointsPossible !== null)
    .sort((a, b) => {
      const at = a.dueAt ? new Date(a.dueAt).getTime() : 0;
      const bt = b.dueAt ? new Date(b.dueAt).getTime() : 0;
      return bt - at;
    });

  // Announcements derived data — sorted newest first by the listener already.
  const unreadAnnouncementCount = announcements.filter(a => !a.read).length;

  // Calendar events — listener already sorts ascending by startAt.
  // Split into upcoming (now → future) and past (today's earlier events count as upcoming).
  const nowMs = Date.now();
  const upcomingCalendarEvents = calendarEvents.filter(e => {
    if (!e.startAt) return false;
    const end = e.endAt ? new Date(e.endAt).getTime() : new Date(e.startAt).getTime();
    return end >= nowMs;
  });
  const pastCalendarEvents = calendarEvents
    .filter(e => {
      if (!e.startAt) return false;
      const end = e.endAt ? new Date(e.endAt).getTime() : new Date(e.startAt).getTime();
      return end < nowMs;
    })
    .reverse(); // most recent past first

  return {
    status,
    statusLoading,
    courses,
    assignments,
    announcements,
    calendarEvents,
    upcomingCalendarEvents,
    pastCalendarEvents,
    activeAssignmentsByCourse,
    allAssignmentsByCourse,
    gradedAssignments,
    activeCount,
    noDueDateCount,
    unreadAnnouncementCount,
    dataLoading,
    syncing,
    connecting,
    connect,
    sync,
    disconnect,
    markAnnouncementRead,
    markAllAnnouncementsRead,
  };
}
