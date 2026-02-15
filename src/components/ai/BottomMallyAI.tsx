// Bottom-fixed Mally AI component with expandable chat
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import {
  Send,
  Mic,
  X,
  ChevronDown,
  ChevronUp,
  ListTodo,
  Calendar,
  Bell,
  Clock,
  Repeat,
  Sparkles,
  Bot,
  User,
  Loader2,
  Image as ImageIcon,
  Minimize2,
  Volume2,
  VolumeX,
  Zap,
  Star,
  Code2,
  Cpu,
  Fingerprint,
  AlertTriangle,
  CheckSquare,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext.firebase";
import { FirebaseFunctions } from "@/integrations/firebase/functions";
import { useUsageLimits } from "@/hooks/use-usage-limits";
import { useMallyActions } from "@/hooks/use-mally-actions";
import { useProactiveSuggestions, ProactiveSuggestion } from "@/hooks/use-proactive-suggestions";
import { logger } from "@/lib/logger";
import { useHeyMallySafe } from "@/contexts/HeyMallyContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { mallyTTS } from "@/lib/ai/tts-service";
import { speechService } from "@/lib/ai/speech-recognition-service";
import { haptics } from "@/lib/haptics";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
  isLoading?: boolean;
  isError?: boolean;
  image?: {
    dataUrl: string;
    fileName: string;
    mimeType: string;
  };
}

interface QuickAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  prompt: string;
}

const defaultQuickActions: QuickAction[] = [
  { id: "todo", label: "Add todo", icon: <ListTodo size={14} />, prompt: "Add a todo: " },
  { id: "event", label: "New event", icon: <Calendar size={14} />, prompt: "Create an event: " },
  { id: "alarm", label: "Set alarm", icon: <Bell size={14} />, prompt: "Set an alarm for " },
  { id: "reminder", label: "Remind me", icon: <Clock size={14} />, prompt: "Remind me to " },
  { id: "reschedule", label: "Reschedule", icon: <Repeat size={14} />, prompt: "Reschedule " },
];

interface BottomMallyAIProps { }

const DoodleBackground = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
    {/* Abstract shapes and icons */}
    <div className="absolute top-[10%] left-[5%] opacity-[0.03] rotate-12">
      <Bot size={120} />
    </div>
    <div className="absolute bottom-[20%] right-[5%] opacity-[0.03] -rotate-12">
      <Fingerprint size={140} />
    </div>

    {/* Floating elements - Right side */}
    <div className="absolute top-[20%] right-[15%] opacity-10">
      <Sparkles className="text-purple-300 w-6 h-6 animate-pulse" style={{ animationDuration: '3s' }} />
    </div>
    <div className="absolute top-[40%] right-[8%] opacity-[0.07] rotate-45">
      <Zap className="text-purple-300 w-10 h-10" />
    </div>
    <div className="absolute bottom-[30%] right-[12%] opacity-[0.05]">
      <Code2 className="text-white w-8 h-8" />
    </div>

    {/* Floating elements - Left side */}
    <div className="absolute top-[30%] left-[10%] opacity-[0.07] -rotate-12">
      <Cpu className="text-purple-300 w-10 h-10" />
    </div>
    <div className="absolute bottom-[40%] left-[8%] opacity-10">
      <Star className="text-white w-5 h-5 animate-pulse" style={{ animationDuration: '4s' }} />
    </div>
    <div className="absolute top-[15%] left-[20%] opacity-[0.04]">
      <div className="w-16 h-16 rounded-full border-2 border-white/20 border-dashed animate-[spin_10s_linear_infinite]" />
    </div>
  </div>
);

export const BottomMallyAI: React.FC<BottomMallyAIProps> = () => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const wasVoiceActivatedRef = useRef(false);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(() => {
    const saved = localStorage.getItem('mally-voice-muted');
    return saved !== null ? saved === 'true' : false; // Voice ON by default
  });
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Wire TTS speaking state to component
  useEffect(() => {
    mallyTTS.onSpeakingChange((speaking) => {
      setIsSpeaking(speaking);
      // Auto-dismiss after voice response finishes (if voice-activated)
      if (!speaking && wasVoiceActivatedRef.current) {
        setTimeout(() => {
          if (!isRecording && !isLoading) {
            wasVoiceActivatedRef.current = false;
            setIsExpanded(false);
          }
        }, 3000);
      }
    });
    return () => mallyTTS.onSpeakingChange(() => { });
  }, [isRecording, isLoading]);
  const [quickActions, setQuickActions] = useState<QuickAction[]>(defaultQuickActions);
  const [uploadedImage, setUploadedImage] = useState<{
    dataUrl: string;
    fileName: string;
    mimeType: string;
  } | null>(null);

  // Fixed full-width layout
  const containerRef = useRef<HTMLDivElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);




  const { user } = useAuth();
  const { limits, incrementAICount, triggerUpgradePrompt } = useUsageLimits();
  const { pauseWakeWord, resumeWakeWord } = useHeyMallySafe();
  const {
    executeAction,
    buildContext,
    events,
    todos,
    lists,
    activeListId,
  } = useMallyActions();

  const { suggestions: proactiveSuggestions, currentIndex: proactiveIndex, dismiss: dismissSuggestion, next: nextSuggestion } = useProactiveSuggestions({ events, todos });
  const activeSuggestion = proactiveSuggestions[proactiveIndex] ?? null;

  // MIGRATION: Effect to move old todos to new list
  useEffect(() => {
    const migrateLegacyTodos = async () => {
      // Dynamic import to avoid bundling legacy hook code if possible, or just use raw firestore
      const { collection, getDocs, query, where, addDoc, deleteDoc, doc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('@/integrations/firebase/config');

      if (!user?.uid) return;

      try {
        const legacyQuery = query(collection(db, 'todos'), where('userId', '==', user.uid));
        const snapshot = await getDocs(legacyQuery);

        if (!snapshot.empty) {
          console.log(`Found ${snapshot.size} legacy todos to migrate...`);
          let migratedCount = 0;

          // Get a target list ID
          let targetListId = activeListId;
          if (!targetListId && lists.length > 0) targetListId = lists[0].id;

          for (const docSnapshot of snapshot.docs) {
            const data = docSnapshot.data();

            // Add to new collection
            await addDoc(collection(db, 'todo_items'), {
              text: data.text || 'Untitled Task',
              completed: data.completed || false,
              listId: targetListId, // Fallback to first list or null (will need handling)
              userId: user.uid,
              createdAt: data.created_at || serverTimestamp(),
              migratedFrom: 'legacy_todos'
            });

            // Delete old doc
            await deleteDoc(doc(db, 'todos', docSnapshot.id));
            migratedCount++;
          }

          if (migratedCount > 0) {
            toast.success(`Migrated ${migratedCount} old tasks to your new list!`);
          }
        }
      } catch (e) {
        console.error("Migration failed", e);
      }
    };

    // Run migration after a short delay to let things load
    const timer = setTimeout(migrateLegacyTodos, 3000);
    return () => clearTimeout(timer);
  }, [user?.uid, lists, activeListId]);

  // Text-to-speech using Google Cloud TTS with Web Speech fallback
  const speak = useCallback(async (text: string) => {
    if (isMuted) return;
    try {
      await mallyTTS.speak({ text });
    } catch {
      mallyTTS.speakFallback(text);
    }
  }, [isMuted]);



  // Scroll to bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  // Auto-retract when navigating to a different page
  useEffect(() => {
    setIsExpanded(false);
    setIsMinimized(true);
    mallyTTS.stop();
    if (isRecording) {
      speechService.stopListening();
      setIsRecording(false);
      resumeWakeWord?.();
    }
  }, [location.pathname]);

  // Listen for Hey Mally activation — Siri-like voice-first flow
  useEffect(() => {
    const handleHeyMallyActivation = () => {
      wasVoiceActivatedRef.current = true;
      setIsExpanded(true);
      haptics.medium();

      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        text: "I'm listening...",
        sender: 'ai',
        timestamp: new Date(),
      }]);

      // Auto-start recording after brief delay so user can speak immediately
      setTimeout(async () => {
        if (!isRecording) {
          const available = await speechService.isAvailable();
          if (available) {
            setIsRecording(true);
            pauseWakeWord?.();
            haptics.light();

            await speechService.startListening(
              (result) => {
                setInputText(result.transcript);
                if (result.isFinal) {
                  setIsRecording(false);
                  resumeWakeWord?.();
                  setTimeout(() => handleSendMessage(result.transcript), 100);
                }
              },
              () => {
                setIsRecording(false);
                resumeWakeWord?.();
              }
            );
          }
        }
      }, 400);
    };

    window.addEventListener('heyMallyActivated', handleHeyMallyActivation);
    return () => window.removeEventListener('heyMallyActivated', handleHeyMallyActivation);
  }, [isRecording, pauseWakeWord, resumeWakeWord]);

  // Handle image upload
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedImage({
        dataUrl: e.target?.result as string,
        fileName: file.name,
        mimeType: file.type,
      });
      setIsExpanded(true);
    };
    reader.readAsDataURL(file);
  }, []);

  // Send message to AI
  const handleSendMessage = async (text?: string) => {
    haptics.light();
    const messageText = text || inputText.trim();
    console.log('MallyAI: handleSendMessage', {
      messageText,
      currentMessagesCount: messages.length,
      hasImage: !!uploadedImage
    });

    if (!messageText && !uploadedImage) {
      console.log('No message text or image, returning');
      return;
    }

    console.log('Adding user message');

    // Add user message
    const userMessage: Message = {
      id: crypto.randomUUID(),
      text: messageText || "Analyze this image",
      sender: "user",
      timestamp: new Date(),
      image: uploadedImage || undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setUploadedImage(null);
    setIsLoading(true);

    // Add loading message
    const loadingId = crypto.randomUUID();
    setMessages(prev => [...prev, {
      id: loadingId,
      text: "Thinking...",
      sender: "ai",
      timestamp: new Date(),
      isLoading: true,
    }]);

    try {
      // Build context
      const context = buildContext();

      // Prepare history for Gemini (limited to last 10 messages for token efficiency)
      const messageHistory = messages
        .filter(m => !m.isLoading && m.text !== "Thinking...")
        .slice(-10)
        .map(m => ({
          role: (m.sender === 'user' ? 'user' : 'model') as 'user' | 'model',
          parts: m.text || ""
        }));

      console.log('MallyAI: Sending request', {
        historyLength: messageHistory.length,
        contextEvents: context.events.length,
        contextTodos: context.todos.length
      });

      // Call Firebase function
      const response = await FirebaseFunctions.processScheduling({
        userMessage: messageText,
        userId: user?.uid || '',
        context: JSON.stringify(context),
        history: messageHistory,
        imageData: uploadedImage ? {
          dataUrl: uploadedImage.dataUrl,
          mimeType: uploadedImage.mimeType,
        } : undefined,
      });

      // Increment AI usage
      await incrementAICount();

      // Process response and execute actions
      const aiResponse = response.message || "I couldn't process that request.";

      console.log('AI Response:', response);

      // Execute actions if present (support both single action and multiple actions)
      if (response.action) {
        console.log('Single action found:', response.action);
        const success = await executeAction(response.action);
        if (success) haptics.success();
      }

      // Handle multiple actions array
      if ((response as any).actions && Array.isArray((response as any).actions)) {
        console.log('Multiple actions found:', (response as any).actions);
        for (const action of (response as any).actions) {
          const success = await executeAction(action);
          if (success) haptics.success();
        }
      }

      // Update with AI response
      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, text: aiResponse, isLoading: false }
          : m
      ));

      // Speak the AI response
      speak(aiResponse);

      // Update quick actions based on context
      updateQuickActionsFromContext(aiResponse, response.action);

    } catch (error: any) {
      logger.error('BottomMallyAI', 'Chat error', error);
      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, text: "Sorry, I encountered an error. Please try again.", isLoading: false, isError: true }
          : m
      ));
    } finally {
      setIsLoading(false);
    }
  };

  // Update quick actions based on conversation context
  const updateQuickActionsFromContext = (response: string, action: { type: string; data: any } | null | undefined) => {
    // If we just created an event, suggest related actions
    if (action?.type === 'create_event') {
      setQuickActions([
        { id: "another", label: "Add another", icon: <Calendar size={14} />, prompt: "Create another event: " },
        { id: "reminder", label: "Set reminder", icon: <Bell size={14} />, prompt: "Set a reminder for this event" },
        { id: "recurring", label: "Make recurring", icon: <Repeat size={14} />, prompt: "Make this event recurring" },
        { id: "todo", label: "Add todo", icon: <ListTodo size={14} />, prompt: "Add a related todo: " },
        { id: "done", label: "Done", icon: <Sparkles size={14} />, prompt: "" },
      ]);
    } else {
      setQuickActions(defaultQuickActions);
    }
  };

  // Handle quick action click
  const handleQuickAction = (action: QuickAction) => {
    haptics.selection();
    if (action.id === 'done') {
      setIsExpanded(false);
      return;
    }
    setInputText(action.prompt);
    inputRef.current?.focus();
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Toggle voice recording
  const toggleRecording = async () => {
    if (isRecording) {
      setIsRecording(false);
      resumeWakeWord?.();
      // On native, stopListening returns the final transcript
      const transcript = await speechService.stopListening();
      if (transcript) {
        setInputText(transcript);
        setTimeout(() => handleSendMessage(transcript), 100);
      }
    } else {
      const available = await speechService.isAvailable();
      if (!available) {
        toast.error('Speech recognition not supported on this device');
        return;
      }

      setIsRecording(true);
      pauseWakeWord?.();
      haptics.medium();

      await speechService.startListening(
        (result) => {
          setInputText(result.transcript);
          if (result.isFinal) {
            setIsRecording(false);
            resumeWakeWord?.();
            setTimeout(() => handleSendMessage(result.transcript), 100);
          }
        },
        (error) => {
          console.error('[Mally] Speech recognition error:', error);
          setIsRecording(false);
          resumeWakeWord?.();
          toast.error('Voice recognition failed');
        }
      );
    }
  };

  return (
    <>
      {/* Dark overlay when expanded */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsExpanded(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Minimized floating icon */}
      <AnimatePresence>
        {isMinimized && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => setIsMinimized(false)}
            className={cn(
              "fixed z-50 p-3 rounded-full",
              "bg-gradient-to-br from-purple-600 to-purple-700",
              "shadow-lg shadow-purple-500/30",
              "hover:shadow-xl hover:shadow-purple-500/40",
              "hover:scale-105 transition-all",
              isMobile ? "bottom-20 left-4" : "bottom-4 right-4"
            )}
          >
            <Sparkles className="h-6 w-6 text-white" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Main container - fixed at bottom (starts after sidebar, above mobile nav on mobile) */}
      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            ref={containerRef}
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className={cn(
              "fixed z-50 flex flex-col",
              isMobile ? "left-2 right-2 bottom-[72px]" : "left-4 right-4 bottom-4",
              "rounded-2xl backdrop-blur-3xl"
            )}
            style={{
              maxHeight: isMobile ? "70vh" : "60vh",
            }}
            transition={{ type: "spring", damping: 30, stiffness: 250 }}
          >
            <DoodleBackground />


            {/* Minimize button - top right */}
            <button
              onClick={() => setIsMinimized(true)}
              className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors z-10"
              title="Minimize"
            >
              <Minimize2 className="h-4 w-4" />
            </button>

            {/* Messages area - shows chat history */}
            <AnimatePresence>
              {messages.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex-1 overflow-y-auto px-4 py-3 max-h-[40vh] scrollbar-hide">
                    <div className="space-y-3 max-w-4xl mx-auto w-full">
                      {messages.map((message, index) => (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={cn(
                            "flex gap-2",
                            message.sender === "user" ? "justify-end" : "justify-start"
                          )}
                        >
                          {message.sender === "ai" && (
                            <div className="flex flex-col items-center gap-1 flex-shrink-0">
                              <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center">
                                <Bot className="h-4 w-4 text-white" />
                              </div>
                              {isSpeaking && index === messages.length - 1 && (
                                <div className="mally-speaking">
                                  <div className="bar" /><div className="bar" /><div className="bar" /><div className="bar" /><div className="bar" />
                                </div>
                              )}
                            </div>
                          )}
                          <div
                            className={cn(
                              "max-w-[75%] px-3 py-2 rounded-2xl text-sm",
                              message.sender === "user"
                                ? "bg-purple-600 text-white rounded-br-md"
                                : message.isError
                                  ? "bg-red-500/20 text-red-200 border border-red-500/30 rounded-bl-md"
                                  : "bg-white/10 text-foreground border border-white/10 rounded-bl-md"
                            )}
                          >
                            {message.image && (
                              <img
                                src={message.image.dataUrl}
                                alt="Uploaded"
                                className="max-w-full h-auto rounded-lg mb-2 max-h-32"
                              />
                            )}
                            {message.isLoading ? (
                              <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span>{message.text}</span>
                              </div>
                            ) : (
                              <span className="whitespace-pre-wrap">{message.text}</span>
                            )}
                          </div>
                          {message.sender === "user" && (
                            <div className="w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                              <User className="h-4 w-4 text-white" />
                            </div>
                          )}
                        </motion.div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quick action chips */}
            <div className="px-4 py-2 overflow-x-auto scrollbar-hide">
              <div className="flex gap-2 max-w-4xl mx-auto w-full">
                {quickActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={() => handleQuickAction(action)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
                      "bg-white/5 hover:bg-white/10 border border-white/10",
                      "text-muted-foreground hover:text-foreground",
                      "transition-all whitespace-nowrap flex-shrink-0"
                    )}
                    title={action.label}
                  >
                    {action.icon}
                    <span className="hidden sm:inline">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Proactive suggestion banner */}
            <AnimatePresence>
              {activeSuggestion && (
                <motion.div
                  key={activeSuggestion.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.2 }}
                  className="px-4 pb-2"
                >
                  <div className="max-w-4xl mx-auto w-full">
                    <div className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-xs",
                      "bg-purple-500/10 border",
                      activeSuggestion.priority === 'high'
                        ? "border-purple-400/40"
                        : "border-purple-500/20"
                    )}>
                      <span className="text-purple-400 shrink-0">
                        {activeSuggestion.iconName === 'AlertTriangle' && <AlertTriangle size={12} />}
                        {activeSuggestion.iconName === 'Bell' && <Bell size={12} />}
                        {activeSuggestion.iconName === 'Clock' && <Clock size={12} />}
                        {activeSuggestion.iconName === 'Calendar' && <Calendar size={12} />}
                        {activeSuggestion.iconName === 'CheckSquare' && <CheckSquare size={12} />}
                        {activeSuggestion.iconName === 'Zap' && <Zap size={12} />}
                      </span>
                      <button
                        className="flex-1 text-left text-foreground hover:text-foreground/80 transition-colors"
                        onClick={() => {
                          setInputText(activeSuggestion.prompt);
                          dismissSuggestion(activeSuggestion.id);
                        }}
                      >
                        {activeSuggestion.message}
                      </button>
                      {proactiveSuggestions.length > 1 && (
                        <button
                          onClick={nextSuggestion}
                          className="text-muted-foreground hover:text-foreground shrink-0 font-mono"
                        >
                          {proactiveIndex + 1}/{proactiveSuggestions.length}
                        </button>
                      )}
                      <button
                        onClick={() => dismissSuggestion(activeSuggestion.id)}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input area */}
            <div className="px-4 pb-5 pt-3">
              {/* Image preview */}
              {uploadedImage && (
                <div className="relative inline-block mb-2">
                  <img
                    src={uploadedImage.dataUrl}
                    alt="Upload preview"
                    className="h-16 rounded-lg border border-white/20"
                  />
                  <button
                    onClick={() => setUploadedImage(null)}
                    className="absolute -top-1 -right-1 p-0.5 bg-red-500 rounded-full"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
                {/* Image upload button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ImageIcon className="h-5 w-5" />
                </button>

                {/* Text input */}
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    onFocus={() => setIsExpanded(true)}
                    placeholder="Ask Mally anything..."
                    className={cn(
                      "w-full px-4 py-2.5 rounded-full",
                      "bg-white/5 border border-white/10",
                      "text-foreground placeholder:text-muted-foreground",
                      "focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50",
                      "transition-all"
                    )}
                    disabled={isLoading}
                  />
                </div>

                {/* Voice button */}
                <button
                  onClick={toggleRecording}
                  disabled={isLoading}
                  className={cn(
                    "p-2.5 rounded-full transition-all",
                    isRecording
                      ? "bg-red-500 text-white animate-pulse"
                      : "bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Mic className="h-5 w-5" />
                </button>

                {/* Mute/Unmute button */}
                <button
                  onClick={() => {
                    const newVal = !isMuted;
                    setIsMuted(newVal);
                    localStorage.setItem('mally-voice-muted', String(newVal));
                  }}
                  className={cn(
                    "p-2.5 rounded-full transition-all",
                    isMuted
                      ? "bg-white/5 text-red-400 hover:bg-white/10"
                      : "bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground"
                  )}
                  title={isMuted ? "Unmute AI voice" : "Mute AI voice"}
                >
                  {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </button>

                {/* Send button */}
                <button
                  onClick={() => {
                    console.log('Send button clicked, inputText:', inputText);
                    handleSendMessage();
                  }}
                  disabled={(!inputText.trim() && !uploadedImage) || isLoading}
                  className={cn(
                    "p-2.5 rounded-full transition-all",
                    inputText.trim() || uploadedImage
                      ? "bg-purple-600 hover:bg-purple-700 text-white"
                      : "bg-white/5 text-muted-foreground"
                  )}
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Recording indicator */}
            <AnimatePresence>
              {isRecording && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4"
                >
                  <div className="flex items-center gap-2 px-4 py-2 bg-red-500/90 text-white rounded-full shadow-lg">
                    <div className="flex space-x-1">
                      <div className="w-1 h-3 bg-white rounded-full animate-pulse" />
                      <div className="w-1 h-4 bg-white rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
                      <div className="w-1 h-5 bg-white rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
                      <div className="w-1 h-4 bg-white rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
                      <div className="w-1 h-3 bg-white rounded-full animate-pulse" />
                    </div>
                    <span className="text-sm font-medium">Listening...</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default BottomMallyAI;
