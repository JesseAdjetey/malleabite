
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface MallyVoiceOption {
  id: string;       // Deepgram Aura model id
  label: string;
  gender: 'female' | 'male';
  accent?: string;
}

export const MALLY_VOICE_OPTIONS: MallyVoiceOption[] = [
  { id: 'aura-asteria-en',  label: 'Asteria',  gender: 'female' },
  { id: 'aura-luna-en',     label: 'Luna',     gender: 'female' },
  { id: 'aura-stella-en',   label: 'Stella',   gender: 'female' },
  { id: 'aura-athena-en',   label: 'Athena',   gender: 'female', accent: 'British' },
  { id: 'aura-hera-en',     label: 'Hera',     gender: 'female' },
  { id: 'aura-orion-en',    label: 'Orion',    gender: 'male' },
  { id: 'aura-arcas-en',    label: 'Arcas',    gender: 'male' },
  { id: 'aura-perseus-en',  label: 'Perseus',  gender: 'male' },
  { id: 'aura-angus-en',    label: 'Angus',    gender: 'male',   accent: 'Irish' },
  { id: 'aura-helios-en',   label: 'Helios',   gender: 'male',   accent: 'British' },
  { id: 'aura-zeus-en',     label: 'Zeus',     gender: 'male' },
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
      mallyVoice: 'aura-asteria-en',
      setMallyVoice: (voice) => set({ mallyVoice: voice }),
    }),
    {
      name: 'timegeist-settings',
    }
  )
);
