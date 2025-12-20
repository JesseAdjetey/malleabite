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
  enableWakeWord: () => void;
  disableWakeWord: () => void;
  toggleWakeWord: () => void;
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

interface HeyMallyProviderProps {
  children: React.ReactNode;
}

export function HeyMallyProvider({ children }: HeyMallyProviderProps) {
  const [isWakeWordEnabled, setIsWakeWordEnabled] = useState(() => {
    // Load preference from localStorage
    const saved = localStorage.getItem('heyMallyEnabled');
    return saved === 'true';
  });
  const [isMallyOpen, setIsMallyOpen] = useState(false);
  const { user } = useAuth();

  // Handle wake word detection
  const handleWakeWordDetected = useCallback(() => {
    if (!user) {
      toast.info("Please sign in to use Hey Mally");
      return;
    }
    
    toast.success("Hey Mally activated!", {
      icon: <Volume2 className="h-4 w-4 text-primary" />,
      duration: 2000,
    });
    
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

  // Start/stop listening based on enabled state
  useEffect(() => {
    if (isWakeWordEnabled && user && isSupported) {
      startListening();
    } else {
      stopListening();
    }
  }, [isWakeWordEnabled, user, isSupported, startListening, stopListening]);

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
    enableWakeWord,
    disableWakeWord,
    toggleWakeWord,
    openMally,
    closeMally,
    error,
  };

  return (
    <HeyMallyContext.Provider value={value}>
      {children}
      
      {/* Listening indicator - shows when wake word detection is active */}
      {isListening && isWakeWordEnabled && (
        <div className="fixed bottom-20 left-4 z-50 flex items-center gap-2 px-3 py-2 bg-primary/20 backdrop-blur-sm rounded-full border border-primary/30 animate-pulse">
          <div className="relative">
            <Mic className="h-4 w-4 text-primary" />
            <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full" />
          </div>
          <span className="text-xs text-primary font-medium">Hey Mally</span>
        </div>
      )}
    </HeyMallyContext.Provider>
  );
}

export default HeyMallyProvider;
