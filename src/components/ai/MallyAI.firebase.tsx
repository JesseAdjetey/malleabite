// Firebase-compatible MallyAI component
import React, { useState, useRef, useEffect } from "react";
import {
  Bot,
  Send,
  Plus,
  X,
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  Loader2,
  Sparkles,
  Brain,
  Mic,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext.firebase";
import { FirebaseFunctions } from "@/integrations/firebase/functions";
import { CalendarEventType } from "@/lib/stores/types";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { shouldUseFirebase, logMigrationStatus } from "@/lib/migration-flags";
import { logger } from "@/lib/logger";
import { errorHandler } from "@/lib/error-handler";
import "../../styles/ai-animations.css";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
  isLoading?: boolean;
  isError?: boolean;
  pendingEvent?: any; // Event data waiting for confirmation
}

const initialMessages: Message[] = [
  {
    id: "1",
    text: "Hello! I'm Mally, your intelligent scheduling assistant. I can help you create events, manage your calendar, and organize your time. What would you like me to help you with?",
    sender: "ai",
    timestamp: new Date(),
  },
];

interface MallyAIFirebaseProps {
  onScheduleEvent?: (event: any) => Promise<any>;
  initialPrompt?: string;
  preventOpenOnClick?: boolean;
  isMobileSheet?: boolean;
}

export const MallyAIFirebase: React.FC<MallyAIFirebaseProps> = ({
  onScheduleEvent,
  initialPrompt,
  preventOpenOnClick = false,
  isMobileSheet = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<any>(null); // SpeechRecognition instance
  const [pendingEvent, setPendingEvent] = useState<any>(null); // Track event awaiting confirmation

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { user } = useAuth();
  const { fetchEvents, addEvent, events } = useCalendarEvents();

  useEffect(() => {
    logMigrationStatus('MallyAI', 'firebase');
  }, []);

  // Helper function to create calendar event from AI response
  const createEventFromAIData = async (eventData: any): Promise<boolean> => {
    if (!user || !eventData) return false;
    
    try {
      // Log raw event data from AI
      console.log('=== RAW EVENT DATA FROM AI ===', JSON.stringify(eventData, null, 2));
      
      const startsAt = new Date(eventData.startsAt || eventData.start);
      const endsAt = new Date(eventData.endsAt || eventData.end);
      
      console.log('=== PARSED DATES ===', {
        rawStartsAt: eventData.startsAt || eventData.start,
        rawEndsAt: eventData.endsAt || eventData.end,
        parsedStartsAt: startsAt.toISOString(),
        parsedEndsAt: endsAt.toISOString(),
        startHour: startsAt.getHours(),
        endHour: endsAt.getHours()
      });
      
      logger.info('MallyAI', 'Creating event with times', { 
        title: eventData.title,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString()
      });
      
      const newEvent: CalendarEventType = {
        id: crypto.randomUUID(),
        title: eventData.title,
        description: eventData.description || 'Created by Mally AI',
        date: startsAt.toISOString().split('T')[0],
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        color: eventData.color || '#3b82f6',
      };
      
      logger.info('MallyAI', 'Creating event', { title: newEvent.title, startsAt: newEvent.startsAt, endsAt: newEvent.endsAt });
      const result = await addEvent(newEvent);
      
      if (result.success) {
        toast.success(`Event "${eventData.title}" created!`);
        await fetchEvents();
        return true;
      } else {
        toast.error('Failed to create event');
        return false;
      }
    } catch (error) {
      logger.error('MallyAI', 'Failed to create event', error as Error);
      toast.error('Failed to create event');
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

  // Text-to-Speech function with high-quality English voice
  const speak = (text: string) => {
    if (isMuted || !window.speechSynthesis) return;

    // Cancel any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    
    // Get available voices
    const voices = window.speechSynthesis.getVoices();
    
    // Priority order for natural-sounding English voices
    const preferredVoiceNames = [
      'Google UK English Female',
      'Google US English',
      'Microsoft Zira',
      'Microsoft Jenny',
      'Samantha',
      'Karen',
      'Daniel',
      'Google UK English Male',
      'Alex',
      'Victoria',
      'Moira'
    ];
    
    // Find the best available voice
    let selectedVoice = null;
    
    // First try to find a preferred voice
    for (const name of preferredVoiceNames) {
      selectedVoice = voices.find(v => v.name.includes(name));
      if (selectedVoice) break;
    }
    
    // Fallback: find any English voice
    if (!selectedVoice) {
      selectedVoice = voices.find(v => 
        v.lang.startsWith('en-') && 
        (v.name.includes('Female') || v.name.includes('Google') || v.name.includes('Microsoft'))
      );
    }
    
    // Last resort: any English voice
    if (!selectedVoice) {
      selectedVoice = voices.find(v => v.lang.startsWith('en-'));
    }
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.rate = 0.95; // Slightly slower for clarity
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

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
    } else {
      // Start speech recognition using Web Speech API
      try {
        // Check if browser supports speech recognition
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
          toast.error("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
          return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        let finalTranscript = '';

        recognition.onstart = () => {
          setIsRecording(true);
          toast.success("Listening... Speak now!");
          logger.info('MallyAI', 'Speech recognition started');
        };

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }
          
          // Show interim results in input
          setInputText(finalTranscript + interimTranscript);
        };

        recognition.onend = () => {
          setIsRecording(false);
          setMediaRecorder(null);
          
          if (finalTranscript.trim()) {
            logger.info('MallyAI', 'Speech recognition complete', { transcript: finalTranscript });
            setInputText(finalTranscript.trim());
            toast.success("Speech captured!");
          } else {
            toast.info("No speech detected. Try again.");
          }
        };

        recognition.onerror = (event: any) => {
          setIsRecording(false);
          setMediaRecorder(null);
          logger.error('MallyAI', 'Speech recognition error', { error: event.error });
          
          if (event.error === 'no-speech') {
            toast.info("No speech detected. Try again.");
          } else if (event.error === 'not-allowed') {
            toast.error("Microphone access denied. Please allow microphone access.");
          } else {
            toast.error(`Speech recognition error: ${event.error}`);
          }
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

  // Send message and get AI response using Firebase Functions
  const handleSendMessage = async (messageText?: string) => {
    const textToSend = messageText || inputText.trim();
    if (!textToSend || isLoading || !user) return;

    // Clear input
    setInputText("");

    // Add user message
    addMessage({ text: textToSend, sender: "user" });

    // Add loading AI message
    const loadingMessageId = addMessage({
      text: "Thinking...",
      sender: "ai",
      isLoading: true,
    });

    setIsLoading(true);

    try {
      logger.debug('MallyAI', 'Processing user message', {
        messageLength: textToSend.length,
        userId: user.uid,
        hasPendingEvent: !!pendingEvent
      });

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
        context: {
          currentTime: new Date().toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          conversationHistory
        }
      });

      logger.info('MallyAI', 'Firebase AI Response received', {
        success: response.success,
        hasOperations: response.operations && response.operations.length > 0,
        intent: (response as any).intent
      });

      let responseText = response.message || "I've processed your request!";
      let eventCreated = false;

      // Check if AI returned event data that should be created
      if (response.success && response.operations && response.operations.length > 0) {
        const operation = response.operations[0];
        const eventData = operation.data;
        
        // Check the intent - if it's a confirmation, create the event immediately
        const intent = (response as any).intent;
        
        if (intent === 'confirmation' && eventData) {
          // User confirmed - create the event now
          logger.info('MallyAI', 'User confirmed event creation', { eventData });
          eventCreated = await createEventFromAIData(eventData);
          if (eventCreated) {
            responseText = responseText || `Done! I've added "${eventData.title}" to your calendar.`;
            setPendingEvent(null);
          }
        } else if (eventData) {
          // AI is suggesting an event, store it as pending
          logger.info('MallyAI', 'Storing pending event for confirmation', { eventData });
          setPendingEvent(eventData);
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

      if (eventCreated) {
        await fetchEvents();
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
        className="fixed bottom-24 right-4 bg-gradient-to-r from-purple-600 to-violet-600 text-white p-4 rounded-full shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 transition-all duration-300 hover:scale-105 z-40 animate-pulse-glow"
        title="Open Mally AI Assistant"
      >
        <Brain className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed left-2 right-2 bottom-16 h-[65vh] sm:left-auto sm:right-4 sm:bottom-4 sm:w-96 sm:h-[600px] bg-gray-900 rounded-lg shadow-2xl border border-gray-700 flex flex-col z-50 animate-slide-up">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-violet-600 text-white p-4 rounded-t-lg flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-2">
          <Brain className="h-5 w-5" />
          <span className="font-semibold">Mally AI</span>
          <Sparkles className="h-4 w-4 animate-pulse" />
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

      {/* Input */}
      <div className="p-4 border-t border-gray-700 bg-gray-900 rounded-b-lg shrink-0">
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
};
