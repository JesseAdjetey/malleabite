// Wake word detection hook for "Hey Mally" voice activation
import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { isNative } from '@/lib/platform';
import { speechService } from '@/lib/ai/speech-recognition-service';
import { porcupineService } from '@/lib/ai/porcupine-service';
import { unlockAudioContext } from '@/lib/ai/tts-service';

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
  // Tracks whether Porcupine (vs Web Speech) is the active engine this session
  const usingPorcupineRef = useRef(false);

  // Check if speech recognition is supported (native or web)
  useEffect(() => {
    const checkSupport = async () => {
      if (isNative) {
        const available = await speechService.isAvailable();
        setIsSupported(available);
        if (!available) logger.warn('WakeWord', 'Native speech recognition not available');
      } else {
        const SpeechRecognition = (window as any).SpeechRecognition ||
                                  (window as any).webkitSpeechRecognition;
        setIsSupported(!!SpeechRecognition);
        if (!SpeechRecognition) logger.warn('WakeWord', 'Speech recognition not supported in this browser');
      }
    };
    checkSupport();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (usingPorcupineRef.current) {
        porcupineService.stop();
      } else if (recognitionRef.current) {
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

  // Check if transcript contains wake word (with fuzzy phonetic matching)
  const containsWakeWord = useCallback((transcript: string): boolean => {
    const normalized = transcript.toLowerCase().trim()
      // Normalize common speech-to-text mishearings of "Mally"
      .replace(/\bm[ao]ll?[eiy]+\b/g, 'mally')
      .replace(/\bm[ao]l[eiy]+\b/g,   'mally')
      .replace(/\bm[ao]le\b/g,        'mally')
      .replace(/\bmol+y\b/g,          'mally')
      .replace(/\b(hey|hi|ok|okay|ey|hé|hel+o)\b\s+m[ao]l/g, 'hey mally');
    return wakeWords.some(word => normalized.includes(word.toLowerCase()));
  }, [wakeWords]);

  // Handle wake word match from any transcript source
  const handleTranscript = useCallback((transcript: string) => {
    setLastHeard(transcript);

    if (containsWakeWord(transcript) && !cooldownRef.current) {
      logger.info('WakeWord', 'Wake word detected!', { transcript });

      cooldownRef.current = true;
      setTimeout(() => { cooldownRef.current = false; }, 3000);

      playActivationSound();
      onWakeWordDetected();

      // Brief pause then restart
      if (isNative) {
        speechService.stopListening();
        restartTimeoutRef.current = setTimeout(() => {
          if (isListeningRef.current && enabled) startListening();
        }, 2000);
      }
    }
  }, [containsWakeWord, onWakeWordDetected, enabled]);

  // Start continuous listening for wake word
  const startListening = useCallback(() => {
    if (!isSupported || isListeningRef.current) return;

    // ── Inner helper: Web Speech API path ─────────────────────────────────
    // Extracted so both the normal code path and the Porcupine fallback can
    // call it without duplicating logic.
    const _startWebSpeech = () => {
      const SpeechRecognition = (window as any).SpeechRecognition ||
                                (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        setError('Speech recognition not supported');
        return;
      }

      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = navigator.language || 'en-US';
        recognition.maxAlternatives = 5; // More alternatives = catches quiet/accented speech better

        recognition.onstart = () => {
          if (!isListeningRef.current) {
            logger.info('WakeWord', 'Wake word detection started (Web Speech API)');
          }
          setIsListening(true);
          isListeningRef.current = true;
          setError(null);
        };

        recognition.onresult = (event: any) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            for (let j = 0; j < result.length; j++) {
              const transcript = result[j].transcript;
              handleTranscript(transcript);

              if (cooldownRef.current) {
                // Wake word was just detected — abort immediately so the
                // overlay can take the mic. Do NOT use .stop() (graceful)
                // because onend would auto-restart before the overlay gets a chance.
                isListeningRef.current = false;
                try { recognition.abort(); } catch {}
                recognitionRef.current = null;
                return;
              }
            }
          }
        };

        recognition.onerror = (event: any) => {
          if (event.error === 'no-speech' || event.error === 'aborted') return;
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
          if (isListeningRef.current && enabled) {
            restartTimeoutRef.current = setTimeout(() => {
              if (isListeningRef.current) {
                // Re-enter startListening so Porcupine can take over if configured
                try { recognition.start(); } catch { startListening(); }
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
    };

    // ── Porcupine: on-device, no network needed ────────────────────────────
    // Preferred over Web Speech on browsers when configured. Falls through
    // to Web Speech automatically if Porcupine fails or isn't configured.
    if (!isNative && porcupineService.isConfigured()) {
      isListeningRef.current = true;
      setIsListening(true);
      setError(null);
      usingPorcupineRef.current = true;

      porcupineService.start(() => {
        // Porcupine detection callback — same flow as Web Speech path
        if (cooldownRef.current) return;
        cooldownRef.current = true;
        setTimeout(() => { cooldownRef.current = false; }, 3_000);

        logger.info('WakeWord', 'Porcupine wake word detected!');
        playActivationSound();
        onWakeWordDetected();

        // Release mic so the overlay can acquire it
        porcupineService.stop();
        isListeningRef.current = false;
        usingPorcupineRef.current = false;
        setIsListening(false);

        // Restart Porcupine after the overlay is done (1s grace period)
        restartTimeoutRef.current = setTimeout(() => {
          if (enabled) startListening();
        }, 1_000);
      }).then((ok) => {
        if (!ok) {
          // Porcupine failed (e.g. bad access key) — fall back silently to Web Speech
          logger.warn('WakeWord', 'Porcupine init failed — falling back to Web Speech API');
          usingPorcupineRef.current = false;
          isListeningRef.current = false;
          setIsListening(false);
          _startWebSpeech();
        }
      });
      return;
    }

    // ── Native: Capacitor speech recognition ──────────────────────────────
    if (isNative) {
      isListeningRef.current = true;
      setIsListening(true);
      setError(null);
      logger.info('WakeWord', 'Native wake word detection started');

      speechService.startContinuousListening(
        (transcript) => handleTranscript(transcript),
        (error) => {
          if (error === 'not-allowed' || error === 'Permission denied') {
            setError('Microphone access denied.');
            setIsListening(false);
            isListeningRef.current = false;
            return;
          }
          // Auto-restart on transient errors
          if (isListeningRef.current && enabled) {
            restartTimeoutRef.current = setTimeout(() => {
              if (isListeningRef.current) startListening();
            }, 1000);
          }
        }
      );
      return;
    }

    // ── Web Speech API fallback (Porcupine not configured) ─────────────────
    _startWebSpeech();
  }, [isSupported, handleTranscript, enabled]);

  // Stop listening - returns a promise that resolves when fully stopped
  const stopListening = useCallback(() => {
    isListeningRef.current = false;
    setIsListening(false);

    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
      restartTimeoutRef.current = null;
    }

    if (usingPorcupineRef.current) {
      porcupineService.stop();
      usingPorcupineRef.current = false;
    } else if (isNative) {
      speechService.stopListening();
    } else if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
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
// Track whether the user has made a gesture (click/tap/key) so we know
// whether AudioContext / navigator.vibrate are allowed.
let _hasUserGesture = false;
let _sharedAudioCtx: AudioContext | null = null;

if (typeof window !== 'undefined') {
  const markGesture = () => {
    _hasUserGesture = true;
    // Unlock the TTS AudioContext (shared singleton) while we have a gesture
    unlockAudioContext();
    // Create & resume the local AudioContext for activation sounds
    try {
      if (!_sharedAudioCtx) {
        _sharedAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (_sharedAudioCtx.state === 'suspended') {
        _sharedAudioCtx.resume().catch(() => {});
      }
    } catch { /* ok */ }
    window.removeEventListener('click', markGesture, true);
    window.removeEventListener('touchstart', markGesture, true);
    window.removeEventListener('keydown', markGesture, true);
  };
  window.addEventListener('click', markGesture, true);
  window.addEventListener('touchstart', markGesture, true);
  window.addEventListener('keydown', markGesture, true);
}

/**
 * Play a subtle two-tone beep when the wake word is detected.
 * If the browser hasn't received a user gesture yet (which is the normal
 * case — "Hey Mally" fires from continuous speech recognition, not a tap),
 * we silently skip the sound. No AudioContext warnings, no vibrate warnings.
 */
function playActivationSound() {
  // No user gesture yet → nothing we can do, just skip silently
  if (!_hasUserGesture || !_sharedAudioCtx || _sharedAudioCtx.state === 'suspended') {
    return;
  }

  try {
    const ctx = _sharedAudioCtx;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.2);

    // Second beep (higher pitch)
    setTimeout(() => {
      try {
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.value = 1200;
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0.3, ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc2.start(ctx.currentTime);
        osc2.stop(ctx.currentTime + 0.15);
      } catch { /* ignore */ }
    }, 150);
  } catch {
    // Silently ignore — no sound is fine
  }
}

export default useWakeWord;
