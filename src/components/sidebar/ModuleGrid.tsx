
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSidebarStore } from '@/lib/store';
import ModuleRenderer from './ModuleRenderer';
import { useSidebarLayout } from '@/hooks/use-sidebar-layout';
import { ModuleInstance } from '@/lib/stores/types';
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

interface ModuleMoveTarget {
  id: string;
  title: string;
}

interface ModuleGridProps {
  modules: ModuleInstance[];
  onRemoveModule: (index: number) => void;
  onUpdateModuleTitle: (index: number, title: string) => void;
  onReorderModules: (fromIndex: number, toIndex: number) => void;
  onMoveModule: (index: number, targetPageId: string) => void;
  moveTargets: ModuleMoveTarget[];
  pageIndex: number;
  isReadOnly?: boolean;
  contentReadOnly?: boolean;
}

const ModuleGrid: React.FC<ModuleGridProps> = ({
  modules,
  onRemoveModule,
  onUpdateModuleTitle,
  onReorderModules,
  onMoveModule,
  moveTargets,
  pageIndex,
  isReadOnly = false,
  contentReadOnly = false,
}) => {
  const MODULE_WIDTH = 280;
  const { isTwoColumn, containerRef } = useSidebarLayout({
    columnBreakpoint: 620
  });

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Share sheet state — keep module data stable while the Sheet animates out,
  // then fully unmount after the animation. This prevents Firestore SDK internal
  // state errors that occur when onSnapshot listeners are destroyed mid-flight.
  const [shareSheet, setShareSheet] = useState<{ module: ModuleInstance; open: boolean } | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openShareSheet = (module: ModuleInstance) => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setShareSheet({ module, open: true });
  };

  const closeShareSheet = () => {
    // Animate out first (open → false), then unmount after animation (~300ms)
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
    <div className="flex flex-col">
      <div
        ref={containerRef}
        className={`${isTwoColumn ? 'grid grid-cols-2 gap-4 justify-items-center' : 'flex flex-col items-center'}`}
      >
        <AnimatePresence mode="popLayout">
        {modules.map((module, index) => (
          <motion.div
            key={module.id}
            layout
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: draggedIndex === index ? 0.5 : 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, y: -10, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
            transition={{ type: "spring", damping: 22, stiffness: 200, delay: index * 0.05 }}
            draggable={!isReadOnly}
            onDragStart={() => !isReadOnly && handleDragStart(index)}
            onDragOver={(e) => !isReadOnly && handleDragOver(e, index)}
            onDrop={() => !isReadOnly && handleDrop(index)}
            onDragEnd={handleDragEnd}
          >
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <div className={`${dragOverIndex === index ? 'ring-2 ring-primary ring-opacity-50 rounded-2xl' : ''}`}>
                <ModuleRenderer
                  module={module}
                  index={index}
                  moduleWidth={MODULE_WIDTH}
                  onRemove={() => onRemoveModule(index)}
                  onTitleChange={(title) => onUpdateModuleTitle(index, title)}
                  onToggleMinimize={() => handleToggleMinimize(index)}
                  isDragging={draggedIndex === index}
                  moveTargets={moveTargets}
                  onMoveToPage={(pageId) => onMoveModule(index, pageId)}
                  onShare={() => openShareSheet(module)}
                  isReadOnly={isReadOnly}
                  contentReadOnly={contentReadOnly}
                />
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
                  {module.minimized ? 'Expand' : 'Minimize'}
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
        ))}
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
