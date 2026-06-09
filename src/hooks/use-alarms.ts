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
import { scheduleAlarmNotification, cancelAlarmNotification } from '@/lib/native-notification-scheduler';

import { useAlarmsStore } from '@/lib/stores/alarms-store';
import type { Alarm } from '@/lib/stores/alarms-store';
export type { Alarm };

export function useAlarms(instanceId?: string) {
  const allAlarms = useAlarmsStore((s) => s.alarms);
  const loading = useAlarmsStore((s) => s.loading);
  const error = useAlarmsStore((s) => s.error);
  const { user } = useAuth();

  const alarms = instanceId 
    ? allAlarms.filter((alarm) => alarm.moduleInstanceId === instanceId)
    : allAlarms;

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
      const newAlarm: any = {
        userId: user.uid,
        title: title.trim(),
        time: typeof time === 'string' ? time : time.toISOString(),
        enabled: true,
        repeatDays: options?.repeatDays || [],
        soundId: options?.soundId || 'default',
        snoozeEnabled: options?.snoozeEnabled ?? true,
        snoozeDuration: options?.snoozeDuration || 5,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      if (instanceId) {
        newAlarm.moduleInstanceId = instanceId;
      }

      // Only add optional fields if they're defined
      if (options?.linkedEventId) {
        newAlarm.linkedEventId = options.linkedEventId;
      }
      if (options?.linkedTodoId) {
        newAlarm.linkedTodoId = options.linkedTodoId;
      }

      const docRef = await addDoc(collection(db, 'alarms'), newAlarm);
      // Schedule native OS notification
      scheduleAlarmNotification({ ...newAlarm, id: docRef.id } as Alarm)
        .catch(err => console.error('[Alarms] Failed to schedule native notification:', err));
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
      // Re-schedule native notification: cancel old, schedule new if still enabled
      const existingAlarm = allAlarms.find(a => a.id === alarmId);
      if (existingAlarm) {
        cancelAlarmNotification(alarmId).catch(() => {});
        const merged = { ...existingAlarm, ...updates, id: alarmId };
        if (merged.enabled) {
          scheduleAlarmNotification(merged as Alarm).catch(() => {});
        }
      }
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
      // Cancel native notification
      cancelAlarmNotification(alarmId).catch(() => {});
      toast.success('Alarm deleted');
      return { success: true };
    } catch (err) {
      console.error('Error deleting alarm:', err);
      toast.error('Failed to delete alarm');
      return { success: false };
    }
  };

  // Toggle alarm enabled/disabled
  const toggleAlarm = async (alarmId: string, enabled?: boolean) => {
    const alarm = allAlarms.find(a => a.id === alarmId);
    if (!alarm) return { success: false };

    const newEnabled = enabled !== undefined ? enabled : !alarm.enabled;
    return updateAlarm(alarmId, { enabled: newEnabled });
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
