import React, { useState } from 'react';
import { Plus, Trash2, GripVertical, Zap, Globe, AppWindow, Timer, ListTodo, Bell, Workflow } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { MallyAction, MallyActionType } from '@/lib/stores/types';

interface ActionBuilderProps {
  actions: MallyAction[];
  onChange: (actions: MallyAction[]) => void;
}

const ACTION_TYPES: { value: MallyActionType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'open_url', label: 'Open URL', icon: <Globe size={14} />, description: 'Open a website in a new tab' },
  { value: 'open_app', label: 'Open App', icon: <AppWindow size={14} />, description: 'Launch an app via URL scheme' },
  { value: 'start_pomodoro', label: 'Start Focus', icon: <Timer size={14} />, description: 'Start a Pomodoro focus timer' },
  { value: 'create_todo', label: 'Create Todo', icon: <ListTodo size={14} />, description: 'Add a task to your todo list' },
  { value: 'show_reminder', label: 'Show Reminder', icon: <Bell size={14} />, description: 'Display a reminder message' },
  { value: 'open_shortcut', label: 'Apple Shortcut', icon: <Workflow size={14} />, description: 'Run an Apple Shortcut (iOS/macOS)' },
];

const POPULAR_APPS = [
  { name: 'Spotify', scheme: 'spotify:' },
  { name: 'Notion', scheme: 'notion:' },
  { name: 'Obsidian', scheme: 'obsidian://' },
  { name: 'VS Code', scheme: 'vscode://' },
  { name: 'Word', scheme: 'ms-word://' },
  { name: 'Figma', scheme: 'figma://' },
];

function ActionIcon({ type }: { type: MallyActionType }) {
  const found = ACTION_TYPES.find(a => a.value === type);
  return <span className="text-muted-foreground">{found?.icon}</span>;
}

function ActionFields({ action, onChange }: { action: MallyAction; onChange: (updated: MallyAction) => void }) {
  switch (action.type) {
    case 'open_url':
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">URL</Label>
            <Input
              placeholder="https://example.com"
              value={action.url || ''}
              onChange={e => onChange({ ...action, url: e.target.value })}
              className="h-7 text-xs"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Label (optional)</Label>
            <Input
              placeholder="e.g. Open Notion doc"
              value={action.label || ''}
              onChange={e => onChange({ ...action, label: e.target.value })}
              className="h-7 text-xs"
            />
          </div>
        </div>
      );

    case 'open_app':
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">App</Label>
            <div className="flex flex-wrap gap-1 mb-2">
              {POPULAR_APPS.map(app => (
                <button
                  key={app.scheme}
                  type="button"
                  onClick={() => onChange({ ...action, appName: app.name, appScheme: app.scheme })}
                  className={cn(
                    "text-[11px] px-2 py-0.5 rounded-full border transition-all",
                    action.appScheme === app.scheme
                      ? "bg-primary/10 border-primary/40 text-foreground"
                      : "border-border/50 text-muted-foreground hover:border-border"
                  )}
                >
                  {app.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Custom URL scheme</Label>
            <Input
              placeholder="app-scheme://"
              value={action.appScheme || ''}
              onChange={e => onChange({ ...action, appScheme: e.target.value })}
              className="h-7 text-xs font-mono"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">App name</Label>
            <Input
              placeholder="e.g. Spotify"
              value={action.appName || ''}
              onChange={e => onChange({ ...action, appName: e.target.value })}
              className="h-7 text-xs"
            />
          </div>
        </div>
      );

    case 'start_pomodoro':
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Session label (optional)</Label>
            <Input
              placeholder="e.g. Deep work"
              value={action.pomodoroLabel || ''}
              onChange={e => onChange({ ...action, pomodoroLabel: e.target.value })}
              className="h-7 text-xs"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Duration (minutes)</Label>
            <Select
              value={String(action.pomodoroMinutes ?? 25)}
              onValueChange={v => onChange({ ...action, pomodoroMinutes: Number(v) })}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[15, 20, 25, 30, 45, 60, 90].map(m => (
                  <SelectItem key={m} value={String(m)}>{m} min</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      );

    case 'create_todo':
      return (
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Task title</Label>
          <Input
            placeholder="e.g. Review meeting notes"
            value={action.todoTitle || ''}
            onChange={e => onChange({ ...action, todoTitle: e.target.value })}
            className="h-7 text-xs"
          />
        </div>
      );

    case 'show_reminder':
      return (
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Reminder message</Label>
          <Input
            placeholder="e.g. Don't forget to warm up first"
            value={action.message || ''}
            onChange={e => onChange({ ...action, message: e.target.value })}
            className="h-7 text-xs"
          />
        </div>
      );

    case 'open_shortcut':
      return (
        <div className="space-y-2">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Shortcut name</Label>
            <Input
              placeholder="e.g. Morning Routine"
              value={action.shortcutName || ''}
              onChange={e => onChange({ ...action, shortcutName: e.target.value })}
              className="h-7 text-xs"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Must match the exact name in your Apple Shortcuts app.</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Input (optional)</Label>
            <Input
              placeholder="e.g. event title or a custom value"
              value={action.shortcutInput || ''}
              onChange={e => onChange({ ...action, shortcutInput: e.target.value })}
              className="h-7 text-xs"
            />
          </div>
        </div>
      );

    default:
      return null;
  }
}

export function ActionBuilder({ actions, onChange }: ActionBuilderProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const addAction = (type: MallyActionType) => {
    const newAction: MallyAction = {
      id: crypto.randomUUID(),
      type,
      order: actions.length,
    };
    const next = [...actions, newAction];
    onChange(next);
    setExpandedId(newAction.id);
  };

  const removeAction = (id: string) => {
    onChange(actions.filter(a => a.id !== id).map((a, i) => ({ ...a, order: i })));
    if (expandedId === id) setExpandedId(null);
  };

  const updateAction = (updated: MallyAction) => {
    onChange(actions.map(a => a.id === updated.id ? updated : a));
  };

  const moveAction = (id: string, dir: 'up' | 'down') => {
    const idx = actions.findIndex(a => a.id === id);
    if (dir === 'up' && idx === 0) return;
    if (dir === 'down' && idx === actions.length - 1) return;
    const next = [...actions];
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onChange(next.map((a, i) => ({ ...a, order: i })));
  };

  const actionTypeLabel = (type: MallyActionType) => {
    switch (type) {
      case 'open_url': return (a: MallyAction) => a.label || a.url || 'Open URL';
      case 'open_app': return (a: MallyAction) => a.appName || a.appScheme || 'Open App';
      case 'start_pomodoro': return (a: MallyAction) => a.pomodoroLabel ? `Focus: ${a.pomodoroLabel}` : `Focus ${a.pomodoroMinutes ?? 25}min`;
      case 'create_todo': return (a: MallyAction) => a.todoTitle || 'New task';
      case 'show_reminder': return (a: MallyAction) => a.message || 'Reminder';
    }
  };

  return (
    <div className="space-y-2">
      {/* Action list */}
      {actions.length > 0 && (
        <div className="space-y-1.5">
          {actions.map((action, idx) => {
            const isExpanded = expandedId === action.id;
            const labelFn = actionTypeLabel(action.type);
            return (
              <div
                key={action.id}
                className={cn(
                  "rounded-md border bg-secondary/30 transition-all",
                  isExpanded && "border-primary/30 bg-primary/5"
                )}
              >
                {/* Action header row */}
                <div
                  className="flex items-center gap-2 px-2.5 py-2 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : action.id)}
                >
                  <GripVertical size={12} className="text-muted-foreground/40 shrink-0" />
                  <span className="text-[10px] font-medium text-muted-foreground bg-background/60 rounded px-1.5 py-0.5 border border-border/40 shrink-0">
                    {idx + 1}
                  </span>
                  <ActionIcon type={action.type} />
                  <span className="text-xs font-medium truncate flex-1">{labelFn(action)}</span>
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); moveAction(action.id, 'up'); }}
                      disabled={idx === 0}
                      className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-20 hover:bg-secondary transition-colors"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M5 2L9 7H1L5 2z"/></svg>
                    </button>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); moveAction(action.id, 'down'); }}
                      disabled={idx === actions.length - 1}
                      className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-20 hover:bg-secondary transition-colors"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M5 8L1 3H9L5 8z"/></svg>
                    </button>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); removeAction(action.id); }}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>

                {/* Expanded fields */}
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-border/30 pt-2.5">
                    <ActionFields action={action} onChange={updateAction} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add action menu */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {ACTION_TYPES.map(t => (
          <button
            key={t.value}
            type="button"
            onClick={() => addAction(t.value)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border border-dashed border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-primary/5 transition-all"
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {actions.length === 0 && (
        <p className="text-[11px] text-muted-foreground/60 italic text-center py-1">
          Add actions that run automatically when this event starts
        </p>
      )}
    </div>
  );
}
