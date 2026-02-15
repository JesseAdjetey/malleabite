// Mally TTS Service — Google Cloud Text-to-Speech with Web Speech fallback
import { auth } from '@/integrations/firebase/config';

const TTS_FUNCTION_URL = 'https://us-central1-malleabite-97d35.cloudfunctions.net/synthesizeSpeech';

// Premium voice list for Web Speech fallback (ranked by quality)
const FALLBACK_VOICES = [
  'Google US English', 'Google UK English Female',
  'Microsoft Aria Online (Natural)', 'Microsoft Jenny Online (Natural)',
  'Samantha', 'Karen', 'Moira', 'Tessa',
];

interface TTSOptions {
  text: string;
  voiceName?: string;
  languageCode?: string;
}

class MallyTTSService {
  private cache = new Map<string, string>(); // text hash → blob URL
  private currentAudio: HTMLAudioElement | null = null;
  private _isSpeaking = false;
  private _onSpeakingChange: ((speaking: boolean) => void) | null = null;

  get isSpeaking() {
    return this._isSpeaking;
  }

  /** Register a callback for speaking state changes */
  onSpeakingChange(cb: (speaking: boolean) => void) {
    this._onSpeakingChange = cb;
  }

  private setSpeaking(value: boolean) {
    this._isSpeaking = value;
    this._onSpeakingChange?.(value);
  }

  /** Speak text using Google Cloud TTS, with Web Speech fallback */
  async speak(options: TTSOptions): Promise<void> {
    const { text } = options;
    if (!text?.trim()) return;

    // Try Google Cloud TTS first
    try {
      await this.speakCloud(options);
    } catch (error) {
      console.warn('[MallyTTS] Cloud TTS failed, falling back to Web Speech:', error);
      this.speakFallback(text);
    }
  }

  /** Google Cloud TTS via Firebase Function */
  private async speakCloud(options: TTSOptions): Promise<void> {
    const cacheKey = `${options.text.substring(0, 100)}-${options.voiceName || 'default'}`;

    let audioUrl = this.cache.get(cacheKey);
    if (!audioUrl) {
      const token = await auth.currentUser?.getIdToken(true);
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(TTS_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          data: {
            text: options.text,
            voiceName: options.voiceName,
            languageCode: options.languageCode,
          },
        }),
      });

      if (!response.ok) throw new Error(`TTS API returned ${response.status}`);

      const data = await response.json();
      if (!data.result?.audioContent) throw new Error('No audio content');

      // Convert base64 to blob URL
      const byteChars = atob(data.result.audioContent);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: 'audio/mp3' });
      audioUrl = URL.createObjectURL(blob);
      this.cache.set(cacheKey, audioUrl);
    }

    // Stop any current playback
    this.stop();

    // Play audio
    return new Promise<void>((resolve, reject) => {
      this.currentAudio = new Audio(audioUrl);
      this.setSpeaking(true);

      this.currentAudio.onended = () => {
        this.setSpeaking(false);
        this.currentAudio = null;
        resolve();
      };
      this.currentAudio.onerror = (e) => {
        this.setSpeaking(false);
        this.currentAudio = null;
        reject(e);
      };

      this.currentAudio.play().catch((e) => {
        this.setSpeaking(false);
        reject(e);
      });
    });
  }

  /** Web Speech Synthesis fallback */
  speakFallback(text: string): void {
    if (!('speechSynthesis' in window)) return;

    // Clean text for speech
    const cleanText = text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_~`#]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .trim();

    if (!cleanText) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.95;
    utterance.pitch = 1.05;

    // Try to find a premium voice
    const voices = window.speechSynthesis.getVoices();
    for (const name of FALLBACK_VOICES) {
      const found = voices.find(v => v.name.includes(name));
      if (found) {
        utterance.voice = found;
        break;
      }
    }

    this.setSpeaking(true);
    utterance.onend = () => this.setSpeaking(false);
    utterance.onerror = () => this.setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }

  /** Stop current playback */
  stop(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.setSpeaking(false);
  }

  /** Clear cached audio */
  clearCache(): void {
    for (const url of this.cache.values()) {
      URL.revokeObjectURL(url);
    }
    this.cache.clear();
  }
}

export const mallyTTS = new MallyTTSService();
