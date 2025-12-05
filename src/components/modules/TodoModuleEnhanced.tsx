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
  Plus,
  ChevronDown,
  Trash2,
  Edit2,
  List,
  MoreVertical,
} from "lucide-react";
import { toast } from "sonner";
import { useEventStore } from "@/lib/store";
import { useTodoLists } from "@/hooks/use-todo-lists";
import { useAuth } from "@/contexts/AuthContext.firebase";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface TodoModuleEnhancedProps {
  title: string;
  onRemove?: () => void;
  onTitleChange?: (title: string) => void;
  isMinimized?: boolean;
  onMinimize?: () => void;
  isDragging?: boolean;
}

const COLORS = [
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#10b981', label: 'Green' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ef4444', label: 'Red' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#06b6d4', label: 'Cyan' },
];

const TodoModuleEnhanced: React.FC<TodoModuleEnhancedProps> = ({
  title,
  onRemove,
  onTitleChange,
  isMinimized,
  onMinimize,
  isDragging,
}) => {
  const [newItem, setNewItem] = useState("");
  const [showNewListDialog, setShowNewListDialog] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListColor, setNewListColor] = useState('#8b5cf6');
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<{
    success?: boolean;
    message?: string;
  } | null>(null);
  
  const { addEvent, events } = useEventStore();
  const {
    lists,
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
  } = useTodoLists();
  const { user } = useAuth();

  useEffect(() => {
    if (submitStatus) {
      const timer = setTimeout(() => {
        setSubmitStatus(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [submitStatus]);

  const handleAddItem = async () => {
    if (newItem.trim()) {
      setSubmitStatus(null);
      const response = await addTodo(newItem.trim());

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

  const handleCreateList = async () => {
    if (newListName.trim()) {
      const result = await createList(newListName.trim(), newListColor);
      if (result.success && result.listId) {
        setActiveListId(result.listId);
        setNewListName("");
        setNewListColor('#8b5cf6');
        setShowNewListDialog(false);
      }
    }
  };

  const handleDeleteList = async (listId: string) => {
    if (confirm('Delete this list? Todos will be moved to default list.')) {
      await deleteList(listId, false);
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
      {/* List Selector */}
      <div className="flex items-center gap-2 mb-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 transition-colors flex-1 text-left">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: activeList?.color || '#8b5cf6' }}
              />
              <span className="text-sm flex-1 truncate">{activeList?.name || 'Select List'}</span>
              <ChevronDown size={14} className="text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {lists.map(list => (
              <DropdownMenuItem 
                key={list.id}
                onClick={() => setActiveListId(list.id)}
                className="flex items-center gap-2"
              >
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: list.color }}
                />
                <span className="flex-1 truncate">{list.name}</span>
                {list.id === activeListId && (
                  <CheckCircle2 size={14} className="text-primary" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowNewListDialog(true)}>
              <Plus size={14} className="mr-2" />
              Create New List
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* List Actions */}
        {activeList && !activeList.isDefault && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1.5 rounded-md hover:bg-white/10 transition-colors">
                <MoreVertical size={16} className="text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleDeleteList(activeList.id)}>
                <Trash2 size={14} className="mr-2" />
                Delete List
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

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
              className="flex items-center gap-2 bg-white/5 p-2 rounded-lg mb-2 group cursor-pointer hover:bg-white/10 transition-colors"
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
                className={cn("text-sm flex-1", {
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

      {/* New List Dialog */}
      <Dialog open={showNewListDialog} onOpenChange={setShowNewListDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New List</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">
                List Name
              </label>
              <Input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="e.g., Work Tasks, Shopping, etc."
                onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                Color
              </label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(color => (
                  <button
                    key={color.value}
                    onClick={() => setNewListColor(color.value)}
                    className={cn(
                      "w-8 h-8 rounded-full transition-all",
                      newListColor === color.value 
                        ? "ring-2 ring-white ring-offset-2 ring-offset-background scale-110" 
                        : "hover:scale-105"
                    )}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewListDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateList} disabled={!newListName.trim()}>
              Create List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleContainer>
  );
};

export default TodoModuleEnhanced;
