import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

const geminiApiKey = defineSecret('GEMINI_API_KEY');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatEventsForAI = (events: any[]): string => {
  if (!events || events.length === 0) return 'No events scheduled in the next 30 days.';
  return events.map(e => {
    let start: Date | undefined, end: Date | undefined;
    if (e.startsAt?.toDate) { start = e.startsAt.toDate(); }
    else if (e.startsAt) { start = new Date(e.startsAt); }
    if (e.endsAt?.toDate) { end = e.endsAt.toDate(); }
    else if (e.endsAt) { end = new Date(e.endsAt); }
    if (!start || !end) return null;
    const dateStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `- "${e.title}" on ${dateStr} from ${startTime} to ${endTime} (ID: ${e.id})`;
  }).filter(Boolean).join('\n');
};

const normalizeActions = (rawActions: any[]) => rawActions.map(op => {
  const type: string = op.type;
  // Gemini sometimes omits the `data` wrapper — fall back to the op itself
  const data = op.data || op;
  if (type === 'create_event') {
    return { type, data: { title: data.title, start: data.start, end: data.end, description: data.description || 'Created by Mally', isRecurring: data.isRecurring || false, recurrenceRule: data.recurrenceRule || null } };
  } else if (type === 'move_event' || type === 'update_event') {
    return { type: 'update_event', data: { eventId: data.eventId, start: data.newStart || data.start, end: data.newEnd || data.end, title: data.title } };
  } else if (type === 'create_todo_list') {
    return {
      type,
      data: {
        name: data.name,
        color: data.color,
        pageName: data.pageName || data.page || data.pageTitle || data.title,
        pageId: data.pageId,
      }
    };
  } else if (type === 'add_module') {
    return {
      type,
      data: {
        moduleType: data.moduleType || data.type,
        title: data.title,
        pageName: data.pageName || data.page || data.pageTitle,
        pageId: data.pageId,
        listId: data.listId,
      }
    };
  } else if (type === 'move_module') {
    return {
      type,
      data: {
        moduleId: data.moduleId,
        moduleType: data.moduleType || data.type,
        title: data.title,
        sourcePageName: data.sourcePageName || data.fromPageName || data.currentPageName,
        sourcePageId: data.sourcePageId || data.fromPageId,
        targetPageName: data.targetPageName || data.toPageName || data.destinationPage,
        targetPageId: data.targetPageId || data.toPageId,
      }
    };
  } else if (type === 'create_page' || type === 'delete_page' || type === 'switch_page') {
    return {
      type,
      data: {
        title: data.title || data.pageName || data.page,
        pageId: data.pageId,
        icon: data.icon,
      }
    };
  } else if (type === 'create_todo' || type === 'add_todo_to_list') {
    return { type: 'create_todo', data: { text: data.text || data.content, listName: data.listName } };
  } else if (type === 'create_alarm') {
    return { type, data: { title: data.title, time: data.time } };
  } else if (type === 'archive_calendar') {
    return { type, data: { folderName: data.folderName || 'Archived Calendar' } };
  } else if (type === 'start_pomodoro' || type === 'stop_pomodoro') {
    return { type, data: {} };
  } else if (type === 'create_calendar_template') {
    // Explicitly normalize template creation — guarantee events array exists
    const events = data.events || data.templateEvents || [];
    console.log(`[normalizeActions] create_calendar_template: name="${data.name}", events=${events.length}, groupName="${data.groupName}"`);
    return { type, data: { name: data.name || data.title, description: data.description, groupName: data.groupName || data.group || data.targetGroup, events } };
  } else if (type === 'add_template_event') {
    return { type, data: { templateName: data.templateName || data.template || data.name, title: data.title || data.eventTitle, dayOfWeek: data.dayOfWeek ?? data.day, startTime: data.startTime || data.start, endTime: data.endTime || data.end, color: data.color, description: data.description } };
  } else if (type === 'update_template_event') {
    return { type, data: { templateName: data.templateName || data.template, eventTitle: data.eventTitle || data.currentTitle || data.event, title: data.title, dayOfWeek: data.dayOfWeek ?? data.day, startTime: data.startTime || data.start, endTime: data.endTime || data.end, color: data.color, description: data.description } };
  } else if (type === 'remove_template_event' || type === 'apply_calendar_template' || type === 'update_calendar_template' || type === 'delete_calendar_template') {
    // Ensure data wrapper exists
    return { type, data };
  }
  return op;
});

// ─── Streaming endpoint ───────────────────────────────────────────────────────
// Output format uses a simple separator so speech text can stream before JSON:
//   SPEECH: <conversational text>
//   ---
//   <json actions>

export const processSchedulingStream = onRequest(
  {
    cors: true,
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 120,
    secrets: [geminiApiKey],
  },
  async (req, res) => {
    // CORS preflight
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    // Authenticate via Bearer token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      await admin.auth().verifyIdToken(authHeader.split('Bearer ')[1]);
    } catch {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const { userMessage, userId, context: rawContext, history = [] } = req.body;
    if (!userMessage || !userId) { res.status(400).json({ error: 'Missing fields' }); return; }

    // Parse client context (sent as JSON string from client)
    let clientContext: any = {};
    try {
      clientContext = typeof rawContext === 'string' ? JSON.parse(rawContext) : (rawContext || {});
    } catch { clientContext = {}; }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (data: object) => res.write(`data: ${JSON.stringify(data)}\n\n`);

    try {
      const db = admin.firestore();
      const now = new Date();
      const startRange = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endRange = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const aiEnabledCalendarIds: string[] | null = clientContext?.aiEnabledCalendarIds ?? null;
      let eventsQuery: any = db.collection('calendar_events')
        .where('userId', '==', userId)
        .where('startsAt', '>=', admin.firestore.Timestamp.fromDate(startRange))
        .where('startsAt', '<=', admin.firestore.Timestamp.fromDate(endRange))
        .where('isArchived', '==', false)
        .orderBy('startsAt', 'asc');

      // If user restricted which calendars Mally can see, apply the filter
      if (aiEnabledCalendarIds && aiEnabledCalendarIds.length > 0) {
        eventsQuery = eventsQuery.where('calendarId', 'in', aiEnabledCalendarIds.slice(0, 30));
      }

      const snap = await eventsQuery.limit(50).get();

      const events: any[] = [];
      snap.forEach((doc: any) => events.push({ id: doc.id, ...doc.data() }));
      const eventsContext = formatEventsForAI(events);

      // Build calendar groups context
      const groupsContext = (clientContext.calendarGroups || []).length > 0
        ? (clientContext.calendarGroups as any[]).map((g: any) => `- "${g.name}" (id: ${g.id})`).join('\n')
        : 'No calendar groups.';

      // Build existing templates context
      const templatesContext = (clientContext.calendarTemplates || []).length > 0
        ? (clientContext.calendarTemplates as any[]).map((t: any) =>
          `- "${t.name}" (${t.eventCount} events${t.isActive ? ', active' : ''}${t.targetGroupId ? `, group: ${t.targetGroupId}` : ''})`
        ).join('\n')
        : 'No templates yet.';

      // Build sidebar pages context
      const sidebarPages = (clientContext.sidebarPages || []) as any[];
      const sidebarContext = sidebarPages.length > 0
        ? sidebarPages.map((p: any) => {
          const active = p.isActive ? ' [ACTIVE]' : '';
          const modules = (p.modules || []).map((m: any) =>
            `    - ${m.title} (type: ${m.type}, moduleId: ${m.id}${m.listId ? `, listId: ${m.listId}` : ''})`
          ).join('\n') || '    - (no modules)';
          return `- Page: "${p.title}" (id: ${p.id})${active}\n${modules}`;
        }).join('\n')
        : 'No sidebar pages loaded.';

      const todoListsContext = (clientContext.todoLists || []).length > 0
        ? (clientContext.todoLists as any[]).map((l: any) =>
          `- "${l.name}" (id: ${l.id})${l.isActive ? ' [ACTIVE]' : ''}`
        ).join('\n')
        : 'No todo lists loaded.';

      const genAI = new GoogleGenerativeAI(geminiApiKey.value());
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const autoMode: boolean = clientContext?.autoMode === true;

      const systemPrompt = `You are Mally, a warm and intelligent scheduling assistant.
Current Time: ${clientContext.currentTime || new Date().toISOString()}
User Timezone: ${clientContext.timeZone || 'UTC'}
${autoMode ? `
AUTO MODE — ACTIVE: NEVER ask the user ANY question. Make all decisions yourself using context and smart defaults. Pick the best option and act immediately. State what you did in one brief sentence.
` : `
EXECUTION RULE: If the user's intent is clear, execute immediately — don't ask "would you like me to", don't ask for confirmation. Only ask a question when a critical piece of information is completely missing AND cannot be inferred.
`}

EXISTING EVENTS:
${eventsContext || 'No events scheduled.'}

CALENDAR_GROUPS (use these names for groupName):
${groupsContext}

CALENDAR_TEMPLATES (existing templates):
${templatesContext}

SIDEBAR_PAGES (target these exact page names when user specifies a page):
${sidebarContext}

TODO_LISTS:
${todoListsContext}

OUTPUT FORMAT — follow this EXACTLY, no deviations:

SPEECH: [Your conversational spoken response — friendly, natural, 1-3 sentences, no markdown, no asterisks]
---
{"actionRequired": boolean, "intent": "scheduling|task_management|pomodoro_control|query|general", "actions": [...]}

CAPABILITIES:
- Pomodoro: {"type":"start_pomodoro","data":{}} or {"type":"stop_pomodoro","data":{}}
- Events: {"type":"create_event","data":{"title":"...","start":"ISO8601","end":"ISO8601","isRecurring":false}}
- Recurring event: {"type":"create_event","data":{"title":"...","start":"ISO8601","end":"ISO8601","isRecurring":true,"recurrenceRule":{"frequency":"weekly","byDay":["MO","WE","FR"]}}}
- Update event: {"type":"update_event","data":{"eventId":"...","start":"ISO8601","end":"ISO8601"}}
- Delete event: {"type":"delete_event","data":{"eventId":"..."}}
- Todos: {"type":"create_todo","data":{"text":"...","listName":"..."}}
- Todo lists: {"type":"create_todo_list","data":{"name":"...","pageName":"optional target page name"}}
- Modules: {"type":"add_module","data":{"moduleType":"todo|pomodoro|alarms|reminders|eisenhower|invites","title":"optional","pageName":"optional target page"}}
- Move modules: {"type":"move_module","data":{"moduleId":"preferred","moduleType":"fallback","title":"optional","targetPageName":"required"}}
- Pages: {"type":"create_page","data":{"title":"..."}}, {"type":"switch_page","data":{"title":"..."}}, {"type":"delete_page","data":{"title":"..."}}
- Alarms: {"type":"create_alarm","data":{"title":"...","time":"HH:mm"}}
- Calendar Templates (weekly patterns) — ALWAYS include ALL events in create_calendar_template:
  Create full template: {"type":"create_calendar_template","data":{"name":"Work Week","description":"optional","groupName":"Work","events":[{"title":"Standup","dayOfWeek":1,"startTime":"09:00","endTime":"09:15","color":"#3b82f6"}]}}
  Add event to template: {"type":"add_template_event","data":{"templateName":"...","title":"...","dayOfWeek":0,"startTime":"HH:mm","endTime":"HH:mm"}}
  Edit an existing event in a template: {"type":"update_template_event","data":{"templateName":"...","eventTitle":"existing event title","title":"new title","dayOfWeek":2,"startTime":"HH:mm","endTime":"HH:mm","color":"#hex"}}
  Remove event from template: {"type":"remove_template_event","data":{"templateName":"...","eventTitle":"..."}}
  Apply template to calendar: {"type":"apply_calendar_template","data":{"templateName":"..."}}
  Update template metadata: {"type":"update_calendar_template","data":{"templateName":"...","name":"new name"}}
  Delete template: {"type":"delete_calendar_template","data":{"templateName":"..."}}
- Eisenhower: {"type":"create_eisenhower","data":{"text":"...","quadrant":"urgent_important|not_urgent_important|urgent_not_important|not_urgent_not_important"}}
- Reminders: {"type":"create_reminder","data":{"title":"...","reminderTime":"ISO8601"}}
- View: {"type":"change_view","data":{"view":"day|week|month"}}

dayOfWeek values: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday. MUST be an integer, never a string.

TEMPLATE RULES (CRITICAL — follow exactly):
- When user asks to create a template, you MUST include ALL events in the "events" array of a single create_calendar_template action. The "events" array must NOT be empty.
- Example: {"type":"create_calendar_template","data":{"name":"My Schedule","groupName":"School","events":[{"title":"Math","dayOfWeek":1,"startTime":"09:00","endTime":"10:00"},{"title":"English","dayOfWeek":2,"startTime":"11:00","endTime":"12:00"}]}}
- ALWAYS set "groupName" to one of the names from CALENDAR_GROUPS above.
- When user asks to add events to an EXISTING template (listed in CALENDAR_TEMPLATES above), use add_template_event with the exact templateName from CALENDAR_TEMPLATES.
- When user asks to EDIT or CHANGE a specific event inside a template (e.g. change time, rename), use update_template_event with templateName and the eventTitle of the event to change.
- When user asks to RENAME a template or change metadata, use update_calendar_template.
- NEVER create an empty template with no events. If the user's request implies events, include them ALL.
- Use the EXACT template name from CALENDAR_TEMPLATES when referencing existing templates — do not paraphrase or shorten the name.

RULES:
- "start pomodoro" = start timer NOW (no calendar event)
- Resolve pronouns (it/this/that) from conversation history
- Check for conflicts in existing events; suggest alternatives
- Default event duration: 1 hour
- Never claim you "don't have the ability" for page/module operations — you DO support page-specific module/list actions.
- If user specifies a page, include pageName/targetPageName in action data.
- If user asks to move a module to another page, use move_module.
- NEVER ask "what time?", "what title?", "which list?", "are you sure?", or ANY clarifying question if you can pick a reasonable default.
- NEVER say "I'll need a bit more info" or "could you clarify" — just pick the most sensible option and go.
- ALWAYS include both SPEECH: and --- and JSON`;

      const formattedHistory = (history as any[]).map(h => ({
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
            if (newPart) { send({ type: 'speech', text: newPart }); speechText = full; }
            send({ type: 'speech_done' });
          } else {
            const stripped = fullText.replace(/^SPEECH:\s*/i, '');
            const newPart = stripped.slice(speechText.length);
            if (newPart) { send({ type: 'speech', text: newPart }); speechText = stripped; }
          }
        }
        // After separator: accumulate JSON — don't stream it
      }

      // Parse actions from accumulated JSON
      let actions: any[] = [], intent = 'general', actionRequired = false;
      try {
        // Use everything after the FIRST '---' separator (rejoin in case JSON contains ---)
        const parts = fullText.split('---');
        const jsonPart = parts.length > 1 ? parts.slice(1).join('---').trim() : '{}';
        const cleaned = jsonPart.replace(/```json/g, '').replace(/```/g, '').trim();
        console.log('[streaming] Raw JSON part (first 1000 chars):', cleaned.slice(0, 1000));
        const parsed = JSON.parse(cleaned);
        intent = parsed.intent || 'general';
        actionRequired = parsed.actionRequired || false;
        actions = normalizeActions(parsed.actions || []);
        console.log('[streaming] Normalized actions:', JSON.stringify(actions).slice(0, 2000));
      } catch (e: any) {
        console.warn('Failed to parse streaming actions JSON:', e.message, 'fullText length:', fullText.length);
      }

      const finalSpeechText = speechText || fullText.split('---')[0].replace(/^SPEECH:\s*/i, '').trim();
      send({ type: 'done', speechText: finalSpeechText, actions, intent, actionRequired });
      res.end();

    } catch (error: any) {
      console.error('processSchedulingStream error:', error);
      send({ type: 'error', message: error.message });
      res.end();
    }
  }
);
