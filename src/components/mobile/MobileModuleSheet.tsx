import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Plus, ChevronRight, ChevronLeft } from 'lucide-react';
import { haptics } from '@/lib/haptics';
import { useSidebarPages } from '@/hooks/use-sidebar-pages';
import { ModuleType } from '@/lib/store';
import ModuleRenderer from '@/components/sidebar/ModuleRenderer';

interface MobileModuleSheetProps {
  calendarFraction: number;
  onCalendarFractionChange: (f: number) => void;
}

const MODULE_OPTIONS: { type: ModuleType; label: string }[] = [
  { type: 'todo', label: 'To-Do List' },
  { type: 'pomodoro', label: 'Pomodoro Timer' },
  { type: 'alarms', label: 'Alarms' },
  { type: 'reminders', label: 'Reminders' },
  { type: 'eisenhower', label: 'Eisenhower Matrix' },
  { type: 'invites', label: 'Invites' },
];

const COLLAPSED_FRACTION = 0.965;
const MID_FRACTION = 0.67;
const EXPANDED_FRACTION = 0.32;
const HANDLE_OVERLAP = 18;
const COLLAPSED_VISIBLE_HEIGHT = 62;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const MobileModuleSheet: React.FC<MobileModuleSheetProps> = ({
  calendarFraction,
  onCalendarFractionChange,
}) => {
  const {
    pages,
    activePage,
    activePageId,
    setActivePageId,
    createPage,
    addModule,
    removeModule,
    updateModule,
  } = useSidebarPages();

  const sheetRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [parentHeight, setParentHeight] = useState(() => window.innerHeight);
  const [showAddModule, setShowAddModule] = useState(false);
  const dragStartFraction = useRef(calendarFraction);

  useEffect(() => {
    const updateLayout = () => {
      const nextParentHeight = sheetRef.current?.parentElement?.clientHeight ?? window.innerHeight;
      setParentHeight(nextParentHeight);
    };

    const resizeObserver = new ResizeObserver(() => updateLayout());
    const parentElement = sheetRef.current?.parentElement;

    if (parentElement) {
      resizeObserver.observe(parentElement);
    }

    window.addEventListener('resize', updateLayout);
    updateLayout();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateLayout);
    };
  }, []);

  const handleDividerDragStart = () => {
    dragStartFraction.current = calendarFraction;
    haptics.selection();
  };

  const handleDividerDrag = (_: any, info: PanInfo) => {
    const delta = info.offset.y / parentHeight;
    const next = clamp(dragStartFraction.current + delta, EXPANDED_FRACTION, COLLAPSED_FRACTION);
    onCalendarFractionChange(next);
  };

  const getSnapTarget = (currentFraction: number, velocityY: number) => {
    const snapPoints = [EXPANDED_FRACTION, MID_FRACTION, COLLAPSED_FRACTION];

    if (velocityY <= -450) {
      return snapPoints.find((point) => point < currentFraction - 0.04) ?? EXPANDED_FRACTION;
    }

    if (velocityY >= 450) {
      return [...snapPoints].reverse().find((point) => point > currentFraction + 0.04) ?? COLLAPSED_FRACTION;
    }

    return snapPoints.reduce((closest, point) => {
      return Math.abs(point - currentFraction) < Math.abs(closest - currentFraction) ? point : closest;
    }, snapPoints[0]);
  };

  const handleDividerDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const delta = info.offset.y / parentHeight;
    const current = clamp(dragStartFraction.current + delta, EXPANDED_FRACTION, COLLAPSED_FRACTION);
    onCalendarFractionChange(getSnapTarget(current, info.velocity.y));
    haptics.light();
  };

  const activeIndex = pages.findIndex((p) => p.id === activePageId);
  const safeActiveIndex = activeIndex >= 0 ? activeIndex : 0;
  const collapsedTop = Math.max(0, parentHeight - COLLAPSED_VISIBLE_HEIGHT);
  const expandedTop = Math.max(110, parentHeight * EXPANDED_FRACTION - HANDLE_OVERLAP);
  const interpolatedTop = parentHeight * calendarFraction - HANDLE_OVERLAP;
  const drawerTop = clamp(interpolatedTop, expandedTop, collapsedTop);
  const drawerHeight = Math.max(COLLAPSED_VISIBLE_HEIGHT, parentHeight - drawerTop + HANDLE_OVERLAP);
  const revealProgress = clamp((MID_FRACTION - calendarFraction) / (MID_FRACTION - EXPANDED_FRACTION), 0, 1);
  const contentVisible = calendarFraction <= MID_FRACTION;
  const moduleViewportHeight = Math.max(220, drawerHeight - 122);
  const moduleScale = 0.86 + revealProgress * 0.14;
  const moduleWidth = Math.max(260, Math.min(window.innerWidth - 56, 360));

  const goToPrevPage = () => {
    if (safeActiveIndex > 0) {
      setActivePageId(pages[safeActiveIndex - 1].id);
      haptics.selection();
    }
  };

  const goToNextPage = () => {
    if (safeActiveIndex < pages.length - 1) {
      setActivePageId(pages[safeActiveIndex + 1].id);
      haptics.selection();
    }
  };

  const handlePanEnd = (_: any, info: PanInfo) => {
    if (Math.abs(info.offset.x) < Math.abs(info.offset.y)) return;

    const threshold = 50;
    const { offset, velocity } = info;

    if (offset.x < -threshold || velocity.x < -300) {
      goToNextPage();
    } else if (offset.x > threshold || velocity.x > 300) {
      goToPrevPage();
    }
  };

  const handleAddModule = async (type: ModuleType) => {
    if (!activePageId) return;
    const label = MODULE_OPTIONS.find((m) => m.type === type)?.label ?? type;
    await addModule(activePageId, { type, title: label });
    setShowAddModule(false);
    haptics.success();
  };

  const modules = activePage?.modules ?? [];

  return (
    <motion.section
      ref={sheetRef}
      className="absolute inset-x-0 bottom-0 z-30"
      animate={{ top: drawerTop }}
      transition={{ type: 'spring', stiffness: 320, damping: 34, mass: 0.85 }}
    >
      <div className="relative flex h-full flex-col">
        <motion.div
          onPanStart={handleDividerDragStart}
          onPan={handleDividerDrag}
          onPanEnd={handleDividerDragEnd}
          className="absolute left-1/2 top-0 z-20 flex h-9 w-[170px] -translate-x-1/2 items-center justify-center rounded-full cursor-row-resize touch-none"
          style={{
            background: 'hsl(var(--background) / 0.92)',
            border: '1px solid hsl(var(--border) / 0.8)',
            boxShadow: '0 12px 24px rgba(0,0,0,0.18), 0 2px 4px rgba(0,0,0,0.08)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            touchAction: 'none',
          }}
        >
          <div
            className="h-2.5 w-24 rounded-full"
            style={{
              background: 'linear-gradient(180deg, hsl(var(--muted-foreground) / 0.82) 0%, hsl(var(--muted-foreground) / 0.58) 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28), 0 1px 3px rgba(0,0,0,0.18)',
            }}
          />
        </motion.div>

        <div
          ref={containerRef}
          className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-t-[28px]"
          style={{
            background: 'hsl(var(--card) / 0.97)',
            border: '1px solid hsl(var(--border) / 0.75)',
            boxShadow: '0 -10px 36px rgba(0,0,0,0.14)',
            opacity: 0.08 + revealProgress * 0.92,
          }}
        >
          <motion.div
            className="flex h-full flex-col"
            animate={{ opacity: contentVisible ? 1 : 0, y: contentVisible ? 0 : 18 }}
            transition={{ duration: 0.18 }}
            style={{ pointerEvents: contentVisible ? 'auto' : 'none' }}
          >
            <div className="flex items-center justify-between px-4 pb-2 pt-5">
              <button
                onClick={goToPrevPage}
                disabled={safeActiveIndex <= 0}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/80 disabled:opacity-30"
              >
                <ChevronLeft size={18} className="text-foreground" />
              </button>

              <div className="min-w-0 flex-1 px-3 text-center">
                <div className="truncate text-sm font-semibold text-foreground">
                  {activePage?.title ?? 'Modules'}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Page {safeActiveIndex + 1} of {Math.max(pages.length, 1)}
                </div>
              </div>

              <button
                onClick={goToNextPage}
                disabled={safeActiveIndex >= pages.length - 1}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background/80 disabled:opacity-30"
              >
                <ChevronRight size={18} className="text-foreground" />
              </button>
            </div>

            <motion.div className="min-h-0 flex-1 overflow-hidden px-3" onPanEnd={handlePanEnd}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activePageId}
                  initial={{ opacity: 0, x: 34 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -34 }}
                  transition={{ duration: 0.2 }}
                  className="h-full"
                >
                  {modules.length === 0 ? (
                    <div className="flex h-full items-center justify-center px-8 pb-6 text-center text-sm text-muted-foreground">
                      Drag the handle higher, then add a module for this page.
                    </div>
                  ) : (
                    <div
                      className="h-full overflow-y-auto overscroll-y-contain pb-4 snap-y snap-mandatory"
                      style={{ WebkitOverflowScrolling: 'touch' }}
                    >
                      {modules.map((mod, idx) => (
                        <div
                          key={mod.id}
                          className="snap-start flex items-start justify-center"
                          style={{ minHeight: `${moduleViewportHeight}px` }}
                        >
                          <div
                            style={{
                              transform: `scale(${moduleScale})`,
                              transformOrigin: 'top center',
                              width: `${moduleWidth}px`,
                              maxWidth: '100%',
                            }}
                          >
                            <ModuleRenderer
                              module={mod}
                              index={idx}
                              moduleWidth={moduleWidth}
                              onRemove={() => activePageId && removeModule(activePageId, idx)}
                              onTitleChange={(title) =>
                                activePageId && updateModule(activePageId, idx, { title })
                              }
                              onToggleMinimize={() => undefined}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.div>

            <div className="flex justify-center px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
              <button
                onClick={() => {
                  setShowAddModule(true);
                  haptics.light();
                }}
                className="flex items-center gap-1.5 rounded-full border border-border/70 bg-background/80 px-4 py-2 text-xs font-medium text-foreground shadow-sm"
              >
                <Plus size={14} />
                Add Module
              </button>
            </div>
          </motion.div>
        </div>

        <AnimatePresence>
          {showAddModule && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-end bg-black/40"
              onClick={() => setShowAddModule(false)}
            >
              <motion.div
                initial={{ y: 200 }}
                animate={{ y: 0 }}
                exit={{ y: 200 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="w-full rounded-t-2xl bg-background p-4 pb-[env(safe-area-inset-bottom)]"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="mb-3 text-sm font-semibold">Add Module</h3>
                <div className="grid grid-cols-2 gap-2">
                  {MODULE_OPTIONS.map((opt) => (
                    <button
                      key={opt.type}
                      onClick={() => handleAddModule(opt.type)}
                      className="rounded-lg bg-muted p-3 text-sm font-medium transition hover:bg-muted/80 active:scale-95"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={async () => {
                    await createPage('New Page');
                    setShowAddModule(false);
                    haptics.success();
                  }}
                  className="mt-3 w-full text-center text-xs text-muted-foreground underline"
                >
                  + New Page
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
};

export default MobileModuleSheet;
