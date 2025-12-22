// Wake word detection hook for "Hey Mally" voice activation
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface UseWakeWordOptions {
  onWakeWordDetected: () => void;
  enabled?: boolean;
  wakeWords?: string[];
}

interface UseWakeWordReturn {
  isListening: boolean;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  toggleListening: () => void;
  lastHeard: string | null;
  error: string | null;
}

// Wake word variations to detect (multi-language support)
const DEFAULT_WAKE_WORDS = [
  // English
  'hey mally',
  'hey mali',
  'hey molly',
  'hey malley',
  'hi mally',
  'hi mali',
  'okay mally',
  'ok mally',
  'hey money', // Common misheard
  'hey melly',
  'mally',
  'mali',
  // Spanish
  'hola mally',
  'oye mally',
  'ey mally',
  // French
  'salut mally',
  'hé mally',
  // German
  'hallo mally',
  'hey malli',
  // Portuguese
  'oi mally',
  'olá mally',
  // Italian
  'ciao mally',
  'ehi mally',
  // Japanese (romanized)
  'ne mally',
  // Korean (romanized)
  'ya mally',
  // Chinese (romanized)
  'wei mally',
  // Hindi (romanized)
  'are mally',
  // Arabic (romanized)
  'ya mally',
];

export function useWakeWord({
  onWakeWordDetected,
  enabled = true,
  wakeWords = DEFAULT_WAKE_WORDS,
}: UseWakeWordOptions): UseWakeWordReturn {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [lastHeard, setLastHeard] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);
  const restartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownRef = useRef(false);

  // Check if Web Speech API is supported
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || 
                              (window as any).webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
    
    if (!SpeechRecognition) {
      logger.warn('WakeWord', 'Speech recognition not supported in this browser');
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Ignore errors on cleanup
        }
      }
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
    };
  }, []);

  // Check if transcript contains wake word
  const containsWakeWord = useCallback((transcript: string): boolean => {
    const normalized = transcript.toLowerCase().trim();
    return wakeWords.some(word => normalized.includes(word.toLowerCase()));
  }, [wakeWords]);

  // Start continuous listening for wake word
  const startListening = useCallback(() => {
    if (!isSupported || isListeningRef.current) return;

    const SpeechRecognition = (window as any).SpeechRecognition || 
                              (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('Speech recognition not supported');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      
      // Configure for continuous wake word detection
      recognition.continuous = true;
      recognition.interimResults = true;
      // Use browser's language or default to English for wake word detection
      recognition.lang = navigator.language || 'en-US';
      recognition.maxAlternatives = 3;

      recognition.onstart = () => {
        // Only log on initial start, not restarts (to reduce log spam)
        if (!isListeningRef.current) {
          logger.info('WakeWord', 'Wake word detection started');
        }
        setIsListening(true);
        isListeningRef.current = true;
        setError(null);
      };

      recognition.onresult = (event: any) => {
        // Check all results for wake word
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          
          // Check all alternatives
          for (let j = 0; j < result.length; j++) {
            const transcript = result[j].transcript;
            setLastHeard(transcript);
            
            if (containsWakeWord(transcript) && !cooldownRef.current) {
              logger.info('WakeWord', 'Wake word detected!', { transcript });
              
              // Set cooldown to prevent multiple triggers
              cooldownRef.current = true;
              setTimeout(() => {
                cooldownRef.current = false;
              }, 3000); // 3 second cooldown
              
              // Play activation sound
              playActivationSound();
              
              // Trigger callback
              onWakeWordDetected();
              
              // Brief pause before resuming
              try {
                recognition.stop();
              } catch (e) {
                // Ignore
              }
              
              // Restart after a delay
              restartTimeoutRef.current = setTimeout(() => {
                if (isListeningRef.current && enabled) {
                  startListening();
                }
              }, 2000);
              
              return;
            }
          }
        }
      };

      recognition.onerror = (event: any) => {
        // Handle common errors gracefully
        if (event.error === 'no-speech') {
          // This is normal, just restart
          return;
        }
        
        if (event.error === 'aborted') {
          // User or system stopped, don't log as error
          return;
        }
        
        if (event.error === 'not-allowed') {
          setError('Microphone access denied. Please allow microphone access for "Hey Mally" to work.');
          logger.warn('WakeWord', 'Microphone access denied');
          setIsListening(false);
          isListeningRef.current = false;
          return;
        }
        
        logger.warn('WakeWord', 'Recognition error', { error: event.error });
      };

      recognition.onend = () => {
        // Auto-restart if still supposed to be listening
        if (isListeningRef.current && enabled) {
          restartTimeoutRef.current = setTimeout(() => {
            if (isListeningRef.current) {
              try {
                recognition.start();
              } catch (e) {
                // If start fails, try creating new instance
                startListening();
              }
            }
          }, 100);
        } else {
          setIsListening(false);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      
    } catch (err) {
      logger.error('WakeWord', 'Failed to start wake word detection', err as Error);
      setError('Failed to start voice detection');
      setIsListening(false);
      isListeningRef.current = false;
    }
  }, [isSupported, containsWakeWord, onWakeWordDetected, enabled]);

  // Stop listening
  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);
    
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Ignore errors when stopping
      }
      recognitionRef.current = null;
    }
    
    logger.info('WakeWord', 'Wake word detection stopped');
  }, []);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (isListeningRef.current) {
      stopListening();
    } else {
      startListening();
    }
  }, [startListening, stopListening]);

  return {
    isListening,
    isSupported,
    startListening,
    stopListening,
    toggleListening,
    lastHeard,
    error,
  };
}

// Play a subtle activation sound
function playActivationSound() {
  try {
    // Create a simple beep using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800; // Hz
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
    
    // Second beep (higher pitch)
    setTimeout(() => {
      const osc2 = audioContext.createOscillator();
      const gain2 = audioContext.createGain();
      
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      
      osc2.frequency.value = 1200; // Hz
      osc2.type = 'sine';
      
      gain2.gain.setValueAtTime(0.3, audioContext.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      
      osc2.start(audioContext.currentTime);
      osc2.stop(audioContext.currentTime + 0.15);
    }, 150);
    
  } catch (e) {
    // Audio not supported, use vibration on mobile
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  }
}

export default useWakeWord;
