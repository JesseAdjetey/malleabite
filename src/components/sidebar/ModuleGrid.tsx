
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSidebarStore } from '@/lib/store';
import ModuleRenderer from './ModuleRenderer';
import { useSidebarLayout } from '@/hooks/use-sidebar-layout';
import { ModuleInstance, SizeLevel } from '@/lib/stores/types';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import ManageAccessSheet from '../modules/sharing/ManageAccessSheet';
import { CheckSquare, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModuleMoveTarget {
  id: string;
  title: string;
}

interface ModuleGridProps {
  modules: ModuleInstance[];
  onRemoveModule: (index: number) => void;
  onUpdateModuleTitle: (index: number, title: string) => void;
  onUpdateModule?: (moduleId: string, updates: Partial<ModuleInstance>) => void;
  onReorderModules: (fromIndex: number, toIndex: number) => void;
  onMoveModule: (index: number, targetPageId: string) => void;
  onSetModuleSizeLevel?: (moduleIndex: number, level: SizeLevel) => void;
  moveTargets: ModuleMoveTarget[];
  pageIndex: number;
  isReadOnly?: boolean;
  contentReadOnly?: boolean;
  // Controlled bulk select (state lives in sideBar)
  isSelectMode?: boolean;
  selectedModuleIds?: Set<string>;
  onToggleSelectMode?: () => void;
  onToggleModuleSelect?: (id: string) => void;
  onStartSelectWith?: (id: string) => void;
}

const ModuleGrid: React.FC<ModuleGridProps> = ({
  modules,
  onRemoveModule,
  onUpdateModuleTitle,
  onUpdateModule,
  onReorderModules,
  onMoveModule,
  onSetModuleSizeLevel,
  moveTargets,
  pageIndex,
  isReadOnly = false,
  contentReadOnly = false,
  isSelectMode = false,
  selectedModuleIds = new Set(),
  onToggleSelectMode,
  onToggleModuleSelect,
  onStartSelectWith,
}) => {
  const MODULE_WIDTH = 280;
  const { isTwoColumn, containerRef } = useSidebarLayout({
    columnBreakpoint: 620
  });

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const [shareSheet, setShareSheet] = useState<{ module: ModuleInstance; open: boolean } | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openShareSheet = (module: ModuleInstance) => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setShareSheet({ module, open: true });
  };

  const closeShareSheet = () => {
    setShareSheet(prev => prev ? { ...prev, open: false } : null);
    closeTimerRef.current = setTimeout(() => setShareSheet(null), 350);
  };

  const { toggleModuleMinimized } = useSidebarStore();

  useEffect(() => {
    const cursor = document.createElement('div');
    cursor.id = 'custom-cursor';
    document.body.appendChild(cursor);

    const handleMouseMove = (e: MouseEvent) => {
      if (cursor) {
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
      }
    };

    const handleHoverStart = () => cursor.classList.add('expanded');
    const handleHoverEnd = () => cursor.classList.remove('expanded');

    document.addEventListener('mousemove', handleMouseMove);

    const gradientElements = document.querySelectorAll('.gradient-border');
    gradientElements.forEach(el => {
      el.addEventListener('mouseenter', handleHoverStart);
      el.addEventListener('mouseleave', handleHoverEnd);
    });

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      gradientElements.forEach(el => {
        el.removeEventListener('mouseenter', handleHoverStart);
        el.removeEventListener('mouseleave', handleHoverEnd);
      });
      if (cursor && document.body.contains(cursor)) {
        document.body.removeChild(cursor);
      }
    };
  }, [modules.length]);

  const handleDragStart = (index: number) => setDraggedIndex(index);

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    setDragOverIndex(index);
  };

  const handleDrop = (targetIndex: number) => {
    if (draggedIndex === null) return;
    if (draggedIndex !== targetIndex) {
      onReorderModules(draggedIndex, targetIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleToggleMinimize = (index: number) => {
    toggleModuleMinimized(pageIndex, index);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Select mode toggle */}
      {!isReadOnly && modules.length > 1 && onToggleSelectMode && (
        <div className="flex justify-end px-1">
          <button
            onClick={onToggleSelectMode}
            className={cn(
              "text-[10px] px-2 py-0.5 rounded-full transition-colors font-medium flex items-center gap-1",
              isSelectMode
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            )}
          >
            {isSelectMode ? <X size={10} /> : <CheckSquare size={10} />}
            {isSelectMode ? "Done" : "Select"}
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        className={`${isTwoColumn ? 'grid grid-cols-2 gap-3' : 'flex flex-col items-center'}`}
      >
        <AnimatePresence mode="popLayout">
        {modules.map((module, index) => {
          const isSelected = selectedModuleIds.has(module.id);
          return (
          <motion.div
            key={module.id}
            layout
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: draggedIndex === index ? 0.5 : 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: -10, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: "spring", damping: 22, stiffness: 200, delay: index * 0.05 }}
            draggable={!isReadOnly && !isSelectMode}
            onDragStart={() => !isReadOnly && !isSelectMode && handleDragStart(index)}
            onDragOver={(e) => !isReadOnly && !isSelectMode && handleDragOver(e, index)}
            onDrop={() => !isReadOnly && !isSelectMode && handleDrop(index)}
            onDragEnd={handleDragEnd}
            className="relative"
          >
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div className={cn(dragOverIndex === index ? 'ring-2 ring-primary ring-opacity-50 rounded-2xl' : '', 'relative')}>
                <ModuleRenderer
                  module={module}
                  index={index}
                  moduleWidth={MODULE_WIDTH}
                  onRemove={() => onRemoveModule(index)}
                  onTitleChange={(title) => onUpdateModuleTitle(index, title)}
                  onUpdateModule={onUpdateModule}
                  onToggleMinimize={() => handleToggleMinimize(index)}
                  onSizeChange={onSetModuleSizeLevel ? (level) => onSetModuleSizeLevel(index, level) : undefined}
                  isDragging={draggedIndex === index}
                  moveTargets={moveTargets}
                  onMoveToPage={(pageId) => onMoveModule(index, pageId)}
                  onShare={() => openShareSheet(module)}
                  isReadOnly={isReadOnly}
                  contentReadOnly={contentReadOnly}
                />

                {/* Selection overlay */}
                {isSelectMode && (
                  <div
                    className={cn(
                      "absolute inset-0 rounded-2xl cursor-pointer transition-all duration-150 z-10",
                      isSelected ? "ring-2 ring-primary bg-primary/[0.08]" : "hover:bg-foreground/5"
                    )}
                    onClick={() => onToggleModuleSelect?.(module.id)}
                  >
                    <div className={cn(
                      "absolute top-2 right-2 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                      isSelected
                        ? "bg-primary border-primary"
                        : "bg-background/80 border-muted-foreground/40 backdrop-blur-sm"
                    )}>
                      {isSelected && (
                        <motion.svg
                          initial={{ scale: 0 }} animate={{ scale: 1 }}
                          width="10" height="10" viewBox="0 0 10 10" fill="none"
                        >
                          <path d="M2 5l2.5 2.5L8 2.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </motion.svg>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </ContextMenuTrigger>

            {!isReadOnly && (
              <ContextMenuContent>
                <ContextMenuLabel>{module.title}</ContextMenuLabel>
                <ContextMenuSeparator />
                <ContextMenuItem onSelect={() => {
                  const el = document.querySelector(`[data-module-id="${module.id}"] .module-rename-trigger`) as HTMLElement;
                  el?.click();
                }}>
                  Rename
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => handleToggleMinimize(index)}>
                  {(module.sizeLevel ?? (module.minimized ? 0 : 1)) === 0 ? 'Expand' : 'Collapse'}
                </ContextMenuItem>
                <ContextMenuSeparator />
                {moveTargets.length > 0 && (
                  <ContextMenuSub>
                    <ContextMenuSubTrigger>Transfer to page</ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                      {moveTargets.map((target) => (
                        <ContextMenuItem
                          key={target.id}
                          onSelect={() => onMoveModule(index, target.id)}
                        >
                          {target.title}
                        </ContextMenuItem>
                      ))}
                    </ContextMenuSubContent>
                  </ContextMenuSub>
                )}
                <ContextMenuItem onSelect={() => onStartSelectWith?.(module.id)}>
                  Select
                </ContextMenuItem>
                <ContextMenuItem onSelect={() => openShareSheet(module)}>
                  Share / Manage Access
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onSelect={() => onRemoveModule(index)}
                  className="text-destructive focus:text-destructive"
                >
                  Delete
                </ContextMenuItem>
              </ContextMenuContent>
            )}
          </ContextMenu>
          </motion.div>
          );
        })}
        </AnimatePresence>
      </div>

      {shareSheet && (
        <ManageAccessSheet
          moduleInstanceId={shareSheet.module.sharedFromInstanceId ?? shareSheet.module.id}
          moduleType={shareSheet.module.type}
          moduleTitle={shareSheet.module.title}
          listId={shareSheet.module.listId}
          isOwnModule={!shareSheet.module.sharedFromInstanceId}
          open={shareSheet.open}
          onClose={closeShareSheet}
        />
      )}
    </div>
  );
};

export default ModuleGrid;
