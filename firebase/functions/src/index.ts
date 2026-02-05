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
      const { message, userId, imageData, context: clientContext } = requestData as ProcessAIRequestData;

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

      // Build conversation history string
      const conversationHistory = clientContext?.conversationHistory || [];
      const historyString = conversationHistory.length > 0
        ? conversationHistory.map(m => `${m.role === 'user' ? 'User' : 'Mally'}: ${m.content}`).join('\n')
        : 'No previous conversation.';

      // Build available calendars context for multi-account support
      const availableCalendars = (clientContext as any)?.availableCalendars || [];
      const calendarsContext = availableCalendars.length > 0
        ? availableCalendars.map((c: any) => `- "${c.name}" (ID: ${c.id})${c.isDefault ? ' [Default]' : ''}${c.isGoogle ? ' [Google Calendar]' : ''}`).join('\n')
        : '- "My Calendar" (ID: default) [Default]';

      // Generate AI response with Gemini (using flash model for free tier efficiency)
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          topK: 40,
          maxOutputTokens: 1024, // Optimize for free tier
        }
      });

      const systemPrompt = `
You are Mally, an intelligent and proactive productivity assistant for a calendar app called Malleabite.
Current Date/Time: ${clientContext?.currentTime || new Date().toISOString()}
User Timezone: ${clientContext?.timeZone || 'UTC'}

YOUR CAPABILITIES - USE THEM PROACTIVELY:
1. CALENDAR EVENTS: Create, update, delete calendar events (including recurring events)
2. TODO LISTS: Create named todo lists, add todos to specific lists, complete, delete todos
3. EISENHOWER MATRIX: Add, update, delete priority items (4 quadrants for prioritization)
4. ALARMS: Create, update, delete alarms and link them to events or todos
5. REMINDERS: Create, update, delete reminders with custom times and sounds
6. RECURRING EVENTS: Create events that repeat daily, weekly, monthly, or yearly
7. QUERY: Answer questions about the user's schedule, todos, priorities, alarms, or reminders

CRITICAL - BE A SMART PROACTIVE PLANNER:
When users ask you to "help plan", "organize my schedule", "set up a routine", or similar planning requests:
1. NEVER ask for specific times - BE PROACTIVE and suggest reasonable times yourself!
2. TAKE ACTION IMMEDIATELY - don't ask clarifying questions unless truly necessary
3. BE PROACTIVE - choose reasonable times based on common sense:
   - Morning routines: 6-9 AM
   - Work/study sessions: 9 AM - 5 PM
   - Lunch: 12-1 PM
   - Exercise/gym: 6-7 AM or 5-7 PM (popular fitness times)
   - Evening activities: 6-9 PM
   - Sleep/wind down: 9-11 PM
4. ALWAYS CREATE MULTIPLE EVENTS when user asks for multiple things
5. For recurring activities, CREATE EACH AS A SEPARATE RECURRING EVENT with appropriate times
6. When user says "plan" or "help me" - JUST DO IT with sensible defaults

COMPLEX RECURRING PATTERNS - DIFFERENT DAYS/TIMES:
When user wants different times on different days (e.g., "gym Monday 5pm, Tuesday 6pm, Wednesday 7pm"):
- DO NOT create a single recurring event with daysOfWeek
- Instead, CREATE SEPARATE RECURRING EVENTS for each day/time combination
- Example: "gym Mon 5pm, Tue 6pm, Wed 7pm" = 3 separate weekly recurring events:
  1. Gym - recurring weekly on Monday at 17:00
  2. Gym - recurring weekly on Tuesday at 18:00  
  3. Gym - recurring weekly on Wednesday at 19:00

MULTIPLE EVENTS - VERY IMPORTANT:
When user requests multiple activities, ALWAYS return MULTIPLE actions. Use this format:
{
  "response": "Your message explaining all events being created",
  "actionRequired": true,
  "intent": "create_multiple_events",
  "actions": [
    { "type": "create_event", "data": { ... first event ... } },
    { "type": "create_event", "data": { ... second event ... } },
    { "type": "create_event", "data": { ... third event ... } }
  ]
}

PROACTIVE ACTION TRIGGERS:
- "add X to my list" or "remind me to X" → Use create_todo
- "create a list for X" or "new list called X" → Use create_todo_list
- "set alarm for X" or "wake me up at X" → Use create_alarm  
- "set reminder for X" or "remind me at X" → Use create_reminder
- "important", "urgent", "must do" → Suggest create_eisenhower
- "schedule X" or "create meeting" → Use create_event
- "delete", "remove", "cancel" → Use appropriate delete action
- "done", "finished", "completed" about a todo → Use complete_todo
- "plan my day/week", "help me schedule", "set up routine" → Create multiple events with smart defaults IMMEDIATELY

RECURRING EVENT PATTERNS:
- Daily: "every day", "daily" → { frequency: "daily", interval: 1 }
- Weekly same time: "every week", "weekly" → { frequency: "weekly", daysOfWeek: [X] }
- Weekdays: "every weekday", "Mon-Fri" → { frequency: "weekly", daysOfWeek: [1,2,3,4,5] }
- Monthly: "every month", "monthly" → { frequency: "monthly", dayOfMonth: X }
- Yearly: "every year", "annually" → { frequency: "yearly" }
- DIFFERENT TIMES ON DIFFERENT DAYS: Create SEPARATE events for each day/time pair!

USER'S CURRENT DATA:

=== CALENDAR EVENTS ===
${eventsContext}

=== TODO LIST ===
${todosContext}

=== EISENHOWER MATRIX (Priority Items) ===
${eisenhowerContext}

=== ALARMS ===
${alarmsContext}

=== AVAILABLE CALENDARS ===
${calendarsContext}
When the user specifies which calendar to add an event to (e.g., "add to my work calendar", "put it in Google Calendar"), use the matching calendarId or calendarName in the event data.
If no calendar is specified, use the default calendar.

=== CONVERSATION HISTORY ===
${historyString}

HANDLING CONFIRMATIONS:
When user says "yes", "yeah", "sure", "ok", "do it", "sounds good":
1. Look at PREVIOUS message to find what action was suggested
2. Set intent to "confirmation" 
3. Set actionRequired to true
4. Include the FULL action object with ALL data from previous suggestion

INSTRUCTIONS:
1. Analyze user's message AND conversation history to understand intent
2. BE SMART about planning - don't always ask for times, suggest reasonable defaults
3. For multiple requests, create multiple actions in the "actions" array
4. For CREATION actions, prepare the action and explain what you'll create
5. For DELETION/UPDATE, ask confirmation unless user says "delete" or "remove"
6. For todo completion, execute immediately when user says "done" or "completed"
7. Be conversational and helpful - explain what you're doing

Return JSON with this structure (no markdown, just raw JSON):
For SINGLE action:
{
  "response": "Your friendly response",
  "actionRequired": true or false,
  "intent": "create_event" | "update_event" | "delete_event" | "create_todo" | ... | "query" | "confirmation" | "general",
  "action": { "type": "...", "data": { ... } }
}

For MULTIPLE actions:
{
  "response": "Your friendly response explaining all the events/items you're creating",
  "actionRequired": true,
  "intent": "create_multiple_events",
  "actions": [
    { "type": "create_event", "data": { ... } },
    { "type": "create_event", "data": { ... } }
  ]
}

ACTION DATA FORMATS:
- create_event: { title: string, start: ISO datetime, end: ISO datetime, description: string (ALWAYS generate a short 1-2 sentence description for the event - be helpful and contextual), calendarId?: string, calendarName?: string, isRecurring?: boolean, recurrenceRule?: { frequency, interval?, daysOfWeek?, dayOfMonth?, monthOfYear?, endDate?, count? } }
- update_event: { eventId: string, title?: string, start?: ISO datetime, end?: ISO datetime, description?: string, calendarId?: string }
- delete_event: { eventId: string }
- create_todo_list: { name: string, color?: string }
- create_todo: { text: string, listId?: string }
- complete_todo: { todoId: string }
- delete_todo: { todoId: string }
- create_eisenhower: { text: string, quadrant: "urgent_important" | "not_urgent_important" | "urgent_not_important" | "not_urgent_not_important" }
- update_eisenhower: { itemId: string, quadrant: "urgent_important" | "not_urgent_important" | "urgent_not_important" | "not_urgent_not_important" }
- delete_eisenhower: { itemId: string }
- create_alarm: { title: string, time: ISO datetime, linkedEventId?: string, linkedTodoId?: string, repeatDays?: number[] }
- update_alarm: { alarmId: string, title?: string, time?: ISO datetime }
- delete_alarm: { alarmId: string }
- link_alarm: { alarmId: string, linkedEventId?: string, linkedTodoId?: string }
- create_reminder: { title: string, reminderTime: ISO datetime, description?: string, eventId?: string, soundId?: string }
- update_reminder: { reminderId: string, title?: string, reminderTime?: ISO datetime, description?: string }
- delete_reminder: { reminderId: string }

RECURRENCE EXAMPLES:
- Daily: { frequency: "daily", interval: 1 }
- Weekdays (Mon-Fri): { frequency: "weekly", daysOfWeek: [1, 2, 3, 4, 5] }
- Weekly on Mon/Wed/Fri: { frequency: "weekly", daysOfWeek: [1, 3, 5] }
- Monthly on 15th: { frequency: "monthly", dayOfMonth: 15 }

QUADRANT MEANINGS:
- urgent_important = Do First (crisis, deadlines, emergencies)
- not_urgent_important = Schedule (goals, planning, growth)
- urgent_not_important = Delegate (interruptions, some meetings)
- not_urgent_not_important = Eliminate (time wasters, distractions)

Notes:
- Only include "action" field if actionRequired is true
- Default event duration is 1 hour if not specified
- Default alarm time is 15 minutes before linked event if not specified
- Match item IDs carefully from the user's existing data when updating/deleting
- ALWAYS generate a short, helpful description for every event (1-2 sentences max). Examples:
  * "Prayer" → "Daily spiritual practice and reflection time"
  * "Gym" → "Workout session to stay active and healthy"
  * "Meeting with John" → "Catch up and discuss project updates"
  * "Dentist appointment" → "Regular dental checkup and cleaning"
`;

      // Prepare the content parts for Gemini
      const contentParts: any[] = [];
      
      // Add image if provided
      if (imageData && imageData.dataUrl && imageData.mimeType) {
        // Extract base64 data from data URL
        const base64Data = imageData.dataUrl.split(',')[1];
        contentParts.push({
          inlineData: {
            mimeType: imageData.mimeType,
            data: base64Data
          }
        });
        contentParts.push({ text: `[User uploaded an image]\n\nUser message: ${message}\n\nPlease analyze the image and respond appropriately. If the image contains calendar-related information (schedules, events, dates), help create events from it. If it contains tasks or todo lists, help organize them.` });
      } else {
        contentParts.push({ text: `User message: ${message}` });
      }

      const result = await model.generateContent([systemPrompt, ...contentParts]);
      const responseText = result.response.text();
      
      console.log('Gemini raw response:', responseText);

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

      // Build response
      const response: any = {
        success: true,
        response: aiResult.response,
        actionRequired: aiResult.actionRequired || false,
        intent: aiResult.intent || 'general',
        action: null,
        actions: null, // Support for multiple actions
        eventData: null, // Keep for backward compatibility
        conflicts: []
      };

      // Handle multiple actions array (for complex recurring events with different times)
      if (aiResult.actionRequired && aiResult.actions && Array.isArray(aiResult.actions) && aiResult.actions.length > 0) {
        response.actions = aiResult.actions;
        console.log('Multiple actions detected:', aiResult.actions.length);
      }

      // If action required, prepare action data
      if (aiResult.actionRequired && aiResult.action) {
        response.action = aiResult.action;

        // Also populate eventData for backward compatibility with create_event
        if (aiResult.action.type === 'create_event' && aiResult.action.data) {
          const actionData = aiResult.action.data;
          const startDate = new Date(actionData.start);
          const endDate = new Date(actionData.end);

          response.eventData = {
            title: actionData.title,
            startsAt: startDate.toISOString(),
            endsAt: endDate.toISOString(),
            description: actionData.description || 'Created by Mally AI',
            color: '#3b82f6',
            // Include recurring event properties
            isRecurring: actionData.isRecurring || false,
            recurrenceRule: actionData.recurrenceRule || undefined,
          };
        }
      }

      // Legacy support: if suggestedEvent exists, convert to new format
      if (aiResult.actionRequired && aiResult.suggestedEvent && !aiResult.action) {
        const startDate = new Date(aiResult.suggestedEvent.start);
        const endDate = new Date(aiResult.suggestedEvent.end);

        response.action = {
          type: 'create_event',
          data: {
            title: aiResult.suggestedEvent.title,
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            description: aiResult.suggestedEvent.description || 'Created by Mally AI'
          }
        };

        response.eventData = {
          title: aiResult.suggestedEvent.title,
          startsAt: startDate.toISOString(),
          endsAt: endDate.toISOString(),
          description: aiResult.suggestedEvent.description || 'Created by Mally AI',
          color: '#3b82f6'
        };
      }

      res.json({ result: response });

    } catch (error) {
      console.error('Error processing AI request:', error);
      res.status(500).json({
        error: { message: 'An error occurred while processing your request', status: 'INTERNAL' }
      });
    }
  }
);
