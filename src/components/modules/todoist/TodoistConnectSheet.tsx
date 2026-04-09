/**
 * TodoistConnectSheet
 *
 * Flow:
 * 1. Not connected → "Connect Todoist" → OAuth popup opens
 * 2. Popup closes → postMessage received → projects load automatically
 * 3. Inbox is pre-selected, task counts visible per project
 * 4. User confirms a project → sync fires immediately → tasks appear → sheet closes
 */

import React, { useEffect, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  CheckCircle2,
  Circle,
  ExternalLink,
  Loader2,
  RefreshCw,
  Unplug,
  Inbox,
  FolderOpen,
} from 'lucide-react';
import { TodoistProject, TodoistStatus } from '@/hooks/use-todoist-integration';

const TODOIST_RED = '#db4035';

// The sheet receives hook data from the parent — it does NOT own its own
// useTodoistIntegration instance, which would cause duplicate auto-syncs.
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkedProjectId?: string;
  onProjectLinked: (projectId: string, projectName: string) => void;
  onProjectUnlinked: () => void;
  // Passed down from parent's useTodoistIntegration
  status: TodoistStatus;
  isSyncing: boolean;
  projects: TodoistProject[];
  projectsLoading: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  loadProjects: () => Promise<void>;
  sync: () => void;
}

type Step = 'connecting' | 'pick' | 'linked';

export default function TodoistConnectSheet({
  open,
  onOpenChange,
  linkedProjectId,
  onProjectLinked,
  onProjectUnlinked,
  status,
  isSyncing,
  projects,
  projectsLoading,
  connect,
  disconnect,
  loadProjects,
  sync,
}: Props) {
  const [step, setStep] = useState<Step>(
    linkedProjectId ? 'linked' : status.connected ? 'pick' : 'connecting'
  );
  const [selectedId, setSelectedId] = useState<string | null>(linkedProjectId || null);

  // Re-derive step from state
  useEffect(() => {
    if (linkedProjectId) setStep('linked');
    else if (status.connected) setStep('pick');
    else setStep('connecting');
  }, [status.connected, linkedProjectId]);

  // Load projects when sheet opens and account is connected
  useEffect(() => {
    if (open && status.connected) {
      loadProjects();
    }
  }, [open, status.connected]);

  // Auto-select inbox when projects load for the first time
  useEffect(() => {
    if (projects.length > 0 && !selectedId) {
      const inbox = projects.find((p) => p.is_inbox_project) || projects[0];
      setSelectedId(inbox.id);
    }
  }, [projects, selectedId]);

  // Listen for OAuth popup postMessage
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type !== 'todoist_oauth') return;
      if (e.data.status === 'connected') {
        loadProjects();
        setStep('pick');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [loadProjects]);

  const handleConfirm = () => {
    if (!selectedId) return;
    const project = projects.find((p) => p.id === selectedId);
    if (!project) return;
    // Just update the linked project — the parent's useTodoistIntegration
    // auto-sync will fire exactly once when todoistProjectId changes.
    onProjectLinked(project.id, project.name);
    onOpenChange(false);
  };

  const handleUnlink = () => {
    setSelectedId(null);
    onProjectUnlinked();
    setStep('pick');
    loadProjects();
  };

  const handleDisconnect = async () => {
    await disconnect();
    setSelectedId(null);
    setStep('connecting');
  };

  const linkedProject = projects.find((p) => p.id === linkedProjectId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[360px] sm:w-[400px] flex flex-col gap-0 p-0">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <SheetHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Todoist wordmark circle */}
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm"
              style={{ backgroundColor: TODOIST_RED }}
            >
              <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
                <path d="M4 8h24M4 16h16M4 24h20" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="min-w-0">
              <SheetTitle className="text-base leading-tight">Todoist</SheetTitle>
              <SheetDescription className="text-xs leading-tight mt-0.5">
                {step === 'connecting' && 'Connect to sync your tasks'}
                {step === 'pick' && `Connected as ${status.email}`}
                {step === 'linked' && `Syncing ${linkedProject?.name || '…'}`}
              </SheetDescription>
            </div>
            {step !== 'connecting' && (
              <span className="ml-auto flex items-center gap-1 text-xs text-green-500 font-medium flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                Connected
              </span>
            )}
          </div>
        </SheetHeader>

        <Separator className="flex-shrink-0" />

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* Step: not connected */}
          {step === 'connecting' && (
            <div className="flex flex-col items-center gap-5 py-8 text-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
                style={{ backgroundColor: TODOIST_RED }}
              >
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                  <path d="M4 8h24M4 16h16M4 24h20" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="max-w-[240px]">
                <p className="font-semibold text-sm">Sync with Todoist</p>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                  Pick any Todoist project and its tasks will appear right here. Changes sync both ways.
                </p>
              </div>
              <Button
                onClick={connect}
                className="gap-2 px-6"
                style={{ backgroundColor: TODOIST_RED, color: 'white' }}
              >
                <ExternalLink size={14} />
                Connect Todoist
              </Button>
              <p className="text-[11px] text-muted-foreground -mt-2">
                A small popup will open for sign-in, then close automatically.
              </p>
            </div>
          )}

          {/* Step: pick a project */}
          {step === 'pick' && (
            <>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Choose a project to sync
                </p>

                {projectsLoading ? (
                  <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground text-sm">
                    <Loader2 size={16} className="animate-spin" />
                    Loading your projects…
                  </div>
                ) : projects.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <p className="text-sm text-muted-foreground text-center">
                      No projects loaded yet.
                    </p>
                    <Button variant="outline" size="sm" className="gap-2" onClick={loadProjects}>
                      <RefreshCw size={13} />
                      Retry
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {projects.map((project) => {
                      const isSelected = project.id === selectedId;
                      return (
                        <button
                          key={project.id}
                          onClick={() => setSelectedId(project.id)}
                          className={cn(
                            'flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm text-left transition-all',
                            isSelected
                              ? 'bg-primary/10 ring-1 ring-primary/20'
                              : 'hover:bg-muted/60'
                          )}
                        >
                          {project.is_inbox_project
                            ? <Inbox size={15} className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
                            : <FolderOpen size={15} className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
                          }
                          <span className={cn('flex-1 truncate font-medium', isSelected ? 'text-primary' : '')}>
                            {project.name}
                          </span>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {project.taskCount !== undefined && project.taskCount > 0 && (
                              <span className="text-[11px] text-muted-foreground">
                                {project.taskCount} task{project.taskCount !== 1 ? 's' : ''}
                              </span>
                            )}
                            {project.is_inbox_project && (
                              <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Inbox</Badge>
                            )}
                            {isSelected && (
                              <CheckCircle2 size={14} style={{ color: TODOIST_RED }} />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {selectedId && (
                <Button
                  onClick={handleConfirm}
                  className="w-full gap-2"
                  style={{ backgroundColor: TODOIST_RED, color: 'white' }}
                >
                  Sync this project
                </Button>
              )}
            </>
          )}

          {/* Step: already linked */}
          {step === 'linked' && (
            <>
              {/* Linked project card */}
              <div className="rounded-xl bg-muted/50 p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  {linkedProject?.is_inbox_project
                    ? <Inbox size={15} style={{ color: TODOIST_RED }} />
                    : <FolderOpen size={15} style={{ color: TODOIST_RED }} />
                  }
                  <span className="font-semibold text-sm">{linkedProject?.name || '…'}</span>
                  <Badge variant="secondary" className="ml-auto text-[10px]">Synced</Badge>
                </div>
                {status.lastSyncedAt && (
                  <p className="text-xs text-muted-foreground">
                    Last synced {formatTimeAgo(status.lastSyncedAt)}
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 self-start"
                  onClick={() => sync()}
                  disabled={isSyncing}
                >
                  {isSyncing
                    ? <Loader2 size={12} className="animate-spin" />
                    : <RefreshCw size={12} />}
                  Sync now
                </Button>
              </div>

              {/* Switch project */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Switch project
                </p>
                {projectsLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground text-xs py-2">
                    <Loader2 size={12} className="animate-spin" /> Loading…
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {projects.length === 0 ? (
                      <Button variant="ghost" size="sm" onClick={loadProjects} className="text-xs gap-1.5 justify-start px-0">
                        <RefreshCw size={12} /> Load projects
                      </Button>
                    ) : (
                      projects.filter(p => p.id !== linkedProjectId).map((project) => (
                        <button
                          key={project.id}
                          onClick={() => {
                            setSelectedId(project.id);
                            onProjectLinked(project.id, project.name);
                            onOpenChange(false);
                          }}
                          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-left hover:bg-muted/60 transition-colors"
                        >
                          {project.is_inbox_project
                            ? <Inbox size={14} className="text-muted-foreground" />
                            : <FolderOpen size={14} className="text-muted-foreground" />
                          }
                          <span className="flex-1 truncate">{project.name}</span>
                          {project.taskCount !== undefined && project.taskCount > 0 && (
                            <span className="text-[11px] text-muted-foreground">{project.taskCount}</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Unlink / disconnect */}
              <div className="flex flex-col gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground hover:text-foreground justify-start px-0 w-fit"
                  onClick={handleUnlink}
                >
                  <Circle size={13} />
                  Unlink this module
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground hover:text-destructive justify-start px-0 w-fit"
                  onClick={handleDisconnect}
                >
                  <Unplug size={13} />
                  Disconnect Todoist account
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
