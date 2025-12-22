// Video Conferencing Link Generator
// Generates meeting links for various providers

export type MeetingProvider = 'zoom' | 'google_meet' | 'teams' | 'custom';

interface MeetingLinkConfig {
  provider: MeetingProvider;
  eventTitle: string;
  startTime?: Date;
  duration?: number; // minutes
  description?: string;
}

interface GeneratedMeetingLink {
  provider: MeetingProvider;
  url: string;
  displayText: string;
  icon: string;
}

// Generate a unique meeting ID
function generateMeetingId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const segments = [3, 4, 3]; // xxx-xxxx-xxx format
  return segments
    .map((len) =>
      Array.from({ length: len }, () =>
        chars.charAt(Math.floor(Math.random() * chars.length))
      ).join('')
    )
    .join('-');
}

// Generate a Google Meet-style link (for demo purposes)
function generateGoogleMeetLink(config: MeetingLinkConfig): GeneratedMeetingLink {
  // In production, you would use Google Calendar API to create actual Meet links
  // This generates a placeholder link that looks like Meet
  const meetId = generateMeetingId();
  
  return {
    provider: 'google_meet',
    url: `https://meet.google.com/${meetId}`,
    displayText: `meet.google.com/${meetId}`,
    icon: '📹',
  };
}

// Generate a Zoom-style link
function generateZoomLink(config: MeetingLinkConfig): GeneratedMeetingLink {
  // In production, you would use Zoom API to create actual meetings
  // This generates a placeholder that shows the format
  const meetingId = Math.floor(Math.random() * 9000000000) + 1000000000;
  const password = Math.random().toString(36).substring(2, 8);
  
  return {
    provider: 'zoom',
    url: `https://zoom.us/j/${meetingId}?pwd=${password}`,
    displayText: `zoom.us/j/${meetingId}`,
    icon: '🎥',
  };
}

// Generate a Teams-style link
function generateTeamsLink(config: MeetingLinkConfig): GeneratedMeetingLink {
  // In production, you would use Microsoft Graph API
  const threadId = Math.random().toString(36).substring(2, 12);
  
  return {
    provider: 'teams',
    url: `https://teams.microsoft.com/l/meetup-join/19%3ameeting_${threadId}`,
    displayText: 'Join Teams Meeting',
    icon: '💬',
  };
}

// Main function to generate meeting links
export function generateMeetingLink(config: MeetingLinkConfig): GeneratedMeetingLink {
  switch (config.provider) {
    case 'google_meet':
      return generateGoogleMeetLink(config);
    case 'zoom':
      return generateZoomLink(config);
    case 'teams':
      return generateTeamsLink(config);
    case 'custom':
      return {
        provider: 'custom',
        url: '',
        displayText: 'Custom Meeting Link',
        icon: '🔗',
      };
    default:
      return generateGoogleMeetLink(config);
  }
}

// Quick action to add meeting link to event
export function addMeetingToEvent(
  provider: MeetingProvider,
  eventTitle: string
): { meetingUrl: string; meetingProvider: MeetingProvider } {
  const meeting = generateMeetingLink({ provider, eventTitle });
  
  return {
    meetingUrl: meeting.url,
    meetingProvider: provider,
  };
}

// Get provider info for display
export function getMeetingProviderInfo(provider: MeetingProvider) {
  const providers = {
    google_meet: {
      name: 'Google Meet',
      icon: '📹',
      color: '#00897B',
      description: 'Video meetings by Google',
    },
    zoom: {
      name: 'Zoom',
      icon: '🎥',
      color: '#2D8CFF',
      description: 'Zoom Video Communications',
    },
    teams: {
      name: 'Microsoft Teams',
      icon: '💬',
      color: '#6264A7',
      description: 'Microsoft Teams meeting',
    },
    custom: {
      name: 'Custom Link',
      icon: '🔗',
      color: '#8b5cf6',
      description: 'Add your own meeting link',
    },
  };

  return providers[provider] || providers.custom;
}

// Check if a URL is a valid meeting link
export function detectMeetingProvider(url: string): MeetingProvider | null {
  if (!url) return null;
  
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes('meet.google.com')) return 'google_meet';
  if (lowerUrl.includes('zoom.us') || lowerUrl.includes('zoomgov.com')) return 'zoom';
  if (lowerUrl.includes('teams.microsoft.com') || lowerUrl.includes('teams.live.com')) return 'teams';
  if (lowerUrl.includes('webex.com')) return 'custom';
  if (lowerUrl.includes('whereby.com')) return 'custom';
  if (lowerUrl.includes('around.co')) return 'custom';
  
  // Check if it's a valid URL at all
  try {
    new URL(url);
    return 'custom';
  } catch {
    return null;
  }
}

// Format meeting link for display
export function formatMeetingLink(url: string, provider?: MeetingProvider): string {
  if (!url) return '';
  
  try {
    const urlObj = new URL(url);
    const detectedProvider = provider || detectMeetingProvider(url);
    
    switch (detectedProvider) {
      case 'google_meet':
        return url.replace('https://meet.google.com/', 'meet.google.com/');
      case 'zoom':
        const meetingId = urlObj.pathname.replace('/j/', '');
        return `zoom.us/j/${meetingId}`;
      case 'teams':
        return 'Join Teams Meeting';
      default:
        return urlObj.hostname;
    }
  } catch {
    return url;
  }
}
