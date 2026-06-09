import { create } from 'zustand';
import { Timestamp } from 'firebase/firestore';
import { CalendarEventType } from './types';

export type ReminderStatus = 'pending' | 'completed';
export type ReminderRecurrence = 'none' | 'daily' | 'weekly' | 'weekdays' | 'custom';

export interface Reminder {
  id: string;
  title: string;
  description: string | null;
  reminderTime: string | Timestamp;
  eventId: string | null;
  timeBeforeMinutes: number | null;
  timeAfterMinutes: number | null;
  soundId: string | null;
  isActive: boolean;
  status?: ReminderStatus;
  recurrence?: ReminderRecurrence;
  customDays?: number[]; // 0=Sun, 1=Mon ... 6=Sat
  createdAt: string | Timestamp;
  userId?: string;
  event?: CalendarEventType;
  moduleInstanceId?: string;
}

interface RemindersStore {
  reminders: Reminder[];
  loading: boolean;
  error: string | null;
  setReminders: (reminders: Reminder[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const useRemindersStore = create<RemindersStore>((set) => ({
  reminders: [],
  loading: true,
  error: null,
  setReminders: (reminders) => set({ reminders }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  clear: () => set({ reminders: [], loading: true, error: null })
}));
