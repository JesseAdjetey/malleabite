
import React from 'react';
import { ModuleInstance } from '@/lib/stores/types';
import TodoModuleEnhanced from '../modules/TodoModuleEnhanced';
import InvitesModule from '../modules/InvitesModule';
import PomodoroModule from '../modules/PomodoroModule';
import EisenhowerModule from '../modules/EisenhowerModule';
import RemindersModule from '../modules/RemindersModule';
import ArchivesModule from '../modules/ArchivesModule';
import TemplatesModule from '../modules/TemplatesModule';
import CalendarFilterModule from '../modules/CalendarFilterModule';

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
          <PomodoroModule {...moduleProps} instanceId={module.instanceId} />
        </div>
      );
    case 'alarms': // Updated to use the new RemindersModule
      return (
        <div key={index} style={moduleStyle} className={moduleClassName}>
          <RemindersModule {...moduleProps} instanceId={module.instanceId} />
        </div>
      );
    case 'eisenhower':
      return (
        <div key={index} style={moduleStyle} className={moduleClassName}>
          <EisenhowerModule {...moduleProps} instanceId={module.instanceId} />
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
    case 'templates':
      return (
        <div key={index} style={moduleStyle} className={moduleClassName}>
          <TemplatesModule {...moduleProps} />
        </div>
      );
    case 'calendars':
      return (
        <div key={index} style={moduleStyle} className={moduleClassName}>
          <CalendarFilterModule {...moduleProps} />
        </div>
      );
    default:
      return null;
  }
};

export default ModuleRenderer;
