// Templates Page - Mobile-First Design
import { useState } from 'react';
import { Plus, Search, Star, Clock, Trash2, Edit, Calendar, ChevronRight, ChevronLeft, LayoutTemplate, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { useTemplates } from '@/hooks/use-templates';
import { TemplateForm } from '@/components/templates/TemplateForm';
import type { EventTemplate } from '@/types/template';
import MobileNavigation from '@/components/MobileNavigation';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';
import { haptics } from '@/lib/haptics';

const categories = [
  { id: 'all', label: 'All', emoji: '📋' },
  { id: 'work', label: 'Work', emoji: '💼' },
  { id: 'personal', label: 'Personal', emoji: '🏠' },
  { id: 'health', label: 'Health', emoji: '💪' },
  { id: 'social', label: 'Social', emoji: '👥' },
];

export default function Templates() {
  const {
    filteredTemplates,
    favoriteTemplates,
    isLoading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    toggleFavorite,
    useTemplate,
  } = useTemplates();

  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EventTemplate | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showSearch, setShowSearch] = useState(false);
  const navigate = useNavigate();

  const filteredBySearch = filteredTemplates.filter((template) => {
    const matchesSearch =
      searchQuery === '' ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.title.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      activeCategory === 'all' || template.category === activeCategory;

    return matchesSearch && matchesCategory;
  });

  const handleCreateOrUpdate = async (data: any) => {
    if (editingTemplate) {
      await updateTemplate(editingTemplate.id, data);
    } else {
      await createTemplate(data);
    }
    setShowForm(false);
    setEditingTemplate(undefined);
  };

  const handleApply = async (template: EventTemplate) => {
    haptics.light();
    await useTemplate(template.id);
  };

  const handleDelete = async (template: EventTemplate) => {
    if (window.confirm(`Delete "${template.name}"?`)) {
      haptics.warning();
      await deleteTemplate(template.id);
    }
  };

  // Template Card Component
  const TemplateCard = ({ template }: { template: EventTemplate }) => (
    <div className="p-4 rounded-2xl bg-card border border-border/50 transition-all">
      <div className="flex items-start gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: template.color + '18' }}
        >
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: template.color }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-subheadline font-semibold truncate">{template.name}</h3>
            {template.isFavorite && (
              <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-caption1 text-muted-foreground truncate">{template.title}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <Badge variant="outline" className="text-caption2 h-5 px-2">
          <Clock className="h-2.5 w-2.5 mr-1" />
          {template.duration}m
        </Badge>
        <Badge variant="outline" className="text-caption2 h-5 px-2">
          {template.category}
        </Badge>
        <span className="text-caption2 text-muted-foreground ml-auto">
          Used {template.usageCount}x
        </span>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => handleApply(template)}
          className="flex-1 py-2.5 rounded-xl bg-primary/10 text-primary text-subheadline font-medium transition-colors hover:bg-primary/20 active:scale-[0.97] flex items-center justify-center gap-1.5"
        >
          <Calendar className="h-4 w-4" />
          Apply
        </button>
        <button
          onClick={() => { haptics.selection(); toggleFavorite(template.id); }}
          className="w-11 h-11 rounded-xl bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors active:scale-95"
        >
          <Star className={cn(
            "h-4 w-4",
            template.isFavorite ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"
          )} />
        </button>
        <button
          onClick={() => {
            haptics.light();
            setEditingTemplate(template);
            setShowForm(true);
          }}
          className="w-11 h-11 rounded-xl bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors active:scale-95"
        >
          <Edit className="h-4 w-4 text-muted-foreground" />
        </button>
        <button
          onClick={() => handleDelete(template)}
          className="w-11 h-11 rounded-xl bg-muted/60 hover:bg-destructive/10 flex items-center justify-center transition-colors group active:scale-95"
        >
          <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-destructive" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-5 pt-6 max-w-lg mx-auto space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-large-title font-bold">Templates</h1>
            <p className="text-subheadline text-muted-foreground">Reusable event templates</p>
          </div>
          <button
            onClick={() => { haptics.light(); setShowForm(true); }}
            className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center transition-all active:scale-95"
          >
            <Plus className="h-5 w-5 text-primary-foreground" />
          </button>
        </div>

        {/* Search */}
        {showSearch ? (
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchQuery('');
              }}
              className="w-11 h-11 rounded-xl bg-muted/60 hover:bg-muted flex items-center justify-center transition-colors active:scale-95"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowSearch(true)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/60 border border-border/50 text-muted-foreground text-subheadline"
          >
            <Search className="h-4 w-4" />
            Search templates...
          </button>
        )}

        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => { haptics.selection(); setActiveCategory(cat.id); }}
              className={cn(
                "flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-full text-subheadline whitespace-nowrap transition-all active:scale-95",
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground font-medium"
                  : "bg-muted/60 border border-border/50 hover:bg-muted"
              )}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>

        {/* Favorites Section */}
        {favoriteTemplates.length > 0 && activeCategory === 'all' && !searchQuery && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
              <p className="text-caption1 font-medium text-muted-foreground uppercase tracking-wider">Favorites</p>
            </div>
            <div className="grid gap-3">
              {favoriteTemplates.slice(0, 2).map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          </div>
        )}

        {/* Templates List */}
        <div className="space-y-3">
          {activeCategory === 'all' && !searchQuery && favoriteTemplates.length > 0 && (
            <p className="text-caption1 font-medium text-muted-foreground uppercase tracking-wider px-1">
              All Templates
            </p>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filteredBySearch.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-4">
                <LayoutTemplate className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-headline font-semibold mb-1">No templates yet</p>
              <p className="text-subheadline text-muted-foreground mb-6">
                Create your first template to save time
              </p>
              <button
                onClick={() => { haptics.light(); setShowForm(true); }}
                className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-[0.97]"
              >
                <Plus className="h-4 w-4 inline mr-2" />
                Create Template
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredBySearch.map((template) => (
                <TemplateCard key={template.id} template={template} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <TemplateForm
            template={editingTemplate}
            onSubmit={handleCreateOrUpdate}
            onCancel={() => {
              setShowForm(false);
              setEditingTemplate(undefined);
            }}
          />
        </DialogContent>
      </Dialog>

      <MobileNavigation />
    </div>
  );
}
