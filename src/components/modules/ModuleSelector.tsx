
import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

import { ModuleType } from '@/lib/store';

interface ModuleSelectorProps {
  onSelect: (moduleType: ModuleType) => void;
}

const ModuleSelector: React.FC<ModuleSelectorProps> = ({ onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (type: ModuleType) => {
    onSelect(type);
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-center w-full p-1.5 bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/10 rounded-lg mb-3 text-primary hover:bg-primary/20 transition-all"
      >
        <Plus size={20} className="mr-2" />
        <span>Add Module</span>
      </button>
    );
  }

  return (
    <div className="glass-card p-4 mb-4 relative">
      <button
        onClick={() => setIsOpen(false)}
        className="absolute top-2 right-2 text-gray-500 dark:text-muted-foreground hover:text-primary"
      >
        <X size={16} />
      </button>
      <h3 className="text-lg font-semibold mb-3 text-primary">Select a Module</h3>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleSelect('todo')}
          className="bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-white p-2 rounded-lg hover:bg-primary/20 transition-all"
        >
          Todo List
        </button>
        <button
          onClick={() => handleSelect('pomodoro')}
          className="bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-white p-2 rounded-lg hover:bg-primary/20 transition-all"
        >
          Pomodoro Timer
        </button>
        <button
          onClick={() => handleSelect('alarms')}
          className="bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-white p-2 rounded-lg hover:bg-primary/20 transition-all"
        >
          Alarms
        </button>
        <button
          onClick={() => handleSelect('eisenhower')}
          className="bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-white p-2 rounded-lg hover:bg-primary/20 transition-all"
        >
          Eisenhower Matrix
        </button>
        <button
          onClick={() => handleSelect('invites')}
          className="bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-white p-2 rounded-lg hover:bg-primary/20 transition-all"
        >
          Event Invites
        </button>
        <button
          onClick={() => handleSelect('templates')}
          className="bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-white p-2 rounded-lg hover:bg-primary/20 transition-all font-semibold border border-blue-500/30"
        >
          Templates
        </button>
        <button
          onClick={() => handleSelect('calendars')}
          className="bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-white p-2 rounded-lg hover:bg-primary/20 transition-all font-semibold border border-green-500/30"
        >
          Calendars
        </button>
      </div>
    </div>
  );
};

export default ModuleSelector;
