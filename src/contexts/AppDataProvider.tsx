import React, { useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.unified';
import { useRemindersStore, useEisenhowerStore, useAlarmsStore } from '@/lib/store';
import { Reminder } from '@/lib/stores/reminders-store';
import { EisenhowerItem } from '@/lib/stores/eisenhower-store';
import { Alarm } from '@/lib/stores/alarms-store';

interface AppDataProviderProps {
  children: React.ReactNode;
}

export const AppDataProvider: React.FC<AppDataProviderProps> = ({ children }) => {
  const { user } = useAuth();
  
  const setReminders = useRemindersStore((s) => s.setReminders);
  const setRemindersLoading = useRemindersStore((s) => s.setLoading);
  const setRemindersError = useRemindersStore((s) => s.setError);
  const clearReminders = useRemindersStore((s) => s.clear);

  const setEisenhowerItems = useEisenhowerStore((s) => s.setItems);
  const setEisenhowerLoading = useEisenhowerStore((s) => s.setLoading);
  const setEisenhowerError = useEisenhowerStore((s) => s.setError);
  const clearEisenhower = useEisenhowerStore((s) => s.clear);

  const setAlarms = useAlarmsStore((s) => s.setAlarms);
  const setAlarmsLoading = useAlarmsStore((s) => s.setLoading);
  const setAlarmsError = useAlarmsStore((s) => s.setError);
  const clearAlarms = useAlarmsStore((s) => s.clear);

  useEffect(() => {
    if (!user?.uid) {
      clearReminders();
      clearEisenhower();
      clearAlarms();
      return;
    }

    console.log('[AppDataProvider] Subscribing to user collections:', user.uid);

    // 1. Reminders Subscription
    const remindersQuery = query(
      collection(db, 'reminders'),
      where('userId', '==', user.uid),
      orderBy('reminderTime', 'asc')
    );

    const unsubscribeReminders = onSnapshot(
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
            status: data.status || 'pending',
            recurrence: data.recurrence || 'none',
            customDays: data.customDays || [],
            createdAt: data.createdAt,
            userId: data.userId,
            moduleInstanceId: data.moduleInstanceId,
          });
        });
        setReminders(remindersData);
        setRemindersLoading(false);
        setRemindersError(null);
      },
      (err) => {
        console.error('[AppDataProvider] Error fetching reminders:', err);
        setRemindersError(err.message);
        setRemindersLoading(false);
      }
    );

    // 2. Eisenhower Items Subscription
    const eisenhowerQuery = query(
      collection(db, 'eisenhower_items'),
      where('userId', '==', user.uid),
      orderBy('created_at', 'desc')
    );

    const unsubscribeEisenhower = onSnapshot(
      eisenhowerQuery,
      (snapshot) => {
        const itemsData: EisenhowerItem[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          itemsData.push({
            id: doc.id,
            text: data.text,
            quadrant: data.quadrant,
            userId: data.userId,
            created_at: data.created_at,
            updated_at: data.updated_at,
            event_id: data.event_id,
            moduleInstanceId: data.moduleInstanceId,
          });
        });
        setEisenhowerItems(itemsData);
        setEisenhowerLoading(false);
        setEisenhowerError(null);
      },
      (err) => {
        console.error('[AppDataProvider] Error fetching Eisenhower items:', err);
        setEisenhowerError(err.message);
        setEisenhowerLoading(false);
      }
    );

    // 3. Alarms Subscription
    const alarmsQuery = query(
      collection(db, 'alarms'),
      where('userId', '==', user.uid)
    );

    const unsubscribeAlarms = onSnapshot(
      alarmsQuery,
      (snapshot) => {
        const alarmsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt,
          updatedAt: doc.data().updatedAt,
        })) as Alarm[];
        setAlarms(alarmsData);
        setAlarmsLoading(false);
        setAlarmsError(null);
      },
      (err) => {
        console.error('[AppDataProvider] Error fetching alarms:', err);
        setAlarmsError(err.message);
        setAlarmsLoading(false);
      }
    );

    return () => {
      console.log('[AppDataProvider] Cleaning up collection subscriptions');
      unsubscribeReminders();
      unsubscribeEisenhower();
      unsubscribeAlarms();
    };
  }, [user?.uid, setReminders, setRemindersLoading, setRemindersError, clearReminders,
      setEisenhowerItems, setEisenhowerLoading, setEisenhowerError, clearEisenhower,
      setAlarms, setAlarmsLoading, setAlarmsError, clearAlarms]);

  return <>{children}</>;
};

export default AppDataProvider;
