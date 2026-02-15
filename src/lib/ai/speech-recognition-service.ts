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
    if (isNative) {
      await this.startNativeListening(onResult, onError, options);
    } else {
      this.startWebListening(onResult, onError, options);
    }
  }

  /** Stop listening and return final transcript (native only) */
  async stopListening(): Promise<string | null> {
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
        this.webRecognition.stop();
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

    this.webRecognition.onresult = (event: any) => {
      const last = event.results[event.results.length - 1];
      onResult({
        transcript: last[0].transcript,
        isFinal: last.isFinal,
      });
    };

    this.webRecognition.onerror = (event: any) => {
      onError(event.error || 'Recognition error');
    };

    this.webRecognition.onend = () => {
      // If continuous mode, auto-restart
      if (options?.continuous && this.webRecognition) {
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
