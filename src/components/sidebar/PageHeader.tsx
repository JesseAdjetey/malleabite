
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Edit2, Check } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  onUpdateTitle: (newTitle: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  canGoToPrevPage: boolean;
  canGoToNextPage: boolean;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  onUpdateTitle,
  onPrevPage,
  onNextPage,
  canGoToPrevPage,
  canGoToNextPage
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
    <div className="p-3 flex items-center justify-between border-b light-mode:border-gray-400 dark-mode:border-white/10 light-mode:bg-gray-100 dark-mode:bg-black/30">
      <button
        onClick={onPrevPage}
        disabled={!canGoToPrevPage}
        className="p-1 rounded-full hover:bg-purple-500/20 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="flex items-center">
        {isEditingTitle ? (
          <div className="flex items-center">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="glass-input text-lg font-semibold dark:bg-black/20 light:bg-white border-b border-purple-400 px-2 py-1 outline-none"
              autoFocus
            />
            <button
              onClick={handleSaveTitle}
              className="p-1 ml-1 rounded-full hover:bg-purple-500/20"
            >
              <Check size={16} className="text-purple-300" />
            </button>
          </div>
        ) : (
          <div className="flex items-center">
            <h1 className="text-lg font-semibold light-mode:text-purple-800 dark-mode:text-purple-200">{title}</h1>
            <button
              onClick={handleEditTitle}
              className="p-1 ml-1 rounded-full hover:bg-purple-500/20"
            >
              <Edit2 size={14} />
            </button>
          </div>
        )}
      </div>

      <button
        onClick={onNextPage}
        disabled={!canGoToNextPage}
        className="p-1 rounded-full hover:bg-purple-500/20 disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
};

export default PageHeader;
