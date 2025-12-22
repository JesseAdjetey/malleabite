
import React, { ReactNode, useState } from 'react';
import { Minus, Edit, Check, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';

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
    <div className="module-container bg-white/90 dark:bg-white/5 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-white/10 p-4 mb-4 gradient-border cursor-glow shadow-sm dark:shadow-none">
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
              className="hover:bg-gray-200 dark:hover:bg-white/10 p-1 rounded-full transition-all"
            >
              <Check size={16} className="text-primary" />
            </button>
          </div>
        ) : (
          <h3 className="text-lg font-semibold text-primary">{title}</h3>
        )}
        <div className="flex gap-1">
          {onTitleChange && !isMinimized && (
            <button 
              onClick={handleEditClick}
              className="hover:bg-gray-200 dark:hover:bg-white/10 p-1 rounded-full transition-all text-gray-600 dark:text-white"
              aria-label="Edit module title"
            >
              <Edit size={16} />
            </button>
          )}
          {onMinimize && (
            <button 
              onClick={onMinimize}
              className="hover:bg-gray-200 dark:hover:bg-white/10 p-1 rounded-full transition-all"
              aria-label={isMinimized ? "Show module" : "Hide module"}
            >
              {isMinimized ? (
                <Eye size={16} className="text-primary" />
              ) : (
                <EyeOff size={16} className="text-gray-500 dark:text-muted-foreground" />
              )}
            </button>
          )}
          {onRemove && (
            <button 
              onClick={onRemove}
              className="hover:bg-gray-200 dark:hover:bg-white/10 p-1 rounded-full transition-all text-gray-600 dark:text-white"
              aria-label="Remove module"
            >
              <Minus size={16} />
            </button>
          )}
        </div>
      </div>
      {!isMinimized && <div className="module-content">{children}</div>}
    </div>
  );
};

export default ModuleContainer;
