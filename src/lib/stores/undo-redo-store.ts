import { create } from 'zustand';
import { CalendarEventType } from '@/lib/stores/types';
import { toast } from 'sonner';

export type ActionType = 
  | 'CREATE_EVENT'
  | 'UPDATE_EVENT'
  | 'DELETE_EVENT'
  | 'CREATE_TODO'
  | 'COMPLETE_TODO'
  | 'DELETE_TODO'
  | 'CREATE_ALARM'
  | 'DELETE_ALARM'
  | 'CREATE_REMINDER'
  | 'DELETE_REMINDER'
  | 'BULK_DELETE_EVENTS'
  | 'BULK_UPDATE_EVENTS';

export interface UndoableAction {
  id: string;
  type: ActionType;
  description: string;
  timestamp: Date;
  // Data needed to undo the action
  undoData: any;
  // Data needed to redo the action
  redoData: any;
}

interface UndoRedoState {
  undoStack: UndoableAction[];
  redoStack: UndoableAction[];
  maxStackSize: number;
  
  // Methods
  pushAction: (action: Omit<UndoableAction, 'id' | 'timestamp'>) => void;
  undo: () => UndoableAction | null;
  redo: () => UndoableAction | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
  getLastAction: () => UndoableAction | null;
}

export const useUndoRedoStore = create<UndoRedoState>((set, get) => ({
  undoStack: [],
  redoStack: [],
  maxStackSize: 50, // Maximum number of undo actions to keep

  pushAction: (action) => {
    const newAction: UndoableAction = {
      ...action,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };

    set((state) => {
      const newUndoStack = [...state.undoStack, newAction];
      // Keep only the last maxStackSize actions
      if (newUndoStack.length > state.maxStackSize) {
        newUndoStack.shift();
      }
      return {
        undoStack: newUndoStack,
        redoStack: [], // Clear redo stack when a new action is performed
      };
    });
  },

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) {
      toast.info('Nothing to undo');
      return null;
    }

    const action = state.undoStack[state.undoStack.length - 1];
    
    set((state) => ({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, action],
    }));

    return action;
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0) {
      toast.info('Nothing to redo');
      return null;
    }

    const action = state.redoStack[state.redoStack.length - 1];
    
    set((state) => ({
      redoStack: state.redoStack.slice(0, -1),
      undoStack: [...state.undoStack, action],
    }));

    return action;
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  clearHistory: () => {
    set({ undoStack: [], redoStack: [] });
  },

  getLastAction: () => {
    const state = get();
    return state.undoStack.length > 0 
      ? state.undoStack[state.undoStack.length - 1] 
      : null;
  },
}));

// Hook for using undo/redo with keyboard shortcuts
export function useUndoRedoKeyboard(
  onUndo: (action: UndoableAction) => Promise<void>,
  onRedo: (action: UndoableAction) => Promise<void>
) {
  const { undo, redo, canUndo, canRedo } = useUndoRedoStore();

  const handleKeyDown = async (e: KeyboardEvent) => {
    // Ctrl/Cmd + Z for undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (canUndo()) {
        const action = undo();
        if (action) {
          await onUndo(action);
          toast.success(`Undid: ${action.description}`);
        }
      }
    }
    
    // Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y for redo
    if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
      e.preventDefault();
      if (canRedo()) {
        const action = redo();
        if (action) {
          await onRedo(action);
          toast.success(`Redid: ${action.description}`);
        }
      }
    }
  };

  return { handleKeyDown };
}
