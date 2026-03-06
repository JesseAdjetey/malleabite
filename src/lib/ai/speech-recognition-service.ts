// Platform-aware speech recognition service
// Uses native Capacitor plugin on iOS/Android, Web Speech API on browser
import { isNative } from '@/lib/platform';

interface SpeechResult {
  transcript: string;
  isFinal: boolean;
}

type OnResultCallback = (result: SpeechResult) => void;
type OnErrorCallback = (error: string) => void;

class SpeechRecognitionService {
  private webRecognition: any = null;
  private nativeListenerRegistered = false;
  private _stopped = false; // Flag to prevent onend auto-restart after explicit stop

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
    }
    if (isNative) {
      await this.startNativeListening(onResult, onError, options);
    } else {
      this.startWebListening(onResult, onError, options);
    }
  }

  /** Stop listening and return final transcript (native only) */
  async stopListening(): Promise<string | null> {
    this._stopped = true;
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
      });
    };

    this.webRecognition.onerror = (event: any) => {
      const err = event.error || 'Recognition error';
      // 'aborted' means .abort() was called explicitly — not an error to retry
      onError(err);
    };

    this.webRecognition.onend = () => {
      // If continuous mode and not explicitly stopped, auto-restart
      if (options?.continuous && this.webRecognition && !this._stopped) {
        try {
          this.webRecognition.start();
        } catch {
          // Already started or destroyed
        }
      }
    };

    this.webRecognition.start();
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
