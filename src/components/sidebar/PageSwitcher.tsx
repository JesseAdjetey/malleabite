// Component for switching between sidebar pages
import React, { useState } from 'react';
import { useSidebarPages } from '@/hooks/use-sidebar-pages';
import {
  Home,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  ChevronDown,
  Folder,
  Briefcase,
  Star,
  Heart,
  Zap,
  Target,
  Calendar as CalendarIcon,
  BookOpen
} from 'lucide-react';
import { toast } from 'sonner';

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  home: Home,
  folder: Folder,
  briefcase: Briefcase,
  star: Star,
  heart: Heart,
  zap: Zap,
  target: Target,
  calendar: CalendarIcon,
  book: BookOpen
};

export const PageSwitcher: React.FC = () => {
  const {
    pages,
    activePage,
    activePageId,
    setActivePageId,
    createPage,
    updatePage,
    deletePage
  } = useSidebarPages();

  const [showDropdown, setShowDropdown] = useState(false);
  const [showNewPageDialog, setShowNewPageDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageIcon, setNewPageIcon] = useState('folder');

  const handleCreatePage = async () => {
    if (!newPageTitle.trim()) {
      toast.error('Page title cannot be empty');
      return;
    }

    const result = await createPage(newPageTitle, newPageIcon);
    if (result.success) {
      setShowNewPageDialog(false);
      setNewPageTitle('');
      setNewPageIcon('folder');
      if (result.pageId) {
        setActivePageId(result.pageId);
      }
    }
  };

  const handleUpdatePage = async () => {
    if (!editingPageId || !newPageTitle.trim()) return;

    const result = await updatePage(editingPageId, {
      title: newPageTitle,
      icon: newPageIcon
    });

    if (result.success) {
      setShowEditDialog(false);
      setEditingPageId(null);
      setNewPageTitle('');
      setNewPageIcon('folder');
    }
  };

  const handleDeletePage = async (pageId: string) => {
    if (!confirm('Are you sure you want to delete this page?')) return;

    await deletePage(pageId);
  };

  const startEditPage = (pageId: string) => {
    const page = pages.find(p => p.id === pageId);
    if (!page) return;

    setEditingPageId(pageId);
    setNewPageTitle(page.title);
    setNewPageIcon(page.icon || 'folder');
    setShowEditDialog(true);
    setShowDropdown(false);
  };

  const IconComponent = activePage?.icon 
    ? ICON_MAP[activePage.icon] || Folder 
    : Folder;

  return (
    <div className="relative">
      {/* Active Page Button */}
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center justify-between w-full glass-input hover:border-purple-400/50 transition-all"
      >
        <div className="flex items-center gap-2">
          <IconComponent className="w-4 h-4 text-purple-400" />
          <span className="font-medium text-foreground">
            {activePage?.title || 'Main'}
          </span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ${
            showDropdown ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />

          {/* Dropdown Content */}
          <div className="absolute top-full left-0 right-0 mt-2 glass-card z-50 max-h-96 overflow-y-auto">
            {/* Page List */}
            <div className="py-1">
              {pages.map((page) => {
                const PageIcon = page.icon ? ICON_MAP[page.icon] || Folder : Folder;
                const isActive = page.id === activePageId;

                return (
                  <div
                    key={page.id}
                    className={`group flex items-center justify-between px-3 py-2 hover:bg-purple-500/10 transition-colors ${
                      isActive ? 'bg-purple-500/20 border-l-2 border-purple-500' : ''
                    }`}
                  >
                    <button
                      onClick={() => {
                        setActivePageId(page.id!);
                        setShowDropdown(false);
                      }}
                      className="flex items-center gap-2 flex-1"
                    >
                      <PageIcon className={`w-4 h-4 ${isActive ? 'text-purple-400' : 'text-muted-foreground'}`} />
                      <span className={`text-sm ${isActive ? 'text-purple-400 font-medium' : 'text-foreground'}`}>
                        {page.title}
                      </span>
                      {page.isDefault && (
                        <span className="text-xs text-muted-foreground">(Default)</span>
                      )}
                    </button>

                    {/* Page Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditPage(page.id!);
                        }}
                        className="p-1 hover:bg-purple-500/20 rounded"
                        title="Edit page"
                      >
                        <Edit className="w-3 h-3 text-muted-foreground" />
                      </button>
                      {!page.isDefault && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePage(page.id!);
                          }}
                          className="p-1 hover:bg-red-500/20 rounded"
                          title="Delete page"
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Divider */}
            <div className="border-t border-white/10" />

            {/* New Page Button */}
            <button
              onClick={() => {
                setShowNewPageDialog(true);
                setShowDropdown(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-purple-400 hover:bg-purple-500/10 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>New Page</span>
            </button>
          </div>
        </>
      )}

      {/* New Page Dialog */}
      {showNewPageDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card p-6 w-96 max-w-[90vw]">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Create New Page
            </h3>

            <div className="space-y-4">
              {/* Page Title */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Page Name
                </label>
                <input
                  type="text"
                  value={newPageTitle}
                  onChange={(e) => setNewPageTitle(e.target.value)}
                  placeholder="e.g., Work, Personal, Projects"
                  className="w-full glass-input text-foreground"
                  autoFocus
                />
              </div>

              {/* Icon Selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Icon
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {Object.entries(ICON_MAP).map(([key, Icon]) => (
                    <button
                      key={key}
                      onClick={() => setNewPageIcon(key)}
                      className={`p-2 rounded-lg transition-all ${
                        newPageIcon === key
                          ? 'bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-lg shadow-purple-500/50'
                          : 'glass-input hover:border-purple-400/50'
                      }`}
                    >
                      <Icon className="w-5 h-5 mx-auto" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowNewPageDialog(false);
                  setNewPageTitle('');
                  setNewPageIcon('folder');
                }}
                className="px-4 py-2 glass-input hover:border-purple-400/50 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCreatePage}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white hover:shadow-lg hover:shadow-purple-500/50 rounded-lg transition-all"
              >
                Create Page
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Page Dialog */}
      {showEditDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card p-6 w-96 max-w-[90vw]">
            <h3 className="text-lg font-semibold text-foreground mb-4">
              Edit Page
            </h3>

            <div className="space-y-4">
              {/* Page Title */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Page Name
                </label>
                <input
                  type="text"
                  value={newPageTitle}
                  onChange={(e) => setNewPageTitle(e.target.value)}
                  className="w-full glass-input text-foreground"
                  autoFocus
                />
              </div>

              {/* Icon Selection */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Icon
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {Object.entries(ICON_MAP).map(([key, Icon]) => (
                    <button
                      key={key}
                      onClick={() => setNewPageIcon(key)}
                      className={`p-2 rounded-lg transition-all ${
                        newPageIcon === key
                          ? 'bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-lg shadow-purple-500/50'
                          : 'glass-input hover:border-purple-400/50'
                      }`}
                    >
                      <Icon className="w-5 h-5 mx-auto" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => {
                  setShowEditDialog(false);
                  setEditingPageId(null);
                  setNewPageTitle('');
                  setNewPageIcon('folder');
                }}
                className="px-4 py-2 glass-input hover:border-purple-400/50 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePage}
                className="px-4 py-2 bg-gradient-to-r from-purple-500 to-violet-600 text-white hover:shadow-lg hover:shadow-purple-500/50 rounded-lg transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
