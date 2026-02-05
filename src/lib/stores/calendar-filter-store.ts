import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CalendarAccount {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  isDefault?: boolean;
  isGoogle?: boolean;
}

interface CalendarFilterState {
  accounts: CalendarAccount[];
  hiddenCalendarIds: Set<string>;
  
  // Actions
  addAccount: (account: CalendarAccount) => void;
  removeAccount: (id: string) => void;
  updateAccount: (id: string, updates: Partial<CalendarAccount>) => void;
  toggleVisibility: (id: string) => void;
  setAllVisible: (visible: boolean) => void;
  isCalendarVisible: (calendarId: string | undefined) => boolean;
  getVisibleCalendarIds: () => string[];
}

// Default "My Calendar" account
const DEFAULT_ACCOUNT: CalendarAccount = {
  id: 'default',
  name: 'My Calendar',
  color: '#8B5CF6',
  visible: true,
  isDefault: true,
};

export const useCalendarFilterStore = create<CalendarFilterState>()(
  persist(
    (set, get) => ({
      accounts: [DEFAULT_ACCOUNT],
      hiddenCalendarIds: new Set<string>(),
      
      addAccount: (account) => set((state) => ({
        accounts: [...state.accounts, account],
      })),
      
      removeAccount: (id) => set((state) => ({
        accounts: state.accounts.filter(a => a.id !== id && !a.isDefault),
        hiddenCalendarIds: (() => {
          const newSet = new Set(state.hiddenCalendarIds);
          newSet.delete(id);
          return newSet;
        })(),
      })),
      
      updateAccount: (id, updates) => set((state) => ({
        accounts: state.accounts.map(a => 
          a.id === id ? { ...a, ...updates } : a
        ),
      })),
      
      toggleVisibility: (id) => set((state) => {
        const newHidden = new Set(state.hiddenCalendarIds);
        if (newHidden.has(id)) {
          newHidden.delete(id);
        } else {
          newHidden.add(id);
        }
        return {
          hiddenCalendarIds: newHidden,
          accounts: state.accounts.map(a => 
            a.id === id ? { ...a, visible: !newHidden.has(id) } : a
          ),
        };
      }),
      
      setAllVisible: (visible) => set((state) => ({
        hiddenCalendarIds: visible ? new Set() : new Set(state.accounts.map(a => a.id)),
        accounts: state.accounts.map(a => ({ ...a, visible })),
      })),
      
      isCalendarVisible: (calendarId) => {
        const state = get();
        // If no calendarId, treat as default calendar
        const id = calendarId || 'default';
        return !state.hiddenCalendarIds.has(id);
      },
      
      getVisibleCalendarIds: () => {
        const state = get();
        return state.accounts
          .filter(a => !state.hiddenCalendarIds.has(a.id))
          .map(a => a.id);
      },
    }),
    {
      name: 'calendar-filter-storage',
      partialize: (state) => ({
        accounts: state.accounts,
        hiddenCalendarIds: Array.from(state.hiddenCalendarIds),
      }),
      merge: (persisted: any, current) => ({
        ...current,
        accounts: persisted?.accounts || current.accounts,
        hiddenCalendarIds: new Set(persisted?.hiddenCalendarIds || []),
      }),
    }
  )
);

// Hook to filter events based on calendar visibility
export function useFilteredEvents<T extends { calendarId?: string }>(events: T[]): T[] {
  const isCalendarVisible = useCalendarFilterStore(state => state.isCalendarVisible);
  
  return events.filter(event => isCalendarVisible(event.calendarId));
}
