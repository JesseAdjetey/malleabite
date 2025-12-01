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
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext.firebase";
import { FirebaseFunctions } from "@/integrations/firebase/functions";
import { CalendarEventType } from "@/lib/stores/types";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { shouldUseFirebase, logMigrationStatus } from "@/lib/migration-flags";
import "../../styles/ai-animations.css";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
  isLoading?: boolean;
  isError?: boolean;
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
}

export const MallyAIFirebase: React.FC<MallyAIFirebaseProps> = ({
  onScheduleEvent,
  initialPrompt,
  preventOpenOnClick = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const { user } = useAuth();
  const { fetchEvents } = useCalendarEvents();

  useEffect(() => {
    logMigrationStatus('MallyAI', 'firebase');
  }, []);

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

  // Handle audio transcription using Firebase Functions
  const handleAudioTranscription = async (audioBlob: Blob): Promise<string> => {
    try {
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Convert audio blob to base64
      const arrayBuffer = await audioBlob.arrayBuffer();
      const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      console.log("Calling Firebase transcribeAudio function...");
      
      const response = await FirebaseFunctions.transcribeAudio({
        audioData: base64Audio,
        userId: user.uid
      });

      if (!response.success) {
        throw new Error(response.error || "Transcription failed");
      }

      return response.transcript || "";
    } catch (error) {
      console.error("Audio transcription error:", error);
      throw error;
    }
  };

  // Start/stop audio recording
  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      if (mediaRecorder) {
        mediaRecorder.stop();
        setIsRecording(false);
      }
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        
        recorder.ondataavailable = (event) => {
          setAudioChunks((prev) => [...prev, event.data]);
        };
        
        recorder.onstop = async () => {
          const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
          setAudioChunks([]);
          
          try {
            setIsLoading(true);
            addMessage({ text: "Transcribing audio...", sender: "ai", isLoading: true });
            
            const transcript = await handleAudioTranscription(audioBlob);
            
            if (transcript.trim()) {
              setInputText(transcript);
              // Remove the transcribing message
              setMessages((prev) => prev.filter((msg) => !msg.isLoading));
            } else {
              throw new Error("No speech detected");
            }
          } catch (error) {
            console.error("Transcription error:", error);
            toast.error("Failed to transcribe audio");
            setMessages((prev) => prev.filter((msg) => !msg.isLoading));
          } finally {
            setIsLoading(false);
          }
          
          // Stop all tracks
          stream.getTracks().forEach(track => track.stop());
        };
        
        setMediaRecorder(recorder);
        recorder.start();
        setIsRecording(true);
        toast.success("Recording started...");
      } catch (error) {
        console.error("Failed to start recording:", error);
        toast.error("Failed to start recording");
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
      console.log("Calling Firebase processScheduling function...");
      console.log("User message:", textToSend);
      console.log("User ID:", user.uid);

      const response = await FirebaseFunctions.processScheduling({
        userMessage: textToSend,
        userId: user.uid,
        context: {
          currentTime: new Date().toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
      });

      console.log("Firebase AI Response:", response);

      // Update the loading message with the response
      updateMessage(loadingMessageId, {
        text: response.message || "I've processed your request!",
        isLoading: false,
        isError: !response.success,
      });

      if (response.success && response.operations && response.operations.length > 0) {
        // Refresh events to show newly created events
        await fetchEvents();
        toast.success("Events updated successfully!");
      }

      if (!response.success) {
        throw new Error(response.error || "AI processing failed");
      }

    } catch (error: any) {
      console.error("Firebase AI Error:", error);
      
      updateMessage(loadingMessageId, {
        text: "Sorry, I encountered an error processing your request. Please try again.",
        isLoading: false,
        isError: true,
      });
      
      toast.error("AI Error: " + (error.message || "Unknown error"));
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

  if (!isOpen) {
    return (
      <button
        onClick={() => !preventOpenOnClick && setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-full shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/30 transition-all duration-300 hover:scale-105 z-50 animate-pulse-glow"
        title="Open Mally AI Assistant"
      >
        <Brain className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 h-[600px] bg-gray-900 rounded-lg shadow-2xl border border-gray-700 flex flex-col z-50 animate-slide-up">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-4 rounded-t-lg flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Brain className="h-5 w-5" />
          <span className="font-semibold">Mally AI</span>
          <Sparkles className="h-4 w-4 animate-pulse" />
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="hover:bg-white/20 p-1 rounded-full transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.sender === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                message.sender === "user"
                  ? "bg-blue-600 text-white"
                  : message.isError
                  ? "bg-red-900 text-red-300 border border-red-700"
                  : "bg-gray-800 text-gray-100 border border-gray-700"
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
      <div className="p-4 border-t border-gray-700 bg-gray-900">
        <div className="flex space-x-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="w-full p-3 border border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-800 text-white placeholder-gray-400 min-h-[44px] max-h-[120px]"
              rows={1}
              disabled={isLoading}
            />
          </div>
          <button
            onClick={toggleRecording}
            disabled={isLoading}
            className={`p-3 rounded-lg transition-colors ${
              isRecording
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
            className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
