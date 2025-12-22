
import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface NewPageCreatorProps {
  onCreatePage: (title: string) => void;
}

const NewPageCreator: React.FC<NewPageCreatorProps> = ({ onCreatePage }) => {
  const [showNewPageInput, setShowNewPageInput] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');

  const handleCreateNewPage = () => {
    if (newPageTitle.trim()) {
      onCreatePage(newPageTitle);
      setNewPageTitle('');
      setShowNewPageInput(false);
    }
  };

  return (
    <>
      {showNewPageInput ? (
        <div className="glass-card p-4 relative mt-4 max-w-md mx-auto bg-purple-100 dark:bg-purple-800/20">
          <button 
            onClick={() => setShowNewPageInput(false)}
            className="absolute top-2 right-2 text-gray-500 dark:text-muted-foreground hover:text-purple-600 dark:hover:text-purple-300"
          >
            <X size={16} />
          </button>
          <h3 className="text-lg font-semibold mb-3 text-purple-700 dark:text-purple-300">Create New Page</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={newPageTitle}
              onChange={(e) => setNewPageTitle(e.target.value)}
              className="glass-input w-full bg-white dark:bg-black/20 text-gray-800 dark:text-white placeholder-gray-400"
              placeholder="Page title..."
              autoFocus
            />
            <button
              onClick={handleCreateNewPage}
              disabled={!newPageTitle.trim()}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded-md transition-colors disabled:opacity-50"
            >
              Create
            </button>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setShowNewPageInput(true)}
          className="flex items-center justify-center w-full p-2 mt-4 bg-white dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-xl text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-600/30 transition-all max-w-md mx-auto shadow-sm"
        >
          <Plus size={16} className="mr-2" />
          <span>New Page</span>
        </button>
      )}
    </>
  );
};

export default NewPageCreator;
