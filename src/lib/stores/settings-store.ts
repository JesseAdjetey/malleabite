
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
    }),
    {
      name: 'timegeist-settings',
    }
  )
);
