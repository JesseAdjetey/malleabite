import { useState } from 'react';
import { Plus, Search, Star, Clock, Trash2, Edit, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTemplates } from '@/hooks/use-templates';
import { TemplateForm } from './TemplateForm';
import type { EventTemplate } from '@/types/template';

interface TemplateLibraryProps {
  onApplyTemplate?: (template: EventTemplate) => void;
}

export function TemplateLibrary({ onApplyTemplate }: TemplateLibraryProps) {
  const {
    filteredTemplates,
    favoriteTemplates,
    mostUsedTemplates,
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

  const filteredBySearch = filteredTemplates.filter((template) => {
    const matchesSearch =
      searchQuery === '' ||
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase());

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
    await useTemplate(template.id);
    onApplyTemplate?.(template);
  };

  const handleDelete = async (template: EventTemplate) => {
    if (window.confirm(`Delete template "${template.name}"?`)) {
      await deleteTemplate(template.id);
    }
  };

  const TemplateCard = ({ template }: { template: EventTemplate }) => (
    <Card className="p-3 hover:shadow-md transition-shadow">
      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: template.color }}
              />
              <h4 className="font-semibold text-sm truncate">{template.name}</h4>
              <button
                onClick={() => toggleFavorite(template.id)}
                className="text-yellow-500 hover:scale-110 transition-transform flex-shrink-0"
              >
                <Star
                  className="h-3.5 w-3.5"
                  fill={template.isFavorite ? 'currentColor' : 'none'}
                />
              </button>
            </div>
            {template.description && (
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {template.description}
              </p>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-0.5">
              <Clock className="h-3 w-3" />
              {template.duration}m
            </div>
            <Badge variant="outline" className="text-[10px] h-5 px-1.5">
              {template.category}
            </Badge>
            <span className="text-[10px]">Used {template.usageCount}x</span>
          </div>

          <div className="text-xs truncate">
            <span className="font-medium">Title:</span> {template.title}
          </div>

          {template.tags && template.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {template.tags.slice(0, 2).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px] h-5 px-1.5">
                  {tag}
                </Badge>
              ))}
              {template.tags.length > 2 && (
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                  +{template.tags.length - 2}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 pt-2 border-t">
          <Button
            size="sm"
            variant="default"
            className="flex-1 h-8 text-xs"
            onClick={() => handleApply(template)}
          >
            <Calendar className="h-3 w-3 mr-1" />
            Apply
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => {
              setEditingTemplate(template);
              setShowForm(true);
            }}
          >
            <Edit className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => handleDelete(template)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base sm:text-lg font-semibold">Event Templates</h2>
          <p className="text-xs text-muted-foreground">
            Save time with reusable event templates
          </p>
        </div>
        <Button size="sm" className="h-8 text-xs" onClick={() => setShowForm(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          New Template
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>

      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList className="h-9 w-full grid grid-cols-5 p-1">
          <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
          <TabsTrigger value="work" className="text-xs">Work</TabsTrigger>
          <TabsTrigger value="personal" className="text-xs">Personal</TabsTrigger>
          <TabsTrigger value="health" className="text-xs">Health</TabsTrigger>
          <TabsTrigger value="social" className="text-xs">Social</TabsTrigger>
        </TabsList>

        <TabsContent value={activeCategory} className="space-y-4 mt-3">
          {/* Favorites Section */}
          {favoriteTemplates.length > 0 && activeCategory === 'all' && (
            <div>
              <h3 className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <Star className="h-4 w-4 text-yellow-500" fill="currentColor" />
                Favorites
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {favoriteTemplates.slice(0, 2).map((template) => (
                  <TemplateCard key={template.id} template={template} />
                ))}
              </div>
            </div>
          )}

          {/* All Templates */}
          <div>
            <h3 className="text-sm font-medium mb-2">
              {activeCategory === 'all' ? 'All Templates' : 'Templates'}
            </h3>
            {isLoading ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                Loading templates...
              </div>
            ) : filteredBySearch.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm mb-3">No templates found</p>
                <Button size="sm" onClick={() => setShowForm(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Create Your First Template
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredBySearch.map((template) => (
                  <TemplateCard key={template.id} template={template} />
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
    </div>
  );
}
