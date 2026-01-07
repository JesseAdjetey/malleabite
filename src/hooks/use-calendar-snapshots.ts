// Calendar Snapshot System - Save and restore calendar state
import { useState, useCallback, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { toast } from 'sonner';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { CalendarEventType } from '@/lib/stores/types';

export interface CalendarSnapshot {
  id: string;
  userId: string;
  name: string;
  description?: string;
  eventCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SnapshotEvent {
  snapshotId: string;
  eventData: CalendarEventType;
}

export function useCalendarSnapshots() {
  const [snapshots, setSnapshots] = useState<CalendarSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { events, addEvent, removeEvent } = useCalendarEvents();

  // Load user's snapshots
  useEffect(() => {
    if (!user?.uid) {
      setSnapshots([]);
      setLoading(false);
      return;
    }

    if (!db) {
      console.error('Firestore database is not initialized');
      setLoading(false);
      return;
    }

    const loadSnapshots = async () => {
      try {
        const q = query(
          collection(db, 'calendar_snapshots'),
          where('userId', '==', user.uid)
        );
        const querySnapshot = await getDocs(q);
        
        const snapshotList: CalendarSnapshot[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          snapshotList.push({
            id: doc.id,
            userId: data.userId,
            name: data.name,
            description: data.description,
            eventCount: data.eventCount,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          });
        });

        setSnapshots(snapshotList.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ));
      } catch (error) {
        console.error('Error loading snapshots:', error);
        toast.error('Failed to load calendar snapshots');
      } finally {
        setLoading(false);
      }
    };

    loadSnapshots();
  }, [user]);

  // Create a snapshot of current calendar
  const createSnapshot = useCallback(async (
    name: string,
    description?: string
  ): Promise<{ success: boolean; snapshotId?: string }> => {
    if (!user?.uid) {
      return { success: false };
    }

    if (!db) {
      console.error('Firestore database is not initialized');
      toast.error('Database not available');
      return { success: false };
    }

    try {
      // Create snapshot metadata
      const snapshotRef = await addDoc(collection(db, 'calendar_snapshots'), {
        userId: user.uid,
        name,
        description: description || '',
        eventCount: events.length,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Save all events to snapshot_events subcollection
      const snapshotEventsRef = collection(db, 'snapshot_events');
      
      const eventPromises = events.map((event) =>
        addDoc(snapshotEventsRef, {
          snapshotId: snapshotRef.id,
          eventData: event,
          createdAt: serverTimestamp(),
        })
      );

      await Promise.all(eventPromises);

      // Add to local state
      const newSnapshot: CalendarSnapshot = {
        id: snapshotRef.id,
        userId: user.uid,
        name,
        description,
        eventCount: events.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setSnapshots((prev) => [newSnapshot, ...prev]);

      toast.success(`Calendar saved as "${name}" with ${events.length} events`);
      return { success: true, snapshotId: snapshotRef.id };
    } catch (error) {
      console.error('Error creating snapshot:', error);
      toast.error('Failed to save calendar');
      return { success: false };
    }
  }, [user, events]);

  // Restore a snapshot (loads events into current calendar)
  const restoreSnapshot = useCallback(async (snapshotId: string): Promise<boolean> => {
    if (!user?.uid) return false;

    try {
      // Get snapshot events
      const q = query(
        collection(db, 'snapshot_events'),
        where('snapshotId', '==', snapshotId)
      );
      const querySnapshot = await getDocs(q);

      const snapshotEvents: CalendarEventType[] = [];
      querySnapshot.forEach((doc) => {
        snapshotEvents.push(doc.data().eventData);
      });

      // Add all events to current calendar
      const addPromises = snapshotEvents.map((event) => addEvent(event));
      await Promise.all(addPromises);

      const snapshot = snapshots.find((s) => s.id === snapshotId);
      toast.success(`Restored ${snapshotEvents.length} events from "${snapshot?.name}"`);
      return true;
    } catch (error) {
      console.error('Error restoring snapshot:', error);
      toast.error('Failed to restore calendar');
      return false;
    }
  }, [user, snapshots, addEvent]);

  // Clear current calendar (delete all events)
  const clearCalendar = useCallback(async (): Promise<boolean> => {
    if (!user?.uid) return false;

    try {
      const deletePromises = events.map((event) => removeEvent(event.id));
      await Promise.all(deletePromises);

      toast.success('Calendar cleared successfully');
      return true;
    } catch (error) {
      console.error('Error clearing calendar:', error);
      toast.error('Failed to clear calendar');
      return false;
    }
  }, [user, events, removeEvent]);

  // Save current calendar and start fresh (save + clear)
  const saveAndStartFresh = useCallback(async (
    name: string,
    description?: string
  ): Promise<boolean> => {
    const result = await createSnapshot(name, description);
    
    if (result.success) {
      const cleared = await clearCalendar();
      return cleared;
    }
    
    return false;
  }, [createSnapshot, clearCalendar]);

  // Delete a snapshot
  const deleteSnapshot = useCallback(async (snapshotId: string): Promise<boolean> => {
    if (!user?.uid) return false;

    try {
      // Delete snapshot metadata
      await deleteDoc(doc(db, 'calendar_snapshots', snapshotId));

      // Delete all associated events
      const q = query(
        collection(db, 'snapshot_events'),
        where('snapshotId', '==', snapshotId)
      );
      const querySnapshot = await getDocs(q);
      
      const deletePromises = querySnapshot.docs.map((docSnapshot) =>
        deleteDoc(docSnapshot.ref)
      );
      await Promise.all(deletePromises);

      // Remove from local state
      setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));

      toast.success('Calendar snapshot deleted');
      return true;
    } catch (error) {
      console.error('Error deleting snapshot:', error);
      toast.error('Failed to delete snapshot');
      return false;
    }
  }, [user]);

  // Update snapshot metadata
  const updateSnapshot = useCallback(async (
    snapshotId: string,
    updates: { name?: string; description?: string }
  ): Promise<boolean> => {
    if (!user?.uid) return false;

    try {
      await updateDoc(doc(db, 'calendar_snapshots', snapshotId), {
        ...updates,
        updatedAt: serverTimestamp(),
      });

      setSnapshots((prev) =>
        prev.map((s) =>
          s.id === snapshotId
            ? { ...s, ...updates, updatedAt: new Date().toISOString() }
            : s
        )
      );

      toast.success('Snapshot updated');
      return true;
    } catch (error) {
      console.error('Error updating snapshot:', error);
      toast.error('Failed to update snapshot');
      return false;
    }
  }, [user]);

  return {
    snapshots,
    loading,
    createSnapshot,
    restoreSnapshot,
    clearCalendar,
    saveAndStartFresh,
    deleteSnapshot,
    updateSnapshot,
  };
}
