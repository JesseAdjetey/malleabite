import { create } from 'zustand';

interface SyncStatusState {
  /** Account emails that need reconnection */
  expiredAccounts: Set<string>;
  /** Mark an account as needing reconnection */
  markExpired: (email: string) => void;
  /** Clear the expired flag after successful reconnect */
  clearExpired: (email: string) => void;
  /** Check if a specific account needs reconnection */
  isExpired: (email: string) => boolean;
}

export const useSyncStatusStore = create<SyncStatusState>()((set, get) => ({
  expiredAccounts: new Set(),
  markExpired: (email) =>
    set((state) => {
      const next = new Set(state.expiredAccounts);
      next.add(email);
      return { expiredAccounts: next };
    }),
  clearExpired: (email) =>
    set((state) => {
      const next = new Set(state.expiredAccounts);
      next.delete(email);
      return { expiredAccounts: next };
    }),
  isExpired: (email) => get().expiredAccounts.has(email),
}));
