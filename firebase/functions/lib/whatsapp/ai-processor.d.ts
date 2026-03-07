export interface AIResponse {
    text?: string;
    actions?: ProposedAction[];
    error?: string;
}
export interface ProposedAction {
    type: 'create_event' | 'create_todo';
    title?: string;
    start?: string;
    end?: string;
    description?: string;
    isAllDay?: boolean;
    text?: string;
    listName?: string;
}
export declare function processAIRequestInternal(userId: string, message: string, chatHistory?: {
    role: 'user' | 'model';
    text: string;
}[]): Promise<AIResponse>;
