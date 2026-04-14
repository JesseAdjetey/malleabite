import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { ModuleInstance, ModuleType, SidebarPage, SizeLevel, generateModuleId, ensureModuleId } from "./types";

interface SidebarStoreType {
  pages: SidebarPage[];
  currentPageIndex: number;
  addPage: (title: string) => void;
  setCurrentPage: (index: number) => void;
  addModule: (pageIndex: number, moduleType: ModuleType) => void;
  addSharedModule: (module: ModuleInstance, pageIndex: number) => void;
  removeModule: (pageIndex: number, moduleIndex: number) => void;
  updatePageTitle: (pageIndex: number, title: string) => void;
  updateModuleTitle: (pageIndex: number, moduleIndex: number, title: string) => void;
  reorderModules: (pageIndex: number, fromIndex: number, toIndex: number) => void;
  toggleModuleMinimized: (pageIndex: number, moduleIndex: number) => void;
  setModuleSizeLevel: (pageIndex: number, moduleIndex: number, level: SizeLevel) => void;
}

export const useSidebarStore = create<SidebarStoreType>()(
  devtools(
    persist(
      (set, get) => ({
        pages: [
          {
            id: '1',
            title: 'Tasks',
            modules: [
              { id: generateModuleId(), type: 'todo', title: 'To-Do List' },
              { id: generateModuleId(), type: 'eisenhower', title: 'Eisenhower Matrix' }
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            userId: 'default',
            isDefault: true
          },
          {
            id: '2',
            title: 'Tools',
            modules: [
              { id: generateModuleId(), type: 'pomodoro', title: 'Pomodoro' },
              { id: generateModuleId(), type: 'alarms', title: 'Reminders' },
              { id: generateModuleId(), type: 'booking', title: 'Booking' }
            ],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            userId: 'default',
            isDefault: true
          }
        ],
        currentPageIndex: 0,
        addPage: (title) => {
          const now = new Date().toISOString();
          set(state => ({
            pages: [...state.pages, {
              id: Date.now().toString(),
              title,
              modules: [],
              createdAt: now,
              updatedAt: now,
              userId: 'default'
            }]
          }));
        },
        setCurrentPage: (index) => {
          set({ currentPageIndex: index });
        },
        addModule: (pageIndex, moduleType) => {
          set(state => {
            const newPages = [...state.pages];
            if (newPages[pageIndex]) {
              let defaultTitle = '';
              switch (moduleType) {
                case 'todo': defaultTitle = 'To-Do List'; break;
                case 'pomodoro': defaultTitle = 'Pomodoro'; break;
                case 'alarms': defaultTitle = 'Reminders'; break;
                case 'eisenhower': defaultTitle = 'Eisenhower Matrix'; break;
                case 'booking': defaultTitle = 'Booking'; break;
                case 'canvas': defaultTitle = 'Canvas'; break;
              }
              
              newPages[pageIndex] = {
                ...newPages[pageIndex],
                modules: [
                  ...newPages[pageIndex].modules, 
                  { id: generateModuleId(), type: moduleType, title: defaultTitle }
                ],
                updatedAt: new Date().toISOString()
              };
            }
            return { pages: newPages };
          });
        },
        addSharedModule: (module, pageIndex) => {
          set(state => {
            const newPages = [...state.pages];
            const targetIndex = Math.min(pageIndex, newPages.length - 1);
            if (newPages[targetIndex]) {
              newPages[targetIndex] = {
                ...newPages[targetIndex],
                modules: [...newPages[targetIndex].modules, module],
                updatedAt: new Date().toISOString(),
              };
            }
            return { pages: newPages };
          });
        },
        removeModule: (pageIndex, moduleIndex) => {
          set(state => {
            const newPages = [...state.pages];
            if (newPages[pageIndex] && newPages[pageIndex].modules) {
              newPages[pageIndex] = {
                ...newPages[pageIndex],
                modules: newPages[pageIndex].modules.filter((_, i) => i !== moduleIndex),
                updatedAt: new Date().toISOString()
              };
            }
            return { pages: newPages };
          });
        },
        updatePageTitle: (pageIndex, title) => {
          set(state => {
            const newPages = [...state.pages];
            if (newPages[pageIndex]) {
              newPages[pageIndex] = {
                ...newPages[pageIndex],
                title,
                updatedAt: new Date().toISOString()
              };
            }
            return { pages: newPages };
          });
        },
        updateModuleTitle: (pageIndex, moduleIndex, title) => {
          set(state => {
            const newPages = [...state.pages];
            if (newPages[pageIndex] && newPages[pageIndex].modules[moduleIndex]) {
              const updatedModules = [...newPages[pageIndex].modules];
              updatedModules[moduleIndex] = {
                ...updatedModules[moduleIndex],
                title
              };
              newPages[pageIndex] = {
                ...newPages[pageIndex],
                modules: updatedModules,
                updatedAt: new Date().toISOString()
              };
            }
            return { pages: newPages };
          });
        },
        reorderModules: (pageIndex, fromIndex, toIndex) => {
          set(state => {
            const newPages = [...state.pages];
            if (newPages[pageIndex] && newPages[pageIndex].modules) {
              const modules = [...newPages[pageIndex].modules];
              const [movedModule] = modules.splice(fromIndex, 1);
              modules.splice(toIndex, 0, movedModule);
              newPages[pageIndex] = {
                ...newPages[pageIndex],
                modules,
                updatedAt: new Date().toISOString()
              };
            }
            return { pages: newPages };
          });
        },
        toggleModuleMinimized: (pageIndex, moduleIndex) => {
          set(state => {
            const newPages = [...state.pages];
            if (newPages[pageIndex] && newPages[pageIndex].modules[moduleIndex]) {
              const module = newPages[pageIndex].modules[moduleIndex];
              const currentLevel = module.sizeLevel ?? (module.minimized ? 0 : 1);
              const newLevel: SizeLevel = currentLevel === 0 ? 1 : 0;
              const updatedModules = [...newPages[pageIndex].modules];
              updatedModules[moduleIndex] = {
                ...module,
                minimized: newLevel === 0,
                sizeLevel: newLevel,
              };
              newPages[pageIndex] = {
                ...newPages[pageIndex],
                modules: updatedModules,
                updatedAt: new Date().toISOString()
              };
            }
            return { pages: newPages };
          });
        },
        setModuleSizeLevel: (pageIndex, moduleIndex, level) => {
          set(state => {
            const newPages = [...state.pages];
            if (newPages[pageIndex]?.modules[moduleIndex]) {
              const updatedModules = [...newPages[pageIndex].modules];
              updatedModules[moduleIndex] = {
                ...updatedModules[moduleIndex],
                sizeLevel: level,
                minimized: level === 0,
              };
              newPages[pageIndex] = {
                ...newPages[pageIndex],
                modules: updatedModules,
                updatedAt: new Date().toISOString()
              };
            }
            return { pages: newPages };
          });
        }
      }),
      {
        name: "sidebar_data",
        skipHydration: true,
        merge: (persistedState: any, currentState) => {
          const merged = { ...currentState, ...persistedState };
          // Migrate: ensure all modules have IDs
          if (merged.pages) {
            merged.pages = merged.pages.map((page: SidebarPage) => ({
              ...page,
              modules: page.modules.map(m => ensureModuleId(m))
            }));
          }
          return merged as SidebarStoreType;
        }
      }
    )
  )
);
