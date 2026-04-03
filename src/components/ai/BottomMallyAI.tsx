// Bottom-fixed Mally AI component with expandable chat
import React, { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import {
  Send,
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
  Zap,
  Star,
  Code2,
  Cpu,
  Fingerprint,
  AlertTriangle,
  CheckSquare,
  ExternalLink,
  Heart,
  Settings2,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext.firebase";
import { FirebaseFunctions } from "@/integrations/firebase/functions";
import { useUsageLimits } from "@/hooks/use-usage-limits";
import { useSubscription } from "@/hooks/use-subscription";
import { useMallyActions } from "@/hooks/use-mally-actions";
import { useProactiveSuggestions, ProactiveSuggestion } from "@/hooks/use-proactive-suggestions";
import { logger } from "@/lib/logger";
import { useThemeStore } from "@/lib/stores/theme-store";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { useUserMemory } from "@/hooks/use-user-memory";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { sounds } from "@/lib/sounds";
import { MentionPopover } from "./MentionPopover";
import { MentionTagBar } from "./MentionTagBar";
import { MentionReference, MentionOption, MentionTabId, createMentionReference, serializeReferences } from "./mention-types";
import { useEventStore } from "@/lib/store";
import { useEventHighlightStore } from "@/lib/stores/event-highlight-store";
import { useCalendarGroups } from "@/hooks/use-calendar-groups";
import { useTemplateEventsLoader } from "@/hooks/use-template-events-loader";
import { RichMessageRenderer } from "./RichMessageRenderer";
import { ActionProgress } from "./ActionProgress";
import type { RichMessage, SuggestionChip, PendingAction, ActionCardData } from "./rich-message-types";
import { generateSuggestions, actionsToCards, detectExpandableSections, detectGuidedFlow, extractCleanText } from "./rich-message-types";
import {
  getWeather, getStockPrice, getFlightStatus, searchWeb,
  formatWeather, formatStock, formatFlight, formatSearch,
} from '@/lib/ai/realtime-data';
// Message type is now RichMessage from rich-message-types.ts
type Message = RichMessage;

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

// Dismissal phrases that end a voice conversation session
const DISMISSAL_PHRASES = [
  "that's all", "thats all",
  "goodbye", "good bye", "bye",
  "thanks mally", "thank you mally", "thanks mali",
  "bye mally", "bye mali",
  "never mind", "nevermind",
  "stop listening", "stop",
  "done", "i'm done", "im done",
  "close", "dismiss",
];

function isDismissalPhrase(transcript: string): boolean {
  const normalized = transcript.toLowerCase().trim();
  return DISMISSAL_PHRASES.some(phrase => normalized === phrase || normalized.includes(phrase));
}

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
  const { resolvedTheme } = useThemeStore();
  const isDark = resolvedTheme === "dark";
  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Refs that mirror state — used inside callbacks/timers to avoid stale closures
  const isLoadingRef = useRef(false);
  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);

  // Play whoosh when AI panel text area expands (text box focus)
  useEffect(() => {
    if (isExpanded) sounds.play("mallyWhoosh");
  }, [isExpanded]);

  // Clean up voice session timers on unmount
  useEffect(() => {
    return () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, []);
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

  // Settings
  const {
    aiAutoExecute,
    aiEnabledCalendarIds,
    setAiEnabledCalendarIds,
    mallyAutoMode,
    setMallyAutoMode,
  } = useSettingsStore();


  const { user } = useAuth();
  const { limits, incrementAICount, triggerUpgradePrompt } = useUsageLimits();
  const { subscription } = useSubscription();
  const {
    executeAction,
    buildContext,
    events,
    todos,
    lists,
    activeListId,
    pages,
    eisenhowerItems,
    alarms,
    reminders,
    sentInvites,
    receivedInvites,
    templates,
    calendarAccounts,
    resolveTargetCalendar,
    resolveTargetList,
  } = useMallyActions();

  // Use merged events (local + synced/imported + template) for the mention popover
  const allEvents = useEventStore(state => state.events);

  // Connected calendars (from Firestore 'connectedCalendars' collection)
  const { calendars: connectedCalendars } = useCalendarGroups();

  // Calendar templates (weekly schedule templates that generate events)
  const { templates: calendarTemplates } = useTemplateEventsLoader();

  // @ Mention system state
  const [mentionRefs, setMentionRefs] = useState<MentionReference[]>([]);
  const [showMentionPopover, setShowMentionPopover] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [mentionTriggerIndex, setMentionTriggerIndex] = useState(-1);
  const mentionPopoverPosition = useRef<'above' | 'below'>('above');

  const { memory: userMemory } = useUserMemory();

  const { suggestions: proactiveSuggestions, currentIndex: proactiveIndex, dismiss: dismissSuggestion, next: nextSuggestion } = useProactiveSuggestions({ events, todos, memory: userMemory });
  const activeSuggestion = proactiveSuggestions[proactiveIndex] ?? null;

  // ── Pre-warm AI functions on login to eliminate cold-start latency ──
  useEffect(() => {
    if (!user?.uid) return;
    // Ping AI streaming function — fire-and-forget
    const t = setTimeout(async () => {
      try {
        const { auth: fbAuth } = await import('@/integrations/firebase/config');
        const token = await fbAuth.currentUser?.getIdToken(false);
        if (!token) return;
        fetch(
          'https://us-central1-malleabite-97d35.cloudfunctions.net/processSchedulingStream',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ userMessage: '.', userId: user.uid }),
          }
        ).catch(() => {});
      } catch {}
    }, 5000);
    return () => { clearTimeout(t); };
  }, [user?.uid]);

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

  // Esc key: same two-step dismiss as clicking outside
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isExpanded) {
        e.stopPropagation();
        setIsExpanded(false);
      } else if (!isMinimized) {
        e.stopPropagation();
        setIsMinimized(true);
      }
    };
    window.addEventListener('keydown', handleEsc, true);
    return () => window.removeEventListener('keydown', handleEsc, true);
  }, [isExpanded, isMinimized]);

  // Auto-retract when navigating to a different page
  useEffect(() => {
    setIsExpanded(false);
    setIsMinimized(true);
  }, [location.pathname]);


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

    if (!user?.uid) {
      console.error('MallyAI: User not authenticated, cannot send message');
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        text: "Please sign in to chat with Mally.",
        sender: "ai",
        timestamp: new Date(),
      }]);
      return;
    }

    console.log('Adding user message');

    // Capture and clear mention references before async work
    const currentRefs = [...mentionRefs];
    const refLabels = currentRefs.length > 0
      ? currentRefs.map(r => `@${r.shortLabel}`).join(', ')
      : '';

    // Add user message (show ref chips in display text)
    const displayText = refLabels
      ? `${refLabels} — ${messageText || "Analyze this image"}`
      : (messageText || "Analyze this image");
    const userMessage: Message = {
      id: crypto.randomUUID(),
      text: displayText,
      sender: "user",
      timestamp: new Date(),
      image: uploadedImage || undefined,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setUploadedImage(null);
    setMentionRefs([]);
    setShowMentionPopover(false);
    setIsLoading(true);

    // Add loading message with animated progress
    const loadingId = crypto.randomUUID();
    setMessages(prev => [...prev, {
      id: loadingId,
      text: "",
      sender: "ai",
      timestamp: new Date(),
      isLoading: true,
      actionProgress: [
        { id: 'understand', label: 'Understanding your request...', status: 'running' },
      ],
    }]);

    try {
      // Build context
      const context = buildContext();

      // Attach serialized @ mention references to context
      if (currentRefs.length > 0) {
        (context as any).mentionReferences = serializeReferences(currentRefs);
      }

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

      // Augment user message with reference context for the AI
      let augmentedMessage = messageText;
      if (currentRefs.length > 0) {
        const refSummary = currentRefs.map(r => {
          return `@${r.entityType}:${r.label} (id:${r.entityId})`;
        }).join(', ');
        augmentedMessage = `[Referenced: ${refSummary}] ${messageText}`;
      }

      // Update progress: calling AI
      setMessages(prev => prev.map(m =>
        m.id === loadingId
          ? { ...m, actionProgress: [
              { id: 'understand', label: 'Understanding your request...', status: 'done' },
              { id: 'thinking', label: 'Mally is thinking...', status: 'running' },
            ]}
          : m
      ));

      // Call Firebase function
      // ── Helper: process response actions + rich content after text is received ──
      const processResponseActions = async (
        aiResponse: string,
        allActions: Array<{ type: string; data?: any }>,
        responseIntent: string,
        responseSources: any[],
      ) => {
        // Detect rich content from the AI text
        const sections = detectExpandableSections(aiResponse);
        const guidedFlow = detectGuidedFlow(aiResponse);
        const displayText = extractCleanText(aiResponse, !!sections, !!guidedFlow);

        if (allActions.length > 0 && (!aiAutoExecute || !mallyAutoMode)) {
          // ── Confirmation mode ──────────────────────────────────────────
          const pendingActions: PendingAction[] = allActions.map((action) => ({
            id: crypto.randomUUID(),
            type: action.type,
            label: describeAction(action),
            data: action.data || action,
            status: 'pending' as const,
          }));
          const suggestions = generateSuggestions(responseIntent, allActions, aiResponse);
          setMessages(prev => prev.map(m =>
            m.id === loadingId
              ? {
                  ...m,
                  text: displayText,
                  isLoading: false,
                  isStreaming: false,
                  intent: responseIntent,
                  pendingActions,
                  suggestions,
                  expandableSections: sections?.sections,
                  guidedFlow: guidedFlow ?? undefined,
                  actionProgress: undefined,
                  sources: responseSources.length > 0 ? responseSources : undefined,
                }
              : m
          ));
        } else {
          // ── Auto-execute mode ──────────────────────────────────────────
          if (allActions.length > 0) {
            const actionSteps = allActions.map((a, i) => ({
              id: `action-${i}`,
              label: describeAction(a),
              status: 'pending' as const,
            }));
            setMessages(prev => prev.map(m =>
              m.id === loadingId
                ? { ...m, text: displayText, isLoading: false, isStreaming: false, actionProgress: actionSteps }
                : m
            ));
          }

          const executionResults: boolean[] = [];
          for (let i = 0; i < allActions.length; i++) {
            setMessages(prev => prev.map(m => {
              if (m.id !== loadingId || !m.actionProgress) return m;
              return {
                ...m,
                actionProgress: m.actionProgress.map((s, j) => ({
                  ...s,
                  status: j < i ? 'done' : j === i ? 'running' : 'pending',
                })) as any,
              };
            }));
            const success = await executeAction(allActions[i] as { type: string; data: any });
            executionResults.push(success);
            if (success) haptics.success();
            setMessages(prev => prev.map(m => {
              if (m.id !== loadingId || !m.actionProgress) return m;
              return {
                ...m,
                actionProgress: m.actionProgress.map((s, j) => ({
                  ...s,
                  status: j <= i ? (j === i && !success ? 'error' : 'done') : s.status,
                })) as any,
              };
            }));
          }

          const actionCards = actionsToCards(allActions, executionResults, resolveTargetCalendar, resolveTargetList);

          // Enrich cards with created item IDs so we can delete them later
          const freshEventsForEnrich = useEventStore.getState().events;
          for (const card of actionCards) {
            if (card.type === 'event' && card.calendarInfo && card.sourceAction?.data) {
              const title = card.sourceAction.data.title || card.title;
              const calId = card.calendarInfo.id;
              const match = freshEventsForEnrich.find(e => e.title === title && e.calendarId === calId);
              if (match) card.calendarInfo.eventId = match.id;
            }
            if (card.type === 'todo' && card.listInfo && card.sourceAction?.data) {
              const text = card.sourceAction.data.text || card.sourceAction.data.title || card.title;
              const listId = card.listInfo.id;
              const match = todos.find(t => t.text === text && t.listId === listId);
              if (match) card.listInfo.todoId = match.id;
            }
          }

          const suggestions = generateSuggestions(responseIntent, allActions, aiResponse);

          setMessages(prev => prev.map(m =>
            m.id === loadingId
              ? {
                  ...m,
                  text: displayText,
                  isLoading: false,
                  isStreaming: false,
                  intent: responseIntent,
                  actionCards: actionCards.length > 0 ? actionCards : undefined,
                  actionProgress: undefined,
                  expandableSections: sections?.sections,
                  guidedFlow: !allActions.length ? (guidedFlow ?? undefined) : undefined,
                  suggestions,
                  sources: responseSources.length > 0 ? responseSources : undefined,
                }
              : m
          ));

          // Spotlight reveal: auto-minimize to show the event on the calendar
          maybeSpotlightAfterAction(allActions);
        }

        updateQuickActionsFromContext(aiResponse, (allActions[0] as { type: string; data: any }) || null);
      };

      // ── Choose streaming vs non-streaming path ──────────────────────────
      const hasImage = !!uploadedImage;

      if (hasImage) {
        // Non-streaming path for image messages (streaming endpoint doesn't support imageData)
        const response = await FirebaseFunctions.processScheduling({
          userMessage: augmentedMessage,
          userId: user.uid,
          context: JSON.stringify(context),
          history: messageHistory,
          imageData: { dataUrl: uploadedImage.dataUrl, mimeType: uploadedImage.mimeType },
        });
        await incrementAICount();

        const aiResponse = response.message || "I couldn't process that request.";
        const responseIntent = (response as any).intent || 'general';
        const responseSources = (response as any).sources || [];
        const allActions: Array<{ type: string; data?: any }> = [];
        if (response.action) allActions.push(response.action);
        if ((response as any).actions && Array.isArray((response as any).actions)) {
          allActions.push(...(response as any).actions);
        }
        await processResponseActions(aiResponse, allActions, responseIntent, responseSources);
      } else {
        // ── SSE Streaming path ──────────────────────────────────────────────
        try {
          let speechText = '';

          // Keep loading state until first text chunk arrives
          // (don't switch to streaming yet — the empty bubble looks broken)

          let donePayload: { speechText?: string; actions?: any[]; intent?: string } | null = null;
          let firstChunkReceived = false;

          for await (const event of FirebaseFunctions.processSchedulingStreamEvents({
            userMessage: augmentedMessage,
            userId: user.uid,
            context: JSON.stringify(context),
            history: messageHistory,
          })) {
            if (event.type === 'speech' && event.text) {
              speechText += event.text;
              // On first chunk, switch from loading dots to streaming text
              if (!firstChunkReceived) {
                firstChunkReceived = true;
                setMessages(prev => prev.map(m =>
                  m.id === loadingId
                    ? { ...m, text: speechText, isLoading: false, isStreaming: true, actionProgress: undefined }
                    : m
                ));
              } else {
                // Progressive text update
                setMessages(prev => prev.map(m =>
                  m.id === loadingId ? { ...m, text: speechText } : m
                ));
              }
            } else if (event.type === 'done') {
              donePayload = event;
            } else if (event.type === 'error') {
              throw new Error(event.message || 'Stream error');
            }
          }

          // Process final response
          const aiResponse = donePayload?.speechText || speechText || "I couldn't process that request.";
          const responseIntent = donePayload?.intent || 'general';
          await incrementAICount();

          const allActions: Array<{ type: string; data?: any }> = donePayload?.actions || [];
          await processResponseActions(aiResponse, allActions, responseIntent, []);

        } catch (streamError: any) {
          // ── FALLBACK: non-streaming ─────────────────────────────────────
          console.warn('[Mally] Text stream failed, falling back to classic:', streamError?.message);

          // Reset loading state
          setMessages(prev => prev.map(m =>
            m.id === loadingId
              ? { ...m, text: '', isLoading: true, isStreaming: false, actionProgress: [
                  { id: 'understand', label: 'Understanding your request...', status: 'done' as const },
                  { id: 'thinking', label: 'Mally is thinking...', status: 'running' as const },
                ]}
              : m
          ));

          const response = await FirebaseFunctions.processScheduling({
            userMessage: augmentedMessage,
            userId: user.uid,
            context: JSON.stringify(context),
            history: messageHistory,
          });
          await incrementAICount();

          const aiResponse = response.message || "I couldn't process that request.";
          const responseIntent = (response as any).intent || 'general';
          const responseSources = (response as any).sources || [];
          const allActions: Array<{ type: string; data?: any }> = [];
          if (response.action) allActions.push(response.action);
          if ((response as any).actions && Array.isArray((response as any).actions)) {
            allActions.push(...(response as any).actions);
          }
          await processResponseActions(aiResponse, allActions, responseIntent, responseSources);
        }
      }

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

  // ── Rich message interaction handlers ────────────────────────────────────

  /** Human-readable description of an AI action */
  const describeAction = (action: { type: string; data?: any }): string => {
    const data = action.data || action;
    switch (action.type) {
      case 'create_event': return `Create event "${data.title || 'Untitled'}"`;
      case 'update_event': return `Update event "${data.title || 'event'}"`;
      case 'delete_event': return `Delete event "${data.title || 'event'}"`;
      case 'create_todo': return `Add task "${data.text || data.title || 'Untitled'}"`;
      case 'create_alarm': return `Set alarm "${data.title || ''}" at ${data.time || ''}`;
      case 'create_reminder': return `Set reminder "${data.title || data.text || ''}"`;
      case 'start_pomodoro': return 'Start focus timer';
      case 'resume_pomodoro': return 'Resume focus timer';
      default: return `${action.type.replace(/_/g, ' ')}`;
    }
  };

  /** Approve a single pending action and execute it */
  const handleApproveAction = async (actionId: string) => {
    haptics.selection();
    // Find the message containing this pending action
    const msg = messages.find(m => m.pendingActions?.some(a => a.id === actionId));
    if (!msg) return;
    const pending = msg.pendingActions?.find(a => a.id === actionId);
    if (!pending) return;

    // Execute
    const success = await executeAction({ type: pending.type, data: pending.data });
    if (success) haptics.success();

    // Build the card and enrich with created item IDs
    let card: ActionCardData | null = null;
    if (success) {
      const calInfo = pending.type.includes('event') ? resolveTargetCalendar(pending.data?.calendarId) : undefined;
      const listInf = pending.type.includes('todo') ? resolveTargetList(pending.data?.listId, pending.data?.listName) : undefined;
      // Look up the created item's ID from the store
      if (calInfo) {
        const title = pending.data?.title || pending.label;
        const freshEvents = useEventStore.getState().events;
        const match = freshEvents.find(e => e.title === title && e.calendarId === calInfo.id);
        if (match) (calInfo as any).eventId = match.id;
      }
      if (listInf) {
        const text = pending.data?.text || pending.data?.title || pending.label;
        const match = todos.find(t => t.text === text && t.listId === listInf.id);
        if (match) (listInf as any).todoId = match.id;
      }
      card = {
        id: crypto.randomUUID(),
        type: pending.type.includes('event') ? 'event' : pending.type.includes('todo') ? 'todo' : 'generic',
        title: pending.label,
        status: 'created',
        sourceAction: { type: pending.type, data: pending.data },
        calendarInfo: calInfo,
        listInfo: listInf,
      };
    }

    // Update status and add card
    setMessages(prev => prev.map(m => {
      if (m.id !== msg.id) return m;
      const updatedPending = m.pendingActions?.map(a =>
        a.id === actionId ? { ...a, status: 'approved' as const } : a
      );
      return {
        ...m,
        pendingActions: updatedPending,
        actionCards: card ? [...(m.actionCards || []), card] : m.actionCards,
      };
    }));

    // Spotlight reveal for manually approved event actions
    if (success) {
      maybeSpotlightAfterAction([{ type: pending.type }]);
    }
  };

  /** Reject a single pending action */
  const handleRejectAction = (actionId: string) => {
    haptics.selection();
    setMessages(prev => prev.map(m => ({
      ...m,
      pendingActions: m.pendingActions?.map(a =>
        a.id === actionId ? { ...a, status: 'rejected' as const } : a
      ),
    })));
  };

  /** Approve all pending actions in the latest message */
  const handleApproveAll = async () => {
    haptics.selection();
    const msg = [...messages].reverse().find(m => m.pendingActions?.some(a => a.status === 'pending'));
    if (!msg?.pendingActions) return;
    for (const pending of msg.pendingActions.filter(a => a.status === 'pending')) {
      await handleApproveAction(pending.id);
    }
  };

  /**
   * Spotlight Reveal: auto-minimize the panel so the user sees the
   * highlighted event on the calendar behind it.
   */
  const spotlightReveal = useCallback(() => {
    // Only act when the panel is expanded
    if (!isExpanded) return;
    haptics.success();
    setIsExpanded(false);
    setIsMinimized(true);
  }, [isExpanded]);

  /**
   * After actions that create/modify calendar events, decide whether to
   * auto-reveal (Option A) or offer a "Show on calendar" chip (Option D).
   */
  const maybeSpotlightAfterAction = useCallback((actions: Array<{ type: string }>) => {
    const hasEventAction = actions.some(a =>
      a.type === 'create_event' || a.type === 'update_event'
    );
    const hasModuleAction = actions.some(a =>
      a.type === 'create_todo' || a.type === 'create_eisenhower' || a.type === 'create_alarm' || a.type === 'create_reminder'
    );
    if (!hasEventAction && !hasModuleAction) return;

    // Check if user is mid-conversation (input focused or has text)
    const isUserTyping =
      inputRef.current === document.activeElement ||
      (inputRef.current && inputRef.current.value.length > 0);

    if (isUserTyping) {
      // Fallback (Option D): inject a "Show on calendar" suggestion chip
      setMessages(prev => {
        const lastAiMsg = [...prev].reverse().find(m => m.sender === 'ai');
        if (!lastAiMsg) return prev;
        const showChip: SuggestionChip = {
          id: 'show-on-calendar',
          label: 'Show on calendar →',
          prompt: '__SPOTLIGHT_REVEAL__',
          icon: '📍',
        };
        const existing = lastAiMsg.suggestions || [];
        if (existing.some(s => s.id === 'show-on-calendar')) return prev;
        return prev.map(m =>
          m.id === lastAiMsg.id
            ? { ...m, suggestions: [showChip, ...existing] }
            : m
        );
      });
    } else {
      // Option A: auto-reveal after a short delay so user reads the confirmation
      setTimeout(spotlightReveal, 900);
    }
  }, [spotlightReveal]);

  /** Handle clicking a suggestion chip — sends the prompt as a new message */
  const handleSuggestionSelect = (chip: SuggestionChip) => {
    haptics.selection();
    // Special: "Show on calendar" chip triggers spotlight reveal
    if (chip.prompt === '__SPOTLIGHT_REVEAL__') {
      spotlightReveal();
      return;
    }
    // If the prompt ends with a space or colon, put it in the input for the user to complete
    if (chip.prompt.endsWith(': ') || chip.prompt.endsWith(' ')) {
      setInputText(chip.prompt);
      inputRef.current?.focus();
    } else {
      // Full prompt — send directly
      handleSendMessage(chip.prompt);
    }
  };

  /** Handle selecting an option in a guided flow */
  const handleGuidedFlowSelect = (optionId: string, prompt: string) => {
    haptics.selection();
    handleSendMessage(prompt);
  };

  /** Handle submitting multiple selections in a guided flow */
  const handleGuidedFlowSubmitMulti = (optionIds: string[]) => {
    haptics.selection();
    // Find the guided flow in the latest AI message to get labels
    const msg = [...messages].reverse().find(m => m.guidedFlow);
    if (!msg?.guidedFlow) return;
    const labels = optionIds.map(id =>
      msg.guidedFlow!.step.options.find(o => o.id === id)?.label || id
    );
    handleSendMessage(labels.join(', '));
  };

  /** Add an event to additional calendars (creates duplicates in each calendar) */
  const handleAddToCalendars = async (card: ActionCardData, calendarIds: string[]) => {
    if (!card.sourceAction?.data) return;
    haptics.selection();

    const eventData = card.sourceAction.data;
    const addedCalendars: Array<{ id: string; name: string; color: string; eventId?: string }> = [];

    for (const calId of calendarIds) {
      // Snapshot current event IDs before creation
      const beforeIds = new Set(useEventStore.getState().events.map(e => e.id));
      const success = await executeAction({
        type: 'create_event',
        data: {
          ...eventData,
          calendarId: calId,
        },
      });
      if (success) {
        const cal = calendarAccounts.find(a => a.id === calId);
        // Use getState() to bypass stale closure and get fresh events
        const freshEvents = useEventStore.getState().events;
        const newEvent = freshEvents.find(e => !beforeIds.has(e.id) && e.calendarId === calId);
        if (cal) addedCalendars.push({ id: cal.id, name: cal.name, color: cal.color, eventId: newEvent?.id });
      }
    }

    if (addedCalendars.length > 0) {
      setMessages(prev => prev.map(m => ({
        ...m,
        actionCards: m.actionCards?.map(c =>
          c.id === card.id
            ? { ...c, additionalCalendars: [...(c.additionalCalendars || []), ...addedCalendars] }
            : c
        ),
      })));
      const names = addedCalendars.map(c => c.name).join(', ');
      toast.success(`Added to ${names}`);
    }
  };

  /** Add a todo to additional lists (creates duplicates in each list) */
  const handleAddToLists = async (card: ActionCardData, listIds: string[]) => {
    if (!card.sourceAction?.data) return;
    haptics.selection();

    const todoData = card.sourceAction.data;
    const addedLists: Array<{ id: string; name: string; color: string; todoId?: string }> = [];

    for (const listId of listIds) {
      // Snapshot current todo IDs before creation
      const beforeIds = new Set(todos.map(t => t.id));
      const success = await executeAction({
        type: 'create_todo',
        data: {
          ...todoData,
          listId,
        },
      });
      if (success) {
        const list = lists.find(l => l.id === listId);
        const newTodo = todos.find(t => !beforeIds.has(t.id) && t.listId === listId);
        if (list) addedLists.push({ id: list.id, name: list.name, color: list.color, todoId: newTodo?.id });
      }
    }

    if (addedLists.length > 0) {
      setMessages(prev => prev.map(m => ({
        ...m,
        actionCards: m.actionCards?.map(c =>
          c.id === card.id
            ? { ...c, additionalLists: [...(c.additionalLists || []), ...addedLists] }
            : c
        ),
      })));
      const names = addedLists.map(l => l.name).join(', ');
      toast.success(`Added to ${names}`);
    }
  };

  /** Remove an event from calendars (deletes the event copy and updates card display) */
  const handleRemoveFromCalendars = async (card: ActionCardData, calendarIds: string[]) => {
    haptics.selection();
    const removedSet = new Set(calendarIds);

    // Actually delete the events from the deselected calendars
    for (const calId of calendarIds) {
      // Find the event ID for this calendar from the card data
      let eventId: string | undefined;
      if (card.calendarInfo?.id === calId) eventId = card.calendarInfo.eventId;
      if (!eventId) eventId = card.additionalCalendars?.find(c => c.id === calId)?.eventId;
      // Fallback: search events store for matching title + calendarId
      if (!eventId) {
        const title = card.sourceAction?.data?.title || card.title;
        const freshEvents = useEventStore.getState().events;
        const match = freshEvents.find(e => e.title === title && e.calendarId === calId);
        eventId = match?.id;
      }
      if (eventId) {
        await executeAction({ type: 'delete_event', data: { eventId } });
      }
    }

    // Update card display
    setMessages(prev => prev.map(m => ({
      ...m,
      actionCards: m.actionCards?.map(c => {
        if (c.id !== card.id) return c;
        const newAdditional = (c.additionalCalendars || []).filter(cal => !removedSet.has(cal.id));
        let newPrimary = c.calendarInfo;
        if (newPrimary && removedSet.has(newPrimary.id)) {
          newPrimary = newAdditional.shift() || undefined;
        }
        return { ...c, calendarInfo: newPrimary, additionalCalendars: newAdditional.length > 0 ? newAdditional : undefined };
      }),
    })));
    const names = calendarIds.map(id => calendarAccounts.find(a => a.id === id)?.name || id).join(', ');
    toast.success(`Removed from ${names}`);
  };

  /** Remove a todo from lists (deletes the todo copy and updates card display) */
  const handleRemoveFromLists = async (card: ActionCardData, listIds: string[]) => {
    haptics.selection();
    const removedSet = new Set(listIds);

    // Actually delete the todos from the deselected lists
    for (const listId of listIds) {
      let todoId: string | undefined;
      if (card.listInfo?.id === listId) todoId = card.listInfo.todoId;
      if (!todoId) todoId = card.additionalLists?.find(l => l.id === listId)?.todoId;
      // Fallback: search todos store for matching text + listId
      if (!todoId) {
        const text = card.sourceAction?.data?.text || card.sourceAction?.data?.title || card.title;
        const match = todos.find(t => t.text === text && t.listId === listId);
        todoId = match?.id;
      }
      if (todoId) {
        await executeAction({ type: 'delete_todo', data: { todoId } });
      }
    }

    // Update card display
    setMessages(prev => prev.map(m => ({
      ...m,
      actionCards: m.actionCards?.map(c => {
        if (c.id !== card.id) return c;
        const newAdditional = (c.additionalLists || []).filter(l => !removedSet.has(l.id));
        let newPrimary = c.listInfo;
        if (newPrimary && removedSet.has(newPrimary.id)) {
          newPrimary = newAdditional.shift() || undefined;
        }
        return { ...c, listInfo: newPrimary, additionalLists: newAdditional.length > 0 ? newAdditional : undefined };
      }),
    })));
    const names = listIds.map(id => lists.find(l => l.id === id)?.name || id).join(', ');
    toast.success(`Removed from ${names}`);
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    // When mention popover is open, let it handle navigation keys
    if (showMentionPopover) {
      if (['Enter', 'ArrowUp', 'ArrowDown', 'Tab', 'Escape'].includes(e.key)) {
        // These are handled by MentionPopover's window keydown listener
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle input text change — detect '@' trigger for mention popover
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputText(value);

    // Detect '@' for mention trigger
    const cursorPos = e.target.selectionStart || value.length;
    // Look backwards from cursor to find an unmatched '@'
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      // Check that '@' is at start or preceded by a space (not in an email)
      const charBefore = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' ';
      if (charBefore === ' ' || charBefore === '\n' || lastAtIndex === 0) {
        const filterAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
        // Don't trigger if there's a space in the filter (means they moved on)
        if (!filterAfterAt.includes(' ')) {
          setShowMentionPopover(true);
          setMentionFilter(filterAfterAt);
          setMentionTriggerIndex(lastAtIndex);

          // Determine position based on input location
          if (inputRef.current) {
            const rect = inputRef.current.getBoundingClientRect();
            mentionPopoverPosition.current = rect.top > window.innerHeight / 2 ? 'above' : 'below';
          }
          return;
        }
      }
    }

    // No valid '@' trigger — close popover if open
    if (showMentionPopover) {
      setShowMentionPopover(false);
      setMentionFilter('');
      setMentionTriggerIndex(-1);
    }
  };

  // Handle mention selection from popover
  const handleMentionSelect = (option: MentionOption, tabId: MentionTabId) => {
    const ref = createMentionReference(option, tabId);

    // Avoid duplicates
    if (!mentionRefs.some(r => r.entityId === ref.entityId && r.entityType === ref.entityType)) {
      setMentionRefs(prev => [...prev, ref]);
    }

    // Remove the '@filter' text from input
    if (mentionTriggerIndex >= 0) {
      const before = inputText.substring(0, mentionTriggerIndex);
      const cursorPos = inputRef.current?.selectionStart || inputText.length;
      const after = inputText.substring(cursorPos);
      setInputText(before + after);
    }

    setShowMentionPopover(false);
    setMentionFilter('');
    setMentionTriggerIndex(-1);
    inputRef.current?.focus();
  };

  // Remove a mention reference chip
  const handleMentionRemove = (mentionId: string) => {
    setMentionRefs(prev => prev.filter(r => r.mentionId !== mentionId));
  };

  // Close mention popover
  const handleMentionClose = () => {
    setShowMentionPopover(false);
    setMentionFilter('');
    setMentionTriggerIndex(-1);
    inputRef.current?.focus();
  };


  return (
    <>
      {/* Step 1: dark+blur overlay when expanded — click collapses (removes blur) but keeps panel */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setIsExpanded(false); }}
            className="fixed inset-0 bg-white/50 dark:bg-black/40 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Step 2: transparent overlay when panel is visible but not expanded — click minimizes entirely */}
      <AnimatePresence>
        {!isMinimized && !isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMinimized(true)}
            className="fixed inset-0 z-40 bg-transparent"
          />
        )}
      </AnimatePresence>

      {/* Minimized floating icon — desktop only: centered pill (mobile hides icon, use Hey Mally or nav) */}
      <AnimatePresence>
        {isMinimized && !isMobile && (
          <motion.button
            initial={{ opacity: 0, y: 16, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { type: "spring", damping: 24, stiffness: 340, delay: 0.12 } }}
            exit={{ opacity: 0, y: 10, scale: 0.92, transition: { duration: 0.14, ease: [0.4, 0, 1, 1] } }}
            drag={isMobile ? false : "x"}
            dragConstraints={isMobile ? undefined : {
              left: -(window.innerWidth / 2 - 60),
              right: (window.innerWidth / 2 - 120),
            }}
            dragElastic={0.15}
            dragTransition={{
              power: 0.3,
              timeConstant: 200,
              bounceDamping: 20,
              bounceStiffness: 300,
            }}
            whileDrag={isMobile ? undefined : { scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onDragStart={() => { (window as any).__mallyDragged = true; }}
            onDragEnd={() => { setTimeout(() => { (window as any).__mallyDragged = false; }, 100); }}
            onClick={() => { if (!(window as any).__mallyDragged) { sounds.play("mallyChoir"); setIsMinimized(false); } }}
            className={cn(
              isMobile
                ? "fixed left-4 z-50 h-10 w-10 rounded-xl flex items-center justify-center backdrop-blur-2xl border bg-purple-500/20 border-purple-400/30 dark:bg-white/10 dark:border-white/15 hover:bg-purple-500/30 dark:hover:bg-white/20 transition-colors"
                : "fixed left-1/2 -translate-x-1/2 z-50 px-5 py-1.5 rounded-2xl cursor-grab active:cursor-grabbing backdrop-blur-2xl border bg-purple-500/25 border-purple-400/40 dark:bg-white/10 dark:border-white/20 hover:bg-purple-500/35 dark:hover:bg-white/20 transition-colors flex items-center justify-center overflow-hidden mally-pill-glow",
            )}
            style={{
              bottom: isMobile ? 'calc(56px + env(safe-area-inset-bottom, 0px))' : '1.5rem',
              boxShadow: isMobile
                ? '0 4px 16px rgba(139, 92, 246, 0.25), inset 0 1px 1px rgba(255,255,255,0.2)'
                : undefined,
              touchAction: 'none',
            }}
          >
            {isMobile ? (
              <img src="/logo-quadrant.svg" alt="" className="h-5 w-5 object-contain select-none" draggable={false} />
            ) : (
              <>
                <motion.img
                  src="/logo-quadrant.svg"
                  alt=""
                  className="h-9 w-9 object-contain select-none relative z-10"
                  animate={{ y: [0, -2, 0] }}
                  transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                  draggable={false}
                />
                <span className="pointer-events-none absolute inset-0 rounded-[inherit] overflow-hidden" aria-hidden>
                  <motion.span
                    className="absolute top-0 bottom-0 w-[50%]"
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)',
                      skewX: '-15deg',
                    }}
                    animate={{ left: ['-55%', '130%'] }}
                    transition={{
                      duration: 1.0,
                      repeat: Infinity,
                      ease: 'easeInOut',
                      repeatDelay: 2.5,
                    }}
                  />
                </span>
              </>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Main container - borderless fade emerging from bottom */}
      <AnimatePresence>
        {!isMinimized && (
          <motion.div
            ref={containerRef}
            initial={{ opacity: 0, y: 16, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.48, ease: [0.25, 0.46, 0.45, 0.94] } }}
            exit={{ opacity: 0, y: 12, filter: 'blur(4px)', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
            className={cn(
              "fixed z-50 flex flex-col",
              "left-0 right-0",
            )}
            style={{
              bottom: isMobile ? 'env(safe-area-inset-bottom, 0px)' : 0,
              maxHeight: isMobile ? "80vh" : "70vh",
              /* Layered gradient: fully transparent at top fading into base */
              background: isDark
                ? `linear-gradient(
                    to bottom,
                    rgba(0, 0, 0, 0) 0%,
                    rgba(0, 0, 0, 0.05) 8%,
                    rgba(0, 0, 0, 0.15) 18%,
                    rgba(0, 0, 0, 0.35) 30%,
                    rgba(0, 0, 0, 0.6) 45%,
                    rgba(0, 0, 0, 0.85) 65%,
                    rgba(0, 0, 0, 1) 100%
                  )`
                : `linear-gradient(
                    to bottom,
                    transparent 0%,
                    rgba(248, 246, 255, 0) 0%,
                    rgba(248, 246, 255, 0.75) 10%,
                    rgba(248, 246, 255, 0.95) 28%,
                    rgba(248, 246, 255, 1) 100%
                  )`,
              /* No border, no shadow box — just the gradient itself as the visual */
            }}
            transition={{ type: "spring", damping: 32, stiffness: 220 }}
          >
            {/* No DoodleBackground or hard borders for the fade look */}


            {/* Minimize button - top right, shifted closer */}
            <button
              onClick={() => { setIsMinimized(true); setIsExpanded(false); }}
              className="absolute top-3 right-8 p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors z-10"
              title="Minimize"
            >
              <Minimize2 className="h-5 w-5" />
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
                      {messages.map((message, index) => {
                        const isLastAiMessage = message.sender === 'ai' &&
                          index === (() => { const idx = [...messages].reverse().findIndex(m => m.sender === 'ai' && !m.isLoading); return idx === -1 ? -1 : messages.length - 1 - idx; })();
                        return (
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
                              <div className={cn(
                                "w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center",
                                message.isLoading && "animate-pulse",
                              )}>
                                <Bot className="h-4 w-4 text-white" />
                              </div>
                            </div>
                          )}
                          <div
                            className={cn(
                              "max-w-[80%] px-3 py-2 rounded-2xl text-sm",
                              message.sender === "user"
                                ? "bg-purple-600 text-white rounded-br-md"
                                : message.isError
                                  ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 rounded-bl-md"
                                  : "bg-white/80 dark:bg-white/10 text-foreground border border-black/10 dark:border-white/10 rounded-bl-md"
                            )}
                          >
                            {message.image && (
                              <img
                                src={message.image.dataUrl}
                                alt="Uploaded"
                                className="max-w-full h-auto rounded-lg mb-2 max-h-32"
                              />
                            )}
                            {/* AI messages use the rich renderer */}
                            {message.sender === "ai" ? (
                              message.isLoading ? (
                                <div className="flex flex-col gap-1.5">
                                  <div className="flex items-center gap-2">
                                    <div className="flex space-x-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                  </div>
                                  {/* Show action progress during loading */}
                                  {message.actionProgress && message.actionProgress.length > 0 && (
                                    <ActionProgress steps={message.actionProgress} />
                                  )}
                                </div>
                              ) : (
                                <RichMessageRenderer
                                  message={message}
                                  isLastAiMessage={isLastAiMessage}
                                  onSuggestionSelect={handleSuggestionSelect}
                                  onUndoAction={undefined}
                                  onApproveAction={handleApproveAction}
                                  onRejectAction={handleRejectAction}
                                  onApproveAll={handleApproveAll}
                                  onGuidedFlowSelect={handleGuidedFlowSelect}
                                  onGuidedFlowSubmitMulti={handleGuidedFlowSubmitMulti}
                                  onAddToCalendars={handleAddToCalendars}
                                  onRemoveFromCalendars={handleRemoveFromCalendars}
                                  calendarAccounts={calendarAccounts}
                                  onAddToLists={handleAddToLists}
                                  onRemoveFromLists={handleRemoveFromLists}
                                  todoLists={(() => {
                                    // Filter to lists that are in use: referenced by a module, have todos, or are default
                                    const moduleListIds = new Set(pages.flatMap(p => p.modules.filter(m => m.listId).map(m => m.listId!)));
                                    const todoListIds = new Set(todos.map(t => t.listId));
                                    return lists
                                      .filter(l => l.isDefault || moduleListIds.has(l.id) || todoListIds.has(l.id) || l.id === activeListId)
                                      .map(l => ({ id: l.id, name: l.name, color: l.color }));
                                  })()}
                                />
                              )
                            ) : (
                              <span className="whitespace-pre-wrap">{message.text}</span>
                            )}
                            {/* Source citations from Google Search grounding */}
                            {message.sources && message.sources.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-black/10 dark:border-white/10">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                  <ExternalLink size={10} />
                                  <span>Sources</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {message.sources.map((src, i) => (
                                    <a
                                      key={i}
                                      href={src.uri}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/50 hover:text-purple-800 dark:hover:text-purple-200 transition-colors border border-purple-300 dark:border-purple-700"
                                    >
                                      {src.title.length > 30 ? src.title.slice(0, 30) + '...' : src.title}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          {message.sender === "user" && (
                            <div className="w-7 h-7 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                              <User className="h-4 w-4 text-white" />
                            </div>
                          )}
                        </motion.div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quick action chips */}
            <div className="px-4 py-2 overflow-x-auto scrollbar-hide">
              <motion.div
                className="flex gap-2 max-w-4xl mx-auto w-full"
                initial="hidden"
                animate="show"
                variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } } }}
              >
                {quickActions.map((action) => (
                  <motion.button
                    key={action.id}
                    variants={{
                      hidden: { opacity: 0, y: 8 },
                      show: { opacity: 1, y: 0, transition: { type: 'spring', damping: 24, stiffness: 300 } },
                    }}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => handleQuickAction(action)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium",
                      "bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-black/10 dark:border-white/10",
                      "text-muted-foreground hover:text-foreground",
                      "transition-colors whitespace-nowrap flex-shrink-0"
                    )}
                    title={action.label}
                  >
                    {action.icon}
                    <span className="hidden sm:inline">{action.label}</span>
                  </motion.button>
                ))}
              </motion.div>
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
                        {activeSuggestion.iconName === 'Star' && <Star size={12} />}
                        {activeSuggestion.iconName === 'Heart' && <Heart size={12} />}
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
                    className="h-16 rounded-lg border border-black/20 dark:border-white/20"
                  />
                  <button
                    onClick={() => setUploadedImage(null)}
                    className="absolute -top-1 -right-1 p-0.5 bg-red-500 rounded-full"
                  >
                    <X className="h-3 w-3 text-white" />
                  </button>
                </div>
              )}

              <motion.div
                className="flex items-center gap-2 max-w-4xl mx-auto w-full"
                initial={{ scaleX: 0.88, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ type: "spring", damping: 22, stiffness: 280, delay: 0.06 }}
                style={{ transformOrigin: 'center' }}
              >
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
                  className="p-2.5 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ImageIcon className="h-5 w-5" />
                </button>

                {/* Text input with @ mention system */}
                <div className="flex-1 relative">
                  {/* Mention tag bar (chips above input) */}
                  <MentionTagBar references={mentionRefs} onRemove={handleMentionRemove} />

                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={handleInputChange}
                    onKeyPress={handleKeyPress}
                    onFocus={() => setIsExpanded(true)}
                    placeholder={mentionRefs.length > 0 ? "Type your message..." : "Ask Mally anything... (@ to reference)"}
                    className={cn(
                      "w-full px-4 py-2.5 rounded-full",
                      "bg-white/80 dark:bg-white/10 border border-black/10 dark:border-white/10",
                      "text-foreground placeholder:text-muted-foreground",
                      "focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50",
                      "transition-all"
                    )}
                    disabled={isLoading}
                  />

                  {/* @ Mention popover */}
                  <MentionPopover
                    open={showMentionPopover}
                    onClose={handleMentionClose}
                    onSelect={handleMentionSelect}
                    position={mentionPopoverPosition.current}
                    pages={pages}
                    events={allEvents}
                    todos={todos}
                    lists={lists}
                    eisenhowerItems={eisenhowerItems}
                    alarms={alarms}
                    reminders={reminders}
                    sentInvites={sentInvites}
                    receivedInvites={receivedInvites}
                    calendarAccounts={calendarAccounts}
                    connectedCalendars={connectedCalendars}
                    calendarTemplates={calendarTemplates}
                    filterText={mentionFilter}
                  />
                </div>


{/* Mally settings */}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      className="p-2.5 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-muted-foreground hover:text-foreground transition-colors"
                      title="Mally settings"
                    >
                      <Settings2 className="h-5 w-5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="end" className="w-64 p-3 space-y-4">
                    {/* Auto mode toggle */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Auto mode</span>
                        <Switch
                          checked={mallyAutoMode}
                          onCheckedChange={setMallyAutoMode}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {mallyAutoMode
                          ? "Mally acts immediately — no questions asked."
                          : "Mally may ask brief follow-up questions."}
                      </p>
                    </div>

                    {/* AI calendar filter */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Calendars Mally reads</p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {calendarAccounts.map((cal) => {
                          const enabled = aiEnabledCalendarIds === null || aiEnabledCalendarIds.includes(cal.id);
                          return (
                            <label key={cal.id} className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={enabled}
                                onChange={(e) => {
                                  const allIds = calendarAccounts.map(c => c.id);
                                  const current = aiEnabledCalendarIds ?? allIds;
                                  const next = e.target.checked
                                    ? [...current, cal.id]
                                    : current.filter(id => id !== cal.id);
                                  // If all selected, reset to null (= all)
                                  setAiEnabledCalendarIds(
                                    next.length === allIds.length ? null : next
                                  );
                                }}
                                className="rounded"
                              />
                              <span
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: cal.color }}
                              />
                              <span className="text-xs truncate">{cal.name}</span>
                            </label>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Only checked calendars will be visible to Mally.
                      </p>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Send button */}
                <motion.button
                  onClick={() => {
                    console.log('Send button clicked, inputText:', inputText);
                    handleSendMessage();
                  }}
                  disabled={(!inputText.trim() && !uploadedImage) || isLoading}
                  whileTap={{ scale: 0.86 }}
                  transition={{ type: 'spring', damping: 18, stiffness: 400 }}
                  className={cn(
                    "p-2.5 rounded-full transition-colors",
                    inputText.trim() || uploadedImage
                      ? "bg-purple-600 hover:bg-purple-700 text-white"
                      : "bg-black/5 dark:bg-white/10 text-muted-foreground"
                  )}
                >
                  <Send className="h-5 w-5" />
                </motion.button>
              </motion.div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default BottomMallyAI;
