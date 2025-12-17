// Hook for managing sidebar pages (polymorphic page containers)
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
  orderBy,
  serverTimestamp,
  getDocs
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { toast } from 'sonner';
import { SidebarPage, ModuleInstance } from '@/lib/stores/types';

export function useSidebarPages() {
  const [pages, setPages] = useState<SidebarPage[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Ensure default page exists
  const ensureDefaultPage = useCallback(async () => {
    if (!user?.uid) return null;

    try {
      // Check if default page exists
      const pagesQuery = query(
        collection(db, 'sidebar_pages'),
        where('userId', '==', user.uid),
        where('isDefault', '==', true)
      );
      const snapshot = await getDocs(pagesQuery);

      if (snapshot.empty) {
        // Create default page
        const defaultPage = {
          title: 'Main',
          icon: 'home',
          userId: user.uid,
          isDefault: true,
          modules: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, 'sidebar_pages'), defaultPage);
        return docRef.id;
      }

      return snapshot.docs[0].id;
    } catch (err) {
      console.error('Error ensuring default page:', err);
      return null;
    }
  }, [user?.uid]);

  // Fetch sidebar pages
  useEffect(() => {
    if (!user?.uid) {
      setPages([]);
      setLoading(false);
      return;
    }

    const pagesQuery = query(
      collection(db, 'sidebar_pages'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(pagesQuery, async (snapshot) => {
      const pagesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        modules: doc.data().modules || []
      })) as SidebarPage[];

      // If no pages, create default one
      if (pagesData.length === 0) {
        await ensureDefaultPage();
        return; // The snapshot will fire again with the new page
      }

      setPages(pagesData);
      
      // Set active page to default or first page if not set
      if (!activePageId) {
        const defaultPage = pagesData.find(p => p.isDefault) || pagesData[0];
        if (defaultPage) {
          setActivePageId(defaultPage.id);
        }
      }
      
      setLoading(false);
    }, (error) => {
      console.error('Error fetching sidebar pages:', error);
      setError('Failed to fetch sidebar pages');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid, ensureDefaultPage, activePageId]);

  // Create a new page
  const createPage = async (title: string, icon?: string): Promise<{ success: boolean; pageId?: string }> => {
    if (!user?.uid || !title.trim()) {
      toast.error(!user ? 'User not authenticated' : 'Page title cannot be empty');
      return { success: false };
    }

    try {
      const newPage = {
        title: title.trim(),
        icon: icon || 'folder',
        userId: user.uid,
        isDefault: false,
        modules: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'sidebar_pages'), newPage);
      toast.success(`Page "${title}" created`);
      return { success: true, pageId: docRef.id };
    } catch (err) {
      console.error('Error creating sidebar page:', err);
      toast.error('Failed to create page');
      return { success: false };
    }
  };

  // Update a page
  const updatePage = async (pageId: string, updates: Partial<Pick<SidebarPage, 'title' | 'icon'>>) => {
    if (!user?.uid) return { success: false };

    try {
      await updateDoc(doc(db, 'sidebar_pages', pageId), {
        ...updates,
        updatedAt: serverTimestamp()
      });
      toast.success('Page updated');
      return { success: true };
    } catch (err) {
      console.error('Error updating sidebar page:', err);
      toast.error('Failed to update page');
      return { success: false };
    }
  };

  // Delete a page
  const deletePage = async (pageId: string) => {
    if (!user?.uid) return { success: false };

    const page = pages.find(p => p.id === pageId);
    if (page?.isDefault) {
      toast.error('Cannot delete the default page');
      return { success: false };
    }

    try {
      await deleteDoc(doc(db, 'sidebar_pages', pageId));
      
      // Switch to default page if we deleted the active one
      if (activePageId === pageId) {
        const defaultPage = pages.find(p => p.isDefault);
        setActivePageId(defaultPage?.id || null);
      }
      
      toast.success('Page deleted');
      return { success: true };
    } catch (err) {
      console.error('Error deleting sidebar page:', err);
      toast.error('Failed to delete page');
      return { success: false };
    }
  };

  // Add module to a page
  const addModule = async (pageId: string, module: ModuleInstance) => {
    if (!user?.uid) return { success: false };

    try {
      const page = pages.find(p => p.id === pageId);
      if (!page) return { success: false };

      const updatedModules = [...page.modules, { ...module, pageId }];
      
      await updateDoc(doc(db, 'sidebar_pages', pageId), {
        modules: updatedModules,
        updatedAt: serverTimestamp()
      });
      
      return { success: true };
    } catch (err) {
      console.error('Error adding module to page:', err);
      toast.error('Failed to add module');
      return { success: false };
    }
  };

  // Remove module from a page
  const removeModule = async (pageId: string, moduleIndex: number) => {
    if (!user?.uid) return { success: false };

    try {
      const page = pages.find(p => p.id === pageId);
      if (!page) return { success: false };

      const updatedModules = page.modules.filter((_, idx) => idx !== moduleIndex);
      
      await updateDoc(doc(db, 'sidebar_pages', pageId), {
        modules: updatedModules,
        updatedAt: serverTimestamp()
      });
      
      return { success: true };
    } catch (err) {
      console.error('Error removing module from page:', err);
      toast.error('Failed to remove module');
      return { success: false };
    }
  };

  // Update module in a page
  const updateModule = async (pageId: string, moduleIndex: number, updates: Partial<ModuleInstance>) => {
    if (!user?.uid) return { success: false };

    try {
      const page = pages.find(p => p.id === pageId);
      if (!page) return { success: false };

      const updatedModules = [...page.modules];
      updatedModules[moduleIndex] = { ...updatedModules[moduleIndex], ...updates };
      
      await updateDoc(doc(db, 'sidebar_pages', pageId), {
        modules: updatedModules,
        updatedAt: serverTimestamp()
      });
      
      return { success: true };
    } catch (err) {
      console.error('Error updating module:', err);
      return { success: false };
    }
  };

  // Reorder modules in a page
  const reorderModules = async (pageId: string, fromIndex: number, toIndex: number) => {
    if (!user?.uid) return { success: false };

    try {
      const page = pages.find(p => p.id === pageId);
      if (!page) return { success: false };

      const modules = [...page.modules];
      const [movedModule] = modules.splice(fromIndex, 1);
      modules.splice(toIndex, 0, movedModule);
      
      await updateDoc(doc(db, 'sidebar_pages', pageId), {
        modules,
        updatedAt: serverTimestamp()
      });
      
      return { success: true };
    } catch (err) {
      console.error('Error reordering modules:', err);
      return { success: false };
    }
  };

  // Toggle module minimized state
  const toggleModuleMinimized = async (pageId: string, moduleIndex: number) => {
    if (!user?.uid) return { success: false };

    try {
      const page = pages.find(p => p.id === pageId);
      if (!page || !page.modules[moduleIndex]) return { success: false };

      const updatedModules = [...page.modules];
      updatedModules[moduleIndex] = {
        ...updatedModules[moduleIndex],
        minimized: !updatedModules[moduleIndex].minimized
      };
      
      await updateDoc(doc(db, 'sidebar_pages', pageId), {
        modules: updatedModules,
        updatedAt: serverTimestamp()
      });
      
      return { success: true };
    } catch (err) {
      console.error('Error toggling module minimized:', err);
      return { success: false };
    }
  };

  // Get active page
  const activePage = pages.find(p => p.id === activePageId);

  return {
    pages,
    activePage,
    activePageId,
    setActivePageId,
    loading,
    error,
    createPage,
    updatePage,
    deletePage,
    addModule,
    removeModule,
    updateModule,
    reorderModules,
    toggleModuleMinimized
  };
}
