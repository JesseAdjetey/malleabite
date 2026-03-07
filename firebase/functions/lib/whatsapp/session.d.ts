export interface PendingAction {
    type: 'create_event' | 'create_todo';
    title?: string;
    start?: string;
    end?: string;
    description?: string;
    isAllDay?: boolean;
    text?: string;
    listId?: string;
    listName?: string;
}
export declare function getPendingAction(phone: string): Promise<PendingAction | null>;
export declare function setPendingAction(phone: string, action: PendingAction): Promise<void>;
export declare function clearPendingAction(phone: string): Promise<void>;
export declare function setLastCreated(phone: string, docId: string, type: 'event' | 'todo', collection: string): Promise<void>;
export declare function undoLastCreated(phone: string): Promise<{
    success: boolean;
    type?: string;
}>;
