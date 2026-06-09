import { create } from 'zustand';
import { Timestamp } from 'firebase/firestore';

export interface EisenhowerItem {
  id: string;
  text: string;
  quadrant: 'urgent_important' | 'not_urgent_important' | 'urgent_not_important' | 'not_urgent_not_important';
  userId?: string;
  created_at?: string | Timestamp;
  updated_at?: string | Timestamp;
  event_id?: string;
  moduleInstanceId?: string;
}

interface EisenhowerStore {
  items: EisenhowerItem[];
  loading: boolean;
  error: string | null;
  setItems: (items: EisenhowerItem[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clear: () => void;
}

export const useEisenhowerStore = create<EisenhowerStore>((set) => ({
  items: [],
  loading: true,
  error: null,
  setItems: (items) => set({ items }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  clear: () => set({ items: [], loading: true, error: null })
}));
