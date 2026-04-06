import React, { createContext, useContext } from 'react';

interface SidebarBounds {
  top: number;
  left: number;
  width: number;
  height: number;
}

const SidebarBoundsContext = createContext<SidebarBounds | null>(null);

export const SidebarBoundsProvider = SidebarBoundsContext.Provider;

export function useSidebarBounds(): SidebarBounds | null {
  return useContext(SidebarBoundsContext);
}
