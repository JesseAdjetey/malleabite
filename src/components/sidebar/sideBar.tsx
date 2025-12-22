
import React, { useRef } from 'react';
import { useSidebarPages } from '@/hooks/use-sidebar-pages';
import { ModuleType } from '@/lib/store';
import ModuleSelector from '../modules/ModuleSelector';
import PageHeader from './PageHeader';
import ModuleGrid from './ModuleGrid';
import NewPageCreator from './NewPageCreator';

const SideBar = () => {
  const {
    pages,
    activePage,
    activePageId,
    setActivePageId,
    createPage,
    updatePage,
    addModule,
    removeModule,
    updateModule,
    reorderModules,
    loading
  } = useSidebarPages();

  const sidebarContentRef = useRef<HTMLDivElement>(null);

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

  const handleCreateNewPage = async (title: string) => {
    const result = await createPage(title);
    if (result.success && result.pageId) {
      setActivePageId(result.pageId);
    }
  };

  const handleUpdatePageTitle = (newTitle: string) => {
    if (!activePageId) return;
    updatePage(activePageId, { title: newTitle });
  };

  if (loading) {
    return (
      <div className="glass-sidebar h-full overflow-hidden flex flex-col bg-white/50 dark:bg-black/20 items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="glass-sidebar h-full overflow-hidden flex flex-col bg-white/50 dark:bg-black/20">
      {/* New Page Creator - at top */}
      <div className="p-3 border-b border-gray-200 dark:border-white/10">
        <NewPageCreator onCreatePage={handleCreateNewPage} />
      </div>

      {/* Header with page title and navigation */}
      <PageHeader
        title={activePage?.title || 'Untitled'}
        onUpdateTitle={handleUpdatePageTitle}
        onPrevPage={handlePrevPage}
        onNextPage={handleNextPage}
        canGoToPrevPage={currentPageIndex > 0}
        canGoToNextPage={currentPageIndex < pages.length - 1}
      />

      {/* Page modules with responsive grid */}
      <div
        ref={sidebarContentRef}
        className="flex-1 overflow-y-auto p-3"
      >
        <ModuleSelector onSelect={handleAddModule} />

        {/* Module container - uses grid for two columns or flex for one column */}
        <ModuleGrid
          modules={activePage?.modules || []}
          onRemoveModule={handleRemoveModule}
          onUpdateModuleTitle={handleUpdateModuleTitle}
          onReorderModules={handleReorderModules}
          pageIndex={currentPageIndex >= 0 ? currentPageIndex : 0}
        />
      </div>
    </div>
  );
};

export default SideBar;
