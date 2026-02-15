
import React, { ReactNode, useState } from 'react';
import { Minus, Edit, Check, Eye, EyeOff, AlertTriangle } from 'lucide-react';
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

interface ModuleContainerProps {
  title: string;
  children: ReactNode;
  onRemove?: () => void;
  onTitleChange?: (newTitle: string) => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
  isDragging?: boolean;
}

const ModuleContainer: React.FC<ModuleContainerProps> = ({ 
  title, 
  children, 
  onRemove,
  onTitleChange,
  onMinimize,
  isMinimized = false,
  isDragging = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(title);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleEditClick = () => {
    setEditTitle(title);
    setIsEditing(true);
  };

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

  return (
    <div className="bg-card/80 backdrop-blur-xl rounded-2xl border border-border/50 p-4 mb-4 shadow-sm dark:shadow-none transition-all">
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
          <h3 className="text-lg font-semibold text-primary">{title}</h3>
        )}
        <div className="flex gap-1">
          {onTitleChange && !isMinimized && (
            <button 
              onClick={handleEditClick}
              className="hover:bg-accent active:scale-95 p-1.5 rounded-lg transition-all text-gray-700 dark:text-gray-300 flex items-center justify-center"
              aria-label="Edit module title"
            >
              <Edit size={16} className="flex-shrink-0" />
            </button>
          )}
          {onMinimize && (
            <button 
              onClick={onMinimize}
              className="hover:bg-accent active:scale-95 p-1.5 rounded-lg transition-all flex items-center justify-center"
              aria-label={isMinimized ? "Show module" : "Hide module"}
            >
              {isMinimized ? (
                <Eye size={16} className="text-primary flex-shrink-0" />
              ) : (
                <EyeOff size={16} className="text-gray-700 dark:text-gray-300 flex-shrink-0" />
              )}
            </button>
          )}
          {onRemove && (
            <button 
              onClick={() => setShowDeleteDialog(true)}
              className="hover:bg-accent active:scale-95 p-1.5 rounded-lg transition-all text-gray-700 dark:text-gray-300 flex items-center justify-center"
              aria-label="Remove module"
            >
              <Minus size={16} className="flex-shrink-0" />
            </button>
          )}
        </div>
      </div>
      {!isMinimized && <div className="module-content">{children}</div>}
      
      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-background border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Module
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the "{title}" module? This action cannot be undone.
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
              Yes, Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ModuleContainer;
