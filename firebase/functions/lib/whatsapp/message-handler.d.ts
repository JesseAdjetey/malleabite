interface MessageContext {
    phoneNumberId: string;
    accessToken: string;
    from: string;
    messageId: string;
    isGroup: boolean;
    groupId?: string;
    isForwarded?: boolean;
}
export declare function handleIncomingMessage(ctx: MessageContext, message: any): Promise<void>;
export {};
