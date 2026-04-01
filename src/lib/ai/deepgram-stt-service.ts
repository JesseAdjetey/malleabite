// Deepgram WebSocket STT Service
// Drop-in replacement for Web Speech API in the voice overlay.
// Streams raw PCM from the mic directly to Deepgram Nova-2 over WebSocket —
// gives real-time transcripts, proper VAD, and consistent cross-browser quality.
//
// The real Deepgram API key is stored in Firebase Secrets (server-side only).
// This service fetches a short-lived token (60s TTL) from the getDeepgramToken
// Cloud Function before each session — the key is never exposed in the client bundle.

import { getAuth } from 'firebase/auth';

interface SpeechResult {
  transcript: string;
  isFinal: boolean;
  confidence?: number;
}

type OnResultCallback = (result: SpeechResult) => void;
type OnErrorCallback = (error: string) => void;

const DEEPGRAM_WS_URL = 'wss://api.deepgram.com/v1/listen';
const TOKEN_ENDPOINT = 'https://us-central1-malleabite-97d35.cloudfunctions.net/getDeepgramToken';

class DeepgramSTTService {
  private socket: WebSocket | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private _listening = false;
  private _stopped = false;

  get isListening(): boolean { return this._listening; }

  // Available if Cloud Function URL is defined (always true in production)
  get isAvailable(): boolean { return true; }

  /** Stop and fully release all resources */
  async stop(): Promise<void> {
    this._stopped = true;
    this._listening = false;
    this._cleanup();
    // Small delay for mic hardware to release
    await new Promise(r => setTimeout(r, 100));
  }

  async ensureStopped(releaseDelayMs = 150): Promise<void> {
    this._stopped = true;
    this._listening = false;
    this._cleanup();
    if (releaseDelayMs > 0) {
      await new Promise(r => setTimeout(r, releaseDelayMs));
    }
  }

  private _cleanup() {
    // Close WebSocket
    if (this.socket) {
      try { this.socket.close(); } catch {}
      this.socket = null;
    }
    // Disconnect audio graph
    if (this.processor) {
      try { this.processor.disconnect(); } catch {}
      this.processor = null;
    }
    if (this.source) {
      try { this.source.disconnect(); } catch {}
      this.source = null;
    }
    if (this.audioContext) {
      try { this.audioContext.close(); } catch {}
      this.audioContext = null;
    }
    // Stop mic tracks
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
  }

  /** Fetch a short-lived token from the Cloud Function */
  private async fetchToken(): Promise<string> {
    const user = getAuth().currentUser;
    if (!user) throw new Error('Not authenticated');
    const idToken = await user.getIdToken();

    const response = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${idToken}` },
    });

    if (!response.ok) throw new Error('Failed to get Deepgram token');
    const data = await response.json() as { token: string };
    return data.token;
  }

  /** Start streaming mic audio to Deepgram */
  async startListening(
    onResult: OnResultCallback,
    onError: OnErrorCallback,
  ): Promise<void> {
    this._stopped = false;
    this._cleanup(); // Ensure clean state

    let token: string;
    try {
      token = await this.fetchToken();
    } catch (e: any) {
      onError(e?.message || 'Failed to get Deepgram token');
      return;
    }

    // ── 1. Open WebSocket to Deepgram ──────────────────────────────────────
    const params = new URLSearchParams({
      model: 'nova-2',
      language: 'en-US',
      encoding: 'linear16',
      sample_rate: '16000',
      channels: '1',
      interim_results: 'true',
      vad_events: 'true',       // Deepgram fires speech_started / utterance_end
      endpointing: '400',       // 400ms silence = end of utterance
      utterance_end_ms: '1200', // Flush interim after 1200ms silence
      smart_format: 'true',     // Punctuation + formatting
      no_delay: 'true',         // Minimize latency
    });

    const url = `${DEEPGRAM_WS_URL}?${params}`;
    let socket: WebSocket;

    try {
      socket = new WebSocket(url, ['token', token]);
    } catch (e: any) {
      onError(e?.message || 'Failed to connect to Deepgram');
      return;
    }

    this.socket = socket;
    let micReady = false;

    socket.onopen = async () => {
      if (this._stopped) { socket.close(); return; }
      console.log('[DeepgramSTT] WebSocket connected');
      // Start mic after socket opens
      try {
        await this._startMic(socket, onError);
        micReady = true;
        this._listening = true;
      } catch (e: any) {
        onError(e?.message || 'Microphone access denied');
      }
    };

    socket.onmessage = (event) => {
      if (this._stopped) return;
      try {
        const data = JSON.parse(event.data);

        // Transcript result
        if (data.type === 'Results') {
          const alt = data.channel?.alternatives?.[0];
          if (!alt || !alt.transcript) return;

          const transcript: string = alt.transcript.trim();
          if (!transcript) return;

          const isFinal: boolean = data.is_final === true;
          const confidence: number = alt.confidence ?? 1;

          onResult({ transcript, isFinal, confidence });
        }

        // Speech started — user began speaking (useful for UI feedback)
        if (data.type === 'SpeechStarted') {
          console.log('[DeepgramSTT] Speech started');
        }

        // Utterance end — Deepgram's VAD says speaker stopped
        if (data.type === 'UtteranceEnd') {
          console.log('[DeepgramSTT] Utterance ended');
        }
      } catch { /* ignore parse errors */ }
    };

    socket.onerror = (event) => {
      console.error('[DeepgramSTT] WebSocket error', event);
      if (!this._stopped) onError('Deepgram connection error');
    };

    socket.onclose = (event) => {
      this._listening = false;
      if (!this._stopped && !micReady) {
        // Closed before mic started — likely auth failure
        onError(event.code === 1008 ? 'Invalid Deepgram token' : 'Deepgram connection closed');
      }
    };
  }

  private async _startMic(socket: WebSocket, onError: OnErrorCallback): Promise<void> {
    // Request mic
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 48000, // Native rate — we downsample to 16kHz
        channelCount: 1,
      }
    });

    if (this._stopped) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
      return;
    }

    // ── Audio pipeline: mic → downsample to 16kHz → Int16 PCM → WebSocket ──
    this.audioContext = new AudioContext({ sampleRate: 48000 });
    this.source = this.audioContext.createMediaStreamSource(this.mediaStream);

    // ScriptProcessorNode: 4096 samples @ 48kHz ≈ 85ms chunks
    // Downsample 48kHz → 16kHz (factor of 3)
    const bufferSize = 4096;
    this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

    this.processor.onaudioprocess = (e: AudioProcessingEvent) => {
      if (socket.readyState !== WebSocket.OPEN || this._stopped) return;

      const inputData = e.inputBuffer.getChannelData(0); // Float32 @ 48kHz

      // Downsample 48kHz → 16kHz by taking every 3rd sample
      const downsampleFactor = 3;
      const outputLength = Math.floor(inputData.length / downsampleFactor);
      const pcm16 = new Int16Array(outputLength);

      for (let i = 0; i < outputLength; i++) {
        const sample = inputData[i * downsampleFactor];
        // Clamp and convert Float32 [-1, 1] → Int16 [-32768, 32767]
        pcm16[i] = Math.max(-32768, Math.min(32767, sample * 32768));
      }

      socket.send(pcm16.buffer);
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    console.log('[DeepgramSTT] Mic streaming started → Deepgram Nova-2');
  }
}

export const deepgramSTT = new DeepgramSTTService();
