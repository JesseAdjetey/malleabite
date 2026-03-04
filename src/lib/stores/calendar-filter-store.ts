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
  /** Idempotent: explicitly set a calendar's visibility (safe to call multiple times). */
  setCalendarVisible: (id: string, visible: boolean) => void;
  setAllVisible: (visible: boolean) => void;
  isCalendarVisible: (calendarId: string | undefined) => boolean;
  getVisibleCalendarIds: () => string[];
}

// Default "Personal" calendar — every event that has no explicit calendarId
// is treated as belonging to this calendar.
export const PERSONAL_CALENDAR_ID = 'personal';

const DEFAULT_ACCOUNT: CalendarAccount = {
  id: PERSONAL_CALENDAR_ID,
  name: 'Personal',
  color: '#8B5CF6',
  visible: true,
  isDefault: true,
};

export const useCalendarFilterStore = create<CalendarFilterState>()(
  persist(
    (set, get) => ({
      accounts: [DEFAULT_ACCOUNT],
      hiddenCalendarIds: new Set<string>(),
      
      addAccount: (account) => set((state) => {
        const newHidden = new Set(state.hiddenCalendarIds);
        if (account.visible === false) {
          newHidden.add(account.id);
        } else {
          newHidden.delete(account.id);
        }
        return {
          accounts: [...state.accounts, account],
          hiddenCalendarIds: newHidden,
        };
      }),
      
      removeAccount: (id) => set((state) => ({
        accounts: state.accounts.filter(a => a.id !== id && a.id !== PERSONAL_CALENDAR_ID),
        hiddenCalendarIds: (() => {
          const newSet = new Set(state.hiddenCalendarIds);
          newSet.delete(id);
          return newSet;
        })(),
      })),
      
      updateAccount: (id, updates) => set((state) => {
        const newHidden = new Set(state.hiddenCalendarIds);
        if ('visible' in updates) {
          if (updates.visible) {
            newHidden.delete(id);
          } else {
            newHidden.add(id);
          }
        }
        return {
          accounts: state.accounts.map(a =>
            a.id === id ? { ...a, ...updates } : a
          ),
          hiddenCalendarIds: newHidden,
        };
      }),
      
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

      setCalendarVisible: (id, visible) => set((state) => {
        const newHidden = new Set(state.hiddenCalendarIds);
        if (visible) {
          newHidden.delete(id);
        } else {
          newHidden.add(id);
        }
        return {
          hiddenCalendarIds: newHidden,
          accounts: state.accounts.map(a =>
            a.id === id ? { ...a, visible } : a
          ),
        };
      }),
      
      setAllVisible: (visible) => set((state) => ({
        hiddenCalendarIds: visible ? new Set() : new Set(state.accounts.map(a => a.id)),
        accounts: state.accounts.map(a => ({ ...a, visible })),
      })),
      
      isCalendarVisible: (calendarId) => {
        const state = get();
        // Map missing or legacy 'default' calendarId to Personal
        let id = calendarId || PERSONAL_CALENDAR_ID;
        if (id === 'default') id = PERSONAL_CALENDAR_ID;
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
      merge: (persisted: any, current) => {
        let accounts: CalendarAccount[] = persisted?.accounts || current.accounts;
        let hiddenIds: string[] = persisted?.hiddenCalendarIds || [];

        // Migrate legacy 'default' → 'personal'
        accounts = accounts.map(a =>
          a.id === 'default' ? { ...a, id: PERSONAL_CALENDAR_ID, name: 'Personal', isDefault: true } : a
        );
        hiddenIds = hiddenIds.map(id => (id === 'default' ? PERSONAL_CALENDAR_ID : id));

        // Ensure the Personal account exists
        if (!accounts.some(a => a.id === PERSONAL_CALENDAR_ID)) {
          accounts = [DEFAULT_ACCOUNT, ...accounts];
        }

        // Reconcile account.visible with hiddenCalendarIds to fix any desync
        const hiddenSet = new Set(hiddenIds);
        accounts = accounts.map(a => ({
          ...a,
          visible: !hiddenSet.has(a.id),
        }));

        return {
          ...current,
          accounts,
          hiddenCalendarIds: hiddenSet,
        };
      },
    }
  )
);

// Hook to filter events based on calendar visibility
export function useFilteredEvents<T extends { calendarId?: string }>(events: T[]): T[] {
  // Subscribe to hiddenCalendarIds for reactivity (the function ref never changes)
  const hiddenCalendarIds = useCalendarFilterStore(state => state.hiddenCalendarIds);
  const isCalendarVisible = useCalendarFilterStore(state => state.isCalendarVisible);
  
  return events.filter(event => isCalendarVisible(event.calendarId));
}
