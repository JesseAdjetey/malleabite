import { useState, useEffect, useCallback, useRef } from 'react';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { sounds } from '@/lib/sounds';
import { auth } from '@/integrations/firebase/config';

// ─── Configuration ────────────────────────────────────────────────────
const PROJECT_ID = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'malleabite-97d35';
const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
const TOKEN_URL = isLocal 
  ? `http://localhost:5001/${PROJECT_ID}/us-central1/getMallyRealtimeToken`
  : `https://us-central1-${PROJECT_ID}.cloudfunctions.net/getMallyRealtimeToken`;
const OPENAI_REALTIME_URL = 'https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';

const VALID_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse'];

const ACTION_LABELS: Record<string, string> = {
  create_event: 'Creating event…',
  update_event: 'Updating event…',
  delete_event: 'Deleting event…',
  reschedule_events: 'Rescheduling events…',
  query_events: 'Looking up schedule…',
  create_alarm: 'Setting alarm…',
  create_reminder: 'Setting reminder…',
  create_todo: 'Adding to-do…',
  complete_todo: 'Completing to-do…',
  delete_todo: 'Deleting to-do…',
  move_todo: 'Moving to-do…',
  navigate_view: 'Navigating…',
  start_pomodoro: 'Starting timer…',
  pause_pomodoro: 'Pausing timer…',
  reset_pomodoro: 'Resetting timer…',
  set_pomodoro_timer: 'Updating timer…',
  create_page: 'Creating page…',
  delete_page: 'Deleting page…',
  add_module: 'Adding module…',
  remove_module: 'Removing module…',
  set_theme: 'Changing theme…',
  switch_theme: 'Changing theme…',
  undo: 'Undoing…',
  redo: 'Redoing…',
  send_slack_message: 'Sending message…',
  send_email: 'Sending email…',
};

export type VoiceState = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error';

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

// ─── Hook ─────────────────────────────────────────────────────────────
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
  const responseActiveRef = useRef(false);

  // OpenAI Realtime references
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Web Speech API references
  const recognitionRef = useRef<any>(null);

  const onCommandRef = useRef(onCommand);
  const getContextRef = useRef(getContext);
  useEffect(() => { onCommandRef.current = onCommand; }, [onCommand]);
  useEffect(() => { getContextRef.current = getContext; }, [getContext]);

  const wakeWordEnabled = useSettingsStore((s) => s.wakeWordEnabled);
  const mallyVoiceId = useSettingsStore((s) => s.mallyVoiceId);

  // ── Resume wake word (internal helper) ────────────────────────────
  const resumeWakeWordInternal = useCallback(() => {
    if (
      recognitionRef.current &&
      useSettingsStore.getState().wakeWordEnabled
    ) {
      try {
        recognitionRef.current.start();
        console.log('[MallyVoice] Resumed native Web Speech wake word detection.');
      } catch (e) {
        // Ignored. Start throws if already started.
      }
    }
  }, []);

  // ── Build system prompt with live context ──────────────────────────
  const buildSystemPrompt = useCallback(() => {
    const ctx = getContextRef.current();
    return [
      'You are Mally, the unified Voice Assistant for the Malleabite productivity app.',
      'Be extremely concise — users are talking, not reading. No markdown.',
      'You have "God Mode" platform permissions. Execute actions immediately using the execute_platform_action tool.',
      '',
      'CRITICAL RULES:',
      '- NEVER ask the user for an ID. IDs are internal. Always use the title/name.',
      '- For delete/update, pass the title and the system will resolve it.',
      '- If the user says "delete it" or "the one I just created", infer from context.',
      '- Always act, then confirm. Do not ask for permission unless genuinely ambiguous.',
      '',
      '--- VALID PLATFORM ACTIONS (actionType) ---',
      'EVENTS:',
      '  create_event      { title, start (ISO), end (ISO), isRecurring?, recurrenceRule? }',
      '  update_event      { title, newTitle?, start?, end?, calendarId? }',
      '  delete_event      { title }',
      '  reschedule_events { titlePattern?, fromDate?, daysOffset?, newDate? }',
      '  query_events      { date?, query? }  ← use when asked what is scheduled',
      'TO-DOS:',
      '  create_todo  { text }',
      '  complete_todo { title }',
      '  delete_todo  { title }',
      '  move_todo    { title, listName }',
      'ALARMS & REMINDERS:',
      '  create_alarm    { title, time }',
      '  create_reminder { title, reminderTime, description? }',
      'OTHER:',
      '  navigate_view    { view: "settings"|"dashboard"|pageName }',
      '  start_pomodoro | pause_pomodoro | reset_pomodoro | set_pomodoro_timer { focusTime?, breakTime? }',
      '  create_page | delete_page  { title }',
      '  add_module | remove_module { moduleType, pageName? }',
      '  set_theme  { theme: "light"|"dark"|"system" }',
      '  undo | redo  {}',
      '  send_slack_message { recipient, message }',
      '  send_email         { recipient, subject, body }',
      '-------------------------------------------',
      '',
      `Current time: ${new Date().toISOString()}`,
      `Active page: ${ctx?.sidebarPages?.find((p: any) => p.isActive)?.title || 'Dashboard'}`,
      `Events (${ctx?.events?.length ?? 0}): ${
        ctx?.events?.length > 0
          ? ctx.events.map((e: any) => `"${e.title}" at ${new Date(e.start || e.startsAt).toLocaleTimeString()}`).join(', ')
          : 'None'
      }`,
      `To-dos (${ctx?.todos?.length ?? 0}): ${
        ctx?.todos?.length > 0
          ? ctx.todos.map((t: any) => `"${t.text || t.title}" (${t.completed ? 'Done' : 'Pending'})`).join(', ')
          : 'None'
      }`,
    ].join('\n');
  }, []);

  // ── Stop ───────────────────────────────────────────────────────────
  const stopVoice = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    dcRef.current = null;
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    isActiveRef.current = false;
    isPTTModeRef.current = false;
    setVoiceState('idle');
    setVolume(0);
    resumeWakeWordInternal();
  }, [resumeWakeWordInternal]);

  // ── PTT release — mute mic so Mally responds ───────────────────────
  const pttRelease = useCallback(() => {
    if (!isActiveRef.current || !isPTTModeRef.current) return;
    
    if (dcRef.current?.readyState === 'open') {
      console.log('[MallyVoice] PTT released — forcing OpenAI response early.');
      dcRef.current.send(JSON.stringify({ type: 'input_audio_buffer.commit' }));
      dcRef.current.send(JSON.stringify({ type: 'response.create' }));
    }
  }, []);

  // ── Start ──────────────────────────────────────────────────────────
  const startVoice = useCallback(async (opts: { ptt?: boolean } = {}) => {
    if (isActiveRef.current) return;
    isActiveRef.current = true;
    isPTTModeRef.current = !!opts.ptt;

    sounds.play('micOn');
    setVoiceState(opts.ptt ? 'listening' : 'connecting');
    setTranscript('');
    setAssistantText('');
    setLastAction('');

    // Pause wake word before grabbing mic
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
        console.log('[MallyVoice] Paused native wake word detection to free up mic.');
        await new Promise((resolve) => setTimeout(resolve, 100)); // Brief pause
      } catch (e) {
        // Ignored
      }
    }

    try {
      // 1. Fetch ephemeral token from Firebase function (key stays server-side)
      const currentUser = auth.currentUser;
      const authToken = currentUser ? await currentUser.getIdToken() : null;
      const voice = VALID_VOICES.includes(mallyVoiceId ?? '') ? mallyVoiceId! : 'nova';

      const tokenRes = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({ voice }),
      });
      if (!tokenRes.ok) throw new Error(`Token fetch failed: ${tokenRes.status}`);
      const { token } = await tokenRes.json();

      // 2. WebRTC peer connection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Output: OpenAI's audio → hidden <audio> element (autoplay)
      if (!audioElRef.current) {
        audioElRef.current = document.createElement('audio');
        audioElRef.current.autoplay = true;
        document.body.appendChild(audioElRef.current);
      }
      pc.ontrack = (e) => {
        if (audioElRef.current) audioElRef.current.srcObject = e.streams[0];
      };

      // Input: user mic → WebRTC track
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      // 3. Data channel for events
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      const sendEvent = (obj: object) => {
        if (dcRef.current?.readyState === 'open') {
          dcRef.current.send(JSON.stringify(obj));
        }
      };

      const safeResponseCreate = () => {
        if (!responseActiveRef.current) {
          responseActiveRef.current = true;
          sendEvent({ type: 'response.create' });
        }
      };

      dc.onopen = () => {
        console.log('[MallyVoice] Data channel open — configuring session.');
        setVoiceState('listening');

        // Configure session: voice, instructions, VAD, tools, transcription
        sendEvent({
          type: 'session.update',
          session: {
            instructions: buildSystemPrompt(),
            input_audio_transcription: { model: 'whisper-1' },
            turn_detection: {
              type: 'server_vad',
              silence_duration_ms: opts.ptt ? 10000 : 600, // OpenAI max is 10s
              threshold: 0.5,
              prefix_padding_ms: 300,
            },
            tools: [
              {
                type: 'function',
                name: 'execute_platform_action',
                description: 'Executes ANY action on the Malleabite app. Use this for ALL user requests.',
                parameters: {
                  type: 'object',
                  properties: {
                    actionType: {
                      type: 'string',
                      description: 'The exact action type string, e.g. create_event, create_todo, set_theme, undo.',
                    },
                    actionDataJSON: {
                      type: 'string',
                      description: 'JSON-stringified data payload for the action.',
                    },
                  },
                  required: ['actionType', 'actionDataJSON'],
                },
              },
            ],
            tool_choice: 'auto',
          },
        });

        // Trigger opening greeting only if NOT in PTT
        if (!opts.ptt) {
          sendEvent({
            type: 'conversation.item.create',
            item: {
              type: 'message',
              role: 'user',
              content: [{ type: 'input_text', text: '[System] Greet the user very briefly — one sentence, say you are listening.' }],
            },
          });
          safeResponseCreate();
        }
      };

      dc.onmessage = (e) => {
        let event: any;
        try { event = JSON.parse(e.data); } catch { return; }

        switch (event.type) {
          case 'input_audio_buffer.speech_started':
            setVoiceState('listening');
            break;

          case 'response.created':
            responseActiveRef.current = true;
            break;

          case 'response.done':
            responseActiveRef.current = false;
            break;

          case 'response.audio.delta':
            setVoiceState('speaking');
            setVolume(0.8);
            break;

          case 'response.audio.done':
            setVoiceState('listening');
            setVolume(0);
            break;

          case 'response.audio_transcript.delta':
            setAssistantText(prev => prev + (event.delta || ''));
            break;

          case 'response.audio_transcript.done':
            setAssistantText(event.transcript || '');
            break;

          case 'conversation.item.input_audio_transcription.completed':
            setTranscript(event.transcript || '');
            break;

          // Tool call
          case 'response.output_item.done': {
            const item = event.item;
            if (item?.type !== 'function_call') break;

            const callId = item.call_id;
            let args: any = {};
            try { args = JSON.parse(item.arguments || '{}'); } catch {}

            const actionData = args.actionDataJSON
              ? (() => { try { return JSON.parse(args.actionDataJSON); } catch { return {}; } })()
              : {};
            const actionType = item.name === 'execute_platform_action' ? args.actionType : item.name;

            console.log('[MallyVoice] Tool call:', actionType, actionData);
            setLastAction(ACTION_LABELS[actionType] ?? `Running ${actionType}…`);

            onCommandRef.current({ type: actionType, data: actionData })
              .then((result) => {
                setLastAction('');
                const output = typeof result === 'string'
                  ? `Query result: ${result}. Read this to the user conversationally.`
                  : `Action "${actionType}" ${result ? 'completed successfully' : 'failed'}.`;
                sendEvent({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output } });
                safeResponseCreate();
              })
              .catch((err) => {
                console.error('[MallyVoice] Tool error:', err);
                setLastAction('');
                sendEvent({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: `Action "${actionType}" failed. Tell the user there was a problem.` } });
                safeResponseCreate();
              });
            break;
          }

          case 'error':
            console.error('[MallyVoice] Realtime error:', event.error);
            setVoiceState('error');
            isActiveRef.current = false;
            isPTTModeRef.current = false;
            setTimeout(() => {
              setVoiceState('idle');
              resumeWakeWordInternal();
            }, 3000);
            break;
        }
      };

      dc.onclose = () => {
        if (isActiveRef.current) {
          isActiveRef.current = false;
          isPTTModeRef.current = false;
          setVoiceState('idle');
          resumeWakeWordInternal();
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          console.warn('[MallyVoice] WebRTC connection lost:', pc.connectionState);
          isActiveRef.current = false;
          isPTTModeRef.current = false;
          setVoiceState('error');
          setTimeout(() => {
             setVoiceState('idle');
             resumeWakeWordInternal();
          }, 3000);
        }
      };

      // 4. SDP handshake with OpenAI
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(OPENAI_REALTIME_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      });

      if (!sdpRes.ok) throw new Error(`SDP exchange failed: ${sdpRes.status} ${await sdpRes.text()}`);
      const sdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: 'answer', sdp });

      console.log('[MallyVoice] OpenAI Realtime connected via WebRTC.');
    } catch (err: any) {
      console.error('[MallyVoice] startVoice error:', err);
      isActiveRef.current = false;
      isPTTModeRef.current = false;
      setVoiceState('error');
      resumeWakeWordInternal();
      setTimeout(() => setVoiceState('idle'), 3000);
    }
  }, [mallyVoiceId, buildSystemPrompt, resumeWakeWordInternal]);

  // Keep startVoice in a ref so the wake word callback always has the latest
  const startVoiceRef = useRef(startVoice);
  useEffect(() => { startVoiceRef.current = startVoice; }, [startVoice]);

  // ── Native Web Speech API Wake Word (Free & Limitless) ─────────────
  useEffect(() => {
    if (!wakeWordEnabled) return;

    // Check browser support
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      console.warn('[MallyVoice] Web Speech API not supported in this browser. Wake word disabled.');
      return;
    }

    let isCancelled = false;
    let isDictatingPause = false;
    const recognition = new SpeechRecognitionAPI();
    recognitionRef.current = recognition;

    const handlePause = () => {
      isDictatingPause = true;
      try { recognition.abort(); } catch (e) {}
    };

    const handleResume = () => {
      isDictatingPause = false;
      if (!isCancelled && wakeWordEnabled && !isActiveRef.current) {
        try { recognition.start(); } catch (e) {}
      }
    };

    window.addEventListener('pause-wake-word', handlePause);
    window.addEventListener('resume-wake-word', handleResume);

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      if (isActiveRef.current) return;

      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        currentTranscript += event.results[i][0].transcript;
      }
      
      const normalized = currentTranscript.toLowerCase().replace(/[.,!?]/g, '').trim();
      
      // Look for variants of the wake word
      if (normalized.includes('mally') || normalized.includes('mali') || normalized.includes('hey mali')) {
        console.log('[MallyVoice] Wake word detected natively:', normalized);
        
        try {
          // Immediately abort background listening so it frees the mic for OpenAI
          recognition.abort();
        } catch (e) {}

        if (!isActiveRef.current) {
          // Start the realtime agent pipeline. Let it auto-greet since the user just said the wake word.
          startVoiceRef.current();
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'audio-capture') {
        console.error('[MallyVoice] Microphone permission denied or unavailable for native wake word.');
        isCancelled = true;
      } else if (event.error !== 'aborted') {
        // "aborted" is totally normal when we manually pause it or detect the wake word
        console.warn(`[MallyVoice] Native Speech recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      // Browsers often force-kill continuous recognition after varying periods of silence.
      // Auto-restart the loop indefinitely if we are still supposed to be listening.
      if (!isCancelled && wakeWordEnabled && !isActiveRef.current && !isDictatingPause) {
        try {
          recognition.start();
        } catch (e) {
          // Ignore if it's already running or failed.
        }
      }
    };

    // Kick off the initial listen
    if (!isActiveRef.current && !isCancelled) {
      try {
        recognition.start();
        console.log('[MallyVoice] Native Web Speech wake word system active.');
      } catch(e) {
        console.warn('[MallyVoice] Could not start native speech recognition:', e);
      }
    }

    return () => {
      isCancelled = true;
      window.removeEventListener('pause-wake-word', handlePause);
      window.removeEventListener('resume-wake-word', handleResume);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
        recognitionRef.current = null;
        console.log('[MallyVoice] Native wake word system cleaned up.');
      }
    };
  }, [wakeWordEnabled]);

  // Cleanup on unmount
  useEffect(() => () => { stopVoice(); }, [stopVoice]);

  return {
    voiceState,
    startVoice,
    stopVoice,
    pttRelease,
    transcript,
    assistantText,
    lastAction,
    volume,
    isVoiceReady: true, // Token is fetched on demand — always ready
  };
}
