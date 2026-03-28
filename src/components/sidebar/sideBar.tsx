import React, { useRef, useState } from 'react';
import { useSidebarPages, useSharedPageModules } from '@/hooks/use-sidebar-pages';
import { ModuleType } from '@/lib/store';
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

  const isSharedPage = !!activePage?.sharedFromPageId;
  // Structural lock: all shared pages (viewer + editor) can't rename/delete/reorder modules
  const isStructureReadOnly = isSharedPage;
  // Content lock: only viewers can't edit module content (todos etc.)
  const isContentReadOnly = activePage?.sharedRole === 'viewer';

  // For shared pages: listen to owner's page modules in real-time
  const { modules: sharedModules } = useSharedPageModules(activePage?.sharedFromPageId);

  // Modules to render — owner's live data for shared pages, own data otherwise
  const modulesToRender = isSharedPage ? sharedModules : (activePage?.modules ?? []);

  // Find current page index for navigation
  const currentPageIndex = pages.findIndex(p => p.id === activePageId);

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setActivePageId(pages[currentPageIndex - 1].id);
    }
  };

  const handleNextPage = () => {
    if (currentPageIndex < pages.length - 1) {
      setActivePageId(pages[currentPageIndex + 1].id);
    }
  };

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
    const title = 'New Page';
    const result = await createPage(title);
    if (result.success && result.pageId) {
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

      {/* Page modules with responsive grid */}
      <div
        ref={sidebarContentRef}
        className="flex-1 overflow-y-auto p-4 pt-0"
      >
        {/* Hide module selector for shared pages — owner controls page structure */}
        {!isSharedPage && <ModuleSelector onSelect={handleAddModule} />}

        {/* Module container */}
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
      </div>

      {/* Minimal Page Navigation Footer */}
      <div className="p-4 flex items-center justify-center gap-3">
        <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 px-3 py-2 rounded-full backdrop-blur-md">
          {pages.map((page, index) => (
            <button
              key={page.id}
              onClick={() => setActivePageId(page.id)}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-all duration-300",
                index === currentPageIndex
                  ? "bg-purple-600 w-4 shadow-lg shadow-purple-500/50"
                  : "bg-gray-400 dark:bg-gray-600 hover:bg-gray-500"
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
