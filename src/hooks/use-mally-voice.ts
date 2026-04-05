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
  startVoice: () => void;
  stopVoice: () => void;
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
  const webVoiceProcessorRef = useRef<any>(null);
  const picovoiceWorkerRef = useRef<any>(null);

  const onCommandRef = useRef(onCommand);
  const getContextRef = useRef(getContext);
  useEffect(() => { onCommandRef.current = onCommand; }, [onCommand]);
  useEffect(() => { getContextRef.current = getContext; }, [getContext]);

  // Read the settings reactively
  const wakeWordEnabled = useSettingsStore((s) => s.wakeWordEnabled);
  const mallyVoiceId = useSettingsStore((s) => s.mallyVoiceId);

  // ── Start a voice session ──────────────────────────────────────────
  const startVoice = useCallback(async () => {
    const vapi = getVapi();
    if (!vapi || isActiveRef.current) return;
    isActiveRef.current = true;

    // Instant audio feedback so the user knows Mally heard them
    sounds.play('micOn');

    setVoiceState('connecting');
    setTranscript('');
    setAssistantText('');
    setLastAction('');

    // Yield mic from Picovoice to prevent Krisp/Daily.co crashes.
    // We must stop the underlying MediaStream tracks (not just unsubscribe) so the
    // OS fully releases the hardware microphone lock before Vapi tries to open it.
    if (webVoiceProcessorRef.current && picovoiceWorkerRef.current) {
      try {
        await webVoiceProcessorRef.current.unsubscribe(picovoiceWorkerRef.current);
        console.log('[MallyVoice] Paused wake word detection to free up mic.');
      } catch (e) {
        console.warn('[MallyVoice] Could not pause wake word:', e);
      }
    }
    // Stop any lingering MediaStream tracks so the hardware mic is truly released.
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (devices.length > 0) {
        // getUserMedia just to enumerate — we close it immediately to flush any lock
        const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        tempStream.getTracks().forEach(t => t.stop());
      }
    } catch (_) { /* permission already granted — ignore errors */ }
    // Give the OS 400ms to reclaim and re-open the mic cleanly
    await new Promise((resolve) => setTimeout(resolve, 400));

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
      '- "update_event"         data: { title (of event to update), newTitle?, start?, end?, calendarId? (to move to another calendar) }',
      '- "delete_event"         data: { title (of event to delete) }',
      '- "reschedule_events"    data: { titlePattern? (partial title), fromDate? (ISO date of events to move), daysOffset?: number, newDate?: (ISO date to move to) }',
      '- "query_events"         data: { date?: (ISO date e.g. "2026-04-06"), query?: (keyword search) } — USE THIS when the user asks what they have scheduled. Returns spoken result.',
      '',
      'TO-DOS:',
      '- "create_todo"    data: { text }',
      '- "complete_todo"  data: { title (todo text to mark done) }',
      '- "delete_todo"    data: { title (todo text to delete) }',
      '- "move_todo"      data: { title (todo text to move), listName (target list name) }',
      '',
      'ALARMS & REMINDERS:',
      '- "create_alarm"    data: { title, time (ISO or "HH:MM" or "9:00 AM") }',
      '- "create_reminder" data: { title, reminderTime (ISO or "HH:MM" or "9:00 AM"), description? }',
      '',
      'NAVIGATION:',
      '- "navigate_view"  data: { view: "settings"|"dashboard"|pageName }',
      '',
      'POMODORO / FOCUS TIMER:',
      '- "start_pomodoro" data: {}',
      '- "pause_pomodoro" data: {}',
      '- "reset_pomodoro" data: {}',
      '- "set_pomodoro_timer" data: { focusTime?: number (minutes), breakTime?: number (minutes) }',
      '',
      'PAGES & MODULES:',
      '- "create_page"    data: { title }',
      '- "delete_page"    data: { title (page name to delete) }',
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

    // First arg: CreateAssistantDTO — transcriber, model, voice, firstMessage, backgroundSound
    // Second arg: AssistantOverrides — startSpeakingPlan (smart endpointing lives here)
    const assistantConfig = {
      // ── Transcription ────────────────────────────────────────────────
      // nova-3 is Deepgram's most accurate model for conversational speech.
      // smartFormat cleans up punctuation/numbers. endpointing=300ms gives
      // a natural pause before the AI responds without cutting the user off.
      transcriber: {
        provider: 'deepgram' as const,
        model: 'nova-3',
        language: 'en' as const,
        smartFormat: true,
        endpointing: 300,
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
                  actionType: { type: 'string' as const, description: 'The exact type string from the list of valid actions (e.g. create_todo, add_module, set_theme, undo).' },
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
        voiceId: (mallyVoiceId && ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'].includes(mallyVoiceId) ? mallyVoiceId : 'nova') as any,
      },
      firstMessage: "Hey! I'm listening.",
    };

    // AssistantOverrides: startSpeakingPlan (LiveKit smart endpointing) lives here.
    // LiveKit uses a neural model to detect when the user is truly done speaking
    // rather than relying purely on silence duration — prevents Mally cutting you off.
    const assistantOverrides = {
      startSpeakingPlan: {
        smartEndpointingPlan: { provider: 'livekit' as const },
      },
    };

    vapi.start(assistantConfig, assistantOverrides).catch((err: unknown) => {
      console.error('[MallyVoice] start error:', err);
      isActiveRef.current = false;
      setVoiceState('error');
      if (webVoiceProcessorRef.current && picovoiceWorkerRef.current && useSettingsStore.getState().wakeWordEnabled) {
         webVoiceProcessorRef.current.subscribe(picovoiceWorkerRef.current).catch(console.error);
      }
    });
  }, []);

  // ── Stop ───────────────────────────────────────────────────────────
  const stopVoice = useCallback(() => {
    const vapi = getVapi();
    if (vapi) vapi.stop();
    isActiveRef.current = false;
    setVoiceState('idle');
  }, []);

  // Keep startVoice in a ref so the Porcupine callback always has the latest
  const startVoiceRef = useRef(startVoice);
  useEffect(() => { startVoiceRef.current = startVoice; }, [startVoice]);

  // ── Vapi event listeners (mounted once) ────────────────────────────
  useEffect(() => {
    const vapi = getVapi();
    if (!vapi) return;

    const onCallStart = () => {
      isActiveRef.current = true;
      setVoiceState('listening');
    };
    
    // Helper to resume wake word after call ends or errors
    const resumeWakeWord = () => {
      if (webVoiceProcessorRef.current && picovoiceWorkerRef.current && useSettingsStore.getState().wakeWordEnabled) {
        webVoiceProcessorRef.current.subscribe(picovoiceWorkerRef.current).catch(console.error);
        console.log('[MallyVoice] Resumed wake word detection.');
      }
    };

    const onCallEnd = () => {
      isActiveRef.current = false;
      setVoiceState('idle');
      resumeWakeWord();
    };
    const onSpeechStart = () => setVoiceState('speaking');
    const onSpeechEnd = () => setVoiceState('listening');
    const onVolumeLevel = (lvl: number) => setVolume(lvl);

    const onError = (e: any) => {
      console.error('[MallyVoice] Vapi error:', e);
      isActiveRef.current = false;
      setVoiceState('error');
      resumeWakeWord();
      setTimeout(() => setVoiceState('idle'), 3000);
    };

    const onMessage = (message: any) => {
      // Log every single message so we can see what Vapi is actually sending
      console.log('[MallyVoice] RAW message:', JSON.stringify(message));

      if (message.type === 'transcript' && message.role === 'user' && message.transcriptType === 'final') {
        setTranscript(message.transcript);
      }
      if (message.type === 'transcript' && message.role === 'assistant' && message.transcriptType === 'final') {
        setAssistantText(message.transcript);
      }

      // Vapi v2 sends "tool-calls" with a toolCallList array.
      // Older builds sent "function-call" with a functionCall object — handle both.
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

        // Parse arguments — handle both JSON string and plain object
        let args: any = {};
        try {
          const raw = toolCall.function.arguments;
          args = typeof raw === 'string' ? JSON.parse(raw) : raw ?? {};
        } catch (e) {
          console.error('[MallyVoice] Failed to parse tool arguments:', toolCall.function.arguments, e);
        }

        // Parse actionDataJSON — handle both JSON string and plain object
        if (args.actionDataJSON && typeof args.actionDataJSON !== 'string') {
          args.actionDataJSON = JSON.stringify(args.actionDataJSON);
        }
        const actionData = args.actionDataJSON
          ? (() => { try { return JSON.parse(args.actionDataJSON); } catch { return {}; } })()
          : {};

        console.log('[MallyVoice] Tool call resolved:', name, '| actionType:', args.actionType, '| data:', actionData);

        const actionType = name === 'execute_platform_action' ? args.actionType : name;
        setLastAction(actionLabels[actionType] ?? `Running ${actionType}…`);

        // Map the god-tool to a native action payload
        const execPromise = name === 'execute_platform_action'
          ? onCommandRef.current({ type: args.actionType, data: actionData })
          : onCommandRef.current({ type: name, data: args });

        execPromise
          .then((result) => {
            console.log('[MallyVoice] Tool execution result:', name, result);
            setLastAction('');

            // If the action returned a string (e.g. query_events), inject it directly
            // so the AI speaks the answer without further processing.
            if (typeof result === 'string') {
              vapi.send({
                type: 'add-message',
                message: { role: 'system', content: `Query result: ${result} Read this to the user conversationally.` },
              });
              return;
            }

            const success = result;
            // Include the action context so the model knows exactly what was done
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
  }, []);

  // ── Picovoice Porcupine Wake Word (conditional on setting) ─────────
  useEffect(() => {
    // Only initialise when the user has opted in
    if (!wakeWordEnabled) return;

    const accessKey = import.meta.env.VITE_PICOVOICE_ACCESS_KEY;
    const keywordBase64 = import.meta.env.VITE_PICOVOICE_KEYWORD_B64;

    if (!accessKey || !keywordBase64) {
      console.warn('[MallyVoice] Picovoice credentials missing — wake word disabled.');
      return;
    }

    let cancelled = false;
    let workerRef: any = null;

    const init = async () => {
      if (picovoiceWorkerRef.current) {
        if (!isActiveRef.current) {
           webVoiceProcessorRef.current?.subscribe(picovoiceWorkerRef.current).catch(()=>{});
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
          {
            base64: keywordBase64,
            label: 'Hey Mally',
            sensitivity: 0.9, // High sensitivity — picks up normal speech volume
          },
          (detection: any) => {
            console.log('[MallyVoice] Wake word detected:', detection.label);
            if (!isActiveRef.current) {
              startVoiceRef.current();
            }
          },
          { publicPath: '/porcupine-params.pv' },
        );

        if (cancelled) {
          worker.release();
          return;
        }

        picovoiceWorkerRef.current = worker;
        if (!isActiveRef.current) {
          await WebVoiceProcessor.subscribe(worker);
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
         webVoiceProcessorRef.current.unsubscribe(picovoiceWorkerRef.current).catch(()=>{});
         picovoiceWorkerRef.current.release();
         picovoiceWorkerRef.current = null;
         console.log('[MallyVoice] Porcupine cleaned up.');
      }
    };
  }, [wakeWordEnabled]);

  return {
    voiceState,
    startVoice,
    stopVoice,
    transcript,
    assistantText,
    lastAction,
    volume,
    isVoiceReady: !!VAPI_PUBLIC_KEY,
  };
}
