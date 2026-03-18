export interface PendingAction {
    type: 'create_event' | 'update_event' | 'delete_event' | 'create_todo' | 'complete_todo' | 'delete_todo' | 'create_alarm' | 'delete_alarm' | 'create_eisenhower' | 'create_goal' | 'create_group_meet';
    participantEmails?: string[];
    meetWindow?: 'today' | '3days' | 'week' | '2weeks';
    duration?: number;
    title?: string;
    start?: string;
    end?: string;
    description?: string;
    isAllDay?: boolean;
    eventId?: string;
    text?: string;
    listId?: string;
    listName?: string;
    todoId?: string;
    time?: string;
    alarmId?: string;
    quadrant?: 'urgent-important' | 'not-urgent-important' | 'urgent-not-important' | 'not-urgent-not-important';
    category?: string;
    frequency?: 'daily' | 'weekly' | 'monthly';
    target?: number;
}
export interface ChatMessage {
    role: 'user' | 'model';
    text: string;
    ts: number;
}
export declare function getPendingAction(phone: string): Promise<PendingAction | null>;
export declare function setPendingAction(phone: string, action: PendingAction): Promise<void>;
export declare function clearPendingAction(phone: string): Promise<void>;
export declare function getChatHistory(phone: string): Promise<ChatMessage[]>;
export declare function appendChatHistory(phone: string, userMsg: string, modelMsg: string): Promise<void>;
export declare function clearChatHistory(phone: string): Promise<void>;
export declare function setLastCreated(phone: string, docId: string, type: 'event' | 'todo' | 'alarm' | 'eisenhower' | 'goal' | 'group_meet', collection: string): Promise<void>;
export declare function undoLastCreated(phone: string): Promise<{
    success: boolean;
    type?: string;
}>;
