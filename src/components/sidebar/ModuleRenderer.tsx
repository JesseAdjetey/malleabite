
import React from 'react';
import { ModuleInstance, SizeLevel } from '@/lib/stores/types';
import TodoModuleEnhanced from '../modules/TodoModuleEnhanced';
import PomodoroModule from '../modules/PomodoroModule';
import EisenhowerModule from '../modules/EisenhowerModule';
import RemindersModule from '../modules/RemindersModule';
import BookingModule from '../modules/BookingModule';

interface MoveTarget {
  id: string;
  title: string;
}

interface ModuleRendererProps {
  module: ModuleInstance;
  index: number;
  moduleWidth: number;
  onRemove: () => void;
  onTitleChange: (title: string) => void;
  onToggleMinimize: () => void;
  onSizeChange?: (level: SizeLevel) => void;
  isDragging?: boolean;
  moveTargets?: MoveTarget[];
  onMoveToPage?: (pageId: string) => void;
  onShare?: () => void;
  isReadOnly?: boolean;
  contentReadOnly?: boolean;
}

const ModuleRenderer: React.FC<ModuleRendererProps> = ({
  module,
  index,
  moduleWidth,
  onRemove,
  onTitleChange,
  onToggleMinimize,
  onSizeChange,
  isDragging = false,
  moveTargets = [],
  onMoveToPage,
  onShare,
  isReadOnly = false,
  contentReadOnly = false,
}) => {
  const moduleStyle = {
    width: '100%',
    maxWidth: '360px',
  };

  const effectiveSizeLevel = module.sizeLevel ?? (module.minimized ? 0 : 1);

  const moduleProps = {
    title: module.title,
    onRemove: isReadOnly ? undefined : onRemove,
    onTitleChange: isReadOnly ? undefined : onTitleChange,
    onMinimize: onToggleMinimize,
    isMinimized: effectiveSizeLevel === 0,
    isDragging,
    listId: module.listId,
    moveTargets: isReadOnly ? [] : moveTargets,
    onMoveToPage: isReadOnly ? undefined : onMoveToPage,
    onShare: isReadOnly ? undefined : onShare,
    isReadOnly,
    contentReadOnly,
    sizeLevel: effectiveSizeLevel,
    onSizeChange: isReadOnly ? undefined : onSizeChange,
  };

  const moduleClassName = `mb-4 gradient-border cursor-glow ${isDragging ? 'opacity-75' : ''}`;

  switch (module.type) {
    case 'todo':
      return (
        <div
          key={module.id}
          data-module-id={module.id}
          style={moduleStyle}
          className={moduleClassName}
        >
          <TodoModuleEnhanced {...moduleProps} moduleId={module.id} sharedFromInstanceId={module.sharedFromInstanceId} sharedRole={module.sharedRole} />
        </div>
      );
    case 'pomodoro':
      return (
        <div key={module.id} data-module-id={module.id} style={moduleStyle} className={moduleClassName}>
          <PomodoroModule {...moduleProps} instanceId={module.instanceId} />
        </div>
      );
    case 'alarms':
    case 'reminders':
      return (
        <div key={module.id} data-module-id={module.id} style={moduleStyle} className={moduleClassName}>
          <RemindersModule {...moduleProps} instanceId={module.instanceId} moduleId={module.id} />
        </div>
      );
    case 'eisenhower':
      return (
        <div key={module.id} data-module-id={module.id} style={moduleStyle} className={moduleClassName}>
          <EisenhowerModule {...moduleProps} instanceId={module.instanceId} />
        </div>
      );
    case 'booking':
      return (
        <div key={module.id} data-module-id={module.id} style={moduleStyle} className={moduleClassName}>
          <BookingModule {...moduleProps} instanceId={module.instanceId} />
        </div>
      );
    default:
      return null;
  }
};

export default ModuleRenderer;
