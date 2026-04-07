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
        'flex flex-col overflow-hidden relative',
        level === 2 ? 'absolute inset-0 z-[80] rounded-none' : 'fixed inset-0 z-[100]',
      )}
      variants={overlayVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ type: 'spring', damping: 26, stiffness: 280 }}
    >
      {/* ── Background layers (matches app GridBackground) ───── */}
      <div className="absolute inset-0 dark:hidden bg-white bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px]" />
      <div className="absolute inset-0 dark:hidden bg-[radial-gradient(circle_800px_at_100%_200px,rgba(213,197,255,0.25),transparent)] opacity-60 pointer-events-none" />
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          backgroundColor: '#141420',
          backgroundImage: `radial-gradient(circle at 25% 25%, #2a2a3a 0.5px, transparent 1px), radial-gradient(circle at 75% 75%, #1e1e2e 0.5px, transparent 1px)`,
          backgroundSize: '10px 10px',
        }}
      />

      {/* ── Navigation strip ─────────────────────────────────── */}
      <div className="relative z-10 flex items-center gap-2 px-3 py-2.5 shrink-0">
        {/* Left: page navigation */}
        <div className="flex items-center gap-0.5 min-w-0">
          <button
            onClick={() => canGoPrev && onChangePage(pages[currentPageIndex - 1].id)}
            disabled={!canGoPrev}
            className="p-1 rounded-lg hover:bg-accent disabled:opacity-25 disabled:cursor-not-allowed transition-colors text-muted-foreground"
          >
            <ChevronLeft size={13} />
          </button>
          <span className="text-xs text-muted-foreground/70 truncate max-w-[72px] px-0.5">
            {pages[currentPageIndex]?.title ?? '—'}
          </span>
          <button
            onClick={() => canGoNext && onChangePage(pages[currentPageIndex + 1].id)}
            disabled={!canGoNext}
            className="p-1 rounded-lg hover:bg-accent disabled:opacity-25 disabled:cursor-not-allowed transition-colors text-muted-foreground"
          >
            <ChevronRight size={13} />
          </button>
        </div>

        {/* Center: module tabs */}
        <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto no-scrollbar">
          {allModulesOnPage.map((m) => (
            <button
              key={m.id}
              onClick={() => onSwitchModule(m.id)}
              title={m.title}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all shrink-0',
                m.id === expandedModule.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
              )}
            >
              {MODULE_ICON[m.type]}
              <span className="hidden sm:inline max-w-[72px] truncate">{m.title}</span>
            </button>
          ))}
        </div>

        {/* Right: size level picker + close */}
        <div className="flex items-center gap-0.5 shrink-0">
          {([0, 1, 2, 3] as SizeLevel[]).map((lvl) => (
            <button
              key={lvl}
              onClick={() => {
                if (lvl >= 2) onSizeChange(lvl);
                else if (lvl === 1) onClose();
                else onSizeChange(0);
              }}
              title={['Collapse', 'Normal', 'Sidebar', 'Fullscreen'][lvl]}
              className={cn(
                'flex items-center justify-center w-6 h-6 rounded-lg transition-all',
                lvl === currentSizeLevel
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-accent text-muted-foreground'
              )}
            >
              {SIZE_ICON[lvl]}
            </button>
          ))}

          <button
            onClick={onClose}
            className="ml-1 p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Module content ───────────────────────────────────── */}
      <div className="relative z-10 flex-1 overflow-y-auto min-h-0">
        {children}
      </div>
    </motion.div>
  );
};

export default ModuleExpandedOverlay;
