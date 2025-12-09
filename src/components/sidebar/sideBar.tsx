
import React, { useRef } from 'react';
import { useSidebarStore, ModuleType } from '@/lib/store';
import ModuleSelector from '../modules/ModuleSelector';
import PageHeader from './PageHeader';
import ModuleGrid from './ModuleGrid';
import NewPageCreator from './NewPageCreator';

const SideBar = () => {
  const {
    pages,
    currentPageIndex,
    setCurrentPage,
    addModule,
    removeModule,
    updatePageTitle,
    addPage,
    updateModuleTitle,
    reorderModules
  } = useSidebarStore();

  const sidebarContentRef = useRef<HTMLDivElement>(null);

  const handlePrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPage(currentPageIndex - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPageIndex < pages.length - 1) {
      setCurrentPage(currentPageIndex + 1);
    }
  };

  const handleAddModule = (moduleType: ModuleType) => {
    addModule(currentPageIndex, moduleType);
  };

  const handleRemoveModule = (moduleIndex: number) => {
    removeModule(currentPageIndex, moduleIndex);
  };

  const handleUpdateModuleTitle = (moduleIndex: number, newTitle: string) => {
    updateModuleTitle(currentPageIndex, moduleIndex, newTitle);
  };

  const handleReorderModules = (fromIndex: number, toIndex: number) => {
    reorderModules(currentPageIndex, fromIndex, toIndex);
  };

  const handleCreateNewPage = (title: string) => {
    addPage(title);
    setCurrentPage(pages.length); // Switch to the newly added page
  };

  return (
    <div className="glass-sidebar h-full overflow-hidden flex flex-col bg-black/20">
      {/* New Page Creator - at top */}
      <div className="p-3 border-b border-white/10">
        <NewPageCreator onCreatePage={handleCreateNewPage} />
      </div>

      {/* Header with page title and navigation */}
      <PageHeader
        title={pages[currentPageIndex]?.title || 'Untitled'}
        onUpdateTitle={(newTitle) => updatePageTitle(currentPageIndex, newTitle)}
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
          modules={pages[currentPageIndex]?.modules || []}
          onRemoveModule={handleRemoveModule}
          onUpdateModuleTitle={handleUpdateModuleTitle}
          onReorderModules={handleReorderModules}
          pageIndex={currentPageIndex}
        />
      </div>
    </div>
  );
};

export default SideBar;
