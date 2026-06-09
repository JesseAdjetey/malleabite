import { create } from 'zustand';
import { Timestamp } from 'firebase/firestore';

export interface Alarm {
  id?: string;
  userId: string;
  title: string;
  time: string | Date; // ISO datetime or HH:MM format
  enabled: boolean;
  linkedEventId?: string;
  linkedTodoId?: string;
  soundId?: string;
  snoozeEnabled?: boolean;
  snoozeDuration?: number; // minutes
  repeatDays?: number[]; // 0-6 for Sunday-Saturday, empty for one-time
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  moduleInstanceId?: string;
}

interface AlarmsStore {
  alarms: Alarm[];
  loading: boolean;
  error: string | null;
  setAlarms: (alarms: Alarm[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const useAlarmsStore = create<AlarmsStore>((set) => ({
  alarms: [],
  loading: true,
  error: null,
  setAlarms: (alarms) => set({ alarms }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  clear: () => set({ alarms: [], loading: true, error: null })
}));
