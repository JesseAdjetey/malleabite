
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Rescheduling / Conflict Preferences ────────────────────────────────────

export type RescheduleMode = 'off' | 'manual' | 'suggest' | 'auto';

export type AutoRescheduleTarget = 'newer_event' | 'shorter_event' | 'lower_priority';

export interface ReschedulingPreferences {
  /** Master switch for the collision/conflict system */
  mode: RescheduleMode;
  /**
   * Calendar IDs explicitly excluded from conflict checking.
   * Empty array (default) = all calendars are checked.
   */
  conflictExcludedCalendarIds: string[];
  /**
   * @deprecated kept for backward compatibility; use conflictExcludedCalendarIds instead.
   * null = all calendars. string[] = only these calendar IDs.
   */
  conflictCalendarIds: string[] | null;
  /** Minimum gap required between consecutive events (minutes) */
  minBufferMinutes: number;
  /** Extra buffer added when an event has a location set (travel time) */
  travelTimeBuffer: number;
  /** Extra buffer before/after focusTime blocks */
  focusBlockBuffer: number;
  /** Work-day start hour (0-23) — used when finding alternative slots */
  workdayStart: number;
  /** Work-day end hour (0-23) */
  workdayEnd: number;
  /** Days of week to search (0=Sun … 6=Sat) */
  workDays: number[];
  /** Round rescheduled times to this interval */
  snapToMinutes: 15 | 30;
  /** Consecutive meeting limit before triggering a back-to-back warning */
  maxConsecutiveMeetings: number;
  /** Which event to move when auto-resolving a conflict */
  autoRescheduleTarget: AutoRescheduleTarget;
  /** How many days ahead to search for an alternative slot */
  autoSearchDays: number;
}

export const DEFAULT_RESCHEDULING_PREFS: ReschedulingPreferences = {
  mode: 'suggest',
  conflictExcludedCalendarIds: [],
  conflictCalendarIds: null,
  minBufferMinutes: 10,
  travelTimeBuffer: 15,
  focusBlockBuffer: 30,
  workdayStart: 8,
  workdayEnd: 18,
  workDays: [1, 2, 3, 4, 5],
  snapToMinutes: 15,
  maxConsecutiveMeetings: 3,
  autoRescheduleTarget: 'newer_event',
  autoSearchDays: 7,
};

export interface MallyVoiceOption {
  id: string;       // VAPI built-in voiceId
  label: string;
  gender: 'female' | 'male';
  accent?: string;
}

export const MALLY_VOICE_OPTIONS: MallyVoiceOption[] = [
  { id: 'Lily',     label: 'Lily',     gender: 'female' },
  { id: 'Savannah', label: 'Savannah', gender: 'female' },
  { id: 'Hana',     label: 'Hana',     gender: 'female' },
  { id: 'Neha',     label: 'Neha',     gender: 'female' },
  { id: 'Elliot',   label: 'Elliot',   gender: 'male' },
  { id: 'Rohan',    label: 'Rohan',    gender: 'male' },
  { id: 'Spencer',  label: 'Spencer',  gender: 'male' },
  { id: 'Cole',     label: 'Cole',     gender: 'male' },
];

interface SettingsState {
  backgroundColor: string;
  setBackgroundColor: (color: string) => void;
  /** When true, AI actions execute immediately without confirmation. When false, user must confirm. */
  aiAutoExecute: boolean;
  setAiAutoExecute: (value: boolean) => void;
  /** Default todo list ID for AI-created todos (persists user preference) */
  defaultTodoListId: string | null;
  setDefaultTodoListId: (id: string | null) => void;
  /** Deepgram Aura TTS voice model for Mally voice sessions */
  mallyVoice: string;
  setMallyVoice: (voice: string) => void;
  /**
   * Which calendar IDs the AI (Mally) is allowed to read events from.
   * null = all calendars (default).
   * string[] = only the listed calendar IDs.
   */
  aiEnabledCalendarIds: string[] | null;
  setAiEnabledCalendarIds: (ids: string[] | null) => void;
  /**
   * When true, Mally never asks clarifying questions — it picks the best option
   * and acts immediately. When false (default), it may ask brief follow-up questions.
   */
  mallyAutoMode: boolean;
  setMallyAutoMode: (value: boolean) => void;
  /** Conflict detection and rescheduling preferences */
  reschedulingPrefs: ReschedulingPreferences;
  setReschedulingPrefs: (prefs: Partial<ReschedulingPreferences>) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      backgroundColor: '#1a1625',
      setBackgroundColor: (color) => set({ backgroundColor: color }),
      aiAutoExecute: true,
      setAiAutoExecute: (value) => set({ aiAutoExecute: value }),
      defaultTodoListId: null,
      setDefaultTodoListId: (id) => set({ defaultTodoListId: id }),
      mallyVoice: 'Lily',
      setMallyVoice: (voice) => set({ mallyVoice: voice }),
      aiEnabledCalendarIds: null,
      setAiEnabledCalendarIds: (ids) => set({ aiEnabledCalendarIds: ids }),
      mallyAutoMode: false,
      setMallyAutoMode: (value) => set({ mallyAutoMode: value }),
      reschedulingPrefs: DEFAULT_RESCHEDULING_PREFS,
      setReschedulingPrefs: (prefs) =>
        set((state) => ({ reschedulingPrefs: { ...state.reschedulingPrefs, ...prefs } })),
    }),
    {
      name: 'timegeist-settings',
    }
  )
);
