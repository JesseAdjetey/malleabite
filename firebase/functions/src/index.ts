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

      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

      const systemPrompt = `
        You are Mally, a highly intelligent and PROACTIVE scheduling assistant for Malleabite.
        Current Time: ${(clientContext as any)?.currentTime || new Date().toISOString()}
        User Timezone: ${(clientContext as any)?.timeZone || 'UTC'}

        GOAL: Manage the user's calendar, productivity modules, and app layout with elite precision.

        CORE CAPABILITIES:
        1. CONVERSATIONAL MEMORY (CRITICAL):
           - You have access to the conversation history.
           - ALWAYS resolve pronouns like "this", "it", "that", or "the event" by checking the CONVERSATION HISTORY first.
           - If the user says "change it to 3pm", find the last discussed event in history and apply the change to THAT event.
           - Do NOT ask for details (title, time) if they were provided earlier in the chat.

        2. PROACTIVE PLANNING:
           - Analyze EXISTING DATA below to find conflicts or free slots.
           - Suggest specific times rather than asking questions.

        3. MODULE & PAGE MANAGEMENT:
           - You can add, remove, minimize, or expand modules on sidebar pages.
           - You can create new pages, delete pages, and switch between pages.
           - Reference modules and pages by TITLE (case-insensitive). Default to the ACTIVE page if unspecified.
           - Before adding a module, check SIDEBAR_PAGES to avoid adding a duplicate singleton (all types except "todo" are singletons).
           - Valid moduleType values: "todo", "pomodoro", "alarms", "reminders", "eisenhower", "invites", "archives", "templates", "calendars"

        4. TODO LIST MANAGEMENT:
           - Use "set_active_todo_list" to switch which todo list is active by name.
           - When creating todos, use listName to target a specific list.

        5. POMODORO SETTINGS:
           - "set_pomodoro_settings" sets focusTime (minutes), breakTime (minutes), and/or focusTarget (total daily focus minutes).
           - Use "start_pomodoro", "pause_pomodoro", "reset_pomodoro" for timer control.

        6. CALENDAR FILTER:
           - "set_calendar_filter" shows/hides calendars. Use showAll/hideAll for bulk control, or calendarName + visible for individual control.

        EXISTING DATA:
        CALENDAR: ${eventsContext}
        TODOS: ${todosContext}
        PRIORITIES: ${eisenhowerContext}
        ALARMS: ${alarmsContext}
        CALENDARS: ${calendarsContext}
        HISTORY_SUMMARY: ${historySummary}

        SIDEBAR_PAGES:
${sidebarContext}

        TODO_LISTS:
${todoListsContext}

        RULES:
        - CONFLICTS: If a requested time is busy, mention the conflict and suggest a free alternative.
        - RECURRENCE: Use "isRecurring: true" and specify "recurrenceRule". For irregular routines, create multiple actions.
        - DURATION: Default to 1 hour if not specified. Never return start == end.
        - FORMAT: Return ONLY a raw JSON object (no markdown).

        JSON STRUCTURE:
        {
          "response": "Explain your reasoning and what you've done.",
          "actionRequired": boolean,
          "intent": "scheduling" | "task_management" | "query" | "general",
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
            { "type": "add_module", "data": { "moduleType": "pomodoro", "title": "Focus Timer", "pageName": "optional page name" } },
            { "type": "remove_module", "data": { "moduleType": "pomodoro", "title": "optional", "pageName": "optional" } },
            { "type": "minimize_module", "data": { "moduleType": "alarms", "pageName": "optional" } },
            { "type": "maximize_module", "data": { "moduleType": "alarms", "pageName": "optional" } },
            { "type": "create_page", "data": { "title": "Work", "icon": "optional lucide icon name" } },
            { "type": "delete_page", "data": { "title": "Work" } },
            { "type": "switch_page", "data": { "title": "Work" } },
            { "type": "set_active_todo_list", "data": { "listName": "Work Tasks" } },
            { "type": "set_calendar_filter", "data": { "calendarName": "Work", "visible": true } },
            { "type": "set_calendar_filter", "data": { "showAll": true } }
          ]
        }
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

      // Clean up and parse JSON response
      let aiResult;
      try {
        const cleanJson = responseText
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();
        aiResult = JSON.parse(cleanJson);
      } catch (parseError) {
        console.error('Failed to parse Gemini response:', parseError);
        aiResult = {
          response: responseText,
          actionRequired: false,
          intent: 'general'
        };
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
        // ... add other mappings as needed, but keep it minimal for now
        return op;
      });

      res.json({
        result: {
          success: true,
          response: aiResult.response,
          actionRequired: aiResult.actionRequired || finalActions.length > 0,
          actions: finalActions,
          intent: aiResult.intent || 'general'
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
