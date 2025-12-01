const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const chrono = require('chrono-node');

admin.initializeApp();

// Process natural language AI request with intelligent calendar scheduling
exports.processAIRequest = functions.https.onCall(async (data, context) => {
  console.log('=== processAIRequest Function Called ===');
  console.log('Data received:', JSON.stringify(data, null, 2));
  console.log('Context auth:', context.auth ? {
    uid: context.auth.uid,
    email: context.auth.token.email || 'no email',
    emailVerified: context.auth.token.email_verified
  } : 'NO AUTH CONTEXT');
  
  // Verify user is authenticated
  if (!context.auth) {
    console.error('❌ Authentication failed: no context.auth');
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to use this function'
    );
  }

  try {
    const { message, userId } = data;

    // Validate request data
    if (!message || !userId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing required fields: message and userId'
      );
    }

    // Verify user ID matches authenticated user
    if (context.auth.uid !== userId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'User ID does not match authenticated user'
      );
    }

    console.log('Processing AI request for user:', userId);
    console.log('Message:', message);

    // Get user's calendar events for conflict checking
    const db = admin.firestore();
    const eventsSnapshot = await db
      .collection('calendar_events')
      .where('userId', '==', userId)
      .get();

    const existingEvents = [];
    eventsSnapshot.forEach(doc => {
      const eventData = doc.data();
      existingEvents.push({
        id: doc.id,
        title: eventData.title,
        start: eventData.start_date?.toDate() || eventData.startDate?.toDate(),
        end: eventData.end_date?.toDate() || eventData.endDate?.toDate(),
        description: eventData.description
      });
    });

    console.log('Found existing events:', existingEvents.length);

    // Parse natural language for dates and times using chrono-node
    const parseResults = chrono.parse(message);
    console.log('Chrono parse results:', parseResults);

    // Analyze message intent
    const messageLC = message.toLowerCase();
    let responseType = 'general';
    let suggestedEvent = null;
    let conflicts = [];

    // Check for scheduling intent
    if (messageLC.includes('schedule') || messageLC.includes('create') || messageLC.includes('add') || 
        messageLC.includes('meeting') || messageLC.includes('appointment') || messageLC.includes('event')) {
      
      responseType = 'scheduling';

      // Extract event details
      let title = 'New Event';
      let startTime = null;
      let endTime = null;
      let duration = 60; // Default 1 hour

      // Extract title from common patterns
      const titlePatterns = [
        /schedule\s+(?:a\s+)?(.+?)(?:\s+(?:at|for|tomorrow|today|next|on))/i,
        /create\s+(?:an?\s+)?(?:event\s+for\s+)?(.+?)(?:\s+(?:at|for|tomorrow|today|next|on))/i,
        /add\s+(?:a\s+)?(.+?)(?:\s+(?:at|for|tomorrow|today|next|on))/i,
        /(meeting|appointment|call|lunch|dinner)\s+(?:with\s+)?(.+?)(?:\s+(?:at|for|tomorrow|today|next|on))/i
      ];

      for (const pattern of titlePatterns) {
        const match = message.match(pattern);
        if (match) {
          title = match[1] || match[2] || 'New Event';
          if (match[1] && match[2]) {
            title = `${match[1]} with ${match[2]}`;
          }
          break;
        }
      }

      // Use chrono parsing for time extraction
      if (parseResults.length > 0) {
        const parsedDate = parseResults[0];
        startTime = parsedDate.start.date();
        
        // If end time is specified, use it; otherwise default duration
        if (parsedDate.end) {
          endTime = parsedDate.end.date();
        } else {
          endTime = new Date(startTime.getTime() + duration * 60000);
        }
      } else {
        // Fallback time parsing for common patterns
        const timePatterns = [
          /(\d{1,2}):?(\d{2})?\s*(am|pm)/i,
          /(\d{1,2})\s*(am|pm)/i,
          /(morning|afternoon|evening|night)/i
        ];

        for (const pattern of timePatterns) {
          const match = message.match(pattern);
          if (match) {
            const now = new Date();
            startTime = new Date(now);
            
            if (match[3]) { // am/pm format
              let hour = parseInt(match[1]);
              const minute = match[2] ? parseInt(match[2]) : 0;
              const isPM = match[3].toLowerCase() === 'pm';
              
              if (isPM && hour < 12) hour += 12;
              if (!isPM && hour === 12) hour = 0;
              
              startTime.setHours(hour, minute, 0, 0);
            } else if (match[1]) { // time of day
              const timeOfDay = match[1].toLowerCase();
              switch (timeOfDay) {
                case 'morning': startTime.setHours(9, 0, 0, 0); break;
                case 'afternoon': startTime.setHours(14, 0, 0, 0); break;
                case 'evening': startTime.setHours(18, 0, 0, 0); break;
                case 'night': startTime.setHours(20, 0, 0, 0); break;
              }
            }
            
            // Check if it's for tomorrow
            if (messageLC.includes('tomorrow')) {
              startTime.setDate(startTime.getDate() + 1);
            }
            
            endTime = new Date(startTime.getTime() + duration * 60000);
            break;
          }
        }
      }

      // Check for conflicts if we have a time
      if (startTime && endTime) {
        conflicts = existingEvents.filter(event => {
          if (!event.start || !event.end) return false;
          
          // Check for time overlap
          return (startTime < event.end && endTime > event.start);
        });

        if (conflicts.length > 0) {
          console.log('Found conflicts:', conflicts);
          
          // Suggest alternative times
          const suggestedTimes = [];
          for (let i = 1; i <= 3; i++) {
            const altStart = new Date(startTime.getTime() + (i * 60 * 60000)); // +1 hour each
            const altEnd = new Date(endTime.getTime() + (i * 60 * 60000));
            
            const hasConflict = existingEvents.some(event => {
              if (!event.start || !event.end) return false;
              return (altStart < event.end && altEnd > event.start);
            });
            
            if (!hasConflict) {
              suggestedTimes.push({
                start: altStart,
                end: altEnd,
                formatted: altStart.toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit', 
                  hour12: true 
                })
              });
            }
          }
        }

        suggestedEvent = {
          title: title.trim(),
          start: startTime,
          end: endTime,
          startFormatted: startTime.toLocaleString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          }),
          endFormatted: endTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
          })
        };
      }
    }

    // Generate intelligent response based on analysis
    let response = '';
    let actionRequired = false;
    let eventData = null;

    if (responseType === 'scheduling' && suggestedEvent) {
      if (conflicts.length > 0) {
        response = `I found a conflict with "${conflicts[0].title}" at that time. `;
        response += `Would you like me to schedule "${suggestedEvent.title}" for ${suggestedEvent.startFormatted} anyway, or would you prefer an alternative time?`;
        
        // Include suggested alternative times if available
        if (conflicts.length > 0) {
          response += ' I can suggest some alternative times if you\'d like.';
        }
      } else {
        response = `Perfect! I can schedule "${suggestedEvent.title}" for ${suggestedEvent.startFormatted} to ${suggestedEvent.endFormatted}. Would you like me to create this event?`;
        actionRequired = true;
        eventData = {
          title: suggestedEvent.title,
          start_date: admin.firestore.Timestamp.fromDate(suggestedEvent.start),
          end_date: admin.firestore.Timestamp.fromDate(suggestedEvent.end),
          description: `Created by Mally AI from: "${message}"`,
          userId: userId,
          created_at: admin.firestore.Timestamp.now()
        };
      }
    } else if (responseType === 'scheduling') {
      response = `I'd be happy to help you schedule something! However, I need more specific details. Could you please provide:
      
• What you'd like to schedule
• When you'd like it scheduled (date and time)
      
For example: "Schedule a team meeting tomorrow at 2 PM" or "Create a doctor appointment for Friday morning"`;
    } else {
      // Handle general queries about calendar, tasks, etc.
      if (messageLC.includes('calendar') || messageLC.includes('event') || messageLC.includes('meeting')) {
        const upcomingEvents = existingEvents
          .filter(event => event.start && event.start > new Date())
          .sort((a, b) => a.start - b.start)
          .slice(0, 3);

        if (upcomingEvents.length > 0) {
          response = `Here are your upcoming events:\n\n`;
          upcomingEvents.forEach((event, index) => {
            response += `${index + 1}. ${event.title} - ${event.start.toLocaleDateString()} at ${event.start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}\n`;
          });
        } else {
          response = "You don't have any upcoming events scheduled. Would you like me to help you create one?";
        }
      } else {
        response = `I'm Mally, your AI assistant! I can help you with:

• Scheduling meetings and events
• Managing your calendar
• Setting reminders
• Organizing tasks

What would you like me to help you with today?`;
      }
    }

    console.log('Generated response:', response);

    const result = {
      success: true,
      response: response,
      actionRequired: actionRequired,
      suggestedEvent: suggestedEvent,
      conflicts: conflicts.map(c => ({
        title: c.title,
        start: c.start?.toISOString(),
        end: c.end?.toISOString()
      })),
      eventData: eventData
    };

    return result;

  } catch (error) {
    console.error('Error in processAIRequest:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      'An internal error occurred while processing the AI request'
    );
  }
});

// Create calendar event (replaces Supabase calendar-events function)
exports.createCalendarEvent = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to use this function'
    );
  }

  try {
    const { eventData, userId } = data;

    // Validate request data
    if (!eventData || !userId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing required fields: eventData and userId'
      );
    }

    // Verify user ID matches authenticated user
    if (context.auth.uid !== userId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'User ID does not match authenticated user'
      );
    }

    console.log('Creating calendar event for user:', userId);
    console.log('Event data:', eventData);

    const db = admin.firestore();
    
    // Add the event to Firestore
    const docRef = await db.collection('calendar_events').add({
      ...eventData,
      userId: userId,
      created_at: admin.firestore.Timestamp.now(),
      updated_at: admin.firestore.Timestamp.now()
    });

    console.log('Calendar event created with ID:', docRef.id);

    return {
      success: true,
      eventId: docRef.id,
      message: 'Calendar event created successfully!'
    };

  } catch (error) {
    console.error('Error in createCalendarEvent:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      'An internal error occurred while creating the calendar event'
    );
  }
});

// Transcribe audio using speech-to-text (replaces Supabase transcribe-audio function)
exports.transcribeAudio = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to use this function'
    );
  }

  try {
    const { audioData, userId } = data;

    // Validate request data
    if (!audioData || !userId) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing required fields: audioData and userId'
      );
    }

    // Verify user ID matches authenticated user
    if (context.auth.uid !== userId) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'User ID does not match authenticated user'
      );
    }

    console.log('Processing transcription request for user:', userId);

    // TODO: Implement actual speech-to-text transcription
    // You could use Google Cloud Speech-to-Text, AWS Transcribe, or another service
    // For now, returning a mock response

    // Mock transcription with realistic examples based on audio length
    const mockTranscriptions = [
      'Schedule a meeting tomorrow at 2 PM',
      'Create an event for lunch with the team next Friday',
      'Add a reminder to call the client at 3 PM today',
      'Set up a project review meeting for next week',
      'Schedule a doctor appointment for Thursday morning'
    ];
    
    const transcript = mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)];

    console.log('Mock transcription completed for user:', userId);
    console.log('Generated transcript:', transcript);

    return {
      success: true,
      transcript: transcript
    };

  } catch (error) {
    console.error('Error in transcribeAudio:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      'An internal error occurred while processing the transcription request'
    );
  }
});
