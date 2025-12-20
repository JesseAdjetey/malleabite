// Multiple Calendars Hook - Manage multiple calendars per user
import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  orderBy,
  serverTimestamp,
  Timestamp,
  getDocs
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { toast } from 'sonner';

// Calendar Types
export interface UserCalendar {
  id: string;
  userId: string;
  name: string;
  description?: string;
  color: string;
  isDefault: boolean;
  isVisible: boolean;
  isPrimary: boolean;
  shareSettings: CalendarShareSettings;
  defaultReminders: CalendarReminder[];
  timeZone?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalendarShareSettings {
  isPublic: boolean;
  shareLink?: string;
  sharedWith: SharedUser[];
}

export interface SharedUser {
  userId?: string;
  email: string;
  permission: 'view' | 'edit' | 'manage';
  addedAt: string;
}

export interface CalendarReminder {
  type: 'notification' | 'email';
  minutesBefore: number;
}

export interface CalendarFormData {
  name: string;
  description?: string;
  color: string;
  timeZone?: string;
  defaultReminders?: CalendarReminder[];
}

// Default calendar colors (Google Calendar-style)
export const CALENDAR_COLORS = [
  { value: '#7986cb', label: 'Lavender' },
  { value: '#33b679', label: 'Sage' },
  { value: '#8e24aa', label: 'Grape' },
  { value: '#e67c73', label: 'Flamingo' },
  { value: '#f6bf26', label: 'Banana' },
  { value: '#f4511e', label: 'Tangerine' },
  { value: '#039be5', label: 'Peacock' },
  { value: '#616161', label: 'Graphite' },
  { value: '#3f51b5', label: 'Blueberry' },
  { value: '#0b8043', label: 'Basil' },
  { value: '#d50000', label: 'Tomato' },
];

export function useCalendars() {
  const [calendars, setCalendars] = useState<UserCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Convert Firebase doc to UserCalendar
  const convertFirebaseCalendar = (doc: any): UserCalendar => {
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId,
      name: data.name || 'Untitled Calendar',
      description: data.description || '',
      color: data.color || CALENDAR_COLORS[0].value,
      isDefault: data.isDefault || false,
      isVisible: data.isVisible !== false, // Default to visible
      isPrimary: data.isPrimary || false,
      shareSettings: data.shareSettings || { isPublic: false, sharedWith: [] },
      defaultReminders: data.defaultReminders || [{ type: 'notification', minutesBefore: 30 }],
      timeZone: data.timeZone,
      createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    };
  };

  // Subscribe to calendars
  useEffect(() => {
    if (!user?.uid) {
      setCalendars([]);
      setLoading(false);
      return;
    }

    // Clean up previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    setLoading(true);

    const calendarsQuery = query(
      collection(db, 'calendars'),
      where('userId', '==', user.uid),
      orderBy('isPrimary', 'desc'),
      orderBy('name', 'asc')
    );

    const unsubscribe = onSnapshot(
      calendarsQuery,
      async (snapshot) => {
        const calendarList = snapshot.docs.map(doc => convertFirebaseCalendar(doc));
        
        // If no calendars exist, create a default one
        if (calendarList.length === 0) {
          await createDefaultCalendar();
        } else {
          setCalendars(calendarList);
          setLoading(false);
        }
      },
      (error) => {
        console.error('Error subscribing to calendars:', error);
        setError('Failed to load calendars');
        setLoading(false);
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [user?.uid]);

  // Create default calendar for new users
  const createDefaultCalendar = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const defaultCalendar: Omit<UserCalendar, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: user.uid,
        name: user.displayName ? `${user.displayName}'s Calendar` : 'My Calendar',
        description: 'Primary calendar',
        color: CALENDAR_COLORS[6].value, // Peacock blue
        isDefault: true,
        isVisible: true,
        isPrimary: true,
        shareSettings: { isPublic: false, sharedWith: [] },
        defaultReminders: [{ type: 'notification', minutesBefore: 30 }],
      };

      await addDoc(collection(db, 'calendars'), {
        ...defaultCalendar,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      console.log('Default calendar created');
    } catch (error) {
      console.error('Error creating default calendar:', error);
    }
  }, [user]);

  // Create a new calendar
  const createCalendar = useCallback(async (data: CalendarFormData): Promise<{ success: boolean; calendarId?: string; error?: string }> => {
    if (!user?.uid) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const newCalendar = {
        userId: user.uid,
        name: data.name,
        description: data.description || '',
        color: data.color,
        isDefault: false,
        isVisible: true,
        isPrimary: false,
        shareSettings: { isPublic: false, sharedWith: [] },
        defaultReminders: data.defaultReminders || [{ type: 'notification', minutesBefore: 30 }],
        timeZone: data.timeZone,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'calendars'), newCalendar);
      toast.success(`Calendar "${data.name}" created`);
      return { success: true, calendarId: docRef.id };
    } catch (error) {
      console.error('Error creating calendar:', error);
      toast.error('Failed to create calendar');
      return { success: false, error: 'Failed to create calendar' };
    }
  }, [user]);

  // Update a calendar
  const updateCalendar = useCallback(async (
    calendarId: string, 
    updates: Partial<CalendarFormData & { isVisible: boolean }>
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user?.uid) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const calendarRef = doc(db, 'calendars', calendarId);
      await updateDoc(calendarRef, {
        ...updates,
        updatedAt: serverTimestamp(),
      });
      
      toast.success('Calendar updated');
      return { success: true };
    } catch (error) {
      console.error('Error updating calendar:', error);
      toast.error('Failed to update calendar');
      return { success: false, error: 'Failed to update calendar' };
    }
  }, [user]);

  // Delete a calendar
  const deleteCalendar = useCallback(async (calendarId: string): Promise<{ success: boolean; error?: string }> => {
    if (!user?.uid) {
      return { success: false, error: 'Not authenticated' };
    }

    const calendar = calendars.find(c => c.id === calendarId);
    if (calendar?.isPrimary) {
      toast.error('Cannot delete primary calendar');
      return { success: false, error: 'Cannot delete primary calendar' };
    }

    try {
      await deleteDoc(doc(db, 'calendars', calendarId));
      toast.success('Calendar deleted');
      return { success: true };
    } catch (error) {
      console.error('Error deleting calendar:', error);
      toast.error('Failed to delete calendar');
      return { success: false, error: 'Failed to delete calendar' };
    }
  }, [user, calendars]);

  // Toggle calendar visibility
  const toggleVisibility = useCallback(async (calendarId: string): Promise<void> => {
    const calendar = calendars.find(c => c.id === calendarId);
    if (!calendar) return;

    await updateCalendar(calendarId, { isVisible: !calendar.isVisible });
  }, [calendars, updateCalendar]);

  // Share calendar with user
  const shareCalendar = useCallback(async (
    calendarId: string,
    email: string,
    permission: SharedUser['permission']
  ): Promise<{ success: boolean; error?: string }> => {
    if (!user?.uid) {
      return { success: false, error: 'Not authenticated' };
    }

    const calendar = calendars.find(c => c.id === calendarId);
    if (!calendar) {
      return { success: false, error: 'Calendar not found' };
    }

    try {
      const existingShares = calendar.shareSettings.sharedWith;
      const alreadyShared = existingShares.some(s => s.email === email);

      if (alreadyShared) {
        // Update existing share
        const updatedShares = existingShares.map(s => 
          s.email === email ? { ...s, permission } : s
        );
        await updateDoc(doc(db, 'calendars', calendarId), {
          'shareSettings.sharedWith': updatedShares,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Add new share
        const newShare: SharedUser = {
          email,
          permission,
          addedAt: new Date().toISOString(),
        };
        await updateDoc(doc(db, 'calendars', calendarId), {
          'shareSettings.sharedWith': [...existingShares, newShare],
          updatedAt: serverTimestamp(),
        });
      }

      toast.success(`Calendar shared with ${email}`);
      return { success: true };
    } catch (error) {
      console.error('Error sharing calendar:', error);
      toast.error('Failed to share calendar');
      return { success: false, error: 'Failed to share calendar' };
    }
  }, [user, calendars]);

  // Remove share
  const removeShare = useCallback(async (
    calendarId: string,
    email: string
  ): Promise<{ success: boolean; error?: string }> => {
    const calendar = calendars.find(c => c.id === calendarId);
    if (!calendar) {
      return { success: false, error: 'Calendar not found' };
    }

    try {
      const updatedShares = calendar.shareSettings.sharedWith.filter(s => s.email !== email);
      await updateDoc(doc(db, 'calendars', calendarId), {
        'shareSettings.sharedWith': updatedShares,
        updatedAt: serverTimestamp(),
      });

      toast.success(`Removed ${email} from calendar`);
      return { success: true };
    } catch (error) {
      console.error('Error removing share:', error);
      toast.error('Failed to remove share');
      return { success: false, error: 'Failed to remove share' };
    }
  }, [calendars]);

  // Get visible calendars (for filtering events)
  const visibleCalendarIds = calendars
    .filter(c => c.isVisible)
    .map(c => c.id);

  // Get primary calendar
  const primaryCalendar = calendars.find(c => c.isPrimary);

  // Get default calendar (primary or first available)
  const defaultCalendar = primaryCalendar || calendars[0];

  return {
    calendars,
    loading,
    error,
    createCalendar,
    updateCalendar,
    deleteCalendar,
    toggleVisibility,
    shareCalendar,
    removeShare,
    visibleCalendarIds,
    primaryCalendar,
    defaultCalendar,
    CALENDAR_COLORS,
  };
}

export default useCalendars;
