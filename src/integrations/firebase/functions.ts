// Firebase Cloud Functions integration (Simplified)
import { httpsCallable, HttpsCallableResult, getFunctions } from 'firebase/functions';
import { app, auth } from './config';

// Initialize Functions instance
const functions = getFunctions(app, 'us-central1');

// Function interfaces matching your current Supabase functions
export interface SchedulingRequest {
  userMessage: string;
  userId: string;
  context?: any;
}

export interface SchedulingResponse {
  success: boolean;
  message: string;
  operations?: any[];
  error?: string;
}

export interface TranscriptionRequest {
  audioData: string; // base64 encoded audio
  userId: string;
}

export interface TranscriptionResponse {
  success: boolean;
  transcript?: string;
  error?: string;
}

// Cloud function wrappers
export class FirebaseFunctions {
  // Process AI requests with intelligent scheduling (replaces process-scheduling)
  static async processScheduling(data: SchedulingRequest): Promise<SchedulingResponse> {
    try {
      // Ensure user is authenticated and get fresh token
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User must be authenticated');
      }
      
      // Force token refresh to ensure it's valid
      const token = await currentUser.getIdToken(true);
      console.log('Auth token obtained:', token ? 'YES' : 'NO', 'User:', currentUser.uid);
      
      // Make direct HTTP call with Authorization header
      const functionUrl = 'https://us-central1-malleabite-97d35.cloudfunctions.net/processAIRequest';
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          data: {
            message: data.userMessage,
            userId: data.userId,
            context: data.context
          }
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Function call failed:', response.status, errorText);
        throw new Error(`Function call failed: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Function call succeeded!', result);
      
      const responseData = result.result || result.data || result;
      
      // Transform response to match expected format
      return {
        success: responseData.success || false,
        message: responseData.response || responseData.message || 'No response from AI',
        operations: responseData.eventData ? [{ 
          type: 'create_event', 
          data: responseData.eventData,
          conflicts: responseData.conflicts 
        }] : [],
        intent: responseData.intent || 'general',
        actionRequired: responseData.actionRequired || false,
        error: responseData.error
      };
    } catch (error: any) {
      console.error('Error calling processAIRequest function:', error);
      
      // Enhanced intelligent fallback response for development
      const message = data.userMessage.toLowerCase();
      
      if (message.includes('schedule') || message.includes('meeting') || message.includes('event') || 
          message.includes('appointment') || message.includes('create') || message.includes('add')) {
        
        // Try to extract basic scheduling info for a helpful response
        let eventTitle = 'New Event';
        let timeInfo = '';
        
        // Simple pattern matching for titles
        const titleMatch = message.match(/(?:schedule|create|add)\s+(?:a\s+)?(.+?)(?:\s+(?:at|for|tomorrow|today|next))/i);
        if (titleMatch) {
          eventTitle = titleMatch[1].trim();
        }
        
        // Simple pattern matching for time
        const timeMatch = message.match(/(tomorrow|today|next\s+\w+|\d{1,2}\s*(?:am|pm)|\d{1,2}:\d{2}\s*(?:am|pm)|morning|afternoon|evening)/i);
        if (timeMatch) {
          timeInfo = ` ${timeMatch[1]}`;
        }
        
        return {
          success: true,
          message: `I understand you want to schedule "${eventTitle}"${timeInfo}. While the AI functions are being deployed, I can still help! You can manually create this event using the calendar interface. Once the Firebase Functions are deployed, I'll be able to create events automatically with intelligent conflict detection and natural language processing.`,
          operations: [],
          error: undefined
        };
      }
      
      if (message.includes('hello') || message.includes('hi') || message.includes('hey')) {
        return {
          success: true,
          message: `Hello! I'm Mally, your intelligent scheduling assistant. I'm currently running in development mode while Firebase Functions are being deployed. I can help you understand scheduling requests and provide guidance. Try asking me to "schedule a meeting tomorrow at 2 PM" to see how I'll work once fully deployed!`,
          operations: [],
          error: undefined
        };
      }
      
      return {
        success: true,
        message: `I received your message: "${data.userMessage}". While Firebase Functions are being deployed, I'm running in development mode. I can help with scheduling requests, calendar management, and task organization. Once deployed, I'll have full AI capabilities including natural language processing and conflict detection!`,
        operations: [],
        error: undefined
      };
    }
  }

  // Create calendar event using Firebase Functions
  static async createCalendarEvent(eventData: any, userId: string): Promise<any> {
    try {
      const createEventFn = httpsCallable(functions, 'createCalendarEvent');
      
      const result = await createEventFn({
        eventData,
        userId
      });
      
      return result.data;
    } catch (error: any) {
      console.error('Error calling createCalendarEvent function:', error);
      throw error;
    }
  }

  // Transcribe audio - uses mock transcription for development
  // TODO: Implement actual speech-to-text when needed (e.g., using Google Cloud Speech-to-Text)
  static async transcribeAudio(data: TranscriptionRequest): Promise<TranscriptionResponse> {
    // For now, return mock transcriptions since we don't have a transcribeAudio cloud function deployed
    // This allows voice input to work with sample scheduling phrases
    const mockTranscriptions = [
      'Schedule a meeting tomorrow at 2 PM',
      'Create a doctor appointment for Friday morning',
      'Add a lunch meeting with the team next week',
      'Set up a project review for Thursday afternoon',
      'Schedule a call with the client at 3 PM'
    ];
    
    const mockTranscript = mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)];
    
    console.log('Using mock transcription:', mockTranscript);
    
    return {
      success: true,
      transcript: mockTranscript,
      error: undefined
    };
  }

  // Generic function caller for future functions
  static async callFunction<TRequest, TResponse>(
    functionName: string, 
    data: TRequest
  ): Promise<TResponse> {
    try {
      const fn = httpsCallable<TRequest, TResponse>(functions, functionName);
      const result = await fn(data);
      return result.data;
    } catch (error: any) {
      console.error(`Error calling ${functionName} function:`, error);
      throw error;
    }
  }
}

export default FirebaseFunctions;
