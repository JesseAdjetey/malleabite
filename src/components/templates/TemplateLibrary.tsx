import { useState } from 'react';
import { Plus, Search, Star, Clock, Tag, Trash2, Edit, Calendar } from 'lucide-react';
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
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: template.color }}
              />
              <h4 className="font-semibold">{template.name}</h4>
              <button
                onClick={() => toggleFavorite(template.id)}
                className="text-yellow-500 hover:scale-110 transition-transform"
              >
                <Star
                  className="h-4 w-4"
                  fill={template.isFavorite ? 'currentColor' : 'none'}
                />
              </button>
            </div>
            {template.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {template.description}
              </p>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="space-y-2">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {template.duration} min
            </div>
            <Badge variant="outline" className="text-xs">
              {template.category}
            </Badge>
          </div>

          <div className="text-sm">
            <span className="font-medium">Title:</span> {template.title}
          </div>

          {template.location && (
            <div className="text-sm">
              <span className="font-medium">Location:</span> {template.location}
            </div>
          )}

          {template.tags && template.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {template.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  <Tag className="h-3 w-3 mr-1" />
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Used {template.usageCount} times
            {template.lastUsed && (
              <> · Last: {new Date(template.lastUsed).toLocaleDateString()}</>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t">
          <Button
            size="sm"
            variant="default"
            className="flex-1"
            onClick={() => handleApply(template)}
          >
            <Calendar className="h-3 w-3 mr-1" />
            Apply
          </Button>
          <Button
            size="sm"
            variant="outline"
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
            onClick={() => handleDelete(template)}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Event Templates</h2>
          <p className="text-muted-foreground">
            Save time with reusable event templates
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <Tabs value={activeCategory} onValueChange={setActiveCategory}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="work">Work</TabsTrigger>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="social">Social</TabsTrigger>
        </TabsList>

        <TabsContent value={activeCategory} className="space-y-6">
          {/* Favorites Section */}
          {favoriteTemplates.length > 0 && activeCategory === 'all' && (
            <div>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" fill="currentColor" />
                Favorites
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {favoriteTemplates.slice(0, 3).map((template) => (
                  <TemplateCard key={template.id} template={template} />
                ))}
              </div>
            </div>
          )}

          {/* Most Used Section */}
          {mostUsedTemplates.length > 0 && activeCategory === 'all' && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Most Used</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {mostUsedTemplates.slice(0, 3).map((template) => (
                  <TemplateCard key={template.id} template={template} />
                ))}
              </div>
            </div>
          )}

          {/* All Templates */}
          <div>
            <h3 className="text-lg font-semibold mb-3">
              {activeCategory === 'all' ? 'All Templates' : 'Templates'}
            </h3>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading templates...
              </div>
            ) : filteredBySearch.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">No templates found</p>
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Template
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
