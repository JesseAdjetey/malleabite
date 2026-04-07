import React from 'react';
import { createPortal } from 'react-dom';
import { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSidebarPages, useSharedPageModules } from '@/hooks/use-sidebar-pages';
import { ModuleType, SizeLevel } from '@/lib/store';
import { sounds } from '@/lib/sounds';
import ModuleSelector from '../modules/ModuleSelector';
import PageHeader from './PageHeader';
import ModuleGrid from './ModuleGrid';
import ManagePageAccessSheet from './sharing/ManagePageAccessSheet';
import ModuleExpandedOverlay from '../modules/ModuleExpandedOverlay';
import ModuleRenderer from './ModuleRenderer';
import { Plus, PanelLeft, Maximize2, CalendarDays, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SidebarBoundsProvider } from '@/contexts/SidebarBoundsContext';

type SidebarLayoutMode = 'normal' | 'hidden' | 'fullscreen';

interface SideBarProps {
  layoutMode?: SidebarLayoutMode;
  onSetLayoutMode?: (mode: SidebarLayoutMode) => void;
}

const SideBar: React.FC<SideBarProps> = ({ layoutMode = 'normal', onSetLayoutMode }) => {
  const {
    pages,
    activePage,
    activePageId,
    setActivePageId,
    createPage,
    updatePage,
    deletePage,
    addModule,
    removeModule,
    moveModule,
    updateModule,
    reorderModules,
    setModuleSizeLevel,
    setModulesSizeLevels,
    loading
  } = useSidebarPages();

  const sidebarRef = useRef<HTMLDivElement>(null);
  const sidebarContentRef = useRef<HTMLDivElement>(null);
  const [sidebarBounds, setSidebarBounds] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [pageShareSheetOpen, setPageShareSheetOpen] = useState(false);
  const [slideDir, setSlideDir] = useState<1 | -1>(1);
  const [moduleSlideDir, setModuleSlideDir] = useState<1 | -1>(1);

  // L3 module resizer state
  const l3DragRef = useRef(false);
  const l3StartXRef = useRef(0);
  const [l3ResizeProgress, setL3ResizeProgress] = useState(0);

  // Swipe gesture state
  const pointerDownRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const dirLockRef = useRef<'h' | 'v' | null>(null);

  const isSharedPage = !!activePage?.sharedFromPageId;
  const isStructureReadOnly = isSharedPage;
  const isContentReadOnly = activePage?.sharedRole === 'viewer';

  const { modules: sharedModules } = useSharedPageModules(activePage?.sharedFromPageId);
  const allModulesToRender = isSharedPage ? sharedModules : (activePage?.modules ?? []);

  // In fullscreen mode: up to 2 level-2 modules render as side-by-side panels.
  // In other modes: the first level-2+ module gets the overlay as before.
  const sidebarFillModules = layoutMode === 'fullscreen'
    ? allModulesToRender.filter(m => (m.sizeLevel ?? 1) === 2).slice(0, 2)
    : [];

  const expandedModule = allModulesToRender.find(m => {
    const level = m.sizeLevel ?? 1;
    // In fullscreen mode, L2 is handled by split panes — only L3 stays as portal overlay
    return layoutMode === 'fullscreen' ? level === 3 : level >= 2;
  }) ?? null;

  const normalModules = allModulesToRender.filter(m => (m.sizeLevel ?? 1) < 2);
  const expandedModuleLevel = expandedModule ? ((expandedModule.sizeLevel ?? 1) as 2 | 3) : null;

  const currentPageIndex = pages.findIndex(p => p.id === activePageId);

  // Measure sidebar bounds for ghost preview
  useEffect(() => {
    const el = sidebarRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      setSidebarBounds({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handlePrevPage = useCallback(() => {
    if (currentPageIndex > 0) {
      setSlideDir(-1);
      setActivePageId(pages[currentPageIndex - 1].id);
      sounds.play('pageSwitch');
    }
  }, [currentPageIndex, pages, setActivePageId]);

  const handleNextPage = useCallback(() => {
    if (currentPageIndex < pages.length - 1) {
      setSlideDir(1);
      setActivePageId(pages[currentPageIndex + 1].id);
      sounds.play('pageSwitch');
    }
  }, [currentPageIndex, pages, setActivePageId]);

  // ── Swipe gesture ─────────────────────────────────────────────────────────

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, select, [role="button"], [contenteditable="true"], [data-no-swipe]')) return;
    pointerDownRef.current = true;
    startXRef.current = e.clientX;
    startYRef.current = e.clientY;
    dirLockRef.current = null;
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerDownRef.current || dirLockRef.current === 'v') return;
    const dx = e.clientX - startXRef.current;
    const dy = e.clientY - startYRef.current;
    if (!dirLockRef.current && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      dirLockRef.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!pointerDownRef.current) return;
    pointerDownRef.current = false;

    if (dirLockRef.current !== 'h') return;

    const dx = e.clientX - startXRef.current;
    const containerWidth = sidebarContentRef.current?.offsetWidth ?? 350;
    const threshold = containerWidth * 0.25;

    if (dx > threshold) {
      handlePrevPage();
    } else if (dx < -threshold) {
      handleNextPage();
    }
  }, [handlePrevPage, handleNextPage]);

  // ── Module / page handlers ────────────────────────────────────────────────

  const handleAddModule = (moduleType: ModuleType) => {
    if (!activePageId) return;
    let defaultTitle = '';
    switch (moduleType) {
      case 'todo': defaultTitle = 'To-Do List'; break;
      case 'pomodoro': defaultTitle = 'Pomodoro'; break;
      case 'alarms': defaultTitle = 'Reminders'; break;
      case 'eisenhower': defaultTitle = 'Eisenhower Matrix'; break;
      case 'booking': defaultTitle = 'Booking'; break;
    }
    sounds.play('moduleAdd');
    addModule(activePageId, { type: moduleType, title: defaultTitle });
  };

  const handleRemoveModule = (moduleIndex: number) => {
    if (!activePageId) return;
    removeModule(activePageId, moduleIndex);
  };

  const handleUpdateModuleTitle = (moduleIndex: number, newTitle: string) => {
    if (!activePageId) return;
    updateModule(activePageId, moduleIndex, { title: newTitle });
  };

  const handleReorderModules = (fromIndex: number, toIndex: number) => {
    if (!activePageId) return;
    reorderModules(activePageId, fromIndex, toIndex);
  };

  const handleMoveModule = async (moduleIndex: number, targetPageId: string) => {
    if (!activePageId) return;
    await moveModule(activePageId, moduleIndex, targetPageId);
  };

  const handleSetModuleSizeLevel = (normalModuleIndex: number, level: SizeLevel) => {
    if (!activePageId || !setModuleSizeLevel) return;
    // normalModules is a filtered view; map back to the real index in allModulesToRender
    const moduleId = normalModules[normalModuleIndex]?.id;
    if (!moduleId) return;
    const realIndex = allModulesToRender.findIndex(m => m.id === moduleId);
    if (realIndex >= 0) setModuleSizeLevel(activePageId, realIndex, level);
  };

  // Close expanded overlay (step back to level 1)
  const handleCloseExpanded = () => {
    if (!expandedModule || !activePageId || !setModuleSizeLevel) return;
    const idx = allModulesToRender.findIndex(m => m.id === expandedModule.id);
    if (idx >= 0) setModuleSizeLevel(activePageId, idx, 1);
  };

  // Switch to a different expanded module (same level) — single atomic write to avoid race conditions
  const handleSwitchExpandedModule = (moduleId: string) => {
    if (!activePageId || !setModulesSizeLevels) return;
    const targetIdx = allModulesToRender.findIndex(m => m.id === moduleId);
    const currentIdx = expandedModule ? allModulesToRender.findIndex(m => m.id === expandedModule.id) : -1;
    const level = expandedModule?.sizeLevel ?? 2;

    if (targetIdx < 0 || targetIdx === currentIdx) return;

    // Determine slide direction before committing the state change
    setModuleSlideDir(targetIdx > currentIdx ? 1 : -1);

    const updates: Array<{ index: number; level: SizeLevel }> = [
      { index: targetIdx, level: level as SizeLevel },
    ];
    if (currentIdx >= 0) updates.push({ index: currentIdx, level: 1 });
    setModulesSizeLevels(activePageId, updates);
  };

  // Change the size level of the currently expanded module
  const handleExpandedSizeChange = (level: SizeLevel) => {
    if (!expandedModule || !activePageId || !setModuleSizeLevel) return;
    const idx = allModulesToRender.findIndex(m => m.id === expandedModule.id);
    if (idx >= 0) setModuleSizeLevel(activePageId, idx, level);
  };

  // L3 module fullscreen resizer — drag left to exit L3 and enter sidebar fullscreen
  const startL3Resize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    l3DragRef.current = true;
    l3StartXRef.current = e.clientX;

    const onMove = (ev: MouseEvent) => {
      if (!l3DragRef.current) return;
      const prog = Math.min(1, Math.max(0, (l3StartXRef.current - ev.clientX) / 80));
      setL3ResizeProgress(prog);
    };

    const onUp = (ev: MouseEvent) => {
      l3DragRef.current = false;
      const prog = Math.min(1, Math.max(0, (l3StartXRef.current - ev.clientX) / 80));
      setL3ResizeProgress(0);
      if (prog >= 0.6) {
        handleCloseExpanded();
        onSetLayoutMode?.('fullscreen');
      }
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Handle page change from within the overlay
  const handleOverlayChangePage = (pageId: string) => {
    const targetIdx = pages.findIndex(p => p.id === pageId);
    setSlideDir(targetIdx > currentPageIndex ? 1 : -1);
    // Close expanded first, then switch page
    handleCloseExpanded();
    setActivePageId(pageId);
    sounds.play('pageSwitch');
  };

  const handleCreateNewPage = async () => {
    const result = await createPage('New Page');
    if (result.success && result.pageId) {
      setSlideDir(1);
      setActivePageId(result.pageId);
    }
  };

  const handleDeletePage = async () => {
    if (!activePageId) return;
    await deletePage(activePageId);
  };

  const handleUpdatePageTitle = (newTitle: string) => {
    if (!activePageId) return;
    updatePage(activePageId, { title: newTitle });
  };

  // Find the real index of expanded module in allModulesToRender (for handlers)
  const expandedModuleOriginalIndex = expandedModule
    ? allModulesToRender.findIndex(m => m.id === expandedModule.id)
    : -1;

  if (loading) {
    return (
      <div className="h-full overflow-hidden flex flex-col items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <SidebarBoundsProvider value={sidebarBounds}>
      <div ref={sidebarRef} className="h-full overflow-hidden flex flex-col relative">
        {/* Header with page title */}
        <PageHeader
          title={activePage?.title || 'Untitled'}
          onUpdateTitle={handleUpdatePageTitle}
          onPrevPage={handlePrevPage}
          onNextPage={handleNextPage}
          onDeletePage={handleDeletePage}
          canGoToPrevPage={currentPageIndex > 0}
          canGoToNextPage={currentPageIndex < pages.length - 1}
          canDeletePage={pages.length > 1}
          onShare={!isSharedPage ? () => setPageShareSheetOpen(true) : undefined}
          isSharedPage={isSharedPage}
          sharedOwnerName={activePage?.sharedOwnerName}
        />

        {/* Page modules */}
        <div
          ref={sidebarContentRef}
          className="flex-1 overflow-hidden relative"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => { pointerDownRef.current = false; }}
        >
          {layoutMode === 'fullscreen' && sidebarFillModules.length > 0 ? (
            /* ── Fullscreen split-pane layout ── */
            <div className="absolute inset-0 flex overflow-hidden">
              {sidebarFillModules.map((mod, i) => {
                const realIdx = allModulesToRender.findIndex(m => m.id === mod.id);
                const panelWidth = Math.round((sidebarBounds?.width ?? window.innerWidth) / sidebarFillModules.length) - 32;
                return (
                  <React.Fragment key={mod.id}>
                    {i > 0 && (
                      <div className="w-px bg-border/40 flex-shrink-0 self-stretch my-6" />
                    )}
                    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                      <div className="flex justify-end px-3 pt-2">
                        <button
                          onClick={() => {
                            if (setModuleSizeLevel && activePageId) {
                              setModuleSizeLevel(activePageId, realIdx, 1);
                            }
                          }}
                          className="p-1.5 rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-colors opacity-40 hover:opacity-100"
                          title="Minimize to normal"
                        >
                          <Minimize2 size={14} />
                        </button>
                      </div>
                      <div className="flex-1 overflow-y-auto p-4 pt-1">
                        <ModuleRenderer
                          module={mod}
                          index={realIdx}
                          moduleWidth={panelWidth}
                          onRemove={() => handleRemoveModule(realIdx)}
                          onTitleChange={(title) => handleUpdateModuleTitle(realIdx, title)}
                          onToggleMinimize={() => {
                            if (setModuleSizeLevel && activePageId) {
                              setModuleSizeLevel(activePageId, realIdx, 1);
                            }
                          }}
                          onSizeChange={(level) => {
                            if (setModuleSizeLevel && activePageId) {
                              setModuleSizeLevel(activePageId, realIdx, level);
                            }
                          }}
                          isReadOnly={isStructureReadOnly}
                          contentReadOnly={isContentReadOnly}
                        />
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
              {/* Right panel: normal modules (when only 1 fill module is active) */}
              {sidebarFillModules.length === 1 && (
                <>
                  <div className="w-px bg-border/40 flex-shrink-0 self-stretch my-6" />
                  <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                    <div className="flex-1 overflow-y-auto p-4">
                      {!isSharedPage && <ModuleSelector onSelect={handleAddModule} />}
                      <ModuleGrid
                        modules={normalModules}
                        onRemoveModule={handleRemoveModule}
                        onUpdateModuleTitle={handleUpdateModuleTitle}
                        onReorderModules={handleReorderModules}
                        onMoveModule={handleMoveModule}
                        onSetModuleSizeLevel={isStructureReadOnly ? undefined : handleSetModuleSizeLevel}
                        moveTargets={pages.filter(p => p.id !== activePageId).map(p => ({ id: p.id, title: p.title }))}
                        pageIndex={currentPageIndex >= 0 ? currentPageIndex : 0}
                        isReadOnly={isStructureReadOnly}
                        contentReadOnly={isContentReadOnly}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            /* ── Normal / centered layout ── */
            <AnimatePresence mode="popLayout" custom={slideDir} initial={false}>
              <motion.div
                key={activePageId}
                custom={slideDir}
                variants={{
                  enter: (dir: number) => ({ x: `${dir * 100}%`, opacity: 0 }),
                  center: { x: 0, opacity: 1 },
                  exit: (dir: number) => ({ x: `${dir * -60}%`, opacity: 0 }),
                }}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                className={cn(
                  "absolute inset-0 overflow-y-auto p-4 pt-0",
                  layoutMode === 'fullscreen' && "flex flex-col items-center"
                )}
              >
                {/* In fullscreen (no L2 modules): center content with max-width */}
                <div className={cn(layoutMode === 'fullscreen' && "w-full max-w-4xl")}>
                  {!isSharedPage && <ModuleSelector onSelect={handleAddModule} />}
                  <ModuleGrid
                    modules={normalModules}
                    onRemoveModule={handleRemoveModule}
                    onUpdateModuleTitle={handleUpdateModuleTitle}
                    onReorderModules={handleReorderModules}
                    onMoveModule={handleMoveModule}
                    onSetModuleSizeLevel={isStructureReadOnly ? undefined : handleSetModuleSizeLevel}
                    moveTargets={pages
                      .filter(p => p.id !== activePageId)
                      .map(p => ({ id: p.id, title: p.title }))}
                    pageIndex={currentPageIndex >= 0 ? currentPageIndex : 0}
                    isReadOnly={isStructureReadOnly}
                    contentReadOnly={isContentReadOnly}
                  />
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        {/* Minimal Page Navigation Footer */}
        <div className="p-4 flex items-center justify-center gap-3">
          <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 px-3 py-2 rounded-full backdrop-blur-md">
            {pages.map((page, index) => (
              <button
                key={page.id}
                onClick={() => {
                  sounds.play('pageSwitch');
                  setSlideDir(index > currentPageIndex ? 1 : -1);
                  setActivePageId(page.id);
                }}
                className={cn(
                  'w-2.5 h-2.5 rounded-full transition-all duration-300',
                  index === currentPageIndex
                    ? 'bg-purple-600 w-4 shadow-lg shadow-purple-500/50'
                    : 'bg-gray-400 dark:bg-gray-600 hover:bg-gray-500'
                )}
                title={page.title}
              />
            ))}
            <button
              onClick={handleCreateNewPage}
              className="ml-1 p-0.5 rounded-full hover:bg-purple-500/20 text-gray-500 hover:text-purple-600 transition-colors"
              title="Create new page"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Layout modes pill */}
          {onSetLayoutMode && (
            <div className="flex items-center gap-1 bg-black/5 dark:bg-white/5 px-2 py-1.5 rounded-full backdrop-blur-md">
              <button
                onClick={() => onSetLayoutMode('normal')}
                title="Normal"
                className={cn(
                  'p-1.5 rounded-full transition-colors',
                  layoutMode === 'normal'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-purple-500/20'
                )}
              >
                <PanelLeft size={13} />
              </button>
              <button
                onClick={() => onSetLayoutMode('fullscreen')}
                title="Sidebar Full"
                className={cn(
                  'p-1.5 rounded-full transition-colors',
                  layoutMode === 'fullscreen'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-purple-500/20'
                )}
              >
                <Maximize2 size={13} />
              </button>
              <button
                onClick={() => onSetLayoutMode('hidden')}
                title="Full Calendar"
                className={cn(
                  'p-1.5 rounded-full transition-colors',
                  layoutMode === 'hidden'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-purple-500/20'
                )}
              >
                <CalendarDays size={13} />
              </button>
            </div>
          )}
        </div>

        {/* ── Level 2: Sidebar fill overlay — not used in fullscreen (split panes handle it) ── */}
        {layoutMode !== 'fullscreen' && <AnimatePresence>
          {expandedModule && expandedModuleLevel === 2 && (
            <ModuleExpandedOverlay
              key="L2-overlay"
              level={2}
              expandedModule={expandedModule}
              allModulesOnPage={allModulesToRender}
              pages={pages}
              currentPageId={activePageId ?? ''}
              currentSizeLevel={expandedModule.sizeLevel ?? 2}
              onChangePage={handleOverlayChangePage}
              onSwitchModule={handleSwitchExpandedModule}
              onSizeChange={handleExpandedSizeChange}
              onClose={handleCloseExpanded}
            >
              <div className="relative overflow-hidden h-full">
                <AnimatePresence custom={moduleSlideDir}>
                  <motion.div
                    key={expandedModule.id}
                    custom={moduleSlideDir}
                    variants={{
                      enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%' }),
                      center: { x: 0 },
                      exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%' }),
                    }}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                    className="absolute inset-0 overflow-y-auto p-4"
                  >
                    <ModuleRenderer
                      module={expandedModule}
                      index={expandedModuleOriginalIndex}
                      moduleWidth={sidebarBounds?.width ?? 320}
                      onRemove={() => handleRemoveModule(expandedModuleOriginalIndex)}
                      onTitleChange={(title) => handleUpdateModuleTitle(expandedModuleOriginalIndex, title)}
                      onToggleMinimize={() => handleCloseExpanded()}
                      onSizeChange={handleExpandedSizeChange}
                      isReadOnly={isStructureReadOnly}
                      contentReadOnly={isContentReadOnly}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </ModuleExpandedOverlay>
          )}
        </AnimatePresence>}

        {/* Page share sheet — owner only */}
        {!isSharedPage && activePageId && (
          <ManagePageAccessSheet
            pageId={activePageId}
            pageTitle={activePage?.title ?? 'Untitled'}
            modules={activePage?.modules ?? []}
            open={pageShareSheetOpen}
            onClose={() => setPageShareSheetOpen(false)}
          />
        )}
      </div>

      {/* ── Level 3: Fullscreen overlay (portal to body) ── */}
      {expandedModule && expandedModuleLevel === 3 && createPortal(
        <>
          <AnimatePresence>
            <ModuleExpandedOverlay
              key="L3-overlay"
              level={3}
              expandedModule={expandedModule}
              allModulesOnPage={allModulesToRender}
              pages={pages}
              currentPageId={activePageId ?? ''}
              currentSizeLevel={expandedModule.sizeLevel ?? 3}
              onChangePage={handleOverlayChangePage}
              onSwitchModule={handleSwitchExpandedModule}
              onSizeChange={handleExpandedSizeChange}
              onClose={handleCloseExpanded}
            >
              <div className="relative overflow-hidden h-full">
                <AnimatePresence custom={moduleSlideDir}>
                  <motion.div
                    key={expandedModule.id}
                    custom={moduleSlideDir}
                    variants={{
                      enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%' }),
                      center: { x: 0 },
                      exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%' }),
                    }}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                    className="absolute inset-0 overflow-y-auto"
                  >
                    <div className="p-4 max-w-5xl mx-auto">
                      <ModuleRenderer
                        module={expandedModule}
                        index={expandedModuleOriginalIndex}
                        moduleWidth={Math.min(window.innerWidth - 48, 1200)}
                        onRemove={() => handleRemoveModule(expandedModuleOriginalIndex)}
                        onTitleChange={(title) => handleUpdateModuleTitle(expandedModuleOriginalIndex, title)}
                        onToggleMinimize={() => handleCloseExpanded()}
                        onSizeChange={handleExpandedSizeChange}
                        isReadOnly={isStructureReadOnly}
                        contentReadOnly={isContentReadOnly}
                      />
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </ModuleExpandedOverlay>
          </AnimatePresence>

          {/* L3 resizer — drag left to exit module fullscreen and enter sidebar fullscreen */}
          {/* Container is pointer-events-none so it doesn't block overlay nav strip clicks */}
          <div
            className="fixed right-0 top-0 bottom-0 flex items-center justify-center w-6 z-[110] pointer-events-none"
          >
            <div
              className={cn(
                'w-2.5 rounded-full transition-all duration-500 ease-in-out pointer-events-auto cursor-ew-resize',
                l3DragRef.current
                  ? 'h-48 bg-white/30'
                  : 'h-16 bg-white/20 hover:bg-white/30 hover:h-24'
              )}
              style={{
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                background: 'linear-gradient(180deg, rgba(168,85,247,0.35) 0%, rgba(139,92,246,0.2) 100%)',
                border: '1px solid rgba(168,85,247,0.3)',
                boxShadow: '0 2px 8px rgba(139, 92, 246, 0.2)',
              }}
              onMouseDown={startL3Resize}
            />
            {l3ResizeProgress > 0 && (
              <div
                className="absolute pointer-events-none z-[60]"
                style={{ top: '50%', transform: 'translateY(-50%)', right: 'calc(100% + 10px)' }}
              >
                <div className="bg-gray-900/90 text-white rounded-2xl px-3.5 py-2.5 shadow-2xl border border-white/10 backdrop-blur-sm min-w-[150px]">
                  <p className="text-xs font-medium mb-2 opacity-90 text-center">← Sidebar Full</p>
                  <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-purple-400"
                      style={{ width: `${l3ResizeProgress * 100}%`, transition: 'width 50ms linear' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </>,
        document.body
      )}
    </SidebarBoundsProvider>
  );
};

export default SideBar;
