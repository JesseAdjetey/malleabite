// Firebase-only todos hook for production
import { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDoc,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { toast } from 'sonner';

export interface TodoType {
  id: string;
  text: string;
  completed: boolean;
  userId: string;
  created_at: string;
  event_id?: string;
  isCalendarEvent?: boolean;
  listId?: string; // Optional list ID for polymorphic todo lists
}

// Legacy interface for compatibility
export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  created_at?: string;
  completed_at?: string;
  isCalendarEvent?: boolean;
  eventId?: string;
  listId?: string;
}

// Hook options interface
interface UseTodosOptions {
  listId?: string; // Filter todos by list ID
}

export function useTodos(options: UseTodosOptions = {}) {
  const { listId } = options;
  const [todos, setTodos] = useState<TodoType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<{ success: boolean; message: string } | null>(null);
  const { user } = useAuth();

  // Fetch todos from Firebase
  useEffect(() => {
    if (!user?.uid) {
      setTodos([]);
      setLoading(false);
      return;
    }

    // Build query with optional listId filter
    let todosQuery;
    if (listId) {
      // Filter by specific list
      todosQuery = query(
        collection(db, 'todos'),
        where('userId', '==', user.uid),
        where('listId', '==', listId),
        orderBy('created_at', 'desc')
      );
    } else {
      // Get todos without a listId (legacy/default behavior)
      todosQuery = query(
        collection(db, 'todos'),
        where('userId', '==', user.uid),
        orderBy('created_at', 'desc')
      );
    }

    const unsubscribe = onSnapshot(todosQuery, (snapshot) => {
      const todosList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        created_at: doc.data().created_at?.toDate?.()?.toISOString() || new Date().toISOString(),
        isCalendarEvent: !!doc.data().event_id
      })) as TodoType[];
      
      setTodos(todosList);
      setLoading(false);
      setError(null);
    }, (error) => {
      console.error('Error fetching todos:', error);
      setError('Failed to fetch todos');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid, listId]);

  // Refetch todos function for manual refresh
  const refetchTodos = async () => {
    if (!user?.uid) return;
    setLoading(true);
    // The real-time listener will handle the update
    setLoading(false);
  };

  // Add a new todo
  const addTodo = async (text: string, todoListId?: string): Promise<{ success: boolean; message: string }> => {
    if (!user?.uid || !text.trim()) {
      return { success: false, message: !user ? 'User not authenticated' : 'Text cannot be empty' };
    }

    try {
      const todoData: Record<string, unknown> = {
        text: text.trim(),
        completed: false,
        userId: user.uid,
        created_at: serverTimestamp()
      };
      
      // Add listId if provided (either from parameter or from hook options)
      const effectiveListId = todoListId || listId;
      if (effectiveListId) {
        todoData.listId = effectiveListId;
      }
      
      await addDoc(collection(db, 'todos'), todoData);
      toast.success('Todo added');
      const response = { success: true, message: 'Todo added successfully' };
      setLastResponse(response);
      return response;
    } catch (error) {
      console.error('Error adding todo:', error);
      toast.error('Failed to add todo');
      const response = { success: false, message: 'Failed to add todo' };
      setLastResponse(response);
      return response;
    }
  };

  // Toggle todo completion
  const toggleTodo = async (id: string) => {
    if (!user?.uid) return;

    try {
      const todo = todos.find(t => t.id === id);
      if (!todo) return;

      await updateDoc(doc(db, 'todos', id), {
        completed: !todo.completed
      });
      toast.success(todo.completed ? 'Todo marked incomplete' : 'Todo completed');
    } catch (error) {
      console.error('Error toggling todo:', error);
      toast.error('Failed to update todo');
    }
  };

  // Delete a todo
  const deleteTodo = async (id: string) => {
    if (!user?.uid) {
      console.error('Cannot delete todo: user not authenticated');
      return;
    }

    console.log('Attempting to delete todo with id:', id, 'for user:', user.uid);

    try {
      // First check if the document exists and belongs to this user
      const todoRef = doc(db, 'todos', id);
      const todoDoc = await getDoc(todoRef);
      
      if (!todoDoc.exists()) {
        console.error('Todo document does not exist:', id);
        toast.error('Todo not found');
        return;
      }
      
      const todoData = todoDoc.data();
      console.log('Todo data:', todoData);
      
      if (todoData?.userId !== user.uid) {
        console.error('Todo belongs to different user. Todo userId:', todoData?.userId, 'Current user:', user.uid);
        toast.error('Permission denied');
        return;
      }
      
      await deleteDoc(todoRef);
      toast.success('Todo deleted');
    } catch (error) {
      console.error('Error deleting todo:', error);
      toast.error('Failed to delete todo');
    }
  };

  // Update a todo's text
  const updateTodoText = async (id: string, newText: string): Promise<{ success: boolean; message: string }> => {
    if (!user?.uid || !newText.trim()) {
      return { success: false, message: !user ? 'User not authenticated' : 'Text cannot be empty' };
    }

    try {
      await updateDoc(doc(db, 'todos', id), {
        text: newText.trim()
      });
      return { success: true, message: 'Todo title updated successfully' };
    } catch (error) {
      console.error('Error updating todo title:', error);
      return { success: false, message: 'Failed to update todo title' };
    }
  };

  // Link todo to calendar event
  const linkTodoToEvent = async (todoId: string, eventId: string) => {
    if (!user?.uid) return { success: false, message: 'User not authenticated' };

    try {
      await updateDoc(doc(db, 'todos', todoId), {
        event_id: eventId
      });
      return { success: true, message: 'Todo linked to event' };
    } catch (error) {
      console.error('Error linking todo to event:', error);
      return { success: false, message: 'Failed to link todo to event' };
    }
  };

  // Unlink todo from calendar event
  const unlinkTodoFromEvent = async (todoId: string) => {
    if (!user?.uid) return { success: false, message: 'User not authenticated' };

    try {
      await updateDoc(doc(db, 'todos', todoId), {
        event_id: null
      });
      return { success: true, message: 'Todo unlinked from event' };
    } catch (error) {
      console.error('Error unlinking todo from event:', error);
      return { success: false, message: 'Failed to unlink todo from event' };
    }
  };

  return {
    todos,
    loading,
    error,
    lastResponse,
    addTodo,
    toggleTodo,
    deleteTodo,
    updateTodoText,
    linkTodoToEvent,
    unlinkTodoFromEvent,
    refetchTodos
  };
}
