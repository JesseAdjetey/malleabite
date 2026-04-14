import React, { useState, useCallback } from 'react';
import {
  BookOpen,
  RefreshCw,
  ExternalLink,
  Calendar,
  ListPlus,
  ListTodo,
  Copy,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Unlink,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import ModuleContainer from './ModuleContainer';
import CanvasConnectSheet from './canvas/CanvasConnectSheet';
import { useCanvasIntegration, CanvasAssignment } from '@/hooks/use-canvas-integration';
import { useTodoLists } from '@/hooks/use-todo-lists';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { useSidebarStore } from '@/lib/stores/sidebar-store';
import { generateModuleId } from '@/lib/stores/types';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import dayjs from 'dayjs';
import EventForm from '@/components/calendar/EventForm';
import { nanoid } from 'nanoid';

// ─── Due date badge ────────────────────────────────────────────────────────────

function DueBadge({ dueAt }: { dueAt: string | null }) {
  if (!dueAt) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
        No due date
      </span>
    );
  }

  const due = dayjs(dueAt);
  const now = dayjs();
  const diff = due.diff(now, 'day');

  let label = due.format('MMM D');
  let cls = 'bg-muted text-muted-foreground';

  if (diff < 0) {
    label = 'Overdue';
    cls = 'bg-red-500/20 text-red-400';
  } else if (diff === 0) {
    label = 'Today';
    cls = 'bg-amber-500/20 text-amber-400';
  } else if (diff === 1) {
    label = 'Tomorrow';
    cls = 'bg-amber-500/20 text-amber-400';
  } else if (diff < 7) {
    label = `${diff}d`;
    cls = 'bg-amber-500/10 text-amber-400';
  }

  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0', cls)}>
      <Clock size={9} />
      {label}
    </span>
  );
}

// ─── Create Todo Item Dialog ───────────────────────────────────────────────────

interface CreateTodoItemDialogProps {
  open: boolean;
  onClose: () => void;
  assignment: CanvasAssignment | null;
}

function CreateTodoItemDialog({ open, onClose, assignment }: CreateTodoItemDialogProps) {
  const { user } = useAuth();
  const { lists } = useTodoLists();
  const [selectedListId, setSelectedListId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user?.uid || !assignment || !selectedListId) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'todo_items'), {
        text: assignment.title,
        completed: false,
        listId: selectedListId,
        userId: user.uid,
        deadline: assignment.dueAt ? dayjs(assignment.dueAt).format('YYYY-MM-DD') : undefined,
        description: assignment.htmlUrl ? `Canvas link: ${assignment.htmlUrl}` : undefined,
        createdAt: serverTimestamp(),
      });
      toast.success('Todo item created');
      onClose();
    } catch {
      toast.error('Failed to create todo item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTodo size={16} />
            Add to Todo List
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="text-sm text-muted-foreground truncate">
            <span className="font-medium text-foreground">{assignment?.title}</span>
          </div>
          <div className="space-y-1.5">
            <Label>Choose list</Label>
            <Select value={selectedListId} onValueChange={setSelectedListId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a list…" />
              </SelectTrigger>
              <SelectContent>
                {lists.map(l => (
                  <SelectItem key={l.id} value={l.id}>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: l.color }}
                      />
                      {l.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !selectedListId}>
            {saving ? 'Adding…' : 'Add Todo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Todo List Dialog ───────────────────────────────────────────────────

interface CreateTodoListDialogProps {
  open: boolean;
  onClose: () => void;
  assignment: CanvasAssignment | null;
}

function CreateTodoListDialog({ open, onClose, assignment }: CreateTodoListDialogProps) {
  const { user } = useAuth();
  const { createList } = useTodoLists();
  const { pages, currentPageIndex, addSharedModule } = useSidebarStore();
  const [listName, setListName] = useState('');
  const [saving, setSaving] = useState(false);

  // Pre-fill name from assignment
  React.useEffect(() => {
    if (open && assignment) {
      setListName(assignment.title.length > 40 ? assignment.title.slice(0, 40) : assignment.title);
    }
  }, [open, assignment]);

  const handleCreate = async () => {
    if (!user?.uid || !assignment || !listName.trim()) return;
    setSaving(true);
    try {
      // 1. Create the todo list
      const result = await createList(listName.trim(), assignment.courseColor);
      if (!result.success || !result.listId) throw new Error('List creation failed');

      // 2. Add a todo item for the assignment itself
      await addDoc(collection(db, 'todo_items'), {
        text: assignment.title,
        completed: false,
        listId: result.listId,
        userId: user.uid,
        deadline: assignment.dueAt ? dayjs(assignment.dueAt).format('YYYY-MM-DD') : undefined,
        description: assignment.htmlUrl ? `Canvas link: ${assignment.htmlUrl}` : undefined,
        createdAt: serverTimestamp(),
      });

      // 3. Add a new Todo module to the current sidebar page linked to this list
      const newModule = {
        id: generateModuleId(),
        type: 'todo' as const,
        title: listName.trim(),
        listId: result.listId,
      };
      addSharedModule(newModule, currentPageIndex);

      toast.success(`"${listName}" created and added to your sidebar`);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create list');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListPlus size={16} />
            Create Todo List
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-xs text-muted-foreground">
            Creates a dedicated todo list for this assignment and adds it as a module to your current sidebar page.
          </p>
          <div className="space-y-1.5">
            <Label>List name</Label>
            <Input
              value={listName}
              onChange={e => setListName(e.target.value)}
              placeholder="Assignment name…"
              maxLength={60}
              disabled={saving}
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: assignment?.courseColor }} />
            {assignment?.courseName}
            {assignment?.dueAt && (
              <span className="ml-auto">Due {dayjs(assignment.dueAt).format('MMM D')}</span>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleCreate} disabled={saving || !listName.trim()}>
            {saving ? 'Creating…' : 'Create List'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Assignment Row ────────────────────────────────────────────────────────────

interface AssignmentRowProps {
  assignment: CanvasAssignment;
  onAddToCalendar: (a: CanvasAssignment) => void;
  onCreateTodoItem: (a: CanvasAssignment) => void;
  onCreateTodoList: (a: CanvasAssignment) => void;
}

function AssignmentRow({ assignment, onAddToCalendar, onCreateTodoItem, onCreateTodoList }: AssignmentRowProps) {
  const copyDueDate = () => {
    if (!assignment.dueAt) return;
    navigator.clipboard.writeText(dayjs(assignment.dueAt).format('MMM D, YYYY h:mm A'));
    toast.success('Due date copied');
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 cursor-pointer group">
          <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: assignment.courseColor }} />
          <span className="flex-1 text-xs text-foreground/90 truncate">{assignment.title}</span>
          <DueBadge dueAt={assignment.dueAt} />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <ContextMenuItem
          className="flex items-center gap-2 text-xs cursor-pointer"
          onClick={() => onAddToCalendar(assignment)}
        >
          <Calendar size={13} className="text-blue-400" />
          Add to Calendar
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem
          className="flex items-center gap-2 text-xs cursor-pointer"
          onClick={() => onCreateTodoItem(assignment)}
        >
          <ListTodo size={13} className="text-purple-400" />
          Create Todo Item
        </ContextMenuItem>

        <ContextMenuItem
          className="flex items-center gap-2 text-xs cursor-pointer"
          onClick={() => onCreateTodoList(assignment)}
        >
          <ListPlus size={13} className="text-purple-400" />
          Create Todo List
        </ContextMenuItem>

        <ContextMenuSeparator />

        {assignment.htmlUrl && (
          <ContextMenuItem
            className="flex items-center gap-2 text-xs cursor-pointer"
            onClick={() => window.open(assignment.htmlUrl!, '_blank')}
          >
            <ExternalLink size={13} />
            Open in Canvas
          </ContextMenuItem>
        )}

        {assignment.dueAt && (
          <ContextMenuItem
            className="flex items-center gap-2 text-xs cursor-pointer"
            onClick={copyDueDate}
          >
            <Copy size={13} />
            Copy due date
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ─── Course Section ────────────────────────────────────────────────────────────

interface CourseSectionProps {
  course: { id: string; name: string; color: string };
  assignments: CanvasAssignment[];
  onAddToCalendar: (a: CanvasAssignment) => void;
  onCreateTodoItem: (a: CanvasAssignment) => void;
  onCreateTodoList: (a: CanvasAssignment) => void;
}

function CourseSection({ course, assignments, onAddToCalendar, onCreateTodoItem, onCreateTodoList }: CourseSectionProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mb-1">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-1.5 px-2 py-1 hover:bg-white/5 rounded-md transition-colors"
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: course.color }} />
        <span className="flex-1 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide truncate">
          {course.name}
        </span>
        <span className="text-[10px] text-muted-foreground/60">{assignments.length}</span>
        {expanded ? <ChevronDown size={11} className="text-muted-foreground/60" /> : <ChevronRight size={11} className="text-muted-foreground/60" />}
      </button>

      {expanded && (
        <div className="pl-1">
          {assignments.map(a => (
            <AssignmentRow
              key={a.id}
              assignment={a}
              onAddToCalendar={onAddToCalendar}
              onCreateTodoItem={onCreateTodoItem}
              onCreateTodoList={onCreateTodoList}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Canvas Module ────────────────────────────────────────────────────────

interface CanvasModuleProps {
  title: string;
  onRemove?: () => void;
  onTitleChange?: (t: string) => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
  isDragging?: boolean;
  moveTargets?: { id: string; title: string }[];
  onMoveToPage?: (pageId: string) => void;
  onShare?: () => void;
  isReadOnly?: boolean;
}

const CanvasModule: React.FC<CanvasModuleProps> = (props) => {
  const {
    status,
    statusLoading,
    assignmentsByCourse,
    upcomingCount,
    dataLoading,
    syncing,
    connecting,
    connect,
    sync,
    disconnect,
  } = useCanvasIntegration();

  const [connectOpen, setConnectOpen] = useState(false);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [eventFormData, setEventFormData] = useState<{ date: Date; startTime: string; title: string } | null>(null);
  const [todoItemDialogOpen, setTodoItemDialogOpen] = useState(false);
  const [todoListDialogOpen, setTodoListDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<CanvasAssignment | null>(null);

  // ── Add to Calendar ──────────────────────────────────────────────────────────
  const handleAddToCalendar = useCallback((assignment: CanvasAssignment) => {
    let date: Date;
    let startTime: string;

    if (assignment.dueAt) {
      const due = new Date(assignment.dueAt);
      date = due;
      // Start event 1 hour before due
      const startDate = new Date(due.getTime() - 60 * 60 * 1000);
      startTime = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
    } else {
      date = new Date();
      startTime = '09:00';
    }

    setEventFormData({ date, startTime, title: assignment.title });
    setEventFormOpen(true);
  }, []);

  // ── Todo Item ────────────────────────────────────────────────────────────────
  const handleCreateTodoItem = useCallback((assignment: CanvasAssignment) => {
    setSelectedAssignment(assignment);
    setTodoItemDialogOpen(true);
  }, []);

  // ── Todo List ────────────────────────────────────────────────────────────────
  const handleCreateTodoList = useCallback((assignment: CanvasAssignment) => {
    setSelectedAssignment(assignment);
    setTodoListDialogOpen(true);
  }, []);

  // ── Sync on module open if stale ─────────────────────────────────────────────
  React.useEffect(() => {
    if (!status.connected || !status.lastSyncAt) return;
    const age = Date.now() - new Date(status.lastSyncAt).getTime();
    if (age > 30 * 60 * 1000) sync(); // auto-sync if >30min old
  }, [status.connected, status.lastSyncAt]);

  const lastSyncLabel = status.lastSyncAt
    ? (() => {
        const mins = Math.floor((Date.now() - new Date(status.lastSyncAt).getTime()) / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        return dayjs(status.lastSyncAt).format('h:mm A');
      })()
    : null;

  return (
    <>
      <ModuleContainer
        title={props.title}
        onRemove={props.onRemove}
        onTitleChange={props.onTitleChange}
        onMinimize={props.onMinimize}
        isMinimized={props.isMinimized}
        isDragging={props.isDragging}
        moveTargets={props.moveTargets}
        onMoveToPage={props.onMoveToPage}
        onShare={props.onShare}
        isReadOnly={props.isReadOnly}
      >
        {statusLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw size={16} className="animate-spin text-muted-foreground" />
          </div>
        ) : !status.connected ? (
          /* ── Not connected ── */
          <div className="flex flex-col items-center justify-center gap-3 py-8 px-4 text-center">
            <div className="w-10 h-10 rounded-full bg-[#E66000]/10 flex items-center justify-center">
              <BookOpen size={18} className="text-[#E66000]" />
            </div>
            <div>
              <p className="text-sm font-medium">Connect Canvas</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sync your courses and assignments
              </p>
            </div>
            <Button
              size="sm"
              className="bg-[#E66000] hover:bg-[#E66000]/90 text-white"
              onClick={() => setConnectOpen(true)}
            >
              <Plus size={14} className="mr-1.5" />
              Connect Canvas
            </Button>
          </div>
        ) : dataLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw size={16} className="animate-spin text-muted-foreground" />
          </div>
        ) : assignmentsByCourse.length === 0 ? (
          /* ── Connected but no upcoming assignments ── */
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CheckCircle2 size={24} className="text-green-400" />
            <p className="text-sm font-medium">All caught up!</p>
            <p className="text-xs text-muted-foreground">No upcoming assignments</p>
            {lastSyncLabel && (
              <p className="text-[10px] text-muted-foreground/60 mt-1">Synced {lastSyncLabel}</p>
            )}
          </div>
        ) : (
          /* ── Assignment list ── */
          <div className="px-1 pt-1 pb-2">
            {/* Summary row */}
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[10px] text-muted-foreground">
                {upcomingCount} upcoming
              </span>
              <div className="flex items-center gap-2">
                {lastSyncLabel && (
                  <span className="text-[10px] text-muted-foreground/60">
                    {lastSyncLabel}
                  </span>
                )}
                <button
                  onClick={sync}
                  disabled={syncing}
                  className="p-0.5 rounded hover:bg-white/10 text-muted-foreground/60 hover:text-foreground transition-colors"
                  title="Sync Canvas"
                >
                  <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            {assignmentsByCourse.map(({ course, assignments }) => (
              <CourseSection
                key={course.id}
                course={course}
                assignments={assignments}
                onAddToCalendar={handleAddToCalendar}
                onCreateTodoItem={handleCreateTodoItem}
                onCreateTodoList={handleCreateTodoList}
              />
            ))}

            {/* Disconnect option */}
            <div className="mt-3 px-2 pt-2 border-t border-white/5">
              <button
                onClick={disconnect}
                className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 hover:text-destructive transition-colors"
              >
                <Unlink size={11} />
                Disconnect Canvas
              </button>
            </div>
          </div>
        )}
      </ModuleContainer>

      {/* Connect sheet */}
      <CanvasConnectSheet
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        onConnect={connect}
        connecting={connecting}
      />

      {/* Event form (add to calendar) */}
      {eventFormData && (
        <EventForm
          open={eventFormOpen}
          onClose={() => setEventFormOpen(false)}
          initialTime={{
            date: eventFormData.date,
            startTime: eventFormData.startTime,
          }}
          todoData={eventFormData.title ? { text: eventFormData.title, id: nanoid() } : undefined}
        />
      )}

      {/* Create todo item dialog */}
      <CreateTodoItemDialog
        open={todoItemDialogOpen}
        onClose={() => setTodoItemDialogOpen(false)}
        assignment={selectedAssignment}
      />

      {/* Create todo list dialog */}
      <CreateTodoListDialog
        open={todoListDialogOpen}
        onClose={() => setTodoListDialogOpen(false)}
        assignment={selectedAssignment}
      />
    </>
  );
};

export default CanvasModule;
