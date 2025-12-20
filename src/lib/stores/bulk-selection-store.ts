import { create } from 'zustand';
import { CalendarEventType } from './types';

interface BulkSelectionState {
  selectedIds: Set<string>;
  isBulkMode: boolean;
  
  // Actions
  toggleSelection: (eventId: string) => void;
  selectAll: (eventIds: string[]) => void;
  deselectAll: () => void;
  isSelected: (eventId: string) => boolean;
  enableBulkMode: () => void;
  disableBulkMode: () => void;
}

export const useBulkSelectionStore = create<BulkSelectionState>((set, get) => ({
  selectedIds: new Set(),
  isBulkMode: false,
  
  toggleSelection: (eventId: string) => {
    set((state) => {
      const newSet = new Set(state.selectedIds);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return { selectedIds: newSet };
    });
  },
  
  selectAll: (eventIds: string[]) => {
    set({ selectedIds: new Set(eventIds) });
  },
  
  deselectAll: () => {
    set({ selectedIds: new Set() });
  },
  
  isSelected: (eventId: string) => {
    return get().selectedIds.has(eventId);
  },
  
  enableBulkMode: () => {
    set({ isBulkMode: true });
  },
  
  disableBulkMode: () => {
    set({ isBulkMode: false, selectedIds: new Set() });
  },
}));
