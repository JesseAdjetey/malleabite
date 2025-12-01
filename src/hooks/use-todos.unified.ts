// Firebase-only todos hook (Supabase completely removed)
export { useTodos, type TodoType } from './use-todos.firebase';

// Keep the original TodoItem interface for backward compatibility
export interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
  created_at?: string;
  updated_at?: string;
  user_id?: string;
}

// Map TodoType to TodoItem for backward compatibility
export const mapTodoTypeToItem = (todo: any): TodoItem => ({
  id: todo.id,
  title: todo.title,
  completed: todo.completed,
  created_at: todo.createdAt || todo.created_at,
  updated_at: todo.updatedAt || todo.updated_at,
  user_id: todo.userId || todo.user_id
});
