import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Edit2, Check, Trash2, Users } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  onUpdateTitle: (newTitle: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onDeletePage?: () => void;
  canGoToPrevPage: boolean;
  canGoToNextPage: boolean;
  canDeletePage?: boolean;
  onShare?: () => void;
  isSharedPage?: boolean;
  sharedOwnerName?: string;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  onUpdateTitle,
  onPrevPage,
  onNextPage,
  onDeletePage,
  canGoToPrevPage,
  canGoToNextPage,
  canDeletePage = true,
  onShare,
  isSharedPage = false,
  sharedOwnerName,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [newTitle, setNewTitle] = useState(title);

  const handleEditTitle = () => {
    setIsEditingTitle(true);
    setNewTitle(title);
  };

  const handleSaveTitle = () => {
    if (newTitle.trim()) {
      onUpdateTitle(newTitle);
    }
    setIsEditingTitle(false);
  };

  return (
    <div className="p-4 flex items-center justify-center">
      <div className="flex items-center">
        {isEditingTitle ? (
          <div className="flex items-center">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="glass-input text-lg font-semibold bg-white dark:bg-black/20 text-gray-800 dark:text-white border-b border-purple-400 px-2 py-1 outline-none"
              autoFocus
            />
            <button
              onClick={handleSaveTitle}
              className="p-1 ml-1 rounded-full hover:bg-purple-500/20"
            >
              <Check size={16} className="text-purple-600 dark:text-purple-300" />
            </button>
          </div>
        ) : (
          <div className="flex items-center text-center gap-2">
            <button
              onClick={onPrevPage}
              disabled={!canGoToPrevPage}
              className={`p-1 rounded-full text-gray-400 dark:text-gray-500 hover:bg-purple-500/10 transition-colors ${!canGoToPrevPage ? 'opacity-20 cursor-not-allowed' : ''}`}
            >
              <ChevronLeft size={18} />
            </button>

            <div className="flex flex-col items-center">
              <h1 className="text-xl font-semibold text-purple-800 dark:text-purple-200">{title}</h1>
              {isSharedPage && sharedOwnerName && (
                <span className="text-xs text-muted-foreground leading-none">
                  by {sharedOwnerName}
                </span>
              )}
            </div>

            <button
              onClick={onNextPage}
              disabled={!canGoToNextPage}
              className={`p-1 rounded-full text-gray-400 dark:text-gray-500 hover:bg-purple-500/10 transition-colors ${!canGoToNextPage ? 'opacity-20 cursor-not-allowed' : ''}`}
            >
              <ChevronRight size={18} />
            </button>

            {!isSharedPage && (
              <button
                onClick={handleEditTitle}
                className="p-1 ml-1 rounded-full text-gray-600 dark:text-white hover:bg-purple-500/20 opacity-40 hover:opacity-100 transition-opacity"
              >
                <Edit2 size={14} />
              </button>
            )}
            {canDeletePage && onDeletePage && (
              <button
                onClick={() => {
                  const msg = isSharedPage
                    ? 'Remove this shared page from your sidebar?'
                    : 'Are you sure you want to delete this page?';
                  if (confirm(msg)) onDeletePage();
                }}
                className="p-1 ml-1 rounded-full text-gray-600 dark:text-white hover:bg-red-500/20 hover:text-red-500 opacity-40 hover:opacity-100 transition-opacity"
                title={isSharedPage ? 'Remove from sidebar' : 'Delete page'}
              >
                <Trash2 size={14} />
              </button>
            )}
            {!isSharedPage && onShare && (
              <button
                onClick={onShare}
                className="p-1 ml-1 rounded-full text-gray-600 dark:text-white hover:bg-purple-500/20 opacity-40 hover:opacity-100 transition-opacity"
                title="Share page"
              >
                <Users size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHeader;
