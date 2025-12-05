
import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';

export type ModuleType = 'todo' | 'pomodoro' | 'alarms' | 'eisenhower' | 'invites';

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
        className="flex items-center justify-center w-full p-1.5 glass-card mb-3 text-primary hover:text-primary-foreground hover:bg-primary/30 transition-all"
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
        className="absolute top-2 right-2 text-muted-foreground hover:text-primary"
      >
        <X size={16} />
      </button>
      <h3 className="text-lg font-semibold mb-3 text-primary">Select a Module</h3>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => handleSelect('todo')}
          className="bg-white/5 p-2 rounded-lg hover:bg-primary/20 transition-all"
        >
          Todo List
        </button>
        <button
          onClick={() => handleSelect('pomodoro')}
          className="bg-white/5 p-2 rounded-lg hover:bg-primary/20 transition-all"
        >
          Pomodoro Timer
        </button>
        <button
          onClick={() => handleSelect('alarms')}
          className="bg-white/5 p-2 rounded-lg hover:bg-primary/20 transition-all"
        >
          Alarms
        </button>
        <button
          onClick={() => handleSelect('eisenhower')}
          className="bg-white/5 p-2 rounded-lg hover:bg-primary/20 transition-all"
        >
          Eisenhower Matrix
        </button>
        <button
          onClick={() => handleSelect('invites')}
          className="bg-white/5 p-2 rounded-lg hover:bg-primary/20 transition-all"
        >
          Event Invites
        </button>
      </div>
    </div>
  );
};

export default ModuleSelector;
