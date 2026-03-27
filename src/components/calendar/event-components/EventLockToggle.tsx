
import React from 'react';
import { Lock, Unlock } from 'lucide-react';

interface EventLockToggleProps {
  isLocked: boolean;
  onToggle: (e: React.MouseEvent) => void;
}

const EventLockToggle: React.FC<EventLockToggleProps> = ({ isLocked, onToggle }) => {
  return (
    <button
      className="event-lock"
      onClick={(e) => {
        e.stopPropagation(); // Prevent triggering parent click events
        onToggle(e);
      }}
    >
      {isLocked ? 
        <Lock size={14} className="text-white/70" /> : 
        <Unlock size={14} className="text-white/70" />
      }
    </button>
  );
};

export default EventLockToggle;
