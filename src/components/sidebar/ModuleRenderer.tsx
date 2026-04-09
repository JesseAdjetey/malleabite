
import React from 'react';
import { ModuleInstance, SizeLevel } from '@/lib/stores/types';
import { ModuleSizeProvider } from '@/contexts/ModuleSizeContext';
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
  onUpdateModule?: (moduleId: string, updates: Partial<ModuleInstance>) => void;
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
  onUpdateModule,
  onToggleMinimize,
  onSizeChange,
  isDragging = false,
  moveTargets = [],
  onMoveToPage,
  onShare,
  isReadOnly = false,
  contentReadOnly = false,
}) => {
  const effectiveSizeLevel: SizeLevel = module.sizeLevel ?? (module.minimized ? 0 : 1);

  const moduleStyle = {
    width: '100%',
    maxWidth: effectiveSizeLevel >= 2 ? '100%' : '360px',
    height: effectiveSizeLevel >= 2 ? '100%' : undefined,
  };

  // sizeLevel + onSizeChange flow into ModuleContainer via context,
  // so individual module component interfaces don't need changing.
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
  };

  const moduleClassName = effectiveSizeLevel >= 2
    ? `h-full w-full${isDragging ? ' opacity-75' : ''}`
    : `mb-4 gradient-border cursor-glow${isDragging ? ' opacity-75' : ''}`;

  const wrap = (children: React.ReactNode) => (
    <ModuleSizeProvider value={{ sizeLevel: effectiveSizeLevel, onSizeChange: isReadOnly ? undefined : onSizeChange }}>
      {children}
    </ModuleSizeProvider>
  );

  switch (module.type) {
    case 'todo':
      return wrap(
        <div key={module.id} data-module-id={module.id} style={moduleStyle} className={moduleClassName}>
          <TodoModuleEnhanced
            {...moduleProps}
            moduleId={module.id}
            sharedFromInstanceId={module.sharedFromInstanceId}
            sharedRole={module.sharedRole}
            todoistProjectId={module.todoistProjectId}
            onTodoistProjectChange={(projectId, projectName) => {
              onUpdateModule?.(module.id, {
                todoistProjectId: projectId ?? undefined,
                ...(projectName ? { title: projectName } : {}),
              });
            }}
          />
        </div>
      );
    case 'pomodoro':
      return wrap(
        <div key={module.id} data-module-id={module.id} style={moduleStyle} className={moduleClassName}>
          <PomodoroModule {...moduleProps} instanceId={module.instanceId} />
        </div>
      );
    case 'alarms':
    case 'reminders':
      return wrap(
        <div key={module.id} data-module-id={module.id} style={moduleStyle} className={moduleClassName}>
          <RemindersModule {...moduleProps} instanceId={module.instanceId} moduleId={module.id} />
        </div>
      );
    case 'eisenhower':
      return wrap(
        <div key={module.id} data-module-id={module.id} style={moduleStyle} className={moduleClassName}>
          <EisenhowerModule {...moduleProps} instanceId={module.instanceId} />
        </div>
      );
    case 'booking':
      return wrap(
        <div key={module.id} data-module-id={module.id} style={moduleStyle} className={moduleClassName}>
          <BookingModule {...moduleProps} instanceId={module.instanceId} />
        </div>
      );
    default:
      return null;
  }
};

export default ModuleRenderer;
