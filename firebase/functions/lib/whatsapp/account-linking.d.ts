export declare function generateLinkCode(): string;
export declare function storeLinkCode(userId: string, code: string): Promise<void>;
export interface LinkResult {
    success: boolean;
    userId?: string;
    error?: string;
}
export declare function redeemLinkCode(phoneNumber: string, code: string): Promise<LinkResult>;
export declare function getLinkedUserId(phoneNumber: string): Promise<string | null>;
export declare function unlinkAccount(phoneNumber: string): Promise<boolean>;
