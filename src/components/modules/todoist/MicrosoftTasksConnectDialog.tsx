import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
  ListTodo,
  Star,
  AlertTriangle,
  Unplug,
} from 'lucide-react';
import { MicrosoftStatus, MsTaskList } from '@/hooks/use-microsoft-integration';

const MS_BLUE = '#0078d4';

type Step = 'connect' | 'pick' | 'linked';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkedListId?: string;
  onListLinked: (listId: string, listName: string) => void;
  onListUnlinked: () => void;
  status: MicrosoftStatus;
  isSyncing: boolean;
  taskLists: MsTaskList[];
  taskListsLoading: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  loadTaskLists: () => Promise<void>;
  syncTasks: () => void;
}

export default function MicrosoftTasksConnectDialog({
  open, onOpenChange, linkedListId, onListLinked, onListUnlinked,
  status, isSyncing, taskLists, taskListsLoading, connect, disconnect, loadTaskLists, syncTasks,
}: Props) {
  const [step, setStep] = useState<Step>(
    linkedListId ? 'linked' : status.connected ? 'pick' : 'connect'
  );
  const [selectedId, setSelectedId] = useState<string | null>(linkedListId || null);

  useEffect(() => {
    if (linkedListId) setStep('linked');
    else if (status.connected) setStep('pick');
    else setStep('connect');
  }, [status.connected, linkedListId]);

  useEffect(() => {
    if (open && status.connected && step !== 'linked') loadTaskLists();
  }, [open, status.connected]);

  useEffect(() => {
    if (taskLists.length > 0 && !selectedId) {
      const def = taskLists.find((l) => l.wellknownListName === 'defaultList') || taskLists[0];
      setSelectedId(def.id);
    }
  }, [taskLists, selectedId]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type !== 'microsoft_oauth' || e.data.status !== 'connected') return;
      loadTaskLists();
      setStep('pick');
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [loadTaskLists]);

  const handleConfirm = () => {
    if (!selectedId) return;
    const list = taskLists.find((l) => l.id === selectedId);
    if (!list) return;
    onListLinked(list.id, list.displayName);
    onOpenChange(false);
  };

  const linkedList = taskLists.find((l) => l.id === linkedListId);

  const stepTitles: Record<Step, string> = {
    connect: 'Connect Microsoft Tasks',
    pick: 'Choose a list',
    linked: 'Microsoft Tasks',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${MS_BLUE}20` }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke={MS_BLUE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            {stepTitles[step]}
          </DialogTitle>
          <DialogDescription>
            {step === 'connect' && 'Sign in to sync your Microsoft To Do tasks.'}
            {step === 'pick' && `Connected as ${status.email} — choose a list to sync.`}
            {step === 'linked' && `Syncing "${linkedList?.displayName || '…'}" with this module.`}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 min-h-[160px]">

          {/* needs reauth */}
          {status.tokenStatus === 'needs_reauth' && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-orange-500/10 text-orange-600 text-xs mb-3">
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
              Your Microsoft session expired. Reconnect to restore sync.
            </div>
          )}

          {/* Step: connect */}
          {step === 'connect' && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: `${MS_BLUE}15` }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke={MS_BLUE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold">Microsoft To Do</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-[220px] mx-auto">
                  Pick any list and its tasks will appear here. Changes sync both ways.
                </p>
              </div>
              <Button onClick={connect} className="gap-2 px-5" style={{ backgroundColor: MS_BLUE, color: 'white' }}>
                <ExternalLink size={14} />
                Sign in with Microsoft
              </Button>
              <p className="text-[11px] text-muted-foreground -mt-1">
                A popup will open and close automatically.
              </p>
            </div>
          )}

          {/* Step: pick */}
          {step === 'pick' && (
            <div className="space-y-3">
              {taskListsLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
                  <Loader2 size={15} className="animate-spin" /> Loading lists…
                </div>
              ) : taskLists.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <p className="text-sm text-muted-foreground">No lists found.</p>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={loadTaskLists}>
                    <RefreshCw size={13} /> Retry
                  </Button>
                </div>
              ) : (
                <div className="space-y-1 max-h-52 overflow-y-auto">
                  {taskLists.map((list) => {
                    const isSelected = list.id === selectedId;
                    const isDefault = list.wellknownListName === 'defaultList';
                    return (
                      <motion.button
                        key={list.id}
                        whileHover={{ scale: 1.005 }}
                        whileTap={{ scale: 0.995 }}
                        onClick={() => setSelectedId(list.id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm text-left transition-all',
                          isSelected
                            ? 'border-primary/30 bg-primary/[0.04]'
                            : 'border-transparent hover:border-border hover:bg-muted/40'
                        )}
                      >
                        {list.wellknownListName === 'flaggedEmails'
                          ? <Star size={14} style={{ color: isSelected ? MS_BLUE : undefined }} className={!isSelected ? 'text-muted-foreground' : ''} />
                          : <ListTodo size={14} style={{ color: isSelected ? MS_BLUE : undefined }} className={!isSelected ? 'text-muted-foreground' : ''} />
                        }
                        <span className={cn('flex-1 truncate font-medium', isSelected && 'text-primary')}>
                          {list.displayName}
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {list.taskCount != null && list.taskCount > 0 && (
                            <span className="text-[11px] text-muted-foreground">{list.taskCount}</span>
                          )}
                          {isDefault && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Tasks</Badge>}
                          {isSelected && <Check size={13} style={{ color: MS_BLUE }} />}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {selectedId && (
                <Button onClick={handleConfirm} className="w-full gap-2" style={{ backgroundColor: MS_BLUE, color: 'white' }}>
                  Sync this list
                </Button>
              )}
            </div>
          )}

          {/* Step: linked */}
          {step === 'linked' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-muted/30">
                <ListTodo size={15} style={{ color: MS_BLUE }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{linkedList?.displayName || '…'}</p>
                  {status.lastTaskSyncAt && (
                    <p className="text-[11px] text-muted-foreground">
                      Last synced {formatTimeAgo(status.lastTaskSyncAt)}
                    </p>
                  )}
                </div>
                <Badge variant="secondary" className="text-[10px] flex-shrink-0">Synced</Badge>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 flex-1"
                  onClick={syncTasks}
                  disabled={isSyncing}
                >
                  {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Sync now
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 flex-1"
                  onClick={() => { loadTaskLists(); setStep('pick'); }}
                >
                  <ArrowLeft size={12} />
                  Switch list
                </Button>
              </div>

              <div className="pt-1 border-t space-y-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground h-8 text-xs"
                  onClick={() => { onListUnlinked(); setStep('pick'); loadTaskLists(); }}
                >
                  Unlink this module
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive h-8 text-xs"
                  onClick={async () => { await disconnect(); setStep('connect'); }}
                >
                  <Unplug size={12} />
                  Disconnect Microsoft account
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
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
