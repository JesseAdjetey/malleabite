export interface AIResponse {
    text?: string;
    actions?: ProposedAction[];
    error?: string;
}
export interface ProposedAction {
    type: 'create_event' | 'update_event' | 'delete_event' | 'create_todo' | 'complete_todo' | 'delete_todo' | 'create_alarm' | 'delete_alarm' | 'create_eisenhower' | 'create_goal' | 'create_group_meet';
    participantEmails?: string[];
    meetWindow?: 'today' | '3days' | 'week' | '2weeks';
    title?: string;
    start?: string;
    end?: string;
    description?: string;
    isAllDay?: boolean;
    eventId?: string;
    text?: string;
    listName?: string;
    todoId?: string;
    alarmId?: string;
    time?: string;
    quadrant?: 'urgent-important' | 'not-urgent-important' | 'urgent-not-important' | 'not-urgent-not-important';
    category?: string;
    frequency?: 'daily' | 'weekly' | 'monthly';
    target?: number;
}
export declare function processAIRequestInternal(userId: string, message: string, chatHistory?: {
    role: 'user' | 'model';
    text: string;
}[]): Promise<AIResponse>;
