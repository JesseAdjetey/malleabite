import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Export Stripe webhook handlers
export {
  stripeWebhook,
  createCheckoutSession,
  createPortalSession,
} from './stripe-webhooks';

// Export TTS (Text-to-Speech) handler
export { synthesizeSpeech } from './tts';

// Initialize Firebase Admin
admin.initializeApp();

// Define the Gemini API key secret
const geminiApiKey = defineSecret('GEMINI_API_KEY');

// Define request data interface
interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ProcessAIRequestData {
  message: string;
  userId: string;
  imageData?: {
    dataUrl: string;
    mimeType: string;
  };
  context?: {
    currentTime?: string;
    timeZone?: string;
    conversationHistory?: ConversationMessage[];
    todos?: any[];
    eisenhowerItems?: any[];
  };
}

// Helper to format events for the AI context
const formatEventsForAI = (events: any[]): string => {
  if (!events || events.length === 0) return 'No upcoming events scheduled.';
  return events.map(e => {
    const start = e.start_date?.toDate?.() || e.startsAt?.toDate?.() || (e.startsAt ? new Date(e.startsAt) : null);
    const end = e.end_date?.toDate?.() || e.endsAt?.toDate?.() || (e.endsAt ? new Date(e.endsAt) : null);
    return `- [ID: ${e.id || 'unknown'}] "${e.title}": ${start?.toLocaleString() || 'Unknown'} - ${end?.toLocaleTimeString() || 'Unknown'}`;
  }).join('\n');
};

// Helper to format todos for AI context
const formatTodosForAI = (todos: any[]): string => {
  if (!todos || todos.length === 0) return 'No todos.';
  return todos.map(t => {
    const status = t.completed ? '✓' : '○';
    return `- [ID: ${t.id}] ${status} "${t.text}"`;
  }).join('\n');
};

// Helper to format Eisenhower items for AI context
const formatEisenhowerForAI = (items: any[]): string => {
  if (!items || items.length === 0) return 'No priority items.';
  const quadrantNames: Record<string, string> = {
    'urgent_important': 'Urgent & Important (Do First)',
    'not_urgent_important': 'Not Urgent but Important (Schedule)',
    'urgent_not_important': 'Urgent but Not Important (Delegate)',
    'not_urgent_not_important': 'Not Urgent & Not Important (Eliminate)'
  };
  return items.map(item => {
    const quadrant = quadrantNames[item.quadrant] || item.quadrant;
    return `- [ID: ${item.id}] "${item.text}" - ${quadrant}`;
  }).join('\n');
};

// ─── Persistent AI Memory ──────────────────────────────────────────────────────

interface UserMemory {
  userId: string;
  updatedAt: string;
  preferences: {
    workHoursStart?: string;
    workHoursEnd?: string;
    deepWorkPreference?: string;
    preferredMeetingDuration?: number;
    breakInterval?: number;
    focusGoalMinutes?: number;
    [key: string]: any;
  };
  patterns: {
    typicalMeetingDays?: string[];
    lateRunningEvents?: string[];
    highMeetingDays?: string[];
    averageEventsPerDay?: number;
    [key: string]: any;
  };
  personality: {
    communicationStyle?: string;
    stressIndicators?: string[];
    motivators?: string[];
    [key: string]: any;
  };
  goals: {
    primaryGoal?: string;
    currentFocus?: string;
    weeklyPriorities?: string[];
    [key: string]: any;
  };
  observations: string[];
}

const DEFAULT_MEMORY: Omit<UserMemory, 'userId' | 'updatedAt'> = {
  preferences: {},
  patterns: {},
  personality: {},
  goals: {},
  observations: [],
};

/** Load user memory from Firestore. Returns defaults if none exists. */
async function loadUserMemory(db: admin.firestore.Firestore, userId: string): Promise<UserMemory> {
  try {
    const doc = await db.collection('ai_memory').doc(userId).get();
    if (doc.exists) {
      return doc.data() as UserMemory;
    }
  } catch (e) {
    console.warn('Could not load user memory:', e);
  }
  return { userId, updatedAt: new Date().toISOString(), ...DEFAULT_MEMORY };
}

/** Save memory updates back to Firestore. Merges with existing data. */
async function saveMemoryUpdate(
  db: admin.firestore.Firestore,
  userId: string,
  memoryUpdate: Record<string, any>
): Promise<void> {
  try {
    const ref = db.collection('ai_memory').doc(userId);
    const existing = await ref.get();
    const current = existing.exists ? existing.data() as UserMemory : { ...DEFAULT_MEMORY, userId };

    // Merge preferences, patterns, personality, goals
    const merged: any = { ...current, updatedAt: new Date().toISOString() };
    for (const key of ['preferences', 'patterns', 'personality', 'goals']) {
      if (memoryUpdate[key] && typeof memoryUpdate[key] === 'object') {
        merged[key] = { ...(current as any)[key], ...memoryUpdate[key] };
      }
    }

    // Rolling observations — keep last 20
    if (memoryUpdate.observation && typeof memoryUpdate.observation === 'string') {
      const obs = merged.observations || [];
      obs.push(memoryUpdate.observation);
      merged.observations = obs.slice(-20);
    }
    if (Array.isArray(memoryUpdate.observations)) {
      const obs = merged.observations || [];
      obs.push(...memoryUpdate.observations);
      merged.observations = obs.slice(-20);
    }

    await ref.set(merged, { merge: true });
    console.log('Memory updated for user:', userId);
  } catch (e) {
    console.error('Failed to save memory:', e);
  }
}

/** Format user memory as a readable string for the system prompt */
function formatMemoryForPrompt(memory: UserMemory): string {
  const sections: string[] = [];

  const prefs = memory.preferences || {};
  if (Object.keys(prefs).length > 0) {
    const lines = Object.entries(prefs).map(([k, v]) => `    ${k}: ${v}`);
    sections.push(`  Preferences:\n${lines.join('\n')}`);
  }

  const patterns = memory.patterns || {};
  if (Object.keys(patterns).length > 0) {
    const lines = Object.entries(patterns).map(([k, v]) => `    ${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
    sections.push(`  Patterns:\n${lines.join('\n')}`);
  }

  const goals = memory.goals || {};
  if (Object.keys(goals).length > 0) {
    const lines = Object.entries(goals).map(([k, v]) => `    ${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
    sections.push(`  Goals:\n${lines.join('\n')}`);
  }

  const pers = memory.personality || {};
  if (Object.keys(pers).length > 0) {
    const lines = Object.entries(pers).map(([k, v]) => `    ${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
    sections.push(`  Personality:\n${lines.join('\n')}`);
  }

  const obs = memory.observations || [];
  if (obs.length > 0) {
    sections.push(`  Recent observations:\n${obs.slice(-10).map(o => `    - ${o}`).join('\n')}`);
  }

  if (sections.length === 0) return '  (No memory yet — this is a new user. Be welcoming!)';
  return sections.join('\n');
}

/**
 * Fallback responses when Gemini API is not available
 */
function getFallbackResponse(message: string) {
  const lowerMessage = message.toLowerCase();

  const response: any = {
    success: true,
    response: '',
    eventData: null,
    actionRequired: false,
    intent: 'general'
  };

  // Greeting detection
  if (lowerMessage.match(/\b(hi|hello|hey|greetings)\b/)) {
    response.response = "Hello! I'm Mally, your intelligent scheduling assistant. I can help you create calendar events, check your schedule, and manage your time effectively. Try asking me to 'schedule a meeting tomorrow at 2 PM' or 'what's on my calendar today?'";
    return response;
  }

  // Schedule/Create event detection
  if (lowerMessage.match(/\b(schedule|create|add|book|set up)\b.*\b(meeting|event|appointment|call|session)\b/)) {
    const tomorrow = lowerMessage.includes('tomorrow');
    const timeMatch = lowerMessage.match(/(\d{1,2})\s*(?::(\d{2}))?\s*(am|pm)?/i);

    let startTime = new Date();
    if (tomorrow) {
      startTime.setDate(startTime.getDate() + 1);
    }

    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      const period = timeMatch[3]?.toLowerCase();

      if (period === 'pm' && hours < 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;

      startTime.setHours(hours, minutes, 0, 0);
    } else {
      startTime.setHours(14, 0, 0, 0);
    }

    const endTime = new Date(startTime);
    endTime.setHours(endTime.getHours() + 1);

    const titleMatch = lowerMessage.match(/(?:schedule|create|add|book)\s+(?:a\s+)?(.+?)(?:\s+(?:for|at|on|tomorrow|today))/i);
    const title = titleMatch ? titleMatch[1].trim() : 'New Event';

    response.response = `I've prepared a calendar event for "${title}" on ${startTime.toLocaleDateString()} at ${startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. The event will be created when you confirm.`;
    response.actionRequired = true;
    response.intent = 'scheduling';
    response.eventData = {
      title,
      startsAt: startTime.toISOString(),
      endsAt: endTime.toISOString(),
      description: `Created by Mally AI from: "${message}"`,
      color: '#3b82f6'
    };
    return response;
  }

  // View schedule detection
  if (lowerMessage.match(/\b(show|view|check|what|what's|whats)\b.*\b(schedule|calendar|events|appointments)\b/)) {
    response.response = "To view your schedule, check the calendar view on your dashboard. Would you like me to create an event for you?";
    response.intent = 'query';
    return response;
  }

  // Default response
  response.response = "I'm here to help you manage your schedule! You can ask me to:\n• Schedule meetings or events (e.g., 'Schedule a team meeting tomorrow at 3 PM')\n• Check your calendar\n• Find available time slots\n• Manage your appointments\n\nNote: For full AI capabilities, please configure the Gemini API key.";
  return response;
}

/**
 * Process AI requests for intelligent scheduling with Gemini AI
 */
export const processAIRequest = onRequest(
  {
    cors: [
      'http://localhost:8080',
      'http://localhost:8081',
      'http://localhost:5173',
      'http://localhost:3000',
      'https://malleabite-97d35.web.app',
      'https://malleabite-97d35.firebaseapp.com',
      'https://malleabite.vercel.app',
      /\.vercel\.app$/  // Allow all Vercel preview deployments
    ],
    region: 'us-central1',
    secrets: [geminiApiKey]
  },
  async (req, res) => {
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.set('Access-Control-Max-Age', '3600');
      res.status(204).send('');
      return;
    }

    // Set CORS headers for all responses
    res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    try {
      // Verify the Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          error: { message: 'Missing or invalid Authorization header', status: 'UNAUTHENTICATED' }
        });
        return;
      }

      const idToken = authHeader.split('Bearer ')[1];

      // Verify the Firebase ID token
      let decodedToken;
      try {
        decodedToken = await admin.auth().verifyIdToken(idToken);
      } catch (error) {
        console.error('Token verification failed:', error);
        res.status(401).json({
          error: { message: 'Invalid authentication token', status: 'UNAUTHENTICATED' }
        });
        return;
      }

      const authenticatedUserId = decodedToken.uid;
      console.log('Authenticated user:', authenticatedUserId);

      // Parse request body
      const requestData = req.body.data || req.body;
      const { message, userId, context: clientContext } = requestData as ProcessAIRequestData;

      if (!message || !userId) {
        res.status(400).json({
          error: { message: 'Missing required fields: message and userId', status: 'INVALID_ARGUMENT' }
        });
        return;
      }

      // Verify the userId matches the authenticated user
      if (authenticatedUserId !== userId) {
        res.status(403).json({
          error: { message: 'User ID does not match authenticated user', status: 'PERMISSION_DENIED' }
        });
        return;
      }

      // Check if Gemini API key is configured
      const apiKey = geminiApiKey.value();
      if (!apiKey) {
        console.warn('GEMINI_API_KEY is missing, using fallback responses');
        const fallbackResponse = getFallbackResponse(message);
        res.json({ result: fallbackResponse });
        return;
      }

      // Initialize Gemini with the secret
      const genAI = new GoogleGenerativeAI(apiKey);

      // Fetch user's events for context
      const db = admin.firestore();
      let eventsContext = 'No upcoming events scheduled.';
      let todosContext = 'No todos.';
      let eisenhowerContext = 'No priority items.';
      let alarmsContext = 'No alarms set.';

      // Fetch events
      try {
        const eventsSnapshot = await db.collection('calendar_events')
          .where('userId', '==', userId)
          .limit(20)
          .get();

        const events: any[] = [];
        eventsSnapshot.forEach(doc => events.push({ id: doc.id, ...doc.data() }));
        if (events.length > 0) {
          eventsContext = formatEventsForAI(events);
        }
      } catch (dbError) {
        console.warn('Could not fetch events:', dbError);
      }

      // Fetch todos
      try {
        const todosSnapshot = await db.collection('todos')
          .where('userId', '==', userId)
          .limit(30)
          .get();

        const todos: any[] = [];
        todosSnapshot.forEach(doc => todos.push({ id: doc.id, ...doc.data() }));
        if (todos.length > 0) {
          todosContext = formatTodosForAI(todos);
        }
      } catch (dbError) {
        console.warn('Could not fetch todos:', dbError);
      }

      // Fetch Eisenhower items
      try {
        const eisenhowerSnapshot = await db.collection('eisenhower_items')
          .where('userId', '==', userId)
          .limit(30)
          .get();

        const eisenhowerItems: any[] = [];
        eisenhowerSnapshot.forEach(doc => eisenhowerItems.push({ id: doc.id, ...doc.data() }));
        if (eisenhowerItems.length > 0) {
          eisenhowerContext = formatEisenhowerForAI(eisenhowerItems);
        }
      } catch (dbError) {
        console.warn('Could not fetch Eisenhower items:', dbError);
      }

      // Fetch alarms
      try {
        const alarmsSnapshot = await db.collection('alarms')
          .where('userId', '==', userId)
          .where('enabled', '==', true)
          .limit(20)
          .get();

        const alarms: any[] = [];
        alarmsSnapshot.forEach(doc => alarms.push({ id: doc.id, ...doc.data() }));
        if (alarms.length > 0) {
          alarmsContext = alarms.map(a => {
            const time = a.time?.toDate?.() || (a.time ? new Date(a.time) : null);
            const linkedInfo = a.linkedEventId ? ` [Linked to Event ${a.linkedEventId}]` :
              a.linkedTodoId ? ` [Linked to Todo ${a.linkedTodoId}]` : '';
            return `- [ID: ${a.id}] "${a.title}": ${time?.toLocaleString() || 'Unknown'}${linkedInfo}`;
          }).join('\n');
        }
      } catch (dbError) {
        console.warn('Could not fetch alarms:', dbError);
      }

      // Build conversation history string (if needed for context fallback)
      const conversationHistory = (clientContext as any)?.conversationHistory || [];
      const historySummary = conversationHistory.length > 0
        ? conversationHistory.map((m: any) => `${m.role === 'user' ? 'User' : 'Mally'}: ${m.content}`).join('\n')
        : 'No previous conversation.';

      // Build available calendars context for multi-account support
      const availableCalendars = (clientContext as any)?.availableCalendars || [];
      const calendarsContext = availableCalendars.length > 0
        ? availableCalendars.map((c: any) => `- "${c.name}" (ID: ${c.id})${c.isDefault ? ' [Default]' : ''}${c.isGoogle ? ' [Google Calendar]' : ''}`).join('\n')
        : '- "My Calendar" (ID: default) [Default]';

      // Build sidebar pages context
      const sidebarPages = (clientContext as any)?.sidebarPages || [];
      const sidebarContext = sidebarPages.length > 0
        ? sidebarPages.map((p: any) => {
          const activeMarker = p.isActive ? ' [ACTIVE]' : '';
          const moduleList = p.modules && p.modules.length > 0
            ? p.modules.map((m: any) => {
              const minMarker = m.minimized ? ' [minimized]' : '';
              const listInfo = m.listId ? ` (listId: ${m.listId})` : '';
              return `    - [index: ${m.index}] type="${m.type}" title="${m.title}"${minMarker}${listInfo}`;
            }).join('\n')
            : '    (no modules)';
          return `  Page: "${p.title}" (id: ${p.id})${activeMarker}\n${moduleList}`;
        }).join('\n')
        : '  (no sidebar pages loaded)';

      // Build todo lists context
      const todoListsCtx = (clientContext as any)?.todoLists || [];
      const todoListsContext = todoListsCtx.length > 0
        ? todoListsCtx.map((l: any) => `  - [ID: ${l.id}] "${l.name}"${l.isActive ? ' [ACTIVE]' : ''}`).join('\n')
        : '  (no todo lists)';

      // ── Load persistent memory ────────────────────────────────────────────
      const userMemory = await loadUserMemory(db, userId);
      const memoryContext = formatMemoryForPrompt(userMemory);

      // ── Also include memory from client context if provided ─────────────
      const clientMemory = (clientContext as any)?.userMemory;
      const clientMemoryContext = clientMemory
        ? `\n  Client-side memory supplement: ${JSON.stringify(clientMemory)}`
        : '';

      // ── Initialize model WITH Google Search grounding ──────────────────
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        tools: [{ googleSearch: {} } as any],
      });

      const systemPrompt = `
You are **Mally** — the user's personal productivity doctor, time management expert, and trusted AI companion inside the Malleabite app.

Current Time: ${(clientContext as any)?.currentTime || new Date().toISOString()}
User Timezone: ${(clientContext as any)?.timeZone || 'UTC'}

═══════════════════════════════════════════════════
  YOUR IDENTITY & PERSONALITY
═══════════════════════════════════════════════════

You are NOT a generic chatbot. You are:
- A **productivity doctor** — you diagnose scheduling health, prescribe improvements, and follow up.
- **Emotionally intelligent** — you read between the lines. If a user says "I'm overwhelmed" or has 10 back-to-back meetings, you acknowledge their feelings FIRST before offering solutions.
- **A trusted companion** — warm, approachable, concise, direct. You speak like a smart friend who happens to be a world-class executive assistant, never robotic or formal.
- **A learner** — you remember what users tell you and what you observe. You notice patterns ("You're always busier on Mondays") and use them to give better advice.
- **Dependable** — you never hallucinate calendar data. If you don't know something, you say so. When you search the internet, you cite your sources.

Tone: Warm but efficient. Use emojis sparingly (max 1 per response). Be concise — users are busy. Never patronize. When the user is stressed, lead with empathy before solutions.

═══════════════════════════════════════════════════
  ACTION vs. ADVICE — KNOW THE DIFFERENCE
═══════════════════════════════════════════════════

This is CRITICAL to your personality. You must distinguish between:

**EXECUTE MODE** (user gave a clear instruction — just do it):
- "Schedule a meeting at 3pm" → Create the event. Don't suggest a different time unless there's a REAL conflict.
- "Add a todo: buy groceries" → Add it. Don't ask "what list?" unless they have multiple.
- "Delete my 2pm event" → Delete it. Don't ask "are you sure?" — they told you what to do.
- "Set an alarm for 6am" → Set it. Period.
- "Move my gym session to Friday" → Move it. Confirm briefly, don't lecture.

**ADVISE MODE** (user is asking for help, exploring, or vague — offer thoughtful suggestions):
- "How's my week looking?" → Diagnose and prescribe.
- "I'm feeling overwhelmed" → Empathize, then offer to restructure.
- "When should I schedule my workout?" → Analyze free slots, suggest the best one.
- "Help me plan tomorrow" → Build a full plan proactively.
- "What should I prioritize?" → Analyze tasks and recommend.

**THE RULE**: If the user's intent is clear and specific, EXECUTE first, comment briefly. If their intent is open-ended or they're asking for guidance, ADVISE. When in doubt, execute — users hate being asked unnecessary questions.

**NEVER do these**:
- Don't suggest alternatives when the user gave a specific time (unless there's a real conflict)
- Don't ask "would you like me to..." when they already told you to
- Don't add unsolicited productivity tips to simple commands
- Don't second-guess clear instructions

═══════════════════════════════════════════════════
  PERSISTENT MEMORY (YOU REMEMBER ACROSS SESSIONS)
═══════════════════════════════════════════════════

You have access to the user's persistent memory profile. USE it to personalize everything. Reference it naturally ("Since you prefer mornings for deep work, I'll put that at 8am").

USER_MEMORY:
${memoryContext}${clientMemoryContext}

MEMORY LEARNING PROTOCOL:
- When the user tells you a preference ("I like mornings", "I need 90min focus blocks"), save it via memoryUpdate.
- When you notice a pattern from data (e.g., user always has 6+ events on Mondays), log it as an observation.
- When the user shares goals ("I'm launching a product in March"), save it under goals.
- When you detect stress (many overlapping events, user says they're overwhelmed), note it in observations.
- ALWAYS include a "memoryUpdate" field in your JSON response if you learned anything new. Even small things count.

═══════════════════════════════════════════════════
  INTERNET SEARCH (GOOGLE SEARCH GROUNDING)
═══════════════════════════════════════════════════

You have access to Google Search. Use it when:
- The user asks a factual question you're not 100% sure about
- The user asks about best practices, research, or external information
- You need real-time data (weather, business hours, news, events)
- Providing productivity or wellbeing advice backed by research

When you use search, Gemini will automatically ground your response with real sources. The system will extract source URLs and send them to the user's UI.

Do NOT make up facts. If you search and find nothing, say so.

═══════════════════════════════════════════════════
  EMOTIONAL INTELLIGENCE PROTOCOL
═══════════════════════════════════════════════════

1. **Detect stress signals**: Look for:
   - Words: "overwhelmed", "stressed", "too much", "can't cope", "exhausted", "burned out"
   - Data: 6+ events in a day, no lunch break (12–2pm all booked), 4+ consecutive days with 5+ events
   - Patterns: user keeps rescheduling, cancelling events, or asking to clear their calendar

2. **When stress is detected**:
   - Lead with empathy: "That IS a lot. Let me help you get some breathing room."
   - Offer concrete relief: suggest moving non-urgent events, blocking focus time, or cancelling low-priority meetings
   - Never say "just prioritize" — instead, do the prioritizing for them

3. **Celebrate wins**: If the user completed tasks, had a light day, or hit a focus goal, acknowledge it. "Nice — you cleared 8 tasks today 💪"

4. **Wellness nudges**: If no break exists between 12–2pm, gently suggest one. If user has 5+ days of heavy schedules, nudge about burnout.

═══════════════════════════════════════════════════
  PRODUCTIVITY DOCTOR MODE
═══════════════════════════════════════════════════

When the user asks for advice ("How's my week looking?", "Am I being productive?", "What should I change?"), switch to Productivity Doctor mode:

1. **Diagnose**: Analyze their calendar, todos, and patterns. Look for:
   - Meeting-heavy days with no focus blocks
   - Incomplete tasks piling up
   - No breaks or lunch
   - Goals not reflected in calendar

2. **Prescribe**: Give specific, actionable recommendations:
   - "Block 9–11am as focus time on Tuesdays — your calendar is clear then"
   - "You have 15 incomplete todos — let me pick the top 3 for today"
   - "Your Mondays are packed but Wednesdays are light — consider moving X"

3. **Follow up**: Note your recommendations in observations so you can check next time.

═══════════════════════════════════════════════════
  CORE CAPABILITIES (SCHEDULING ENGINE)
═══════════════════════════════════════════════════

1. CONVERSATIONAL MEMORY (CRITICAL):
   - ALWAYS resolve pronouns ("this", "it", "that") by checking CONVERSATION HISTORY first.
   - If the user says "change it to 3pm", find the last discussed event and apply the change.
   - Do NOT re-ask for details already provided in the chat.

2. PROACTIVE PLANNING (CRITICAL — DO NOT ASK UNNECESSARY QUESTIONS):
   - ALWAYS check the calendar before scheduling. Pick the best available slot.
   - NEVER ask "what time?" if you can figure it out from context. Just pick a good time and explain why.
   - When planning multi-event schedules, generate ALL events in one response.
   - Use memory: if user prefers mornings for deep work, schedule deep work in morning.

3. CONFLICT AWARENESS (CRITICAL):
   - Scan CALENDAR before creating/moving any event.
   - If a slot is busy: (a) tell user which event is there, (b) suggest next free slot, (c) offer to move the existing event.
   - Never silently double-book.

4. RECURRING EVENTS — DIFFERENT DAYS/TIMES:
   - Different times → SEPARATE recurring events per day.
   - Same time all days → single event with byDay array.
   - recurrenceRule: { "frequency": "weekly", "byDay": ["MO"] }

5. MODULE & PAGE MANAGEMENT:
   - Add/remove/minimize/maximize modules. Create/delete/switch pages.
   - Check SIDEBAR_PAGES to avoid duplicates. Valid types: "todo", "pomodoro", "alarms", "reminders", "eisenhower", "invites", "archives", "templates", "calendars"

6. TODO LIST & POMODORO: Use listName for targeting. Use start/pause/reset/set_pomodoro_settings.

7. CALENDAR FILTER: showAll/hideAll for bulk, calendarName + visible for individual.

═══════════════════════════════════════════════════
  EXISTING DATA
═══════════════════════════════════════════════════

CALENDAR:
${eventsContext}

TODOS:
${todosContext}

PRIORITIES:
${eisenhowerContext}

ALARMS:
${alarmsContext}

CALENDARS:
${calendarsContext}

HISTORY_SUMMARY:
${historySummary}

SIDEBAR_PAGES:
${sidebarContext}

TODO_LISTS:
${todoListsContext}

═══════════════════════════════════════════════════
  RULES
═══════════════════════════════════════════════════

- CONFLICTS: Scan first. If taken, say so and offer alternative. Never double-book.
- RECURRENCE SAME TIME: single event, byDay array.
- RECURRENCE DIFFERENT TIMES: separate events, one day each.
- MULTI-EVENT PLANNING: Produce ALL events in one actions array.
- DURATION: Default 1 hour. Never start == end.
- ISO DATES: Full ISO 8601 ("2026-02-17T09:00:00"). Use user's timezone.
- FORMAT: Return ONLY a raw JSON object (no markdown, no code blocks).

═══════════════════════════════════════════════════
  JSON RESPONSE STRUCTURE
═══════════════════════════════════════════════════

{
  "response": "Your message to the user. Be warm, concise, and explain your reasoning.",
  "actionRequired": boolean,
  "intent": "scheduling" | "task_management" | "query" | "general" | "wellness" | "diagnosis",
  "actions": [
    { "type": "create_event", "data": { "title": "...", "start": "ISO", "end": "ISO", "isRecurring": false, "recurrenceRule": null } },
    { "type": "update_event", "data": { "eventId": "...", "start": "ISO", "end": "ISO", "title": "..." } },
    { "type": "delete_event", "data": { "eventId": "..." } },
    { "type": "create_todo", "data": { "text": "...", "listName": "..." } },
    { "type": "complete_todo", "data": { "todoId": "..." } },
    { "type": "create_todo_list", "data": { "name": "...", "color": "#hex" } },
    { "type": "create_alarm", "data": { "title": "...", "time": "ISO" } },
    { "type": "create_reminder", "data": { "title": "...", "reminderTime": "ISO" } },
    { "type": "create_eisenhower", "data": { "text": "...", "quadrant": "urgent_important|not_urgent_important|urgent_not_important|not_urgent_not_important" } },
    { "type": "start_pomodoro", "data": {} },
    { "type": "pause_pomodoro", "data": {} },
    { "type": "reset_pomodoro", "data": {} },
    { "type": "set_pomodoro_timer", "data": { "focusTime": 25, "breakTime": 5 } },
    { "type": "set_pomodoro_settings", "data": { "focusTime": 25, "breakTime": 5, "focusTarget": 120 } },
    { "type": "change_view", "data": { "view": "Day|Week|Month" } },
    { "type": "add_module", "data": { "moduleType": "...", "title": "...", "pageName": "optional" } },
    { "type": "remove_module", "data": { "moduleType": "...", "title": "optional", "pageName": "optional" } },
    { "type": "minimize_module", "data": { "moduleType": "...", "pageName": "optional" } },
    { "type": "maximize_module", "data": { "moduleType": "...", "pageName": "optional" } },
    { "type": "create_page", "data": { "title": "...", "icon": "optional" } },
    { "type": "delete_page", "data": { "title": "..." } },
    { "type": "switch_page", "data": { "title": "..." } },
    { "type": "set_active_todo_list", "data": { "listName": "..." } },
    { "type": "set_calendar_filter", "data": { "calendarName": "...", "visible": true } },
    { "type": "set_calendar_filter", "data": { "showAll": true } }
  ],
  "memoryUpdate": {
    "preferences": { "key": "value" },
    "patterns": { "key": "value" },
    "goals": { "key": "value" },
    "personality": { "key": "value" },
    "observation": "One-sentence observation about the user"
  }
}

INCLUDE "memoryUpdate" whenever you learn something new about the user. Omit it (or set to null) if nothing new was learned.
      `;

      // Format history for Gemini chat session
      const history = (clientContext as any)?.history || [];
      const formattedHistory = history.map((h: any) => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.parts }]
      }));

      const chat = model.startChat({
        history: formattedHistory,
        systemInstruction: {
          role: "system",
          parts: [{ text: systemPrompt }]
        }
      });

      const result = await chat.sendMessage(message);
      const responseText = result.response.text();

      // ── Extract Google Search grounding metadata (source citations) ────
      let sources: Array<{ title: string; uri: string }> = [];
      try {
        const candidate = (result.response as any).candidates?.[0];
        const groundingMeta = candidate?.groundingMetadata;
        if (groundingMeta?.groundingChunks) {
          sources = groundingMeta.groundingChunks
            .map((c: any) => ({ uri: c.web?.uri, title: c.web?.title }))
            .filter((s: any) => s.uri && s.title);
        }
      } catch (groundingErr) {
        console.warn('Could not extract grounding metadata:', groundingErr);
      }

      // Clean up and parse JSON response — robust multi-strategy parser
      let aiResult;
      try {
        // Strategy 1: Direct parse (fastest path)
        aiResult = JSON.parse(responseText.trim());
      } catch {
        try {
          // Strategy 2: Strip markdown code fences
          const stripped = responseText
            .replace(/```json\s*/gi, '')
            .replace(/```\s*/g, '')
            .trim();
          aiResult = JSON.parse(stripped);
        } catch {
          try {
            // Strategy 3: Extract first JSON object via regex (handles "Here's the response: {...}")
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              aiResult = JSON.parse(jsonMatch[0]);
            } else {
              throw new Error('No JSON object found');
            }
          } catch (finalError) {
            console.error('All JSON parse strategies failed:', finalError);
            console.error('Raw response:', responseText.slice(0, 500));
            aiResult = {
              response: responseText,
              actionRequired: false,
              intent: 'general'
            };
          }
        }
      }

      // ── Save memory updates if AI learned something ────────────────────
      if (aiResult.memoryUpdate && typeof aiResult.memoryUpdate === 'object') {
        await saveMemoryUpdate(db, userId, aiResult.memoryUpdate);
      }

      // Build standardized response
      const rawActions = aiResult.actions || aiResult.operations || [];
      const finalActions = rawActions.map((op: any) => {
        const type = op.type;
        const data = op.data || op.event || op;

        if (type === 'create_event') {
          return {
            type: 'create_event',
            data: {
              title: data.title,
              start: data.start || data.startsAt,
              end: data.end || data.endsAt,
              description: data.description || 'Created by Mally AI',
              isRecurring: data.isRecurring || false,
              recurrenceRule: data.recurrenceRule || null
            }
          };
        }
        return op;
      });

      res.json({
        result: {
          success: true,
          response: aiResult.response,
          actionRequired: aiResult.actionRequired || finalActions.length > 0,
          actions: finalActions,
          intent: aiResult.intent || 'general',
          sources,
        }
      });
    } catch (error) {
      console.error('Error processing AI request:', error);
      res.status(500).json({
        error: { message: 'An error occurred while processing your request', status: 'INTERNAL' }
      });
    }
  }
);

/**
 * Audio transcription using Gemini
 */
export const transcribeAudio = onRequest(
  {
    region: 'us-central1',
    secrets: [geminiApiKey]
  },
  async (req, res) => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      const { audioData } = req.body.data || req.body;
      const apiKey = geminiApiKey.value();

      if (!apiKey) {
        res.json({ result: { success: true, transcript: "Mock transcript (API Key missing)" } });
        return;
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const result = await model.generateContent([
        {
          inlineData: {
            mimeType: "audio/wav",
            data: audioData
          }
        },
        { text: "Transcribe this audio exactly as spoken. Return only the text." }
      ]);

      res.json({
        result: {
          success: true,
          transcript: result.response.text()
        }
      });
    } catch (error) {
      console.error('Transcription Error:', error);
      res.status(500).json({ error: 'Failed to transcribe audio' });
    }
  }
);

/**
 * Helper to create calendar event directly (for testing/bypass)
 */
export const createCalendarEvent = onRequest(
  { region: 'us-central1' },
  async (req, res) => {
    // CORS headers
    res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    try {
      const { eventData, userId } = req.body.data || req.body;
      const db = admin.firestore();

      const docRef = await db.collection('calendar_events').add({
        ...eventData,
        userId: userId,
        created_at: admin.firestore.Timestamp.now(),
        updated_at: admin.firestore.Timestamp.now()
      });

      res.json({ result: { success: true, eventId: docRef.id } });
    } catch (error) {
      console.error('Create Event Error:', error);
      res.status(500).json({ error: 'Failed to create event' });
    }
  }
);
