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
  type: 'create_event' | 'create_todo';
  title?: string;
  start?: string;
  end?: string;
  description?: string;
  isAllDay?: boolean;
  text?: string;
  listName?: string;
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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Load user context
    const [events, todos, userName] = await Promise.all([
      loadUpcomingEvents(userId),
      loadTodos(userId),
      loadUserName(userId),
    ]);

    const now = new Date();
    const systemPrompt = buildSystemPrompt(now, userName, events, todos);

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
  todos: any[]
): string {
  return `You are Mally, an AI assistant for the Malleabite calendar app, responding via WhatsApp.

Current date & time: ${now.toISOString()}
User: ${userName || 'User'}

YOUR ROLE:
You help users quickly capture events and todos from WhatsApp. Be friendly but concise.

TONE:
- Friendly, concise, helpful
- Use WhatsApp formatting: *bold*, _italic_
- Keep messages short (1-3 lines for confirmations, brief for chat)
- Never be overly enthusiastic or use too many emojis

WHEN THE USER WANTS TO CREATE AN EVENT:
- Extract: title, date, time, duration
- If date/time is MISSING, ask for it. Don't assume. Say something like "What date and time?"
- If you have enough info, output the action block below
- ALWAYS include the action block when you have enough info to create

WHEN THE USER WANTS TO CREATE A TODO:
- Extract: task text, optional list name
- Output the action block below
- Don't ask for a list name unless the user mentions one

WHEN THE USER SENDS GENERAL CHAT (greetings, jokes, questions, random):
- Respond briefly and naturally
- End with a gentle nudge like "Need to add anything to your schedule?"
- Do NOT create action blocks for non-actionable messages

WHEN THE USER ASKS ABOUT THEIR SCHEDULE:
- Answer from the context below
- Be specific with dates/times

USER'S UPCOMING EVENTS (next 7 days):
${formatEvents(events)}

USER'S PENDING TODOS:
${formatTodos(todos)}

ACTION BLOCKS:
When you have enough info to create something, include ONE action block at the END of your message:

For events:
\`\`\`action
{"type": "create_event", "title": "Meeting with Sarah", "start": "2026-03-08T14:00:00", "end": "2026-03-08T15:00:00"}
\`\`\`

For todos:
\`\`\`action
{"type": "create_todo", "text": "Buy groceries", "listName": "Shopping"}
\`\`\`

IMPORTANT: The action will NOT be executed immediately — the user will be asked to confirm first. So your text response should NOT say "I've created..." or "Done!". Instead, the text before the action block is informational context only. Keep it very short or empty if the action block says it all.`;
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
      return `- "${e.title}" at ${start?.toLocaleString() || 'unknown time'}`;
    })
    .join('\n');
}

function formatTodos(todos: any[]): string {
  if (!todos.length) return 'No pending todos.';
  return todos.map((t) => `- "${t.text}"`).join('\n');
}
