import React, { createContext, useContext } from 'react';
import { SizeLevel } from '@/lib/stores/types';

interface ModuleSizeContextValue {
  sizeLevel: SizeLevel;
  onSizeChange?: (level: SizeLevel) => void;
}

const ModuleSizeContext = createContext<ModuleSizeContextValue>({ sizeLevel: 1 });

export const ModuleSizeProvider = ModuleSizeContext.Provider;

export function useModuleSize(): ModuleSizeContextValue {
  return useContext(ModuleSizeContext);
}
