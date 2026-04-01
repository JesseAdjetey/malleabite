// Mally Vapi Voice AI Service
// Replaces custom STT + TTS + VAD pipeline with Vapi's managed WebRTC voice sessions.
//
// Architecture:
//   - Wake word (Porcupine) triggers vapiService.startSession() → full-duplex conversation
//   - Vapi handles: STT (Deepgram) → LLM (GPT-4o) → TTS (Vapi/ElevenLabs) → VAD/barge-in
//   - Client-side tool calls for calendar/todo/pomodoro + real-time data (weather/stocks/flights/search)
//   - vapiService.stop() ends session, mic returns to wake word listener
//
// Opt-in via VITE_VAPI_PUBLIC_KEY env variable.
// When the key is absent, the existing custom pipeline is used as fallback.

import Vapi from '@vapi-ai/web';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VapiCallbacks {
  /** User speech transcript (partial or final) */
  onUserTranscript?: (text: string, isFinal: boolean) => void;
  /** Assistant speech transcript (what she's saying) */
  onAssistantTranscript?: (text: string, isFinal: boolean) => void;
  /** User started speaking */
  onUserSpeechStart?: () => void;
  /** User stopped speaking */
  onUserSpeechEnd?: () => void;
  /** Call has connected and is active */
  onCallStart?: () => void;
  /** Call has ended (either side) */
  onCallEnd?: () => void;
  /** A tool/function call from the LLM — return result string */
  onToolCall?: (name: string, args: Record<string, any>) => Promise<string>;
  /** Error occurred */
  onError?: (error: any) => void;
}

export interface VapiSessionOptions {
  /** Dynamic system prompt with calendar context */
  systemPrompt: string;
  /** First message Mally says when the call starts */
  firstMessage?: string;
  /** VAPI built-in voiceId (e.g. 'Lily', 'Elliot'). Defaults to 'Lily'. */
  voiceId?: string;
}

// ─── Mally Tool Definitions ──────────────────────────────────────────────────

function buildMallyTools(): any[] {
  return [
    {
      type: 'function',
      messages: [
        { type: 'request-start', content: 'Let me create that event for you.' },
        { type: 'request-complete', content: 'Done!' },
        { type: 'request-failed', content: 'Sorry, I had trouble creating that event.' },
      ],
      function: {
        name: 'create_event',
        description: 'Create a new calendar event for the user. Use ISO8601 datetime format for start and end.',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Event title/name' },
            start: { type: 'string', description: 'Start datetime in ISO8601 format' },
            end: { type: 'string', description: 'End datetime in ISO8601 format' },
            isRecurring: { type: 'boolean', description: 'Whether the event repeats regularly' },
          },
          required: ['title', 'start', 'end'],
        },
      },
    },
    {
      type: 'function',
      messages: [
        { type: 'request-start', content: 'Updating that event now.' },
        { type: 'request-complete', content: 'Updated!' },
        { type: 'request-failed', content: "I couldn't update that event." },
      ],
      function: {
        name: 'update_event',
        description: 'Update an existing calendar event (title, start, or end time)',
        parameters: {
          type: 'object',
          properties: {
            eventId: { type: 'string', description: 'ID of the event to update' },
            title: { type: 'string', description: 'New title (optional)' },
            start: { type: 'string', description: 'New start datetime in ISO8601 (optional)' },
            end: { type: 'string', description: 'New end datetime in ISO8601 (optional)' },
          },
          required: ['eventId'],
        },
      },
    },
    {
      type: 'function',
      messages: [
        { type: 'request-start', content: 'Adding that to your list.' },
        { type: 'request-complete', content: 'Added!' },
      ],
      function: {
        name: 'create_todo',
        description: 'Create a new todo/task item',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'The todo item text' },
            listName: { type: 'string', description: 'Which list to add it to (optional)' },
          },
          required: ['text'],
        },
      },
    },
    {
      type: 'function',
      messages: [
        { type: 'request-start', content: 'Adding that module for you.' },
        { type: 'request-complete', content: 'Module added.' },
      ],
      function: {
        name: 'add_module',
        description: 'Add a module to a page. If pageName is omitted, adds to the current active page.',
        parameters: {
          type: 'object',
          properties: {
            moduleType: {
              type: 'string',
              enum: ['todo', 'pomodoro', 'alarms', 'reminders', 'eisenhower', 'invites'],
              description: 'Type of module to add',
            },
            title: { type: 'string', description: 'Optional custom module title' },
            pageName: { type: 'string', description: 'Target page title (optional)' },
          },
          required: ['moduleType'],
        },
      },
    },
    {
      type: 'function',
      messages: [
        { type: 'request-start', content: 'Moving that module.' },
        { type: 'request-complete', content: 'Module moved.' },
      ],
      function: {
        name: 'move_module',
        description: 'Move an existing module to a different page by moduleId or by module type/title.',
        parameters: {
          type: 'object',
          properties: {
            moduleId: { type: 'string', description: 'Preferred: unique module instance ID' },
            moduleType: {
              type: 'string',
              enum: ['todo', 'pomodoro', 'alarms', 'reminders', 'eisenhower', 'invites'],
              description: 'Fallback module type when moduleId is unknown',
            },
            title: { type: 'string', description: 'Optional module title for fallback matching' },
            sourcePageName: { type: 'string', description: 'Optional source page title for fallback matching' },
            targetPageName: { type: 'string', description: 'Target page title' },
          },
          required: ['targetPageName'],
        },
      },
    },
    {
      type: 'function',
      messages: [
        { type: 'request-start', content: 'Creating that page.' },
        { type: 'request-complete', content: 'Page created.' },
      ],
      function: {
        name: 'create_page',
        description: 'Create a new sidebar page.',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Page title' },
            icon: { type: 'string', description: 'Optional icon name' },
          },
          required: ['title'],
        },
      },
    },
    {
      type: 'function',
      messages: [
        { type: 'request-start', content: 'Switching pages.' },
        { type: 'request-complete', content: 'Switched.' },
      ],
      function: {
        name: 'switch_page',
        description: 'Switch active sidebar page by title.',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Page title to switch to' },
          },
          required: ['title'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'create_alarm',
        description: 'Set an alarm at a specific time',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Alarm label' },
            time: { type: 'string', description: 'Time in HH:mm format (24 hour)' },
          },
          required: ['title', 'time'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'start_pomodoro',
        description: 'Start a pomodoro focus timer',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'stop_pomodoro',
        description: 'Stop the current pomodoro timer',
        parameters: { type: 'object', properties: {} },
      },
    },
    // ── Real-time data tools ──
    {
      type: 'function',
      messages: [
        { type: 'request-start', content: 'Let me look that up for you.' },
        { type: 'request-complete', content: 'Got it!' },
        { type: 'request-failed', content: 'Sorry, I had trouble searching for that.' },
      ],
      function: {
        name: 'search_web',
        description: 'Search the internet for current information, news, facts, or any topic the user asks about.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'The search query' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      messages: [
        { type: 'request-start', content: "Checking the weather now." },
        { type: 'request-complete', content: "Here's the weather." },
        { type: 'request-failed', content: "I couldn't get the weather at the moment." },
      ],
      function: {
        name: 'get_weather',
        description: 'Get current weather conditions for a city or location.',
        parameters: {
          type: 'object',
          properties: {
            location: { type: 'string', description: 'City name, e.g. "London" or "New York, US"' },
          },
          required: ['location'],
        },
      },
    },
    {
      type: 'function',
      messages: [
        { type: 'request-start', content: "Pulling up that stock price." },
        { type: 'request-complete', content: "Here are the numbers." },
        { type: 'request-failed', content: "I couldn't get that stock price right now." },
      ],
      function: {
        name: 'get_stock_price',
        description: 'Get the current stock price and key metrics for a ticker symbol.',
        parameters: {
          type: 'object',
          properties: {
            symbol: { type: 'string', description: 'Stock ticker symbol, e.g. "AAPL", "TSLA", "GOOGL"' },
          },
          required: ['symbol'],
        },
      },
    },
    {
      type: 'function',
      messages: [
        { type: 'request-start', content: "Let me check that flight." },
        { type: 'request-complete', content: "Here's the flight status." },
        { type: 'request-failed', content: "I couldn't get that flight info right now." },
      ],
      function: {
        name: 'get_flight_status',
        description: 'Get the real-time status, departure, and arrival info for a flight.',
        parameters: {
          type: 'object',
          properties: {
            flight_number: { type: 'string', description: 'IATA flight number, e.g. "BA142", "AA100"' },
          },
          required: ['flight_number'],
        },
      },
    },
    // ── Event management ──
    {
      type: 'function',
      messages: [
        { type: 'request-start', content: 'Deleting that event.' },
        { type: 'request-complete', content: 'Deleted.' },
        { type: 'request-failed', content: "I couldn't delete that event." },
      ],
      function: {
        name: 'delete_event',
        description: 'Delete a calendar event by its ID.',
        parameters: {
          type: 'object',
          properties: {
            eventId: { type: 'string', description: 'The ID of the event to delete' },
          },
          required: ['eventId'],
        },
      },
    },
    {
      type: 'function',
      messages: [
        { type: 'request-start', content: 'Moving that event.' },
        { type: 'request-complete', content: 'Rescheduled!' },
        { type: 'request-failed', content: "I couldn't reschedule that." },
      ],
      function: {
        name: 'reschedule_event',
        description: 'Move an existing event to a new date/time.',
        parameters: {
          type: 'object',
          properties: {
            eventId: { type: 'string', description: 'The ID of the event to reschedule' },
            newStart: { type: 'string', description: 'New start datetime in ISO8601 format' },
            newEnd: { type: 'string', description: 'New end datetime in ISO8601 format (optional)' },
          },
          required: ['eventId', 'newStart'],
        },
      },
    },
    // ── Todo management ──
    {
      type: 'function',
      messages: [
        { type: 'request-start', content: 'Marking that as done.' },
        { type: 'request-complete', content: 'Completed!' },
      ],
      function: {
        name: 'complete_todo',
        description: 'Mark a todo item as completed.',
        parameters: {
          type: 'object',
          properties: {
            todoId: { type: 'string', description: 'The ID of the todo to complete' },
          },
          required: ['todoId'],
        },
      },
    },
    {
      type: 'function',
      messages: [
        { type: 'request-start', content: 'Deleting that todo.' },
        { type: 'request-complete', content: 'Deleted.' },
      ],
      function: {
        name: 'delete_todo',
        description: 'Delete a todo item.',
        parameters: {
          type: 'object',
          properties: {
            todoId: { type: 'string', description: 'The ID of the todo to delete' },
          },
          required: ['todoId'],
        },
      },
    },
    // ── Eisenhower / Priority Matrix ──
    {
      type: 'function',
      messages: [
        { type: 'request-start', content: 'Adding that to your priority matrix.' },
        { type: 'request-complete', content: 'Added!' },
      ],
      function: {
        name: 'create_eisenhower',
        description: 'Add an item to the Eisenhower priority matrix.',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'The task description' },
            quadrant: {
              type: 'string',
              enum: ['urgent-important', 'not-urgent-important', 'urgent-not-important', 'not-urgent-not-important'],
              description: 'Which quadrant to place this item in',
            },
          },
          required: ['text', 'quadrant'],
        },
      },
    },
    // ── Goals ──
    {
      type: 'function',
      messages: [
        { type: 'request-start', content: 'Creating that goal.' },
        { type: 'request-complete', content: 'Goal created!' },
      ],
      function: {
        name: 'create_goal',
        description: 'Create a new goal for the user to track.',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string', description: 'Goal title' },
            category: { type: 'string', description: 'Category e.g. health, work, learning, personal' },
            frequency: { type: 'string', enum: ['daily', 'weekly', 'monthly'], description: 'How often to track progress' },
            target: { type: 'number', description: 'Target count per frequency period' },
          },
          required: ['title'],
        },
      },
    },
    // ── Alarm management ──
    {
      type: 'function',
      messages: [
        { type: 'request-start', content: 'Deleting that alarm.' },
        { type: 'request-complete', content: 'Alarm deleted.' },
      ],
      function: {
        name: 'delete_alarm',
        description: 'Delete an alarm by its ID.',
        parameters: {
          type: 'object',
          properties: {
            alarmId: { type: 'string', description: 'The ID of the alarm to delete' },
          },
          required: ['alarmId'],
        },
      },
    },
  ];
}

// ─── Service ─────────────────────────────────────────────────────────────────

class MallyVapiService {
  private vapi: Vapi | null = null;
  private callbacks: VapiCallbacks = {};
  private _isActive = false;
  private _isPreWarming = false;  // WebRTC handshake in progress (background)
  private _preWarmed = false;     // Connection ready, mic muted, waiting to activate
  private _isSpeaking = false;
  private _speakingTimer: ReturnType<typeof setTimeout> | null = null;
  private _onSpeakingChange: ((speaking: boolean) => void) | null = null;
  private _eventsAttached = false;
  private _intentionalStop = false;  // True when we killed the call on purpose (don't re-warm)
  private _startingSession = false;  // Debounce rapid "Hey Mally" activations

  // ── Getters ──

  get isAvailable(): boolean { return !!(import.meta.env.VITE_VAPI_PUBLIC_KEY); }
  get isActive(): boolean { return this._isActive; }
  get isSpeaking(): boolean { return this._isSpeaking; }
  /** True when pre-warm connected and ready — next startSession() will be instant */
  get isPreWarmed(): boolean { return this._preWarmed; }

  // ── Callbacks ──

  onSpeakingChange(cb: ((speaking: boolean) => void) | null) {
    this._onSpeakingChange = cb;
  }

  setCallbacks(cb: VapiCallbacks) {
    this.callbacks = cb;
  }

  // ── Internal ──

  private setSpeaking(v: boolean) {
    if (this._isSpeaking !== v) {
      this._isSpeaking = v;
      this._onSpeakingChange?.(v);
    }
  }

  private ensureVapi(): Vapi {
    if (!this.vapi) {
      const key = import.meta.env.VITE_VAPI_PUBLIC_KEY;
      if (!key) throw new Error('VITE_VAPI_PUBLIC_KEY not configured');
      this.vapi = new Vapi(key);
    }
    if (!this._eventsAttached) {
      this.attachEventHandlers();
      this._eventsAttached = true;
    }
    return this.vapi;
  }

  private attachEventHandlers() {
    const v = this.vapi!;

    v.on('call-start', () => {
      this._isActive = true;
      if (this._isPreWarming) {
        // Background pre-warm connected — mute immediately, mark ready
        console.log('[MallyVapi] ✓ Pre-warm ready — instant activation available');
        this._preWarmed = true;
        this._isPreWarming = false;
        v.setMuted(true); // Silent standby — no audio until user activates
      } else {
        console.log('[MallyVapi] Call started');
        this.callbacks.onCallStart?.();
      }
    });

    v.on('call-end', () => {
      const wasPreWarm = this._preWarmed || this._isPreWarming;
      const wasIntentional = this._intentionalStop;
      this._isActive = false;
      this._preWarmed = false;
      this._isPreWarming = false;
      this._intentionalStop = false;
      this.setSpeaking(false);
      if (this._speakingTimer) { clearTimeout(this._speakingTimer); this._speakingTimer = null; }
      
      if (wasIntentional) {
        // We stopped the call on purpose (e.g. during forceCleanup for a new session)
        // Don't re-warm — the caller is about to start a new session
        console.log('[MallyVapi] Call ended (intentional cleanup)');
        return;
      }
      
      if (wasPreWarm) {
        // Pre-warm timed out naturally — restart it
        console.log('[MallyVapi] Pre-warm timed out, re-warming in 3s...');
        setTimeout(() => this.preWarm(), 3000);
      } else {
        console.log('[MallyVapi] Call ended');
        this.callbacks.onCallEnd?.();
      }
    });

    v.on('speech-start', () => {
      if (this._preWarmed) return; // Ignore during standby
      this.setSpeaking(false);
      if (this._speakingTimer) { clearTimeout(this._speakingTimer); this._speakingTimer = null; }
      this.callbacks.onUserSpeechStart?.();
    });

    v.on('speech-end', () => {
      if (this._preWarmed) return;
      this.callbacks.onUserSpeechEnd?.();
    });

    v.on('message', (msg: any) => {
      if (this._preWarmed) return; // Ignore all messages during standby
      this.handleMessage(msg);
    });

    v.on('error', (err: any) => {
      if (this._isPreWarming || this._preWarmed) {
        console.warn('[MallyVapi] Pre-warm error (non-critical) — will cold-start on next activation:', err?.type);
        this._intentionalStop = true;
        this.forceCleanup();
        return;
      }
      console.error('[MallyVapi] Error type:', err?.type, '| stage:', err?.stage, '| error:', err?.error?.message ?? err?.error?.error ?? JSON.stringify(err?.error));
      this.callbacks.onError?.(err);
    });
  }

  private handleMessage(msg: any) {
    switch (msg.type) {
      case 'transcript': {
        if (msg.role === 'user') {
          this.callbacks.onUserTranscript?.(msg.transcript, msg.transcriptType === 'final');
        } else if (msg.role === 'assistant') {
          this.setSpeaking(true);
          if (this._speakingTimer) clearTimeout(this._speakingTimer);
          this._speakingTimer = setTimeout(() => this.setSpeaking(false), 1500);
          this.callbacks.onAssistantTranscript?.(msg.transcript, msg.transcriptType === 'final');
        }
        break;
      }
      case 'function-call': {
        this.handleToolCall(msg.functionCall);
        break;
      }
      case 'tool-calls': {
        for (const call of (msg.toolCallList || msg.toolCalls || [])) {
          this.handleToolCall(call);
        }
        break;
      }
      case 'hang': {
        console.log('[MallyVapi] Assistant initiated hang-up');
        break;
      }
    }
  }

  private async handleToolCall(call: any) {
    if (!call) return;
    const name = call?.function?.name || call?.name;
    if (!name) return;

    let args: Record<string, any> = {};
    try {
      const raw = call?.function?.arguments ?? call?.arguments ?? '{}';
      args = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch { args = {}; }

    console.log('[MallyVapi] Tool call:', name, args);

    let result = 'Done';
    if (this.callbacks.onToolCall) {
      try { result = await this.callbacks.onToolCall(name, args); }
      catch (e: any) { result = `Error: ${e?.message || 'Unknown error'}`; }
    }

    try {
      this.vapi?.send({
        type: 'add-message',
        message: { role: 'tool', content: result, tool_call_id: call?.id || `tool_${Date.now()}` } as any,
        triggerResponseEnabled: true,
      });
    } catch (e) { console.warn('[MallyVapi] Failed to send tool result:', e); }
  }

  // ── Public API ──

  /**
   * Pre-warm: establish WebRTC in background BEFORE "Hey Mally" is spoken.
   * When startSession() is called next, connection is already live → instant activation.
   * Call this: on user login, after each session ends.
   */
  async preWarm(voiceId = 'Lily'): Promise<void> {
    if (!this.isAvailable) return;
    // If already pre-warming or pre-warmed, no-op
    if (this._isPreWarming || this._preWarmed) return;
    // Don't pre-warm while a real session is starting
    if (this._startingSession) return;

    // Force cleanup any zombie/timed-out call first to avoid "multiple call instances"
    if (this._isActive || this.vapi) {
      this._intentionalStop = true;
      this.forceCleanup();
      await new Promise(r => setTimeout(r, 300)); // Let Daily.co SDK fully release
    }

    console.log('[MallyVapi] Pre-warming WebRTC connection...');
    this._isPreWarming = true;
    const vapi = this.ensureVapi();

    try {
      await vapi.start({
        name: 'Mally-Standby',
        transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en' },
        model: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: 'Standby. You are Mally. Wait silently for the user.' }],
          temperature: 0.7,
          maxTokens: 300,
        },
        voice: { provider: 'vapi', voiceId },
        silenceTimeoutSeconds: 120,
        maxDurationSeconds: 180,
        backgroundSound: 'off',
        clientMessages: [
          'conversation-update', 'function-call', 'hang', 'speech-update',
          'status-update', 'transcript', 'tool-calls', 'tool-calls-result', 'user-interrupted',
        ] as any,
      } as any);
      // call-start handler will mute mic and set _preWarmed = true
    } catch (err) {
      console.warn('[MallyVapi] Pre-warm failed (will cold-start on activation):', err);
      this._isPreWarming = false;
      this._preWarmed = false;
    }
  }

  /** Activate the pre-warmed session with full context — no WebRTC delay */
  private activatePreWarmed(options: VapiSessionOptions): void {
    const vapi = this.vapi!;
    this._preWarmed = false; // No longer in standby

    // Inject the full context system prompt
    try {
      vapi.send({
        type: 'add-message',
        message: { role: 'system', content: options.systemPrompt } as any,
      });
    } catch (e) {
      console.warn('[MallyVapi] Could not inject system prompt:', e);
    }

    // Un-mute → user can now speak, Vapi is live
    vapi.setMuted(false);

    // Say the greeting so the user immediately hears Mally (like Siri's "What can I help you with?")
    // We delay a beat so the audio pipeline has time to fully open after unmute.
    if (options.firstMessage) {
      setTimeout(() => {
        try {
          console.log('[MallyVapi] Saying greeting:', options.firstMessage);
          vapi.say(options.firstMessage!, /* endCallAfterSpoken */ false);
        } catch (e) {
          console.warn('[MallyVapi] Could not say greeting:', e);
        }
      }, 150);
    }

    // Fire onCallStart so the component shows the overlay as ready
    this.callbacks.onCallStart?.();
  }

  /** Start a voice session — instant if pre-warmed, otherwise cold-starts WebRTC */
  async startSession(options: VapiSessionOptions): Promise<void> {
    // Debounce rapid "Hey Mally" activations
    if (this._startingSession) {
      console.log('[MallyVapi] Session start already in progress, ignoring');
      return;
    }
    this._startingSession = true;
    // Reset intentional stop flag — this is a fresh session
    this._intentionalStop = false;

    try {
      // ── Fast path: pre-warm connection already live ──
      if (this._preWarmed && this._isActive && this.vapi) {
        console.log('[MallyVapi] ✓ Instant activation via pre-warm');
        this.activatePreWarmed(options);
        this._startingSession = false;  // Reset here since finally won't run after return
        return;
      }

      // ── If pre-warming in progress, wait for it (up to 3s) ──
      if (this._isPreWarming && this.vapi) {
        console.log('[MallyVapi] Pre-warm in progress, waiting...');
        const startWait = Date.now();
        while (this._isPreWarming && Date.now() - startWait < 3000) {
          await new Promise(r => setTimeout(r, 100));
        }
        // Check if pre-warm completed while we waited
        if (this._preWarmed && this._isActive && this.vapi) {
          console.log('[MallyVapi] ✓ Pre-warm completed while waiting — instant activation');
          this.activatePreWarmed(options);
          return;
        }
        // Pre-warm didn't complete in time — fall through to cold start
        console.log('[MallyVapi] Pre-warm did not complete in time, cold starting');
      }

      // ── Cold start: establish WebRTC from scratch ──
      // Clean up any stale session first to avoid "multiple call instances"
      if (this._isActive || this._isPreWarming || this.vapi) {
        console.log('[MallyVapi] Cleaning up before cold start');
        this._intentionalStop = true;  // Prevent call-end from scheduling new pre-warm
        this.forceCleanup();
        await new Promise(r => setTimeout(r, 300));
      }

      // Ensure AudioContext is running before Vapi tries to acquire the mic
      try {
        const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
        if (AudioContextClass) {
          const ctx = new AudioContextClass();
          if (ctx.state === 'suspended') await ctx.resume();
        }
      } catch {}

      const vapi = this.ensureVapi();
      const assistantId = import.meta.env.VITE_VAPI_ASSISTANT_ID;

      if (assistantId) {
        // Use dashboard assistant with dynamic context injected via overrides
        await vapi.start(assistantId, {
          variableValues: {
            systemPrompt: options.systemPrompt,
            ...(options.firstMessage ? { firstMessage: options.firstMessage } : {}),
          },
        } as any);
      } else {
        // Fallback: inline config (requires provider keys in Vapi dashboard)
        await vapi.start({
          name: 'Mally',
          ...(options.firstMessage ? { firstMessage: options.firstMessage } : {}),
          transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en' },
          model: {
            provider: 'openai',
            model: 'gpt-4o-mini',
            messages: [{ role: 'system', content: options.systemPrompt }],
            tools: buildMallyTools(),
            temperature: 0.7,
            maxTokens: 300,
          },
          voice: { provider: 'vapi', voiceId: options.voiceId ?? 'Lily' },
          silenceTimeoutSeconds: 30,
          maxDurationSeconds: 300,
          backgroundSound: 'off',
        } as any);
      }
    } catch (err: any) {
      console.error('[MallyVapi] Failed to start session:', JSON.stringify(err, null, 2));
      this.callbacks.onError?.(err);
      throw err;
    } finally {
      this._startingSession = false;
    }
  }

  /** Stop the current voice session */
  stop() {
    if (this._speakingTimer) { clearTimeout(this._speakingTimer); this._speakingTimer = null; }
    this.setSpeaking(false);
    this._preWarmed = false;
    this._isPreWarming = false;
    try { this.vapi?.stop(); } catch {}
    this._isActive = false;
  }

  /** Force cleanup - destroy Vapi instance entirely (use before re-creating) */
  forceCleanup() {
    if (this._speakingTimer) { clearTimeout(this._speakingTimer); this._speakingTimer = null; }
    this.setSpeaking(false);
    this._preWarmed = false;
    this._isPreWarming = false;
    this._isActive = false;
    this._intentionalStop = false;  // Reset so next session isn't affected
    if (this.vapi) {
      try { this.vapi.stop(); } catch {}
      // Remove all listeners and destroy instance to avoid "multiple call instances"
      try { (this.vapi as any).removeAllListeners?.(); } catch {}
      this.vapi = null;
      this._eventsAttached = false;
    }
  }

  setMuted(muted: boolean) { this.vapi?.setMuted(muted); }
  isMuted(): boolean { return this.vapi?.isMuted() ?? false; }
  say(message: string) { this.vapi?.say(message, false); }
}

export const mallyVapi = new MallyVapiService();

// Read the persisted voice preference from localStorage before React mounts.

if (typeof window !== 'undefined') {
  // HMR cleanup: destroy old instance when module reloads during development
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      console.log('[MallyVapi] HMR cleanup - destroying instance');
      mallyVapi.forceCleanup();
    });
  }
}
