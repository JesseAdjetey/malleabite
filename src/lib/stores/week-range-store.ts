import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface WeekRangeStoreType {
  /** Start day index (0 = Sunday … 6 = Saturday) within the visible week */
  rangeStart: number;
  /** End day index (inclusive) */
  rangeEnd: number;
  /** Set the start index (clamped 0–rangeEnd) */
  setRangeStart: (index: number) => void;
  /** Set the end index (clamped rangeStart–6) */
  setRangeEnd: (index: number) => void;
  /** Set both at once */
  setRange: (start: number, end: number) => void;
  /** Reset to full week (0–6) */
  resetRange: () => void;
}

export const useWeekRangeStore = create<WeekRangeStoreType>()(
  devtools(
    persist(
      (set, get) => ({
        rangeStart: 0,
        rangeEnd: 6,

        setRangeStart: (index: number) => {
          const clamped = Math.max(0, Math.min(index, get().rangeEnd));
          set({ rangeStart: clamped });
        },

        setRangeEnd: (index: number) => {
          const clamped = Math.max(get().rangeStart, Math.min(index, 6));
          set({ rangeEnd: clamped });
        },

        setRange: (start: number, end: number) => {
          const s = Math.max(0, Math.min(start, 6));
          const e = Math.max(s, Math.min(end, 6));
          set({ rangeStart: s, rangeEnd: e });
        },

        resetRange: () => set({ rangeStart: 0, rangeEnd: 6 }),
      }),
      { name: "week_range", skipHydration: true }
    )
  )
);
