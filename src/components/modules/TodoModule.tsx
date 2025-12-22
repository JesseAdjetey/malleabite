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
} from "lucide-react";
import { toast } from "sonner";
import { useEventStore } from "@/lib/store";
import { useTodos, TodoItem } from "@/hooks/use-todos";
import { useAuth } from "@/contexts/AuthContext.firebase";

interface TodoModuleProps {
  title: string;
  onRemove?: () => void;
  onTitleChange?: (title: string) => void;
  initialItems?: TodoItem[];
  isMinimized?: boolean;
  onMinimize?: () => void;
  isDragging?: boolean;
}

const TodoModule: React.FC<TodoModuleProps> = ({
  title,
  onRemove,
  onTitleChange,
  isMinimized,
  onMinimize,
  isDragging,
}) => {
  const [newItem, setNewItem] = useState("");
  const [submitStatus, setSubmitStatus] = useState<{
    success?: boolean;
    message?: string;
  } | null>(null);
  const { addEvent, events } = useEventStore();
  const {
    todos,
    loading,
    error,
    addTodo,
    toggleTodo,
    linkTodoToEvent,
    refetchTodos,
    lastResponse,
  } = useTodos();
  const { user } = useAuth();

  useEffect(() => {
    if (submitStatus) {
      const timer = setTimeout(() => {
        setSubmitStatus(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [submitStatus]);

  useEffect(() => {
    if (user) {
      refetchTodos();
    }
  }, [user, refetchTodos]);

  useEffect(() => {
    const todoEvents = events.filter((event) => event.todoId);

    if (todoEvents.length > 0 && todos.length > 0) {
      todoEvents.forEach((event) => {
        if (event.todoId) {
          const matchingTodo = todos.find(
            (todo) => todo.id === event.todoId && !todo.isCalendarEvent
          );
          if (matchingTodo) {
            linkTodoToEvent(matchingTodo.id, event.id);
          }
        }
      });
    }
  }, [events, todos]);

  const handleAddItem = async () => {
    if (newItem.trim()) {
      setSubmitStatus(null);
      const response = await addTodo(newItem.trim());

      if (response.success) {
        setNewItem("");
        setSubmitStatus({
          success: true,
          message: response.message,
        });
      } else {
        setSubmitStatus({
          success: false,
          message: response.message,
        });
      }
    }
  };

  const handleToggleCompleted = async (id: string, completed: boolean) => {
    await toggleTodo(id);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleAddItem();
    }
  };

  const handleDragStart = (e: React.DragEvent, item: TodoItem) => {
    const todoData = {
      id: item.id,
      text: item.title,
      source: "todo-module",
      completed: item.completed,
    };

    console.log("Starting drag with data:", todoData);

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
          {loading ? "Loading..." : `${todos.length} todo items`}
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
      <div className="max-h-60 overflow-y-auto mb-3">
        {loading ? (
          <div className="flex justify-center items-center p-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="ml-2 text-sm">Loading todos...</span>
          </div>
        ) : error ? (
          <div className="text-center text-sm text-red-400 p-2">
            Error: {error}
          </div>
        ) : todos.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground p-2">
            No todos yet
          </div>
        ) : (
          todos.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 p-2 rounded-lg mb-2 group cursor-pointer"
              draggable={true}
              onDragStart={(e) => handleDragStart(e, item)}
              onDragEnd={handleDragEnd}
            >
              <div
                className="cursor-pointer flex-shrink-0"
                onClick={() => handleToggleCompleted(item.id, item.completed)}
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
                {item.title}
              </span>
              {item.isCalendarEvent && (
                <div className="text-primary text-xs opacity-70 flex-shrink-0 tooltip-container">
                  <Calendar size={16} />
                  <span className="tooltip">On Calendar</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {submitStatus && (
        <div
          className={cn(
            "text-sm p-2 mb-2 rounded-md flex items-center",
            submitStatus.success
              ? "bg-green-500/20 text-green-300"
              : "bg-red-500/20 text-red-300"
          )}
        >
          {submitStatus.success ? (
            <CheckCircle2 size={16} className="mr-1" />
          ) : (
            <AlertCircle size={16} className="mr-1" />
          )}
          {submitStatus.message}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={handleKeyDown}
          className="glass-input w-full"
          placeholder="Add a task..."
        />
        <button
          onClick={handleAddItem}
          className="bg-primary px-3 py-1 rounded-md hover:bg-primary/80 transition-colors"
        >
          Add
        </button>
      </div>
    </ModuleContainer>
  );
};

export default TodoModule;
