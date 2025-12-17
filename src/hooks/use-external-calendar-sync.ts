// External Calendar Sync Hook - ICS subscription, CalDAV, Google/Outlook sync
import { useState, useCallback, useEffect } from 'react';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { CalendarEventType } from '@/lib/stores/types';

export type SyncProvider = 'ics_url' | 'google' | 'outlook' | 'caldav' | 'apple';

export interface ExternalCalendar {
  id: string;
  userId: string;
  provider: SyncProvider;
  name: string;
  url?: string; // For ICS/CalDAV
  color: string;
  isVisible: boolean;
  syncEnabled: boolean;
  syncInterval: number; // minutes
  lastSyncAt?: string;
  lastSyncStatus?: 'success' | 'error' | 'pending';
  lastSyncError?: string;
  
  // OAuth tokens for Google/Outlook
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  
  // CalDAV specific
  caldavUsername?: string;
  caldavPassword?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface SyncResult {
  success: boolean;
  eventsAdded: number;
  eventsUpdated: number;
  eventsDeleted: number;
  errors: string[];
}

// Parse ICS content to events
export function parseICSContent(icsContent: string, calendarId: string): Partial<CalendarEventType>[] {
  const events: Partial<CalendarEventType>[] = [];
  
  // Split into individual VEVENT blocks
  const veventRegex = /BEGIN:VEVENT[\s\S]*?END:VEVENT/g;
  const veventMatches = icsContent.match(veventRegex) || [];
  
  for (const vevent of veventMatches) {
    try {
      const event: Partial<CalendarEventType> = {
        calendarId,
      };
      
      // Parse UID
      const uidMatch = vevent.match(/UID:(.+)/);
      if (uidMatch) {
        event.id = `ext-${uidMatch[1].trim()}`;
      }
      
      // Parse SUMMARY (title)
      const summaryMatch = vevent.match(/SUMMARY:(.+)/);
      if (summaryMatch) {
        event.title = summaryMatch[1].trim();
      }
      
      // Parse DESCRIPTION
      const descMatch = vevent.match(/DESCRIPTION:(.+)/);
      if (descMatch) {
        event.description = descMatch[1].trim().replace(/\\n/g, '\n');
      }
      
      // Parse LOCATION
      const locationMatch = vevent.match(/LOCATION:(.+)/);
      if (locationMatch) {
        event.location = locationMatch[1].trim();
      }
      
      // Parse DTSTART
      const dtstartMatch = vevent.match(/DTSTART(?:;[^:]+)?:(\d+T?\d*Z?)/);
      if (dtstartMatch) {
        const dtstart = dtstartMatch[1];
        if (dtstart.length === 8) {
          // All-day event (YYYYMMDD)
          event.startsAt = dayjs(dtstart, 'YYYYMMDD').startOf('day').toISOString();
          event.isAllDay = true;
        } else {
          // Timed event
          event.startsAt = dayjs(dtstart.replace('Z', '')).toISOString();
        }
      }
      
      // Parse DTEND
      const dtendMatch = vevent.match(/DTEND(?:;[^:]+)?:(\d+T?\d*Z?)/);
      if (dtendMatch) {
        const dtend = dtendMatch[1];
        if (dtend.length === 8) {
          event.endsAt = dayjs(dtend, 'YYYYMMDD').endOf('day').toISOString();
        } else {
          event.endsAt = dayjs(dtend.replace('Z', '')).toISOString();
        }
      }
      
      // Parse RRULE for recurrence
      const rruleMatch = vevent.match(/RRULE:(.+)/);
      if (rruleMatch) {
        event.isRecurring = true;
        const rrule = rruleMatch[1];
        
        const freqMatch = rrule.match(/FREQ=(\w+)/);
        const intervalMatch = rrule.match(/INTERVAL=(\d+)/);
        const untilMatch = rrule.match(/UNTIL=(\d+)/);
        const countMatch = rrule.match(/COUNT=(\d+)/);
        const bydayMatch = rrule.match(/BYDAY=([^;]+)/);
        
        event.recurrenceRule = {
          frequency: (freqMatch?.[1]?.toLowerCase() as any) || 'daily',
          interval: intervalMatch ? parseInt(intervalMatch[1]) : 1,
        };
        
        if (untilMatch) {
          event.recurrenceRule.endDate = dayjs(untilMatch[1], 'YYYYMMDD').toISOString();
        }
        if (countMatch) {
          event.recurrenceRule.count = parseInt(countMatch[1]);
        }
        if (bydayMatch) {
          const dayMap: Record<string, number> = {
            'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6
          };
          event.recurrenceRule.daysOfWeek = bydayMatch[1]
            .split(',')
            .map(d => dayMap[d.trim()])
            .filter(d => d !== undefined);
        }
      }
      
      // Parse STATUS
      const statusMatch = vevent.match(/STATUS:(\w+)/);
      if (statusMatch) {
        const status = statusMatch[1].toLowerCase();
        if (status === 'cancelled') event.status = 'cancelled';
        else if (status === 'tentative') event.status = 'tentative';
        else event.status = 'confirmed';
      }
      
      if (event.title && event.startsAt) {
        events.push(event);
      }
    } catch (error) {
      console.error('Failed to parse VEVENT:', error);
    }
  }
  
  return events;
}

// Generate ICS content from events
export function generateICSContent(
  events: CalendarEventType[],
  calendarName: string = 'Malleabite Calendar'
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Malleabite//Calendar//EN',
    `X-WR-CALNAME:${calendarName}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  
  for (const event of events) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.id}@malleabite.com`);
    lines.push(`DTSTAMP:${dayjs().format('YYYYMMDDTHHmmss')}Z`);
    
    if (event.isAllDay) {
      lines.push(`DTSTART;VALUE=DATE:${dayjs(event.startsAt).format('YYYYMMDD')}`);
      lines.push(`DTEND;VALUE=DATE:${dayjs(event.endsAt).add(1, 'day').format('YYYYMMDD')}`);
    } else {
      lines.push(`DTSTART:${dayjs(event.startsAt).format('YYYYMMDDTHHmmss')}Z`);
      lines.push(`DTEND:${dayjs(event.endsAt).format('YYYYMMDDTHHmmss')}Z`);
    }
    
    lines.push(`SUMMARY:${event.title.replace(/\n/g, '\\n')}`);
    
    if (event.description) {
      lines.push(`DESCRIPTION:${event.description.replace(/\n/g, '\\n')}`);
    }
    
    if (event.location) {
      lines.push(`LOCATION:${event.location}`);
    }
    
    if (event.isRecurring && event.recurrenceRule) {
      const rule = event.recurrenceRule;
      let rrule = `RRULE:FREQ=${rule.frequency.toUpperCase()}`;
      
      if (rule.interval > 1) {
        rrule += `;INTERVAL=${rule.interval}`;
      }
      if (rule.endDate) {
        rrule += `;UNTIL=${dayjs(rule.endDate).format('YYYYMMDD')}`;
      }
      if (rule.count) {
        rrule += `;COUNT=${rule.count}`;
      }
      if (rule.daysOfWeek) {
        const dayNames = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
        rrule += `;BYDAY=${rule.daysOfWeek.map(d => dayNames[d]).join(',')}`;
      }
      
      lines.push(rrule);
    }
    
    if (event.status === 'cancelled') {
      lines.push('STATUS:CANCELLED');
    } else if (event.status === 'tentative') {
      lines.push('STATUS:TENTATIVE');
    } else {
      lines.push('STATUS:CONFIRMED');
    }
    
    lines.push('END:VEVENT');
  }
  
  lines.push('END:VCALENDAR');
  
  return lines.join('\r\n');
}

export function useExternalCalendarSync() {
  const { user } = useAuth();
  const [externalCalendars, setExternalCalendars] = useState<ExternalCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  // Fetch user's external calendars
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const fetchCalendars = async () => {
      try {
        const calendarsRef = collection(db, 'external_calendars');
        const q = query(calendarsRef, where('userId', '==', user.uid));
        const snapshot = await getDocs(q);
        
        const calendars = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as ExternalCalendar[];
        
        setExternalCalendars(calendars);
      } catch (error) {
        console.error('Failed to fetch external calendars:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCalendars();
  }, [user?.uid]);

  // Add ICS subscription
  const addICSSubscription = useCallback(async (
    name: string,
    url: string,
    color: string = '#6366f1'
  ) => {
    if (!user?.uid) return { success: false };

    try {
      const calendarData: Omit<ExternalCalendar, 'id'> = {
        userId: user.uid,
        provider: 'ics_url',
        name,
        url,
        color,
        isVisible: true,
        syncEnabled: true,
        syncInterval: 60, // hourly
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'external_calendars'), calendarData);
      const newCalendar = { id: docRef.id, ...calendarData };
      
      setExternalCalendars(prev => [...prev, newCalendar]);
      toast.success('Calendar subscription added');
      
      // Trigger initial sync
      syncCalendar(newCalendar.id);
      
      return { success: true, calendar: newCalendar };
    } catch (error) {
      console.error('Failed to add ICS subscription:', error);
      toast.error('Failed to add calendar');
      return { success: false, error };
    }
  }, [user?.uid]);

  // Sync a calendar
  const syncCalendar = useCallback(async (calendarId: string): Promise<SyncResult> => {
    const calendar = externalCalendars.find(c => c.id === calendarId);
    if (!calendar) {
      return { success: false, eventsAdded: 0, eventsUpdated: 0, eventsDeleted: 0, errors: ['Calendar not found'] };
    }

    setSyncing(calendarId);
    
    try {
      if (calendar.provider === 'ics_url' && calendar.url) {
        // Fetch ICS content
        const response = await fetch(calendar.url);
        if (!response.ok) {
          throw new Error(`Failed to fetch ICS: ${response.status}`);
        }
        
        const icsContent = await response.text();
        const events = parseICSContent(icsContent, calendarId);
        
        // Update sync status
        await updateDoc(doc(db, 'external_calendars', calendarId), {
          lastSyncAt: new Date().toISOString(),
          lastSyncStatus: 'success',
          lastSyncError: null,
          updatedAt: new Date().toISOString(),
        });
        
        setExternalCalendars(prev =>
          prev.map(c =>
            c.id === calendarId
              ? { ...c, lastSyncAt: new Date().toISOString(), lastSyncStatus: 'success' as const }
              : c
          )
        );
        
        toast.success(`Synced ${events.length} events`);
        
        return {
          success: true,
          eventsAdded: events.length,
          eventsUpdated: 0,
          eventsDeleted: 0,
          errors: [],
        };
      }
      
      // For OAuth providers (Google, Outlook), would need API calls
      toast.info('OAuth sync not yet implemented');
      return { success: false, eventsAdded: 0, eventsUpdated: 0, eventsDeleted: 0, errors: ['Not implemented'] };
    } catch (error) {
      console.error('Sync failed:', error);
      
      await updateDoc(doc(db, 'external_calendars', calendarId), {
        lastSyncAt: new Date().toISOString(),
        lastSyncStatus: 'error',
        lastSyncError: (error as Error).message,
        updatedAt: new Date().toISOString(),
      });
      
      toast.error('Sync failed');
      
      return {
        success: false,
        eventsAdded: 0,
        eventsUpdated: 0,
        eventsDeleted: 0,
        errors: [(error as Error).message],
      };
    } finally {
      setSyncing(null);
    }
  }, [externalCalendars]);

  // Connect Google Calendar (OAuth)
  const connectGoogleCalendar = useCallback(async () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      toast.error('Google Calendar integration not configured');
      return;
    }

    const redirectUri = `${window.location.origin}/auth/google/callback`;
    const scope = 'https://www.googleapis.com/auth/calendar.readonly';
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent`;
    
    window.location.href = authUrl;
  }, []);

  // Connect Outlook Calendar (OAuth)
  const connectOutlookCalendar = useCallback(async () => {
    const clientId = import.meta.env.VITE_MICROSOFT_CLIENT_ID;
    if (!clientId) {
      toast.error('Outlook Calendar integration not configured');
      return;
    }

    const redirectUri = `${window.location.origin}/auth/microsoft/callback`;
    const scope = 'Calendars.Read';
    const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
    
    window.location.href = authUrl;
  }, []);

  // Remove external calendar
  const removeCalendar = useCallback(async (calendarId: string) => {
    try {
      await deleteDoc(doc(db, 'external_calendars', calendarId));
      setExternalCalendars(prev => prev.filter(c => c.id !== calendarId));
      toast.success('Calendar removed');
      return { success: true };
    } catch (error) {
      console.error('Failed to remove calendar:', error);
      toast.error('Failed to remove calendar');
      return { success: false, error };
    }
  }, []);

  // Toggle calendar visibility
  const toggleVisibility = useCallback(async (calendarId: string) => {
    const calendar = externalCalendars.find(c => c.id === calendarId);
    if (!calendar) return;

    try {
      await updateDoc(doc(db, 'external_calendars', calendarId), {
        isVisible: !calendar.isVisible,
        updatedAt: new Date().toISOString(),
      });

      setExternalCalendars(prev =>
        prev.map(c =>
          c.id === calendarId
            ? { ...c, isVisible: !c.isVisible }
            : c
        )
      );
    } catch (error) {
      console.error('Failed to toggle visibility:', error);
      toast.error('Failed to update calendar');
    }
  }, [externalCalendars]);

  // Export calendar as ICS
  const exportAsICS = useCallback((events: CalendarEventType[], filename: string = 'calendar.ics') => {
    const icsContent = generateICSContent(events);
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('Calendar exported');
  }, []);

  // Get public ICS subscription URL for user's calendar
  const getSubscriptionUrl = useCallback(() => {
    if (!user?.uid) return null;
    // In production, this would be a cloud function URL
    return `${window.location.origin}/api/calendar/${user.uid}/feed.ics`;
  }, [user?.uid]);

  return {
    externalCalendars,
    loading,
    syncing,
    addICSSubscription,
    syncCalendar,
    connectGoogleCalendar,
    connectOutlookCalendar,
    removeCalendar,
    toggleVisibility,
    exportAsICS,
    getSubscriptionUrl,
    parseICSContent,
    generateICSContent,
  };
}

export default useExternalCalendarSync;
