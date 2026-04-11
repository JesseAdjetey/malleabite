import { useState, useEffect, useCallback, useRef } from 'react';
import Vapi from '@vapi-ai/web';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { sounds } from '@/lib/sounds';

// ─── Configuration ───────────────────────────────────────────────────
const VAPI_PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY || '';

// Lazily-created singleton
let _vapiInstance: InstanceType<typeof Vapi> | null = null;
function getVapi(): InstanceType<typeof Vapi> | null {
  if (!VAPI_PUBLIC_KEY) return null;
  if (!_vapiInstance) {
    _vapiInstance = new Vapi(VAPI_PUBLIC_KEY);
  }
  return _vapiInstance;
}

export type VoiceState =
  | 'idle'
  | 'connecting'
  | 'listening'
  | 'speaking'
  | 'error';

export interface UseMallyVoiceReturn {
  voiceState: VoiceState;
  startVoice: (opts?: { ptt?: boolean }) => void;
  stopVoice: () => void;
  /** Call on key/button release when in PTT mode — mutes mic so Mally processes & responds */
  pttRelease: () => void;
  transcript: string;
  volume: number;
  isVoiceReady: boolean;
  assistantText: string;
  lastAction: string;
}

// ─── Hook ────────────────────────────────────────────────────────────
export function useMallyVoice({
  onCommand,
  getContext,
}: {
  onCommand: (action: { type: string; data: any }) => Promise<boolean | string>;
  getContext: () => any;
}): UseMallyVoiceReturn {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [assistantText, setAssistantText] = useState('');
  const [volume, setVolume] = useState(0);
  const [lastAction, setLastAction] = useState('');

  const isActiveRef = useRef(false);
  const isPTTModeRef = useRef(false);
  // True when PTT key was released before Vapi finished connecting
  const pttReleasePendingRef = useRef(false);

  const webVoiceProcessorRef = useRef<any>(null);
  const picovoiceWorkerRef = useRef<any>(null);
  const picovoiceSubscribedRef = useRef(false);

  const onCommandRef = useRef(onCommand);
  const getContextRef = useRef(getContext);
  useEffect(() => { onCommandRef.current = onCommand; }, [onCommand]);
  useEffect(() => { getContextRef.current = getContext; }, [getContext]);

  const wakeWordEnabled = useSettingsStore((s) => s.wakeWordEnabled);
  const mallyVoiceId = useSettingsStore((s) => s.mallyVoiceId);


  // ── Build assistant config ─────────────────────────────────────────
  const buildAssistantConfig = useCallback((opts: { ptt?: boolean } = {}) => {
    const ctx = getContextRef.current();

    const systemPrompt = [
      'You are Mally, the unified Voice Assistant for the Malleabite productivity app.',
      'Be extremely concise — users are talking, not reading. No markdown.',
      'You have "God Mode" platform permissions. Execute actions immediately using the `execute_platform_action` tool.',
      '',
      'CRITICAL RULES:',
      '- NEVER ask the user for an ID. IDs are internal. Always use the title/name to reference items.',
      '- For delete/update, pass the title in the data and the system will resolve it.',
      '- If the user says "delete it" or "the event I just created", infer the title from the conversation.',
      '- Always act, then confirm. Do not ask for permission unless genuinely ambiguous.',
      '',
      '--- VALID PLATFORM ACTIONS (actionType) ---',
      '',
      'EVENTS:',
      '- "create_event"         data: { title, start (ISO), end (ISO), isRecurring?: bool, recurrenceRule?: "FREQ=DAILY"|"FREQ=WEEKLY;BYDAY=MO,WE,FR"|"FREQ=MONTHLY" etc }',
      '- "update_event"         data: { title (of event to update), newTitle?, start?, end?, calendarId? }',
      '- "delete_event"         data: { title (of event to delete) }',
      '- "reschedule_events"    data: { titlePattern?, fromDate?, daysOffset?: number, newDate? }',
      '- "query_events"         data: { date?, query? } — USE THIS when the user asks what they have scheduled.',
      '',
      'TO-DOS:',
      '- "create_todo"    data: { text }',
      '- "complete_todo"  data: { title }',
      '- "delete_todo"    data: { title }',
      '- "move_todo"      data: { title, listName }',
      '',
      'ALARMS & REMINDERS:',
      '- "create_alarm"    data: { title, time (ISO or "HH:MM" or "9:00 AM") }',
      '- "create_reminder" data: { title, reminderTime, description? }',
      '',
      'NAVIGATION:',
      '- "navigate_view"  data: { view: "settings"|"dashboard"|pageName }',
      '',
      'POMODORO / FOCUS TIMER:',
      '- "start_pomodoro" data: {}',
      '- "pause_pomodoro" data: {}',
      '- "reset_pomodoro" data: {}',
      '- "set_pomodoro_timer" data: { focusTime?: number, breakTime?: number }',
      '',
      'PAGES & MODULES:',
      '- "create_page"    data: { title }',
      '- "delete_page"    data: { title }',
      '- "add_module"     data: { moduleType: "todo"|"pomodoro"|"alarms"|"reminders"|"eisenhower", pageName? }',
      '- "remove_module"  data: { moduleType, pageName? }',
      '',
      'APPEARANCE:',
      '- "set_theme"      data: { theme: "light"|"dark"|"system" }',
      '',
      'HISTORY:',
      '- "undo"           data: {}',
      '- "redo"           data: {}',
      '',
      'COMMUNICATION:',
      '- "send_slack_message" data: { recipient, message }',
      '- "send_email"     data: { recipient, subject, body }',
      '-------------------------------------------',
      '',
      `Current time: ${new Date().toISOString()}`,
      `Active page: ${ctx?.sidebarPages?.find((p: any) => p.isActive)?.title || 'Dashboard'}`,
      `Events (${ctx?.events?.length ?? 0}):\n${
        ctx?.events?.length > 0
          ? ctx.events.map((e: any) => `- "${e.title}" at ${new Date(e.start || e.startsAt).toLocaleTimeString()}`).join('\n')
          : 'None'
      }`,
      `To-dos (${ctx?.todos?.length ?? 0}):\n${
        ctx?.todos?.length > 0
          ? ctx.todos.map((t: any) => `- "${t.text || t.title}" (${t.completed ? 'Done' : 'Pending'})`).join('\n')
          : 'None'
      }`,
    ].join('\n');

    const assistantConfig: any = {
      transcriber: {
        provider: 'deepgram' as const,
        model: 'nova-3',
        language: 'en' as const,
        smartFormat: true,
        // PTT: tighter endpointing since releasing the key is the real end-of-speech signal
        endpointing: opts.ptt ? 150 : 300,
        keywords: ['Mally', 'Malleabite', 'pomodoro', 'eisenhower'],
      },
      backgroundSound: 'off' as const,
      model: {
        provider: 'openai' as const,
        model: 'gpt-4o-mini' as const,
        messages: [{ role: 'system' as const, content: systemPrompt }],
        tools: [
          {
            type: 'function' as const,
            messages: [
              { type: 'request-start' as const, content: 'Executing action…' },
              { type: 'request-complete' as const, content: 'Done.' },
            ],
            function: {
              name: 'execute_platform_action',
              description: 'Executes ANY platform action. Provide the exact actionType and a JSON string of actionData.',
              parameters: {
                type: 'object' as const,
                properties: {
                  actionType: { type: 'string' as const, description: 'The exact type string from the list of valid actions.' },
                  actionDataJSON: { type: 'string' as const, description: 'A JSON stringified representation of the required data payload.' },
                },
                required: ['actionType', 'actionDataJSON'],
              },
            },
          },
        ],
      },
      voice: {
        provider: 'openai' as const,
        voiceId: (mallyVoiceId && ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].includes(mallyVoiceId)
          ? mallyVoiceId
          : 'nova') as any,
      },
      // No greeting — a firstMessage makes Mally speak before the user can,
      // blocking mic input for its entire duration.
      firstMessage: '',
    };

    const assistantOverrides = {
      startSpeakingPlan: {
        smartEndpointingPlan: { provider: 'livekit' as const },
      },
    };

    return { assistantConfig, assistantOverrides };
  }, [mallyVoiceId]);

  // ── Resume wake word (internal helper) ────────────────────────────
  const resumeWakeWordInternal = useCallback(() => {
    if (
      webVoiceProcessorRef.current &&
      picovoiceWorkerRef.current &&
      !picovoiceSubscribedRef.current &&
      useSettingsStore.getState().wakeWordEnabled
    ) {
      webVoiceProcessorRef.current
        .subscribe(picovoiceWorkerRef.current)
        .then(() => {
          picovoiceSubscribedRef.current = true;
          console.log('[MallyVoice] Resumed wake word detection.');
        })
        .catch(console.error);
    }
  }, []);

  // ── Start a voice session ──────────────────────────────────────────
  const startVoice = useCallback(async (opts: { ptt?: boolean } = {}) => {
    const vapi = getVapi();
    if (!vapi || isActiveRef.current) return;
    isActiveRef.current = true;
    isPTTModeRef.current = !!opts.ptt;
    pttReleasePendingRef.current = false;

    sounds.play('micOn');
    // PTT: show 'listening' immediately — no connecting screen.
    // Non-PTT (button/wake word): show 'connecting' during WebRTC setup.
    setVoiceState(opts.ptt ? 'listening' : 'connecting');
    setTranscript('');
    setAssistantText('');
    setLastAction('');

    // Only run the mic-release dance if Picovoice is actively holding the mic.
    // For PTT (no Picovoice), skip entirely — saves ~600ms of unnecessary delay.
    if (picovoiceSubscribedRef.current && webVoiceProcessorRef.current && picovoiceWorkerRef.current) {
      try {
        await webVoiceProcessorRef.current.unsubscribe(picovoiceWorkerRef.current);
        picovoiceSubscribedRef.current = false;
        console.log('[MallyVoice] Paused wake word detection to free up mic.');
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (e) {
        console.warn('[MallyVoice] Could not pause wake word:', e);
      }
    }

    const { assistantConfig, assistantOverrides } = buildAssistantConfig(opts);

    vapi.start(assistantConfig, assistantOverrides).catch((err: unknown) => {
      console.error('[MallyVoice] start error:', err);
      isActiveRef.current = false;
      isPTTModeRef.current = false;
      pttReleasePendingRef.current = false;
      setVoiceState('error');
      resumeWakeWordInternal();
    });
  }, [buildAssistantConfig, resumeWakeWordInternal]);

  // ── PTT release — mute mic so Vapi's endpointing fires → Mally responds ──
  const pttRelease = useCallback(() => {
    const vapi = getVapi();
    if (!isActiveRef.current) return;

    if (voiceState === 'connecting') {
      // Vapi not connected yet — flag it; mute will be applied on call-start
      pttReleasePendingRef.current = true;
      console.log('[MallyVoice] PTT released during connect — will mute on call-start.');
      return;
    }

    if (vapi && isPTTModeRef.current) {
      try {
        vapi.setMuted(true);
        console.log('[MallyVoice] PTT released — mic muted, waiting for Mally response.');
      } catch (e) {
        console.warn('[MallyVoice] setMuted failed:', e);
      }
    }
  }, [voiceState]);

  // ── Stop ───────────────────────────────────────────────────────────
  const stopVoice = useCallback(() => {
    const vapi = getVapi();
    if (vapi) vapi.stop();
    isActiveRef.current = false;
    isPTTModeRef.current = false;
    pttReleasePendingRef.current = false;
    setVoiceState('idle');
  }, []);

  // Keep startVoice in a ref so Porcupine callback always has the latest version
  const startVoiceRef = useRef(startVoice);
  useEffect(() => { startVoiceRef.current = startVoice; }, [startVoice]);

  // ── Vapi event listeners (mounted once) ────────────────────────────
  useEffect(() => {
    const vapi = getVapi();
    if (!vapi) return;

    const onCallStart = () => {
      isActiveRef.current = true;
      setVoiceState('listening');

      // If PTT key was released before we finished connecting, mute now
      if (pttReleasePendingRef.current) {
        pttReleasePendingRef.current = false;
        try {
          vapi.setMuted(true);
          console.log('[MallyVoice] PTT pending release applied — mic muted.');
        } catch (e) {
          console.warn('[MallyVoice] setMuted on call-start failed:', e);
        }
      }
    };

    const onCallEnd = () => {
      isActiveRef.current = false;
      isPTTModeRef.current = false;
      pttReleasePendingRef.current = false;
      setVoiceState('idle');
      resumeWakeWordInternal();
    };

    const onSpeechStart = () => setVoiceState('speaking');

    const onSpeechEnd = () => {
      setVoiceState('listening');
      // After Mally finishes speaking in PTT mode, unmute mic so next hold works
      if (isPTTModeRef.current) {
        try { vapi.setMuted(false); } catch (_) {}
      }
    };

    const onVolumeLevel = (lvl: number) => setVolume(lvl);

    const onError = (e: any) => {
      console.error('[MallyVoice] Vapi error:', e);
      isActiveRef.current = false;
      isPTTModeRef.current = false;
      pttReleasePendingRef.current = false;
      setVoiceState('error');
      resumeWakeWordInternal();
      setTimeout(() => setVoiceState('idle'), 3000);
    };

    const onMessage = (message: any) => {
      console.log('[MallyVoice] RAW message:', JSON.stringify(message));

      if (message.type === 'transcript' && message.role === 'user' && message.transcriptType === 'final') {
        setTranscript(message.transcript);
      }
      if (message.type === 'transcript' && message.role === 'assistant' && message.transcriptType === 'final') {
        setAssistantText(message.transcript);
      }

      const toolCallList: Array<{ id?: string; function: { name: string; arguments: string } }> =
        message.type === 'tool-calls'
          ? message.toolCallList
          : message.type === 'function-call'
          ? [{
              id: undefined,
              function: {
                name: message.functionCall?.name,
                arguments: typeof message.functionCall?.parameters === 'string'
                  ? message.functionCall.parameters
                  : JSON.stringify(message.functionCall?.parameters ?? {}),
              },
            }]
          : [];

      if (toolCallList.length === 0) return;

      const actionLabels: Record<string, string> = {
        create_event: 'Creating event…',
        update_event: 'Updating event…',
        delete_event: 'Deleting event…',
        reschedule_events: 'Rescheduling events…',
        query_events: 'Looking up your schedule…',
        create_alarm: 'Setting alarm…',
        create_reminder: 'Setting reminder…',
        create_todo: 'Adding to-do…',
        complete_todo: 'Completing to-do…',
        delete_todo: 'Deleting to-do…',
        move_todo: 'Moving to-do…',
        navigate_view: 'Navigating…',
        start_pomodoro: 'Starting focus timer…',
        pause_pomodoro: 'Pausing timer…',
        reset_pomodoro: 'Resetting timer…',
        set_pomodoro_timer: 'Updating timer settings…',
        create_page: 'Creating page…',
        delete_page: 'Deleting page…',
        add_module: 'Adding module…',
        remove_module: 'Removing module…',
        set_theme: 'Changing theme…',
        switch_theme: 'Changing theme…',
        undo: 'Undoing…',
        redo: 'Redoing…',
        send_slack_message: 'Sending Slack message…',
        send_email: 'Sending email…',
      };

      for (const toolCall of toolCallList) {
        const name = toolCall.function.name;

        let args: any = {};
        try {
          const raw = toolCall.function.arguments;
          args = typeof raw === 'string' ? JSON.parse(raw) : raw ?? {};
        } catch (e) {
          console.error('[MallyVoice] Failed to parse tool arguments:', toolCall.function.arguments, e);
        }

        if (args.actionDataJSON && typeof args.actionDataJSON !== 'string') {
          args.actionDataJSON = JSON.stringify(args.actionDataJSON);
        }
        const actionData = args.actionDataJSON
          ? (() => { try { return JSON.parse(args.actionDataJSON); } catch { return {}; } })()
          : {};

        console.log('[MallyVoice] Tool call resolved:', name, '| actionType:', args.actionType, '| data:', actionData);

        const actionType = name === 'execute_platform_action' ? args.actionType : name;
        setLastAction(actionLabels[actionType] ?? `Running ${actionType}…`);

        const execPromise = name === 'execute_platform_action'
          ? onCommandRef.current({ type: args.actionType, data: actionData })
          : onCommandRef.current({ type: name, data: args });

        execPromise
          .then((result) => {
            console.log('[MallyVoice] Tool execution result:', name, result);
            setLastAction('');

            if (typeof result === 'string') {
              vapi.send({
                type: 'add-message',
                message: { role: 'system', content: `Query result: ${result} Read this to the user conversationally.` },
              });
              return;
            }

            const success = result;
            const resultCtx = actionType === 'create_event'
              ? `Created event titled "${actionData.title}". You can now reference it by that name.`
              : actionType === 'create_todo'
              ? `Created to-do: "${actionData.text}". You can reference it by that text.`
              : actionType === 'delete_event'
              ? `Deleted event titled "${actionData.title}".`
              : actionType === 'delete_todo'
              ? `Deleted to-do: "${actionData.title || actionData.text}".`
              : actionType === 'complete_todo'
              ? `Marked to-do "${actionData.title || actionData.text}" as done.`
              : actionType === 'move_todo'
              ? `Moved to-do "${actionData.title || actionData.text}" to list "${actionData.listName}".`
              : actionType === 'reschedule_events'
              ? `Rescheduled events successfully.`
              : `Action "${actionType}" ${success ? 'completed successfully' : 'failed'}.`;
            vapi.send({
              type: 'add-message',
              message: { role: 'system', content: resultCtx },
            });
          })
          .catch((err) => {
            console.error('[MallyVoice] Tool execution error:', name, err);
            setLastAction('');
            vapi.send({
              type: 'add-message',
              message: { role: 'system', content: `Action "${actionType}" failed. Tell the user there was a problem.` },
            });
          });
      }
    };

    vapi.on('call-start', onCallStart);
    vapi.on('call-end', onCallEnd);
    vapi.on('speech-start', onSpeechStart);
    vapi.on('speech-end', onSpeechEnd);
    vapi.on('volume-level', onVolumeLevel);
    vapi.on('message', onMessage);
    vapi.on('error', onError);

    return () => {
      vapi.off('call-start', onCallStart);
      vapi.off('call-end', onCallEnd);
      vapi.off('speech-start', onSpeechStart);
      vapi.off('speech-end', onSpeechEnd);
      vapi.off('volume-level', onVolumeLevel);
      vapi.off('message', onMessage);
      vapi.off('error', onError);
    };
  }, [resumeWakeWordInternal]);

  // ── Picovoice Porcupine Wake Word ──────────────────────────────────
  useEffect(() => {
    if (!wakeWordEnabled) return;

    const accessKey = import.meta.env.VITE_PICOVOICE_ACCESS_KEY;
    const keywordBase64 = import.meta.env.VITE_PICOVOICE_KEYWORD_B64;

    if (!accessKey || !keywordBase64) {
      console.warn('[MallyVoice] Picovoice credentials missing — wake word disabled.');
      return;
    }

    let cancelled = false;

    const init = async () => {
      if (picovoiceWorkerRef.current) {
        if (!isActiveRef.current && !picovoiceSubscribedRef.current) {
          webVoiceProcessorRef.current?.subscribe(picovoiceWorkerRef.current)
            .then(() => { picovoiceSubscribedRef.current = true; })
            .catch(() => {});
        }
        return;
      }

      try {
        const { PorcupineWorker } = await import('@picovoice/porcupine-web');
        const { WebVoiceProcessor } = await import('@picovoice/web-voice-processor');

        if (cancelled) return;
        webVoiceProcessorRef.current = WebVoiceProcessor;

        const worker = await PorcupineWorker.create(
          accessKey,
          { base64: keywordBase64, label: 'Hey Mally', sensitivity: 0.9 },
          (detection: any) => {
            console.log('[MallyVoice] Wake word detected:', detection.label);
            if (!isActiveRef.current) {
              startVoiceRef.current();
            }
          },
          { publicPath: '/porcupine-params.pv' },
        );

        if (cancelled) { worker.release(); return; }

        picovoiceWorkerRef.current = worker;
        if (!isActiveRef.current) {
          await WebVoiceProcessor.subscribe(worker);
          picovoiceSubscribedRef.current = true;
          console.log('[MallyVoice] Porcupine wake word active.');
        }
      } catch (err) {
        console.error('[MallyVoice] Porcupine init error:', err);
      }
    };

    init();

    return () => {
      cancelled = true;
      if (picovoiceWorkerRef.current && webVoiceProcessorRef.current) {
        webVoiceProcessorRef.current.unsubscribe(picovoiceWorkerRef.current).catch(() => {});
        picovoiceWorkerRef.current.release();
        picovoiceWorkerRef.current = null;
        picovoiceSubscribedRef.current = false;
        console.log('[MallyVoice] Porcupine cleaned up.');
      }
    };
  }, [wakeWordEnabled]);

  return {
    voiceState,
    startVoice,
    stopVoice,
    pttRelease,
    transcript,
    assistantText,
    lastAction,
    volume,
    isVoiceReady: !!VAPI_PUBLIC_KEY,
  };
}
