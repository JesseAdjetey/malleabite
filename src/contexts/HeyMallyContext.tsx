// Global "Hey Mally" wake word provider
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useWakeWord } from '@/hooks/use-wake-word';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { toast } from 'sonner';
import { Mic, MicOff, Volume2 } from 'lucide-react';

interface HeyMallyContextType {
  isWakeWordEnabled: boolean;
  isListening: boolean;
  isSupported: boolean;
  isMallyOpen: boolean;
  isPaused: boolean;
  enableWakeWord: () => void;
  disableWakeWord: () => void;
  toggleWakeWord: () => void;
  pauseWakeWord: () => void;
  resumeWakeWord: () => void;
  openMally: () => void;
  closeMally: () => void;
  error: string | null;
}

const HeyMallyContext = createContext<HeyMallyContextType | null>(null);

export function useHeyMally() {
  const context = useContext(HeyMallyContext);
  if (!context) {
    throw new Error('useHeyMally must be used within HeyMallyProvider');
  }
  return context;
}

// Safe version that returns no-op functions if not in provider
export function useHeyMallySafe() {
  const context = useContext(HeyMallyContext);
  if (!context) {
    return {
      isWakeWordEnabled: false,
      isListening: false,
      isSupported: false,
      isMallyOpen: false,
      isPaused: false,
      enableWakeWord: () => {},
      disableWakeWord: () => {},
      toggleWakeWord: () => {},
      pauseWakeWord: () => {},
      resumeWakeWord: () => {},
      openMally: () => {},
      closeMally: () => {},
      error: null,
    };
  }
  return context;
}

interface HeyMallyProviderProps {
  children: React.ReactNode;
}

export function HeyMallyProvider({ children }: HeyMallyProviderProps) {
  const [isWakeWordEnabled, setIsWakeWordEnabled] = useState(() => {
    // Load preference from localStorage, default to ON (like Siri/Google Assistant)
    const saved = localStorage.getItem('heyMallyEnabled');
    if (saved !== null) return saved === 'true';
    // Default to enabled — voice-first mobile experience
    return true;
  });
  const [isMallyOpen, setIsMallyOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const { user } = useAuth();

  // Handle wake word detection
  const handleWakeWordDetected = useCallback(() => {
    if (!user) {
      toast.info("Please sign in to use Hey Mally");
      return;
    }
    
    setIsMallyOpen(true);
    
    // Dispatch custom event for Mally AI component to handle
    window.dispatchEvent(new CustomEvent('heyMallyActivated', {
      detail: { timestamp: Date.now() }
    }));
  }, [user]);

  const {
    isListening,
    isSupported,
    startListening,
    stopListening,
    error,
  } = useWakeWord({
    onWakeWordDetected: handleWakeWordDetected,
    enabled: isWakeWordEnabled && !!user,
  });

  // Start/stop listening based on enabled state and paused state
  useEffect(() => {
    if (isWakeWordEnabled && user && isSupported && !isPaused) {
      startListening();
    } else {
      stopListening();
    }
  }, [isWakeWordEnabled, user, isSupported, isPaused, startListening, stopListening]);

  // Save preference to localStorage
  useEffect(() => {
    localStorage.setItem('heyMallyEnabled', String(isWakeWordEnabled));
  }, [isWakeWordEnabled]);

  const enableWakeWord = useCallback(() => {
    if (!isSupported) {
      toast.error("Voice activation is not supported in this browser. Please use Chrome or Edge.");
      return;
    }
    
    setIsWakeWordEnabled(true);
    toast.success("Hey Mally enabled! Say 'Hey Mally' to activate.", {
      icon: <Mic className="h-4 w-4 text-green-500" />,
      duration: 4000,
    });
  }, [isSupported]);

  const disableWakeWord = useCallback(() => {
    setIsWakeWordEnabled(false);
    toast.info("Hey Mally disabled", {
      icon: <MicOff className="h-4 w-4" />,
    });
  }, []);

  const toggleWakeWord = useCallback(() => {
    if (isWakeWordEnabled) {
      disableWakeWord();
    } else {
      enableWakeWord();
    }
  }, [isWakeWordEnabled, enableWakeWord, disableWakeWord]);

  // Pause wake word detection temporarily (when MallyAI is recording)
  // MUST call stopListening synchronously so the mic is released immediately,
  // not deferred to the React effect cycle.
  const pauseWakeWord = useCallback(() => {
    stopListening();   // Immediately abort the recognition & release mic
    setIsPaused(true); // Prevent the effect from restarting it
  }, [stopListening]);

  // Resume wake word detection
  const resumeWakeWord = useCallback(() => {
    setIsPaused(false);
  }, []);

  const openMally = useCallback(() => {
    setIsMallyOpen(true);
  }, []);

  const closeMally = useCallback(() => {
    setIsMallyOpen(false);
  }, []);

  const value: HeyMallyContextType = {
    isWakeWordEnabled,
    isListening,
    isSupported,
    isMallyOpen,
    isPaused,
    enableWakeWord,
    disableWakeWord,
    toggleWakeWord,
    pauseWakeWord,
    resumeWakeWord,
    openMally,
    closeMally,
    error,
  };

  return (
    <HeyMallyContext.Provider value={value}>
      {children}
      
    </HeyMallyContext.Provider>
  );
}

export default HeyMallyProvider;
