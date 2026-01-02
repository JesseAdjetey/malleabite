"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.processAIRequest = exports.createPortalSession = exports.createCheckoutSession = exports.stripeWebhook = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
const generative_ai_1 = require("@google/generative-ai");
// Export Stripe webhook handlers
var stripe_webhooks_1 = require("./stripe-webhooks");
Object.defineProperty(exports, "stripeWebhook", { enumerable: true, get: function () { return stripe_webhooks_1.stripeWebhook; } });
Object.defineProperty(exports, "createCheckoutSession", { enumerable: true, get: function () { return stripe_webhooks_1.createCheckoutSession; } });
Object.defineProperty(exports, "createPortalSession", { enumerable: true, get: function () { return stripe_webhooks_1.createPortalSession; } });
// Initialize Firebase Admin
admin.initializeApp();
// Define the Gemini API key secret
const geminiApiKey = (0, params_1.defineSecret)('GEMINI_API_KEY');
// Helper to format events for the AI context
const formatEventsForAI = (events) => {
    if (!events || events.length === 0)
        return 'No upcoming events scheduled.';
    return events.map(e => {
        const start = e.start_date?.toDate?.() || e.startsAt?.toDate?.() || (e.startsAt ? new Date(e.startsAt) : null);
        const end = e.end_date?.toDate?.() || e.endsAt?.toDate?.() || (e.endsAt ? new Date(e.endsAt) : null);
        return `- [ID: ${e.id || 'unknown'}] "${e.title}": ${start?.toLocaleString() || 'Unknown'} - ${end?.toLocaleTimeString() || 'Unknown'}`;
    }).join('\n');
};
// Helper to format todos for AI context
const formatTodosForAI = (todos) => {
    if (!todos || todos.length === 0)
        return 'No todos.';
    return todos.map(t => {
        const status = t.completed ? '✓' : '○';
        return `- [ID: ${t.id}] ${status} "${t.text}"`;
    }).join('\n');
};
// Helper to format Eisenhower items for AI context
const formatEisenhowerForAI = (items) => {
    if (!items || items.length === 0)
        return 'No priority items.';
    const quadrantNames = {
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
function getFallbackResponse(message) {
    const lowerMessage = message.toLowerCase();
    const response = {
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
            if (period === 'pm' && hours < 12)
                hours += 12;
            if (period === 'am' && hours === 12)
                hours = 0;
            startTime.setHours(hours, minutes, 0, 0);
        }
        else {
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
exports.processAIRequest = (0, https_1.onRequest)({
    cors: [
        'http://localhost:8080',
        'http://localhost:5173',
        'http://localhost:3000',
        'https://malleabite-97d35.web.app',
        'https://malleabite-97d35.firebaseapp.com',
        'https://malleabite.vercel.app',
        /\.vercel\.app$/ // Allow all Vercel preview deployments
    ],
    region: 'us-central1',
    secrets: [geminiApiKey]
}, async (req, res) => {
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
        }
        catch (error) {
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
        const { message, userId, context: clientContext } = requestData;
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
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
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
            const events = [];
            eventsSnapshot.forEach(doc => events.push({ id: doc.id, ...doc.data() }));
            if (events.length > 0) {
                eventsContext = formatEventsForAI(events);
            }
        }
        catch (dbError) {
            console.warn('Could not fetch events:', dbError);
        }
        // Fetch todos
        try {
            const todosSnapshot = await db.collection('todos')
                .where('userId', '==', userId)
                .limit(30)
                .get();
            const todos = [];
            todosSnapshot.forEach(doc => todos.push({ id: doc.id, ...doc.data() }));
            if (todos.length > 0) {
                todosContext = formatTodosForAI(todos);
            }
        }
        catch (dbError) {
            console.warn('Could not fetch todos:', dbError);
        }
        // Fetch Eisenhower items
        try {
            const eisenhowerSnapshot = await db.collection('eisenhower_items')
                .where('userId', '==', userId)
                .limit(30)
                .get();
            const eisenhowerItems = [];
            eisenhowerSnapshot.forEach(doc => eisenhowerItems.push({ id: doc.id, ...doc.data() }));
            if (eisenhowerItems.length > 0) {
                eisenhowerContext = formatEisenhowerForAI(eisenhowerItems);
            }
        }
        catch (dbError) {
            console.warn('Could not fetch Eisenhower items:', dbError);
        }
        // Fetch alarms
        try {
            const alarmsSnapshot = await db.collection('alarms')
                .where('userId', '==', userId)
                .where('enabled', '==', true)
                .limit(20)
                .get();
            const alarms = [];
            alarmsSnapshot.forEach(doc => alarms.push({ id: doc.id, ...doc.data() }));
            if (alarms.length > 0) {
                alarmsContext = alarms.map(a => {
                    const time = a.time?.toDate?.() || (a.time ? new Date(a.time) : null);
                    const linkedInfo = a.linkedEventId ? ` [Linked to Event ${a.linkedEventId}]` :
                        a.linkedTodoId ? ` [Linked to Todo ${a.linkedTodoId}]` : '';
                    return `- [ID: ${a.id}] "${a.title}": ${time?.toLocaleString() || 'Unknown'}${linkedInfo}`;
                }).join('\n');
            }
        }
        catch (dbError) {
            console.warn('Could not fetch alarms:', dbError);
        }
        // Build conversation history string
        const conversationHistory = clientContext?.conversationHistory || [];
        const historyString = conversationHistory.length > 0
            ? conversationHistory.map(m => `${m.role === 'user' ? 'User' : 'Mally'}: ${m.content}`).join('\n')
            : 'No previous conversation.';
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
2. TODO LIST: Add, complete, delete todos - USE THIS when user mentions tasks, things to do, reminders
3. EISENHOWER MATRIX: Add, update, delete priority items (4 quadrants for prioritization)
4. ALARMS: Create, update, delete alarms and link them to events or todos
5. RECURRING EVENTS: Create events that repeat daily, weekly, monthly, or yearly
6. QUERY: Answer questions about the user's schedule, todos, priorities, or alarms

CRITICAL - BE A SMART PLANNER:
When users ask you to "help plan", "organize my schedule", "set up a routine", or similar planning requests:
1. DON'T ask for specific times unless absolutely necessary
2. BE PROACTIVE - suggest reasonable times based on common sense:
   - Morning routines: 6-9 AM
   - Work/study sessions: 9 AM - 5 PM
   - Lunch: 12-1 PM
   - Exercise/gym: 6-7 AM or 5-7 PM
   - Evening activities: 6-9 PM
   - Sleep/wind down: 9-11 PM
3. CREATE MULTIPLE EVENTS when user asks for multiple things (e.g., "schedule gym, meditation, and reading" = 3 separate events)
4. For recurring activities, CREATE EACH AS A SEPARATE RECURRING EVENT with appropriate times

MULTIPLE EVENTS - IMPORTANT:
When user requests multiple activities, return MULTIPLE actions. Use this format:
{
  "response": "Your message",
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
- "set alarm for X" or "wake me up at X" → Use create_alarm  
- "important", "urgent", "must do" → Suggest create_eisenhower
- "schedule X" or "create meeting" → Use create_event
- "delete", "remove", "cancel" → Use appropriate delete action
- "done", "finished", "completed" about a todo → Use complete_todo
- "plan my day/week", "help me schedule", "set up routine" → Create multiple events with smart defaults

RECURRING EVENT PATTERNS:
- Daily: "every day", "daily"
- Weekly: "every week", "weekly", can specify days like "every Monday and Wednesday"
- Weekdays: "every weekday", "Mon-Fri" → daysOfWeek: [1,2,3,4,5]
- Monthly: "every month", "monthly", can specify day like "15th of every month"
- Yearly: "every year", "annually", like "every January 1st"

USER'S CURRENT DATA:

=== CALENDAR EVENTS ===
${eventsContext}

=== TODO LIST ===
${todosContext}

=== EISENHOWER MATRIX (Priority Items) ===
${eisenhowerContext}

=== ALARMS ===
${alarmsContext}

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
- create_event: { title: string, start: ISO datetime, end: ISO datetime, description?: string, isRecurring?: boolean, recurrenceRule?: { frequency, interval?, daysOfWeek?, dayOfMonth?, monthOfYear?, endDate?, count? } }
- update_event: { eventId: string, title?: string, start?: ISO datetime, end?: ISO datetime }
- delete_event: { eventId: string }
- create_todo: { text: string }
- complete_todo: { todoId: string }
- delete_todo: { todoId: string }
- create_eisenhower: { text: string, quadrant: "urgent_important" | "not_urgent_important" | "urgent_not_important" | "not_urgent_not_important" }
- update_eisenhower: { itemId: string, quadrant: "urgent_important" | "not_urgent_important" | "urgent_not_important" | "not_urgent_not_important" }
- delete_eisenhower: { itemId: string }
- create_alarm: { title: string, time: ISO datetime, linkedEventId?: string, linkedTodoId?: string, repeatDays?: number[] }
- update_alarm: { alarmId: string, title?: string, time?: ISO datetime }
- delete_alarm: { alarmId: string }
- link_alarm: { alarmId: string, linkedEventId?: string, linkedTodoId?: string }

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
        }
        catch (parseError) {
            console.error('Failed to parse Gemini response:', parseError);
            aiResult = {
                response: responseText,
                actionRequired: false,
                intent: 'general'
            };
        }
        // Build response
        const response = {
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
    }
    catch (error) {
        console.error('Error processing AI request:', error);
        res.status(500).json({
            error: { message: 'An error occurred while processing your request', status: 'INTERNAL' }
        });
    }
});
//# sourceMappingURL=index.js.map