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
    return `${e.title}: ${start?.toLocaleString()} - ${end?.toLocaleString()}`;
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
    // Fetch user's events for context
    const db = admin.firestore();
    const now = new Date();
    const eventsSnapshot = await db.collection('calendar_events')
      .where('userId', '==', userId)
      .where('start_date', '>=', now) // Only future events for context usually
      .limit(20)
      .get();

    const events = [];
    eventsSnapshot.forEach(doc => events.push(doc.data()));
    const eventsContext = formatEventsForAI(events);

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const systemPrompt = `
      You are Mally, an intelligent scheduling assistant.
      Current Time: ${clientContext?.currentTime || new Date().toISOString()}
      User Timezone: ${clientContext?.timeZone || 'UTC'}
      
      Your goal is to help the user manage their calendar.
      
      Existing Future Events:
      ${eventsContext}
      
      Analyze the user's request and return a JSON object with the following structure:
      {
        "response": "Natural language response to the user",
        "actionRequired": boolean (true if the user wants to create/update an event),
        "suggestedEvent": {
          "title": "Event Title",
          "start": "ISO String",
          "end": "ISO String",
          "description": "Description"
        } (only if actionRequired is true),
        "intent": "scheduling" | "query" | "general"
      }
      
      If there is a conflict, mention it in the "response" but still suggest the event if explicitly asked.
      If the user asks a general question, just answer it in "response".
      IMPORTANT: Return ONLY the JSON object, no markdown formatting.
    `;

    const result = await model.generateContent([
      systemPrompt,
      message
    ]);

    const responseText = result.response.text();
    // Clean up markdown code blocks if present
    const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    const aiResult = JSON.parse(cleanJson);

    // If action required, we construct the event data for the frontend to confirm
    let eventData = null;
    if (aiResult.actionRequired && aiResult.suggestedEvent) {
      eventData = {
        title: aiResult.suggestedEvent.title,
        start_date: admin.firestore.Timestamp.fromDate(new Date(aiResult.suggestedEvent.start)),
        end_date: admin.firestore.Timestamp.fromDate(new Date(aiResult.suggestedEvent.end)),
        description: aiResult.suggestedEvent.description || `Created by Mally AI`,
        userId: userId,
        created_at: admin.firestore.Timestamp.now()
      };
    }

    return {
      success: true,
      response: aiResult.response,
      actionRequired: aiResult.actionRequired,
      suggestedEvent: aiResult.suggestedEvent ? {
        ...aiResult.suggestedEvent,
        startFormatted: new Date(aiResult.suggestedEvent.start).toLocaleString(),
        endFormatted: new Date(aiResult.suggestedEvent.end).toLocaleTimeString()
      } : null,
      eventData: eventData
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
