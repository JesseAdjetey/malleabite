// On-device wake word detection — Picovoice Porcupine WebAssembly engine.
// Zero network calls during continuous listening. Runs entirely in the browser.
//
// ─── Setup ────────────────────────────────────────────────────────────────────
// 1. Get a free AccessKey from https://console.picovoice.ai
// 2. Train a "Hey Mally" custom wake word on the Picovoice Console (free, ~5 min)
// 3. Download the .ppn keyword file, base64-encode it:
//      powershell: [Convert]::ToBase64String([IO.File]::ReadAllBytes("hey-mally.ppn"))
//      macOS/Linux: base64 hey-mally.ppn
// 4. Run: npm run setup:porcupine   (downloads the acoustic model to public/)
// 5. Set environment variables in .env.local:
//      VITE_PICOVOICE_ACCESS_KEY=your-access-key
//      VITE_PICOVOICE_KEYWORD_B64=<base64 of hey-mally.ppn>
//
// If these env vars are absent, this service returns isConfigured()=false and
// use-wake-word.ts transparently falls back to the existing Web Speech API path.
// ─────────────────────────────────────────────────────────────────────────────
import { PorcupineWorker } from '@picovoice/porcupine-web';

const ACCESS_KEY   = import.meta.env.VITE_PICOVOICE_ACCESS_KEY  as string | undefined;
const KEYWORD_B64  = import.meta.env.VITE_PICOVOICE_KEYWORD_B64 as string | undefined;
// Optional: serve the .ppn from /public instead of encoding it inline
const KEYWORD_PATH = import.meta.env.VITE_PICOVOICE_KEYWORD_PATH as string | undefined;
// Acoustic model served from /public after running `npm run setup:porcupine`
const MODEL_PATH   = (import.meta.env.VITE_PICOVOICE_MODEL_PATH as string | undefined)
                     ?? '/porcupine-params.pv';

const PORCUPINE_SAMPLE_RATE = 16_000;         // Porcupine always expects 16kHz
const SCRIPT_PROCESSOR_BUFFER = 4_096;         // Frames handed to ScriptProcessor

class PorcupineWakeWordService {
  private _worker: PorcupineWorker | null = null;
  private _audioCtx: AudioContext | null = null;
  private _stream: MediaStream | null = null;
  private _processor: ScriptProcessorNode | null = null;
  private _source: MediaStreamAudioSourceNode | null = null;
  private _frameBuffer = new Float32Array(0); // accumulates post-resample audio
  private _frameSamples = 0;                  // frameLength from Porcupine engine
  private _isRunning = false;

  get isRunning() { return this._isRunning; }

  /** Returns true when both env vars are set AND WebAssembly is available. */
  isConfigured(): boolean {
    return !!(ACCESS_KEY && (KEYWORD_B64 || KEYWORD_PATH) && typeof WebAssembly !== 'undefined');
  }

  /**
   * Starts on-device wake word detection.
   * @param onDetected — called (synchronously from audio thread) when "Hey Mally" fires
   * @returns true on success, false if not configured or if initialization fails
   */
  async start(onDetected: () => void): Promise<boolean> {
    if (!this.isConfigured()) return false;
    if (this._isRunning) return true;

    try {
      // ── 1. Initialise Porcupine WebWorker ─────────────────────────────────
      const keyword = KEYWORD_B64
        ? ({ base64: KEYWORD_B64,     label: 'Hey Mally', sensitivity: 0.65 } as const)
        : ({ publicPath: KEYWORD_PATH!, label: 'Hey Mally', sensitivity: 0.65 } as const);

      this._worker = await PorcupineWorker.create(
        ACCESS_KEY!,
        keyword,
        (detection) => {
          if (detection.label === 'Hey Mally' && this._isRunning) {
            onDetected();
          }
        },
        {
          publicPath: MODEL_PATH,
          // Store model in browser storage (OPFS) so it isn't re-fetched every page load
          customWritePath: 'porcupine_params_en',
          version: 1,
        },
      );

      this._frameSamples = this._worker.frameLength; // typically 512 at 16kHz

      // ── 2. Open microphone ─────────────────────────────────────────────────
      this._stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: PORCUPINE_SAMPLE_RATE },
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      // ── 3. Build audio pipeline ────────────────────────────────────────────
      // We use a ScriptProcessorNode (deprecated but universally supported)
      // instead of AudioWorklet so we do NOT need SharedArrayBuffer / COOP+COEP.
      this._audioCtx = new AudioContext();
      const nativeSR = this._audioCtx.sampleRate;
      const ratio    = nativeSR / PORCUPINE_SAMPLE_RATE; // e.g. 48000/16000 = 3

      this._source    = this._audioCtx.createMediaStreamSource(this._stream);
      this._processor = this._audioCtx.createScriptProcessor(SCRIPT_PROCESSOR_BUFFER, 1, 1);

      this._processor.onaudioprocess = (ev) => {
        if (!this._isRunning || !this._worker) return;

        // Float32 PCM at native sample rate
        const input = ev.inputBuffer.getChannelData(0);

        // ── Linear downsample to 16kHz (nearest-neighbor) ─────────────────
        const outputLen = Math.floor(input.length / ratio);
        const resampled = new Float32Array(outputLen);
        for (let i = 0; i < outputLen; i++) {
          resampled[i] = input[Math.floor(i * ratio)];
        }

        // ── Accumulate into frame buffer ───────────────────────────────────
        const combined = new Float32Array(this._frameBuffer.length + resampled.length);
        combined.set(this._frameBuffer);
        combined.set(resampled, this._frameBuffer.length);

        // ── Feed complete frames to Porcupine ──────────────────────────────
        let offset = 0;
        while (offset + this._frameSamples <= combined.length) {
          const frame    = combined.subarray(offset, offset + this._frameSamples);
          const int16    = new Int16Array(this._frameSamples);
          for (let i = 0; i < this._frameSamples; i++) {
            // Clamp Float32 [-1, 1] → Int16 [-32768, 32767]
            int16[i] = Math.max(-32768, Math.min(32767, Math.round(frame[i] * 32768)));
          }
          this._worker.process(int16);
          offset += this._frameSamples;
        }

        // Leftover partial frame kept for next callback
        this._frameBuffer = combined.slice(offset);
      };

      this._source.connect(this._processor);
      // Must connect to destination even with no output — required for onaudioprocess to fire
      this._processor.connect(this._audioCtx.destination);

      this._isRunning = true;
      console.info('[Porcupine] On-device wake word active — "Hey Mally" (0 network calls)');
      return true;

    } catch (err: any) {
      console.warn('[Porcupine] Initialisation failed — falling back to Web Speech API:', err?.message ?? err);
      // Clean up anything partially started
      await this._teardown();
      return false;
    }
  }

  /**
   * Stop detection and fully release the microphone.
   * Synchronously marks as stopped so no further audio is forwarded to Porcupine;
   * async cleanup (AudioContext close, worker terminate) runs in the background.
   */
  stop(): void {
    this._isRunning = false;   // immediate — prevents onaudioprocess from forwarding audio
    this._frameBuffer = new Float32Array(0);
    this._teardown();          // fire-and-forget async cleanup
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async _teardown(): Promise<void> {
    if (this._processor) {
      try { this._processor.disconnect(); } catch {}
      this._processor = null;
    }
    if (this._source) {
      try { this._source.disconnect(); } catch {}
      this._source = null;
    }
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop()); // release mic hardware
      this._stream = null;
    }
    if (this._audioCtx) {
      try { await this._audioCtx.close(); } catch {}
      this._audioCtx = null;
    }
    if (this._worker) {
      const w = this._worker;
      this._worker = null;
      try { await w.release(); } catch {}
      try { w.terminate(); }    catch {}
    }
  }
}

export const porcupineService = new PorcupineWakeWordService();
