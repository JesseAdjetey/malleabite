const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');

admin.initializeApp();

// Initialize Gemini Client
// Note: Ensure GEMINI_API_KEY is set in your Firebase Functions environment variables
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'MISSING_API_KEY');

// Helper to format events for the AI context - provides clear time slot information
const formatEventsForAI = (events) => {
  if (!events || events.length === 0) {
    return 'No events scheduled in the next 30 days.';
  }

  return events.map(e => {
    // Handle both Timestamp objects and ISO strings
    let start, end;
    if (e.startsAt?.toDate) {
      start = e.startsAt.toDate();
    } else if (e.startsAt) {
      start = new Date(e.startsAt);
    }
    if (e.endsAt?.toDate) {
      end = e.endsAt.toDate();
    } else if (e.endsAt) {
      end = new Date(e.endsAt);
    }

    if (!start || !end) return null;

    // Format in a clear, readable way for the AI
    const dateStr = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    return `- "${e.title}" on ${dateStr} from ${startTime} to ${endTime} (ID: ${e.id})`;
  }).filter(Boolean).join('\n');
};

exports.processAIRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { message, userId, context: clientContext, history = [] } = data;

  if (!process.env.GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY is missing');
    return {
      success: false,
      response: "I'm almost ready! Please configure the Gemini API Key in the backend to enable my intelligence.",
      actionRequired: false
    };
  }

  try {
    const db = admin.firestore();
    const now = new Date();

    // Fetch events from today to 30 days ahead for conflict checking
    const startRange = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Start of today
    const endRange = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Query using the correct field name: startsAt (not start_date)
    const eventsSnapshot = await db.collection('calendar_events')
      .where('userId', '==', userId)
      .where('startsAt', '>=', admin.firestore.Timestamp.fromDate(startRange))
      .where('startsAt', '<=', admin.firestore.Timestamp.fromDate(endRange))
      .where('isArchived', '==', false)
      .orderBy('startsAt', 'asc')
      .limit(100)
      .get();

    const events = [];
    eventsSnapshot.forEach(doc => {
      events.push({ id: doc.id, ...doc.data() });
    });

    console.log(`Fetched ${events.length} events for AI context`);
    const eventsContext = formatEventsForAI(events);
    console.log(`MallyAI: Processing request. History: ${history.length} messages. Message: "${message}"`);

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const systemPrompt = `
      You are Mally, a highly intelligent and PROACTIVE scheduling assistant.
      Current Time: ${clientContext?.currentTime || new Date().toISOString()}
      User Timezone: ${clientContext?.timeZone || 'UTC'}
      
      GOAL: Manage the user's calendar with elite precision and productivity.
      
      CORE CAPABILITIES:
      1. POMODORO TIMER CONTROL (HIGHEST PRIORITY):
         - IF user says "start pomodoro", "start timer", "focus now", or similar -> your PRIMARY job is to control the timer.
         - ACTION: { "type": "start_pomodoro", "data": {} }
         - ACTION: { "type": "stop_pomodoro", "data": {} } (for stop/pause)
         - DO NOT create calendar events for these commands. Only create events if the user explicitly says "schedule" or gives a future time.
         - "start pomodoro" = I want to work NOW (timer).
         - "schedule pomodoro" = I want to work LATER (calendar).

      2. CONVERSATIONAL MEMORY (CRITICAL):
         - ALWAYS resolve words like "this", "it", "that", or "the event" by looking at the RECENT CONVERSATION HISTORY.
         - If you just created an event and the user says "make it recurring", "it" refers to the event you JUST created.
         - Do NOT ask for details (title, time) if they were provided earlier in the chat.
      
      3. PROACTIVE PLANNING:
         - Analyze EXISTING EVENTS below to find conflicts or free slots.
         - Suggest specific times rather than asking questions.
      
      EXISTING EVENTS:
      ${eventsContext || 'No events scheduled yet.'}
      
      RULES:
      - CONFLICTS: If a requested time is busy, mention the conflict and suggest a free alternative.
      - RECURRENCE: Use "isRecurring: true" and specify "recurrenceRule". For irregular routines, create multiple "create_event" operations.
      - DURATION: Default to 1 hour if not specified. Never return start == end.
      - FORMAT: Return ONLY a raw JSON object (no markdown).
      
      JSON STRUCTURE:
      {
        "response": "Explain your reasoning and what you've done.",
        "actionRequired": boolean,
        "intent": "scheduling" | "task_management" | "pomodoro_control" | "query" | "general",
        "actions": [
          { "type": "create_event", "data": { "title": "...", "start": "ISO", "end": "ISO", "isRecurring": bool, "recurrenceRule": {...} } },
          { "type": "move_event", "data": { "eventId": "...", "newStart": "ISO", "newEnd": "ISO" } },
          { "type": "create_todo", "data": { "text": "...", "listName": "..." } },
          { "type": "create_alarm", "data": { "title": "...", "time": "HH:mm" } },
          { "type": "start_pomodoro", "data": {} },
          { "type": "stop_pomodoro", "data": {} }
        ]
      }
    `;

    // Format history for Gemini SDK
    // Gemini expects: history: [{ role: 'user', parts: [{ text: 'hi' }] }, { role: 'model', parts: [{ text: 'hello' }] }]
    const formattedHistory = history.map(h => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.parts }]
    }));

    // Start chat with history
    const chat = model.startChat({
      history: formattedHistory,
      systemInstruction: {
        role: "system",
        parts: [{ text: systemPrompt }]
      }
    });

    const result = await chat.sendMessage(message);

    const responseText = result.response.text();
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const aiResult = JSON.parse(cleanJson);

    // Support both new 'actions' format and legacy 'operations' format
    const rawActions = aiResult.actions || aiResult.operations || [];

    // Construct final response data formatted for the frontend
    const finalActions = rawActions.map(op => {
      // Normalize operation structure
      const type = op.type;
      const data = op.data || op.event || op;

      if (type === 'create_event') {
        return {
          type: 'create_event',
          data: {
            title: data.title,
            start: data.start || data.startsAt,
            end: data.end || data.endsAt,
            description: data.description || `Created by Mally AI`,
            isRecurring: data.isRecurring || false,
            recurrenceRule: data.recurrenceRule || null,
            _originalMessage: message
          }
        };
      } else if (type === 'move_event' || type === 'update_event') {
        return {
          type: 'update_event',
          data: {
            eventId: data.eventId,
            start: data.newStart || data.start || data.startsAt,
            end: data.newEnd || data.end || data.endsAt,
            title: data.title
          }
        };
      } else if (type === 'create_todo_list') {
        return {
          type: 'create_todo_list',
          data: { name: data.name }
        };
      } else if (type === 'create_todo' || type === 'add_todo_to_list') {
        return {
          type: 'create_todo',
          data: { text: data.text || data.content, listName: data.listName }
        };
      } else if (type === 'create_alarm') {
        return {
          type: 'create_alarm',
          data: { title: data.title, time: data.time }
        };
      } else if (type === 'archive_calendar') {
        return { type: 'archive_calendar', data: { folderName: data.folderName || 'Archived Calendar' } };
      } else if (type === 'start_pomodoro' || type === 'stop_pomodoro') {
        return { type: type, data: {} };
      }
      return op;
    });

    console.log(`MallyAI: Response generated. Intent: ${aiResult.intent}, Actions: ${finalActions.length}`);

    return {
      success: true,
      response: aiResult.response,
      actionRequired: aiResult.actionRequired || finalActions.length > 0,
      actions: finalActions,
      intent: aiResult.intent || 'general'
    };

  } catch (error) {
    console.error('AI Processing Error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to process AI request');
  }
});

exports.transcribeAudio = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');

  const { audioData } = data; // Base64 string

  if (!process.env.GEMINI_API_KEY) {
    return { success: true, transcript: "Please configure Gemini API Key for real transcription." };
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Gemini expects inline data for audio
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: "audio/wav", // Assuming WAV from frontend
          data: audioData
        }
      },
      { text: "Transcribe this audio exactly as spoken. Return only the text." }
    ]);

    return {
      success: true,
      transcript: result.response.text()
    };
  } catch (error) {
    console.error('Transcription Error:', error);
    throw new functions.https.HttpsError('internal', 'Failed to transcribe audio');
  }
});

exports.createCalendarEvent = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');

  const { eventData, userId } = data;
  const db = admin.firestore();

  const docRef = await db.collection('calendar_events').add({
    ...eventData,
    userId: userId, // Ensure userId is consistent
    created_at: admin.firestore.Timestamp.now(),
    updated_at: admin.firestore.Timestamp.now()
  });

  return { success: true, eventId: docRef.id };
});

// ─── Streaming endpoint — returns SSE so TTS starts on first sentence ─────────
// Output format uses a simple separator so speech text can stream before JSON:
//   SPEECH: <conversational text>
//   ---
//   <json actions>
const normalizeActions = (rawActions) => rawActions.map(op => {
  const type = op.type;
  const data = op.data || {};
  if (type === 'create_event') {
    return { type, data: { title: data.title, start: data.start, end: data.end, description: data.description || 'Created by Mally', isRecurring: data.isRecurring || false, recurrenceRule: data.recurrenceRule || null } };
  } else if (type === 'move_event' || type === 'update_event') {
    return { type: 'update_event', data: { eventId: data.eventId, start: data.newStart || data.start, end: data.newEnd || data.end, title: data.title } };
  } else if (type === 'create_todo_list') {
    return { type, data: { name: data.name } };
  } else if (type === 'create_todo' || type === 'add_todo_to_list') {
    return { type: 'create_todo', data: { text: data.text || data.content, listName: data.listName } };
  } else if (type === 'create_alarm') {
    return { type, data: { title: data.title, time: data.time } };
  } else if (type === 'archive_calendar') {
    return { type, data: { folderName: data.folderName || 'Archived Calendar' } };
  } else if (type === 'start_pomodoro' || type === 'stop_pomodoro') {
    return { type, data: {} };
  }
  return op;
});

exports.processSchedulingStream = functions.https.onRequest(async (req, res) => {
  // CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');

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

  const { userMessage, userId, context: clientContext, history = [] } = req.body;
  if (!userMessage || !userId) { res.status(400).json({ error: 'Missing fields' }); return; }

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
          // Extract complete speech text
          const beforeSep = fullText.split('---')[0];
          const full = beforeSep.replace(/^SPEECH:\s*/i, '').trim();
          const newPart = full.slice(speechText.length);
          if (newPart) { send({ type: 'speech', text: newPart }); speechText = full; }
          send({ type: 'speech_done' });
        } else {
          // Stream partial speech text (strip SPEECH: prefix)
          const stripped = fullText.replace(/^SPEECH:\s*/i, '');
          const newPart = stripped.slice(speechText.length);
          if (newPart) { send({ type: 'speech', text: newPart }); speechText = stripped; }
        }
      }
      // After separator: accumulating JSON — don't stream it
    }

    // Parse actions from accumulated JSON
    let actions = [], intent = 'general', actionRequired = false;
    try {
      const jsonPart = (fullText.split('---')[1] || '{}').trim();
      const parsed = JSON.parse(jsonPart.replace(/```json/g, '').replace(/```/g, ''));
      intent = parsed.intent || 'general';
      actionRequired = parsed.actionRequired || false;
      actions = normalizeActions(parsed.actions || []);
    } catch (e) {
      console.warn('Failed to parse streaming actions JSON:', e.message);
    }

    const finalSpeechText = speechText || fullText.split('---')[0].replace(/^SPEECH:\s*/i, '').trim();
    send({ type: 'done', speechText: finalSpeechText, actions, intent, actionRequired });
    res.end();

  } catch (error) {
    console.error('processSchedulingStream error:', error);
    send({ type: 'error', message: error.message });
    res.end();
  }
});
