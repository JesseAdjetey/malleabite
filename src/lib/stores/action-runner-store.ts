import { create } from 'zustand';
import { CalendarEventType } from '@/lib/stores/types';

interface ActionRunnerStore {
  /** The event whose actions are about to run */
  pendingEvent: CalendarEventType | null;
  /** IDs of events whose actions have already been triggered this session */
  executedEventIds: Set<string>;

  setPending: (event: CalendarEventType) => void;
  clearPending: () => void;
  markExecuted: (eventId: string) => void;
  hasExecuted: (eventId: string) => boolean;
}

export const useActionRunnerStore = create<ActionRunnerStore>((set, get) => ({
  pendingEvent: null,
  executedEventIds: new Set(),

  setPending: (event) => set({ pendingEvent: event }),

  clearPending: () => set({ pendingEvent: null }),

  markExecuted: (eventId) => {
    const next = new Set(get().executedEventIds);
    next.add(eventId);
    set({ executedEventIds: next });
  },

  hasExecuted: (eventId) => get().executedEventIds.has(eventId),
}));
