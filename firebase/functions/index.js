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

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const systemPrompt = `
      You are Mally, an intelligent and PROACTIVE scheduling assistant.
      Current Time: ${clientContext?.currentTime || new Date().toISOString()}
      User Timezone: ${clientContext?.timeZone || 'UTC'}
      
      Your goal is to help the user manage their calendar intelligently and boost productivity.
      BE PROACTIVE: Don't just ask the user what time they want. Analyze their calendar and SUGGEST optimal times.
      
      EXISTING EVENTS (use these to detect conflicts and find free slots):
      ${eventsContext || 'No events scheduled yet.'}
      
      CRITICAL RULES:
      
      1. PROACTIVE PLANNING: When the user asks to "plan", "schedule", or "help me with my day":
         - Analyze their existing events and find FREE time slots.
         - SUGGEST specific times instead of asking "what time do you want?".
         - Example: "I see you're free from 2pm-4pm. How about scheduling your meeting then?"
      
      2. CONFLICT DETECTION (MANDATORY before any scheduling):
         - ALWAYS check EXISTING EVENTS before suggesting or creating any event.
         - If a time slot is partially or fully taken, you MUST:
           a) Mention the conflict: "That time conflicts with [Event Name] from [time]."
           b) Suggest an alternative free slot: "How about [alternative time] instead?"
           c) Offer to move the existing event if the user insists: "I can move [Event Name] to [new time] to make room."
         - NEVER create an event that conflicts without explicitly mentioning it.
      
      3. IRREGULAR RECURRING EVENTS (VERY IMPORTANT):
         - If the user wants a routine at DIFFERENT TIMES on DIFFERENT DAYS (e.g., "Gym: Mon 5pm, Tue 6pm, Wed 7pm"):
           - You MUST create MULTIPLE separate "create_event" operations.
           - Each event should have its own recurrence rule for that specific day.
           - Example for "Gym Mon 5pm, Tue 6pm, Wed 7pm":
             * Operation 1: create_event for Monday at 5pm, recurrence: weekly on Monday
             * Operation 2: create_event for Tuesday at 6pm, recurrence: weekly on Tuesday
             * Operation 3: create_event for Wednesday at 7pm, recurrence: weekly on Wednesday
         - Do NOT try to cram different times into a single event.
      
      4. TODO LISTS: 
         - To create a new list: use "create_todo_list" with "name".
         - To add to a list: use "add_todo_to_list" with "text" and "listId" or "listName".
      
      5. ALARMS: To set an alarm: use "create_alarm" with "title" and "time" (ISO string or HH:mm).
      
      6. POMODORO: To control timer: use "start_pomodoro" or "stop_pomodoro".
      
      7. EVENT DURATION: Every event MUST have a duration. If the user doesn't specify an end time, assume a duration of 1 hour. NEVER return the same time for "start" and "end".
      
      8. MOVING EVENTS: To move an existing event, use "move_event" with the event's ID, newStart, and newEnd.
      
      9. RESPONSE FORMAT: Return a JSON object with this structure:
      {
        "response": "Natural language response explaining your reasoning, conflicts found, and suggestions.",
        "actionRequired": boolean,
        "operations": [
          { "type": "create_event", "event": { "title": "...", "start": "ISO", "end": "ISO", "isRecurring": true/false, "recurrenceRule": { "frequency": "weekly", "daysOfWeek": [1] } } },
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
