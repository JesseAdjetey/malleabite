
import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { toast } from 'sonner';
import { CalendarEventType } from '@/lib/stores/types';

export interface Reminder {
  id: string;
  title: string;
  description: string | null;
  reminderTime: string | Timestamp;
  eventId: string | null;
  timeBeforeMinutes: number | null;
  timeAfterMinutes: number | null;
  soundId: string | null;
  isActive: boolean;
  createdAt: string | Timestamp;
  userId?: string;
  event?: CalendarEventType;
}

export interface ReminderFormData {
  title: string;
  description?: string;
  reminderTime?: string;
  eventId?: string;
  timeBeforeMinutes?: number;
  timeAfterMinutes?: number;
  soundId?: string;
}

const REMINDER_SOUNDS = [
  { id: 'default', name: 'Default', url: '/sounds/default-notification.mp3' },
  { id: 'bell', name: 'Bell', url: '/sounds/bell-notification.mp3' },
  { id: 'chime', name: 'Chime', url: '/sounds/chime-notification.mp3' },
  { id: 'soft', name: 'Soft', url: '/sounds/soft-notification.mp3' },
];

export function useReminders() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  // Fetch all reminders from Firebase
  const fetchReminders = useCallback(async () => {
    if (!user) {
      setReminders([]);
      setLoading(false);
      return;
    }
    
    try {
      console.log('Setting up Firebase subscription for reminders for user:', user.uid);
      
      const remindersQuery = query(
        collection(db, 'reminders'),
        where('userId', '==', user.uid),
        orderBy('reminderTime', 'asc')
      );

      const unsubscribe = onSnapshot(
        remindersQuery,
        (snapshot) => {
          const remindersData: Reminder[] = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            remindersData.push({
              id: doc.id,
              title: data.title,
              description: data.description,
              reminderTime: data.reminderTime,
              eventId: data.eventId,
              timeBeforeMinutes: data.timeBeforeMinutes,
              timeAfterMinutes: data.timeAfterMinutes,
              soundId: data.soundId,
              isActive: data.isActive,
              createdAt: data.createdAt,
              userId: data.userId
            });
          });
          
          console.log('Received reminders from Firebase:', remindersData);
          setReminders(remindersData);
          setLoading(false);
        },
        (err) => {
          console.error('Error fetching reminders:', err);
          toast.error('Failed to fetch reminders');
          setLoading(false);
        }
      );

      return unsubscribe;
    } catch (err: any) {
      console.error('Error setting up reminders subscription:', err);
      toast.error('Failed to fetch reminders');
      setLoading(false);
    }
  }, [user]);

  // Add a new reminder
  const addReminder = async (data: ReminderFormData): Promise<{success: boolean, error?: any}> => {
    if (!user) {
      toast.error('You must be logged in to create reminders');
      return { success: false };
    }
    
    try {
      // Format the data for insertion - reminderTime must be a Firestore Timestamp
      const reminderTimeDate = data.reminderTime ? new Date(data.reminderTime) : new Date();
      const reminderData = {
        userId: user.uid,
        title: data.title,
        description: data.description || null,
        reminderTime: Timestamp.fromDate(reminderTimeDate),
        eventId: data.eventId || null,
        timeBeforeMinutes: data.timeBeforeMinutes || null,
        timeAfterMinutes: data.timeAfterMinutes || null,
        soundId: data.soundId || 'default',
        isActive: true,
        createdAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'reminders'), reminderData);
      
      console.log('Reminder created with ID:', docRef.id);
      toast.success('Reminder created');
      
      return { success: true };
    } catch (error: any) {
      console.error('Error creating reminder:', error);
      toast.error(`Failed to create reminder: ${error.message}`);
      return { success: false, error };
    }
  };

  // Update a reminder
  const updateReminder = async (id: string, data: Partial<ReminderFormData>): Promise<{success: boolean, error?: any}> => {
    if (!user) {
      toast.error('You must be logged in to update reminders');
      return { success: false };
    }
    
    try {
      // Format the update data
      const updateData: Record<string, any> = {};
      
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.reminderTime !== undefined) {
        updateData.reminderTime = Timestamp.fromDate(new Date(data.reminderTime));
      }
      if (data.eventId !== undefined) updateData.eventId = data.eventId;
      if (data.timeBeforeMinutes !== undefined) updateData.timeBeforeMinutes = data.timeBeforeMinutes;
      if (data.timeAfterMinutes !== undefined) updateData.timeAfterMinutes = data.timeAfterMinutes;
      if (data.soundId !== undefined) updateData.soundId = data.soundId;
      
      await updateDoc(doc(db, 'reminders', id), updateData);
      
      console.log('Reminder updated:', id);
      toast.success('Reminder updated');
      
      return { success: true };
    } catch (error: any) {
      console.error('Error updating reminder:', error);
      toast.error(`Failed to update reminder: ${error.message}`);
      return { success: false, error };
    }
  };

  // Toggle reminder active status
  const toggleReminderActive = async (id: string, isActive: boolean): Promise<{success: boolean, error?: any}> => {
    if (!user) {
      toast.error('You must be logged in to update reminders');
      return { success: false };
    }
    
    try {
      await updateDoc(doc(db, 'reminders', id), { isActive: isActive });
      
      console.log('Reminder active status toggled:', id, isActive);
      toast.success(`Reminder ${isActive ? 'activated' : 'deactivated'}`);
      
      return { success: true };
    } catch (error: any) {
      console.error('Error toggling reminder:', error);
      toast.error(`Failed to toggle reminder: ${error.message}`);
      return { success: false, error };
    }
  };

  // Delete a reminder
  const deleteReminder = async (id: string): Promise<{success: boolean, error?: any}> => {
    if (!user) {
      toast.error('You must be logged in to delete reminders');
      return { success: false };
    }
    
    try {
      await deleteDoc(doc(db, 'reminders', id));
      
      console.log('Reminder deleted:', id);
      toast.success('Reminder deleted');
      
      return { success: true };
    } catch (error: any) {
      console.error('Error deleting reminder:', error);
      toast.error(`Failed to delete reminder: ${error.message}`);
      return { success: false, error };
    }
  };
  
  // Play a reminder sound for testing
  const playSound = (soundId: string = 'default') => {
    const sound = REMINDER_SOUNDS.find(s => s.id === soundId) || REMINDER_SOUNDS[0];
    const audio = new Audio(sound.url);
    audio.play().catch(err => console.error('Error playing sound:', err));
  };

  // Get list of available sounds
  const getSounds = () => REMINDER_SOUNDS;

  // Load reminders when component mounts or user changes
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setupSubscription = async () => {
      if (user) {
        console.log('User is authenticated, setting up reminders subscription');
        unsubscribe = await fetchReminders();
      } else {
        console.log('No user, clearing reminders');
        setReminders([]);
        setLoading(false);
      }
    };

    setupSubscription();

    return () => {
      if (unsubscribe) {
        console.log('Cleaning up reminders subscription');
        unsubscribe();
      }
    };
  }, [user, fetchReminders]);

  return {
    reminders,
    loading,
    fetchReminders,
    addReminder,
    updateReminder,
    toggleReminderActive,
    deleteReminder,
    playSound,
    getSounds,
    REMINDER_SOUNDS
  };
}
