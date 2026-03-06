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
exports.processAIRequestInternal = processAIRequestInternal;
/**
 * AI Processor — wraps the Gemini AI logic for WhatsApp messages.
 * Reuses the same AI context loading (events, todos, memory) as the main processAIRequest function.
 */
const admin = __importStar(require("firebase-admin"));
const generative_ai_1 = require("@google/generative-ai");
const db = () => admin.firestore();
/** Lightweight AI processor for WhatsApp messages */
async function processAIRequestInternal(userId, message) {
    try {
        // Get the Gemini API key from environment / secret
        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey) {
            return { error: 'AI is not configured. Please try again later.' };
        }
        const genAI = new generative_ai_1.GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        // Load user context from Firestore
        const [events, todos, memory, userName] = await Promise.all([
            loadUpcomingEvents(userId),
            loadTodos(userId),
            loadUserMemory(userId),
            loadUserName(userId),
        ]);
        const now = new Date();
        const systemPrompt = `You are Mally, an AI calendar and productivity assistant for the Malleabite app, responding via WhatsApp.

Current date & time: ${now.toISOString()}
User: ${userName || 'User'}

IMPORTANT RULES FOR WHATSAPP:
- Keep responses concise — WhatsApp messages should be short and scannable
- Use WhatsApp formatting: *bold*, _italic_, ~strikethrough~, \`code\`
- Use bullet points (•) for lists
- Maximum 2-3 paragraphs unless the user asks for detail
- Be friendly but efficient

USER'S UPCOMING EVENTS:
${formatEvents(events)}

USER'S TODOS:
${formatTodos(todos)}

USER'S MEMORY/PREFERENCES:
${JSON.stringify(memory, null, 2)}

CAPABILITIES — you can help with:
1. Creating calendar events (respond with JSON action block)
2. Creating todos (respond with JSON action block)
3. Viewing schedule information
4. Answering questions about their calendar/tasks
5. General productivity advice

When the user wants to CREATE an event or todo, include a JSON action block at the END of your message like:
\`\`\`action
{"type": "create_event", "title": "Meeting", "start": "2026-03-07T14:00:00", "end": "2026-03-07T15:00:00"}
\`\`\`
or
\`\`\`action
{"type": "create_todo", "text": "Buy groceries", "listName": "Shopping"}
\`\`\`

Always confirm what you're doing in plain text BEFORE the action block.`;
        const result = await model.generateContent({
            contents: [
                { role: 'user', parts: [{ text: message }] },
            ],
            systemInstruction: { role: 'model', parts: [{ text: systemPrompt }] },
        });
        const responseText = result.response.text();
        // Parse action blocks
        const actions = parseActions(responseText);
        // Execute actions if present
        for (const action of actions) {
            await executeAction(userId, action);
        }
        // Remove action blocks from the displayed text
        const cleanText = responseText
            .replace(/```action\n[\s\S]*?```/g, '')
            .trim();
        return { text: cleanText, actions };
    }
    catch (error) {
        console.error('AI processing error:', error);
        return { error: 'Something went wrong with the AI. Try again!' };
    }
}
// ─── Parse action blocks from AI response ─────────────────────────────────────
function parseActions(text) {
    const actions = [];
    const actionRegex = /```action\n([\s\S]*?)```/g;
    let match;
    while ((match = actionRegex.exec(text)) !== null) {
        try {
            actions.push(JSON.parse(match[1].trim()));
        }
        catch {
            console.warn('Failed to parse action block:', match[1]);
        }
    }
    return actions;
}
// ─── Execute parsed actions ───────────────────────────────────────────────────
async function executeAction(userId, action) {
    try {
        if (action.type === 'create_event') {
            await db().collection('calendar_events').add({
                user_id: userId,
                title: action.title || 'Untitled Event',
                start_date: admin.firestore.Timestamp.fromDate(new Date(action.start)),
                end_date: action.end
                    ? admin.firestore.Timestamp.fromDate(new Date(action.end))
                    : admin.firestore.Timestamp.fromDate(new Date(new Date(action.start).getTime() + 60 * 60 * 1000)),
                description: action.description || '',
                color: action.color || '#6C63FF',
                source: 'whatsapp',
                is_all_day: action.isAllDay || false,
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else if (action.type === 'create_todo') {
            // Try to find or create the target list
            let listId = null;
            if (action.listName) {
                const listsSnap = await db()
                    .collection('todo_lists')
                    .where('userId', '==', userId)
                    .where('name', '==', action.listName)
                    .limit(1)
                    .get();
                if (!listsSnap.empty) {
                    listId = listsSnap.docs[0].id;
                }
                else {
                    // Create the list
                    const newList = await db().collection('todo_lists').add({
                        userId,
                        name: action.listName,
                        itemCount: 0,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                    listId = newList.id;
                }
            }
            if (listId) {
                await db().collection('todo_items').add({
                    userId,
                    listId,
                    text: action.text || 'New task',
                    completed: false,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                // Increment item count
                await db()
                    .collection('todo_lists')
                    .doc(listId)
                    .update({
                    itemCount: admin.firestore.FieldValue.increment(1),
                });
            }
            else {
                // Fallback to top-level todos collection
                await db().collection('todos').add({
                    user_id: userId,
                    text: action.text || 'New task',
                    completed: false,
                    created_at: admin.firestore.FieldValue.serverTimestamp(),
                });
            }
        }
    }
    catch (error) {
        console.error('Failed to execute action:', action.type, error);
    }
}
// ─── Data Loaders ─────────────────────────────────────────────────────────────
async function loadUpcomingEvents(userId) {
    const now = new Date();
    const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const snapshot = await db()
        .collection('calendar_events')
        .where('user_id', '==', userId)
        .where('start_date', '>=', admin.firestore.Timestamp.fromDate(now))
        .where('start_date', '<=', admin.firestore.Timestamp.fromDate(weekLater))
        .orderBy('start_date', 'asc')
        .limit(20)
        .get();
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}
async function loadTodos(userId) {
    const snapshot = await db()
        .collection('todos')
        .where('user_id', '==', userId)
        .where('completed', '==', false)
        .limit(20)
        .get();
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}
async function loadUserMemory(userId) {
    const doc = await db().collection('ai_memory').doc(userId).get();
    return doc.exists ? doc.data() : {};
}
async function loadUserName(userId) {
    const doc = await db().collection('users').doc(userId).get();
    const data = doc.data();
    return data?.displayName || data?.name || null;
}
// ─── Formatters ───────────────────────────────────────────────────────────────
function formatEvents(events) {
    if (!events.length)
        return 'No upcoming events this week.';
    return events
        .map((e) => {
        const start = e.start_date?.toDate?.();
        return `- "${e.title}" at ${start?.toLocaleString() || 'unknown time'}`;
    })
        .join('\n');
}
function formatTodos(todos) {
    if (!todos.length)
        return 'No pending todos.';
    return todos
        .map((t) => `- ${t.completed ? '[done]' : '[todo]'} "${t.text}"`)
        .join('\n');
}
//# sourceMappingURL=ai-processor.js.map