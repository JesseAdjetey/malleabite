import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { EventTemplate, CreateTemplateInput, TemplateFilter } from '@/types/template';

interface TemplateStore {
  templates: EventTemplate[];
  isLoading: boolean;
  error: string | null;
  activeFilter: TemplateFilter;
  
  // Actions
  setTemplates: (templates: EventTemplate[]) => void;
  addTemplate: (template: EventTemplate) => void;
  updateTemplate: (id: string, updates: Partial<EventTemplate>) => void;
  deleteTemplate: (id: string) => void;
  toggleFavorite: (id: string) => void;
  incrementUsage: (id: string) => void;
  setFilter: (filter: TemplateFilter) => void;
  clearFilter: () => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  
  // Computed
  getFilteredTemplates: () => EventTemplate[];
  getTemplateById: (id: string) => EventTemplate | undefined;
  getFavoriteTemplates: () => EventTemplate[];
  getMostUsedTemplates: (limit?: number) => EventTemplate[];
  getTemplatesByCategory: (category: string) => EventTemplate[];
}

export const useTemplateStore = create<TemplateStore>()(
  persist(
    (set, get) => ({
      templates: [],
      isLoading: false,
      error: null,
      activeFilter: {},

      setTemplates: (templates) => set({ templates, error: null }),

      addTemplate: (template) =>
        set((state) => ({
          templates: [...state.templates, template],
          error: null,
        })),

      updateTemplate: (id, updates) =>
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
          ),
          error: null,
        })),

      deleteTemplate: (id) =>
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
          error: null,
        })),

      toggleFavorite: (id) =>
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id ? { ...t, isFavorite: !t.isFavorite } : t
          ),
        })),

      incrementUsage: (id) =>
        set((state) => ({
          templates: state.templates.map((t) =>
            t.id === id
              ? {
                  ...t,
                  usageCount: t.usageCount + 1,
                  lastUsed: new Date().toISOString(),
                }
              : t
          ),
        })),

      setFilter: (filter) => set({ activeFilter: filter }),

      clearFilter: () => set({ activeFilter: {} }),

      setLoading: (isLoading) => set({ isLoading }),

      setError: (error) => set({ error }),

      // Computed getters
      getFilteredTemplates: () => {
        const { templates, activeFilter } = get();
        let filtered = [...templates];

        if (activeFilter.category) {
          filtered = filtered.filter((t) => t.category === activeFilter.category);
        }

        if (activeFilter.search) {
          const search = activeFilter.search.toLowerCase();
          filtered = filtered.filter(
            (t) =>
              t.name.toLowerCase().includes(search) ||
              t.title.toLowerCase().includes(search) ||
              t.description?.toLowerCase().includes(search) ||
              t.tags?.some((tag) => tag.toLowerCase().includes(search))
          );
        }

        if (activeFilter.tags && activeFilter.tags.length > 0) {
          filtered = filtered.filter((t) =>
            activeFilter.tags!.some((tag) => t.tags?.includes(tag))
          );
        }

        if (activeFilter.favoritesOnly) {
          filtered = filtered.filter((t) => t.isFavorite);
        }

        // Sort by favorites first, then by usage count, then by last used
        return filtered.sort((a, b) => {
          if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
          if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount;
          if (a.lastUsed && b.lastUsed) {
            return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
          }
          return 0;
        });
      },

      getTemplateById: (id) => {
        return get().templates.find((t) => t.id === id);
      },

      getFavoriteTemplates: () => {
        return get().templates.filter((t) => t.isFavorite);
      },

      getMostUsedTemplates: (limit = 5) => {
        return [...get().templates]
          .sort((a, b) => b.usageCount - a.usageCount)
          .slice(0, limit);
      },

      getTemplatesByCategory: (category) => {
        return get().templates.filter((t) => t.category === category);
      },
    }),
    {
      name: 'malleabite-templates',
      partialize: (state) => ({ templates: state.templates }),
    }
  )
);
