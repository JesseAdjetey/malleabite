interface GoogleCalendarListItem {
    id: string;
    summary: string;
    primary?: boolean;
    backgroundColor?: string;
}
export declare const getGoogleCalendarAuthUrl: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    authUrl: string;
    callbackUrl: string;
    state: string;
}>, unknown>;
export declare const googleCalendarOAuthCallback: import("firebase-functions/v2/https").HttpsFunction;
export declare const refreshGoogleCalendarAccessToken: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    googleAccountId: any;
    email: string;
    accessToken: string;
    expiresIn: number;
}>, unknown>;
export declare const listGoogleCalendarsForAccount: import("firebase-functions/v2/https").CallableFunction<any, Promise<{
    googleAccountId: any;
    email: string;
    displayName: string;
    calendars: GoogleCalendarListItem[];
}>, unknown>;
export {};
