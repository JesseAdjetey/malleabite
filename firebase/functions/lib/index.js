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
exports.processAIRequest = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
const generative_ai_1 = require("@google/generative-ai");
// Initialize Firebase Admin
admin.initializeApp();
// Define the Gemini API key secret
const geminiApiKey = (0, params_1.defineSecret)('GEMINI_API_KEY');
// Helper to format events for the AI context
const formatEventsForAI = (events) => {
    return events.map(e => {
        const start = e.start_date?.toDate?.() || e.startsAt?.toDate?.() || (e.startsAt ? new Date(e.startsAt) : null);
        const end = e.end_date?.toDate?.() || e.endsAt?.toDate?.() || (e.endsAt ? new Date(e.endsAt) : null);
        return `${e.title}: ${start?.toLocaleString() || 'Unknown'} - ${end?.toLocaleString() || 'Unknown'}`;
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
    cors: ['http://localhost:8080', 'http://localhost:5173', 'http://localhost:3000', 'https://malleabite-97d35.web.app', 'https://malleabite-97d35.firebaseapp.com'],
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
        try {
            const eventsSnapshot = await db.collection('calendar_events')
                .where('userId', '==', userId)
                .limit(20)
                .get();
            const events = [];
            eventsSnapshot.forEach(doc => events.push(doc.data()));
            if (events.length > 0) {
                eventsContext = formatEventsForAI(events);
            }
        }
        catch (dbError) {
            console.warn('Could not fetch events:', dbError);
        }
        // Build conversation history string
        const conversationHistory = clientContext?.conversationHistory || [];
        const historyString = conversationHistory.length > 0
            ? conversationHistory.map(m => `${m.role === 'user' ? 'User' : 'Mally'}: ${m.content}`).join('\n')
            : 'No previous conversation.';
        // Generate AI response with Gemini
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const systemPrompt = `
You are Mally, an intelligent and friendly scheduling assistant for a calendar app called Malleabite.
Current Date/Time: ${clientContext?.currentTime || new Date().toISOString()}
User Timezone: ${clientContext?.timeZone || 'UTC'}

Your capabilities:
- Create, modify, and manage calendar events
- Understand natural language scheduling requests
- Detect conflicts with existing events
- Answer questions about the user's schedule
- Handle follow-up requests like "call it X instead" or "make it 2 hours"
- Remember context from the conversation history below

User's Existing Events:
${eventsContext}

Previous Conversation:
${historyString}

INSTRUCTIONS:
1. Analyze the user's message AND the conversation history to understand their intent
2. If they want to create/modify an event, extract all relevant details (title, date, time, duration)
3. For follow-up messages like "yeah", "ok", "call it X instead", "make it longer", refer to the previous conversation to understand what they're confirming or modifying
4. For ambiguous requests, make reasonable assumptions but mention them
5. Be conversational and helpful
6. If there's a scheduling conflict, mention it but still offer to create the event if they want
7. When user confirms (says "yes", "yeah", "ok", "sure", "confirm"), include the event from the previous suggestion

Return a JSON object with this EXACT structure (no markdown, just raw JSON):
{
  "response": "Your friendly response to the user",
  "actionRequired": true or false,
  "intent": "scheduling" | "query" | "modification" | "confirmation" | "general",
  "suggestedEvent": {
    "title": "Event title",
    "start": "ISO 8601 datetime string",
    "end": "ISO 8601 datetime string", 
    "description": "Optional description"
  }
}

Notes:
- Only include "suggestedEvent" if actionRequired is true
- For "confirmation" intent (user saying yes/ok to a previous suggestion), set actionRequired to true and include the event details from the previous conversation
- For "modification" intent, include the modified event details
- Default event duration is 1 hour if not specified
- Use the current date/time provided above for relative time calculations (tomorrow, next week, etc.)
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
            eventData: null,
            conflicts: []
        };
        // If action required, prepare event data
        if (aiResult.actionRequired && aiResult.suggestedEvent) {
            const startDate = new Date(aiResult.suggestedEvent.start);
            const endDate = new Date(aiResult.suggestedEvent.end);
            response.eventData = {
                title: aiResult.suggestedEvent.title,
                startsAt: startDate.toISOString(),
                endsAt: endDate.toISOString(),
                description: aiResult.suggestedEvent.description || `Created by Mally AI`,
                color: '#3b82f6'
            };
            response.suggestedEvent = {
                ...aiResult.suggestedEvent,
                startFormatted: startDate.toLocaleString(),
                endFormatted: endDate.toLocaleTimeString()
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