
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

export interface EisenhowerItem {
  id: string;
  text: string;
  quadrant: 'urgent_important' | 'not_urgent_important' | 'urgent_not_important' | 'not_urgent_not_important';
  userId?: string;
  created_at?: string | Timestamp;
  updated_at?: string | Timestamp;
  event_id?: string;
}

interface EisenhowerResponse {
  success: boolean;
  message: string;
  itemId?: string;
  error?: any;
}

export function useEisenhower() {
  const [items, setItems] = useState<EisenhowerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<EisenhowerResponse | null>(null);
  const { user } = useAuth();

  // Fetch Eisenhower items from Firebase
  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      if (!user) {
        setItems([]);
        setLoading(false);
        return;
      }

      console.log('Setting up Firebase subscription for Eisenhower items for user:', user.uid);
      
      const itemsQuery = query(
        collection(db, 'eisenhower_items'),
        where('userId', '==', user.uid),
        orderBy('created_at', 'desc')
      );

      const unsubscribe = onSnapshot(
        itemsQuery,
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
              event_id: data.event_id
            });
          });
          
          console.log('Received Eisenhower items from Firebase:', itemsData);
          setItems(itemsData);
          setLoading(false);
        },
        (err) => {
          console.error('Error fetching Eisenhower items:', err);
          setError(err.message);
          setLoading(false);
        }
      );

      return unsubscribe;
    } catch (err: any) {
      console.error('Error setting up Eisenhower items subscription:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [user]);

  // Add a new Eisenhower item to Firebase
  const addItem = async (text: string, quadrant: EisenhowerItem['quadrant']) => {
    try {
      if (!user || !text.trim()) {
        const response = {
          success: false,
          message: !user ? 'User not authenticated' : 'Text cannot be empty',
        };
        setLastResponse(response);
        return response;
      }

      console.log('Adding new Eisenhower item:', text, 'to quadrant:', quadrant);
      
      const newItem = {
        text: text.trim(),
        quadrant,
        userId: user.uid,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'eisenhower_items'), newItem);
      
      console.log('Item successfully added with ID:', docRef.id);
      
      const response = {
        success: true,
        message: 'Item added successfully',
        itemId: docRef.id,
      };
      setLastResponse(response);
      return response;
    } catch (err: any) {
      console.error('Error adding Eisenhower item:', err);
      const response = {
        success: false,
        message: `Error adding item: ${err.message || String(err)}`,
        error: err
      };
      setLastResponse(response);
      return response;
    }
  };

  // Remove an Eisenhower item
  const removeItem = async (id: string) => {
    try {
      if (!user) return;
      
      console.log('Removing Eisenhower item:', id);
      await deleteDoc(doc(db, 'eisenhower_items', id));
      
    } catch (err: any) {
      console.error('Error removing Eisenhower item:', err);
      toast.error('Failed to remove item');
    }
  };

  // Update an item's quadrant
  const updateQuadrant = async (id: string, quadrant: EisenhowerItem['quadrant']) => {
    try {
      if (!user) return;
      
      console.log('Updating Eisenhower item quadrant:', id, 'to', quadrant);
      
      await updateDoc(doc(db, 'eisenhower_items', id), {
        quadrant,
        updated_at: serverTimestamp()
      });
      
    } catch (err: any) {
      console.error('Error updating Eisenhower item quadrant:', err);
      toast.error('Failed to update item');
    }
  };

  // Load items when component mounts or user changes
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const setupSubscription = async () => {
      if (user) {
        console.log('User is authenticated, setting up Eisenhower items subscription');
        unsubscribe = await fetchItems();
      } else {
        console.log('No user, clearing Eisenhower items');
        setItems([]);
        setLoading(false);
      }
    };

    setupSubscription();

    return () => {
      if (unsubscribe) {
        console.log('Cleaning up Eisenhower items subscription');
        unsubscribe();
      }
    };
  }, [user, fetchItems]);

  return {
    items,
    loading,
    error,
    addItem,
    removeItem,
    updateQuadrant,
    refetchItems: fetchItems,
    lastResponse
  };
}
