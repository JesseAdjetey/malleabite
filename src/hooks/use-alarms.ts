// Hook for managing alarms with Firebase integration
import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { toast } from 'sonner';

export interface Alarm {
  id?: string;
  userId: string;
  title: string;
  time: string | Date; // ISO datetime or HH:MM format
  enabled: boolean;
  linkedEventId?: string;
  linkedTodoId?: string;
  soundId?: string;
  snoozeEnabled?: boolean;
  snoozeDuration?: number; // minutes
  repeatDays?: number[]; // 0-6 for Sunday-Saturday, empty for one-time
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export function useAlarms() {
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Fetch alarms
  useEffect(() => {
    if (!user?.uid) {
      setAlarms([]);
      setLoading(false);
      return;
    }

    const alarmsQuery = query(
      collection(db, 'alarms'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(alarmsQuery, (snapshot) => {
      const alarmsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt,
        updatedAt: doc.data().updatedAt
      })) as Alarm[];

      setAlarms(alarmsData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching alarms:', error);
      setError('Failed to fetch alarms');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Add alarm
  const addAlarm = async (
    title: string, 
    time: string | Date,
    options?: {
      linkedEventId?: string;
      linkedTodoId?: string;
      repeatDays?: number[];
      soundId?: string;
      snoozeEnabled?: boolean;
      snoozeDuration?: number;
    }
  ): Promise<{ success: boolean; alarmId?: string }> => {
    if (!user?.uid || !title.trim()) {
      toast.error(!user ? 'User not authenticated' : 'Alarm title cannot be empty');
      return { success: false };
    }

    try {
      const newAlarm = {
        userId: user.uid,
        title: title.trim(),
        time: typeof time === 'string' ? time : time.toISOString(),
        enabled: true,
        linkedEventId: options?.linkedEventId,
        linkedTodoId: options?.linkedTodoId,
        repeatDays: options?.repeatDays || [],
        soundId: options?.soundId || 'default',
        snoozeEnabled: options?.snoozeEnabled ?? true,
        snoozeDuration: options?.snoozeDuration || 5,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'alarms'), newAlarm);
      toast.success(`Alarm "${title}" created`);
      return { success: true, alarmId: docRef.id };
    } catch (err) {
      console.error('Error creating alarm:', err);
      toast.error('Failed to create alarm');
      return { success: false };
    }
  };

  // Update alarm
  const updateAlarm = async (
    alarmId: string,
    updates: Partial<Omit<Alarm, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
  ) => {
    if (!user?.uid) return { success: false };

    try {
      await updateDoc(doc(db, 'alarms', alarmId), {
        ...updates,
        updatedAt: serverTimestamp()
      });
      toast.success('Alarm updated');
      return { success: true };
    } catch (err) {
      console.error('Error updating alarm:', err);
      toast.error('Failed to update alarm');
      return { success: false };
    }
  };

  // Delete alarm
  const deleteAlarm = async (alarmId: string) => {
    if (!user?.uid) return { success: false };

    try {
      await deleteDoc(doc(db, 'alarms', alarmId));
      toast.success('Alarm deleted');
      return { success: true };
    } catch (err) {
      console.error('Error deleting alarm:', err);
      toast.error('Failed to delete alarm');
      return { success: false };
    }
  };

  // Toggle alarm enabled/disabled
  const toggleAlarm = async (alarmId: string) => {
    const alarm = alarms.find(a => a.id === alarmId);
    if (!alarm) return { success: false };

    return updateAlarm(alarmId, { enabled: !alarm.enabled });
  };

  // Link alarm to event
  const linkToEvent = async (alarmId: string, eventId: string) => {
    return updateAlarm(alarmId, { linkedEventId: eventId });
  };

  // Link alarm to todo
  const linkToTodo = async (alarmId: string, todoId: string) => {
    return updateAlarm(alarmId, { linkedTodoId: todoId });
  };

  return {
    alarms,
    loading,
    error,
    addAlarm,
    updateAlarm,
    deleteAlarm,
    toggleAlarm,
    linkToEvent,
    linkToTodo
  };
}
