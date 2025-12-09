import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

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
    cors: ['http://localhost:8080', 'http://localhost:5173', 'http://localhost:3000', 'https://malleabite-97d35.web.app', 'https://malleabite-97d35.firebaseapp.com'],
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

      // Build conversation history string
      const conversationHistory = clientContext?.conversationHistory || [];
      const historyString = conversationHistory.length > 0
        ? conversationHistory.map(m => `${m.role === 'user' ? 'User' : 'Mally'}: ${m.content}`).join('\n')
        : 'No previous conversation.';

      // Generate AI response with Gemini
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const systemPrompt = `
You are Mally, an intelligent and friendly productivity assistant for a calendar app called Malleabite.
Current Date/Time: ${clientContext?.currentTime || new Date().toISOString()}
User Timezone: ${clientContext?.timeZone || 'UTC'}

YOUR CAPABILITIES:
1. CALENDAR EVENTS: Create, update, delete calendar events (including recurring events)
2. TODO LIST: Add, complete, delete todos
3. EISENHOWER MATRIX: Add, update, delete priority items (4 quadrants: urgent_important, not_urgent_important, urgent_not_important, not_urgent_not_important)
4. ALARMS: Create, update, delete, link alarms to events or todos
5. RECURRING EVENTS: Create events that repeat daily, weekly, monthly, or yearly
6. QUERY: Answer questions about the user's schedule, todos, priorities, or alarms

RECURRING EVENT PATTERNS:
- Daily: "every day", "daily"
- Weekly: "every week", "weekly", can specify days like "every Monday and Wednesday"
- Monthly: "every month", "monthly", can specify day like "15th of every month"
- Yearly: "every year", "annually", like "every January 1st"
- Custom intervals: "every 2 weeks", "every 3 days"

USER'S CURRENT DATA:

=== CALENDAR EVENTS ===
${eventsContext}

=== TODO LIST ===
${todosContext}

=== EISENHOWER MATRIX (Priority Items) ===
${eisenhowerContext}

=== ALARMS ===
${alarmsContext}

=== PREVIOUS CONVERSATION ===
${historyString}

INSTRUCTIONS:
1. Analyze the user's message AND conversation history to understand intent
2. Determine which action type is needed
3. For follow-up messages like "yes", "ok", "delete it", "mark it done", refer to previous conversation
4. Be conversational and helpful
5. When user confirms an action, execute it immediately

Return a JSON object with this EXACT structure (no markdown, just raw JSON):
{
  "response": "Your friendly response to the user",
  "actionRequired": true or false,
  "intent": "create_event" | "update_event" | "delete_event" | "create_todo" | "complete_todo" | "delete_todo" | "create_eisenhower" | "update_eisenhower" | "delete_eisenhower" | "create_alarm" | "update_alarm" | "delete_alarm" | "link_alarm" | "query" | "confirmation" | "general",
  "action": {
    "type": "create_event" | "update_event" | "delete_event" | "create_todo" | "complete_todo" | "delete_todo" | "create_eisenhower" | "update_eisenhower" | "delete_eisenhower" | "create_alarm" | "update_alarm" | "delete_alarm" | "link_alarm",
    "data": {
      // For events: { title, start, end, description }
      // For update/delete events: { eventId, title?, start?, end? }
      // For todos: { text } or { todoId }
      // For eisenhower: { text, quadrant } or { itemId, quadrant? }
      // For alarms: { title, time, linkedEventId?, linkedTodoId? }
    }
  }
}

ACTION DATA FORMATS:
- create_event: { title: string, start: ISO datetime, end: ISO datetime, description?: string, isRecurring?: boolean, recurrenceRule?: { frequency: "daily" | "weekly" | "monthly" | "yearly", interval?: number, daysOfWeek?: number[], dayOfMonth?: number, monthOfYear?: number, endDate?: ISO date, count?: number } }
- update_event: { eventId: string, title?: string, start?: ISO datetime, end?: ISO datetime }
- delete_event: { eventId: string }
- create_todo: { text: string }
- complete_todo: { todoId: string }
- delete_todo: { todoId: string }
- create_eisenhower: { text: string, quadrant: "urgent_important" | "not_urgent_important" | "urgent_not_important" | "not_urgent_not_important" }
- update_eisenhower: { itemId: string, quadrant: "urgent_important" | "not_urgent_important" | "urgent_not_important" | "not_urgent_not_important" }
- delete_eisenhower: { itemId: string }
- create_alarm: { title: string, time: ISO datetime, linkedEventId?: string, linkedTodoId?: string }
- update_alarm: { alarmId: string, title?: string, time?: ISO datetime }
- delete_alarm: { alarmId: string }
- link_alarm: { alarmId: string, linkedEventId?: string, linkedTodoId?: string }

RECURRENCE RULE EXAMPLES:
- Daily: { frequency: "daily", interval: 1 }
- Every 2 days: { frequency: "daily", interval: 2 }
- Weekly on Mon/Wed/Fri: { frequency: "weekly", daysOfWeek: [1, 3, 5] }
- Monthly on 15th: { frequency: "monthly", dayOfMonth: 15 }
- Yearly on Jan 1st: { frequency: "yearly", monthOfYear: 0, dayOfMonth: 1 }
- With end date: Add "endDate": "2025-12-31"
- With occurrence count: Add "count": 10

QUADRANT MEANINGS:
- urgent_important = Do First (crisis, deadlines)
- not_urgent_important = Schedule (goals, planning)
- urgent_not_important = Delegate (interruptions)
- not_urgent_not_important = Eliminate (time wasters)

Notes:
- Only include "action" if actionRequired is true
- For confirmation intents, set actionRequired to true and include the action from previous suggestion
- Default event duration is 1 hour if not specified
- When deleting, ask for confirmation first unless user explicitly says "delete"
- Match item IDs carefully from the user's existing data
`;

      const result = await model.generateContent([systemPrompt, `User message: ${message}`]);
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
        eventData: null, // Keep for backward compatibility
        conflicts: []
      };

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
            color: '#3b82f6'
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
