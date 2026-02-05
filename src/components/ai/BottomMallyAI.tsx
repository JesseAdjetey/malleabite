// Bottom-fixed Mally AI component with expandable chat
import React, { useState, useRef, useEffect, useCallback } from "react";
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext.firebase";
import { FirebaseFunctions } from "@/integrations/firebase/functions";
import { CalendarEventType } from "@/lib/stores/types";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { useTodos } from "@/hooks/use-todos";
import { useTodoLists } from "@/hooks/use-todo-lists";
import { useEisenhower } from "@/hooks/use-eisenhower";
import { useAlarms } from "@/hooks/use-alarms";
import { useReminders } from "@/hooks/use-reminders";
import { useUsageLimits } from "@/hooks/use-usage-limits";
import { logger } from "@/lib/logger";
import { useHeyMallySafe } from "@/contexts/HeyMallyContext";
import { useCalendarFilterStore } from "@/lib/stores/calendar-filter-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

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

interface BottomMallyAIProps {
  onScheduleEvent?: (event: any) => Promise<any>;
}

export const BottomMallyAI: React.FC<BottomMallyAIProps> = ({
  onScheduleEvent,
}) => {
  const isMobile = useIsMobile();
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [quickActions, setQuickActions] = useState<QuickAction[]>(defaultQuickActions);
  const [uploadedImage, setUploadedImage] = useState<{
    dataUrl: string;
    fileName: string;
    mimeType: string;
  } | null>(null);
  
  // Draggable left edge position (percentage from left)
  const [leftPosition, setLeftPosition] = useState(25); // Start at 25% from left
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { user } = useAuth();
  const { addEvent, removeEvent, updateEvent, events } = useCalendarEvents();
  const { addTodo, toggleTodo, deleteTodo, todos } = useTodos();
  const { createList, lists } = useTodoLists();
  const { addItem: addEisenhowerItem } = useEisenhower();
  const { addAlarm } = useAlarms();
  const { addReminder } = useReminders();
  const { limits, incrementAICount, triggerUpgradePrompt } = useUsageLimits();
  const calendarAccounts = useCalendarFilterStore(state => state.accounts);
  const { pauseWakeWord, resumeWakeWord } = useHeyMallySafe();

  // Text-to-speech function with premium voice selection
  const speak = useCallback((text: string) => {
    if (isMuted || !window.speechSynthesis) return;
    
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    // Clean up text for speech (remove markdown, emojis, etc.)
    const cleanText = text
      .replace(/[*_`#]/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Remove links but keep text
      .replace(/[😊🎉✨💪🔔⏰📅✅❌]/g, '') // Remove common emojis
      .trim();
    
    if (!cleanText) return;
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.95; // Slightly slower for clarity
    utterance.pitch = 1.05; // Slightly higher for friendliness
    utterance.volume = 1.0;
    
    // Get all available voices
    const voices = window.speechSynthesis.getVoices();
    
    // Premium voice priority list (best quality voices)
    const premiumVoiceNames = [
      // Google's Neural/WaveNet voices (highest quality)
      'Google UK English Female',
      'Google US English',
      // Microsoft Azure Neural voices (very high quality)
      'Microsoft Aria Online (Natural)',
      'Microsoft Jenny Online (Natural)',
      'Microsoft Zira Online (Natural)',
      'Microsoft Sonia Online (Natural)',
      // Apple's premium voices
      'Samantha',
      'Karen',
      'Moira',
      'Tessa',
      // Microsoft Edge voices
      'Microsoft Zira',
      'Microsoft Hazel',
      'Microsoft Susan',
      // Other good quality voices
      'Alex',
      'Victoria',
      'Fiona',
    ];
    
    // Find the best available voice
    let selectedVoice: SpeechSynthesisVoice | null = null;
    
    // First try exact matches from premium list
    for (const name of premiumVoiceNames) {
      const voice = voices.find(v => v.name === name || v.name.includes(name));
      if (voice) {
        selectedVoice = voice;
        break;
      }
    }
    
    // Fallback: prefer any Google or Microsoft Neural voice
    if (!selectedVoice) {
      selectedVoice = voices.find(v => 
        v.name.includes('Google') || 
        v.name.includes('Natural') ||
        v.name.includes('Neural')
      ) || null;
    }
    
    // Fallback: any English female voice (generally more pleasant for assistants)
    if (!selectedVoice) {
      selectedVoice = voices.find(v => 
        v.lang.startsWith('en') && 
        (v.name.toLowerCase().includes('female') || 
         v.name.includes('Zira') || 
         v.name.includes('Hazel'))
      ) || null;
    }
    
    // Final fallback: any English voice
    if (!selectedVoice) {
      selectedVoice = voices.find(v => v.lang.startsWith('en')) || null;
    }
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      console.log('Using voice:', selectedVoice.name);
    }
    
    window.speechSynthesis.speak(utterance);
  }, [isMuted]);

  // Handle drag to resize
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDrag = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const windowWidth = window.innerWidth;
    const newPosition = (clientX / windowWidth) * 100;
    
    // Clamp between 10% and 70%
    setLeftPosition(Math.max(10, Math.min(70, newPosition)));
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add/remove drag listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDrag);
      window.addEventListener('touchend', handleDragEnd);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleDrag);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDrag);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleDrag, handleDragEnd]);

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

  // Listen for Hey Mally activation
  useEffect(() => {
    const handleHeyMallyActivation = () => {
      setIsExpanded(true);
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        text: "I'm listening...",
        sender: 'ai',
        timestamp: new Date(),
      }]);
    };

    window.addEventListener('heyMallyActivated', handleHeyMallyActivation);
    return () => window.removeEventListener('heyMallyActivated', handleHeyMallyActivation);
  }, []);

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
    const messageText = text || inputText.trim();
    console.log('handleSendMessage called:', { messageText, uploadedImage: !!uploadedImage });
    
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
      const context = {
        events: events.slice(0, 20),
        todos: todos.slice(0, 20),
        lists: lists,
        currentDate: new Date().toISOString(),
        availableCalendars: calendarAccounts,
      };

      // Call Firebase function
      const response = await FirebaseFunctions.processScheduling({
        userMessage: messageText,
        userId: user?.uid || '',
        context: JSON.stringify(context),
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
        await executeAction(response.action);
      }
      
      // Handle multiple actions array
      if ((response as any).actions && Array.isArray((response as any).actions)) {
        console.log('Multiple actions found:', (response as any).actions);
        for (const action of (response as any).actions) {
          await executeAction(action);
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

  // Execute AI action
  const executeAction = async (action: { type: string; data: any }) => {
    try {
      console.log('Executing action:', action);
      switch (action.type) {
        // EVENT ACTIONS
        case 'create_event':
          // Transform AI response format to addEvent format
          const eventData = {
            title: action.data.title,
            startsAt: action.data.start || action.data.startsAt,
            endsAt: action.data.end || action.data.endsAt,
            description: action.data.description || '',
            color: action.data.color || '#3b82f6',
            isRecurring: action.data.isRecurring || false,
            recurrenceRule: action.data.recurrenceRule,
            calendarId: action.data.calendarId,
          };
          console.log('Creating event with data:', eventData);
          
          if (onScheduleEvent) {
            await onScheduleEvent(eventData);
          } else {
            const result = await addEvent(eventData as any);
            console.log('Add event result:', result);
          }
          toast.success(`Event "${action.data.title}" created`);
          break;
          
        case 'update_event':
          if (action.data.eventId) {
            const updateData: any = { id: action.data.eventId };
            if (action.data.title) updateData.title = action.data.title;
            if (action.data.start) updateData.startsAt = action.data.start;
            if (action.data.end) updateData.endsAt = action.data.end;
            if (action.data.description) updateData.description = action.data.description;
            await updateEvent(updateData);
            toast.success('Event updated');
          }
          break;
          
        case 'delete_event':
          if (action.data.eventId) {
            await removeEvent(action.data.eventId);
            toast.success('Event deleted');
          }
          break;
          
        // TODO ACTIONS
        case 'create_todo':
          await addTodo(action.data.text || action.data.title, action.data.listId);
          toast.success(`Todo "${action.data.text || action.data.title}" added`);
          break;
          
        case 'create_todo_list':
          if (createList) {
            await createList(action.data.name);
            toast.success(`Todo list "${action.data.name}" created`);
          }
          break;
          
        case 'complete_todo':
          if (action.data.todoId) {
            await toggleTodo(action.data.todoId);
            toast.success('Todo completed');
          }
          break;
          
        case 'delete_todo':
          if (action.data.todoId) {
            await deleteTodo(action.data.todoId);
            toast.success('Todo deleted');
          }
          break;
          
        // EISENHOWER MATRIX ACTIONS
        case 'create_eisenhower':
          if (addEisenhowerItem) {
            await addEisenhowerItem(action.data.text, action.data.quadrant);
            toast.success('Priority item added to Eisenhower Matrix');
          }
          break;
          
        // ALARM ACTIONS
        case 'create_alarm':
          await addAlarm(action.data.title || 'Alarm', new Date(action.data.time));
          toast.success('Alarm set');
          break;
          
        // REMINDER ACTIONS
        case 'create_reminder':
          await addReminder({
            title: action.data.title,
            reminderTime: action.data.reminderTime,
            description: action.data.description,
            eventId: action.data.eventId,
          });
          toast.success('Reminder set');
          break;
          
        default:
          console.log('Unknown action type:', action.type);
          break;
      }
    } catch (error) {
      console.error('Action execution error:', error);
      logger.error('BottomMallyAI', 'Action execution failed', error as Error);
      toast.error('Failed to execute action');
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
  const toggleRecording = () => {
    if (isRecording) {
      setIsRecording(false);
      resumeWakeWord?.();
    } else {
      setIsRecording(true);
      pauseWakeWord?.();
      
      // Start speech recognition
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputText(transcript);
          setIsRecording(false);
          resumeWakeWord?.();
          // Auto-send after voice input
          setTimeout(() => handleSendMessage(transcript), 100);
        };
        
        recognition.onerror = () => {
          setIsRecording(false);
          resumeWakeWord?.();
          toast.error('Voice recognition failed');
        };
        
        recognition.onend = () => {
          setIsRecording(false);
          resumeWakeWord?.();
        };
        
        recognition.start();
      } else {
        toast.error('Speech recognition not supported');
        setIsRecording(false);
      }
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
              isMobile ? "left-2 right-2 bottom-[72px] rounded-2xl" : "right-4 bottom-4 rounded-2xl",
              "backdrop-blur-3xl"
            )}
            style={{
              ...(!isMobile ? { left: `calc(${leftPosition}% + 16px)` } : {}),
              maxHeight: isMobile ? "70vh" : "60vh",
            }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
          >
            {/* Drag handle on left edge - desktop only */}
            {!isMobile && (
              <div
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
                className={cn(
                  "absolute left-0 top-4 bottom-4 w-1.5 cursor-ew-resize z-50 rounded-full",
                  "hover:bg-purple-500/30 transition-colors",
                  isDragging && "bg-purple-500/40"
                )}
              />
            )}

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
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 max-h-[40vh] scrollbar-hide">
            {messages.map((message) => (
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
                  <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-white" />
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
          </motion.div>
        )}
        </AnimatePresence>

        {/* Quick action chips */}
        <div className="px-4 py-2 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
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

          <div className="flex items-center gap-2">
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
              onClick={() => setIsMuted(!isMuted)}
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
