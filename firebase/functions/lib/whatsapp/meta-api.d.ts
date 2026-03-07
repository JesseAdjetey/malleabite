interface SendMessageOptions {
    phoneNumberId: string;
    accessToken: string;
    to: string;
}
export declare function sendTextMessage(opts: SendMessageOptions, text: string): Promise<void>;
interface Button {
    id: string;
    title: string;
}
export declare function sendButtonMessage(opts: SendMessageOptions, body: string, buttons: Button[], header?: string, footer?: string): Promise<void>;
interface ListRow {
    id: string;
    title: string;
    description?: string;
}
interface ListSection {
    title: string;
    rows: ListRow[];
}
export declare function sendListMessage(opts: SendMessageOptions, body: string, buttonText: string, sections: ListSection[], header?: string, footer?: string): Promise<void>;
export declare function markAsRead(opts: Omit<SendMessageOptions, 'to'>, messageId: string): Promise<void>;
export declare function sendReaction(opts: SendMessageOptions, messageId: string, emoji: string): Promise<void>;
export {};
