
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  backgroundColor: string;
  setBackgroundColor: (color: string) => void;
  /** When true, AI actions execute immediately without confirmation. When false, user must confirm. */
  aiAutoExecute: boolean;
  setAiAutoExecute: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      backgroundColor: '#1a1625',
      setBackgroundColor: (color) => set({ backgroundColor: color }),
      aiAutoExecute: true,
      setAiAutoExecute: (value) => set({ aiAutoExecute: value }),
    }),
    {
      name: 'timegeist-settings',
    }
  )
);
