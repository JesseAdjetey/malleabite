
import React from 'react';
import { ModuleInstance } from '@/lib/stores/types';
import TodoModuleEnhanced from '../modules/TodoModuleEnhanced';
import InvitesModule from '../modules/InvitesModule';
import PomodoroModule from '../modules/PomodoroModule';
import EisenhowerModule from '../modules/EisenhowerModule';
import RemindersModule from '../modules/RemindersModule';
import ArchivesModule from '../modules/ArchivesModule';

interface ModuleRendererProps {
  module: ModuleInstance;
  index: number;
  moduleWidth: number;
  onRemove: () => void;
  onTitleChange: (title: string) => void;
  onToggleMinimize: () => void;
  isDragging?: boolean;
}

const ModuleRenderer: React.FC<ModuleRendererProps> = ({
  module,
  index,
  moduleWidth,
  onRemove,
  onTitleChange,
  onToggleMinimize,
  isDragging = false
}) => {
  // Each module has a fixed width
  const moduleStyle = {
    width: `${moduleWidth}px`,
    maxWidth: '100%'
  };

  // Add common props to each module type
  const moduleProps = {
    title: module.title,
    onRemove: onRemove,
    onTitleChange: onTitleChange,
    onMinimize: onToggleMinimize,
    isMinimized: module.minimized,
    isDragging: isDragging,
    listId: module.listId
  };

  const moduleClassName = `mb-4 gradient-border cursor-glow ${isDragging ? 'opacity-75' : ''}`;

  switch (module.type) {
    case 'todo':
      return (
        <div key={index} style={moduleStyle} className={moduleClassName}>
          <TodoModuleEnhanced {...moduleProps} />
        </div>
      );
    case 'pomodoro':
      return (
        <div key={index} style={moduleStyle} className={moduleClassName}>
          <PomodoroModule {...moduleProps} />
        </div>
      );
    case 'alarms': // Updated to use the new RemindersModule
      return (
        <div key={index} style={moduleStyle} className={moduleClassName}>
          <RemindersModule {...moduleProps} />
        </div>
      );
    case 'eisenhower':
      return (
        <div key={index} style={moduleStyle} className={moduleClassName}>
          <EisenhowerModule {...moduleProps} />
        </div>
      );
    case 'invites':
      return (
        <div key={index} style={moduleStyle} className={moduleClassName}>
          <InvitesModule {...moduleProps} />
        </div>
      );
    case 'archives':
      return (
        <div key={index} style={moduleStyle} className={moduleClassName}>
          <ArchivesModule {...moduleProps} />
        </div>
      );
    default:
      return null;
  }
};

export default ModuleRenderer;
