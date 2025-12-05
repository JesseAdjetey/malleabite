// Hook for managing multiple todo lists (polymorphic todo containers)
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

export interface TodoList {
  id: string;
  name: string;
  color: string;
  icon?: string;
  userId: string;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  listId: string; // References which todo list this belongs to
  userId: string;
  createdAt: string;
  completedAt?: string;
  eventId?: string;
  isCalendarEvent?: boolean;
}

const DEFAULT_COLORS = [
  '#8b5cf6', // Purple
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
];

export function useTodoLists() {
  const [lists, setLists] = useState<TodoList[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Ensure default list exists for user
  const ensureDefaultList = useCallback(async () => {
    if (!user?.uid) return null;

    try {
      // Check if default list exists
      const listsQuery = query(
        collection(db, 'todo_lists'),
        where('userId', '==', user.uid),
        where('isDefault', '==', true)
      );
      const snapshot = await getDocs(listsQuery);

      if (snapshot.empty) {
        // Create default list
        const defaultList = {
          name: 'My Tasks',
          color: '#8b5cf6',
          icon: 'list',
          userId: user.uid,
          isDefault: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        const docRef = await addDoc(collection(db, 'todo_lists'), defaultList);
        return docRef.id;
      }

      return snapshot.docs[0].id;
    } catch (err) {
      console.error('Error ensuring default list:', err);
      return null;
    }
  }, [user?.uid]);

  // Fetch todo lists
  useEffect(() => {
    if (!user?.uid) {
      setLists([]);
      setTodos([]);
      setLoading(false);
      return;
    }

    // Subscribe to todo lists
    const listsQuery = query(
      collection(db, 'todo_lists'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'asc')
    );

    const unsubscribeLists = onSnapshot(listsQuery, async (snapshot) => {
      const listsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
      })) as TodoList[];

      // If no lists, create default one
      if (listsData.length === 0) {
        await ensureDefaultList();
        return; // The snapshot will fire again with the new list
      }

      setLists(listsData);
      
      // Set active list to default or first list if not set
      if (!activeListId) {
        const defaultList = listsData.find(l => l.isDefault) || listsData[0];
        if (defaultList) {
          setActiveListId(defaultList.id);
        }
      }
      
      setLoading(false);
    }, (error) => {
      console.error('Error fetching todo lists:', error);
      setError('Failed to fetch todo lists');
      setLoading(false);
    });

    // Subscribe to todos
    const todosQuery = query(
      collection(db, 'todo_items'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeTodos = onSnapshot(todosQuery, (snapshot) => {
      const todosData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        completedAt: doc.data().completedAt?.toDate?.()?.toISOString()
      })) as TodoItem[];

      setTodos(todosData);
    }, (error) => {
      console.error('Error fetching todos:', error);
    });

    return () => {
      unsubscribeLists();
      unsubscribeTodos();
    };
  }, [user?.uid, ensureDefaultList, activeListId]);

  // Create a new todo list
  const createList = async (name: string, color?: string): Promise<{ success: boolean; listId?: string }> => {
    if (!user?.uid || !name.trim()) {
      toast.error(!user ? 'User not authenticated' : 'List name cannot be empty');
      return { success: false };
    }

    try {
      const newList = {
        name: name.trim(),
        color: color || DEFAULT_COLORS[lists.length % DEFAULT_COLORS.length],
        userId: user.uid,
        isDefault: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'todo_lists'), newList);
      toast.success(`List "${name}" created`);
      return { success: true, listId: docRef.id };
    } catch (err) {
      console.error('Error creating todo list:', err);
      toast.error('Failed to create list');
      return { success: false };
    }
  };

  // Update a todo list
  const updateList = async (listId: string, updates: Partial<Pick<TodoList, 'name' | 'color' | 'icon'>>) => {
    if (!user?.uid) return { success: false };

    try {
      await updateDoc(doc(db, 'todo_lists', listId), {
        ...updates,
        updatedAt: serverTimestamp()
      });
      toast.success('List updated');
      return { success: true };
    } catch (err) {
      console.error('Error updating todo list:', err);
      toast.error('Failed to update list');
      return { success: false };
    }
  };

  // Delete a todo list (and optionally its todos)
  const deleteList = async (listId: string, deleteTodos: boolean = false) => {
    if (!user?.uid) return { success: false };

    const list = lists.find(l => l.id === listId);
    if (list?.isDefault) {
      toast.error('Cannot delete the default list');
      return { success: false };
    }

    try {
      if (deleteTodos) {
        // Delete all todos in this list
        const todosInList = todos.filter(t => t.listId === listId);
        for (const todo of todosInList) {
          await deleteDoc(doc(db, 'todo_items', todo.id));
        }
      } else {
        // Move todos to default list
        const defaultList = lists.find(l => l.isDefault);
        if (defaultList) {
          const todosInList = todos.filter(t => t.listId === listId);
          for (const todo of todosInList) {
            await updateDoc(doc(db, 'todo_items', todo.id), {
              listId: defaultList.id
            });
          }
        }
      }

      await deleteDoc(doc(db, 'todo_lists', listId));
      
      // Switch to default list if we deleted the active one
      if (activeListId === listId) {
        const defaultList = lists.find(l => l.isDefault);
        setActiveListId(defaultList?.id || null);
      }
      
      toast.success('List deleted');
      return { success: true };
    } catch (err) {
      console.error('Error deleting todo list:', err);
      toast.error('Failed to delete list');
      return { success: false };
    }
  };

  // Add a todo to a specific list
  const addTodo = async (text: string, listId?: string): Promise<{ success: boolean; todoId?: string }> => {
    if (!user?.uid || !text.trim()) {
      return { success: false };
    }

    const targetListId = listId || activeListId;
    if (!targetListId) {
      toast.error('No list selected');
      return { success: false };
    }

    try {
      const newTodo = {
        text: text.trim(),
        completed: false,
        listId: targetListId,
        userId: user.uid,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'todo_items'), newTodo);
      toast.success('Todo added');
      return { success: true, todoId: docRef.id };
    } catch (err) {
      console.error('Error adding todo:', err);
      toast.error('Failed to add todo');
      return { success: false };
    }
  };

  // Toggle todo completion
  const toggleTodo = async (todoId: string) => {
    if (!user?.uid) return;

    try {
      const todo = todos.find(t => t.id === todoId);
      if (!todo) return;

      await updateDoc(doc(db, 'todo_items', todoId), {
        completed: !todo.completed,
        completedAt: !todo.completed ? serverTimestamp() : null
      });
    } catch (err) {
      console.error('Error toggling todo:', err);
      toast.error('Failed to update todo');
    }
  };

  // Delete a todo
  const deleteTodo = async (todoId: string) => {
    if (!user?.uid) return;

    try {
      await deleteDoc(doc(db, 'todo_items', todoId));
      toast.success('Todo deleted');
    } catch (err) {
      console.error('Error deleting todo:', err);
      toast.error('Failed to delete todo');
    }
  };

  // Move a todo to a different list
  const moveTodo = async (todoId: string, newListId: string) => {
    if (!user?.uid) return { success: false };

    try {
      await updateDoc(doc(db, 'todo_items', todoId), {
        listId: newListId
      });
      toast.success('Todo moved');
      return { success: true };
    } catch (err) {
      console.error('Error moving todo:', err);
      toast.error('Failed to move todo');
      return { success: false };
    }
  };

  // Get todos for a specific list
  const getTodosForList = (listId: string) => {
    return todos.filter(t => t.listId === listId);
  };

  // Get active list's todos
  const activeTodos = activeListId ? getTodosForList(activeListId) : [];
  const activeList = lists.find(l => l.id === activeListId);

  return {
    lists,
    todos,
    activeTodos,
    activeList,
    activeListId,
    setActiveListId,
    loading,
    error,
    createList,
    updateList,
    deleteList,
    addTodo,
    toggleTodo,
    deleteTodo,
    moveTodo,
    getTodosForList
  };
}
