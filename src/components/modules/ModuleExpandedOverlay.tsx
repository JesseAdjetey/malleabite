import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  X,
  CheckSquare,
  Timer,
  Bell,
  LayoutGrid,
  CalendarDays,
  Minus,
  Square,
  Maximize2,
} from 'lucide-react';
import { ModuleInstance, ModuleType, SizeLevel } from '@/lib/stores/types';
import { cn } from '@/lib/utils';

interface PageInfo {
  id: string;
  title: string;
}

interface ModuleExpandedOverlayProps {
  level: 2 | 3;
  expandedModule: ModuleInstance;
  allModulesOnPage: ModuleInstance[];
  pages: PageInfo[];
  currentPageId: string;
  currentSizeLevel: SizeLevel;
  onChangePage: (pageId: string) => void;
  onSwitchModule: (moduleId: string) => void;
  onSizeChange: (level: SizeLevel) => void;
  onClose: () => void;
  children: React.ReactNode;
}

const MODULE_ICON: Record<ModuleType, React.ReactNode> = {
  todo: <CheckSquare size={14} />,
  pomodoro: <Timer size={14} />,
  alarms: <Bell size={14} />,
  reminders: <Bell size={14} />,
  eisenhower: <LayoutGrid size={14} />,
  booking: <CalendarDays size={14} />,
};

const SIZE_ICON: Record<SizeLevel, React.ReactNode> = {
  0: <Minus size={12} />,
  1: <Square size={12} />,
  2: <Square size={14} strokeWidth={2.5} />,
  3: <Maximize2 size={12} />,
};

const ModuleExpandedOverlay: React.FC<ModuleExpandedOverlayProps> = ({
  level,
  expandedModule,
  allModulesOnPage,
  pages,
  currentPageId,
  currentSizeLevel,
  onChangePage,
  onSwitchModule,
  onSizeChange,
  onClose,
  children,
}) => {
  const currentPageIndex = pages.findIndex(p => p.id === currentPageId);
  const canGoPrev = currentPageIndex > 0;
  const canGoNext = currentPageIndex < pages.length - 1;

  // Esc key to step down one level (3→2→1)
  useEffect(() => {
    if (level !== 3) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [level, onClose]);

  const overlayVariants = {
    initial: { opacity: 0, scale: level === 3 ? 0.97 : 0.98, y: level === 3 ? 8 : 4 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: level === 3 ? 0.97 : 0.98, y: level === 3 ? 8 : 4 },
  };

  return (
    <motion.div
      className={cn(
        'flex flex-col bg-background overflow-hidden',
        level === 2 ? 'absolute inset-0 z-20 rounded-none' : 'fixed inset-0 z-[100]',
      )}
      variants={overlayVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ type: 'spring', damping: 26, stiffness: 280 }}
    >
      {/* ── Navigation strip ─────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-background/95 backdrop-blur-sm shrink-0">
        {/* Left: page navigation */}
        <div className="flex items-center gap-1 min-w-0">
          <button
            onClick={() => canGoPrev && onChangePage(pages[currentPageIndex - 1].id)}
            disabled={!canGoPrev}
            className="p-1 rounded-md hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs font-medium text-muted-foreground truncate max-w-[72px]">
            {pages[currentPageIndex]?.title ?? '—'}
          </span>
          <button
            onClick={() => canGoNext && onChangePage(pages[currentPageIndex + 1].id)}
            disabled={!canGoNext}
            className="p-1 rounded-md hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-border/60 shrink-0" />

        {/* Center: module icons */}
        <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar">
          {allModulesOnPage.map((m) => (
            <button
              key={m.id}
              onClick={() => onSwitchModule(m.id)}
              title={m.title}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all shrink-0',
                m.id === expandedModule.id
                  ? 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-400/40'
                  : 'hover:bg-accent text-muted-foreground hover:text-foreground'
              )}
            >
              {MODULE_ICON[m.type]}
              <span className="hidden sm:inline max-w-[60px] truncate">{m.title}</span>
            </button>
          ))}
        </div>

        {/* Right: size level picker + close */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Size level dots */}
          {([0, 1, 2, 3] as SizeLevel[]).map((lvl) => (
            <button
              key={lvl}
              onClick={() => {
                if (lvl <= 1) onClose(); // going to level 0 or 1 = close overlay
                else onSizeChange(lvl);
              }}
              title={['Collapse', 'Normal', 'Sidebar', 'Fullscreen'][lvl]}
              className={cn(
                'flex items-center justify-center w-6 h-6 rounded transition-all',
                lvl === currentSizeLevel
                  ? 'bg-purple-500/20 text-purple-400'
                  : 'hover:bg-accent text-muted-foreground'
              )}
            >
              {SIZE_ICON[lvl]}
            </button>
          ))}

          <div className="w-px h-4 bg-border/60 mx-1" />

          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Module content ───────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </motion.div>
  );
};

export default ModuleExpandedOverlay;
