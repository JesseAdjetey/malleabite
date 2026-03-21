import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGroupMeetSession } from '@/hooks/use-group-meets';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { GroupMeetSlot } from '@/lib/stores/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Check, Calendar, Clock, Users, ChevronLeft, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import { GoogleAuthProvider, signInWithPopup, getAuth } from 'firebase/auth';
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { isNative } from '@/lib/platform';

interface CalendarOption {
  id: string;
  name: string;
  color: string;
}

async function fetchUserCalendars(userId: string): Promise<CalendarOption[]> {
  try {
    const snap = await getDocs(collection(db, `users/${userId}/connectedCalendars`));
    const googleCals = snap.docs.map(d => ({
      id: d.id,
      name: (d.data().name as string) || 'Google Calendar',
      color: (d.data().color as string) || '#4285F4',
    }));
    return [{ id: 'personal', name: 'Personal', color: '#8B5CF6' }, ...googleCals];
  } catch {
    return [{ id: 'personal', name: 'Personal', color: '#8B5CF6' }];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Call Google Calendar freebusy API and return which organizer slots the guest is free for */
async function fetchFreeSlotsFromGoogleCalendar(
  accessToken: string,
  window: { start: string; end: string },
  organizerFreeSlots: GroupMeetSlot[]
): Promise<GroupMeetSlot[]> {
  try {
    const resp = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Start from beginning of the first day so events before window.start
        // (e.g. morning events when the session was created at 3pm) are included
        timeMin: dayjs(window.start).startOf('day').toISOString(),
        timeMax: window.end,
        items: [{ id: 'primary' }],
      }),
    });
    if (!resp.ok) return organizerFreeSlots;
    const data = await resp.json();
    const busyPeriods: { start: string; end: string }[] = data.calendars?.primary?.busy ?? [];

    return organizerFreeSlots.filter(slot => {
      const slotStart = new Date(slot.start).getTime();
      const slotEnd = new Date(slot.end).getTime();
      return !busyPeriods.some(busy => {
        const bs = new Date(busy.start).getTime();
        const be = new Date(busy.end).getTime();
        return slotStart < be && slotEnd > bs;
      });
    });
  } catch {
    return organizerFreeSlots; // fallback: return all organizer slots
  }
}

/**
 * Query Firestore calendar_events + syncedEvents for an app user.
 * Returns null only if the user has NO calendar data in the window (can't auto-fill reliably).
 * Returns the filtered free slots otherwise.
 */
async function fetchFreeSlotsFromFirestore(
  userId: string,
  window: { start: string; end: string },
  organizerFreeSlots: GroupMeetSlot[],
  calendarIds?: string[]
): Promise<GroupMeetSlot[] | null> {
  try {
    const includePersonal = !calendarIds || calendarIds.includes('personal');
    const googleIds = calendarIds ? calendarIds.filter(id => id !== 'personal') : null;
    // Start from beginning of the first day so morning events aren't missed
    // when window.start is mid-day (e.g. session created at 3pm but slots show from 8am)
    const queryStart = dayjs(window.start).startOf('day').toISOString();

    const [nativeSnap, syncedSnap, templatesSnap] = await Promise.all([
      includePersonal
        ? getDocs(query(
            collection(db, 'calendar_events'),
            where('userId', '==', userId),
            where('startsAt', '>=', queryStart),
            where('startsAt', '<=', window.end)
          ))
        : Promise.resolve(null),
      getDocs(query(
        collection(db, `users/${userId}/syncedEvents`),
        where('startTime', '>=', queryStart),
        where('startTime', '<=', window.end)
      )),
      includePersonal
        ? getDocs(collection(db, `users/${userId}/calendarTemplates`))
        : Promise.resolve(null),
    ]);

    const filteredSynced = googleIds !== null
      ? syncedSnap.docs.filter((d) => googleIds.includes(d.data().calendarId as string))
      : syncedSnap.docs;

    // Expand active template events into busy slots for each day in the window
    const templateBusy: { start: string; end: string }[] = [];
    if (includePersonal && templatesSnap) {
      const winStart = dayjs(window.start).startOf('day');
      const winEnd = dayjs(window.end);
      let tDay = winStart;
      while (tDay.isBefore(winEnd)) {
        const dow = tDay.day();
        for (const tDoc of templatesSnap.docs) {
          const tmpl = tDoc.data();
          if (!tmpl.isActive) continue;
          for (const ev of (tmpl.events || []) as Array<{ dayOfWeek: number; startTime: string; endTime: string }>) {
            if (ev.dayOfWeek !== dow) continue;
            const [sh, sm] = ev.startTime.split(':').map(Number);
            const [eh, em] = ev.endTime.split(':').map(Number);
            templateBusy.push({
              start: tDay.hour(sh).minute(sm).second(0).toISOString(),
              end: tDay.hour(eh).minute(em).second(0).toISOString(),
            });
          }
        }
        tDay = tDay.add(1, 'day');
      }
    }

    // No calendar data at all — can't auto-fill meaningfully
    if ((!nativeSnap || nativeSnap.empty) && filteredSynced.length === 0 && templateBusy.length === 0) return null;

    const busyPeriods: { start: string; end: string }[] = [
      ...(nativeSnap ? nativeSnap.docs.map(d => {
        const data = d.data();
        return {
          start: data.startsAt instanceof Timestamp ? data.startsAt.toDate().toISOString() : data.startsAt,
          end: data.endsAt instanceof Timestamp ? data.endsAt.toDate().toISOString() : data.endsAt,
        };
      }) : []),
      ...filteredSynced.map(d => {
        const data = d.data();
        return { start: data.startTime as string, end: data.endTime as string };
      }),
      ...templateBusy,
    ];

    return organizerFreeSlots.filter(slot => {
      const slotStart = new Date(slot.start).getTime();
      const slotEnd = new Date(slot.end).getTime();
      return !busyPeriods.some(busy => {
        const bs = new Date(busy.start).getTime();
        const be = new Date(busy.end).getTime();
        return slotStart < be && slotEnd > bs;
      });
    });
  } catch {
    return null;
  }
}

// ─── Availability Grid ────────────────────────────────────────────────────────

interface AvailabilityGridProps {
  organizerFreeSlots: GroupMeetSlot[];
  selected: GroupMeetSlot[];
  onToggle: (slot: GroupMeetSlot) => void;
  timezone: string;
}

const AvailabilityGrid: React.FC<AvailabilityGridProps> = ({
  organizerFreeSlots,
  selected,
  onToggle,
  timezone,
}) => {
  const byDay = useMemo(() => {
    const map = new Map<string, GroupMeetSlot[]>();
    organizerFreeSlots.forEach(slot => {
      const key = dayjs(slot.start).format('YYYY-MM-DD');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(slot);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [organizerFreeSlots]);

  const isSelected = (slot: GroupMeetSlot) =>
    selected.some(s => s.start === slot.start && s.end === slot.end);

  if (organizerFreeSlots.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        No available slots found in this window.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {byDay.map(([dateKey, slots]) => (
        <div key={dateKey}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {dayjs(dateKey).format('ddd, MMM D')}
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {slots.map(slot => {
              const sel = isSelected(slot);
              return (
                <button
                  key={slot.start}
                  onClick={() => onToggle(slot)}
                  className={cn(
                    'py-2 px-1 rounded-lg text-xs font-medium transition-all border',
                    sel
                      ? 'bg-purple-500 border-purple-500 text-white'
                      : 'bg-muted/40 border-border/40 text-muted-foreground hover:border-purple-400 hover:text-foreground'
                  )}
                >
                  {dayjs(slot.start).format('h:mma')}
                  {sel && <Check size={10} className="inline ml-1" />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <p className="text-[11px] text-muted-foreground text-center">
        Times shown in {timezone}
      </p>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

type Step = 'identity' | 'calendar_picker' | 'availability' | 'done' | 'organizer';

const MeetPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { session, loading, notFound, submitAvailability } = useGroupMeetSession(sessionId);
  const { user } = useAuth();

  const [step, setStep] = useState<Step>('identity');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [selected, setSelected] = useState<GroupMeetSlot[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  // Calendar picker state (for already-logged-in users)
  const [calendarOptions, setCalendarOptions] = useState<CalendarOption[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [computingSlots, setComputingSlots] = useState(false);

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Running intersection: slots where the organizer AND all previous respondents are free.
  // Each new participant sees only the times that already work for everyone before them.
  const sievedSlots = useMemo(() => {
    if (!session) return [];
    const responded = session.participants.filter(p => p.responded);
    if (responded.length === 0) return session.organizerFreeSlots;

    const filtered = session.organizerFreeSlots.filter(slot =>
      responded.every(p =>
        p.availableSlots.some(s => s.start === slot.start && s.end === slot.end)
      )
    );
    // If there's no overlap at all yet, fall back to the full organizer list
    return filtered.length > 0 ? filtered : session.organizerFreeSlots;
  }, [session]);

  const previousRespondentCount = session?.participants.filter(p => p.responded).length ?? 0;

  // If already signed in when landing — handle organizer then show calendar picker
  useEffect(() => {
    if (user && session && step === 'identity') {
      if (user.uid === session.organizerId) {
        setStep('organizer');
        return;
      }

      const existing = session.participants.find(
        p => p.userId === user.uid || p.email.toLowerCase() === user.email?.toLowerCase()
      );
      if (existing?.responded) {
        setStep('done');
        return;
      }

      setName(user.displayName || '');
      setEmail(user.email || '');

      // Synchronously advance the step so this effect cannot fire again
      // (avoids duplicate fetches if session updates while awaiting)
      setStep('calendar_picker');
      setLoadingCalendars(true);
      fetchUserCalendars(user.uid).then(cals => {
        setCalendarOptions(cals);
        setSelectedCalendarIds(cals.map(c => c.id)); // default: all selected
        setLoadingCalendars(false);
      });
    }
  }, [user, session]);

  const handleCalendarConfirm = async () => {
    if (!user || !session) return;
    setComputingSlots(true);
    try {
      const freeSlots = await fetchFreeSlotsFromFirestore(
        user.uid,
        session.window,
        sievedSlots,
        selectedCalendarIds
      );
      if (freeSlots !== null && freeSlots.length > 0) {
        setSelected(freeSlots);
        setAutoFilled(true);
      }
    } finally {
      setComputingSlots(false);
      setStep('availability');
    }
  };

  const handleGoogleSignIn = async () => {
    if (!session) return;
    setSigningIn(true);
    try {
      // Store sessionId for the ModulePicker after redirect
      sessionStorage.setItem('pendingMeetSessionId', sessionId!);
      sessionStorage.setItem('pendingMeetOrganizerName', session.organizerName ?? '');
      sessionStorage.setItem('pendingMeetTitle', session.title ?? '');

      let accessToken: string | null = null;

      if (isNative) {
        // Native: use Capacitor plugin — no calendar scope available, fall back to manual
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
        const result = await FirebaseAuthentication.signInWithGoogle();
        const idToken = result.credential?.idToken;
        if (!idToken) throw new Error('No ID token');
        const { signInWithCredential, GoogleAuthProvider: GAP } = await import('firebase/auth');
        const credential = GAP.credential(idToken, result.credential?.accessToken);
        await signInWithCredential(getAuth(), credential);
        accessToken = result.credential?.accessToken ?? null;
      } else {
        // Web: popup with calendar readonly scope
        const provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/calendar.readonly');
        const result = await signInWithPopup(getAuth(), provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        accessToken = credential?.accessToken ?? null;
        setName(result.user.displayName || '');
        setEmail(result.user.email || '');
      }

      // Auto-compute availability from Google Calendar API
      if (accessToken) {
        const freeSlots = await fetchFreeSlotsFromGoogleCalendar(
          accessToken,
          session.window,
          sievedSlots
        );
        setSelected(freeSlots);
        setAutoFilled(true);
      }

      setStep('availability');
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user') {
        toast.error('Sign in failed, please try again');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleEmailContinue = () => {
    if (!name.trim() || !email.includes('@')) {
      toast.error('Please enter your name and a valid email');
      return;
    }
    setStep('availability');
  };

  const toggleSlot = (slot: GroupMeetSlot) => {
    setSelected(prev =>
      prev.some(s => s.start === slot.start)
        ? prev.filter(s => s.start !== slot.start)
        : [...prev, slot]
    );
  };

  const handleSubmit = async () => {
    if (!sessionId) return;
    setSubmitting(true);
    try {
      const result = await submitAvailability(
        sessionId,
        email.toLowerCase().trim(),
        name.trim(),
        selected,
        user?.uid
      );
      if (result.success) {
        setStep('done');
        if (user) {
          // Set pendingMeetSessionId so PendingMeetHandler shows ModulePicker on home
          sessionStorage.setItem('pendingMeetSessionId', sessionId!);
          sessionStorage.setItem('pendingMeetTitle', session?.title ?? '');
          sessionStorage.setItem('pendingMeetOrganizerName', session?.organizerName ?? '');
          navigate('/', { replace: true });
        }
      } else {
        toast.error('Something went wrong, please try again');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading / not found ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (notFound || !session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-xl font-bold mb-2">Meeting not found</h1>
          <p className="text-sm text-muted-foreground">This link may have expired or been cancelled.</p>
        </div>
      </div>
    );
  }

  if (session.status === 'cancelled') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-xl font-bold mb-2">Meeting cancelled</h1>
          <p className="text-sm text-muted-foreground">
            {session.organizerName} has cancelled this meeting request.
          </p>
        </div>
      </div>
    );
  }

  // For confirmed sessions: if the visiting user is a known participant who already responded,
  // show the confirmed screen. New invitees (not yet in participants) can still submit.
  if (session.status === 'confirmed' && session.confirmedSlot && step !== 'done') {
    const isKnownParticipant = session.participants.some(
      p => p.responded && (
        (user && (p.userId === user.uid || p.email.toLowerCase() === user.email?.toLowerCase()))
      )
    );
    // Only block with confirmed screen if user is a known respondent or organizer
    if (!user || user.uid === session.organizerId || isKnownParticipant) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="text-center max-w-sm space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{session.title}</h1>
              <p className="text-sm text-muted-foreground mt-1">This meeting has been confirmed</p>
            </div>
            <div className="rounded-xl bg-muted/40 px-4 py-3 text-sm space-y-1">
              <p className="font-semibold">{dayjs(session.confirmedSlot.start).format('dddd, MMMM D')}</p>
              <p className="text-muted-foreground">
                {dayjs(session.confirmedSlot.start).format('h:mma')} – {dayjs(session.confirmedSlot.end).format('h:mma')}
                <span className="ml-1 text-xs">({timezone})</span>
              </p>
            </div>
          </div>
        </div>
      );
    }
    // Fall through — new invitee can still submit their availability
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-sm space-y-4">
          <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mx-auto">
            <Check className="h-8 w-8 text-purple-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold">You're all set!</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {session.organizerName} will confirm a time and you'll hear back at {email || 'your email'}.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Organizer view ────────────────────────────────────────────────────────
  if (step === 'organizer') {
    const respondedCount = session.participants.filter(p => p.responded).length;
    const url = `${window.location.origin}/meet/${sessionId}`;
    return (
      <div className="min-h-screen bg-background flex flex-col items-center px-4 py-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-1">
            <img src="/logo-quadrant.svg" alt="Malleabite" className="w-9 h-9 mx-auto mb-3 opacity-80" />
            <h1 className="text-2xl font-bold tracking-tight">{session.title}</h1>
            <p className="text-sm text-muted-foreground">Your meeting link</p>
          </div>

          <div className="rounded-xl bg-muted/40 border border-border/50 p-4 space-y-3">
            <div className="flex items-center gap-2 bg-background rounded-md px-3 py-2 border border-border/40">
              <span className="text-xs text-muted-foreground truncate flex-1">{url}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(url); toast.success('Link copied!'); }}
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              {session.participants.length === 0
                ? 'No invitees yet — share the link to get responses'
                : `${respondedCount} of ${session.participants.length} responded`}
            </p>

            {session.participants.length > 0 && (
              <div className="space-y-1.5">
                {session.participants.map(p => (
                  <div key={p.id} className="flex items-center gap-2 text-xs">
                    <div className={`h-1.5 w-1.5 rounded-full ${p.responded ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                    <span className="text-muted-foreground truncate">{p.name || p.email}</span>
                    {p.responded && <Check size={11} className="text-green-500 ml-auto shrink-0" />}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            onClick={() => navigate('/')}
            variant="outline"
            className="w-full"
          >
            Back to app
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">

        {/* Header */}
        <div className="text-center space-y-1">
          <img src="/logo-quadrant.svg" alt="Malleabite" className="w-9 h-9 mx-auto mb-3 opacity-80" />
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{session.organizerName}</span> wants to schedule
          </p>
          <h1 className="text-2xl font-bold tracking-tight">{session.title}</h1>
          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1"><Clock size={11} /> {session.duration} min</span>
            <span className="flex items-center gap-1"><Users size={11} /> {session.participants.length + 1} people</span>
          </div>
        </div>

        {/* Step: Identity */}
        {step === 'identity' && (
          <div className="space-y-4">
            <Button
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="w-full h-11 bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 shadow-sm font-medium"
            >
              {signingIn ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : (
                <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              Sign in with Google
            </Button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="flex-1 h-px bg-border/50" />
            </div>

            <div className="space-y-2.5">
              <Input
                placeholder="Your name"
                value={name}
                onChange={e => setName(e.target.value)}
                className="h-11"
              />
              <Input
                placeholder="Your email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="h-11"
                onKeyDown={e => e.key === 'Enter' && handleEmailContinue()}
              />
              <Button
                onClick={handleEmailContinue}
                disabled={!name.trim() || !email.includes('@')}
                className="w-full h-11"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step: Calendar Picker (already-logged-in users) */}
        {step === 'calendar_picker' && (
          <div className="space-y-4">
            {loadingCalendars ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div>
                  <p className="text-sm font-semibold mb-1">Which calendars should we check?</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    We'll use these to find times you're free.
                  </p>
                  <div className="space-y-2">
                    {calendarOptions.map(cal => {
                      const checked = selectedCalendarIds.includes(cal.id);
                      return (
                        <button
                          key={cal.id}
                          type="button"
                          onClick={() => setSelectedCalendarIds(prev =>
                            checked ? prev.filter(id => id !== cal.id) : [...prev, cal.id]
                          )}
                          className={cn(
                            'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all text-left',
                            checked
                              ? 'border-purple-500/50 bg-purple-500/8'
                              : 'border-border/40 text-muted-foreground hover:border-border/70'
                          )}
                        >
                          <span
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ background: cal.color }}
                          />
                          <span className="flex-1 text-sm">{cal.name}</span>
                          <div className={cn(
                            'h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors',
                            checked ? 'bg-purple-500 border-purple-500' : 'border-border/50'
                          )}>
                            {checked && <Check size={10} className="text-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Button
                  onClick={handleCalendarConfirm}
                  disabled={computingSlots || selectedCalendarIds.length === 0}
                  className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {computingSlots
                    ? <><Loader2 size={15} className="mr-2 animate-spin" /> Checking your calendar...</>
                    : 'Continue'
                  }
                </Button>

                <button
                  onClick={() => setStep('availability')}
                  className="w-full text-xs text-muted-foreground hover:text-foreground text-center"
                >
                  Skip — I'll select times manually
                </button>
              </>
            )}
          </div>
        )}

        {/* Step: Availability */}
        {step === 'availability' && (
          <div className="space-y-4">
            <button
              onClick={() => { if (user) setStep('calendar_picker'); else setStep('identity'); }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft size={13} /> Back
            </button>

            {/* Auto-filled banner */}
            {autoFilled && selected.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-purple-500/10 border border-purple-500/20 px-3 py-2.5">
                <Sparkles size={14} className="text-purple-400 mt-0.5 shrink-0" />
                <p className="text-xs text-purple-300 leading-relaxed">
                  We synced your calendar and found{' '}
                  <span className="font-semibold">{selected.length} times</span> that work for you.
                  Deselect any you can't make.
                </p>
              </div>
            )}
            {autoFilled && selected.length === 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5">
                <Sparkles size={14} className="text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-300 leading-relaxed">
                  Your calendar looks fully booked during these slots. Select any times that might still work.
                </p>
              </div>
            )}

            <div>
              {/* Context banner: let the new participant know the slots are pre-filtered */}
              {previousRespondentCount > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2.5 mb-3">
                  <Users size={13} className="text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-xs text-blue-300 leading-relaxed">
                    Showing <span className="font-semibold">{sievedSlots.length} times</span> that already work for{' '}
                    {previousRespondentCount === 1 ? 'the 1 person' : `all ${previousRespondentCount} people`} who responded before you.
                  </p>
                </div>
              )}

              {!autoFilled && (
                <>
                  <p className="text-sm font-semibold mb-1">When are you free?</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Tap the times that work for you.{' '}
                    {selected.length > 0 && (
                      <span className="text-purple-500 font-medium">{selected.length} selected</span>
                    )}
                  </p>
                </>
              )}
              {autoFilled && (
                <p className="text-xs text-muted-foreground mb-3">
                  {selected.length > 0
                    ? `${selected.length} selected — tap to deselect times you can't make`
                    : 'Tap any times that could work'}
                </p>
              )}
              <AvailabilityGrid
                organizerFreeSlots={sievedSlots}
                selected={selected}
                onToggle={toggleSlot}
                timezone={timezone}
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || selected.length === 0}
              className="w-full h-11 bg-purple-600 hover:bg-purple-700 text-white"
            >
              {submitting
                ? <><Loader2 size={15} className="mr-2 animate-spin" /> Submitting...</>
                : `Submit availability${selected.length > 0 ? ` (${selected.length} slots)` : ''}`
              }
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MeetPage;
