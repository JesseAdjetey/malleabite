
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

import { useEisenhowerStore } from '@/lib/stores/eisenhower-store';
import type { EisenhowerItem } from '@/lib/stores/eisenhower-store';
export type { EisenhowerItem };

interface EisenhowerResponse {
  success: boolean;
  message: string;
  itemId?: string;
  error?: any;
}

export function useEisenhower(instanceId?: string) {
  const allItems = useEisenhowerStore((s) => s.items);
  const loading = useEisenhowerStore((s) => s.loading);
  const error = useEisenhowerStore((s) => s.error);
  const [lastResponse, setLastResponse] = useState<EisenhowerResponse | null>(null);
  const { user } = useAuth();

  const items = instanceId 
    ? allItems.filter((item) => item.moduleInstanceId === instanceId)
    : allItems;

  const fetchItems = useCallback(() => {
    return () => {};
  }, []);

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

      const newItem: any = {
        text: text.trim(),
        quadrant,
        userId: user.uid,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      };
      if (instanceId) {
        newItem.moduleInstanceId = instanceId;
      }

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

  // Centralized subscription handled by AppDataProvider

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
