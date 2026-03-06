// Mally TTS Service — Google Cloud Text-to-Speech, sentence-pipelined with AudioContext playback
// Architecture:
//   1. speak()           — single utterance
//   2. speakPipelined()  — full response: splits sentences, parallel-fetches TTS for all,
//                          plays sequentially (each sentence starts as soon as its audio arrives)
//   3. enqueueChunk()    — streaming mode: call as AI text chunks stream in; sentences are
//                          dispatched to playback the moment a sentence boundary is detected
//   4. warmCommonPhrases() — pre-caches ACK phrases so they play in <300ms
import { auth } from '@/integrations/firebase/config';

const TTS_FUNCTION_URL = 'https://us-central1-malleabite-97d35.cloudfunctions.net/synthesizeSpeech';

// ─── Shared AudioContext (singleton, unlocked once on first user gesture) ────
let _audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!_audioCtx) {
    _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return _audioCtx;
}

/** Call this inside any user-gesture handler to unblock AudioContext playback. */
export function unlockAudioContext() {
  const ctx = getAudioContext();
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
}

if (typeof window !== 'undefined') {
  const unlock = () => {
    unlockAudioContext();
    window.removeEventListener('click', unlock, true);
    window.removeEventListener('touchstart', unlock, true);
    window.removeEventListener('keydown', unlock, true);
  };
  window.addEventListener('click', unlock, true);
  window.addEventListener('touchstart', unlock, true);
  window.addEventListener('keydown', unlock, true);

  // Force-load speechSynthesis voices early (Chrome loads them async)
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener?.('voiceschanged', () => {
      window.speechSynthesis.getVoices(); // Cache the voice list
    });
  }
}

const FALLBACK_VOICES = [
  'Google US English', 'Google UK English Female',
  'Microsoft Aria Online (Natural)', 'Microsoft Jenny Online (Natural)',
  'Samantha', 'Karen', 'Moira', 'Tessa',
];

/** Pick the best available female voice from speechSynthesis.
 *  Tries FALLBACK_VOICES first, then any voice with 'female' in its name,
 *  then returns null (browser default). */
function pickFemaleVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  // Try preferred list first
  for (const name of FALLBACK_VOICES) {
    const found = voices.find(v => v.name.includes(name));
    if (found) return found;
  }
  // Broader: any English female voice
  const female = voices.find(v => v.lang.startsWith('en') && /female/i.test(v.name));
  if (female) return female;
  // Last resort: any English voice (skip non-English to avoid weird accents)
  return voices.find(v => v.lang.startsWith('en')) || null;
}

// Short filler phrases — pre-cached on login so they play in <300ms when used as ACK
const WARM_PHRASES = [
  'Got it.', 'On it.', 'Sure.', 'Let me check.',
  'One moment.', "I'm on it.", 'Absolutely.',
];

// ACK phrases played instantly on wake word — must also be warmed
const ACK_PHRASES = ['Hmm?', 'Yes?', 'Hey!', 'Listening.', "I'm here."];

interface TTSOptions {
  text: string;
  voiceName?: string;
  languageCode?: string;
}

// ─── Sentence splitter ────────────────────────────────────────────────────────
function splitIntoSentences(text: string): string[] {
  const cleaned = text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_~`#>]/g, '')
    .replace(/https?:\/\/\S+/g, 'link')
    .trim();

  if (!cleaned) return [];

  const parts = cleaned.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [cleaned];
  return parts.map(s => s.trim()).filter(s => s.length > 2);
}

// ─── MallyTTSService ──────────────────────────────────────────────────────────
class MallyTTSService {
  private cache = new Map<string, ArrayBuffer>();
  private currentSource: AudioBufferSourceNode | null = null;
  private _isSpeaking = false;
  private _onSpeakingChange: ((speaking: boolean) => void) | null = null;

  // Streaming queue
  private _streamBuffer = '';
  private _streamQueue: string[] = [];
  private _queueActive = false;
  private _streamDone = false;
  private _isFirstSentence = true; // Track first sentence for instant local playback

  /** True when last speak/speakPipelined used speechSynthesis fallback */
  lastUsedFallback = false;

  get isSpeaking() { return this._isSpeaking; }
  onSpeakingChange(cb: (speaking: boolean) => void) { this._onSpeakingChange = cb; }
  private setSpeaking(v: boolean) { this._isSpeaking = v; this._onSpeakingChange?.(v); }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async _fetchAndCache(text: string, voiceName?: string): Promise<ArrayBuffer> {
    const key = `${text.substring(0, 120)}-${voiceName || 'default'}`;
    if (this.cache.has(key)) return this.cache.get(key)!;

    const token = await auth.currentUser?.getIdToken(false);
    if (!token) throw new Error('Not authenticated');

    const resp = await fetch(TTS_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ data: { text, voiceName } }),
    });

    if (!resp.ok) throw new Error(`TTS API ${resp.status}`);
    const data = await resp.json();
    if (!data.result?.audioContent) throw new Error('No audioContent');

    const bytes = Uint8Array.from(atob(data.result.audioContent), c => c.charCodeAt(0));
    this.cache.set(key, bytes.buffer.slice(0));
    return bytes.buffer;
  }

  private async _playBuffer(buf: ArrayBuffer): Promise<void> {
    const ctx = getAudioContext();
    const decoded = await ctx.decodeAudioData(buf.slice(0));
    return new Promise<void>(resolve => {
      const source = ctx.createBufferSource();
      source.buffer = decoded;
      source.connect(ctx.destination);
      this.currentSource = source;
      source.onended = () => { this.currentSource = null; resolve(); };
      source.start(0);
    });
  }

  private async _requireRunningCtx(): Promise<AudioContext> {
    const ctx = getAudioContext();
    if (ctx.state !== 'running') { try { await ctx.resume(); } catch {} }
    if (ctx.state !== 'running') throw new Error('AudioContext blocked');
    return ctx;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Single utterance — Cloud TTS + AudioContext, falls back to speechSynthesis */
  async speak(options: TTSOptions): Promise<void> {
    const { text } = options;
    if (!text?.trim()) return;

    try {
      this.lastUsedFallback = false;
      await this._requireRunningCtx();
      this.stop();
      this.setSpeaking(true);
      const buf = await this._fetchAndCache(text, options.voiceName);
      await this._playBuffer(buf);
      this.setSpeaking(false);
    } catch (err: any) {
      console.warn('[MallyTTS] Cloud TTS failed, falling back:', err?.message);
      this.lastUsedFallback = true;
      this.setSpeaking(false);
      this.speakFallback(text);
    }
  }

  /** Multi-sentence pipeline:
   *  Splits text → parallel-fetches TTS for ALL sentences → plays sequentially.
   *  Result: audio starts the moment sentence 1 is decoded; sentence 2 is
   *  already decoded and waiting, so inter-sentence gap is near-zero.
   *  @param onSentenceStart fired each time a sentence begins playing */
  async speakPipelined(
    options: TTSOptions,
    onSentenceStart?: (idx: number, total: number, sentence: string) => void,
  ): Promise<void> {
    const { text } = options;
    if (!text?.trim()) return;

    const sentences = splitIntoSentences(text);
    if (sentences.length === 0) return;

    if (sentences.length === 1) {
      onSentenceStart?.(0, 1, sentences[0]);
      return this.speak(options);
    }

    try {
      this.lastUsedFallback = false;
      await this._requireRunningCtx();

      // Fire ALL sentence fetches in parallel right now
      const fetchMap = new Map<string, Promise<ArrayBuffer>>();
      for (const s of sentences) {
        fetchMap.set(s, this._fetchAndCache(s, options.voiceName));
      }

      this.stop();
      this.setSpeaking(true);

      for (let i = 0; i < sentences.length; i++) {
        if (!this._isSpeaking) break;
        const sentence = sentences[i];
        onSentenceStart?.(i, sentences.length, sentence);
        const buf = await fetchMap.get(sentence)!;
        if (!this._isSpeaking) break;
        await this._playBuffer(buf);
      }

      this.setSpeaking(false);
    } catch (err: any) {
      console.warn('[MallyTTS] Pipelined TTS failed, falling back:', err?.message);
      this.lastUsedFallback = true;
      this.setSpeaking(false);
      this.speakFallback(text);
    }
  }

  // ── Streaming TTS queue API ────────────────────────────────────────────────

  /** Call with each text chunk from a streaming AI response.
   *  Detects sentence boundaries in real-time and immediately starts TTS
   *  for each complete sentence. Pass done=true with the final chunk. */
  enqueueChunk(chunk: string, done = false, voiceName?: string): void {
    this._streamBuffer += chunk;
    const sentences = splitIntoSentences(this._streamBuffer);

    if (done) {
      this._streamDone = true;
      for (const s of sentences) this._streamQueue.push(s);
      this._streamBuffer = '';
    } else if (sentences.length > 1) {
      // Queue all but the last (potentially incomplete) sentence
      for (let i = 0; i < sentences.length - 1; i++) {
        this._streamQueue.push(sentences[i]);
      }
      // Keep only the trailing incomplete sentence in buffer
      const last = sentences[sentences.length - 1];
      const pos = this._streamBuffer.lastIndexOf(last);
      this._streamBuffer = pos >= 0 ? this._streamBuffer.slice(pos) : last;
    }

    if (!this._queueActive && this._streamQueue.length > 0) {
      this._drainQueue(voiceName);
    }
  }

  /** Reset stream queue — call before starting a new streamed response */
  resetStreamQueue(): void {
    this._streamBuffer = '';
    this._streamQueue = [];
    this._streamDone = false;
    this._queueActive = false;
    this._isFirstSentence = true;
  }

  private async _drainQueue(voiceName?: string): Promise<void> {
    if (this._queueActive) return;
    this._queueActive = true;

    // Try to resume AudioContext — succeeds if user has clicked/typed anything.
    // If still blocked (e.g. wake word fired with no prior gesture), we fall back
    // to speechSynthesis per-sentence so audio always plays.
    const ctx = getAudioContext();
    if (ctx.state !== 'running') { try { await ctx.resume(); } catch {} }
    const useCloudTTS = ctx.state === 'running';
    this.lastUsedFallback = !useCloudTTS;

    try {
      this.setSpeaking(true);

      while (this._streamQueue.length > 0 || !this._streamDone) {
        if (!this._isSpeaking) break;

        if (this._streamQueue.length === 0) {
          await new Promise(r => setTimeout(r, 20));
          continue;
        }

        const sentence = this._streamQueue.shift()!;
        const isFirst = this._isFirstSentence;
        this._isFirstSentence = false;

        if (useCloudTTS) {
          // Prefetch next 2 sentences in parallel while this one plays
          for (let pf = 0; pf < Math.min(2, this._streamQueue.length); pf++) {
            this._fetchAndCache(this._streamQueue[pf], voiceName).catch(() => {});
          }

          try {
            const buf = await this._fetchAndCache(sentence, voiceName);
            if (!this._isSpeaking) break;
            await this._playBuffer(buf);
          } catch {
            // Individual sentence failed — skip silently
          }
        } else {
          // AudioContext blocked — use speechSynthesis per sentence so streaming
          // audio still plays immediately (no need for a prior user gesture).
          await new Promise<void>(resolve => {
            const utt = new SpeechSynthesisUtterance(sentence);
            utt.rate = 0.95;
            utt.pitch = 1.05;
            const voice = pickFemaleVoice();
            if (voice) utt.voice = voice;
            utt.onend = () => resolve();
            utt.onerror = () => resolve();
            window.speechSynthesis.speak(utt);
          });
        }
      }

      this.setSpeaking(false);
    } catch (err: any) {
      console.warn('[MallyTTS] Queue drain error:', err?.message);
      this.setSpeaking(false);
    } finally {
      this._queueActive = false;
    }
  }

  // ── Cache warming ──────────────────────────────────────────────────────────

  /** Pre-cache common ACK phrases silently on login.
   *  After first call, "Got it." etc play from cache in <300ms. */
  warmCommonPhrases(): void {
    setTimeout(() => {
      for (const phrase of [...WARM_PHRASES, ...ACK_PHRASES]) {
        this._fetchAndCache(phrase).catch(() => {});
      }
    }, 4000);
  }

  /** Fire-and-forget ping to keep Firebase TTS function warm (avoids cold starts) */
  pingTTSFunction(): void {
    setTimeout(async () => {
      try {
        const token = await auth.currentUser?.getIdToken(false);
        if (!token) return;
        fetch(TTS_FUNCTION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ data: { text: '.', voiceName: undefined } }),
        }).catch(() => {});
      } catch {}
    }, 2000);
  }

  // ── Web Speech fallback ────────────────────────────────────────────────────

  speakFallback(text: string): void {
    if (!('speechSynthesis' in window)) return;

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

    const voice = pickFemaleVoice();
    if (voice) utterance.voice = voice;

    this.setSpeaking(true);
    utterance.onend = () => this.setSpeaking(false);
    utterance.onerror = () => this.setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  stop(): void {
    if (this.currentSource) {
      try { this.currentSource.stop(); } catch {}
      this.currentSource = null;
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    this._streamQueue = [];
    this._streamBuffer = '';
    this._streamDone = false;
    this._queueActive = false;
    this.setSpeaking(false);
  }

  clearCache(): void { this.cache.clear(); }

  // ── Instant ACK — plays pre-cached Cloud TTS audio on wake word ──────────

  private _ackIndex = 0;

  /** Play a short ACK phrase via pre-cached Cloud TTS AudioContext playback.
   *  Uses audio already fetched by warmCommonPhrases() — no network hop.
   *  Falls back to speechSynthesis if cache miss or AudioContext blocked.
   *  Cycles through phrases so it doesn't feel repetitive.
   *  Fire-and-forget — does NOT block on completion. */
  playInstantACK(): void {
    const phrase = ACK_PHRASES[this._ackIndex % ACK_PHRASES.length];
    this._ackIndex++;

    const key = `${phrase.substring(0, 120)}-default`;
    const cached = this.cache.get(key);

    if (cached) {
      // Play from pre-cached Cloud TTS buffer via AudioContext (works without user gesture
      // if AudioContext was previously unlocked by any click/tap/keypress)
      const ctx = getAudioContext();
      if (ctx.state !== 'running') { try { ctx.resume(); } catch {} }
      ctx.decodeAudioData(cached.slice(0)).then(decoded => {
        const source = ctx.createBufferSource();
        source.buffer = decoded;
        source.connect(ctx.destination);
        source.start(0);
      }).catch(() => {
        // Decode failed — try speechSynthesis as last resort
        this._ackFallback(phrase);
      });
    } else {
      // Cache miss (warmCommonPhrases hasn't finished yet) — try speechSynthesis
      this._ackFallback(phrase);
      // Also trigger a fetch so it's cached for next time
      this._fetchAndCache(phrase).catch(() => {});
    }
  }

  private _ackFallback(phrase: string): void {
    if (!('speechSynthesis' in window)) return;
    const utt = new SpeechSynthesisUtterance(phrase);
    utt.rate = 1.1;
    utt.pitch = 1.1;
    utt.volume = 0.8;
    const voice = pickFemaleVoice();
    if (voice) utt.voice = voice;
    window.speechSynthesis.speak(utt);
  }
}

export const mallyTTS = new MallyTTSService();
