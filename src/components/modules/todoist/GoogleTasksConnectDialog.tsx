/**
 * GoogleTasksConnectDialog
 *
 * Flow:
 * 1. Not connected → pick which Google account (from connected Google Calendar accounts)
 * 2. Account selected → trigger incremental OAuth for tasks scope (separate from calendar)
 * 3. After OAuth completes → list the Google Task lists from that account
 * 4. User picks a list → connect() fires → auto-sync runs → sheet closes
 * 5. Linked state → shows status, sync button, disconnect
 */

import React, { useEffect, useState, useCallback } from 'react';
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
  Check,
  Loader2,
  RefreshCw,
  ListTodo,
  Unplug,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { GoogleTaskList, GoogleTasksStatus } from '@/hooks/use-google-tasks';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/integrations/firebase/config';
import { toast } from 'sonner';

const functions = getFunctions(app, 'us-central1');
const callGetTasksAuthUrl = httpsCallable<{ origin: string; googleAccountId?: string }, { authUrl: string }>(
  functions, 'getGoogleTasksAuthUrl'
);

const GTASKS_BLUE = '#1a73e8';

type Step = 'pick-account' | 'authorize' | 'pick-list' | 'linked';

export interface ConnectedGoogleAccount {
  googleAccountId: string;
  email: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  linkedTaskListId?: string;
  onListLinked: (taskListId: string, taskListTitle: string) => void;
  onListUnlinked: () => void;
  // Passed from parent's useGoogleTasksIntegration
  status: GoogleTasksStatus;
  isSyncing: boolean;
  taskLists: GoogleTaskList[];
  taskListsLoading: boolean;
  googleAccounts: ConnectedGoogleAccount[];
  connect: (googleAccountId: string, taskListId: string, taskListTitle: string) => Promise<void>;
  disconnect: () => Promise<void>;
  loadTaskLists: (googleAccountId: string) => Promise<void>;
  sync: () => void;
}

export default function GoogleTasksConnectDialog({
  open, onOpenChange,
  linkedTaskListId, onListLinked, onListUnlinked,
  status, isSyncing, taskLists, taskListsLoading, googleAccounts,
  connect, disconnect, loadTaskLists, sync,
}: Props) {
  const [step, setStep] = useState<Step>(
    linkedTaskListId ? 'linked' : 'pick-account'
  );
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [selectedListId, setSelectedListId] = useState<string | null>(linkedTaskListId || null);
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  useEffect(() => {
    if (linkedTaskListId) setStep('linked');
    else setStep('pick-account');
  }, [linkedTaskListId]);

  // After OAuth popup closes, load task lists
  useEffect(() => {
    if (!open) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.source === 'malleabite-google-oauth' && event.data?.type === 'success') {
        // Popup confirmed tasks scope granted — now load the task lists
        if (selectedAccountId) {
          loadTaskLists(selectedAccountId).then(() => setStep('pick-list'));
        }
        setIsAuthorizing(false);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [open, selectedAccountId, loadTaskLists]);

  const handleSelectAccount = async (googleAccountId: string) => {
    setSelectedAccountId(googleAccountId);
    setStep('authorize');
  };

  const handleAuthorize = useCallback(async () => {
    setIsAuthorizing(true);
    try {
      const res = await callGetTasksAuthUrl({
        origin: window.location.origin,
        googleAccountId: selectedAccountId,
      });
      const popup = window.open(res.data.authUrl, 'google_tasks_oauth', 'width=560,height=680,left=200,top=100');
      if (!popup) {
        // Fallback: redirect
        window.location.href = res.data.authUrl;
      }
    } catch (err: any) {
      toast.error('Failed to start Google Tasks authorization: ' + (err?.message || 'Unknown error'));
      setIsAuthorizing(false);
    }
  }, [selectedAccountId]);

  const handleSelectList = async (taskListId: string, taskListTitle: string) => {
    setSelectedListId(taskListId);
    await connect(selectedAccountId, taskListId, taskListTitle);
    onListLinked(taskListId, taskListTitle);
    setStep('linked');
  };

  const handleDisconnect = async () => {
    await disconnect();
    onListUnlinked();
    setSelectedAccountId('');
    setSelectedListId(null);
    setStep('pick-account');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span
              className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${GTASKS_BLUE}20` }}
            >
              <ListTodo size={14} style={{ color: GTASKS_BLUE }} />
            </span>
            Google Tasks
          </DialogTitle>
          <DialogDescription>
            {step === 'linked'
              ? `Synced with "${status.taskListTitle}"`
              : 'Sync this list with a Google Tasks list.'}
          </DialogDescription>
        </DialogHeader>

        {/* ── Pick account ── */}
        {step === 'pick-account' && (
          <div className="space-y-3 py-1">
            {googleAccounts.length === 0 ? (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-sm">
                <AlertTriangle size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-amber-800 dark:text-amber-300 text-[13px]">
                  No Google accounts connected. Connect one via the Calendar panel first, then come back here.
                </p>
              </div>
            ) : (
              <>
                <p className="text-[13px] text-muted-foreground">Select the Google account to use:</p>
                <div className="space-y-1.5">
                  {googleAccounts.map(account => (
                    <button
                      key={account.googleAccountId}
                      onClick={() => handleSelectAccount(account.googleAccountId)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl border border-border/60',
                        'hover:border-primary/30 hover:bg-primary/[0.02] dark:hover:bg-primary/[0.04]',
                        'transition-all text-left'
                      )}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0"
                        style={{ backgroundColor: GTASKS_BLUE }}
                      >
                        {account.email[0].toUpperCase()}
                      </div>
                      <span className="text-sm font-medium truncate">{account.email}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Authorize tasks scope ── */}
        {step === 'authorize' && (
          <div className="space-y-4 py-1">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/40">
              <AlertTriangle size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-[13px] text-blue-800 dark:text-blue-300">
                Google Tasks requires a separate permission. A consent screen will open — just approve it and this dialog will continue automatically.
              </p>
            </div>
            <Button
              onClick={handleAuthorize}
              disabled={isAuthorizing}
              className="w-full gap-2"
            >
              {isAuthorizing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ExternalLink size={14} />
              )}
              {isAuthorizing ? 'Waiting for authorization…' : 'Authorize Google Tasks'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-muted-foreground"
              onClick={() => setStep('pick-account')}
              disabled={isAuthorizing}
            >
              ← Back
            </Button>
          </div>
        )}

        {/* ── Pick task list ── */}
        {step === 'pick-list' && (
          <div className="space-y-3 py-1">
            {taskListsLoading ? (
              <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
                <Loader2 size={16} className="animate-spin" />
                Loading task lists…
              </div>
            ) : taskLists.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No task lists found.</p>
            ) : (
              <>
                <p className="text-[13px] text-muted-foreground">Select a task list to sync:</p>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {taskLists.map(list => (
                    <button
                      key={list.id}
                      onClick={() => handleSelectList(list.id, list.title)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl border border-border/60',
                        selectedListId === list.id
                          ? 'border-primary/40 bg-primary/[0.04]'
                          : 'hover:border-primary/30 hover:bg-primary/[0.02]',
                        'transition-all text-left'
                      )}
                    >
                      <ListTodo size={16} className="text-muted-foreground flex-shrink-0" />
                      <span className="text-sm font-medium flex-1 truncate">{list.title}</span>
                      {selectedListId === list.id && (
                        <Check size={14} className="text-primary flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => setStep('pick-account')}
                >
                  ← Back
                </Button>
              </>
            )}
          </div>
        )}

        {/* ── Linked state ── */}
        {step === 'linked' && (
          <div className="space-y-4 py-1">
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-secondary/30">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${GTASKS_BLUE}20` }}
              >
                <ListTodo size={16} style={{ color: GTASKS_BLUE }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">{status.taskListTitle || 'Google Tasks'}</div>
                <div className="text-[11px] text-muted-foreground truncate">{status.email}</div>
              </div>
              <Badge variant="secondary" className="text-[10px] px-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 inline-block" />
                Linked
              </Badge>
            </div>

            {status.lastSyncedAt && (
              <p className="text-[11px] text-muted-foreground text-center">
                Last synced {new Date(status.lastSyncedAt).toLocaleString()}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => sync()}
                disabled={isSyncing}
                className="flex-1 gap-1.5"
              >
                {isSyncing ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <RefreshCw size={13} />
                )}
                {isSyncing ? 'Syncing…' : 'Sync now'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                className="gap-1.5 text-destructive hover:text-destructive"
              >
                <Unplug size={13} />
                Disconnect
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
