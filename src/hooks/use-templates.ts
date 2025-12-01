import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { useTemplateStore } from '@/stores/template-store';
import type { EventTemplate, CreateTemplateInput } from '@/types/template';

export function useTemplates() {
  const { user } = useAuth();
  const {
    templates,
    isLoading,
    error,
    setTemplates,
    addTemplate,
    updateTemplate: updateStoreTemplate,
    deleteTemplate: deleteStoreTemplate,
    setLoading,
    setError,
    incrementUsage,
    getFilteredTemplates,
    getMostUsedTemplates,
    getFavoriteTemplates,
  } = useTemplateStore();

  // Load templates from Firebase
  useEffect(() => {
    if (!user) {
      setTemplates([]);
      return;
    }

    loadTemplates();
  }, [user]);

  const loadTemplates = async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const templatesRef = collection(db, 'templates');
      const q = query(
        templatesRef,
        where('userId', '==', user.uid),
        orderBy('usageCount', 'desc')
      );

      const snapshot = await getDocs(q);
      const loadedTemplates: EventTemplate[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as EventTemplate));

      setTemplates(loadedTemplates);
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  // Create new template
  const createTemplate = async (input: CreateTemplateInput): Promise<EventTemplate | null> => {
    if (!user) {
      setError('User not authenticated');
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const now = new Date().toISOString();
      const templateData = {
        ...input,
        userId: user.uid,
        usageCount: 0,
        isFavorite: false,
        createdAt: now,
        updatedAt: now,
      };

      const templatesRef = collection(db, 'templates');
      const docRef = await addDoc(templatesRef, templateData);

      const newTemplate: EventTemplate = {
        id: docRef.id,
        ...templateData,
      };

      addTemplate(newTemplate);
      return newTemplate;
    } catch (err) {
      console.error('Error creating template:', err);
      setError('Failed to create template');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Update template
  const updateTemplate = async (
    id: string,
    updates: Partial<EventTemplate>
  ): Promise<boolean> => {
    if (!user) {
      setError('User not authenticated');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const templateRef = doc(db, 'templates', id);
      const updateData = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(templateRef, updateData);
      updateStoreTemplate(id, updateData);
      return true;
    } catch (err) {
      console.error('Error updating template:', err);
      setError('Failed to update template');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Delete template
  const deleteTemplate = async (id: string): Promise<boolean> => {
    if (!user) {
      setError('User not authenticated');
      return false;
    }

    setLoading(true);
    setError(null);

    try {
      const templateRef = doc(db, 'templates', id);
      await deleteDoc(templateRef);
      deleteStoreTemplate(id);
      return true;
    } catch (err) {
      console.error('Error deleting template:', err);
      setError('Failed to delete template');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Use template (increment usage count)
  const useTemplate = async (id: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const templateRef = doc(db, 'templates', id);
      const template = templates.find((t) => t.id === id);
      
      if (!template) return false;

      await updateDoc(templateRef, {
        usageCount: template.usageCount + 1,
        lastUsed: new Date().toISOString(),
      });

      incrementUsage(id);
      return true;
    } catch (err) {
      console.error('Error updating template usage:', err);
      return false;
    }
  };

  // Toggle favorite
  const toggleFavorite = async (id: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const template = templates.find((t) => t.id === id);
      if (!template) return false;

      const templateRef = doc(db, 'templates', id);
      await updateDoc(templateRef, {
        isFavorite: !template.isFavorite,
      });

      useTemplateStore.getState().toggleFavorite(id);
      return true;
    } catch (err) {
      console.error('Error toggling favorite:', err);
      return false;
    }
  };

  // Apply template to create event data
  const applyTemplate = (template: EventTemplate, startTime: Date) => {
    const endTime = new Date(startTime);
    endTime.setMinutes(endTime.getMinutes() + template.duration);

    return {
      title: template.title,
      start: startTime.toISOString(),
      end: endTime.toISOString(),
      category: template.category,
      color: template.color,
      location: template.location,
      notes: template.notes,
      reminder: template.reminder,
      isAllDay: template.isAllDay || false,
    };
  };

  return {
    templates,
    filteredTemplates: getFilteredTemplates(),
    favoriteTemplates: getFavoriteTemplates(),
    mostUsedTemplates: getMostUsedTemplates(),
    isLoading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    useTemplate,
    toggleFavorite,
    applyTemplate,
    refreshTemplates: loadTemplates,
  };
}
