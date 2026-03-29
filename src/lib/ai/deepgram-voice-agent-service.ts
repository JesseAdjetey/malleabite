// Deepgram Voice Agent Service
// Full-duplex voice AI — replaces VAPI with direct Deepgram integration.
//
// Pipeline: Mic → Deepgram STT (Nova-2) → LLM (GPT-4o-mini, managed by DG) → Deepgram TTS (Aura)
// Deepgram manages all three stages server-side — no extra LLM API key needed.
//
// Features:
//   - Real-time streaming STT with VAD
//   - Native barge-in (user talks → agent stops instantly)
//   - Seamless streaming TTS playback
//   - Function/tool calls for calendar, todos, etc.
//   - Full-duplex WebSocket (no turn-based latency)
//
// Cost: ~$0.01–0.02/min (vs $0.05–0.10/min VAPI)
// Requires: VITE_DEEPGRAM_API_KEY

const AGENT_WS_URL = 'wss://agent.deepgram.com/v1/agent/converse';
const OUTPUT_SAMPLE_RATE = 24000; // Hz — Deepgram TTS output rate
const INPUT_SAMPLE_RATE = 16000;  // Hz — what Deepgram STT expects

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VoiceAgentCallbacks {
  onUserTranscript?: (text: string) => void;
  onAssistantTranscript?: (text: string) => void;
  onUserSpeechStart?: () => void;
  onAgentSpeakingStart?: () => void;
  onAgentSpeakingEnd?: () => void;
  onCallStart?: () => void;
  onCallEnd?: () => void;
  onToolCall?: (name: string, args: Record<string, any>) => Promise<string>;
  onError?: (error: string) => void;
}

export interface VoiceAgentOptions {
  systemPrompt: string;
  firstMessage?: string;
  tools?: AgentTool[];
  voiceModel?: string; // Deepgram Aura model id — defaults to aura-asteria-en
}

interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

// ─── Mally Tool Definitions ──────────────────────────────────────────────────

export function buildAgentTools(): AgentTool[] {
  return [
    {
      name: 'create_event',
      description: 'Create a new calendar event. Use ISO8601 format for start and end.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Event title' },
          start: { type: 'string', description: 'Start datetime ISO8601' },
          end: { type: 'string', description: 'End datetime ISO8601' },
          isRecurring: { type: 'boolean', description: 'Whether the event repeats' },
        },
        required: ['title', 'start', 'end'],
      },
    },
    {
      name: 'update_event',
      description: 'Update an existing calendar event by its ID.',
      parameters: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'ID of the event to update' },
          title: { type: 'string', description: 'New title (optional)' },
          start: { type: 'string', description: 'New start datetime ISO8601 (optional)' },
          end: { type: 'string', description: 'New end datetime ISO8601 (optional)' },
        },
        required: ['eventId'],
      },
    },
    {
      name: 'delete_event',
      description: 'Delete a calendar event by its ID.',
      parameters: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'ID of the event to delete' },
        },
        required: ['eventId'],
      },
    },
    {
      name: 'reschedule_event',
      description: 'Move an existing event to a new date/time.',
      parameters: {
        type: 'object',
        properties: {
          eventId: { type: 'string', description: 'ID of the event to reschedule' },
          newStart: { type: 'string', description: 'New start datetime ISO8601' },
          newEnd: { type: 'string', description: 'New end datetime ISO8601 (optional)' },
        },
        required: ['eventId', 'newStart'],
      },
    },
    {
      name: 'create_todo',
      description: 'Create a new todo/task item.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'The todo item text' },
          listName: { type: 'string', description: 'Which list to add it to (optional)' },
        },
        required: ['text'],
      },
    },
    {
      name: 'complete_todo',
      description: 'Mark a todo item as completed.',
      parameters: {
        type: 'object',
        properties: {
          todoId: { type: 'string', description: 'ID of the todo to complete' },
        },
        required: ['todoId'],
      },
    },
    {
      name: 'delete_todo',
      description: 'Delete a todo item.',
      parameters: {
        type: 'object',
        properties: {
          todoId: { type: 'string', description: 'ID of the todo to delete' },
        },
        required: ['todoId'],
      },
    },
    {
      name: 'create_alarm',
      description: 'Set an alarm at a specific time.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Alarm label' },
          time: { type: 'string', description: 'Time in HH:mm (24 hour)' },
        },
        required: ['title', 'time'],
      },
    },
    {
      name: 'delete_alarm',
      description: 'Delete an alarm by its ID.',
      parameters: {
        type: 'object',
        properties: {
          alarmId: { type: 'string', description: 'ID of the alarm to delete' },
        },
        required: ['alarmId'],
      },
    },
    {
      name: 'start_pomodoro',
      description: 'Start a pomodoro focus timer.',
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'stop_pomodoro',
      description: 'Stop the current pomodoro timer.',
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'create_eisenhower',
      description: 'Add an item to the Eisenhower priority matrix.',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Task description' },
          quadrant: {
            type: 'string',
            enum: ['urgent-important', 'not-urgent-important', 'urgent-not-important', 'not-urgent-not-important'],
            description: 'Which quadrant',
          },
        },
        required: ['text', 'quadrant'],
      },
    },
    {
      name: 'create_goal',
      description: 'Create a new goal for the user to track.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Goal title' },
          category: { type: 'string', description: 'Category e.g. health, work, learning' },
          frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
          target: { type: 'number', description: 'Target count per frequency period' },
        },
        required: ['title'],
      },
    },
    {
      name: 'add_module',
      description: 'Add a module to a sidebar page.',
      parameters: {
        type: 'object',
        properties: {
          moduleType: {
            type: 'string',
            enum: ['todo', 'pomodoro', 'alarms', 'reminders', 'eisenhower', 'invites'],
          },
          title: { type: 'string', description: 'Optional custom module title' },
          pageName: { type: 'string', description: 'Target page (optional, defaults to current)' },
        },
        required: ['moduleType'],
      },
    },
    {
      name: 'create_page',
      description: 'Create a new sidebar page.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Page title' },
        },
        required: ['title'],
      },
    },
    {
      name: 'switch_page',
      description: 'Switch to a sidebar page by title.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Page title to switch to' },
        },
        required: ['title'],
      },
    },
    {
      name: 'get_weather',
      description: 'Get current weather for a city.',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name e.g. "London"' },
        },
        required: ['location'],
      },
    },
    {
      name: 'search_web',
      description: 'Search the internet for current information.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query' },
        },
        required: ['query'],
      },
    },
  ];
}

// ─── Audio Playback Queue ─────────────────────────────────────────────────────

class AudioPlaybackQueue {
  private ctx: AudioContext;
  private nextStartTime = 0;
  private _isSpeaking = false;
  private _bargedIn = false;
  private scheduledNodes: AudioBufferSourceNode[] = [];
  onSpeakingChange?: (speaking: boolean) => void;

  constructor() {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
      sampleRate: OUTPUT_SAMPLE_RATE,
    });
  }

  get isSpeaking() { return this._isSpeaking; }

  private setSpeaking(v: boolean) {
    if (this._isSpeaking !== v) {
      this._isSpeaking = v;
      this.onSpeakingChange?.(v);
    }
  }

  /** Enqueue a chunk of linear16 PCM audio received from Deepgram TTS */
  enqueue(arrayBuffer: ArrayBuffer) {
    if (this._bargedIn) return; // Discard if user interrupted

    const int16 = new Int16Array(arrayBuffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const buffer = this.ctx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
    buffer.copyToChannel(float32, 0);

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ctx.destination);

    // Schedule seamlessly back-to-back
    const now = this.ctx.currentTime;
    const startAt = Math.max(this.nextStartTime, now + 0.02); // 20ms minimum lookahead
    source.start(startAt);
    this.nextStartTime = startAt + buffer.duration;
    this.scheduledNodes.push(source);

    this.setSpeaking(true);

    source.onended = () => {
      this.scheduledNodes = this.scheduledNodes.filter(n => n !== source);
      if (this.scheduledNodes.length === 0) {
        this.setSpeaking(false);
      }
    };
  }

  /** Stop all audio immediately (barge-in) */
  stopAll() {
    this._bargedIn = true;
    for (const node of this.scheduledNodes) {
      try { node.stop(); } catch {}
    }
    this.scheduledNodes = [];
    this.nextStartTime = 0;
    this.setSpeaking(false);
  }

  /** Reset barge-in flag for next agent turn */
  resetBarge() {
    this._bargedIn = false;
    this.nextStartTime = 0;
  }

  resume() {
    if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {});
  }

  destroy() {
    this.stopAll();
    try { this.ctx.close(); } catch {}
  }
}

// ─── Service ─────────────────────────────────────────────────────────────────

class DeepgramVoiceAgentService {
  private socket: WebSocket | null = null;
  private mediaStream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private playback: AudioPlaybackQueue | null = null;
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;
  private callbacks: VoiceAgentCallbacks = {};
  private _isActive = false;
  private _isSpeaking = false;
  private _onSpeakingChange: ((v: boolean) => void) | null = null;

  get isAvailable(): boolean { return !!import.meta.env.VITE_DEEPGRAM_API_KEY; }
  get isActive(): boolean { return this._isActive; }
  get isSpeaking(): boolean { return this._isSpeaking; }

  setCallbacks(cb: VoiceAgentCallbacks) { this.callbacks = cb; }
  onSpeakingChange(cb: ((v: boolean) => void) | null) { this._onSpeakingChange = cb; }

  private setSpeaking(v: boolean) {
    if (this._isSpeaking !== v) {
      this._isSpeaking = v;
      this._onSpeakingChange?.(v);
    }
  }

  /** Start a full voice agent session */
  async start(options: VoiceAgentOptions): Promise<void> {
    if (!this.isAvailable) throw new Error('VITE_DEEPGRAM_API_KEY not set');
    this.stop(); // Clean up any existing session

    const apiKey = import.meta.env.VITE_DEEPGRAM_API_KEY;

    // ── Open WebSocket ──────────────────────────────────────────────────────
    // Browser can't set Authorization header on WS — use subprotocol auth
    const socket = new WebSocket(AGENT_WS_URL, ['token', apiKey]);
    socket.binaryType = 'arraybuffer';
    this.socket = socket;

    // ── Audio output playback queue ─────────────────────────────────────────
    this.playback = new AudioPlaybackQueue();
    this.playback.onSpeakingChange = (speaking) => {
      this.setSpeaking(speaking);
    };

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const settle = (fn: () => void) => { if (!settled) { settled = true; fn(); } };
      const timeout = setTimeout(() => settle(() => reject(new Error('Deepgram connection timeout'))), 10000);

      socket.onopen = () => {
        const settings = this.buildSettings(options);
        console.log('[DGAgent] Sending settings:', JSON.stringify(settings, null, 2));
        socket.send(JSON.stringify(settings));
      };

      socket.onmessage = async (event) => {
        // Binary = TTS audio chunk
        if (event.data instanceof ArrayBuffer) {
          this.playback?.enqueue(event.data);
          return;
        }

        let msg: any;
        try { msg = JSON.parse(event.data); } catch { return; }

        switch (msg.type) {
          case 'Welcome':
            console.log('[DGAgent] Connected, request_id:', msg.request_id);
            break;

          case 'SettingsApplied':
            console.log('[DGAgent] Settings applied — session live');
            clearTimeout(timeout);
            this._isActive = true;
            // Start mic now that settings are confirmed
            this.startMic(socket).then(() => {
              this.callbacks.onCallStart?.();
              if (options.firstMessage) {
                socket.send(JSON.stringify({
                  type: 'InjectAgentMessage',
                  message: options.firstMessage,
                }));
              }
              settle(() => resolve());
            }).catch(err => {
              settle(() => reject(err));
            });
            // Start keep-alive pings every 5s
            this.keepAliveTimer = setInterval(() => {
              if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: 'KeepAlive' }));
              }
            }, 5000);
            break;

          case 'UserStartedSpeaking':
            // Barge-in — stop agent audio immediately
            console.log('[DGAgent] Barge-in detected');
            this.playback?.stopAll();
            this.callbacks.onUserSpeechStart?.();
            break;

          case 'ConversationText':
            if (msg.role === 'user') {
              this.callbacks.onUserTranscript?.(msg.content);
            } else if (msg.role === 'assistant') {
              this.playback?.resetBarge();
              this.callbacks.onAssistantTranscript?.(msg.content);
            }
            break;

          case 'AgentStartedSpeaking':
            console.log('[DGAgent] Agent speaking (latency:', msg.total_latency?.toFixed(2), 's)');
            this.callbacks.onAgentSpeakingStart?.();
            break;

          case 'AgentAudioDone':
            console.log('[DGAgent] Agent audio done');
            this.callbacks.onAgentSpeakingEnd?.();
            break;

          case 'FunctionCallRequest':
            await this.handleFunctionCalls(socket, msg.functions || []);
            break;

          case 'Error':
            console.error('[DGAgent] Server error:', JSON.stringify(msg));
            settle(() => reject(new Error(msg.description || msg.message || 'Deepgram agent error')));
            break;

          case 'Close':
            console.log('[DGAgent] Server closed connection');
            this._isActive = false;
            this.callbacks.onCallEnd?.();
            break;
        }
      };

      socket.onerror = (event) => {
        console.error('[DGAgent] WebSocket error', event);
        settle(() => reject(new Error('WebSocket error')));
      };

      socket.onclose = (event) => {
        clearTimeout(timeout);
        const wasActive = this._isActive;
        this._isActive = false;
        this.setSpeaking(false);
        this.stopMic();
        if (this.keepAliveTimer) { clearInterval(this.keepAliveTimer); this.keepAliveTimer = null; }
        console.log('[DGAgent] Connection closed — code:', event.code, 'reason:', event.reason);
        // Reject if we closed before settings were applied
        settle(() => reject(new Error(`Connection closed before ready (${event.code})`)));
        if (wasActive) {
          this.callbacks.onCallEnd?.();
        }
      };
    });
  }

  /** Stop the session and release all resources */
  stop() {
    if (this.keepAliveTimer) { clearInterval(this.keepAliveTimer); this.keepAliveTimer = null; }
    this.stopMic();
    this.playback?.destroy();
    this.playback = null;
    if (this.socket) {
      try { this.socket.close(); } catch {}
      this.socket = null;
    }
    this._isActive = false;
    this.setSpeaking(false);
  }

  // ── Internal ──────────────────────────────────────────────────────────────

  private buildSettings(options: VoiceAgentOptions) {
    return {
      type: 'Settings',
      audio: {
        input: { encoding: 'linear16', sample_rate: INPUT_SAMPLE_RATE },
        output: { encoding: 'linear16', sample_rate: OUTPUT_SAMPLE_RATE, container: 'none' },
      },
      agent: {
        listen: { provider: { type: 'deepgram', model: 'nova-2-general' } },
        think: {
          provider: {
            type: 'open_ai',
            model: 'gpt-4o-mini',
            instructions: options.systemPrompt,
          },
          functions: (options.tools || buildAgentTools()).map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
        speak: { provider: { type: 'deepgram', model: options.voiceModel ?? 'aura-asteria-en' } },
      },
    };
  }

  private async startMic(socket: WebSocket): Promise<void> {
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 48000,
        channelCount: 1,
      },
    });

    this.audioCtx = new AudioContext({ sampleRate: 48000 });
    this.source = this.audioCtx.createMediaStreamSource(this.mediaStream);
    this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);

    // Downsample 48kHz → 16kHz and convert Float32 → Int16 PCM
    const downsampleFactor = Math.round(48000 / INPUT_SAMPLE_RATE);
    this.processor.onaudioprocess = (e: AudioProcessingEvent) => {
      if (socket.readyState !== WebSocket.OPEN) return;
      const input = e.inputBuffer.getChannelData(0);
      const outLength = Math.floor(input.length / downsampleFactor);
      const pcm = new Int16Array(outLength);
      for (let i = 0; i < outLength; i++) {
        const s = input[i * downsampleFactor];
        pcm[i] = Math.max(-32768, Math.min(32767, s * 32768));
      }
      socket.send(pcm.buffer);
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioCtx.destination);
    this.playback?.resume();
    console.log('[DGAgent] Mic streaming started');
  }

  private stopMic() {
    if (this.processor) { try { this.processor.disconnect(); } catch {} this.processor = null; }
    if (this.source) { try { this.source.disconnect(); } catch {} this.source = null; }
    if (this.audioCtx) { try { this.audioCtx.close(); } catch {} this.audioCtx = null; }
    if (this.mediaStream) { this.mediaStream.getTracks().forEach(t => t.stop()); this.mediaStream = null; }
  }

  private async handleFunctionCalls(socket: WebSocket, functions: any[]) {
    for (const fn of functions) {
      if (!fn.client_side) continue; // Server handled it
      const name: string = fn.name;
      const callId: string = fn.id;

      let args: Record<string, any> = {};
      try {
        args = typeof fn.arguments === 'string' ? JSON.parse(fn.arguments) : (fn.arguments || {});
      } catch { args = {}; }

      console.log('[DGAgent] Tool call:', name, args);

      let result = 'Done';
      if (this.callbacks.onToolCall) {
        try { result = await this.callbacks.onToolCall(name, args); }
        catch (e: any) { result = `Error: ${e?.message || 'Unknown'}`; }
      }

      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'FunctionCallResponse',
          id: callId,
          name,
          content: result,
        }));
      }
    }
  }
}

export const deepgramAgent = new DeepgramVoiceAgentService();
