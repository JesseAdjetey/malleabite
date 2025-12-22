import React, { useState, useEffect } from "react";
import ModuleContainer from "./ModuleContainer";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Circle,
  CheckCircle,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Trash2,
  List,
} from "lucide-react";
import { toast } from "sonner";
import { useEventStore } from "@/lib/store";
import { useTodoLists } from "@/hooks/use-todo-lists";
import { useAuth } from "@/contexts/AuthContext.firebase";


interface TodoModuleEnhancedProps {
  title: string;
  onRemove?: () => void;
  onTitleChange?: (title: string) => void;
  isMinimized?: boolean;
  onMinimize?: () => void;
  isDragging?: boolean;
  listId?: string; // Specific list ID for this module
}

const TodoModuleEnhanced: React.FC<TodoModuleEnhancedProps> = ({
  title,
  onRemove,
  onTitleChange,
  isMinimized,
  onMinimize,
  isDragging,
  listId: moduleListId,
}) => {
  const [newItem, setNewItem] = useState("");
  const [submitStatus, setSubmitStatus] = useState<{
    success?: boolean;
    message?: string;
  } | null>(null);
  
  const { addEvent, events } = useEventStore();
  const {
    getTodosForList,
    lists,
    loading,
    error,
    addTodo,
    toggleTodo,
    deleteTodo,
    updateList,
  } = useTodoLists();
  
  // Use module-specific list
  const activeList = lists.find(l => l.id === moduleListId);
  const activeTodos = moduleListId ? getTodosForList(moduleListId) : [];
  const { user } = useAuth();

  // Sync title changes to the todo list
  useEffect(() => {
    if (moduleListId && title && activeList && title !== activeList.name) {
      updateList(moduleListId, { name: title });
    }
  }, [title, moduleListId, activeList, updateList]);

  useEffect(() => {
    if (submitStatus) {
      const timer = setTimeout(() => {
        setSubmitStatus(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [submitStatus]);

  const handleAddItem = async () => {
    if (newItem.trim() && moduleListId) {
      setSubmitStatus(null);
      const response = await addTodo(newItem.trim(), moduleListId);

      if (response.success) {
        setNewItem("");
        setSubmitStatus({
          success: true,
          message: "Todo added!",
        });
      } else {
        setSubmitStatus({
          success: false,
          message: "Failed to add todo",
        });
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddItem();
    }
  };

  const handleDragStart = (e: React.DragEvent, item: any) => {
    const todoData = {
      id: item.id,
      text: item.text,
      source: "todo-module",
      completed: item.completed,
    };

    e.dataTransfer.setData("application/json", JSON.stringify(todoData));
    e.dataTransfer.effectAllowed = "move";

    if (e.currentTarget) {
      e.currentTarget.classList.add("opacity-50");
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (e.currentTarget) {
      e.currentTarget.classList.remove("opacity-50");
    }
  };

  if (isMinimized) {
    return (
      <ModuleContainer
        title={title}
        onRemove={onRemove}
        onTitleChange={onTitleChange}
        isMinimized={isMinimized}
        onMinimize={onMinimize}
      >
        <div className="text-center text-sm text-muted-foreground py-2">
          {loading ? "Loading..." : `${activeTodos.length} todo items`}
        </div>
      </ModuleContainer>
    );
  }

  if (!user) {
    return (
      <ModuleContainer
        title={title}
        onRemove={onRemove}
        onTitleChange={onTitleChange}
        isMinimized={isMinimized}
        onMinimize={onMinimize}
      >
        <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
          Sign in to use todos
        </div>
      </ModuleContainer>
    );
  }

  return (
    <ModuleContainer
      title={title}
      onRemove={onRemove}
      onTitleChange={onTitleChange}
      isMinimized={isMinimized}
      onMinimize={onMinimize}
    >
      {/* Todo Items */}
      <div className="max-h-52 overflow-y-auto mb-3 scrollbar-thin">
        {loading ? (
          <div className="flex justify-center items-center p-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="ml-2 text-sm">Loading...</span>
          </div>
        ) : error ? (
          <div className="text-center text-sm text-red-400 p-2">
            Error: {error}
          </div>
        ) : activeTodos.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground p-4">
            <List className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No todos in this list
          </div>
        ) : (
          activeTodos.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 p-2 rounded-lg mb-2 group cursor-pointer hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
              draggable={true}
              onDragStart={(e) => handleDragStart(e, item)}
              onDragEnd={handleDragEnd}
            >
              <div
                className="cursor-pointer flex-shrink-0"
                onClick={() => toggleTodo(item.id)}
              >
                {item.completed ? (
                  <CheckCircle size={18} className="text-primary" />
                ) : (
                  <Circle size={18} className="text-primary/60" />
                )}
              </div>
              <span
                className={cn("text-sm flex-1 text-gray-800 dark:text-white", {
                  "line-through opacity-50": item.completed,
                })}
              >
                {item.text}
              </span>
              {item.isCalendarEvent && (
                <Calendar size={14} className="text-primary/70 flex-shrink-0" />
              )}
              <button
                onClick={() => deleteTodo(item.id)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-all"
              >
                <Trash2 size={14} className="text-red-400" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Status Message */}
      {submitStatus && (
        <div
          className={cn(
            "text-xs p-2 mb-2 rounded-md flex items-center",
            submitStatus.success
              ? "bg-green-500/20 text-green-300"
              : "bg-red-500/20 text-red-300"
          )}
        >
          {submitStatus.success ? (
            <CheckCircle2 size={14} className="mr-1" />
          ) : (
            <AlertCircle size={14} className="mr-1" />
          )}
          {submitStatus.message}
        </div>
      )}

      {/* Add Todo Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={handleKeyDown}
          className="glass-input w-full text-sm"
          placeholder="Add a task..."
        />
        <button
          onClick={handleAddItem}
          className="bg-primary px-3 py-1 rounded-md hover:bg-primary/80 transition-colors text-sm"
        >
          Add
        </button>
      </div>
    </ModuleContainer>
  );
};

export default TodoModuleEnhanced;
