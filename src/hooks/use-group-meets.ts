import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  arrayUnion,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { GroupMeetSession, GroupMeetParticipant, GroupMeetSlot } from '@/lib/stores/types';
import { PERSONAL_CALENDAR_ID } from '@/lib/stores/calendar-filter-store';
import { toast } from 'sonner';
import dayjs from 'dayjs';

export interface CreateGroupMeetData {
  title: string;
  duration: number;
  window: { start: string; end: string };
  locationType: 'video' | 'in_person' | 'phone';
  participants: { name: string; email: string }[];
  autoConfirm: boolean;
  moduleInstanceId: string;
  /** IDs of ConnectedCalendars to check. Empty/undefined = check all synced calendars. */
  calendarIds?: string[];
}

// ─── Free slot computation (client-side for organizer) ────────────────────────

async function computeOrganizerFreeSlots(
  userId: string,
  window: { start: string; end: string },
  duration: number,
  calendarIds?: string[]
): Promise<GroupMeetSlot[]> {
  // Query 1: user's own Malleabite events (calendar_events flat collection)
  const ownEventsQuery = query(
    collection(db, 'calendar_events'),
    where('userId', '==', userId),
    where('startsAt', '>=', window.start),
    where('startsAt', '<=', window.end)
  );

  // Query 2: synced Google/external calendar events (users/{uid}/syncedEvents subcollection)
  // Filter by time range only — calendarId filter applied in-memory to avoid composite index requirement
  const syncedQuery = query(
    collection(db, `users/${userId}/syncedEvents`),
    where('startTime', '>=', window.start),
    where('startTime', '<=', window.end)
  );

  const [ownSnap, syncedSnap] = await Promise.all([getDocs(ownEventsQuery), getDocs(syncedQuery)]);

  // Filter synced events: if specific calendarIds given, only include those Google calendars
  // (exclude 'personal' from this filter since personal = native events handled separately)
  const googleCalendarIds = calendarIds
    ? calendarIds.filter(id => id !== PERSONAL_CALENDAR_ID)
    : undefined;

  const syncedDocs = (googleCalendarIds && googleCalendarIds.length > 0)
    ? syncedSnap.docs.filter(d => googleCalendarIds.includes(d.data().calendarId as string))
    : (calendarIds && calendarIds.length > 0 && googleCalendarIds?.length === 0)
      ? [] // only personal was selected — skip synced events
      : syncedSnap.docs;

  // Include native events only if 'personal' calendar is selected (or no filter given)
  const includeNativeEvents = !calendarIds || calendarIds.length === 0
    || calendarIds.includes(PERSONAL_CALENDAR_ID);

  const busySlots: { start: string; end: string }[] = [
    ...(includeNativeEvents ? ownSnap.docs.map(d => {
      const data = d.data();
      return {
        start: data.startsAt instanceof Timestamp ? data.startsAt.toDate().toISOString() : data.startsAt,
        end: data.endsAt instanceof Timestamp ? data.endsAt.toDate().toISOString() : data.endsAt,
      };
    }) : []),
    ...syncedDocs.map(d => {
      const data = d.data();
      return { start: data.startTime as string, end: data.endTime as string };
    }),
  ].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const freeSlots: GroupMeetSlot[] = [];
  const windowStart = dayjs(window.start);
  const windowEnd = dayjs(window.end);

  // Walk through each day in the window, 8am–8pm
  let day = windowStart.startOf('day');
  while (day.isBefore(windowEnd)) {
    let cursor = day.hour(8).minute(0).second(0);
    const dayEnd = day.hour(20).minute(0).second(0);

    while (cursor.add(duration, 'minute').isSameOrBefore(dayEnd)) {
      const slotEnd = cursor.add(duration, 'minute');
      const conflict = busySlots.some(busy => {
        const busyStart = dayjs(busy.start);
        const busyEnd = dayjs(busy.end);
        return cursor.isBefore(busyEnd) && slotEnd.isAfter(busyStart);
      });
      if (!conflict) {
        freeSlots.push({ start: cursor.toISOString(), end: slotEnd.toISOString() });
      }
      cursor = cursor.add(30, 'minute');
    }
    day = day.add(1, 'day');
  }

  return freeSlots;
}

// ─── Overlap resolution ───────────────────────────────────────────────────────

function resolveSlots(session: GroupMeetSession): (GroupMeetSlot & { votes: number })[] {
  const respondedParticipants = session.participants.filter(p => p.responded);
  if (respondedParticipants.length === 0) return [];

  return session.organizerFreeSlots
    .map(slot => {
      const votes = respondedParticipants.filter(p =>
        p.availableSlots.some(s =>
          dayjs(s.start).isSame(dayjs(slot.start)) && dayjs(s.end).isSame(dayjs(slot.end))
        )
      ).length;
      return { ...slot, votes };
    })
    .filter(s => s.votes > 0)
    .sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      // Prefer mid-morning (10am scores highest)
      const hourA = dayjs(a.start).hour();
      const hourB = dayjs(b.start).hour();
      const scoreA = -Math.abs(hourA - 10);
      const scoreB = -Math.abs(hourB - 10);
      if (scoreB !== scoreA) return scoreB - scoreA;
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGroupMeets(moduleInstanceId?: string) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<GroupMeetSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || !moduleInstanceId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'group_meets'),
      where('moduleInstanceIds', 'array-contains', moduleInstanceId)
    );

    const unsub = onSnapshot(
      q,
      snapshot => {
        const meets = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as GroupMeetSession));
        setSessions(meets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        setLoading(false);
      },
      error => {
        console.error('[useGroupMeets] Firestore error:', error);
        setLoading(false);
      }
    );

    return unsub;
  }, [user?.uid, moduleInstanceId]);

  const createGroupMeet = useCallback(async (data: CreateGroupMeetData): Promise<GroupMeetSession | null> => {
    if (!user?.uid) return null;
    try {
      const organizerFreeSlots = await computeOrganizerFreeSlots(user.uid, data.window, data.duration, data.calendarIds);

      const participants: GroupMeetParticipant[] = data.participants.map((p, i) => ({
        id: crypto.randomUUID(),
        email: p.email.toLowerCase().trim(),
        name: p.name.trim(),
        isAppUser: false,
        responded: false,
        availableSlots: [],
      }));

      const expiresAt = dayjs(data.window.end).add(1, 'day').toISOString();

      const sessionData: Omit<GroupMeetSession, 'id'> = {
        organizerId: user.uid,
        organizerName: user.displayName || user.email?.split('@')[0] || 'Someone',
        title: data.title,
        duration: data.duration,
        window: data.window,
        locationType: data.locationType,
        organizerFreeSlots,
        participants,
        proposedSlots: [],
        confirmedSlot: null,
        status: 'collecting',
        autoConfirm: data.autoConfirm,
        moduleInstanceIds: [data.moduleInstanceId],
        expiresAt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const ref = await addDoc(collection(db, 'group_meets'), sessionData);
      return { id: ref.id, ...sessionData };
    } catch (err) {
      console.error('Failed to create group meet:', err);
      toast.error('Failed to create group meeting');
      return null;
    }
  }, [user]);

  const confirmSlot = useCallback(async (sessionId: string, slot: GroupMeetSlot) => {
    try {
      await updateDoc(doc(db, 'group_meets', sessionId), {
        confirmedSlot: slot,
        status: 'confirmed',
        updatedAt: new Date().toISOString(),
      });
      toast.success('Meeting confirmed!');
    } catch {
      toast.error('Failed to confirm slot');
    }
  }, []);

  const cancelSession = useCallback(async (sessionId: string) => {
    try {
      await updateDoc(doc(db, 'group_meets', sessionId), {
        status: 'cancelled',
        updatedAt: new Date().toISOString(),
      });
    } catch {
      toast.error('Failed to cancel meeting');
    }
  }, []);

  const addParticipantToSession = useCallback(async (
    sessionId: string,
    participant: { name: string; email: string }
  ) => {
    try {
      const sessionRef = doc(db, 'group_meets', sessionId);
      const snap = await getDoc(sessionRef);
      if (!snap.exists()) return;
      const data = snap.data() as GroupMeetSession;
      const alreadyIn = data.participants.some(
        p => p.email.toLowerCase() === participant.email.toLowerCase().trim()
      );
      if (alreadyIn) {
        toast.error('This person is already invited');
        return;
      }
      const newParticipant: GroupMeetParticipant = {
        id: crypto.randomUUID(),
        email: participant.email.toLowerCase().trim(),
        name: participant.name.trim() || participant.email.split('@')[0],
        isAppUser: false,
        responded: false,
        availableSlots: [],
      };
      await updateDoc(sessionRef, {
        participants: [...data.participants, newParticipant],
        updatedAt: new Date().toISOString(),
      });
      toast.success(`${newParticipant.name} added`);
    } catch {
      toast.error('Failed to add participant');
    }
  }, []);

  // Attach this module instance to an existing session (module picker flow)
  const attachToModule = useCallback(async (sessionId: string, instanceId: string) => {
    try {
      await updateDoc(doc(db, 'group_meets', sessionId), {
        moduleInstanceIds: arrayUnion(instanceId),
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to attach session to module:', err);
    }
  }, []);

  return {
    sessions,
    addParticipantToSession,
    loading,
    createGroupMeet,
    confirmSlot,
    cancelSession,
    attachToModule,
    resolveSlots,
  };
}

// ─── Guest / public hook (no auth required) ───────────────────────────────────

export function useGroupMeetSession(sessionId: string | undefined) {
  const [session, setSession] = useState<GroupMeetSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!sessionId) { setLoading(false); return; }

    const unsub = onSnapshot(
      doc(db, 'group_meets', sessionId),
      snap => {
        if (!snap.exists()) {
          setNotFound(true);
          setLoading(false);
          return;
        }
        setSession({ id: snap.id, ...snap.data() } as GroupMeetSession);
        setLoading(false);
      },
      error => {
        console.error('[useGroupMeetSession] Firestore error:', error);
        setNotFound(true);
        setLoading(false);
      }
    );

    return unsub;
  }, [sessionId]);

  const submitAvailability = useCallback(async (
    sessionId: string,
    participantEmail: string,
    participantName: string,
    availableSlots: GroupMeetSlot[],
    userId?: string
  ) => {
    try {
      const sessionRef = doc(db, 'group_meets', sessionId);
      const snap = await getDoc(sessionRef);
      if (!snap.exists()) throw new Error('Session not found');

      const data = snap.data() as GroupMeetSession;
      const participants = [...data.participants];

      const idx = participants.findIndex(p => p.email.toLowerCase() === participantEmail.toLowerCase());
      if (idx !== -1) {
        participants[idx] = {
          ...participants[idx],
          responded: true,
          availableSlots,
          respondedAt: new Date().toISOString(),
          ...(userId ? { isAppUser: true, userId } : {}),
          name: participantName || participants[idx].name,
        };
      } else {
        // Unknown guest — add them
        participants.push({
          id: crypto.randomUUID(),
          email: participantEmail.toLowerCase(),
          name: participantName,
          isAppUser: !!userId,
          userId,
          responded: true,
          availableSlots,
          respondedAt: new Date().toISOString(),
        });
      }

      // Recompute proposed slots
      const updatedSession = { ...data, participants };
      const proposed = resolveSlots(updatedSession);

      const allResponded = participants.every(p => p.responded);
      const shouldAutoConfirm = data.autoConfirm && allResponded && proposed.length > 0;

      await updateDoc(sessionRef, {
        participants,
        proposedSlots: proposed,
        ...(shouldAutoConfirm ? { confirmedSlot: proposed[0], status: 'confirmed' } : {}),
        updatedAt: new Date().toISOString(),
      });

      return { success: true, autoConfirmed: shouldAutoConfirm, confirmedSlot: shouldAutoConfirm ? proposed[0] : null };
    } catch (err) {
      console.error('Failed to submit availability:', err);
      return { success: false };
    }
  }, []);

  return { session, loading, notFound, submitAvailability };
}
