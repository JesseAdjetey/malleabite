// Platform-aware speech recognition service
// Uses native Capacitor plugin on iOS/Android, Web Speech API on browser
import { isNative } from '@/lib/platform';

interface SpeechResult {
  transcript: string;
  isFinal: boolean;
  confidence?: number;
}

type OnResultCallback = (result: SpeechResult) => void;
type OnErrorCallback = (error: string) => void;

class SpeechRecognitionService {
  private webRecognition: any = null;
  private nativeListenerRegistered = false;
  private _stopped = false; // Flag to prevent onend auto-restart after explicit stop
  private _listening = false; // Track whether we're actively listening

  /** Whether speech recognition is currently active */
  get isListening(): boolean { return this._listening; }

  /** Check if speech recognition is available on this platform */
  async isAvailable(): Promise<boolean> {
    if (isNative) {
      try {
        const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
        const { available } = await SpeechRecognition.available();
        return available;
      } catch {
        return false;
      }
    }
    return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
  }

  /** Request microphone/speech permission */
  async requestPermission(): Promise<boolean> {
    if (isNative) {
      try {
        const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
        const perms = await SpeechRecognition.requestPermissions();
        return perms.speechRecognition === 'granted';
      } catch {
        return false;
      }
    }
    // Web handles permission via the browser prompt when starting recognition
    return true;
  }

  /** Ensure previous recognition instance is fully stopped and mic is released.
   *  Returns a promise that resolves after a sufficient delay for mic release. */
  async ensureStopped(releaseDelayMs = 150): Promise<void> {
    this._stopped = true;
    this._listening = false;

    // Cancel any speechSynthesis that might conflict with the mic
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }

    if (isNative) {
      try {
        const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
        SpeechRecognition.removeAllListeners();
        this.nativeListenerRegistered = false;
        await SpeechRecognition.stop().catch(() => {});
      } catch {}
    } else if (this.webRecognition) {
      try { this.webRecognition.abort(); } catch {}
      this.webRecognition = null;
    }

    // Wait for mic to be fully released — browsers need time to release the audio device
    if (releaseDelayMs > 0) {
      await new Promise(r => setTimeout(r, releaseDelayMs));
    }
  }

  /** Start listening for speech input */
  async startListening(
    onResult: OnResultCallback,
    onError: OnErrorCallback,
    options?: { continuous?: boolean; language?: string }
  ): Promise<void> {
    // Ensure any previous instance is fully cleaned up
    this._stopped = false;
    if (this.webRecognition) {
      try { this.webRecognition.abort(); } catch {}
      this.webRecognition = null;
      // Small delay to ensure clean mic release before re-acquiring
      await new Promise(r => setTimeout(r, 80));
    }
    this._listening = true;
    if (isNative) {
      await this.startNativeListening(onResult, onError, options);
    } else {
      this.startWebListening(onResult, onError, options);
    }
  }

  /** Start listening with automatic retry on transient failures.
   *  Retries up to `maxRetries` times with exponential backoff. */
  async startListeningWithRetry(
    onResult: OnResultCallback,
    onError: OnErrorCallback,
    options?: { continuous?: boolean; language?: string; maxRetries?: number }
  ): Promise<void> {
    const maxRetries = options?.maxRetries ?? 3;
    let attempt = 0;

    const tryStart = async (): Promise<void> => {
      try {
        await this.startListening(onResult, (err) => {
          // Transient errors that should be retried
          const isTransient = err === 'aborted' || err === 'network' || err === 'audio-capture';
          if (isTransient && attempt < maxRetries && !this._stopped) {
            attempt++;
            const backoff = Math.min(200 * Math.pow(2, attempt - 1), 2000);
            console.warn(`[SpeechRecognition] Transient error "${err}", retry ${attempt}/${maxRetries} in ${backoff}ms`);
            setTimeout(() => tryStart(), backoff);
          } else {
            onError(err);
          }
        }, options);
      } catch (e: any) {
        if (attempt < maxRetries && !this._stopped) {
          attempt++;
          const backoff = Math.min(200 * Math.pow(2, attempt - 1), 2000);
          setTimeout(() => tryStart(), backoff);
        } else {
          onError(e?.message || 'Speech recognition failed');
        }
      }
    };

    await tryStart();
  }

  /** Stop listening and return final transcript (native only) */
  async stopListening(): Promise<string | null> {
    this._stopped = true;
    this._listening = false;
    if (isNative) {
      try {
        const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');
        SpeechRecognition.removeAllListeners();
        this.nativeListenerRegistered = false;
        const result = await SpeechRecognition.stop();
        return (result as any)?.matches?.[0] ?? null;
      } catch {
        return null;
      }
    } else {
      if (this.webRecognition) {
        try { this.webRecognition.abort(); } catch {}
        this.webRecognition = null;
      }
      return null; // Web fires onresult callback instead
    }
  }

  // ── Native (Capacitor) ──────────────────────────────────────────────────

  private async startNativeListening(
    onResult: OnResultCallback,
    onError: OnErrorCallback,
    options?: { continuous?: boolean; language?: string }
  ): Promise<void> {
    try {
      const { SpeechRecognition } = await import('@capacitor-community/speech-recognition');

      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        this._listening = false;
        onError('Permission denied');
        return;
      }

      // Remove old listeners if any
      if (this.nativeListenerRegistered) {
        SpeechRecognition.removeAllListeners();
      }

      // Listen for partial results
      SpeechRecognition.addListener('partialResults', (data: any) => {
        if (data.matches && data.matches.length > 0) {
          onResult({ transcript: data.matches[0], isFinal: false });
        }
      });
      this.nativeListenerRegistered = true;

      await SpeechRecognition.start({
        language: options?.language || 'en-US',
        partialResults: true,
        popup: false, // No native popup — we show our own UI
      });
    } catch (error: any) {
      this._listening = false;
      onError(error?.message || 'Native speech recognition failed');
    }
  }

  // ── Web (Speech API) ────────────────────────────────────────────────────

  private startWebListening(
    onResult: OnResultCallback,
    onError: OnErrorCallback,
    options?: { continuous?: boolean; language?: string }
  ): void {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      this._listening = false;
      onError('Speech recognition not supported');
      return;
    }

    this.webRecognition = new SR();
    this.webRecognition.continuous = options?.continuous ?? false;
    this.webRecognition.interimResults = true;
    this.webRecognition.lang = options?.language || 'en-US';
    // More alternatives = better chance of catching quiet/accented speech
    this.webRecognition.maxAlternatives = 5;

    this.webRecognition.onresult = (event: any) => {
      const last = event.results[event.results.length - 1];
      // Pick the alternative with the highest confidence (index 0 is already best,
      // but fall back if confidence is very low)
      let bestTranscript = last[0].transcript;
      let bestConfidence = last[0].confidence ?? 1;
      for (let i = 1; i < last.length; i++) {
        if ((last[i].confidence ?? 0) > bestConfidence) {
          bestTranscript = last[i].transcript;
          bestConfidence = last[i].confidence;
        }
      }
      onResult({
        transcript: bestTranscript,
        isFinal: last.isFinal,
        confidence: bestConfidence,
      });
    };

    this.webRecognition.onerror = (event: any) => {
      const err = event.error || 'Recognition error';
      this._listening = false;
      onError(err);
    };

    this.webRecognition.onend = () => {
      // If continuous mode and not explicitly stopped, auto-restart
      if (options?.continuous && this.webRecognition && !this._stopped) {
        try {
          this.webRecognition.start();
        } catch {
          // Already started or destroyed — flag as not listening
          this._listening = false;
        }
      } else {
        this._listening = false;
      }
    };

    try {
      this.webRecognition.start();
    } catch (e: any) {
      this._listening = false;
      onError(e?.message || 'Failed to start speech recognition');
    }
  }

  /** Start continuous listening for wake word detection */
  async startContinuousListening(
    onTranscript: (transcript: string) => void,
    onError: OnErrorCallback
  ): Promise<void> {
    await this.startListening(
      (result) => {
        onTranscript(result.transcript);
      },
      onError,
      { continuous: true }
    );
  }
}

export const speechService = new SpeechRecognitionService();
