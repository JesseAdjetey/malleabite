// Hook for managing sidebar pages (polymorphic page containers)
import { useState, useEffect, useCallback, useRef } from 'react';
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
  getDocs,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { toast } from 'sonner';
import { SidebarPage, ModuleInstance, ensureModuleId, generateModuleId } from '@/lib/stores/types';
import { useTodoLists } from './use-todo-lists';

const sanitizeModuleForFirestore = (module: ModuleInstance): ModuleInstance => {
  return Object.fromEntries(
    Object.entries(module).filter(([, value]) => value !== undefined)
  ) as ModuleInstance;
};

// Module-level lock: shared across ALL hook instances to prevent concurrent default page creation
let isCreatingDefaultPageGlobal = false;

export function useSidebarPages() {
  const [pages, setPages] = useState<SidebarPage[]>([]);
  const [activePageId, setActivePageIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { createList } = useTodoLists();
  const shouldPersistActivePageRef = useRef(false);
  const activePageIdRef = useRef<string | null>(null);

  const getActivePageStorageKey = useCallback((uid: string) => `sidebar_active_page:${uid}`, []);
  const getSidebarPreferencesRef = useCallback((uid: string) => doc(db, `users/${uid}/sidebarPreferences`, 'settings'), []);

  const setActivePageIdSilent = useCallback((pageId: string | null) => {
    shouldPersistActivePageRef.current = false;
    activePageIdRef.current = pageId;
    setActivePageIdState(pageId);
  }, []);

  const setActivePageId = useCallback((pageId: string | null) => {
    shouldPersistActivePageRef.current = true;
    activePageIdRef.current = pageId;
    setActivePageIdState(pageId);
  }, []);

  // Keep activePageIdRef in sync with state
  useEffect(() => {
    activePageIdRef.current = activePageId;
  }, [activePageId]);

  // Restore last active page when user changes / logs in
  useEffect(() => {
    if (!user?.uid) {
      setActivePageIdSilent(null);
      return;
    }

    try {
      const stored = localStorage.getItem(getActivePageStorageKey(user.uid));
      setActivePageIdSilent(stored || null);
    } catch {
      setActivePageIdSilent(null);
    }
  }, [user?.uid, getActivePageStorageKey, setActivePageIdSilent]);

  // Restore cross-device active page preference from Firestore (authoritative when available)
  useEffect(() => {
    if (!user?.uid) return;

    let cancelled = false;

    const loadRemoteActivePage = async () => {
      try {
        const prefSnap = await getDoc(getSidebarPreferencesRef(user.uid));
        if (cancelled || !prefSnap.exists()) return;
        const data = prefSnap.data() as { activePageId?: string | null };
        if (data.activePageId) {
          setActivePageIdSilent(data.activePageId);
        }
      } catch {
        // Ignore remote preference failures silently and fall back to local behavior
      }
    };

    loadRemoteActivePage();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, getSidebarPreferencesRef, setActivePageIdSilent]);

  // Persist active page locally + across devices (only for explicit/user-driven changes)
  useEffect(() => {
    if (!user?.uid) return;
    if (!shouldPersistActivePageRef.current) return;

    try {
      const key = getActivePageStorageKey(user.uid);
      if (activePageId) localStorage.setItem(key, activePageId);
      else localStorage.removeItem(key);
    } catch {
      // Ignore storage failures silently
    }

    const persistRemoteActivePage = async () => {
      try {
        await setDoc(getSidebarPreferencesRef(user.uid), {
          activePageId: activePageId || null,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch {
        // Ignore persistence failures silently; local persistence still works
      }
    };

    persistRemoteActivePage();

    shouldPersistActivePageRef.current = false;
  }, [user?.uid, activePageId, getSidebarPreferencesRef, getActivePageStorageKey]);

  // Ensure default page exists
  const ensureDefaultPage = useCallback(async () => {
    if (!user?.uid) return null;
    // Prevent concurrent calls from creating multiple pages
    if (isCreatingDefaultPageGlobal) return null;

    isCreatingDefaultPageGlobal = true;
    try {
      // Check if any pages exist (not just isDefault ones — avoids duplicates when isDefault is unset)
      const allPagesQuery = query(
        collection(db, 'sidebar_pages'),
        where('userId', '==', user.uid)
      );
      const snapshot = await getDocs(allPagesQuery);

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
    } finally {
      isCreatingDefaultPageGlobal = false;
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
        modules: (doc.data().modules || []).map(ensureModuleId)
      })) as SidebarPage[];

      // ── Migrate: write module IDs back to Firestore for any modules that were missing them ──
      for (const page of pagesData) {
        const rawModules = snapshot.docs.find(d => d.id === page.id)?.data()?.modules || [];
        const needsMigration = rawModules.some((m: { id?: string }) => !m.id);
        if (needsMigration) {
          try {
            await updateDoc(doc(db, 'sidebar_pages', page.id), {
              modules: page.modules,
              updatedAt: serverTimestamp()
            });
            console.log(`[SidebarPages] Migrated module IDs for page "${page.title}"`);
          } catch (err) {
            console.warn('[SidebarPages] Failed to migrate module IDs:', err);
          }
        }
      }

      // If no pages, create default one
      if (pagesData.length === 0) {
        await ensureDefaultPage();
        return; // The snapshot will fire again with the new page
      }

      setPages(pagesData);

      // Keep current active page when valid; otherwise restore persisted/default
      const currentActivePageId = activePageIdRef.current;
      const activeStillExists = !!currentActivePageId && pagesData.some(p => p.id === currentActivePageId);
      if (!activeStillExists) {
        let persistedPageId: string | null = null;
        try {
          persistedPageId = user?.uid ? localStorage.getItem(getActivePageStorageKey(user.uid)) : null;
        } catch {
          persistedPageId = null;
        }

        const persistedExists = !!persistedPageId && pagesData.some(p => p.id === persistedPageId);
        const fallbackPageId = (persistedExists
          ? persistedPageId
          : (pagesData.find(p => p.isDefault) || pagesData[0])?.id) || null;

        if (fallbackPageId) {
          setActivePageIdSilent(fallbackPageId);
        }
      }

      setLoading(false);
    }, (error) => {
      console.error('Error fetching sidebar pages:', error);
      setError('Failed to fetch sidebar pages');
      setLoading(false);
    });

    return () => unsubscribe();
  // activePageId intentionally excluded — we use activePageIdRef to avoid restarting the listener on every page switch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, ensureDefaultPage, getActivePageStorageKey, setActivePageIdSilent]);

  // Create a new page (optionally with extra fields for shared/duplicate pages)
  const createPage = async (
    title: string,
    icon?: string,
    extraFields?: Partial<Pick<SidebarPage, 'sharedFromPageId' | 'sharedRole' | 'sharedOwnerName' | 'modules'>>
  ): Promise<{ success: boolean; pageId?: string }> => {
    if (!user?.uid || !title.trim()) {
      toast.error(!user ? 'User not authenticated' : 'Page title cannot be empty');
      return { success: false };
    }

    try {
      const newPage: Record<string, unknown> = {
        title: title.trim(),
        icon: icon || 'folder',
        userId: user.uid,
        isDefault: false,
        modules: extraFields?.modules ?? [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (extraFields?.sharedFromPageId) newPage.sharedFromPageId = extraFields.sharedFromPageId;
      if (extraFields?.sharedRole) newPage.sharedRole = extraFields.sharedRole;
      if (extraFields?.sharedOwnerName) newPage.sharedOwnerName = extraFields.sharedOwnerName;

      const docRef = await addDoc(collection(db, 'sidebar_pages'), newPage);
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

    // Don't allow deleting if it's the last page
    if (pages.length <= 1) {
      toast.error('Cannot delete the last page');
      return { success: false };
    }

    try {
      const page = pages.find(p => p.id === pageId);

      await deleteDoc(doc(db, 'sidebar_pages', pageId));

      // If we deleted the active page or the default page, switch to another
      if (activePageId === pageId || page?.isDefault) {
        const remainingPages = pages.filter(p => p.id !== pageId);
        const newActivePage = remainingPages[0];
        setActivePageId(newActivePage?.id || null);

        // If we deleted the default page, mark the first remaining page as default
        if (page?.isDefault && newActivePage) {
          await updateDoc(doc(db, 'sidebar_pages', newActivePage.id), {
            isDefault: true
          });
        }
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
  const addModule = async (pageId: string, module: Omit<ModuleInstance, 'id'> & { id?: string }) => {
    if (!user?.uid) return { success: false };

    try {
      const page = pages.find(p => p.id === pageId);
      if (!page) return { success: false };

      // Always assign a unique module ID
      const moduleToAdd: ModuleInstance = {
        ...module,
        id: module.id || generateModuleId(),
        pageId,
      };
      if (module.type === 'todo' && !module.listId) {
        const listResult = await createList(module.title || 'My Tasks');
        if (listResult.success && listResult.listId) {
          moduleToAdd.listId = listResult.listId;
        }
      }

      // For stateful modules, assign a unique instance ID
      if (['pomodoro', 'eisenhower', 'alarms', 'booking'].includes(module.type) && !module.instanceId) {
        moduleToAdd.instanceId = crypto.randomUUID();
      }

      const updatedModules = [...page.modules, sanitizeModuleForFirestore(moduleToAdd)];

      await updateDoc(doc(db, 'sidebar_pages', pageId), {
        modules: updatedModules,
        updatedAt: serverTimestamp()
      });

      return { success: true, instanceId: moduleToAdd.instanceId };
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
      updatedModules[moduleIndex] = sanitizeModuleForFirestore({
        ...updatedModules[moduleIndex],
        ...updates,
      });

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

  // ── ID-based module operations (stable across reorders) ─────────────────

  /** Find a module by its unique ID across all pages */
  const findModuleById = useCallback((moduleId: string): { page: SidebarPage; module: ModuleInstance; index: number } | null => {
    for (const page of pages) {
      const index = page.modules.findIndex(m => m.id === moduleId);
      if (index !== -1) {
        return { page, module: page.modules[index], index };
      }
    }
    return null;
  }, [pages]);

  /** Remove a module by its unique ID */
  const removeModuleById = async (moduleId: string) => {
    if (!user?.uid) return { success: false };
    const found = findModuleById(moduleId);
    if (!found) return { success: false };
    return removeModule(found.page.id, found.index);
  };

  /** Move a module from one page to another by index */
  const moveModule = async (fromPageId: string, moduleIndex: number, toPageId: string) => {
    if (!user?.uid) return { success: false };
    if (fromPageId === toPageId) return { success: true };

    try {
      const fromPage = pages.find(p => p.id === fromPageId);
      const toPage = pages.find(p => p.id === toPageId);
      if (!fromPage || !toPage) return { success: false };
      const moduleToMove = fromPage.modules[moduleIndex];
      if (!moduleToMove) return { success: false };

      const updatedFromModules = fromPage.modules.filter((_, idx) => idx !== moduleIndex);
      const movedModule: ModuleInstance = {
        ...moduleToMove,
        pageId: toPageId,
      };
      const updatedToModules = [...toPage.modules, sanitizeModuleForFirestore(movedModule)];

      await Promise.all([
        updateDoc(doc(db, 'sidebar_pages', fromPageId), {
          modules: updatedFromModules,
          updatedAt: serverTimestamp(),
        }),
        updateDoc(doc(db, 'sidebar_pages', toPageId), {
          modules: updatedToModules,
          updatedAt: serverTimestamp(),
        }),
      ]);

      return { success: true };
    } catch (err) {
      console.error('Error moving module between pages:', err);
      toast.error('Failed to move module');
      return { success: false };
    }
  };

  /** Update a module by its unique ID */
  const updateModuleById = async (moduleId: string, updates: Partial<ModuleInstance>) => {
    if (!user?.uid) return { success: false };
    const found = findModuleById(moduleId);
    if (!found) return { success: false };
    return updateModule(found.page.id, found.index, updates);
  };

  /** Move a module by its unique ID to a target page */
  const moveModuleById = async (moduleId: string, toPageId: string) => {
    if (!user?.uid) return { success: false };
    const found = findModuleById(moduleId);
    if (!found) return { success: false };
    return moveModule(found.page.id, found.index, toPageId);
  };

  /** Toggle minimize state by module ID */
  const toggleModuleMinimizedById = async (moduleId: string) => {
    if (!user?.uid) return { success: false };
    const found = findModuleById(moduleId);
    if (!found) return { success: false };
    return toggleModuleMinimized(found.page.id, found.index);
  };

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
    toggleModuleMinimized,
    moveModule,
    // ID-based operations
    findModuleById,
    removeModuleById,
    updateModuleById,
    toggleModuleMinimizedById,
    moveModuleById,
  };
}

// ── useSharedPageModules ──────────────────────────────────────────────────────
// Listens to another user's sidebar_pages doc and returns its modules.
// Used when the active page has sharedFromPageId set (viewer/editor mode).
export function useSharedPageModules(sharedFromPageId: string | undefined) {
  const [modules, setModules] = useState<ModuleInstance[]>([]);

  useEffect(() => {
    if (!sharedFromPageId) {
      setModules([]);
      return;
    }

    let unsub: (() => void) | undefined;
    const tid = setTimeout(() => {
      unsub = onSnapshot(
        doc(db, 'sidebar_pages', sharedFromPageId),
        (snap) => {
          if (snap.exists()) {
            const rawModules: unknown[] = snap.data().modules ?? [];
            setModules(rawModules.map(ensureModuleId));
          } else {
            setModules([]);
          }
        },
        () => setModules([])
      );
    }, 0);

    return () => {
      clearTimeout(tid);
      unsub?.();
    };
  }, [sharedFromPageId]);

  return { modules };
}
