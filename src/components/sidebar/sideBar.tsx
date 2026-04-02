import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSidebarPages, useSharedPageModules } from '@/hooks/use-sidebar-pages';
import { ModuleType } from '@/lib/store';
import { sounds } from '@/lib/sounds';
import ModuleSelector from '../modules/ModuleSelector';
import PageHeader from './PageHeader';
import ModuleGrid from './ModuleGrid';
import ManagePageAccessSheet from './sharing/ManagePageAccessSheet';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const SideBar = () => {
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
    loading
  } = useSidebarPages();

  const sidebarContentRef = useRef<HTMLDivElement>(null);
  const [pageShareSheetOpen, setPageShareSheetOpen] = useState(false);
  const [slideDir, setSlideDir] = useState<1 | -1>(1);

  // Swipe gesture state
  const pointerDownRef = useRef(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const dirLockRef = useRef<'h' | 'v' | null>(null);

  const isSharedPage = !!activePage?.sharedFromPageId;
  const isStructureReadOnly = isSharedPage;
  const isContentReadOnly = activePage?.sharedRole === 'viewer';

  const { modules: sharedModules } = useSharedPageModules(activePage?.sharedFromPageId);
  const modulesToRender = isSharedPage ? sharedModules : (activePage?.modules ?? []);

  const currentPageIndex = pages.findIndex(p => p.id === activePageId);

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
      case 'invites': defaultTitle = 'Event Invites'; break;
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

  if (loading) {
    return (
      <div className="h-full overflow-hidden flex flex-col items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden flex flex-col">
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
            className="absolute inset-0 overflow-y-auto p-4 pt-0"
          >
            {!isSharedPage && <ModuleSelector onSelect={handleAddModule} />}
            <ModuleGrid
              modules={modulesToRender}
              onRemoveModule={handleRemoveModule}
              onUpdateModuleTitle={handleUpdateModuleTitle}
              onReorderModules={handleReorderModules}
              onMoveModule={handleMoveModule}
              moveTargets={pages
                .filter(p => p.id !== activePageId)
                .map(p => ({ id: p.id, title: p.title }))}
              pageIndex={currentPageIndex >= 0 ? currentPageIndex : 0}
              isReadOnly={isStructureReadOnly}
              contentReadOnly={isContentReadOnly}
            />
          </motion.div>
        </AnimatePresence>
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
      </div>

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
  );
};

export default SideBar;
