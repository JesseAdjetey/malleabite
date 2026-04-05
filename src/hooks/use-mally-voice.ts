import { useState, useEffect, useCallback, useRef } from 'react';
import Vapi from '@vapi-ai/web';
import { PorcupineWorker } from '@picovoice/porcupine-web';
import { WebVoiceProcessor } from '@picovoice/web-voice-processor';

// You will need to provide your public key in .env.local
const VAPI_PUBLIC_KEY = import.meta.env.VITE_VAPI_PUBLIC_KEY || '';

// Single instance of Vapi
const vapi = VAPI_PUBLIC_KEY ? new Vapi(VAPI_PUBLIC_KEY) : null;

export type VoiceState = 'idle' | 'listening' | 'speaking' | 'connecting' | 'error';

export function useMallyVoice({
  onCommand,
  getContext,
}: {
  onCommand: (action: any) => Promise<boolean>;
  getContext: () => any;
}) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [volume, setVolume] = useState(0);

  // Use a ref to track if Vapi is currently active or connecting, avoiding stale closures
  const isVapiActiveRef = useRef(false);

  // Porcupine wake word worker
  const porcupineRef = useRef<PorcupineWorker | null>(null);

  const startVapi = useCallback(async () => {
    if (!vapi || isVapiActiveRef.current) {
      return;
    }
    isVapiActiveRef.current = true;
    try {
      setVoiceState('connecting');
      
      const context = getContext();
      const systemPrompt = `You are Mally, an intelligent and highly capable AI assistant for the Malleabite application. 
You help users manage their schedule, alarms, to-dos, and events.
Be extremely concise, helpful, and friendly. Do not use markdown like * or ** in your speech.
When the user asks to schedule an event or add a task, use the tools provided.
Current Context: 
Events today: ${context?.events?.length || 0}
To-dos: ${context?.todos?.length || 0}`;

      await vapi.start({
        model: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            }
          ],
          tools: [
            {
              type: 'function',
              messages: [
                {
                  type: 'request-start',
                  content: 'Creating event...',
                },
                {
                  type: 'request-complete',
                  content: 'Event created.',
                },
              ],
              function: {
                name: 'create_event',
                description: 'Creates a new calendar event for the user.',
                parameters: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: 'Title of the event' },
                    startTime: { type: 'string', description: 'Start time in ISO format or relative description' },
                    endTime: { type: 'string', description: 'End time in ISO format or relative description' },
                  },
                  required: ['title'],
                },
              },
            },
            {
              type: 'function',
              messages: [
                {
                  type: 'request-start',
                  content: 'Adding task...',
                },
                {
                  type: 'request-complete',
                  content: 'Task added.',
                },
              ],
              function: {
                name: 'create_todo',
                description: 'Adds a task to the user to-do list.',
                parameters: {
                  type: 'object',
                  properties: {
                    text: { type: 'string', description: 'Task description' },
                  },
                  required: ['text'],
                },
              },
            }
          ],
        },
        voice: {
          provider: '11labs',
          voiceId: 'b7d50908-b17c-442d-ad8d-815c4d5e6f7a', // Generic natural voice, replace if needed
        },
      });
      // state changes handled by vapi event listeners
    } catch (err) {
      console.error('Vapi start error:', err);
      setVoiceState('error');
    }
  }, [getContext]);

  const stopVapi = useCallback(() => {
    if (vapi) {
      vapi.stop();
    }
  }, []);

  // Set up Vapi event listeners
  useEffect(() => {
    if (!vapi) return;

    const onCallStart = () => {
      isVapiActiveRef.current = true;
      setVoiceState('listening');
    };
    const onCallEnd = () => {
      isVapiActiveRef.current = false;
      setVoiceState('idle');
    };
    const onSpeechStart = () => setVoiceState('speaking');
    const onSpeechEnd = () => setVoiceState('listening');
    const onVolumeLevel = (lvl: number) => setVolume(lvl);
    const onError = (e: any) => {
      console.error('Vapi Error:', e);
      isVapiActiveRef.current = false;
      setVoiceState('error');
    };
    
    const onMessage = (message: any) => {
      if (message.type === 'transcript' && message.transcriptType === 'final') {
        setTranscript(message.transcript);
      }
      
      // Handle client-side tool calls natively!
      if (message.type === 'tool-calls') {
        message.toolCalls.forEach(async (toolCall: any) => {
          if (toolCall.type === 'function') {
            const { name, arguments: args } = toolCall.function;
            if (name === 'create_event' || name === 'create_todo') {
              console.log('Vapi Tool Call:', name, args);
              try {
                // Ensure executeAction format is respected
                await onCommand({ type: name, data: args });
                vapi.send({
                  type: 'add-message',
                  message: {
                    role: 'tool',
                    toolCallId: toolCall.id,
                    toolName: name,
                    content: 'Success'
                  }
                });
              } catch (err) {
                vapi.send({
                  type: 'add-message',
                  message: {
                    role: 'tool',
                    toolCallId: toolCall.id,
                    toolName: name,
                    content: 'Error occurred'
                  }
                });
              }
            }
          }
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
  }, [onCommand]);

  const startVapiRef = useRef(startVapi);
  useEffect(() => {
    startVapiRef.current = startVapi;
  }, [startVapi]);

  // Set up Picovoice Porcupine (Hotword Detection)
  useEffect(() => {
    let isActive = true;

    const initPorcupine = async () => {
      const accessKey = import.meta.env.VITE_PICOVOICE_ACCESS_KEY;
      const keywordBase64 = import.meta.env.VITE_PICOVOICE_KEYWORD_B64;
      
      if (!accessKey || !keywordBase64) {
        console.warn('Picovoice credentials missing. Voice wake word disabled.');
        return;
      }

      try {
        porcupineRef.current = await PorcupineWorker.create(
          accessKey,
          { base64: keywordBase64, label: 'Hey Mally' },
          (keywordLabel) => {
            console.log('Wake word detected:', keywordLabel);
            if (vapi && !isVapiActiveRef.current) {
              startVapiRef.current();
            }
          },
          { publicPath: '/porcupine-params.pv' } // Need acoustic model
        );
        
        if (isActive) {
          await WebVoiceProcessor.subscribe(porcupineRef.current);
        } else {
          porcupineRef.current.release();
        }
      } catch (err) {
        console.error('Porcupine initialization error:', err);
      }
    };

    initPorcupine();

    return () => {
      isActive = false;
      if (porcupineRef.current) {
        WebVoiceProcessor.unsubscribe(porcupineRef.current);
        porcupineRef.current.release();
      }
    };
  }, []); // Empty dependencies, rely on refs

  return {
    voiceState,
    startVapi,
    stopVapi,
    transcript,
    volume,
    isVapiReady: !!vapi
  };
}
