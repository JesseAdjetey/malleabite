const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { GoogleGenerativeAI } = require('@google/generative-ai');

admin.initializeApp();

// Initialize Gemini Client
// Note: Ensure GEMINI_API_KEY is set in your Firebase Functions environment variables
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'MISSING_API_KEY');

// Helper to format events for the AI context
const formatEventsForAI = (events) => {
  return events.map(e => {
    const start = e.start_date?.toDate() || e.startDate?.toDate();
    const end = e.end_date?.toDate() || e.endDate?.toDate();
    return `ID: ${e.id} | Title: ${e.title} | Start: ${start?.toISOString()} | End: ${end?.toISOString()}`;
  }).join('\n');
};

exports.processAIRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { message, userId, context: clientContext } = data;

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

    // Fetch a broader range of events to check for conflicts (e.g., from 1 day ago to 30 days ahead)
    const startRange = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const endRange = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const eventsSnapshot = await db.collection('calendar_events')
      .where('userId', '==', userId)
      .where('start_date', '>=', admin.firestore.Timestamp.fromDate(startRange))
      .where('start_date', '<=', admin.firestore.Timestamp.fromDate(endRange))
      .limit(100)
      .get();

    const events = [];
    eventsSnapshot.forEach(doc => {
      events.push({ id: doc.id, ...doc.data() });
    });
    const eventsContext = formatEventsForAI(events);

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const systemPrompt = `
      You are Mally, an intelligent scheduling assistant.
      Current Time: ${clientContext?.currentTime || new Date().toISOString()}
      User Timezone: ${clientContext?.timeZone || 'UTC'}
      
      Your goal is to help the user manage their calendar intelligently and boost productivity.
      
      EXISTING EVENTS:
      ${eventsContext}
      
      RULES:
      1. AI CONFLICT DETECTION: Before suggesting a time, check EXISTING EVENTS. 
      2. If a suggested time conflicts (fully or partially) with an existing event:
         - Mention the conflict specifically in your "response".
         - If possible, suggest an alternative time that is free.
         - Alternatively, if the new event is more important (or the user sounds determined), offer to MOVE the existing event.
      3. IRREGULAR RECURRENCE: If the user wants a routine that happens at DIFFERENT TIMES on DIFFERENT DAYS (e.g., Gym Mon 5pm, Tue 6pm), you must suggest MULTIPLE "create_event" operations, each with its own recurrence rule.
      4. TODO LISTS: 
         - To create a new list: use "create_todo_list" with "name".
         - To add to a list: use "add_todo_to_list" with "text" and "listId" or "listName".
      5. ALARMS: To set an alarm: use "create_alarm" with "title" and "time" (ISO string or HH:mm).
      6. POMODORO: To control timer: use "start_pomodoro" or "stop_pomodoro".
      7. EVENT DURATION: Every event MUST have a duration. If the user doesn't specify an end time, assume a duration of 1 hour. NEVER return the same time for "start" and "end".
      8. RESPONSE FORMAT: Return a JSON object with this structure:
      {
        "response": "Natural language response explaining your reasoning, conflicts found, and suggestions.",
        "actionRequired": boolean,
        "operations": [
          { "type": "create_event", "event": { ... } },
          { "type": "move_event", "eventId": "ID", "newStart": "ISO", "newEnd": "ISO" },
          { "type": "create_todo_list", "name": "String" },
          { "type": "add_todo_to_list", "text": "String", "listName": "String" },
          { "type": "create_alarm", "title": "String", "time": "String" },
          { "type": "archive_calendar", "folderName": "String" },
          { "type": "start_pomodoro" },
          { "type": "stop_pomodoro" }
        ],
        "intent": "scheduling" | "query" | "general" | "task_management" | "timer_control"
      }
      
      IMPORTANT: Return ONLY the JSON object, NO markdown formatting.
    `;

    const result = await model.generateContent([
      systemPrompt,
      message
    ]);

    const responseText = result.response.text();
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const aiResult = JSON.parse(cleanJson);

    // Construct final response data
    const finalActions = (aiResult.operations || []).map(op => {
      if (op.type === 'create_event') {
        const event = op.event;
        return {
          type: 'create_event',
          data: {
            title: event.title,
            start: event.start,
            end: event.end,
            description: event.description || `Created by Mally AI`,
            isRecurring: event.isRecurring || false,
            recurrenceRule: event.recurrenceRule || null,
            _originalMessage: message // Pass for localized parsing in frontend if needed
          }
        };
      } else if (op.type === 'move_event' || op.type === 'update_event') {
        return {
          type: 'update_event',
          data: {
            eventId: op.eventId,
            start: op.newStart || op.start,
            end: op.newEnd || op.end,
            title: op.title // Optional: AI might rename it too
          }
        };
      } else if (op.type === 'create_todo_list') {
        return {
          type: 'create_todo_list',
          data: { name: op.name }
        };
      } else if (op.type === 'add_todo_to_list') {
        return {
          type: 'create_todo',
          data: { text: op.text, listName: op.listName }
        };
      } else if (op.type === 'create_alarm') {
        return {
          type: 'create_alarm',
          data: { title: op.title, time: op.time }
        };
      } else if (op.type === 'archive_calendar') {
        return { type: 'archive_calendar', data: { folderName: op.folderName || 'Archived Calendar' } };
      } else if (op.type === 'start_pomodoro') {
        return { type: 'start_pomodoro', data: {} };
      } else if (op.type === 'stop_pomodoro') {
        return { type: 'stop_pomodoro', data: {} };
      }
      return op;
    });

    return {
      success: true,
      response: aiResult.response,
      actionRequired: aiResult.actionRequired,
      actions: finalActions,
      intent: aiResult.intent
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
