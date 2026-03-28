import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { COLLECTIONS } from '@/integrations/firebase/firestore';
import { useAuth } from '@/contexts/AuthContext.firebase';

export interface AppNotification {
  id: string;
  userId: string;
  type: 'module_invite' | 'module_invite_accepted' | 'module_access_revoked' | 'page_invite' | 'page_invite_accepted';
  data: Record<string, any>;
  read: boolean;
  createdAt: Timestamp;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    // Defer by one tick so React 18 StrictMode's double-invoke cleanup cancels
    // the timeout before any listener is created, preventing stale listener IDs
    // from causing Firestore SDK internal assertion failures (b815/ca9).
    let unsubscribe: (() => void) | undefined;
    const tid = setTimeout(() => {
      const q = query(
        collection(db, COLLECTIONS.NOTIFICATIONS),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );

      unsubscribe = onSnapshot(
        q,
        (snap) => {
          setNotifications(
            snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification))
          );
          setLoading(false);
        },
        (_err) => {
          // Permission denied or missing index — fail silently, show empty state
          setNotifications([]);
          setLoading(false);
        }
      );
    }, 0);

    return () => {
      clearTimeout(tid);
      unsubscribe?.();
    };
  }, [user?.uid]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = async (notificationId: string) => {
    await updateDoc(doc(db, COLLECTIONS.NOTIFICATIONS, notificationId), { read: true });
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach(n => {
      batch.update(doc(db, COLLECTIONS.NOTIFICATIONS, n.id), { read: true });
    });
    await batch.commit();
  };

  return { notifications, unreadCount, loading, markAsRead, markAllRead };
}
