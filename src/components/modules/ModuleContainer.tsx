
import React, { ReactNode, useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronRight, Layers, MoreVertical, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { SizeLevel } from '@/lib/stores/types';
import { useModuleSize } from '@/contexts/ModuleSizeContext';
import ModuleSizePill from './ModuleSizePill';

interface MoveTarget {
  id: string;
  title: string;
}

interface ModuleContainerProps {
  title: string;
  children: ReactNode;
  onRemove?: () => void;
  onTitleChange?: (newTitle: string) => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
  isDragging?: boolean;
  moveTargets?: MoveTarget[];
  onMoveToPage?: (pageId: string) => void;
  onShare?: () => void;
  isReadOnly?: boolean;
  sizeLevel?: SizeLevel;
  onSizeChange?: (level: SizeLevel) => void;
  // Task sync integrations (Todoist + Microsoft Tasks + Google Tasks)
  onConnectTodoist?: () => void;
  todoistLinked?: boolean;
  todoistSyncing?: boolean;
  onSyncTodoist?: () => void;
  msTasksLinked?: boolean;
  msTasksSyncing?: boolean;
  onSyncMsTasks?: () => void;
  googleTasksLinked?: boolean;
  googleTasksSyncing?: boolean;
  onSyncGoogleTasks?: () => void;
}

const ModuleContainer: React.FC<ModuleContainerProps> = ({
  title,
  children,
  onRemove,
  onTitleChange,
  onMinimize,
  isMinimized = false,
  moveTargets = [],
  onMoveToPage,
  onShare,
  isReadOnly = false,
  sizeLevel,
  onSizeChange,
  onConnectTodoist,
  todoistLinked = false,
  todoistSyncing = false,
  onSyncTodoist,
  msTasksLinked = false,
  msTasksSyncing = false,
  onSyncMsTasks,
  googleTasksLinked = false,
  googleTasksSyncing = false,
  onSyncGoogleTasks,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSizePillOpen, setIsSizePillOpen] = useState(false);
  const moduleRef = useRef<HTMLDivElement>(null);
  const sizeButtonRef = useRef<HTMLButtonElement>(null);

  // Context provides sizeLevel + onSizeChange; props override context if explicitly passed
  const ctx = useModuleSize();
  const effectiveSizeLevel: SizeLevel = sizeLevel ?? ctx.sizeLevel ?? (isMinimized ? 0 : 1);
  const effectiveOnSizeChange = onSizeChange ?? ctx.onSizeChange;
  const isCollapsed = effectiveSizeLevel === 0;

  const handleSaveTitle = () => {
    if (editTitle.trim() && onTitleChange) {
      onTitleChange(editTitle.trim());
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditTitle(title);
    }
  };

  const startRename = () => {
    setEditTitle(title);
    setIsEditing(true);
  };

  const handleSizeChange = (level: SizeLevel) => {
    setIsSizePillOpen(false);
    if (effectiveOnSizeChange) {
      effectiveOnSizeChange(level);
    } else if (onMinimize && level === 0) {
      onMinimize();
    }
  };

  // Close pill on outside click
  useEffect(() => {
    if (!isSizePillOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (sizeButtonRef.current && sizeButtonRef.current.contains(e.target as Node)) return;
      setIsSizePillOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isSizePillOpen]);

  // Close pill if we enter expanded mode externally (e.g. nav strip buttons)
  useEffect(() => {
    if (effectiveSizeLevel >= 2) setIsSizePillOpen(false);
  }, [effectiveSizeLevel]);

  // Single click: toggle pill open/close
  const handleSizeButtonClick = () => {
    setIsSizePillOpen((prev) => !prev);
  };

  // Double click: cycle through levels 0→1→2→3→0
  const handleSizeButtonDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsSizePillOpen(false);
    const nextLevel = ((effectiveSizeLevel + 1) % 4) as SizeLevel;
    handleSizeChange(nextLevel);
  };

  return (
    <div
      ref={moduleRef}
      className={cn(
        "transition-all group/module",
        effectiveSizeLevel < 2
          ? "bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 p-4 mb-4 shadow-sm dark:shadow-none"
          : "flex flex-col h-full"
      )}
    >
      <div className="module-header flex justify-between items-center mb-3">
        {isEditing ? (
          <div className="flex items-center gap-2 flex-1">
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 text-lg font-semibold bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-white"
              autoFocus
            />
            <button
              onClick={handleSaveTitle}
              className="hover:bg-accent active:scale-95 p-1.5 rounded-lg transition-all flex items-center justify-center"
            >
              <Check size={16} className="text-primary flex-shrink-0" />
            </button>
          </div>
        ) : (
          // Title area — only the text span is clickable for rename
          <div className="flex-1 min-w-0 flex items-center gap-1.5">
            <span
              className="text-lg font-semibold text-primary truncate cursor-pointer hover:opacity-70 transition-opacity module-rename-trigger"
              onClick={onTitleChange ? startRename : undefined}
              title={onTitleChange ? 'Click to rename' : undefined}
            >
              {title}
            </span>
            {todoistLinked && (
              <span
                title={todoistSyncing ? 'Syncing with Todoist…' : 'Synced with Todoist'}
                className="flex-shrink-0"
              >
                <Zap
                  size={11}
                  className={todoistSyncing ? 'animate-pulse' : ''}
                  style={{ color: '#db4035' }}
                />
              </span>
            )}
            {msTasksLinked && (
              <span
                title={msTasksSyncing ? 'Syncing with Microsoft Tasks…' : 'Synced with Microsoft Tasks'}
                className="flex-shrink-0"
              >
                <Zap
                  size={11}
                  className={msTasksSyncing ? 'animate-pulse' : ''}
                  style={{ color: '#0078d4' }}
                />
              </span>
            )}
            {googleTasksLinked && (
              <span
                title={googleTasksSyncing ? 'Syncing with Google Tasks…' : 'Synced with Google Tasks'}
                className="flex-shrink-0"
              >
                <Zap
                  size={11}
                  className={googleTasksSyncing ? 'animate-pulse' : ''}
                  style={{ color: '#1a73e8' }}
                />
              </span>
            )}
          </div>
        )}

        {!isEditing && !isReadOnly && (
          <div className="flex items-center gap-0.5 opacity-0 [transition-delay:200ms] group-hover/module:opacity-100 group-hover/module:[transition-delay:0ms] transition-opacity duration-150">
            {/* Size level button — hidden in expanded mode (nav strip handles it) */}
            {effectiveOnSizeChange && effectiveSizeLevel < 2 && (
              <div>
                <button
                  ref={sizeButtonRef}
                  onClick={handleSizeButtonClick}
                  onDoubleClick={handleSizeButtonDoubleClick}
                  className="hover:bg-accent active:scale-95 p-1.5 rounded-lg transition-all text-gray-700 dark:text-gray-300 flex items-center justify-center flex-shrink-0"
                  aria-label="Resize module"
                >
                  <Layers size={15} className="flex-shrink-0" />
                </button>

                <AnimatePresence>
                  {isSizePillOpen && (
                    <ModuleSizePill
                      currentLevel={effectiveSizeLevel}
                      onChangeLevel={handleSizeChange}
                      buttonRef={sizeButtonRef}
                    />
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Kebab menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="hover:bg-accent active:scale-95 p-1.5 rounded-lg transition-all text-gray-700 dark:text-gray-300 flex items-center justify-center flex-shrink-0"
                  aria-label="Module options"
                >
                  <MoreVertical size={16} className="flex-shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {onTitleChange && (
                  <DropdownMenuItem onSelect={startRename}>
                    Rename
                  </DropdownMenuItem>
                )}
                {(effectiveOnSizeChange || onMinimize) && (
                  <DropdownMenuItem onSelect={() => handleSizeChange(isCollapsed ? 1 : 0)}>
                    {isCollapsed ? 'Expand' : 'Collapse'}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {moveTargets.length > 0 && onMoveToPage && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <span>Transfer to page</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent>
                        {moveTargets.map((target) => (
                          <DropdownMenuItem
                            key={target.id}
                            onSelect={() => onMoveToPage(target.id)}
                          >
                            {target.title}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                )}
                {onShare && (
                  <DropdownMenuItem onSelect={onShare}>
                    Share / Manage Access
                  </DropdownMenuItem>
                )}
                {onConnectTodoist && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setTimeout(() => onConnectTodoist(), 0)}
                      className="gap-2 justify-between"
                    >
                      <span className="flex items-center gap-2">
                        <Zap
                          size={13}
                          style={{
                            color: todoistLinked ? '#db4035'
                              : msTasksLinked ? '#0078d4'
                              : googleTasksLinked ? '#1a73e8'
                              : undefined
                          }}
                          className={!todoistLinked && !msTasksLinked && !googleTasksLinked ? 'text-muted-foreground' : ''}
                        />
                        {todoistLinked ? 'Todoist settings'
                          : msTasksLinked ? 'Microsoft Tasks settings'
                          : googleTasksLinked ? 'Google Tasks settings'
                          : 'Sync tasks'}
                      </span>
                      {!todoistLinked && !msTasksLinked && !googleTasksLinked && (
                        <ChevronRight size={13} className="text-muted-foreground" />
                      )}
                    </DropdownMenuItem>
                    {todoistLinked && onSyncTodoist && (
                      <DropdownMenuItem onSelect={onSyncTodoist} className="gap-2" disabled={todoistSyncing}>
                        <Zap size={13} className="text-muted-foreground" />
                        {todoistSyncing ? 'Syncing…' : 'Sync now'}
                      </DropdownMenuItem>
                    )}
                    {msTasksLinked && onSyncMsTasks && (
                      <DropdownMenuItem onSelect={onSyncMsTasks} className="gap-2" disabled={msTasksSyncing}>
                        <Zap size={13} className="text-muted-foreground" />
                        {msTasksSyncing ? 'Syncing…' : 'Sync now'}
                      </DropdownMenuItem>
                    )}
                    {googleTasksLinked && onSyncGoogleTasks && (
                      <DropdownMenuItem onSelect={onSyncGoogleTasks} className="gap-2" disabled={googleTasksSyncing}>
                        <Zap size={13} className="text-muted-foreground" />
                        {googleTasksSyncing ? 'Syncing…' : 'Sync now'}
                      </DropdownMenuItem>
                    )}
                  </>
                )}
                <DropdownMenuSeparator />
                {onRemove && (
                  <DropdownMenuItem
                    onSelect={() => setShowDeleteDialog(true)}
                    className="text-destructive focus:text-destructive"
                  >
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            className={cn(
              "module-content",
              effectiveSizeLevel >= 2 && "flex-1 flex flex-col min-h-0"
            )}
            initial={{ opacity: 0, height: effectiveSizeLevel >= 2 ? undefined : 0 }}
            animate={{ opacity: 1, height: effectiveSizeLevel >= 2 ? undefined : 'auto' }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-background border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Module</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{title}"? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowDeleteDialog(false);
                if (onRemove) onRemove();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ModuleContainer;
