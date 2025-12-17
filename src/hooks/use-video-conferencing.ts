// Video Conferencing Integration Hook - Auto-generate meeting links
import { useState, useCallback } from 'react';
import { toast } from 'sonner';

export type ConferenceProvider = 'zoom' | 'google_meet' | 'teams' | 'jitsi' | 'custom';

export interface ConferenceSettings {
  provider: ConferenceProvider;
  autoAddToEvents: boolean;
  defaultDuration: number; // minutes
  // Provider-specific settings
  zoomSettings?: ZoomSettings;
  teamsSettings?: TeamsSettings;
}

export interface ZoomSettings {
  connected: boolean;
  userId?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  defaultSettings: {
    waitingRoom: boolean;
    muteOnEntry: boolean;
    autoRecording: 'none' | 'local' | 'cloud';
  };
}

export interface TeamsSettings {
  connected: boolean;
  tenantId?: string;
  accessToken?: string;
}

export interface MeetingLink {
  url: string;
  provider: ConferenceProvider;
  meetingId?: string;
  password?: string;
  dialIn?: string;
  hostUrl?: string;
  createdAt: string;
}

// Generate a unique Jitsi Meet room name
const generateJitsiRoomName = (eventTitle: string): string => {
  const sanitized = eventTitle
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 30);
  const random = Math.random().toString(36).substring(2, 8);
  return `${sanitized}-${random}`;
};

// Generate meeting link based on provider
export async function generateMeetingLink(
  provider: ConferenceProvider,
  eventTitle: string,
  startTime: Date,
  duration: number, // minutes
  settings?: ConferenceSettings
): Promise<MeetingLink | null> {
  try {
    switch (provider) {
      case 'jitsi': {
        // Jitsi Meet is free and requires no authentication
        const roomName = generateJitsiRoomName(eventTitle);
        return {
          url: `https://meet.jit.si/${roomName}`,
          provider: 'jitsi',
          meetingId: roomName,
          createdAt: new Date().toISOString(),
        };
      }

      case 'zoom': {
        // Zoom requires OAuth - check if connected
        if (!settings?.zoomSettings?.connected) {
          toast.error('Please connect your Zoom account in Settings');
          return null;
        }
        // In production, this would call Zoom API
        // For now, return a placeholder that would be replaced by actual API call
        const meetingId = Math.floor(Math.random() * 10000000000).toString();
        return {
          url: `https://zoom.us/j/${meetingId}`,
          provider: 'zoom',
          meetingId,
          password: Math.random().toString(36).substring(2, 8),
          createdAt: new Date().toISOString(),
        };
      }

      case 'google_meet': {
        // Google Meet requires OAuth with Google Calendar API
        // This would integrate with Google Calendar API
        const meetCode = Math.random().toString(36).substring(2, 12).replace(/(.{3})(.{3})(.{3})/, '$1-$2-$3');
        return {
          url: `https://meet.google.com/${meetCode}`,
          provider: 'google_meet',
          meetingId: meetCode,
          createdAt: new Date().toISOString(),
        };
      }

      case 'teams': {
        // Microsoft Teams requires Graph API
        if (!settings?.teamsSettings?.connected) {
          toast.error('Please connect your Microsoft account in Settings');
          return null;
        }
        const meetingId = crypto.randomUUID();
        return {
          url: `https://teams.microsoft.com/l/meetup-join/${meetingId}`,
          provider: 'teams',
          meetingId,
          createdAt: new Date().toISOString(),
        };
      }

      case 'custom': {
        // User provides their own link
        return null;
      }

      default:
        return null;
    }
  } catch (error) {
    console.error('Failed to generate meeting link:', error);
    toast.error('Failed to generate meeting link');
    return null;
  }
}

export function useVideoConferencing() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [settings, setSettings] = useState<ConferenceSettings>({
    provider: 'jitsi',
    autoAddToEvents: false,
    defaultDuration: 60,
  });

  // Generate a meeting link
  const createMeeting = useCallback(async (
    eventTitle: string,
    startTime: Date,
    duration: number = 60,
    provider?: ConferenceProvider
  ): Promise<MeetingLink | null> => {
    setIsGenerating(true);
    try {
      const link = await generateMeetingLink(
        provider || settings.provider,
        eventTitle,
        startTime,
        duration,
        settings
      );
      if (link) {
        toast.success(`${link.provider} meeting created`);
      }
      return link;
    } finally {
      setIsGenerating(false);
    }
  }, [settings]);

  // Connect Zoom account (OAuth flow)
  const connectZoom = useCallback(async () => {
    // In production, this would redirect to Zoom OAuth
    const clientId = import.meta.env.VITE_ZOOM_CLIENT_ID;
    if (!clientId) {
      toast.error('Zoom integration not configured');
      return;
    }
    
    const redirectUri = `${window.location.origin}/auth/zoom/callback`;
    const scope = 'meeting:write';
    const authUrl = `https://zoom.us/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;
    
    window.location.href = authUrl;
  }, []);

  // Connect Microsoft Teams (OAuth flow)
  const connectTeams = useCallback(async () => {
    const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
    if (!clientId) {
      toast.error('Microsoft integration not configured');
      return;
    }

    const redirectUri = `${window.location.origin}/auth/microsoft/callback`;
    const scope = 'OnlineMeetings.ReadWrite';
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;
    
    window.location.href = authUrl;
  }, []);

  // Disconnect a provider
  const disconnectProvider = useCallback((provider: ConferenceProvider) => {
    setSettings(prev => {
      if (provider === 'zoom') {
        return { ...prev, zoomSettings: undefined };
      }
      if (provider === 'teams') {
        return { ...prev, teamsSettings: undefined };
      }
      return prev;
    });
    toast.success(`${provider} disconnected`);
  }, []);

  // Quick action: Add meeting to existing event
  const addMeetingToEvent = useCallback(async (
    eventId: string,
    provider: ConferenceProvider = 'jitsi'
  ): Promise<MeetingLink | null> => {
    return createMeeting('Meeting', new Date(), 60, provider);
  }, [createMeeting]);

  return {
    settings,
    setSettings,
    isGenerating,
    createMeeting,
    addMeetingToEvent,
    connectZoom,
    connectTeams,
    disconnectProvider,
    isZoomConnected: settings.zoomSettings?.connected || false,
    isTeamsConnected: settings.teamsSettings?.connected || false,
  };
}

export default useVideoConferencing;
