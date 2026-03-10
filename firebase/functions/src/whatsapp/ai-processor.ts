/**
 * AI Processor for WhatsApp
 *
 * Key difference from previous version:
 *   Actions are PROPOSED, not executed. The message handler stores them
 *   as pending actions and asks for user confirmation first.
 *
 * Handles:
 *   - Event/todo creation intent → returns proposed action
 *   - Missing info → asks follow-up question
 *   - General chat → brief friendly reply + nudge
 *   - Schedule questions → answers from user data
 */
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

const db = () => admin.firestore();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AIResponse {
  text?: string;
  actions?: ProposedAction[];
  error?: string;
}

export interface ProposedAction {
  type:
    | 'create_event' | 'update_event' | 'delete_event'
    | 'create_todo' | 'complete_todo' | 'delete_todo'
    | 'create_alarm' | 'delete_alarm'
    | 'create_eisenhower'
    | 'create_goal';
  // Event fields
  title?: string;
  start?: string;
  end?: string;
  description?: string;
  isAllDay?: boolean;
  eventId?: string;
  // Todo fields
  text?: string;
  listName?: string;
  todoId?: string;
  // Alarm fields
  alarmId?: string;
  time?: string;
  // Eisenhower fields
  quadrant?: 'urgent-important' | 'not-urgent-important' | 'urgent-not-important' | 'not-urgent-not-important';
  // Goal fields
  category?: string;
  frequency?: 'daily' | 'weekly' | 'monthly';
  target?: number;
}

// ─── Main Entry ───────────────────────────────────────────────────────────────

export async function processAIRequestInternal(
  userId: string,
  message: string,
  chatHistory?: { role: 'user' | 'model'; text: string }[]
): Promise<AIResponse> {
  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      console.error('GEMINI_API_KEY not found in process.env');
      return { error: 'AI is not configured. Please try again later.' };
    }

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      // Native Google Search grounding — gives the bot real-time internet access
      // for news, weather, stocks, flights, facts, etc. without any extra API keys.
      tools: [{ googleSearch: {} } as any],
    });

    // Load user context
    const [events, todos, alarms, eisenhower, userName] = await Promise.all([
      loadUpcomingEvents(userId),
      loadTodos(userId),
      loadAlarms(userId),
      loadEisenhower(userId),
      loadUserName(userId),
    ]);

    const now = new Date();
    const systemPrompt = buildSystemPrompt(now, userName, events, todos, alarms, eisenhower);

    // Build conversation contents with history
    const contents: { role: string; parts: { text: string }[] }[] = [];

    // Add previous conversation turns
    if (chatHistory && chatHistory.length > 0) {
      for (const msg of chatHistory) {
        contents.push({ role: msg.role, parts: [{ text: msg.text }] });
      }
    }

    // Add current user message
    contents.push({ role: 'user', parts: [{ text: message }] });

    const result = await model.generateContent({
      contents,
      systemInstruction: { role: 'model', parts: [{ text: systemPrompt }] },
    });

    const responseText = result.response.text();

    // Parse proposed actions (NOT executed — just returned)
    const actions = parseActions(responseText);

    // Clean response text (remove action blocks)
    const cleanText = responseText.replace(/```action\n[\s\S]*?```/g, '').trim();

    return { text: cleanText, actions };
  } catch (error: unknown) {
    const err = error as Error;
    console.error('AI processing error:', err.message, err.stack);
    console.error('Full error:', JSON.stringify(error, null, 2));
    return { error: 'Something went wrong. Try again!' };
  }
}

// ─── System Prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(
  now: Date,
  userName: string | null,
  events: any[],
  todos: any[],
  alarms: any[],
  eisenhower: any[]
): string {
  return `You are Mally, an AI assistant for the Malleabite productivity app, responding via WhatsApp.

Current date & time: ${now.toISOString()}
User: ${userName || 'User'}

YOUR ROLE:
You help users manage their full productivity life via WhatsApp — events, todos, alarms, priorities, and goals. Be concise and action-oriented.

TONE:
- Friendly, concise, direct
- Use WhatsApp formatting: *bold*, _italic_
- Keep messages short (1-3 lines for confirmations)
- Never be overly enthusiastic

CAPABILITIES — you can propose ALL of these actions:
1. *Events*: create, update (reschedule/rename), delete
2. *Todos*: create, complete, delete
3. *Alarms*: create, delete
4. *Priorities (Eisenhower matrix)*: add items to urgent/important quadrants
5. *Goals*: create with category and frequency
6. *Real-time info*: weather, news, stocks, flights (use Google Search)

RULES:
- If info is missing (date, time, title), ask ONE short question
- For deletions/updates: ask for the item name, match it from context below, then include the ID in the action block
- For real-world questions use Google Search — keep answers WhatsApp-short (2-3 lines)
- For chat/greetings: reply briefly, end with "Need to add anything?"

USER'S CONTEXT:

*Upcoming Events (next 7 days):*
${formatEvents(events)}

*Pending Todos:*
${formatTodos(todos)}

*Active Alarms:*
${formatAlarms(alarms)}

*Priority Items (Eisenhower):*
${formatEisenhower(eisenhower)}

ACTION BLOCKS — include ONE at the END of your message when you have enough info:

Create event:
\`\`\`action
{"type":"create_event","title":"Meeting with Sarah","start":"2026-03-08T14:00:00","end":"2026-03-08T15:00:00"}
\`\`\`

Update event (use ID from context above):
\`\`\`action
{"type":"update_event","eventId":"abc123","start":"2026-03-09T14:00:00","end":"2026-03-09T15:00:00"}
\`\`\`

Delete event:
\`\`\`action
{"type":"delete_event","eventId":"abc123"}
\`\`\`

Create todo:
\`\`\`action
{"type":"create_todo","text":"Buy groceries","listName":"Shopping"}
\`\`\`

Complete todo:
\`\`\`action
{"type":"complete_todo","todoId":"abc123"}
\`\`\`

Delete todo:
\`\`\`action
{"type":"delete_todo","todoId":"abc123"}
\`\`\`

Create alarm:
\`\`\`action
{"type":"create_alarm","title":"Wake up","time":"07:00"}
\`\`\`

Delete alarm:
\`\`\`action
{"type":"delete_alarm","alarmId":"abc123"}
\`\`\`

Add to Eisenhower priority matrix:
\`\`\`action
{"type":"create_eisenhower","text":"Prepare quarterly report","quadrant":"urgent-important"}
\`\`\`
Quadrants: urgent-important | not-urgent-important | urgent-not-important | not-urgent-not-important

Create goal:
\`\`\`action
{"type":"create_goal","title":"Run 5km","category":"health","frequency":"daily","target":1}
\`\`\`

IMPORTANT: Actions are NOT executed until user confirms. Your text response should NOT say "Done!" — keep it short and let the action block speak for itself.`;
}

// ─── Parse Action Blocks ──────────────────────────────────────────────────────

function parseActions(text: string): ProposedAction[] {
  const actions: ProposedAction[] = [];
  const regex = /```action\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      actions.push(JSON.parse(match[1].trim()));
    } catch {
      console.warn('Failed to parse action block:', match[1]);
    }
  }
  return actions;
}

// ─── Data Loaders ─────────────────────────────────────────────────────────────

async function loadUpcomingEvents(userId: string): Promise<any[]> {
  const now = new Date();
  const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const snap = await db()
    .collection('calendar_events')
    .where('userId', '==', userId)
    .where('startsAt', '>=', admin.firestore.Timestamp.fromDate(now))
    .where('startsAt', '<=', admin.firestore.Timestamp.fromDate(weekLater))
    .orderBy('startsAt', 'asc')
    .limit(20)
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function loadTodos(userId: string): Promise<any[]> {
  const snap = await db()
    .collection('todos')
    .where('userId', '==', userId)
    .where('completed', '==', false)
    .limit(20)
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function loadAlarms(userId: string): Promise<any[]> {
  try {
    const snap = await db()
      .collection('alarms')
      .where('userId', '==', userId)
      .where('enabled', '==', true)
      .limit(10)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

async function loadEisenhower(userId: string): Promise<any[]> {
  try {
    const snap = await db()
      .collection('eisenhower_items')
      .where('userId', '==', userId)
      .limit(20)
      .get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

async function loadUserName(userId: string): Promise<string | null> {
  const doc = await db().collection('users').doc(userId).get();
  const data = doc.data();
  return data?.displayName || data?.name || null;
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatEvents(events: any[]): string {
  if (!events.length) return 'No upcoming events.';
  return events
    .map((e) => {
      const start = e.startsAt?.toDate?.();
      return `- [ID: ${e.id}] "${e.title}" at ${start?.toLocaleString() || 'unknown time'}`;
    })
    .join('\n');
}

function formatTodos(todos: any[]): string {
  if (!todos.length) return 'No pending todos.';
  return todos.map((t) => `- [ID: ${t.id}] "${t.text}"`).join('\n');
}

function formatAlarms(alarms: any[]): string {
  if (!alarms.length) return 'No active alarms.';
  return alarms.map((a) => {
    const time = a.time?.toDate?.() || (a.time ? new Date(a.time) : null);
    return `- [ID: ${a.id}] "${a.title}" at ${time?.toLocaleTimeString() || 'unknown'}`;
  }).join('\n');
}

function formatEisenhower(items: any[]): string {
  if (!items.length) return 'No priority items.';
  return items.map((i) => `- [ID: ${i.id}] "${i.text}" (${i.quadrant || 'unset'})`).join('\n');
}
