import React, { useState, useCallback, useMemo } from 'react';
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
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Unlink,
  Plus,
  FileText,
  MessageSquare,
  Pencil,
  Upload,
  HelpCircle,
  GraduationCap,
  Megaphone,
  CalendarDays,
  EyeOff,
  Eye,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
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
import SubmitAssignmentDialog from './canvas/SubmitAssignmentDialog';
import { useCanvasIntegration, CanvasAssignment, CanvasAnnouncement, CanvasCalendarEvent } from '@/hooks/use-canvas-integration';
import { useTodoLists } from '@/hooks/use-todo-lists';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { useSidebarStore } from '@/lib/stores/sidebar-store';
import { generateModuleId } from '@/lib/stores/types';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import dayjs from 'dayjs';
import EventForm from '@/components/calendar/EventForm';
import { nanoid } from 'nanoid';

// ─── Helpers ───────────────────────────────────────────────────────────────────

type AssignmentTypeIcon = typeof FileText;

function iconForSubmissionTypes(types: string[]): { Icon: AssignmentTypeIcon; label: string } {
  if (!types || types.length === 0) return { Icon: FileText, label: 'Assignment' };
  if (types.includes('online_quiz')) return { Icon: HelpCircle, label: 'Quiz' };
  if (types.includes('discussion_topic')) return { Icon: MessageSquare, label: 'Discussion' };
  if (types.includes('online_upload') || types.includes('media_recording')) return { Icon: Upload, label: 'File upload' };
  if (types.includes('online_text_entry')) return { Icon: Pencil, label: 'Text entry' };
  if (types.includes('external_tool')) return { Icon: ExternalLink, label: 'External tool' };
  return { Icon: FileText, label: 'Assignment' };
}

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
  const diffMin = due.diff(now, 'minute');
  const diffDay = due.diff(now, 'day');

  let label = due.format('MMM D');
  let cls = 'bg-muted text-muted-foreground';

  if (diffMin < 0) {
    // Overdue
    const overdueDays = Math.abs(diffDay);
    label = overdueDays === 0 ? 'Overdue' : `${overdueDays}d late`;
    cls = 'bg-red-500/20 text-red-400';
  } else if (diffDay === 0) {
    label = `Today ${due.format('h:mm A')}`;
    cls = 'bg-amber-500/20 text-amber-400';
  } else if (diffDay === 1) {
    label = `Tomorrow ${due.format('h:mm A')}`;
    cls = 'bg-amber-500/20 text-amber-400';
  } else if (diffDay < 7) {
    label = `${diffDay}d`;
    cls = 'bg-amber-500/10 text-amber-400';
  }

  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0', cls)}>
      <Clock size={9} />
      {label}
    </span>
  );
}

function GradeBadge({ score, pointsPossible }: { score: number; pointsPossible: number | null }) {
  if (!pointsPossible) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium shrink-0">
        {score}
      </span>
    );
  }
  const pct = (score / pointsPossible) * 100;
  let cls = 'bg-emerald-500/20 text-emerald-400';
  if (pct < 60) cls = 'bg-red-500/20 text-red-400';
  else if (pct < 80) cls = 'bg-amber-500/20 text-amber-400';
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0', cls)}>
      {score}/{pointsPossible}
    </span>
  );
}

// ─── Create Todo Item Dialog ───────────────────────────────────────────────────

function CreateTodoItemDialog({
  open,
  onClose,
  assignment,
}: {
  open: boolean;
  onClose: () => void;
  assignment: CanvasAssignment | null;
}) {
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

function CreateTodoListDialog({
  open,
  onClose,
  assignment,
}: {
  open: boolean;
  onClose: () => void;
  assignment: CanvasAssignment | null;
}) {
  const { user } = useAuth();
  const { createList } = useTodoLists();
  const { pages, currentPageIndex, addSharedModule } = useSidebarStore();
  const [listName, setListName] = useState('');
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open && assignment) {
      setListName(assignment.title.length > 40 ? assignment.title.slice(0, 40) : assignment.title);
    }
  }, [open, assignment]);

  const handleCreate = async () => {
    if (!user?.uid || !assignment || !listName.trim()) return;
    setSaving(true);
    try {
      const result = await createList(listName.trim(), assignment.courseColor);
      if (!result.success || !result.listId) throw new Error('List creation failed');

      await addDoc(collection(db, 'todo_items'), {
        text: assignment.title,
        completed: false,
        listId: result.listId,
        userId: user.uid,
        deadline: assignment.dueAt ? dayjs(assignment.dueAt).format('YYYY-MM-DD') : undefined,
        description: assignment.htmlUrl ? `Canvas link: ${assignment.htmlUrl}` : undefined,
        createdAt: serverTimestamp(),
      });

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

// ─── Assignment Row (with click-to-expand) ─────────────────────────────────────

interface AssignmentRowProps {
  assignment: CanvasAssignment;
  expanded: boolean;
  onToggleExpand: () => void;
  onAddToCalendar: (a: CanvasAssignment) => void;
  onCreateTodoItem: (a: CanvasAssignment) => void;
  onCreateTodoList: (a: CanvasAssignment) => void;
  onSubmit: (a: CanvasAssignment) => void;
}

const SUBMITTABLE_TYPES = new Set(['online_text_entry', 'online_url', 'online_upload']);

function AssignmentRow({
  assignment,
  expanded,
  onToggleExpand,
  onAddToCalendar,
  onCreateTodoItem,
  onCreateTodoList,
  onSubmit,
}: AssignmentRowProps) {
  const canSubmit =
    !assignment.submitted &&
    assignment.submissionTypes.some(t => SUBMITTABLE_TYPES.has(t));
  const { Icon, label: typeLabel } = iconForSubmissionTypes(assignment.submissionTypes);

  const copyDueDate = () => {
    if (!assignment.dueAt) return;
    navigator.clipboard.writeText(dayjs(assignment.dueAt).format('MMM D, YYYY h:mm A'));
    toast.success('Due date copied');
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="rounded-md hover:bg-white/5 group">
          <button
            onClick={onToggleExpand}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-left"
            aria-expanded={expanded}
          >
            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: assignment.courseColor }} />
            <Icon size={11} className="text-muted-foreground/70 shrink-0" aria-label={typeLabel} />
            <span className="flex-1 text-xs text-foreground/90 truncate">{assignment.title}</span>
            {assignment.score !== null && assignment.pointsPossible !== null && (
              <GradeBadge score={assignment.score} pointsPossible={assignment.pointsPossible} />
            )}
            <DueBadge dueAt={assignment.dueAt} />
          </button>

          {expanded && (
            <div className="px-3 pb-2 pt-1 space-y-2 border-l-2 ml-2" style={{ borderColor: assignment.courseColor }}>
              {assignment.description ? (
                <p className="text-[11px] text-muted-foreground whitespace-pre-wrap line-clamp-6">
                  {assignment.description}
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground/60 italic">No description provided</p>
              )}

              <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Icon size={10} />
                  {typeLabel}
                </span>
                {assignment.pointsPossible !== null && (
                  <span>· {assignment.pointsPossible} pts</span>
                )}
                {assignment.dueAt && (
                  <span>· Due {dayjs(assignment.dueAt).format('MMM D, h:mm A')}</span>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {canSubmit && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onSubmit(assignment); }}
                    className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-[#E66000] hover:bg-[#E66000]/90 text-white font-medium transition-colors"
                  >
                    <Upload size={10} />
                    Submit
                  </button>
                )}
                {assignment.htmlUrl && (
                  <button
                    onClick={(e) => { e.stopPropagation(); window.open(assignment.htmlUrl!, '_blank'); }}
                    className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <ExternalLink size={10} />
                    Open in Canvas
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onAddToCalendar(assignment); }}
                  className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors"
                >
                  <Calendar size={10} />
                  Add to Calendar
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onCreateTodoItem(assignment); }}
                  className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 transition-colors"
                >
                  <ListTodo size={10} />
                  Add Todo
                </button>
              </div>
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        {canSubmit && (
          <>
            <ContextMenuItem
              className="flex items-center gap-2 text-xs cursor-pointer text-[#E66000]"
              onClick={() => onSubmit(assignment)}
            >
              <Upload size={13} />
              Submit to Canvas
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
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
  expandedId: string | null;
  onExpand: (id: string | null) => void;
  onAddToCalendar: (a: CanvasAssignment) => void;
  onCreateTodoItem: (a: CanvasAssignment) => void;
  onCreateTodoList: (a: CanvasAssignment) => void;
  onSubmit: (a: CanvasAssignment) => void;
}

function CourseSection({
  course,
  assignments,
  expandedId,
  onExpand,
  onAddToCalendar,
  onCreateTodoItem,
  onCreateTodoList,
  onSubmit,
}: CourseSectionProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-1.5 px-2 py-1 hover:bg-white/5 rounded-md transition-colors"
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: course.color }} />
        <span className="flex-1 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wide truncate">
          {course.name}
        </span>
        <span className="text-[10px] text-muted-foreground/60">{assignments.length}</span>
        {open ? <ChevronDown size={11} className="text-muted-foreground/60" /> : <ChevronRight size={11} className="text-muted-foreground/60" />}
      </button>

      {open && (
        <div className="pl-1">
          {assignments.map(a => (
            <AssignmentRow
              key={a.id}
              assignment={a}
              expanded={expandedId === a.id}
              onToggleExpand={() => onExpand(expandedId === a.id ? null : a.id)}
              onAddToCalendar={onAddToCalendar}
              onCreateTodoItem={onCreateTodoItem}
              onCreateTodoList={onCreateTodoList}
              onSubmit={onSubmit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tabs ──────────────────────────────────────────────────────────────────────

type TabKey = 'assignments' | 'grades' | 'announcements' | 'calendar';

const TABS: { key: TabKey; label: string; Icon: typeof BookOpen }[] = [
  { key: 'assignments', label: 'Assignments', Icon: BookOpen },
  { key: 'grades', label: 'Grades', Icon: GraduationCap },
  { key: 'announcements', label: 'Announcements', Icon: Megaphone },
  { key: 'calendar', label: 'Calendar', Icon: CalendarDays },
];

function TabBar({
  active,
  onChange,
  badges,
}: {
  active: TabKey;
  onChange: (k: TabKey) => void;
  badges?: Partial<Record<TabKey, number>>;
}) {
  return (
    <div className="flex items-center gap-0.5 px-1 pt-1 border-b border-white/5 overflow-x-auto">
      {TABS.map(({ key, label, Icon }) => {
        const isActive = key === active;
        const badge = badges?.[key];
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-t-md text-[10px] whitespace-nowrap transition-colors',
              isActive
                ? 'bg-white/5 text-foreground'
                : 'text-muted-foreground/60 hover:text-foreground hover:bg-white/5'
            )}
            aria-selected={isActive}
            role="tab"
          >
            <Icon size={11} />
            {label}
            {badge ? (
              <span className="inline-flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-full bg-[#E66000] text-white text-[9px] font-semibold leading-none">
                {badge > 99 ? '99+' : badge}
              </span>
            ) : null}
          </button>
        );
      })}
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
    activeAssignmentsByCourse,
    allAssignmentsByCourse,
    gradedAssignments,
    announcements,
    upcomingCalendarEvents,
    pastCalendarEvents,
    activeCount,
    noDueDateCount,
    unreadAnnouncementCount,
    dataLoading,
    syncing,
    connecting,
    connect,
    sync,
    disconnect,
    markAnnouncementRead,
    markAllAnnouncementsRead,
    submitAssignment,
  } = useCanvasIntegration();

  const [tab, setTab] = useState<TabKey>('assignments');
  const [showNoDueDate, setShowNoDueDate] = useState(false);
  const [expandedAssignmentId, setExpandedAssignmentId] = useState<string | null>(null);

  const [connectOpen, setConnectOpen] = useState(false);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [eventFormData, setEventFormData] = useState<{ date: Date; startTime: string; title: string } | null>(null);
  const [todoItemDialogOpen, setTodoItemDialogOpen] = useState(false);
  const [todoListDialogOpen, setTodoListDialogOpen] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<CanvasAssignment | null>(null);

  const handleAddToCalendar = useCallback((assignment: CanvasAssignment) => {
    let date: Date;
    let startTime: string;
    if (assignment.dueAt) {
      const due = new Date(assignment.dueAt);
      date = due;
      const startDate = new Date(due.getTime() - 60 * 60 * 1000);
      startTime = `${startDate.getHours().toString().padStart(2, '0')}:${startDate.getMinutes().toString().padStart(2, '0')}`;
    } else {
      date = new Date();
      startTime = '09:00';
    }
    setEventFormData({ date, startTime, title: assignment.title });
    setEventFormOpen(true);
  }, []);

  const handleCreateTodoItem = useCallback((assignment: CanvasAssignment) => {
    setSelectedAssignment(assignment);
    setTodoItemDialogOpen(true);
  }, []);

  const handleCreateTodoList = useCallback((assignment: CanvasAssignment) => {
    setSelectedAssignment(assignment);
    setTodoListDialogOpen(true);
  }, []);

  const handleOpenSubmit = useCallback((assignment: CanvasAssignment) => {
    setSelectedAssignment(assignment);
    setSubmitDialogOpen(true);
  }, []);

  // Auto-resync on open if data is older than 30 minutes
  React.useEffect(() => {
    if (!status.connected || !status.lastSyncAt) return;
    const age = Date.now() - new Date(status.lastSyncAt).getTime();
    if (age > 30 * 60 * 1000 && !syncing) sync();
  }, [status.connected, status.lastSyncAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const lastSyncLabel = useMemo(() => {
    if (!status.lastSyncAt) return null;
    const mins = Math.floor((Date.now() - new Date(status.lastSyncAt).getTime()) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    return dayjs(status.lastSyncAt).format('h:mm A');
  }, [status.lastSyncAt]);

  // Groups for the current view (Assignments tab)
  const groupsToRender = showNoDueDate ? allAssignmentsByCourse : activeAssignmentsByCourse;
  const headlineCount = showNoDueDate
    ? allAssignmentsByCourse.reduce((n, g) => n + g.assignments.length, 0)
    : activeCount;

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
          // ── Not connected ──
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
        ) : (
          // ── Connected: tabbed view ──
          <div className="flex flex-col">
            <TabBar
              active={tab}
              onChange={setTab}
              badges={{ announcements: unreadAnnouncementCount }}
            />

            {/* Sync error pill, shown across all tabs */}
            {(status.lastSyncError || (status.lastSyncFailedCourseCount ?? 0) > 0) && (
              <div className="mx-2 mt-2 px-2 py-1.5 rounded-md bg-red-500/10 border border-red-500/20 flex items-start gap-1.5">
                <AlertTriangle size={11} className="text-red-400 mt-0.5 shrink-0" />
                <div className="text-[10px] text-red-300 flex-1 min-w-0">
                  {status.lastSyncError ? (
                    <>Sync failed: <span className="text-red-200">{status.lastSyncError}</span></>
                  ) : (
                    <>Couldn't sync {status.lastSyncFailedCourseCount} course{(status.lastSyncFailedCourseCount ?? 0) === 1 ? '' : 's'}. Some assignments may be missing.</>
                  )}
                </div>
                <button
                  onClick={sync}
                  disabled={syncing}
                  className="text-[10px] text-red-300 hover:text-red-200 underline shrink-0"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Body */}
            {tab === 'assignments' && (
              <AssignmentsTab
                dataLoading={dataLoading}
                groups={groupsToRender}
                headlineCount={headlineCount}
                showNoDueDate={showNoDueDate}
                noDueDateCount={noDueDateCount}
                onToggleShowNoDueDate={() => setShowNoDueDate(v => !v)}
                lastSyncLabel={lastSyncLabel}
                syncing={syncing}
                onSync={sync}
                expandedAssignmentId={expandedAssignmentId}
                onExpand={setExpandedAssignmentId}
                onAddToCalendar={handleAddToCalendar}
                onCreateTodoItem={handleCreateTodoItem}
                onCreateTodoList={handleCreateTodoList}
                onSubmit={handleOpenSubmit}
                onDisconnect={disconnect}
              />
            )}

            {tab === 'grades' && (
              <GradesTab
                dataLoading={dataLoading}
                assignments={gradedAssignments}
              />
            )}

            {tab === 'announcements' && (
              <AnnouncementsTab
                dataLoading={dataLoading}
                announcements={announcements}
                onMarkRead={markAnnouncementRead}
                onMarkAllRead={markAllAnnouncementsRead}
                unreadCount={unreadAnnouncementCount}
              />
            )}
            {tab === 'calendar' && (
              <CalendarTab
                dataLoading={dataLoading}
                upcoming={upcomingCalendarEvents}
                past={pastCalendarEvents}
                onAddToCalendar={(event) => {
                  // Mirror this Canvas event into the local calendar via EventForm,
                  // reusing the same flow Assignments use.
                  const start = event.startAt ? new Date(event.startAt) : new Date();
                  const startTime = `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')}`;
                  setEventFormData({ date: start, startTime, title: event.title });
                  setEventFormOpen(true);
                }}
              />
            )}
          </div>
        )}
      </ModuleContainer>

      <CanvasConnectSheet
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        onConnect={connect}
        connecting={connecting}
      />

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

      <CreateTodoItemDialog
        open={todoItemDialogOpen}
        onClose={() => setTodoItemDialogOpen(false)}
        assignment={selectedAssignment}
      />

      <CreateTodoListDialog
        open={todoListDialogOpen}
        onClose={() => setTodoListDialogOpen(false)}
        assignment={selectedAssignment}
      />

      <SubmitAssignmentDialog
        open={submitDialogOpen}
        onClose={() => setSubmitDialogOpen(false)}
        assignment={selectedAssignment}
        onSubmit={submitAssignment}
      />
    </>
  );
};

// ─── Assignments tab body ──────────────────────────────────────────────────────

interface AssignmentsTabProps {
  dataLoading: boolean;
  groups: { course: { id: string; name: string; color: string }; assignments: CanvasAssignment[] }[];
  headlineCount: number;
  showNoDueDate: boolean;
  noDueDateCount: number;
  onToggleShowNoDueDate: () => void;
  lastSyncLabel: string | null;
  syncing: boolean;
  onSync: () => void;
  expandedAssignmentId: string | null;
  onExpand: (id: string | null) => void;
  onAddToCalendar: (a: CanvasAssignment) => void;
  onCreateTodoItem: (a: CanvasAssignment) => void;
  onCreateTodoList: (a: CanvasAssignment) => void;
  onSubmit: (a: CanvasAssignment) => void;
  onDisconnect: () => void;
}

function AssignmentsTab({
  dataLoading,
  groups,
  headlineCount,
  showNoDueDate,
  noDueDateCount,
  onToggleShowNoDueDate,
  lastSyncLabel,
  syncing,
  onSync,
  expandedAssignmentId,
  onExpand,
  onAddToCalendar,
  onCreateTodoItem,
  onCreateTodoList,
  onSubmit,
  onDisconnect,
}: AssignmentsTabProps) {
  if (dataLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw size={16} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <CheckCircle2 size={24} className="text-green-400" />
        <p className="text-sm font-medium">All caught up!</p>
        <p className="text-xs text-muted-foreground">No upcoming or overdue assignments</p>

        {noDueDateCount > 0 && !showNoDueDate && (
          <button
            onClick={onToggleShowNoDueDate}
            className="mt-2 text-[10px] text-muted-foreground/80 hover:text-foreground underline"
          >
            Show {noDueDateCount} assignment{noDueDateCount === 1 ? '' : 's'} with no due date
          </button>
        )}

        {lastSyncLabel && (
          <p className="text-[10px] text-muted-foreground/60 mt-1">Synced {lastSyncLabel}</p>
        )}

        <div className="mt-3 pt-2 border-t border-white/5 w-full flex justify-center">
          <button
            onClick={onDisconnect}
            className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 hover:text-destructive transition-colors"
          >
            <Unlink size={11} />
            Disconnect Canvas
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-1 pt-1 pb-2">
      {/* Summary row */}
      <div className="flex items-center justify-between px-2 mb-2 gap-2">
        <span className="text-[10px] text-muted-foreground">
          {headlineCount} {headlineCount === 1 ? 'assignment' : 'assignments'}
        </span>
        <div className="flex items-center gap-2">
          {noDueDateCount > 0 && (
            <button
              onClick={onToggleShowNoDueDate}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors"
              title={showNoDueDate ? 'Hide no-due-date assignments' : 'Show no-due-date assignments'}
            >
              {showNoDueDate ? <EyeOff size={10} /> : <Eye size={10} />}
              {showNoDueDate ? 'Hide' : `+${noDueDateCount} no-date`}
            </button>
          )}
          {lastSyncLabel && (
            <span className="text-[10px] text-muted-foreground/60">{lastSyncLabel}</span>
          )}
          <button
            onClick={onSync}
            disabled={syncing}
            className="p-0.5 rounded hover:bg-white/10 text-muted-foreground/60 hover:text-foreground transition-colors"
            title="Sync Canvas"
          >
            <RefreshCw size={11} className={syncing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {groups.map(({ course, assignments }) => (
        <CourseSection
          key={course.id}
          course={course}
          assignments={assignments}
          expandedId={expandedAssignmentId}
          onExpand={onExpand}
          onAddToCalendar={onAddToCalendar}
          onCreateTodoItem={onCreateTodoItem}
          onCreateTodoList={onCreateTodoList}
          onSubmit={onSubmit}
        />
      ))}

      <div className="mt-3 px-2 pt-2 border-t border-white/5">
        <button
          onClick={onDisconnect}
          className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 hover:text-destructive transition-colors"
        >
          <Unlink size={11} />
          Disconnect Canvas
        </button>
      </div>
    </div>
  );
}

// ─── Grades tab body ───────────────────────────────────────────────────────────

function GradesTab({ dataLoading, assignments }: { dataLoading: boolean; assignments: CanvasAssignment[] }) {
  if (dataLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw size={16} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (assignments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <GraduationCap size={24} className="text-muted-foreground" />
        <p className="text-sm font-medium">No grades yet</p>
        <p className="text-xs text-muted-foreground">Graded assignments will appear here</p>
      </div>
    );
  }

  // Group by course for visual scanning
  const byCourse = new Map<string, { courseName: string; color: string; items: CanvasAssignment[] }>();
  for (const a of assignments) {
    if (!byCourse.has(a.courseId)) {
      byCourse.set(a.courseId, { courseName: a.courseName, color: a.courseColor, items: [] });
    }
    byCourse.get(a.courseId)!.items.push(a);
  }

  return (
    <div className="px-1 pt-2 pb-2">
      {Array.from(byCourse.entries()).map(([courseId, { courseName, color, items }]) => {
        const totalScore = items.reduce((s, a) => s + (a.score ?? 0), 0);
        const totalPoints = items.reduce((s, a) => s + (a.pointsPossible ?? 0), 0);
        const pct = totalPoints > 0 ? (totalScore / totalPoints) * 100 : null;

        return (
          <div key={courseId} className="mb-2">
            <div className="flex items-center gap-1.5 px-2 py-1">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
              <span className="flex-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide truncate">
                {courseName}
              </span>
              {pct !== null && (
                <span className="text-[10px] text-muted-foreground/80 tabular-nums">
                  {pct.toFixed(1)}%
                </span>
              )}
            </div>
            <div className="pl-1">
              {items.map(a => (
                <div key={a.id} className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-white/5">
                  <span className="flex-1 text-xs text-foreground/90 truncate">{a.title}</span>
                  <GradeBadge score={a.score!} pointsPossible={a.pointsPossible} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Announcements tab body ────────────────────────────────────────────────────

interface AnnouncementsTabProps {
  dataLoading: boolean;
  announcements: CanvasAnnouncement[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

function AnnouncementsTab({
  dataLoading,
  announcements,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
}: AnnouncementsTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [courseFilter, setCourseFilter] = useState<string | null>(null);

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw size={16} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (announcements.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <Megaphone size={24} className="text-muted-foreground" />
        <p className="text-sm font-medium">No announcements</p>
        <p className="text-xs text-muted-foreground">Posts from the last 60 days will appear here</p>
      </div>
    );
  }

  // Unique courses present in announcements, for the chip filter row.
  const courseChips = Array.from(
    new Map(announcements.map(a => [a.courseId, { id: a.courseId, name: a.courseName, color: a.courseColor }])).values()
  );

  const visible = courseFilter
    ? announcements.filter(a => a.courseId === courseFilter)
    : announcements;

  const handleToggle = (a: CanvasAnnouncement) => {
    const next = expandedId === a.id ? null : a.id;
    setExpandedId(next);
    if (next && !a.read) onMarkRead(a.id);
  };

  return (
    <div className="px-1 pt-2 pb-2">
      {/* Filter + actions row */}
      <div className="flex items-center justify-between px-2 mb-2 gap-2">
        <span className="text-[10px] text-muted-foreground">
          {visible.length} {visible.length === 1 ? 'post' : 'posts'}
          {unreadCount > 0 && (
            <span className="text-[#E66000] ml-1">· {unreadCount} unread</span>
          )}
        </span>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            className="text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Course filter chips */}
      {courseChips.length > 1 && (
        <div className="flex items-center gap-1 px-2 mb-2 overflow-x-auto">
          <button
            onClick={() => setCourseFilter(null)}
            className={cn(
              'text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap transition-colors',
              courseFilter === null
                ? 'bg-white/10 text-foreground'
                : 'bg-white/5 text-muted-foreground hover:bg-white/10'
            )}
          >
            All
          </button>
          {courseChips.map(c => (
            <button
              key={c.id}
              onClick={() => setCourseFilter(courseFilter === c.id ? null : c.id)}
              className={cn(
                'inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap transition-colors max-w-[140px]',
                courseFilter === c.id
                  ? 'bg-white/10 text-foreground'
                  : 'bg-white/5 text-muted-foreground hover:bg-white/10'
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: c.color }} />
              <span className="truncate">{c.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Feed */}
      <div className="space-y-0.5">
        {visible.map(a => {
          const expanded = expandedId === a.id;
          const when = a.postedAt ? dayjs(a.postedAt) : null;
          const ago = when ? (() => {
            const mins = dayjs().diff(when, 'minute');
            if (mins < 1) return 'just now';
            if (mins < 60) return `${mins}m ago`;
            const hrs = dayjs().diff(when, 'hour');
            if (hrs < 24) return `${hrs}h ago`;
            const days = dayjs().diff(when, 'day');
            if (days < 7) return `${days}d ago`;
            return when.format('MMM D');
          })() : null;

          return (
            <div key={a.id} className="rounded-md hover:bg-white/5">
              <button
                onClick={() => handleToggle(a)}
                className="w-full flex items-start gap-2 px-2 py-1.5 text-left"
                aria-expanded={expanded}
              >
                {/* Unread dot */}
                <span
                  className={cn(
                    'mt-1 w-1.5 h-1.5 rounded-full shrink-0',
                    a.read ? 'bg-transparent' : 'bg-[#E66000]'
                  )}
                  aria-label={a.read ? 'Read' : 'Unread'}
                />
                <span className="w-1.5 h-1.5 rounded-full mt-1 shrink-0" style={{ background: a.courseColor }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('text-xs truncate', a.read ? 'text-foreground/80' : 'text-foreground font-semibold')}>
                      {a.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 mt-0.5">
                    <span className="truncate max-w-[100px]">{a.courseName}</span>
                    {a.author && <span>· {a.author}</span>}
                    {ago && <span>· {ago}</span>}
                  </div>
                </div>
              </button>

              {expanded && (
                <div className="px-3 pb-2 pt-0 ml-3 border-l-2 space-y-2" style={{ borderColor: a.courseColor }}>
                  {a.message ? (
                    <p className="text-[11px] text-muted-foreground whitespace-pre-wrap line-clamp-12 pl-2">
                      {a.message}
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground/60 italic pl-2">No body content</p>
                  )}
                  {a.htmlUrl && (
                    <div className="pl-2 pt-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); window.open(a.htmlUrl!, '_blank'); }}
                        className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <ExternalLink size={10} />
                        Open in Canvas
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Calendar tab body ─────────────────────────────────────────────────────────

interface CalendarTabProps {
  dataLoading: boolean;
  upcoming: CanvasCalendarEvent[];
  past: CanvasCalendarEvent[];
  onAddToCalendar: (event: CanvasCalendarEvent) => void;
}

function CalendarTab({ dataLoading, upcoming, past, onAddToCalendar }: CalendarTabProps) {
  const [showPast, setShowPast] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (dataLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw size={16} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (upcoming.length === 0 && past.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <CalendarDays size={24} className="text-muted-foreground" />
        <p className="text-sm font-medium">No Canvas events</p>
        <p className="text-xs text-muted-foreground max-w-[220px]">
          Canvas-native events (lectures, office hours, exam logistics) will appear here when your school posts them.
        </p>
      </div>
    );
  }

  const items = showPast ? past : upcoming;

  // Group by day so the feed reads like a calendar.
  const byDay = new Map<string, CanvasCalendarEvent[]>();
  for (const e of items) {
    if (!e.startAt) continue;
    const dayKey = dayjs(e.startAt).format('YYYY-MM-DD');
    if (!byDay.has(dayKey)) byDay.set(dayKey, []);
    byDay.get(dayKey)!.push(e);
  }

  const formatRange = (e: CanvasCalendarEvent): string => {
    if (e.allDay) return 'All day';
    if (!e.startAt) return '';
    const start = dayjs(e.startAt);
    const end = e.endAt ? dayjs(e.endAt) : null;
    if (end && end.diff(start, 'minute') > 0) {
      return `${start.format('h:mm A')} – ${end.format('h:mm A')}`;
    }
    return start.format('h:mm A');
  };

  return (
    <div className="px-1 pt-2 pb-2">
      {/* Mode row */}
      <div className="flex items-center justify-between px-2 mb-2 gap-2">
        <span className="text-[10px] text-muted-foreground">
          {items.length} {items.length === 1 ? 'event' : 'events'}{showPast ? ' (past)' : ''}
        </span>
        {past.length > 0 && (
          <button
            onClick={() => setShowPast(v => !v)}
            className="text-[10px] text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            {showPast ? 'Show upcoming' : `Show past (${past.length})`}
          </button>
        )}
      </div>

      {byDay.size === 0 ? (
        <div className="flex flex-col items-center gap-1 py-6 text-center">
          <p className="text-xs text-muted-foreground">
            {showPast ? 'No past events in range' : 'No upcoming events'}
          </p>
        </div>
      ) : (
        Array.from(byDay.entries()).map(([day, events]) => {
          const d = dayjs(day);
          const isToday = d.isSame(dayjs(), 'day');
          const isTomorrow = d.isSame(dayjs().add(1, 'day'), 'day');
          const dayLabel = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : d.format('ddd, MMM D');

          return (
            <div key={day} className="mb-2">
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                {dayLabel}
              </div>
              <div className="pl-1">
                {events.map(e => {
                  const expanded = expandedId === e.id;
                  return (
                    <div key={e.id} className="rounded-md hover:bg-white/5">
                      <button
                        onClick={() => setExpandedId(expanded ? null : e.id)}
                        className="w-full flex items-start gap-2 px-2 py-1.5 text-left"
                        aria-expanded={expanded}
                      >
                        <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: e.courseColor }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-foreground/90 truncate">{e.title}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground/70 mt-0.5">
                            <Clock size={9} />
                            <span>{formatRange(e)}</span>
                            <span className="truncate">· {e.courseName}</span>
                            {e.locationName && (
                              <>
                                <MapPin size={9} />
                                <span className="truncate">{e.locationName}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </button>

                      {expanded && (
                        <div className="px-3 pb-2 pt-0 ml-3 border-l-2 space-y-2" style={{ borderColor: e.courseColor }}>
                          {e.description ? (
                            <p className="text-[11px] text-muted-foreground whitespace-pre-wrap line-clamp-8 pl-2">
                              {e.description}
                            </p>
                          ) : (
                            <p className="text-[11px] text-muted-foreground/60 italic pl-2">No description</p>
                          )}

                          {e.locationAddress && e.locationAddress !== e.locationName && (
                            <p className="text-[10px] text-muted-foreground/70 pl-2">
                              <MapPin size={9} className="inline mr-1" />
                              {e.locationAddress}
                            </p>
                          )}

                          <div className="flex flex-wrap gap-1.5 pt-1 pl-2">
                            <button
                              onClick={(ev) => { ev.stopPropagation(); onAddToCalendar(e); }}
                              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors"
                            >
                              <Calendar size={10} />
                              Add to my calendar
                            </button>
                            {e.htmlUrl && (
                              <button
                                onClick={(ev) => { ev.stopPropagation(); window.open(e.htmlUrl!, '_blank'); }}
                                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 transition-colors"
                              >
                                <ExternalLink size={10} />
                                Open in Canvas
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default CanvasModule;
