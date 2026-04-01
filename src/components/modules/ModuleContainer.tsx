
import React, { ReactNode, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, MoreVertical } from 'lucide-react';
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
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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

  return (
    <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 p-4 mb-4 shadow-sm dark:shadow-none transition-all group/module">
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
          <h3
            className="text-lg font-semibold text-primary flex-1 min-w-0 truncate cursor-pointer hover:opacity-70 transition-opacity"
            onClick={onTitleChange ? startRename : undefined}
            title={onTitleChange ? "Click to rename" : undefined}
          >{title}</h3>
        )}

        {!isEditing && !isReadOnly && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="opacity-0 group-hover/module:opacity-100 hover:bg-accent active:scale-95 p-1.5 rounded-lg transition-all text-gray-700 dark:text-gray-300 flex items-center justify-center flex-shrink-0 ml-1"
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
              {onMinimize && (
                <DropdownMenuItem onSelect={onMinimize}>
                  {isMinimized ? 'Expand' : 'Minimize'}
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
        )}
      </div>

      <AnimatePresence initial={false}>
        {!isMinimized && (
          <motion.div
            className="module-content"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{ overflow: 'hidden' }}
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
