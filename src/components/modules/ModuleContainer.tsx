
import React, { ReactNode, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Layers, MoreVertical } from 'lucide-react';
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
import { SizeLevel } from '@/lib/stores/types';
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
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSizePillOpen, setIsSizePillOpen] = useState(false);
  const moduleRef = useRef<HTMLDivElement>(null);

  // Derive the effective size level (backwards compat with minimized flag)
  const effectiveSizeLevel: SizeLevel = sizeLevel ?? (isMinimized ? 0 : 1);
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
    if (onSizeChange) {
      onSizeChange(level);
    } else if (onMinimize && level === 0) {
      // Fallback to legacy minimize
      onMinimize();
    }
  };

  return (
    <div
      ref={moduleRef}
      className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 p-4 mb-4 shadow-sm dark:shadow-none transition-all group/module"
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
          <div className="flex-1 min-w-0 flex items-center">
            <span
              className="text-lg font-semibold text-primary truncate cursor-pointer hover:opacity-70 transition-opacity module-rename-trigger"
              onClick={onTitleChange ? startRename : undefined}
              title={onTitleChange ? 'Click to rename' : undefined}
            >
              {title}
            </span>
          </div>
        )}

        {!isEditing && !isReadOnly && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover/module:opacity-100 transition-opacity">
            {/* Size level button */}
            {onSizeChange && (
              <div
                className="relative"
                onMouseEnter={() => setIsSizePillOpen(true)}
                onMouseLeave={() => setIsSizePillOpen(false)}
              >
                <button
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
                      moduleRef={moduleRef}
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
                {(onSizeChange || onMinimize) && (
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
            className="module-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
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
