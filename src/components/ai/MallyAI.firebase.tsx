// Firebase-compatible MallyAI component
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot,
  Send,
  Plus,
  X,
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  Loader2,
  MessageSquare,
  Brain,
  Mic,
  Volume2,
  VolumeX,
  Image as ImageIcon,
  Paperclip,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext.firebase";
import { FirebaseFunctions } from "@/integrations/firebase/functions";
import { CalendarEventType } from "@/lib/stores/types";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { useTodos } from "@/hooks/use-todos";
import { useTodoLists } from "@/hooks/use-todo-lists";
import { useEisenhower } from "@/hooks/use-eisenhower";
import { useAlarms } from "@/hooks/use-alarms";
import { useUsageLimits } from "@/hooks/use-usage-limits";
import { shouldUseFirebase, logMigrationStatus } from "@/lib/migration-flags";
import { logger } from "@/lib/logger";
import { errorHandler } from "@/lib/error-handler";
import { useHeyMallySafe } from "@/contexts/HeyMallyContext";
import "../../styles/ai-animations.css";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
  isLoading?: boolean;
  isError?: boolean;
  pendingEvent?: any; // Event data waiting for confirmation
  image?: {
    dataUrl: string;
    fileName: string;
    mimeType: string;
  };
}

const initialMessages: Message[] = [
  {
    id: "1",
    text: "Hello! I'm Mally, your AI productivity assistant powered by Google Gemini. 🤖\n\nI can help you with:\n\n📅 **Calendar Events** - Create, update, or delete events (including recurring ones)\n✅ **Todo Lists** - Add, complete, or remove tasks\n🎯 **Priority Matrix** - Organize tasks using the Eisenhower method\n⏰ **Alarms** - Set reminders and link them to events or todos\n📸 **Image Processing** - Upload images of schedules, notes, or tasks and I'll help organize them\n\nJust tell me what you need! For example:\n• \"Add gym to my todos\"\n• \"Set an alarm for 8am tomorrow\"\n• \"Create a meeting every Monday at 10am\"\n• Upload an image of your schedule to create events",
    sender: "ai",
    timestamp: new Date(),
  },
];

interface MallyAIFirebaseProps {
  onScheduleEvent?: (event: any) => Promise<any>;
  initialPrompt?: string;
  preventOpenOnClick?: boolean;
  isMobileSheet?: boolean;
  isDraggable?: boolean;
}

export const MallyAIFirebase: React.FC<MallyAIFirebaseProps> = ({
  onScheduleEvent,
  initialPrompt,
  preventOpenOnClick = false,
  isMobileSheet = false,
  isDraggable = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(true); // Voice OFF by default - user should turn it on manually
  const [mediaRecorder, setMediaRecorder] = useState<any>(null); // SpeechRecognition instance
  const [isWaitingForVoice, setIsWaitingForVoice] = useState(false); // Track if waiting for user voice input (Siri-style)
  const [uploadedImage, setUploadedImage] = useState<{
    dataUrl: string;
    fileName: string;
    mimeType: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { user } = useAuth();
  const { fetchEvents, addEvent, removeEvent, updateEvent, events, archiveAllEvents } = useCalendarEvents();
  const { addTodo, toggleTodo, deleteTodo, todos } = useTodos();
  const { createList, lists } = useTodoLists();
  const { addItem: addEisenhowerItem, removeItem: removeEisenhowerItem, updateQuadrant, items: eisenhowerItems } = useEisenhower();
  const { addAlarm, updateAlarm, deleteAlarm, linkToEvent, linkToTodo, alarms } = useAlarms();
  const { limits, incrementAICount, triggerUpgradePrompt } = useUsageLimits();

  // Get pause/resume functions for wake word coordination
  const { pauseWakeWord, resumeWakeWord } = useHeyMallySafe();

  // Track pending action for confirmation
  const [pendingAction, setPendingAction] = useState<any>(null);

  useEffect(() => {
    logMigrationStatus('MallyAI', 'firebase');
  }, []);

  // Ref to hold the latest toggleRecording function
  const toggleRecordingRef = useRef<() => void>(() => { });

  // Ref to hold the latest handleSendMessage function for auto-submit
  const handleSendMessageRef = useRef<(text: string) => void>(() => { });

  // Handle image file upload
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    try {
      // Convert to base64 data URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setUploadedImage({
          dataUrl,
          fileName: file.name,
          mimeType: file.type,
        });
        toast.success(`Image "${file.name}" uploaded`);
      };
      reader.onerror = () => {
        toast.error('Failed to read image file');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      logger.error('MallyAI', 'Image upload failed', error as Error);
      toast.error('Failed to upload image');
    }
  }, []);

  // Remove uploaded image
  const removeImage = useCallback(() => {
    setUploadedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Listen for "Hey Mally" activation (Siri-style: single interaction)
  useEffect(() => {
    const handleHeyMallyActivation = (event: Event) => {
      console.log('🎤 Hey Mally event received in MallyAI component!');
      logger.info('MallyAI', 'Hey Mally activation received');

      // IMMEDIATE visual feedback - add a message to show Mally heard you
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        text: "I'm listening...",
        sender: 'ai',
        timestamp: new Date(),
      }]);

      // Open the assistant if not already open
      setIsOpen(true);
      setIsWaitingForVoice(true);

      // AUTO-UNMUTE on voice activation
      setIsMuted(false);
      console.log('🔊 Auto-unmoting for voice interaction');

      // Play activation chime (immediate audio feedback like Siri)
      try {
        playActivationChimeImmediate();
      } catch (e) {
        console.log('Chime failed:', e);
      }

      // Speak quick acknowledgment after chime
      setTimeout(() => {
        try {
          speakQuickAcknowledgmentImmediate();
        } catch (e) {
          console.log('Acknowledgment failed:', e);
        }
      }, 250);

      // Start recording after acknowledgment
      setTimeout(() => {
        console.log('🎤 Starting voice recording...');
        if (toggleRecordingRef.current) {
          toggleRecordingRef.current();
        } else {
          console.error('toggleRecordingRef is not set!');
        }
      }, 800);
    };

    console.log('🎤 Setting up Hey Mally event listener');
    window.addEventListener('heyMallyActivated', handleHeyMallyActivation);

    return () => {
      window.removeEventListener('heyMallyActivated', handleHeyMallyActivation);
    };
  }, []);

  // Siri-style activation chime - IMMEDIATE version for event handler
  const playActivationChimeImmediate = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      // Two-tone chime like Siri (rising pitch)
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
      oscillator.frequency.setValueAtTime(1047, audioContext.currentTime + 0.1); // C6

      gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.25);

      console.log('🔔 Activation chime played');
    } catch (e) {
      console.log('Could not play activation chime:', e);
    }
  };

  // Quick voice acknowledgment - IMMEDIATE version for event handler
  const speakQuickAcknowledgmentImmediate = () => {
    if (!window.speechSynthesis) {
      console.log('Speech synthesis not available');
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const acknowledgments = ["Yes?", "Mm-hmm?", "I'm here", "What's up?"];
    const ack = acknowledgments[Math.floor(Math.random() * acknowledgments.length)];

    const utterance = new SpeechSynthesisUtterance(ack);
    utterance.rate = 1.2; // Quick but clear
    utterance.pitch = 1.05;
    utterance.volume = 0.9;
    utterance.lang = navigator.language || 'en-US';

    window.speechSynthesis.speak(utterance);
    console.log('🗣️ Spoke acknowledgment:', ack);
  };

  // Legacy functions (keep for compatibility)
  const playActivationChime = playActivationChimeImmediate;
  const speakQuickAcknowledgment = speakQuickAcknowledgmentImmediate;

  // Execute an action based on type
  const executeAction = async (action: any): Promise<boolean> => {
    if (!user || !action) return false;

    const { type, data } = action;
    logger.info('MallyAI', 'Executing action', {
      type,
      data,
      hasRecurring: data?.isRecurring,
      recurrenceRule: data?.recurrenceRule
    });

    try {
      switch (type) {
        case 'create_event': {
          const startsAt = new Date(data.startsAt || data.start);
          const endsAt = new Date(data.endsAt || data.end);

          // Check for recurring properties
          const isRecurring = data.isRecurring === true;
          let recurrenceRule = data.recurrenceRule;

          // Parse natural language frequency patterns if recurrence rule exists
          if (isRecurring && recurrenceRule) {
            // Handle weekday pattern (Mon-Fri)
            if (recurrenceRule.frequency === 'weekly' &&
              (!recurrenceRule.daysOfWeek || recurrenceRule.daysOfWeek.length === 0)) {
              // Check if user asked for weekdays
              const messageText = (data._originalMessage || '').toLowerCase();
              if (messageText.includes('weekday') ||
                messageText.includes('monday to friday') ||
                messageText.includes('mon-fri') ||
                messageText.includes('mon - fri') ||
                messageText.includes('every weekday')) {
                // Set daysOfWeek to Mon-Fri (1-5)
                recurrenceRule = {
                  ...recurrenceRule,
                  daysOfWeek: [1, 2, 3, 4, 5]
                };
                logger.info('MallyAI', 'Setting weekday pattern for recurring event', { daysOfWeek: [1, 2, 3, 4, 5] });
              }
            }

            // Ensure daysOfWeek is an array of numbers
            if (recurrenceRule.daysOfWeek && typeof recurrenceRule.daysOfWeek === 'string') {
              recurrenceRule.daysOfWeek = recurrenceRule.daysOfWeek.split(',').map((d: string) => parseInt(d.trim(), 10));
            }
          }

          logger.info('MallyAI', 'Creating event with recurring settings', {
            isRecurring,
            recurrenceRule,
            title: data.title
          });

          // Build the event with recurring properties if present
          const newEvent: CalendarEventType = {
            id: crypto.randomUUID(),
            title: data.title,
            description: data.description || 'Created by Mally AI',
            date: startsAt.toISOString().split('T')[0],
            startsAt: startsAt.toISOString(),
            endsAt: endsAt.toISOString(),
            color: data.color || '#8b5cf6',
            // Add recurring event properties
            isRecurring: isRecurring,
            recurrenceRule: recurrenceRule ? {
              frequency: recurrenceRule.frequency || 'daily',
              interval: recurrenceRule.interval || 1,
              daysOfWeek: recurrenceRule.daysOfWeek,
              dayOfMonth: recurrenceRule.dayOfMonth,
              monthOfYear: recurrenceRule.monthOfYear,
              endDate: recurrenceRule.endDate,
              count: recurrenceRule.count,
            } : undefined,
          };

          logger.info('MallyAI', 'Final event object', {
            newEvent,
            hasRecurrenceRule: !!newEvent.recurrenceRule
          });

          const result = await addEvent(newEvent);
          if (result.success) {
            const recurringText = newEvent.isRecurring ? ' (recurring)' : '';
            toast.success(`Event "${data.title}"${recurringText} created!`);
            await fetchEvents();
            return true;
          }
          return false;
        }

        case 'delete_event': {
          if (!data.eventId) {
            toast.error('No event ID provided');
            return false;
          }
          const result = await removeEvent(data.eventId);
          if (result.success) {
            toast.success('Event deleted!');
            await fetchEvents();
            return true;
          }
          return false;
        }

        case 'archive_calendar': {
          const folderName = data.folderName || 'Archived Calendar';
          const result = await archiveAllEvents(folderName);
          if (result.success) {
            toast.success(`Calendar archived into "${folderName}"`);
            await fetchEvents();
            return true;
          }
          return false;
        }

        case 'update_event': {
          if (!data.eventId) {
            toast.error('No event ID provided');
            return false;
          }
          // Find existing event and merge updates
          const existingEvent = events.find(e => e.id === data.eventId);
          if (!existingEvent) {
            toast.error('Event not found');
            return false;
          }
          const updatedEvent = {
            ...existingEvent,
            title: data.title || existingEvent.title,
            startsAt: data.start ? new Date(data.start).toISOString() : existingEvent.startsAt,
            endsAt: data.end ? new Date(data.end).toISOString() : existingEvent.endsAt,
          };
          const result = await updateEvent(updatedEvent);
          if (result.success) {
            toast.success('Event updated!');
            await fetchEvents();
            return true;
          }
          return false;
        }

        case 'add_todo_to_list': // Alias for create_todo
        case 'create_todo': {
          if (!data.text) {
            toast.error('No todo text provided');
            return false;
          }

          let targetListId = data.listId;

          // Resolve list name to ID if provided (and ID is missing)
          if (!targetListId && data.listName && lists) {
            const targetList = lists.find(l => l.name.toLowerCase().trim() === data.listName.toLowerCase().trim());
            if (targetList) {
              targetListId = targetList.id;
            }
          }

          // Check if a listId was provided for adding to a specific list
          const result = await addTodo(data.text, targetListId);
          if (result.success) {
            const listInfo = targetListId && lists ?
              ` to "${lists.find(l => l.id === targetListId)?.name || 'list'}"` : '';
            toast.success(`Todo "${data.text}" added${listInfo}!`);
            return true;
          }
          return false;
        }

        case 'create_todo_list': {
          if (!data.name) {
            toast.error('No list name provided');
            return false;
          }
          const result = await createList(data.name, data.color);
          if (result.success) {
            toast.success(`List "${data.name}" created!`);
            return true;
          }
          return false;
        }

        case 'complete_todo': {
          if (!data.todoId) {
            toast.error('No todo ID provided');
            return false;
          }
          await toggleTodo(data.todoId);
          toast.success('Todo marked as complete!');
          return true;
        }

        case 'delete_todo': {
          if (!data.todoId) {
            toast.error('No todo ID provided');
            return false;
          }
          await deleteTodo(data.todoId);
          toast.success('Todo deleted!');
          return true;
        }

        case 'create_eisenhower': {
          if (!data.text || !data.quadrant) {
            toast.error('Missing text or quadrant');
            return false;
          }
          const result = await addEisenhowerItem(data.text, data.quadrant);
          if (result.success) {
            toast.success(`Priority item added to ${data.quadrant.replace(/_/g, ' ')}!`);
            return true;
          }
          return false;
        }

        case 'update_eisenhower': {
          if (!data.itemId || !data.quadrant) {
            toast.error('Missing item ID or quadrant');
            return false;
          }
          await updateQuadrant(data.itemId, data.quadrant);
          toast.success('Priority item moved!');
          return true;
        }

        case 'delete_eisenhower': {
          if (!data.itemId) {
            toast.error('No item ID provided');
            return false;
          }
          await removeEisenhowerItem(data.itemId);
          toast.success('Priority item deleted!');
          return true;
        }

        case 'create_alarm': {
          if (!data.title || !data.time) {
            toast.error('Missing alarm title or time');
            return false;
          }
          const result = await addAlarm(data.title, data.time, {
            linkedEventId: data.linkedEventId,
            linkedTodoId: data.linkedTodoId,
            repeatDays: data.repeatDays || []
          });
          if (result.success) {
            toast.success(`Alarm "${data.title}" created!`);
            return true;
          }
          return false;
        }

        case 'update_alarm': {
          if (!data.alarmId) {
            toast.error('No alarm ID provided');
            return false;
          }
          const updates: any = {};
          if (data.title) updates.title = data.title;
          if (data.time) updates.time = data.time;
          const result = await updateAlarm(data.alarmId, updates);
          if (result.success) {
            toast.success('Alarm updated!');
            return true;
          }
          return false;
        }

        case 'delete_alarm': {
          if (!data.alarmId) {
            toast.error('No alarm ID provided');
            return false;
          }
          const result = await deleteAlarm(data.alarmId);
          if (result.success) {
            toast.success('Alarm deleted!');
            return true;
          }
          return false;
        }

        case 'link_alarm': {
          if (!data.alarmId) {
            toast.error('No alarm ID provided');
            return false;
          }
          if (data.linkedEventId) {
            const result = await linkToEvent(data.alarmId, data.linkedEventId);
            if (result.success) {
              toast.success('Alarm linked to event!');
              return true;
            }
          } else if (data.linkedTodoId) {
            const result = await linkToTodo(data.alarmId, data.linkedTodoId);
            if (result.success) {
              toast.success('Alarm linked to todo!');
              return true;
            }
          }
          return false;
        }

        default:
          logger.warn('MallyAI', 'Unknown action type', { type });
          return false;
      }
    } catch (error) {
      logger.error('MallyAI', 'Failed to execute action', error as Error);
      toast.error('Failed to execute action');
      return false;
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (initialPrompt && isOpen) {
      handleSendMessage(initialPrompt);
    }
  }, [initialPrompt, isOpen]);

  // Text-to-Speech function with high-quality, fluent English voice
  const speak = (text: string) => {
    if (isMuted || !window.speechSynthesis) return;

    // Cancel any current speech
    window.speechSynthesis.cancel();

    // Preprocess text for more natural speech
    const processTextForSpeech = (input: string): string => {
      return input
        // Remove markdown formatting
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/`(.+?)`/g, '$1')
        .replace(/#{1,6}\s/g, '')
        // Convert bullet points to natural pauses
        .replace(/^[-•]\s*/gm, '... ')
        .replace(/^\d+\.\s*/gm, '... ')
        // Add natural pauses for punctuation
        .replace(/([.!?])\s+/g, '$1 ... ')
        .replace(/,\s+/g, ', ')
        // Handle common abbreviations for natural speech
        .replace(/\be\.g\./gi, 'for example')
        .replace(/\bi\.e\./gi, 'that is')
        .replace(/\betc\./gi, 'and so on')
        .replace(/\bvs\./gi, 'versus')
        // Clean up extra spaces
        .replace(/\s+/g, ' ')
        .trim();
    };

    const processedText = processTextForSpeech(text);
    const utterance = new SpeechSynthesisUtterance(processedText);

    // Get available voices
    const voices = window.speechSynthesis.getVoices();

    // Priority order for most natural, fluent English voices
    // These are ranked by quality and naturalness
    const preferredVoiceNames = [
      // Google's neural/natural voices (highest quality)
      'Google UK English Female',
      'Google US English Female',
      'Google US English',
      // Microsoft neural voices (very natural)
      'Microsoft Jenny Online (Natural)',
      'Microsoft Aria Online (Natural)',
      'Microsoft Jenny',
      'Microsoft Aria',
      'Microsoft Zira Desktop',
      'Microsoft Zira',
      // Apple high-quality voices
      'Samantha',
      'Karen',
      'Moira',
      'Tessa',
      // Other quality English voices
      'Google UK English Male',
      'Daniel',
      'Alex',
      'Victoria',
      'Fiona',
      'Veena'
    ];

    // Find the best available voice
    let selectedVoice: SpeechSynthesisVoice | null = null;

    // First try exact match for preferred voices
    for (const name of preferredVoiceNames) {
      selectedVoice = voices.find(v => v.name === name) || null;
      if (selectedVoice) break;
    }

    // Then try partial match for preferred voices
    if (!selectedVoice) {
      for (const name of preferredVoiceNames) {
        selectedVoice = voices.find(v => v.name.toLowerCase().includes(name.toLowerCase())) || null;
        if (selectedVoice) break;
      }
    }

    // Fallback: find any high-quality English voice (prefer Female for assistant)
    if (!selectedVoice) {
      selectedVoice = voices.find(v =>
        v.lang.startsWith('en-') &&
        v.localService === false && // Cloud/neural voices are usually non-local
        (v.name.toLowerCase().includes('female') ||
          v.name.toLowerCase().includes('natural') ||
          v.name.toLowerCase().includes('neural'))
      ) || null;
    }

    // Fallback: any Google or Microsoft English voice
    if (!selectedVoice) {
      selectedVoice = voices.find(v =>
        v.lang.startsWith('en-') &&
        (v.name.includes('Google') || v.name.includes('Microsoft'))
      ) || null;
    }

    // Last resort: any English voice, preferring US/UK
    if (!selectedVoice) {
      selectedVoice = voices.find(v => v.lang === 'en-US' || v.lang === 'en-GB') ||
        voices.find(v => v.lang.startsWith('en-')) || null;
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      console.log('Using voice:', selectedVoice.name, selectedVoice.lang);
    }

    // Optimize speech parameters for natural, fluent speech
    utterance.rate = 0.92; // Slightly slower for clarity and naturalness
    utterance.pitch = 1.0; // Natural pitch
    utterance.volume = 1.0;

    // Handle speech events for better UX
    utterance.onstart = () => {
      console.log('Speech started');
    };

    utterance.onend = () => {
      console.log('Speech ended');
      // Siri-style: don't auto-restart recording
      // User needs to say "Hey Mally" again or click mic button
    };

    utterance.onerror = (event) => {
      console.error('Speech error:', event.error);
    };

    window.speechSynthesis.speak(utterance);
  };

  // Load voices when component mounts (some browsers load async)
  useEffect(() => {
    const loadVoices = () => {
      window.speechSynthesis?.getVoices();
    };

    loadVoices();
    window.speechSynthesis?.addEventListener('voiceschanged', loadVoices);

    return () => {
      window.speechSynthesis?.removeEventListener('voiceschanged', loadVoices);
    };
  }, []);

  // Stop speech when closed
  useEffect(() => {
    if (!isOpen) {
      window.speechSynthesis.cancel();
      setIsWaitingForVoice(false);
    }
  }, [isOpen]);

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputText]);

  const addMessage = (message: Omit<Message, "id" | "timestamp">) => {
    const newMessage: Message = {
      ...message,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
    return newMessage.id;
  };

  const updateMessage = (messageId: string, updates: Partial<Message>) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === messageId ? { ...msg, ...updates } : msg))
    );
  };

  // Start/stop speech recognition using Web Speech API
  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorder) {
        (mediaRecorder as any).stop();
        setIsRecording(false);
      }
      // Resume wake word detection when done
      resumeWakeWord();
    } else {
      // Pause wake word detection while we use speech recognition
      pauseWakeWord();

      // Start speech recognition using Web Speech API
      try {
        // Check if browser supports speech recognition
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (!SpeechRecognition) {
          toast.error("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
          resumeWakeWord(); // Resume on error
          return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        // Use browser's language or default to English
        recognition.lang = navigator.language || 'en-US';

        let finalTranscript = '';
        let silenceTimeout: NodeJS.Timeout | null = null;
        let hasReceivedSpeech = false;

        recognition.onstart = () => {
          setIsRecording(true);
          logger.info('MallyAI', 'Speech recognition started');
        };

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          hasReceivedSpeech = true;

          // Clear any existing silence timeout
          if (silenceTimeout) {
            clearTimeout(silenceTimeout);
          }

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          // Show interim results in input for visual feedback
          setInputText(finalTranscript + interimTranscript);

          // Smart silence detection: if user stops speaking for 1.5 seconds, auto-submit
          silenceTimeout = setTimeout(() => {
            if (finalTranscript.trim() || interimTranscript.trim()) {
              try {
                recognition.stop();
              } catch (e) {
                // Ignore
              }
            }
          }, 1500);
        };

        recognition.onend = () => {
          setIsRecording(false);
          setMediaRecorder(null);
          setIsWaitingForVoice(false);

          // Clear silence timeout
          if (silenceTimeout) {
            clearTimeout(silenceTimeout);
          }

          // Resume wake word detection
          resumeWakeWord();

          // Clear input field
          setInputText('');

          if (finalTranscript.trim()) {
            logger.info('MallyAI', 'Speech recognition complete', { transcript: finalTranscript });
            // Auto-submit the captured speech for smooth conversation flow
            handleSendMessageRef.current(finalTranscript.trim());
          } else if (hasReceivedSpeech) {
            // Had some speech but no final transcript
            toast.info("Didn't quite catch that. Say 'Hey Mally' to try again.");
          } else {
            // No speech at all
            toast.info("I'm listening... Say 'Hey Mally' when you're ready.");
          }
        };

        recognition.onerror = (event: any) => {
          setIsRecording(false);
          setMediaRecorder(null);

          // Resume wake word detection on error
          resumeWakeWord();

          // Handle expected/non-critical errors gracefully
          if (event.error === 'aborted') {
            // User or system stopped recognition, no need to log or show error
            return;
          }

          if (event.error === 'no-speech') {
            toast.info("No speech detected. Try again.");
            return;
          }

          if (event.error === 'not-allowed') {
            logger.warn('MallyAI', 'Microphone access denied');
            toast.error("Microphone access denied. Please allow microphone access.");
            return;
          }

          // Log only unexpected errors
          logger.error('MallyAI', 'Speech recognition error', new Error(event.error));
          toast.error(`Speech recognition error: ${event.error}`);
        };

        // Store recognition instance for stopping
        setMediaRecorder(recognition as any);
        recognition.start();

      } catch (error) {
        logger.error('MallyAI', 'Failed to start speech recognition', error as Error);
        toast.error("Failed to start speech recognition");
        setIsRecording(false);
      }
    }
  };

  // Keep ref updated with latest toggleRecording function
  useEffect(() => {
    toggleRecordingRef.current = toggleRecording;
  });
  // Send message and get AI response using Firebase Functions
  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || inputText.trim();
    if (!textToSend || isLoading || !user) return;

    // Clear input and capture image data before clearing it
    setInputText("");
    const imageData = uploadedImage;
    setUploadedImage(null); // Clear image after sending
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Add user message with optional image
    addMessage({
      text: textToSend,
      sender: "user",
      image: imageData || undefined
    });

    // Add loading AI message
    const loadingMessageId = addMessage({
      text: "Thinking...",
      sender: "ai",
      isLoading: true,
    });

    setIsLoading(true);

    // Check if this is a simple confirmation and we have a pending action
    const confirmationWords = ['yes', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay', 'alright', 'confirm', 'do it', 'go ahead', 'please', 'sounds good', 'perfect', 'great', 'create it', 'make it', 'add it'];
    const isSimpleConfirmation = confirmationWords.some(word =>
      textToSend.toLowerCase().trim() === word ||
      textToSend.toLowerCase().trim() === word + '!'
    );

    // If user confirms and we have a pending action, execute it directly
    if (isSimpleConfirmation && pendingAction) {
      logger.info('MallyAI', 'User confirmed pending action', { pendingAction });

      const loadingMessageId = addMessage({
        text: pendingAction.type === 'batch' ? "Creating your events..." : "Creating your event...",
        sender: "ai",
        isLoading: true,
      });

      try {
        let actionExecuted = false;
        let successMessage = "Done!";

        // Handle batch actions (multiple events at once)
        if (pendingAction.type === 'batch' && pendingAction.actions) {
          logger.info('MallyAI', 'Executing batch of confirmed actions', { count: pendingAction.actions.length });
          let successCount = 0;
          const eventTitles: string[] = [];

          for (const singleAction of pendingAction.actions) {
            const success = await executeAction(singleAction);
            if (success) {
              successCount++;
              if (singleAction.data?.title) {
                eventTitles.push(singleAction.data.title);
              }
            }
          }

          actionExecuted = successCount > 0;
          if (eventTitles.length > 0) {
            successMessage = `Done! I've created ${successCount} events: ${eventTitles.join(', ')}. You're all set!`;
          } else {
            successMessage = `Done! I've created ${successCount} items for you.`;
          }
        } else {
          // Handle single action (original logic)
          actionExecuted = await executeAction(pendingAction);

          if (actionExecuted) {
            const actionType = pendingAction.type;
            const actionData = pendingAction.data;

            switch (actionType) {
              case 'create_event': {
                const isRecurring = actionData.isRecurring;
                const frequency = actionData.recurrenceRule?.frequency;
                if (isRecurring && frequency) {
                  successMessage = `Great! I've set up your recurring '${actionData.title}' event (${frequency}). You're all set!`;
                } else {
                  successMessage = `Done! I've created your '${actionData.title}' event. You're all set!`;
                }
                break;
              }
              case 'create_todo':
                successMessage = `Added '${actionData.text}' to your todo list!`;
                break;
              case 'create_todo_list':
                successMessage = `List '${actionData.name}' created successfully!`;
                break;
              case 'complete_todo':
                successMessage = `Marked todo as complete!`;
                break;
              case 'delete_todo':
                successMessage = `Removed the todo from your list.`;
                break;
              case 'create_eisenhower':
                successMessage = `Added '${actionData.text}' to your priority matrix!`;
                break;
              case 'update_eisenhower':
                successMessage = `Moved item to ${actionData.quadrant?.replace(/_/g, ' ')}!`;
                break;
              case 'delete_eisenhower':
                successMessage = `Removed item from priority matrix.`;
                break;
              case 'create_alarm': {
                const linkedText = actionData.linkedEventId ? ' (linked to event)' :
                  actionData.linkedTodoId ? ' (linked to todo)' : '';
                successMessage = `Alarm '${actionData.title}' created${linkedText}!`;
                break;
              }
              case 'update_alarm':
                successMessage = `Alarm updated!`;
                break;
              case 'delete_alarm':
                successMessage = `Alarm deleted.`;
                break;
              case 'link_alarm':
                successMessage = `Alarm linked successfully!`;
                break;
              case 'delete_event':
                successMessage = `Event deleted from your calendar.`;
                break;
              case 'update_event':
                successMessage = `Event updated!`;
                break;
              case 'archive_calendar':
                successMessage = `I've successfully archived your calendar into "${actionData.folderName || 'Archived Calendar'}" and cleared your current view for a fresh start!`;
                break;
              default:
                successMessage = "Done!";
            }
          }
        }

        if (actionExecuted) {
          updateMessage(loadingMessageId, {
            text: successMessage,
            isLoading: false,
          });
          speak(successMessage);
          setPendingAction(null);
        } else {
          updateMessage(loadingMessageId, {
            text: "Sorry, I couldn't complete that action. Please try again.",
            isLoading: false,
            isError: true,
          });
        }
      } catch (error) {
        logger.error('MallyAI', 'Failed to execute pending action', error as Error);
        updateMessage(loadingMessageId, {
          text: "Sorry, something went wrong. Please try again.",
          isLoading: false,
          isError: true,
        });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    try {
      logger.debug('MallyAI', 'Processing user message', {
        messageLength: textToSend.length,
        userId: user.uid,
        hasPendingAction: !!pendingAction
      });

      // Check AI usage limits before making the request
      if (!limits.canUseAI) {
        updateMessage(loadingMessageId, {
          text: "You've reached your AI request limit for this month. Upgrade to Pro for unlimited AI assistance! ✨",
          isLoading: false,
          isError: false,
        });
        triggerUpgradePrompt('ai');
        setIsLoading(false);
        return;
      }

      // Build conversation history (last 10 messages for context)
      const conversationHistory = messages
        .filter(m => !m.isLoading)
        .slice(-10)
        .map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text
        }));

      const response = await FirebaseFunctions.processScheduling({
        userMessage: textToSend,
        userId: user.uid,
        imageData: imageData ? {
          dataUrl: imageData.dataUrl,
          mimeType: imageData.mimeType,
        } : undefined,
        context: {
          currentTime: new Date().toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          conversationHistory
        }
      });

      // Increment AI usage count after successful request
      await incrementAICount();

      logger.info('MallyAI', 'Firebase AI Response received', {
        success: response.success,
        hasOperations: response.operations && response.operations.length > 0,
        intent: (response as any).intent,
        hasAction: !!(response as any).action
      });

      let responseText = response.message || "I've processed your request!";
      let actionExecuted = false;

      // Check if AI returned an action to execute
      const aiResponse = response as any;
      const action = aiResponse.action;
      const actions = aiResponse.actions; // NEW: Handle multiple actions
      const intent = aiResponse.intent;

      // NEW: Handle multiple actions array (for creating multiple events at once)
      if (response.success && actions && Array.isArray(actions) && actions.length > 0) {
        logger.info('MallyAI', 'Executing multiple actions', { count: actions.length, intent });

        // For multiple event creation, we might want user confirmation first
        const isConfirmation = intent === 'confirmation';
        const isMultipleEvents = intent === 'create_multiple_events';

        if (isConfirmation || isMultipleEvents) {
          // Execute all actions in sequence
          let successCount = 0;
          for (const singleAction of actions) {
            logger.info('MallyAI', 'Executing action from batch', { action: singleAction });
            const success = await executeAction(singleAction);
            if (success) successCount++;
          }
          actionExecuted = successCount > 0;
          logger.info('MallyAI', 'Batch actions completed', { successCount, total: actions.length });
          if (actionExecuted) {
            setPendingAction(null);
          }
        } else {
          // Store all actions as pending for confirmation
          logger.info('MallyAI', 'Storing multiple pending actions for confirmation', { count: actions.length });
          setPendingAction({ type: 'batch', actions });
        }
      } else if (response.success && action) {
        // Handle single action (original logic)
        // Check if this is a confirmation (user said yes to a previous suggestion)
        const isConfirmation = intent === 'confirmation';

        // Actions that should execute immediately without additional confirmation:
        // - Delete/update actions (AI already confirmed intent)
        // - Completion actions
        // - Todo creation (simple, low-risk action)
        // - Alarm creation (when clearly requested)
        const isDirectAction = [
          'delete_event', 'update_event',
          'create_todo', 'complete_todo', 'delete_todo',
          'create_eisenhower', 'update_eisenhower', 'delete_eisenhower',
          'create_alarm', 'update_alarm', 'delete_alarm', 'link_alarm'
        ].includes(action.type);

        if (isConfirmation || isDirectAction) {
          // Execute the action immediately
          logger.info('MallyAI', 'Executing AI action', { action, isConfirmation, isDirectAction });
          actionExecuted = await executeAction(action);
          if (actionExecuted) {
            setPendingAction(null);
          }
        } else {
          // Store as pending for user confirmation (mainly event creation)
          logger.info('MallyAI', 'Storing pending action for confirmation', { action });
          setPendingAction(action);
        }
      } else if (response.success && response.operations && response.operations.length > 0) {
        // Legacy: Handle old eventData format for backward compatibility
        const operation = response.operations[0];
        const eventData = operation.data;

        if (intent === 'confirmation' && eventData) {
          logger.info('MallyAI', 'Legacy: User confirmed event creation', { eventData });
          const legacyAction = { type: 'create_event', data: eventData };
          actionExecuted = await executeAction(legacyAction);
          if (actionExecuted) {
            setPendingAction(null);
          }
        } else if (eventData) {
          logger.info('MallyAI', 'Legacy: Storing pending event', { eventData });
          setPendingAction({ type: 'create_event', data: eventData });
        }
      }

      // Update the loading message with the response
      updateMessage(loadingMessageId, {
        text: responseText,
        isLoading: false,
        isError: !response.success,
      });

      // Speak the response
      if (response.success) {
        speak(responseText);
      }

      if (!response.success) {
        throw new Error(response.error || "AI processing failed");
      }

    } catch (error: any) {
      logger.error('MallyAI', 'Firebase AI Error', error as Error);

      // Check if it's an authentication error
      const is401Error = error?.code === 'unauthenticated' ||
        error?.message?.includes('must be authenticated') ||
        error?.message?.includes('401');

      const errorMessage = is401Error
        ? "🔄 AI functions are still being deployed to Firebase. In the meantime, I'm working in development mode with limited capabilities. You can still create events manually using the calendar interface, and I'll be fully functional once the deployment completes!"
        : "Sorry, I encountered an error processing your request. Please try again.";

      updateMessage(loadingMessageId, {
        text: errorMessage,
        isLoading: false,
        isError: false, // Don't show as error for 401, it's expected during deployment
      });

      errorHandler.handleError(
        error as Error,
        'AI processing error',
        'MallyAI'
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Keep ref updated with latest handleSendMessage function
  useEffect(() => {
    handleSendMessageRef.current = handleSendMessage;
  });

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // When used inside a mobile sheet, render just the content without positioning
  if (isMobileSheet) {
    return (
      <div className="flex flex-col h-full bg-gray-900">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${message.sender === "user"
                  ? "bg-purple-600 text-white"
                  : message.isError
                    ? "bg-red-900 text-red-100 border border-red-700"
                    : "bg-purple-900/50 text-white border border-purple-700/50"
                  }`}
              >
                <div className="flex items-center space-x-2">
                  {message.sender === "ai" && (
                    <Bot className="h-4 w-4 flex-shrink-0" />
                  )}
                  <span className="text-sm">
                    {message.isLoading ? (
                      <div className="flex items-center space-x-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>{message.text}</span>
                      </div>
                    ) : (
                      message.text
                    )}
                  </span>
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Siri-style Listening Indicator */}
        {isRecording && (
          <div className="flex items-center justify-center py-4 bg-gradient-to-t from-gray-900 to-transparent">
            <div className="flex items-center space-x-2 px-4 py-2 bg-purple-600/20 rounded-full border border-purple-500/30">
              <div className="flex space-x-1">
                <div className="w-1 h-4 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                <div className="w-1 h-6 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                <div className="w-1 h-8 bg-purple-600 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                <div className="w-1 h-6 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                <div className="w-1 h-4 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
              </div>
              <span className="text-purple-300 text-sm font-medium ml-2">Listening...</span>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-gray-700 bg-gray-900 shrink-0">
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                className="w-full p-3 border border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-800 text-white placeholder-gray-400 min-h-[44px] max-h-[120px]"
                rows={1}
                disabled={isLoading}
              />
            </div>
            <button
              onClick={toggleRecording}
              disabled={isLoading}
              className={`p-3 rounded-lg transition-colors ${isRecording
                ? "bg-red-500 text-white animate-pulse"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              title={isRecording ? "Stop recording" : "Start voice recording"}
            >
              <Mic className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || isLoading}
              className="bg-purple-600 text-white p-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => !preventOpenOnClick && setIsOpen(true)}
        className={`${isDraggable ? "" : "fixed bottom-24 right-4"} bg-gradient-to-r from-purple-600 to-violet-600 text-white p-4 rounded-full shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 transition-all duration-300 hover:scale-105 z-40 animate-pulse-glow`}
        title="Open Mally AI Assistant"
      >
        <Brain className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className={`
      ${isDraggable ? "relative" : "fixed left-2 right-2 bottom-16 sm:left-auto sm:right-4 sm:bottom-4"} 
      w-full sm:w-96 
      ${isDraggable ? "h-[600px] max-h-[80vh]" : "h-[65vh] sm:h-[600px] sm:max-h-[85vh]"}
      bg-gray-900 rounded-lg shadow-2xl border border-gray-700 flex flex-col z-50 animate-slide-up
    `}>
      {/* Header with Drag Handle */}
      <div className="bg-gradient-to-r from-purple-600 to-violet-600 text-white p-4 rounded-t-lg flex items-center justify-between shrink-0">
        {/* Drag Handle Area - this is what users grab to drag */}
        {isDraggable && (
          <div
            className="cursor-grab active:cursor-grabbing p-1 -ml-2 mr-2 hover:bg-white/20 rounded transition-colors"
            title="Drag to move"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="19" r="1" />
              <circle cx="15" cy="5" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="19" r="1" />
            </svg>
          </div>
        )}
        <div className="flex items-center space-x-2 flex-1">
          <Brain className="h-5 w-5" />
          <span className="font-semibold">Mally AI</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="hover:bg-white/20 p-1 rounded-full transition-colors"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="hover:bg-white/20 p-1 rounded-full transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background min-h-0">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"
              }`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${message.sender === "user"
                ? "bg-purple-600 text-white"
                : message.isError
                  ? "bg-red-900 text-red-100 border border-red-700"
                  : "bg-purple-900/50 text-white border border-purple-700/50"
                }`}
            >
              {message.image && (
                <div className="mb-2">
                  <img
                    src={message.image.dataUrl}
                    alt={message.image.fileName}
                    className="max-w-full h-auto rounded border border-white/20"
                    style={{ maxHeight: '200px' }}
                  />
                  <p className="text-xs opacity-70 mt-1">{message.image.fileName}</p>
                </div>
              )}
              <div className="flex items-center space-x-2">
                {message.sender === "ai" && (
                  <Bot className="h-4 w-4 flex-shrink-0" />
                )}
                <span className="text-sm">
                  {message.isLoading ? (
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{message.text}</span>
                    </div>
                  ) : (
                    message.text
                  )}
                </span>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Siri-style Listening Indicator */}
      {isRecording && (
        <div className="flex items-center justify-center py-4 bg-gradient-to-t from-gray-900 to-transparent">
          <div className="flex items-center space-x-2 px-4 py-2 bg-purple-600/20 rounded-full border border-purple-500/30">
            <div className="flex space-x-1">
              <div className="w-1 h-4 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
              <div className="w-1 h-6 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
              <div className="w-1 h-8 bg-purple-600 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
              <div className="w-1 h-6 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
              <div className="w-1 h-4 bg-purple-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
            </div>
            <span className="text-purple-300 text-sm font-medium ml-2">Listening...</span>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-gray-700 bg-gray-900 rounded-b-lg shrink-0">
        {/* Image preview */}
        {uploadedImage && (
          <div className="mb-2 relative inline-block">
            <img
              src={uploadedImage.dataUrl}
              alt={uploadedImage.fileName}
              className="max-h-20 rounded border border-gray-600"
            />
            <button
              onClick={removeImage}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
              title="Remove image"
            >
              <X className="h-3 w-3" />
            </button>
            <p className="text-xs text-gray-400 mt-1">{uploadedImage.fileName}</p>
          </div>
        )}
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="w-full p-3 border border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-800 text-white placeholder-gray-400 min-h-[44px] max-h-[120px]"
              rows={1}
              disabled={isLoading}
            />
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            className="bg-gray-700 text-gray-300 p-3 rounded-lg hover:bg-gray-600 disabled:opacity-50 transition-colors"
            title="Upload image"
          >
            <ImageIcon className="h-4 w-4" />
          </button>
          <button
            onClick={toggleRecording}
            disabled={isLoading}
            className={`p-3 rounded-lg transition-colors ${isRecording
              ? "bg-red-500 text-white animate-pulse"
              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            title={isRecording ? "Stop recording" : "Start voice recording"}
          >
            <Mic className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isLoading}
            className="bg-purple-600 text-white p-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
