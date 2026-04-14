import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Globe, AppWindow, Timer, ListTodo, Bell, Play, X, CheckCircle2, Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { MallyAction, MallyActionType } from '@/lib/stores/types';
import { useActionRunnerStore } from '@/lib/stores/action-runner-store';
import { usePomodoroStore } from '@/lib/stores/pomodoro-store';
import { useTodoLists } from '@/hooks/use-todo-lists';
import { useSettingsStore } from '@/lib/stores/settings-store';
import dayjs from 'dayjs';

// ── Action icon map ──────────────────────────────────────────────────────────

function ActionTypeIcon({ type, size = 14 }: { type: MallyActionType; size?: number }) {
  switch (type) {
    case 'open_url': return <Globe size={size} />;
    case 'open_app': return <AppWindow size={size} />;
    case 'start_pomodoro': return <Timer size={size} />;
    case 'create_todo': return <ListTodo size={size} />;
    case 'show_reminder': return <Bell size={size} />;
    case 'open_shortcut': return <Workflow size={size} />;
  }
}

function actionSummary(action: MallyAction): string {
  switch (action.type) {
    case 'open_url': return action.label || action.url || 'Open URL';
    case 'open_app': return action.appName ? `Open ${action.appName}` : action.appScheme || 'Open App';
    case 'start_pomodoro': return action.pomodoroLabel
      ? `Focus: ${action.pomodoroLabel} (${action.pomodoroMinutes ?? 25}min)`
      : `Start ${action.pomodoroMinutes ?? 25}min focus`;
    case 'create_todo': return `Create task: "${action.todoTitle || 'New task'}"`;
    case 'show_reminder': return action.message || 'Reminder';
    case 'open_shortcut': return action.shortcutName
      ? `Run shortcut: "${action.shortcutName}"`
      : 'Apple Shortcut';
  }
}

// ── Per-action execution ─────────────────────────────────────────────────────

type ActionStatus = 'pending' | 'running' | 'done' | 'error';

interface ActionRunnerModalProps {
  /** Called when user closes or all actions complete */
  onClose?: () => void;
}

export function ActionRunnerModal({ onClose }: ActionRunnerModalProps) {
  const { pendingEvent, clearPending } = useActionRunnerStore();
  const { startTimer, setFocusTime, setBreakTime } = usePomodoroStore();
  const { addTodo, lists } = useTodoLists();
  const defaultTodoListId = useSettingsStore(s => s.defaultTodoListId);

  const [statuses, setStatuses] = useState<Record<string, ActionStatus>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [allDone, setAllDone] = useState(false);

  // Auto-dismiss countdown (10 seconds after all done)
  useEffect(() => {
    if (!allDone) return;
    const t = setTimeout(() => {
      clearPending();
      onClose?.();
    }, 3000);
    return () => clearTimeout(t);
  }, [allDone, clearPending, onClose]);

  // Reset status when a new event comes in
  useEffect(() => {
    if (pendingEvent) {
      const initial: Record<string, ActionStatus> = {};
      pendingEvent.mallyActions?.forEach(a => { initial[a.id] = 'pending'; });
      setStatuses(initial);
      setAllDone(false);
      setIsRunning(false);
    }
  }, [pendingEvent?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolveListId = useCallback(() => {
    if (defaultTodoListId) {
      const match = lists.find(l => l.id === defaultTodoListId);
      if (match) return match.id;
    }
    const def = lists.find(l => l.isDefault) || lists[0];
    return def?.id;
  }, [lists, defaultTodoListId]);

  const executeAction = useCallback(async (action: MallyAction) => {
    setStatuses(s => ({ ...s, [action.id]: 'running' }));
    try {
      switch (action.type) {
        case 'open_url': {
          const url = action.url?.trim();
          if (url) window.open(url.startsWith('http') ? url : `https://${url}`, '_blank');
          break;
        }
        case 'open_app': {
          const scheme = action.appScheme?.trim();
          if (scheme) window.location.href = scheme;
          break;
        }
        case 'start_pomodoro': {
          const mins = action.pomodoroMinutes ?? 25;
          setFocusTime(mins);
          setBreakTime(5);
          startTimer();
          break;
        }
        case 'create_todo': {
          const listId = resolveListId();
          if (listId && action.todoTitle) {
            await addTodo(action.todoTitle, listId);
          }
          break;
        }
        case 'show_reminder': {
          if (action.message) {
            toast.info(action.message, { duration: 8000 });
          }
          break;
        }
        case 'open_shortcut': {
          const name = action.shortcutName?.trim();
          if (name) {
            const params = new URLSearchParams({ name });
            if (action.shortcutInput) params.set('input', action.shortcutInput);
            window.location.href = `shortcuts://run-shortcut?${params.toString()}`;
          }
          break;
        }
      }
      setStatuses(s => ({ ...s, [action.id]: 'done' }));
    } catch {
      setStatuses(s => ({ ...s, [action.id]: 'error' }));
    }
  }, [addTodo, resolveListId, setFocusTime, setBreakTime, startTimer]);

  const runAll = useCallback(async () => {
    if (!pendingEvent?.mallyActions?.length) return;
    setIsRunning(true);
    const sorted = [...pendingEvent.mallyActions].sort((a, b) => a.order - b.order);
    for (const action of sorted) {
      await executeAction(action);
      // Small gap between actions for visual feedback
      await new Promise(r => setTimeout(r, 300));
    }
    setIsRunning(false);
    setAllDone(true);
  }, [pendingEvent, executeAction]);

  const dismiss = useCallback(() => {
    clearPending();
    onClose?.();
  }, [clearPending, onClose]);

  if (!pendingEvent) return null;

  const actions = [...(pendingEvent.mallyActions || [])].sort((a, b) => a.order - b.order);
  const eventTime = dayjs(pendingEvent.startsAt).format('h:mm A');

  return (
    <AnimatePresence>
      {pendingEvent && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) dismiss(); }}
        >
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="bg-background border border-border/60 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
          >
            {/* Header */}
            <div className="relative px-5 pt-5 pb-4 bg-gradient-to-b from-primary/8 to-transparent">
              <button
                onClick={dismiss}
                className="absolute top-4 right-4 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X size={14} />
              </button>

              <div className="flex items-start gap-3">
                <div className="mt-0.5 h-8 w-8 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                  <Zap size={15} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">
                    Mally Actions
                  </p>
                  <p className="text-sm font-semibold text-foreground leading-snug truncate">
                    {pendingEvent.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{eventTime}</p>
                </div>
              </div>
            </div>

            {/* Actions list */}
            <div className="px-5 pb-2 space-y-1.5">
              {actions.map((action, idx) => {
                const status = statuses[action.id] ?? 'pending';
                return (
                  <div
                    key={action.id}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all duration-300",
                      status === 'pending' && "bg-secondary/40 border-border/40",
                      status === 'running' && "bg-primary/8 border-primary/30 animate-pulse",
                      status === 'done' && "bg-emerald-500/8 border-emerald-500/20",
                      status === 'error' && "bg-destructive/8 border-destructive/20",
                    )}
                  >
                    <span className={cn(
                      "shrink-0 transition-colors",
                      status === 'pending' && "text-muted-foreground",
                      status === 'running' && "text-primary",
                      status === 'done' && "text-emerald-500",
                      status === 'error' && "text-destructive",
                    )}>
                      {status === 'done'
                        ? <CheckCircle2 size={14} />
                        : <ActionTypeIcon type={action.type} size={14} />
                      }
                    </span>
                    <span className={cn(
                      "text-xs flex-1 min-w-0 truncate",
                      status === 'done' && "line-through text-muted-foreground",
                      status !== 'done' && "text-foreground/90"
                    )}>
                      {actionSummary(action)}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50 shrink-0">
                      {idx + 1}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Footer buttons */}
            <div className="px-5 py-4 flex items-center gap-2 border-t border-border/30 mt-2">
              {allDone ? (
                <div className="flex items-center gap-2 flex-1">
                  <CheckCircle2 size={15} className="text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">All done — closing soon</span>
                </div>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={dismiss}
                    disabled={isRunning}
                    className="text-muted-foreground flex-1"
                  >
                    Dismiss
                  </Button>
                  <Button
                    size="sm"
                    onClick={runAll}
                    disabled={isRunning}
                    className="flex-1 gap-1.5"
                  >
                    <Play size={12} />
                    {isRunning ? 'Running…' : 'Run actions'}
                  </Button>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
