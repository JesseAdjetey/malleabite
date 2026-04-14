import React, { useState, useEffect, useCallback } from "react";
import { sounds } from "@/lib/sounds";
import { motion, AnimatePresence } from "framer-motion";
import ModuleContainer from "./ModuleContainer";
import TodoistConnectSheet from "./todoist/TodoistConnectSheet";
import MicrosoftTasksConnectDialog from "./todoist/MicrosoftTasksConnectDialog";
import GoogleTasksConnectDialog from "./todoist/GoogleTasksConnectDialog";
import TaskSyncPickerDialog from "./todoist/TaskSyncPickerDialog";
import { useTodoistIntegration } from "@/hooks/use-todoist-integration";
import { useMicrosoftIntegration } from "@/hooks/use-microsoft-integration";
import { useGoogleTasksIntegration } from "@/hooks/use-google-tasks";
import { useCalendarGroups } from "@/hooks/use-calendar-groups";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Circle,
  CheckCircle,
  Loader2,
  List,
  LayoutGrid,
  Clock,
  Plus,
  CalendarDays,
  Star,
  Pencil,
  X,
  CheckCircle2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  useTodoLists,
  useSharedListTodos,
  directDeleteTodo,
  directUpdateTodo,
  TodoItem,
} from "@/hooks/use-todo-lists";
import { useAuth } from "@/contexts/AuthContext.firebase";
import { useModuleShare } from "@/hooks/use-module-sharing";
import { useEisenhower } from "@/hooks/use-eisenhower";
import { useTodoCalendarIntegration } from "@/hooks/use-todo-calendar-integration";
import { useMirrorSync } from "@/hooks/use-mirror-sync";
import { useEventHighlightStore } from "@/lib/stores/event-highlight-store";
import { CalendarEventType } from "@/lib/stores/types";
import { useModuleSize } from "@/contexts/ModuleSizeContext";

// ── Deadline helpers ──────────────────────────────────────────────────────────

function formatDeadline(iso: string): { text: string; isOverdue: boolean; isSoon: boolean } {
  const date = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.floor((d.getTime() - today.getTime()) / 86_400_000);
  if (diff < 0) return { text: "Overdue", isOverdue: true, isSoon: false };
  if (diff === 0) return { text: "Today", isOverdue: false, isSoon: true };
  if (diff === 1) return { text: "Tomorrow", isOverdue: false, isSoon: true };
  if (diff < 7) return { text: `${diff}d`, isOverdue: false, isSoon: true };
  return {
    text: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    isOverdue: false,
    isSoon: false,
  };
}

function DeadlineBadge({ deadline }: { deadline: string }) {
  const { text, isOverdue, isSoon } = formatDeadline(deadline);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0",
        isOverdue
          ? "bg-red-500/20 text-red-400"
          : isSoon
          ? "bg-amber-500/20 text-amber-400"
          : "bg-muted text-muted-foreground"
      )}
    >
      <Clock size={9} />
      {text}
    </span>
  );
}

// ── Kanban column helper ──────────────────────────────────────────────────────

function kanbanColumn(item: TodoItem): "todo" | "done" {
  if (item.completed || item.status === "done" || item.status === "in_progress") {
    return item.completed || item.status === "done" ? "done" : "todo";
  }
  return "todo";
}

// ── Shared props ──────────────────────────────────────────────────────────────

interface MoveTarget {
  id: string;
  title: string;
}

interface TodoModuleEnhancedProps {
  title: string;
  onRemove?: () => void;
  onTitleChange?: (title: string) => void;
  isMinimized?: boolean;
  onMinimize?: () => void;
  isDragging?: boolean;
  listId?: string;
  moduleId?: string;
  sharedFromInstanceId?: string;
  sharedRole?: "viewer" | "editor";
  moveTargets?: MoveTarget[];
  onMoveToPage?: (pageId: string) => void;
  onShare?: () => void;
  isReadOnly?: boolean;
  contentReadOnly?: boolean;
  todoistProjectId?: string;
  onTodoistProjectChange?: (projectId: string | null, projectName?: string) => void;
  msListId?: string;
  onMsListChange?: (listId: string | null, listName?: string) => void;
  googleTaskListId?: string;
  onGoogleTaskListChange?: (taskListId: string | null, taskListTitle?: string) => void;
}

// ── TodoItem Row ──────────────────────────────────────────────────────────────

interface TodoRowProps {
  item: TodoItem;
  isViewOnly: boolean;
  isCollaborativeModule: boolean;
  showDeadline?: boolean;
  onToggle: (item: TodoItem) => void;
  onDelete: (id: string) => void;
  onFavorite?: (id: string) => void;
  onUpdate?: (id: string, updates: { deadline?: string; description?: string }) => void;
  highlightedItemId?: string | null;
  highlightedItemType?: string | null;
  spotlightRef?: (node: HTMLDivElement | null) => void;
  onDragStart?: (e: React.DragEvent, item: TodoItem) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

const TodoRow = React.forwardRef<HTMLDivElement, TodoRowProps>(function TodoRow({
  item,
  isViewOnly,
  showDeadline = true,
  onToggle,
  onDelete,
  onFavorite,
  onUpdate,
  highlightedItemId,
  highlightedItemType,
  spotlightRef,
  onDragStart,
  onDragEnd,
}, forwardedRef) {
  const isHighlighted = highlightedItemId === item.id && highlightedItemType === "todo";
  const { sizeLevel } = useModuleSize();
  const isExpanded = (sizeLevel ?? 1) >= 2;

  const [isEditing, setIsEditing] = useState(false);
  const [editDeadline, setEditDeadline] = useState(item.deadline || "");
  const [editDescription, setEditDescription] = useState(item.description || "");

  // Sync edit state when item updates externally
  useEffect(() => {
    if (!isEditing) {
      setEditDeadline(item.deadline || "");
      setEditDescription(item.description || "");
    }
  }, [item.deadline, item.description, isEditing]);

  const saveEdits = () => {
    setIsEditing(false);
    if (onUpdate) {
      onUpdate(item.id, {
        deadline: editDeadline || undefined,
        description: editDescription || undefined,
      });
    }
  };

  const isDone = item.completed || item.status === "done";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: -16, scale: 0.95, transition: { duration: 0.15, ease: [0.4, 0, 1, 1] } }}
      transition={{ type: "spring", damping: 25, stiffness: 320 }}
      ref={(node) => {
        if (isHighlighted && spotlightRef) spotlightRef(node);
        if (forwardedRef) {
          if (typeof forwardedRef === "function") forwardedRef(node);
          else forwardedRef.current = node;
        }
      }}
      data-todo-id={item.id}
      className={cn(
        "group mb-1.5 transition-colors overflow-hidden",
        isExpanded
          ? "rounded-sm hover:bg-foreground/[0.04]"
          : "bg-gray-100 dark:bg-white/5 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10",
        isHighlighted && "event-spotlight"
      )}
      draggable={!!onDragStart}
      onDragStart={onDragStart ? ((e: any) => onDragStart(e, item)) as any : undefined}
      onDragEnd={onDragEnd ? ((e: any) => onDragEnd(e)) as any : undefined}
    >
      {/* Main row */}
      <div className="flex items-center gap-2 p-2">
        {/* Checkbox */}
        <motion.div
          className={cn("flex-shrink-0", !isViewOnly && "cursor-pointer")}
          onClick={isViewOnly ? undefined : () => onToggle(item)}
          whileTap={!isViewOnly ? { scale: 0.8 } : undefined}
          transition={{ type: "spring", damping: 20, stiffness: 400 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {isDone ? (
              <motion.span key="checked" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ type: "spring", damping: 20, stiffness: 400 }}>
                <CheckCircle size={18} className="text-primary" />
              </motion.span>
            ) : (
              <motion.span key="unchecked" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={{ type: "spring", damping: 20, stiffness: 400 }}>
                <Circle size={18} className={isViewOnly ? "text-primary/30" : "text-primary/60"} />
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Title + description */}
        <div className="flex flex-col min-w-0 flex-1">
          <span className={cn("text-sm text-gray-800 dark:text-white break-words min-w-0", isDone && "line-through opacity-50")}>
            {item.text}
          </span>
          {item.description && !isEditing && (
            <span className="text-[11px] text-muted-foreground truncate leading-tight">{item.description}</span>
          )}
        </div>

        {/* Deadline badge */}
        {showDeadline && item.deadline && <DeadlineBadge deadline={item.deadline} />}
        {item.isCalendarEvent && <Calendar size={14} className="text-primary/70 flex-shrink-0" />}

        {/* Pinned star */}
        {!isViewOnly && onFavorite && (
          <button
            onClick={(e) => { e.stopPropagation(); onFavorite(item.id); }}
            className={cn(
              "flex-shrink-0 p-1 rounded transition-all",
              item.pinned
                ? "text-amber-400 opacity-100"
                : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-amber-400"
            )}
            title={item.pinned ? "Unpin" : "Pin to top"}
          >
            <Star size={13} fill={item.pinned ? "currentColor" : "none"} />
          </button>
        )}

        {/* Edit */}
        {!isViewOnly && onUpdate && (
          <button
            onClick={(e) => { e.stopPropagation(); setIsEditing(!isEditing); }}
            className={cn(
              "flex-shrink-0 p-1 rounded transition-all",
              isEditing
                ? "text-primary opacity-100"
                : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground"
            )}
            title="Edit"
          >
            <Pencil size={13} />
          </button>
        )}

        {/* Delete */}
        {!isViewOnly && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
            className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 hover:bg-red-500/20 rounded transition-all"
          >
            <Trash2 size={13} className="text-red-400" />
          </button>
        )}
      </div>

      {/* Inline edit panel */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2.5 flex flex-col gap-1.5 border-t border-border/30 pt-2">
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Add notes or description..."
                rows={2}
                className="w-full text-xs bg-transparent resize-none text-muted-foreground placeholder:text-muted-foreground/40 outline-none leading-relaxed"
              />
              <div className="flex items-center gap-2">
                <CalendarDays size={12} className="text-muted-foreground shrink-0" />
                <input
                  type="date"
                  value={editDeadline}
                  onChange={(e) => setEditDeadline(e.target.value)}
                  className="text-xs bg-muted/60 rounded px-2 py-0.5 text-muted-foreground border-0 outline-none"
                />
                {editDeadline && (
                  <button
                    onClick={() => setEditDeadline("")}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </button>
                )}
                <div className="ml-auto flex items-center gap-1">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-accent transition-colors"
                  >
                    <X size={12} />
                  </button>
                  <button
                    onClick={saveEdits}
                    className="flex items-center gap-1 text-xs bg-primary/15 text-primary px-2 py-0.5 rounded hover:bg-primary/25 transition-colors"
                  >
                    <CheckCircle2 size={11} />
                    Save
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

// ── Add Form ──────────────────────────────────────────────────────────────────

interface AddFormProps {
  onAdd: (text: string, deadline?: string) => void;
  showDeadline?: boolean;
}

const AddForm: React.FC<AddFormProps> = ({ onAdd, showDeadline = false }) => {
  const [text, setText] = useState("");
  const [deadline, setDeadline] = useState("");
  const [showDate, setShowDate] = useState(false);

  const submit = () => {
    if (!text.trim()) return;
    onAdd(text.trim(), deadline || undefined);
    setText("");
    setDeadline("");
    setShowDate(false);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="glass-input w-full text-sm"
          placeholder="Add a task..."
        />
        {showDeadline && (
          <button
            onClick={() => setShowDate(!showDate)}
            className={cn("p-2 rounded-lg transition-colors flex-shrink-0", showDate ? "bg-primary/20 text-primary" : "hover:bg-accent text-muted-foreground")}
            title="Set deadline"
          >
            <CalendarDays size={14} />
          </button>
        )}
        <motion.button
          onClick={submit}
          whileTap={{ scale: 0.93 }}
          className="bg-primary px-3 py-1 rounded-md hover:bg-primary/80 transition-colors text-sm flex-shrink-0"
        >
          Add
        </motion.button>
      </div>
      <AnimatePresence>
        {showDate && (
          <motion.input
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            className="glass-input text-sm text-muted-foreground"
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const TodoModuleEnhanced: React.FC<TodoModuleEnhancedProps> = ({
  title,
  onRemove,
  onTitleChange,
  isMinimized,
  onMinimize,
  isDragging,
  listId: moduleListId,
  moduleId,
  sharedFromInstanceId,
  sharedRole,
  moveTargets,
  onMoveToPage,
  onShare,
  contentReadOnly = false,
  todoistProjectId,
  onTodoistProjectChange,
  msListId,
  onMsListChange,
  googleTaskListId,
  onGoogleTaskListChange,
}) => {
  const { sizeLevel } = useModuleSize();

  // ── Todoist integration ──────────────────────────────────────────────────────
  const [todoistSheetOpen, setTodoistSheetOpen] = useState(false);
  const todoist = useTodoistIntegration(moduleListId, todoistProjectId);

  // ── Microsoft Tasks integration ──────────────────────────────────────────────
  const [msSheetOpen, setMsSheetOpen] = useState(false);
  const [pickerSheetOpen, setPickerSheetOpen] = useState(false);
  const ms = useMicrosoftIntegration(moduleListId, msListId);

  // ── Google Tasks integration ──────────────────────────────────────────────────
  const [googleTasksDialogOpen, setGoogleTasksDialogOpen] = useState(false);
  const googleTasks = useGoogleTasksIntegration(moduleListId, googleTaskListId);
  const { calendars: connectedCalendars } = useCalendarGroups();
  const googleAccounts = React.useMemo(() =>
    connectedCalendars
      .filter(c => c.source === 'google' && c.googleAccountId)
      .reduce<{ googleAccountId: string; email: string }[]>((acc, c) => {
        if (!acc.find(a => a.googleAccountId === c.googleAccountId)) {
          acc.push({ googleAccountId: c.googleAccountId!, email: c.accountEmail });
        }
        return acc;
      }, []),
    [connectedCalendars]
  );

  const isSharedModule = !!sharedFromInstanceId;
  const { myRole: liveRole, isShared: isLiveShared } = useModuleShare(sharedFromInstanceId || moduleId);
  const isViewOnly = contentReadOnly || (isSharedModule && liveRole === "viewer");
  const isCollaborativeModule = isSharedModule || isLiveShared;

  const [isDragOver, setIsDragOver] = useState(false);
  const [dragOverColumn, setDragOverColumn] = useState<"todo" | "done" | null>(null);
  const [filter, setFilter] = useState<"active" | "done">("active");
  const [kanbanMode, setKanbanMode] = useState(false);

  const { getTodosForList, lists, loading, error, addTodo, updateTodo, deleteTodo, updateList, moveTodo } = useTodoLists();
  const { removeItem: removeEisenhowerItem } = useEisenhower();
  const { handleCreateTodoFromEvent } = useTodoCalendarIntegration();
  const { syncTodoCompletion } = useMirrorSync();

  const highlightedItemId = useEventHighlightStore((s) => s.highlightedItemId);
  const highlightedItemType = useEventHighlightStore((s) => s.highlightedItemType);
  const spotlightRef = useCallback((node: HTMLDivElement | null) => {
    if (node) node.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const sharedTodos = useSharedListTodos(isCollaborativeModule ? moduleListId : undefined);
  const activeList = lists.find((l) => l.id === moduleListId);
  const rawTodos: TodoItem[] = isCollaborativeModule
    ? sharedTodos
    : moduleListId
    ? getTodosForList(moduleListId)
    : [];

  // Pinned items always float to top
  const allTodos = [...rawTodos].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  const { user } = useAuth();

  useEffect(() => {
    if (moduleListId && title && activeList && title !== activeList.name) {
      updateList(moduleListId, { name: title });
    }
  }, [title, moduleListId, activeList, updateList]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleAdd = async (text: string, deadline?: string) => {
    if (!moduleListId) return;
    sounds.play("lightClick");
    console.log('[TODOIST-PUSH] isLinked:', todoist.isLinked, '| connected:', todoist.status.connected, '| projectId:', todoistProjectId, '| listId:', moduleListId);
    if (todoist.isLinked) {
      const todoistId = await todoist.pushCreate({ text, deadline });
      console.log('[TODOIST-PUSH] result:', todoistId);
      if (!todoistId) {
        toast.error("Couldn't reach Todoist — task saved locally");
        await addTodo(text, moduleListId, { deadline });
      }
    } else if (ms.isLinked) {
      const msTaskId = await ms.pushCreate({ text, deadline });
      if (!msTaskId) {
        toast.error("Couldn't reach Microsoft Tasks — task saved locally");
        await addTodo(text, moduleListId, { deadline });
      }
    } else if (googleTasks.isLinked) {
      const googleTaskId = await googleTasks.pushCreate({ text, deadline });
      if (!googleTaskId) {
        toast.error("Couldn't reach Google Tasks — task saved locally");
        await addTodo(text, moduleListId, { deadline });
      }
    } else {
      await addTodo(text, moduleListId, { deadline });
    }
  };

  const handleToggleWithSync = async (item: TodoItem) => {
    sounds.play("lightClick");
    const isDone = item.completed || item.status === "done";
    // Note: never pass `completedAt: undefined` to Firestore — it throws an error and silently fails.
    // Only include completedAt when marking as done.
    const updates: { status: "todo" | "done"; completed: boolean; completedAt?: string } = {
      status: isDone ? "todo" : "done",
      completed: !isDone,
      ...(!isDone && { completedAt: new Date().toISOString() }),
    };
    if (isCollaborativeModule) {
      await directUpdateTodo(item.id, updates);
    } else {
      await updateTodo(item.id, updates);
    }
    await syncTodoCompletion(item.id, !isDone);
    // Push to Todoist
    if (todoist.isLinked && item.todoistId) {
      if (isDone) await todoist.pushUncomplete(item.todoistId);
      else await todoist.pushComplete(item.todoistId);
    }
    // Push to Microsoft Tasks
    if (ms.isLinked && (item as any).msTaskId) {
      if (isDone) await ms.pushUncomplete((item as any).msTaskId);
      else await ms.pushComplete((item as any).msTaskId);
    }
    // Push to Google Tasks
    if (googleTasks.isLinked && (item as any).googleTaskId) {
      if (isDone) await googleTasks.pushUncomplete((item as any).googleTaskId);
      else await googleTasks.pushComplete((item as any).googleTaskId);
    }

    if (!isDone) {
      toast("Marked as done", {
        action: {
          label: "Undo",
          onClick: async () => {
            const undo = { status: "todo" as const, completed: false };
            if (isCollaborativeModule) await directUpdateTodo(item.id, undo);
            else await updateTodo(item.id, undo);
            await syncTodoCompletion(item.id, false);
          },
        },
        duration: 5000,
      });
    }
  };

  const handleDelete = (id: string) => {
    const item = rawTodos.find((t) => t.id === id);
    if (isCollaborativeModule) directDeleteTodo(id);
    else deleteTodo(id);
    // Push deletion to Todoist
    if (todoist.isLinked && item?.todoistId) {
      todoist.pushDelete(item.todoistId);
    }
    // Push deletion to Microsoft Tasks
    if (ms.isLinked && (item as any)?.msTaskId) {
      ms.pushDelete((item as any).msTaskId);
    }
    // Push deletion to Google Tasks
    if (googleTasks.isLinked && (item as any)?.googleTaskId) {
      googleTasks.pushDelete((item as any).googleTaskId);
    }
  };

  const handleUpdateStatus = async (id: string, status: "todo" | "in_progress" | "done") => {
    const updates: { status: "todo" | "in_progress" | "done"; completed: boolean; completedAt?: string } = {
      status,
      completed: status === "done",
      ...(status === "done" && { completedAt: new Date().toISOString() }),
    };
    if (isCollaborativeModule) await directUpdateTodo(id, updates);
    else await updateTodo(id, updates);
  };

  const handleFavorite = async (id: string) => {
    const item = rawTodos.find((t) => t.id === id);
    if (!item) return;
    const updates = { pinned: !item.pinned };
    if (isCollaborativeModule) await directUpdateTodo(id, updates);
    else await updateTodo(id, updates);
  };

  const handleUpdateItem = async (id: string, updates: { deadline?: string; description?: string }) => {
    if (isCollaborativeModule) await directUpdateTodo(id, updates);
    else await updateTodo(id, updates);
    // Push update to Todoist
    const item = rawTodos.find((t) => t.id === id);
    if (todoist.isLinked && item?.todoistId) {
      await todoist.pushUpdate(item.todoistId, {
        deadline: updates.deadline ?? null,
        description: updates.description,
      });
    }
    // Push update to Microsoft Tasks
    if (ms.isLinked && (item as any)?.msTaskId) {
      await ms.pushUpdate((item as any).msTaskId, {
        deadline: updates.deadline ?? null,
        description: updates.description,
      });
    }
  };

  const handleDragStart = (e: React.DragEvent, item: TodoItem) => {
    e.stopPropagation();
    e.dataTransfer.setData("application/json", JSON.stringify({ id: item.id, text: item.text, source: "todo-module", completed: item.completed, collectionName: "todo_items", listId: moduleListId }));
    e.dataTransfer.effectAllowed = "move";
    (e.currentTarget as HTMLElement).classList.add("opacity-50");
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.currentTarget as HTMLElement).classList.remove("opacity-50");
    setDragOverColumn(null);
  };

  const handleKanbanColumnDrop = async (e: React.DragEvent, targetCol: "todo" | "done") => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      if (data.source === "todo-module" && data.listId === moduleListId) {
        await handleUpdateStatus(data.id, targetCol === "done" ? "done" : "todo");
      }
    } catch {}
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      if (data.source === "todo-module" && moduleListId && data.listId !== moduleListId) {
        const result = await moveTodo(data.id, moduleListId);
        if (!result?.success) toast.error("Failed to move todo");
        return;
      }
      if (data.source === "todo-module") return;
      if (data.source === "eisenhower" && moduleListId) {
        const response = await addTodo(data.text, moduleListId);
        if (response.success) { await removeEisenhowerItem(data.id); toast.success(`Moved "${data.text}" to todo list`); }
        else toast.error("Failed to add item to todo list");
        return;
      }
      if (data.id && data.title) {
        const eventData: CalendarEventType = { id: data.id, title: data.title, description: data.description || "", startsAt: data.startsAt || new Date().toISOString(), endsAt: data.endsAt || new Date().toISOString(), isTodo: data.isTodo, color: data.color, calendarId: data.calendarId };
        await handleCreateTodoFromEvent(eventData);
      }
    } catch { toast.error("Failed to process drop"); }
  };

  // ── Container + row props ────────────────────────────────────────────────────

  const containerProps = {
    title,
    onRemove,
    onTitleChange: isViewOnly ? undefined : onTitleChange,
    isMinimized,
    onMinimize,
    moveTargets,
    onMoveToPage,
    onShare,
    // Task sync (Todoist / Microsoft Tasks / Google Tasks)
    onConnectTodoist: isViewOnly ? undefined : () => {
      if (todoist.isLinked) setTodoistSheetOpen(true);
      else if (ms.isLinked) setMsSheetOpen(true);
      else if (googleTasks.isLinked) setGoogleTasksDialogOpen(true);
      else setPickerSheetOpen(true);
    },
    todoistLinked: todoist.isLinked,
    todoistSyncing: todoist.isSyncing,
    onSyncTodoist: todoist.isLinked ? () => todoist.sync() : undefined,
    msTasksLinked: ms.isLinked,
    msTasksSyncing: ms.isSyncing,
    onSyncMsTasks: ms.isLinked ? () => ms.syncTasks() : undefined,
    googleTasksLinked: googleTasks.isLinked,
    googleTasksSyncing: googleTasks.isSyncing,
    onSyncGoogleTasks: googleTasks.isLinked ? () => googleTasks.sync() : undefined,
  };

  const rowProps = {
    isViewOnly,
    isCollaborativeModule,
    onToggle: handleToggleWithSync,
    onDelete: handleDelete,
    onFavorite: isViewOnly ? undefined : handleFavorite,
    onUpdate: isViewOnly ? undefined : handleUpdateItem,
    highlightedItemId,
    highlightedItemType,
    spotlightRef,
    onDragStart: handleDragStart,
    onDragEnd: handleDragEnd,
  };

  // ── Loading / Auth guards ────────────────────────────────────────────────────

  const todoistSheet = (
    <TodoistConnectSheet
      open={todoistSheetOpen}
      onOpenChange={setTodoistSheetOpen}
      linkedProjectId={todoistProjectId}
      onProjectLinked={(projectId, projectName) => {
        onTodoistProjectChange?.(projectId, projectName);
        setTodoistSheetOpen(false);
      }}
      onProjectUnlinked={() => {
        onTodoistProjectChange?.(null);
      }}
      status={todoist.status}
      isSyncing={todoist.isSyncing}
      projects={todoist.projects}
      projectsLoading={todoist.projectsLoading}
      connect={todoist.connect}
      disconnect={todoist.disconnect}
      loadProjects={todoist.loadProjects}
      sync={todoist.sync}
    />
  );

  const msDialog = (
    <MicrosoftTasksConnectDialog
      open={msSheetOpen}
      onOpenChange={setMsSheetOpen}
      linkedListId={msListId}
      onListLinked={(listId, listName) => {
        onMsListChange?.(listId, listName);
        setMsSheetOpen(false);
      }}
      onListUnlinked={() => {
        onMsListChange?.(null);
      }}
      status={ms.status}
      isSyncing={ms.isSyncing}
      taskLists={ms.taskLists}
      taskListsLoading={ms.taskListsLoading}
      connect={ms.connect}
      disconnect={ms.disconnect}
      loadTaskLists={ms.loadTaskLists}
      syncTasks={ms.syncTasks}
    />
  );

  const googleTasksDialog = (
    <GoogleTasksConnectDialog
      open={googleTasksDialogOpen}
      onOpenChange={setGoogleTasksDialogOpen}
      linkedTaskListId={googleTaskListId}
      onListLinked={(taskListId, taskListTitle) => {
        onGoogleTaskListChange?.(taskListId, taskListTitle);
        setGoogleTasksDialogOpen(false);
      }}
      onListUnlinked={() => {
        onGoogleTaskListChange?.(null);
      }}
      status={googleTasks.status}
      isSyncing={googleTasks.isSyncing}
      taskLists={googleTasks.taskLists}
      taskListsLoading={googleTasks.taskListsLoading}
      googleAccounts={googleAccounts}
      connect={googleTasks.connect}
      disconnect={googleTasks.disconnect}
      loadTaskLists={googleTasks.loadTaskLists}
      sync={googleTasks.sync}
    />
  );

  const pickerDialog = (
    <TaskSyncPickerDialog
      open={pickerSheetOpen}
      onOpenChange={setPickerSheetOpen}
      onPickTodoist={() => setTodoistSheetOpen(true)}
      onPickMicrosoft={() => setMsSheetOpen(true)}
      onPickGoogleTasks={() => setGoogleTasksDialogOpen(true)}
    />
  );

  if (!user) {
    return (
      <>
        <ModuleContainer {...containerProps}>
          <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">Sign in to use todos</div>
        </ModuleContainer>
        {todoistSheet}
        {msDialog}
        {googleTasksDialog}
        {pickerDialog}
      </>
    );
  }

  // ── L1: Normal view ──────────────────────────────────────────────────────────

  if (sizeLevel <= 1) {
    return (
      <>
      <ModuleContainer {...containerProps}>
        {isSharedModule && (
          <div className="flex items-center gap-1.5 mb-2">
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", isViewOnly ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary")}>
              {isViewOnly ? "View only" : "Shared — Editor"}
            </span>
          </div>
        )}
        <div
          className={cn("transition-all duration-150 rounded-lg", isDragOver && !isViewOnly && "ring-2 ring-primary/50 bg-primary/10")}
          onDrop={isViewOnly ? undefined : handleDrop}
          onDragOver={isViewOnly ? undefined : (e) => { e.preventDefault(); if (e.dataTransfer.types.includes("application/json")) { e.dataTransfer.dropEffect = "move"; setIsDragOver(true); } }}
          onDragLeave={(e) => { const t = e.relatedTarget as HTMLElement; if (!t || !e.currentTarget.contains(t)) setIsDragOver(false); }}
        >
          <div className="max-h-52 overflow-y-auto mb-3 scrollbar-thin">
            {loading ? (
              <div className="flex justify-center items-center p-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /><span className="ml-2 text-sm">Loading...</span></div>
            ) : error ? (
              <div className="text-center text-sm text-red-400 p-2">Error: {error}</div>
            ) : allTodos.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground p-4"><List className="w-8 h-8 mx-auto mb-2 opacity-50" />No todos yet</div>
            ) : (
              <AnimatePresence mode="popLayout" initial={false}>
                {allTodos.map((item) => (
                  <TodoRow key={item.id} item={item} {...rowProps} showDeadline />
                ))}
              </AnimatePresence>
            )}
          </div>
          {!isViewOnly && <AddForm onAdd={handleAdd} showDeadline />}
        </div>
      </ModuleContainer>
      {todoistSheet}
      {msDialog}
      {googleTasksDialog}
      {pickerDialog}
      </>
    );
  }

  // ── Shared computed values for L2 / L3 ──────────────────────────────────────

  const activeTodoCount = allTodos.filter((t) => !t.completed && t.status !== "done").length;
  const doneTodoCount = allTodos.filter((t) => t.completed || t.status === "done").length;

  const filteredTodos = allTodos.filter((item) => {
    if (filter === "active") return !item.completed && item.status !== "done";
    if (filter === "done") return item.completed || item.status === "done";
    return true;
  });

  // ── L2: Sidebar fill ─────────────────────────────────────────────────────────

  if (sizeLevel === 2) {
    return (
      <>
      <ModuleContainer {...containerProps}>
        <div className="flex flex-col gap-3 h-full overflow-hidden">
          {/* Stats */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{activeTodoCount} active</span>
            <span>·</span>
            <span>{doneTodoCount} done</span>
            {isSharedModule && (
              <span className={cn("ml-auto px-2 py-0.5 rounded-full text-[10px] font-medium", isViewOnly ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary")}>
                {isViewOnly ? "View only" : "Shared"}
              </span>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
            {(["active", "done"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn("flex-1 text-xs py-1 rounded-md transition-all capitalize font-medium", filter === f ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
              >
                {f === "active" ? `Active${activeTodoCount > 0 ? ` (${activeTodoCount})` : ""}` : `Done${doneTodoCount > 0 ? ` (${doneTodoCount})` : ""}`}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {loading ? (
              <div className="flex justify-center items-center p-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : filteredTodos.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8"><List className="w-10 h-10 mx-auto mb-2 opacity-30" />
                {filter === "done" ? "No completed tasks" : "All caught up!"}
              </div>
            ) : (
              <AnimatePresence mode="popLayout" initial={false}>
                {filteredTodos.map((item) => (
                  <TodoRow key={item.id} item={item} {...rowProps} showDeadline />
                ))}
              </AnimatePresence>
            )}
          </div>

          {!isViewOnly && <AddForm onAdd={handleAdd} showDeadline />}
        </div>
      </ModuleContainer>
      {todoistSheet}
      {msDialog}
      {googleTasksDialog}
      {pickerDialog}
      </>
    );
  }

  // ── L3: Fullscreen — Kanban + List toggle ────────────────────────────────────

  const todoItems = allTodos.filter((i) => kanbanColumn(i) === "todo");
  const doneItems = allTodos.filter((i) => kanbanColumn(i) === "done");

  const kanbanColumns: Array<{
    key: "todo" | "done";
    label: string;
    items: TodoItem[];
    accent: string;
    headerColor: string;
  }> = [
    { key: "todo", label: "Active", items: todoItems, accent: "border-blue-400/40", headerColor: "text-blue-400" },
    { key: "done", label: "Done", items: doneItems, accent: "border-green-400/40", headerColor: "text-green-400" },
  ];

  return (
    <>
    <ModuleContainer {...containerProps}>
      <div className="flex flex-col gap-3 h-full overflow-hidden">
        {/* View toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
            <button
              onClick={() => setKanbanMode(false)}
              className={cn("flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all", !kanbanMode ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <List size={12} /> List
            </button>
            <button
              onClick={() => setKanbanMode(true)}
              className={cn("flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all", kanbanMode ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <LayoutGrid size={12} /> Kanban
            </button>
          </div>
          <span className="text-xs text-muted-foreground">{allTodos.length} task{allTodos.length !== 1 ? "s" : ""}</span>
        </div>

        <AnimatePresence mode="wait">
          {kanbanMode ? (
            // ── Kanban ──────────────────────────────────────────────────────
            <motion.div
              key="kanban"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
              className="flex gap-4 flex-1 overflow-x-auto overflow-y-hidden min-h-0 pb-1"
            >
              {kanbanColumns.map(({ key, label, items, accent, headerColor }) => (
                <div
                  key={key}
                  className={cn(
                    "flex flex-col flex-1 min-w-[200px] rounded-xl border transition-colors",
                    accent,
                    dragOverColumn === key ? "bg-primary/5 border-primary/40" : "bg-muted/30"
                  )}
                  onDragOver={(e) => { e.preventDefault(); setDragOverColumn(key); }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverColumn(null); }}
                  onDrop={(e) => handleKanbanColumnDrop(e, key)}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between px-3 py-2 border-b border-inherit">
                    <span className={cn("text-xs font-semibold uppercase tracking-wide", headerColor)}>{label}</span>
                    <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">{items.length}</span>
                  </div>
                  {/* Column items */}
                  <div className="flex-1 overflow-y-auto p-2">
                    <AnimatePresence mode="popLayout" initial={false}>
                      {items.map((item) => (
                        <TodoRow key={item.id} item={item} {...rowProps} showDeadline />
                      ))}
                    </AnimatePresence>
                    {items.length === 0 && (
                      <div className="text-center text-xs text-muted-foreground/50 py-6">
                        {dragOverColumn === key ? "Drop here" : "Empty"}
                      </div>
                    )}
                  </div>
                  {/* Add form in To Do column only */}
                  {!isViewOnly && key === "todo" && (
                    <div className="p-2 border-t border-inherit">
                      <AddForm onAdd={handleAdd} showDeadline />
                    </div>
                  )}
                </div>
              ))}
            </motion.div>
          ) : (
            // ── List ─────────────────────────────────────────────────────────
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.18 }}
              className="flex flex-col gap-3 flex-1 overflow-hidden min-h-0"
            >
              {/* Filter tabs */}
              <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5">
                {(["active", "done"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn("flex-1 text-xs py-1 rounded-md transition-all capitalize font-medium", filter === f ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
                  >
                    {f === "active" ? `Active${activeTodoCount > 0 ? ` (${activeTodoCount})` : ""}` : `Done${doneTodoCount > 0 ? ` (${doneTodoCount})` : ""}`}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto min-h-0">
                {loading ? (
                  <div className="flex justify-center items-center p-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                ) : filteredTodos.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-10"><List className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    {filter === "done" ? "No completed tasks" : "All caught up!"}
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout" initial={false}>
                    {filteredTodos.map((item) => (
                      <TodoRow key={item.id} item={item} {...rowProps} showDeadline />
                    ))}
                  </AnimatePresence>
                )}
              </div>
              {!isViewOnly && <AddForm onAdd={handleAdd} showDeadline />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ModuleContainer>
    {todoistSheet}
    {msDialog}
    {pickerDialog}
    </>
  );
};

export default TodoModuleEnhanced;
