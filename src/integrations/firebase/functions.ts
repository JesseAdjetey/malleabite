// Firebase Cloud Functions integration (Simplified)
import { httpsCallable, HttpsCallableResult, getFunctions } from 'firebase/functions';
import { app, auth } from './config';

// Initialize Functions instance
const functions = getFunctions(app, 'us-central1');

// Function interfaces matching your current Supabase functions
export interface SchedulingRequest {
  userMessage: string;
  userId: string;
  imageData?: {
    dataUrl: string;
    mimeType: string;
  };
  context?: any;
  history?: Array<{
    role: 'user' | 'model';
    parts: string;
  }>;
}

export interface SchedulingResponse {
  success: boolean;
  message: string;
  operations?: any[];
  intent?: string;
  actionRequired?: boolean;
  action?: {
    type: string;
    data: {
      title?: string;
      start?: string;
      end?: string;
      description?: string;
      isRecurring?: boolean;
      recurrenceRule?: {
        frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
        interval?: number;
        daysOfWeek?: number[];
        dayOfMonth?: number;
        monthOfYear?: number;
        endDate?: string;
        count?: number;
      };
      eventId?: string;
      todoId?: string;
      [key: string]: any;
    };
  } | null;
  actions?: Array<{
    type: string;
    data: any;
  }>;
  sources?: Array<{
    title: string;
    uri: string;
  }>;
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

export interface GoogleCalendarAuthUrlRequest {
  origin: string;
  loginHint?: string;
}

export interface GoogleCalendarAuthUrlResponse {
  authUrl: string;
  callbackUrl: string;
  state: string;
}

export interface RefreshGoogleCalendarTokenRequest {
  googleAccountId: string;
}

export interface RefreshGoogleCalendarTokenResponse {
  googleAccountId: string;
  email: string;
  accessToken: string;
  expiresIn: number;
}

export interface ListGoogleCalendarsRequest {
  googleAccountId: string;
}

export interface ListGoogleCalendarsResponse {
  googleAccountId: string;
  email: string;
  displayName: string;
  calendars: Array<{
    id: string;
    summary: string;
    primary?: boolean;
    backgroundColor?: string;
  }>;
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

      const token = await currentUser.getIdToken();

      const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'malleabite-97d35';
      const functionUrl = `https://us-central1-${projectId}.cloudfunctions.net/processAIRequest`;

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
            imageData: data.imageData,
            context: data.context,
            history: data.history
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

      // If the response text looks like raw JSON, extract the friendly message and any embedded actions
      let friendlyMessage = responseData.response || responseData.message || 'No response from AI';
      let embeddedActions: any[] = [];
      if (typeof friendlyMessage === 'string' && friendlyMessage.trimStart().startsWith('{')) {
        try {
          const parsed = JSON.parse(friendlyMessage);
          friendlyMessage = parsed.response || parsed.message || friendlyMessage;
          // Extract actions embedded in the nested JSON
          if (parsed.actions && Array.isArray(parsed.actions)) {
            embeddedActions = parsed.actions;
          }
        } catch {
          // Not valid JSON, use as-is
        }
      }

      // Transform response to match expected format
      // Include the action field with recurring event properties
      return {
        success: responseData.success || false,
        message: friendlyMessage,
        operations: responseData.eventData ? [{
          type: 'create_event',
          data: responseData.eventData,
          conflicts: responseData.conflicts
        }] : [],
        intent: responseData.intent || 'general',
        actionRequired: responseData.actionRequired || false,
        action: responseData.action || null,
        actions: (responseData.actions && responseData.actions.length > 0) ? responseData.actions : embeddedActions,
        sources: responseData.sources || [],
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

  static async getGoogleCalendarAuthUrl(
    data: GoogleCalendarAuthUrlRequest
  ): Promise<GoogleCalendarAuthUrlResponse> {
    return FirebaseFunctions.callFunction<GoogleCalendarAuthUrlRequest, GoogleCalendarAuthUrlResponse>(
      'getGoogleCalendarAuthUrl',
      data,
    );
  }

  static async refreshGoogleCalendarAccessToken(
    data: RefreshGoogleCalendarTokenRequest
  ): Promise<RefreshGoogleCalendarTokenResponse> {
    return FirebaseFunctions.callFunction<RefreshGoogleCalendarTokenRequest, RefreshGoogleCalendarTokenResponse>(
      'refreshGoogleCalendarAccessToken',
      data,
    );
  }

  static async listGoogleCalendarsForAccount(
    data: ListGoogleCalendarsRequest
  ): Promise<ListGoogleCalendarsResponse> {
    return FirebaseFunctions.callFunction<ListGoogleCalendarsRequest, ListGoogleCalendarsResponse>(
      'listGoogleCalendarsForAccount',
      data,
    );
  }

  // ─── Streaming endpoint — real-time Gemini speech + TTS ─────────────────────
  // Yields events as they arrive from the Firebase SSE stream.
  // event.type === 'speech'      → partial text chunk (for progressive display + TTS queue)
  // event.type === 'speech_done' → all speech text has been sent (JSON actions coming)
  // event.type === 'done'        → { speechText, actions, intent, actionRequired }
  // event.type === 'error'       → { message }
  static async *processSchedulingStreamEvents(
    data: SchedulingRequest,
  ): AsyncGenerator<{ type: string; text?: string; speechText?: string; actions?: any[]; intent?: string; actionRequired?: boolean; message?: string }> {
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || 'malleabite-97d35';
    const STREAM_URL = `https://us-central1-${projectId}.cloudfunctions.net/processSchedulingStream`;

    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');

    const token = await currentUser.getIdToken(false);

    const response = await fetch(STREAM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        userMessage: data.userMessage,
        userId: data.userId,
        context: data.context,
        history: data.history,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Stream request failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            yield JSON.parse(line.slice(6));
          } catch { /* malformed chunk — skip */ }
        }
      }
    }
  }
}

export default FirebaseFunctions;
