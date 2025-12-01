// Firebase-based todos hook
import { useState, useEffect, useCallback } from 'react';
import { 
  FirestoreService, 
  Todo, 
  COLLECTIONS, 
  timestampFromDate, 
  timestampToDate 
} from '@/integrations/firebase/firestore';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { toast } from 'sonner';

export interface TodoType {
  id: string;
  text: string;
  completed: boolean;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
  userId: string;
  moduleInstanceId?: string;
  eventId?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface FirebaseActionResponse {
  success: boolean;
  data?: any;
  error?: Error | unknown;
}

export function useTodos(moduleInstanceId?: string) {
  const [todos, setTodos] = useState<TodoType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  // Transform Firebase Todo to TodoType
  const transformFirebaseTodo = (fbTodo: Todo & { id: string }): TodoType => {
    return {
      id: fbTodo.id,
      text: fbTodo.text,
      completed: fbTodo.completed,
      priority: fbTodo.priority,
      dueDate: fbTodo.dueDate ? timestampToDate(fbTodo.dueDate).toISOString() : undefined,
      userId: fbTodo.userId,
      moduleInstanceId: fbTodo.moduleInstanceId,
      eventId: fbTodo.eventId,
      createdAt: fbTodo.createdAt ? timestampToDate(fbTodo.createdAt).toISOString() : undefined,
      updatedAt: fbTodo.updatedAt ? timestampToDate(fbTodo.updatedAt).toISOString() : undefined
    };
  };

  // Transform TodoType to Firebase Todo
  const transformToFirebaseTodo = (todo: Partial<TodoType>): Omit<Todo, 'id' | 'createdAt' | 'updatedAt'> => {
    return {
      text: todo.text!,
      completed: todo.completed || false,
      priority: todo.priority,
      dueDate: todo.dueDate ? timestampFromDate(new Date(todo.dueDate)) : undefined,
      userId: user!.uid,
      moduleInstanceId: todo.moduleInstanceId || moduleInstanceId,
      eventId: todo.eventId
    };
  };

  // Fetch todos from Firebase
  const fetchTodos = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      
      if (!user) {
        setTodos([]);
        setLoading(false);
        return;
      }
      
      console.log('Fetching Firebase todos for user:', user!.uid);
      
      const filters = [{ field: 'userId', operator: '==', value: user!.uid }];
      if (moduleInstanceId) {
        filters.push({ field: 'moduleInstanceId', operator: '==', value: moduleInstanceId });
      }
      
      const firebaseTodos = await FirestoreService.query<Todo>(
        COLLECTIONS.TODOS,
        filters as any,
        'createdAt',
        'desc'
      );
      
      const transformedTodos = firebaseTodos.map(transformFirebaseTodo);
      setTodos(transformedTodos);
      
    } catch (err: any) {
      console.error('Error fetching Firebase todos:', err);
      setError(err.message || String(err));
      setTodos([]);
    } finally {
      setLoading(false);
    }
  }, [user, moduleInstanceId]);

  // Add a new todo
  const addTodo = async (todoData: Partial<TodoType>): Promise<FirebaseActionResponse> => {
    if (!user) {
      toast.error('User not authenticated');
      return { success: false };
    }
    
    try {
      const firebaseTodo = transformToFirebaseTodo(todoData);
      const docRef = await FirestoreService.create<Todo>(COLLECTIONS.TODOS, firebaseTodo);
      
      await fetchTodos();
      toast.success('Todo added successfully!');
      return { success: true, data: { id: docRef.id } };
      
    } catch (err: any) {
      console.error('Error adding Firebase todo:', err);
      toast.error('Failed to add todo: ' + err.message);
      return { success: false, error: err };
    }
  };

  // Update an existing todo
  const updateTodo = async (todoId: string, updates: Partial<TodoType>): Promise<FirebaseActionResponse> => {
    if (!user) {
      toast.error('User not authenticated');
      return { success: false };
    }
    
    try {
      const firebaseUpdates = transformToFirebaseTodo(updates);
      await FirestoreService.update<Todo>(COLLECTIONS.TODOS, todoId, firebaseUpdates);
      
      await fetchTodos();
      toast.success('Todo updated successfully!');
      return { success: true };
      
    } catch (err: any) {
      console.error('Error updating Firebase todo:', err);
      toast.error('Failed to update todo: ' + err.message);
      return { success: false, error: err };
    }
  };

  // Toggle todo completion
  const toggleTodo = async (todoId: string): Promise<FirebaseActionResponse> => {
    const todo = todos.find(t => t.id === todoId);
    if (!todo) {
      return { success: false, error: new Error('Todo not found') };
    }
    
    return await updateTodo(todoId, { completed: !todo.completed });
  };

  // Remove a todo
  const removeTodo = async (todoId: string): Promise<FirebaseActionResponse> => {
    if (!user) {
      toast.error('User not authenticated');
      return { success: false };
    }
    
    try {
      await FirestoreService.delete(COLLECTIONS.TODOS, todoId);
      
      await fetchTodos();
      toast.success('Todo removed successfully!');
      return { success: true };
      
    } catch (err: any) {
      console.error('Error removing Firebase todo:', err);
      toast.error('Failed to remove todo: ' + err.message);
      return { success: false, error: err };
    }
  };

  // Set up real-time subscription
  useEffect(() => {
    if (!user) {
      setTodos([]);
      setLoading(false);
      return;
    }

    const filters = [{ field: 'userId', operator: '==', value: user!.uid }];
    if (moduleInstanceId) {
      filters.push({ field: 'moduleInstanceId', operator: '==', value: moduleInstanceId });
    }
    
    const unsubscribe = FirestoreService.subscribeToCollection<Todo>(
      COLLECTIONS.TODOS,
      (firebaseTodos) => {
        const transformedTodos = firebaseTodos.map(transformFirebaseTodo);
        setTodos(transformedTodos);
        setLoading(false);
      },
      filters as any,
      'createdAt',
      'desc'
    );

    return unsubscribe;
  }, [user, moduleInstanceId]);

  return {
    todos,
    loading,
    error,
    addTodo,
    updateTodo,
    toggleTodo,
    removeTodo,
    fetchTodos
  };
}
