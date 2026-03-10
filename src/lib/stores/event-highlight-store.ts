import { create } from "zustand";

export type HighlightItemType = 'event' | 'todo' | 'eisenhower' | 'alarm' | 'reminder';

interface EventHighlightState {
  highlightedEventId: string | null;
  highlightedEventTime: string | null; // ISO string of start time
  /** Generic highlighted item (works for todos, priority items, etc.) */
  highlightedItemId: string | null;
  highlightedItemType: HighlightItemType | null;
  setHighlight: (eventId: string, startTime?: string) => void;
  setItemHighlight: (itemId: string, itemType: HighlightItemType) => void;
  clearHighlight: () => void;
}

export const useEventHighlightStore = create<EventHighlightState>()((set) => ({
  highlightedEventId: null,
  highlightedEventTime: null,
  highlightedItemId: null,
  highlightedItemType: null,
  setHighlight: (eventId, startTime) => {
    set({ highlightedEventId: eventId, highlightedEventTime: startTime ?? null, highlightedItemId: eventId, highlightedItemType: 'event' });
    // Auto-clear after animation completes
    setTimeout(() => {
      set((state) =>
        state.highlightedEventId === eventId
          ? { highlightedEventId: null, highlightedEventTime: null, highlightedItemId: null, highlightedItemType: null }
          : state
      );
    }, 4500);
  },
  setItemHighlight: (itemId, itemType) => {
    set({ highlightedItemId: itemId, highlightedItemType: itemType });
    setTimeout(() => {
      set((state) =>
        state.highlightedItemId === itemId
          ? { highlightedItemId: null, highlightedItemType: null }
          : state
      );
    }, 4500);
  },
  clearHighlight: () => set({ highlightedEventId: null, highlightedEventTime: null, highlightedItemId: null, highlightedItemType: null }),
}));
