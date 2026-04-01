// Mally Vapi Voice AI Service
// Uses Vapi's managed WebRTC voice sessions for full-duplex AI conversations.
//
// Requires: VITE_VAPI_PUBLIC_KEY (+ optionally VITE_VAPI_ASSISTANT_ID)
// Without VITE_VAPI_ASSISTANT_ID the inline config path is used, which requires
// OpenAI + Deepgram provider keys to be configured in the Vapi dashboard.

import Vapi from '@vapi-ai/web';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VapiCallbacks {
  onUserTranscript?: (text: string, isFinal: boolean) => void;
  onAssistantTranscript?: (text: string, isFinal: boolean) => void;
  onUserSpeechStart?: () => void;
  onUserSpeechEnd?: () => void;
  onCallStart?: () => void;
  onCallEnd?: () => void;
  onToolCall?: (name: string, args: Record<string, any>) => Promise<string>;
  onError?: (error: any) => void;
}

export interface VapiSessionOptions {
  systemPrompt: string;
  firstMessage?: string;
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
  private _isSpeaking = false;
  private _speakingTimer: ReturnType<typeof setTimeout> | null = null;
  private _onSpeakingChange: ((speaking: boolean) => void) | null = null;
  private _eventsAttached = false;
  private _startingSession = false;

  // ── Getters ──

  get isAvailable(): boolean { return !!(import.meta.env.VITE_VAPI_PUBLIC_KEY); }
  get isActive(): boolean { return this._isActive; }
  get isSpeaking(): boolean { return this._isSpeaking; }

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
      console.log('[MallyVapi] Call started');
      this.callbacks.onCallStart?.();
    });

    v.on('call-end', () => {
      this._isActive = false;
      this.setSpeaking(false);
      if (this._speakingTimer) { clearTimeout(this._speakingTimer); this._speakingTimer = null; }
      console.log('[MallyVapi] Call ended');
      this.callbacks.onCallEnd?.();
    });

    v.on('speech-start', () => {
      this.setSpeaking(false);
      if (this._speakingTimer) { clearTimeout(this._speakingTimer); this._speakingTimer = null; }
      this.callbacks.onUserSpeechStart?.();
    });

    v.on('speech-end', () => {
      this.callbacks.onUserSpeechEnd?.();
    });

    v.on('message', (msg: any) => {
      this.handleMessage(msg);
    });

    v.on('error', (err: any) => {
      console.error('[MallyVapi] Error:', err?.type, err?.error?.message ?? JSON.stringify(err?.error));
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

  /** Start a voice session. Must be called from within a user gesture (tap/click). */
  async startSession(options: VapiSessionOptions): Promise<void> {
    if (this._startingSession) {
      console.log('[MallyVapi] Session start already in progress, ignoring');
      return;
    }
    this._startingSession = true;

    try {
      // Clean up any stale session first
      if (this._isActive || this.vapi) {
        this.forceCleanup();
        await new Promise(r => setTimeout(r, 300));
      }

      const vapi = this.ensureVapi();
      const assistantId = import.meta.env.VITE_VAPI_ASSISTANT_ID;

      if (assistantId) {
        // Dashboard assistant — uses Vapi's built-in provider keys
        await vapi.start(assistantId, {
          assistantOverrides: {
            ...(options.firstMessage ? { firstMessage: options.firstMessage } : {}),
            variableValues: { systemPrompt: options.systemPrompt },
          },
        } as any);
      } else {
        // Inline config — requires OpenAI + Deepgram provider keys in Vapi dashboard settings
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
    try { this.vapi?.stop(); } catch {}
    this._isActive = false;
  }

  /** Destroy Vapi instance entirely */
  forceCleanup() {
    if (this._speakingTimer) { clearTimeout(this._speakingTimer); this._speakingTimer = null; }
    this.setSpeaking(false);
    this._isActive = false;
    if (this.vapi) {
      try { this.vapi.stop(); } catch {}
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

if (typeof window !== 'undefined' && import.meta.hot) {
  import.meta.hot.dispose(() => {
    console.log('[MallyVapi] HMR cleanup');
    mallyVapi.forceCleanup();
  });
}
