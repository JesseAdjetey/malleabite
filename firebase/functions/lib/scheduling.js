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
exports.processSchedulingStream = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
const generative_ai_1 = require("@google/generative-ai");
const geminiApiKey = (0, params_1.defineSecret)('GEMINI_API_KEY');
// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatEventsForAI = (events) => {
    if (!events || events.length === 0)
        return 'No events scheduled in the next 30 days.';
    return events.map(e => {
        let start, end;
        if (e.startsAt?.toDate) {
            start = e.startsAt.toDate();
        }
        else if (e.startsAt) {
            start = new Date(e.startsAt);
        }
        if (e.endsAt?.toDate) {
            end = e.endsAt.toDate();
        }
        else if (e.endsAt) {
            end = new Date(e.endsAt);
        }
        if (!start || !end)
            return null;
        const dateStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        return `- "${e.title}" on ${dateStr} from ${startTime} to ${endTime} (ID: ${e.id})`;
    }).filter(Boolean).join('\n');
};
const normalizeActions = (rawActions) => rawActions.map(op => {
    const type = op.type;
    const data = op.data || {};
    if (type === 'create_event') {
        return { type, data: { title: data.title, start: data.start, end: data.end, description: data.description || 'Created by Mally', isRecurring: data.isRecurring || false, recurrenceRule: data.recurrenceRule || null } };
    }
    else if (type === 'move_event' || type === 'update_event') {
        return { type: 'update_event', data: { eventId: data.eventId, start: data.newStart || data.start, end: data.newEnd || data.end, title: data.title } };
    }
    else if (type === 'create_todo_list') {
        return { type, data: { name: data.name } };
    }
    else if (type === 'create_todo' || type === 'add_todo_to_list') {
        return { type: 'create_todo', data: { text: data.text || data.content, listName: data.listName } };
    }
    else if (type === 'create_alarm') {
        return { type, data: { title: data.title, time: data.time } };
    }
    else if (type === 'archive_calendar') {
        return { type, data: { folderName: data.folderName || 'Archived Calendar' } };
    }
    else if (type === 'start_pomodoro' || type === 'stop_pomodoro') {
        return { type, data: {} };
    }
    return op;
});
// ─── Streaming endpoint ───────────────────────────────────────────────────────
// Output format uses a simple separator so speech text can stream before JSON:
//   SPEECH: <conversational text>
//   ---
//   <json actions>
exports.processSchedulingStream = (0, https_1.onRequest)({
    cors: true,
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 120,
    minInstances: 1,
    secrets: [geminiApiKey],
}, async (req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    // Authenticate via Bearer token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    try {
        await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
    }
    catch {
        res.status(401).json({ error: 'Invalid token' });
        return;
    }
    const { userMessage, userId, context: clientContext, history = [] } = req.body;
    if (!userMessage || !userId) {
        res.status(400).json({ error: 'Missing fields' });
        return;
    }
    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
    try {
        const db = admin.firestore();
        const now = new Date();
        const startRange = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endRange = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const snap = await db.collection('calendar_events')
            .where('userId', '==', userId)
            .where('startsAt', '>=', admin.firestore.Timestamp.fromDate(startRange))
            .where('startsAt', '<=', admin.firestore.Timestamp.fromDate(endRange))
            .where('isArchived', '==', false)
            .orderBy('startsAt', 'asc').limit(50).get();
        const events = [];
        snap.forEach(doc => events.push({ id: doc.id, ...doc.data() }));
        const eventsContext = formatEventsForAI(events);
        const genAI = new generative_ai_1.GoogleGenerativeAI(geminiApiKey.value());
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const systemPrompt = `You are Mally, a warm and intelligent scheduling assistant.
Current Time: ${clientContext?.currentTime || new Date().toISOString()}
User Timezone: ${clientContext?.timeZone || 'UTC'}

EXISTING EVENTS:
${eventsContext || 'No events scheduled.'}

OUTPUT FORMAT — follow this EXACTLY, no deviations:

SPEECH: [Your conversational spoken response — friendly, natural, 1-3 sentences, no markdown, no asterisks]
---
{"actionRequired": boolean, "intent": "scheduling|task_management|pomodoro_control|query|general", "actions": [...]}

CAPABILITIES:
- Pomodoro: {"type":"start_pomodoro","data":{}} or {"type":"stop_pomodoro","data":{}}
- Events: {"type":"create_event","data":{"title":"...","start":"ISO8601","end":"ISO8601","isRecurring":false}}
- Update event: {"type":"update_event","data":{"eventId":"...","start":"ISO8601","end":"ISO8601"}}  
- Todos: {"type":"create_todo","data":{"text":"...","listName":"..."}}
- Alarms: {"type":"create_alarm","data":{"title":"...","time":"HH:mm"}}

RULES:
- "start pomodoro" = start timer NOW (no calendar event)
- Resolve pronouns (it/this/that) from conversation history
- Check for conflicts in existing events; suggest alternatives
- Default event duration: 1 hour
- ALWAYS include both SPEECH: and --- and JSON`;
        const formattedHistory = history.map(h => ({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.parts }]
        }));
        const chat = model.startChat({
            history: formattedHistory,
            systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] }
        });
        const result = await chat.sendMessageStream(userMessage);
        let fullText = '';
        let speechText = '';
        let separatorFound = false;
        for await (const chunk of result.stream) {
            const chunkText = chunk.text();
            fullText += chunkText;
            if (!separatorFound) {
                if (fullText.includes('---')) {
                    separatorFound = true;
                    const beforeSep = fullText.split('---')[0];
                    const full = beforeSep.replace(/^SPEECH:\s*/i, '').trim();
                    const newPart = full.slice(speechText.length);
                    if (newPart) {
                        send({ type: 'speech', text: newPart });
                        speechText = full;
                    }
                    send({ type: 'speech_done' });
                }
                else {
                    const stripped = fullText.replace(/^SPEECH:\s*/i, '');
                    const newPart = stripped.slice(speechText.length);
                    if (newPart) {
                        send({ type: 'speech', text: newPart });
                        speechText = stripped;
                    }
                }
            }
            // After separator: accumulate JSON — don't stream it
        }
        // Parse actions from accumulated JSON
        let actions = [], intent = 'general', actionRequired = false;
        try {
            const jsonPart = (fullText.split('---')[1] || '{}').trim();
            const parsed = JSON.parse(jsonPart.replace(/```json/g, '').replace(/```/g, ''));
            intent = parsed.intent || 'general';
            actionRequired = parsed.actionRequired || false;
            actions = normalizeActions(parsed.actions || []);
        }
        catch (e) {
            console.warn('Failed to parse streaming actions JSON:', e.message);
        }
        const finalSpeechText = speechText || fullText.split('---')[0].replace(/^SPEECH:\s*/i, '').trim();
        send({ type: 'done', speechText: finalSpeechText, actions, intent, actionRequired });
        res.end();
    }
    catch (error) {
        console.error('processSchedulingStream error:', error);
        send({ type: 'error', message: error.message });
        res.end();
    }
});
//# sourceMappingURL=scheduling.js.map