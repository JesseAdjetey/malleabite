// Context that exposes Google Calendar write-back functions globally.
// The bridge hook is mounted once in EventDataProvider; this context
// makes pushCreate/Update/Delete available to any component that saves events.

import React, { createContext, useContext } from 'react';
import { useGoogleSyncBridge } from '@/hooks/use-google-sync-bridge';
import { CalendarEventType } from '@/lib/stores/types';

export interface GoogleSyncBridgeContextValue {
  /** Push a newly created event to Google Calendar. Returns the Google event ID. */
  pushCreateToGoogle: (event: CalendarEventType) => Promise<string | null>;
  /** Push an updated event to Google Calendar. */
  pushUpdateToGoogle: (event: CalendarEventType) => Promise<boolean>;
  /** Push a delete to Google Calendar. */
  pushDeleteToGoogle: (event: CalendarEventType) => Promise<boolean>;
  /** Reconnect a Google account whose token expired. Opens sign-in popup. */
  reconnectAccount: (accountEmail: string) => Promise<boolean>;
}

const GoogleSyncBridgeContext = createContext<GoogleSyncBridgeContextValue | null>(null);

export const GoogleSyncBridgeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const bridge = useGoogleSyncBridge();
  return (
    <GoogleSyncBridgeContext.Provider value={bridge}>
      {children}
    </GoogleSyncBridgeContext.Provider>
  );
};

/**
 * Access the Google sync bridge from any component.
 * Returns null if the provider hasn't been mounted yet (safe to check).
 */
export function useGoogleSyncBridgeContext(): GoogleSyncBridgeContextValue | null {
  return useContext(GoogleSyncBridgeContext);
}
