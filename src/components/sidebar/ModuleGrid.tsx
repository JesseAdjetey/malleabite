
import React, { useEffect, useRef, useState } from 'react';
import { useSidebarStore } from '@/lib/store';
import ModuleRenderer from './ModuleRenderer';
import { useSidebarLayout } from '@/hooks/use-sidebar-layout';
import { ModuleInstance } from '@/lib/stores/types';

interface ModuleGridProps {
  modules: ModuleInstance[];
  onRemoveModule: (index: number) => void;
  onUpdateModuleTitle: (index: number, title: string) => void;
  onReorderModules: (fromIndex: number, toIndex: number) => void;
  pageIndex: number;
}

const ModuleGrid: React.FC<ModuleGridProps> = ({ 
  modules, 
  onRemoveModule,
  onUpdateModuleTitle,
  onReorderModules,
  pageIndex
}) => {
  // Module dimensions - reduced width for better fit in sidebar
  const MODULE_WIDTH = 280; // Reduced from 320 to 280
  
  // Use our custom hook for responsive layout with lower breakpoint
  const { isTwoColumn, containerRef } = useSidebarLayout({
    columnBreakpoint: 620 // Reduced from 700 to trigger two columns more easily
  });

  // State for tracking drag operations
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Custom cursor effect
  const cursorRef = useRef<HTMLDivElement>(null);
  
  // Access the toggleModuleMinimized function from the store
  const { toggleModuleMinimized } = useSidebarStore();

  useEffect(() => {
    // Create the custom cursor element
    const cursor = document.createElement('div');
    cursor.id = 'custom-cursor';
    document.body.appendChild(cursor);

    const handleMouseMove = (e: MouseEvent) => {
      if (cursor) {
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
      }
    };

    const handleHoverStart = () => {
      cursor.classList.add('expanded');
    };

    const handleHoverEnd = () => {
      cursor.classList.remove('expanded');
    };

    // Add listeners to document
    document.addEventListener('mousemove', handleMouseMove);

    // Attach hover listeners to all module containers and calendar elements
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
  }, [modules.length]); // Re-run when modules change

  // Handle drag start
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  // Handle drag over
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    setDragOverIndex(index);
  };

  // Handle drop
  const handleDrop = (targetIndex: number) => {
    if (draggedIndex === null) return;
    
    // Only perform reorder if indexes are different
    if (draggedIndex !== targetIndex) {
      onReorderModules(draggedIndex, targetIndex);
    }
    
    // Reset drag states
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Handle drag end (cleanup)
  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Handle toggle minimize for a module
  const handleToggleMinimize = (index: number) => {
    toggleModuleMinimized(pageIndex, index);
  };

  return (
    <div className="flex flex-col">
      {/* Module Grid */}
      <div 
        ref={containerRef} 
        className={`${isTwoColumn ? 'grid grid-cols-2 gap-4 justify-items-center' : 'flex flex-col items-center'}`}
      >
        {modules.map((module, index) => (
          <div
            key={index}
            draggable
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={() => handleDrop(index)}
            onDragEnd={handleDragEnd}
            className={`${dragOverIndex === index ? 'ring-2 ring-primary ring-opacity-50' : ''} 
                      ${draggedIndex === index ? 'opacity-50' : 'opacity-100'}`}
          >
            <ModuleRenderer
              module={module}
              index={index}
              moduleWidth={MODULE_WIDTH}
              onRemove={() => onRemoveModule(index)}
              onTitleChange={(title) => onUpdateModuleTitle(index, title)}
              onToggleMinimize={() => handleToggleMinimize(index)}
              isDragging={draggedIndex === index}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default ModuleGrid;
