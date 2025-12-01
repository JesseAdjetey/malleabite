// Firebase-based invites hook (replaces Supabase version)
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.unified';
import { toast } from 'sonner';
import { CalendarEventType } from '@/lib/stores/types';

export interface Invite {
  id: string;
  senderId: string;
  senderEmail: string;
  recipientId: string;
  recipientEmail: string;
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventStartTime: string;
  eventEndTime: string;
  status: 'pending' | 'accepted' | 'declined';
  message?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InviteResponse {
  success: boolean;
  error?: string;
  data?: Invite;
}

export const useInvites = () => {
  const [sentInvites, setSentInvites] = useState<Invite[]>([]);
  const [receivedInvites, setReceivedInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Fetch sent invites
  useEffect(() => {
    if (!user) {
      setSentInvites([]);
      return;
    }

    const q = query(
      collection(db, 'invites'),
      where('senderId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const invites = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()?.toISOString() || new Date().toISOString(),
          updatedAt: doc.data().updatedAt?.toDate()?.toISOString() || new Date().toISOString(),
        })) as Invite[];
        
        setSentInvites(invites);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching sent invites:', error);
        setError(error.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Fetch received invites
  useEffect(() => {
    if (!user) {
      setReceivedInvites([]);
      return;
    }

    const q = query(
      collection(db, 'invites'),
      where('recipientId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const invites = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate()?.toISOString() || new Date().toISOString(),
          updatedAt: doc.data().updatedAt?.toDate()?.toISOString() || new Date().toISOString(),
        })) as Invite[];
        
        setReceivedInvites(invites);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching received invites:', error);
        setError(error.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const sendInvite = useCallback(async (
    recipientEmail: string,
    event: CalendarEventType,
    message?: string
  ): Promise<InviteResponse> => {
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const inviteData = {
        senderId: user.uid,
        senderEmail: user.email || '',
        recipientId: '', // Will be filled when recipient accepts
        recipientEmail,
        eventId: event.id,
        eventTitle: event.title,
        eventDate: event.date,
        eventStartTime: event.startsAt,
        eventEndTime: event.endsAt,
        status: 'pending' as const,
        message: message || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'invites'), inviteData);
      
      toast.success(`Invite sent to ${recipientEmail}`);
      
      return { 
        success: true, 
        data: { 
          id: docRef.id, 
          ...inviteData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as Invite 
      };
    } catch (error) {
      console.error('Error sending invite:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to send invite';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [user]);

  const respondToInvite = useCallback(async (
    inviteId: string,
    status: 'accepted' | 'declined'
  ): Promise<InviteResponse> => {
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      const inviteRef = doc(db, 'invites', inviteId);
      await updateDoc(inviteRef, {
        status,
        recipientId: user.uid,
        updatedAt: serverTimestamp(),
      });

      toast.success(`Invite ${status}`);
      return { success: true };
    } catch (error) {
      console.error('Error responding to invite:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to respond to invite';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [user]);

  const deleteInvite = useCallback(async (inviteId: string): Promise<InviteResponse> => {
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    try {
      await deleteDoc(doc(db, 'invites', inviteId));
      toast.success('Invite deleted');
      return { success: true };
    } catch (error) {
      console.error('Error deleting invite:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete invite';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  }, [user]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    sentInvites,
    receivedInvites,
    loading,
    error,
    sendInvite,
    respondToInvite,
    deleteInvite,
    clearError,
  };
};
