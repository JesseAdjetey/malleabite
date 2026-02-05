import React, { useState, useMemo } from 'react';
import ModuleContainer from './ModuleContainer';
import { FileText, Plus, Star, Clock, Trash2, Edit2, Calendar } from 'lucide-react';
import { useTemplates } from '@/hooks/use-templates';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { useDateStore } from '@/lib/store';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical } from 'lucide-react';
import type { EventTemplate } from '@/types/template';
import dayjs from 'dayjs';

interface TemplatesModuleProps {
  title?: string;
  onRemove?: () => void;
  onTitleChange?: (title: string) => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
  isDragging?: boolean;
}

const TemplatesModule: React.FC<TemplatesModuleProps> = ({
  title = "Templates",
  onRemove,
  onTitleChange,
  onMinimize,
  isMinimized = false,
  isDragging = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [timeDialogOpen, setTimeDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EventTemplate | null>(null);
  const [selectedTime, setSelectedTime] = useState('09:00');
  
  const { 
    templates, 
    favoriteTemplates, 
    mostUsedTemplates,
    isLoading, 
    useTemplate, 
    toggleFavorite,
    deleteTemplate,
    applyTemplate 
  } = useTemplates();
  
  const { addEvent } = useCalendarEvents();
  const { userSelectedDate } = useDateStore();

  // Filter templates based on search
  const filteredTemplates = useMemo(() => {
    if (!searchQuery.trim()) {
      // Show favorites first, then most used
      const favorites = favoriteTemplates;
      const others = templates.filter(t => !t.isFavorite);
      return [...favorites, ...others];
    }
    
    const query = searchQuery.toLowerCase();
    return templates.filter(t => 
      t.name.toLowerCase().includes(query) ||
      t.title.toLowerCase().includes(query) ||
      t.category.toLowerCase().includes(query)
    );
  }, [templates, favoriteTemplates, searchQuery]);

  const handleUseTemplate = (template: EventTemplate) => {
    setSelectedTemplate(template);
    setTimeDialogOpen(true);
  };

  const handleConfirmUseTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      // Create the start time from selected date and time
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const startTime = userSelectedDate.hour(hours).minute(minutes).toDate();
      
      // Apply template to get event data
      const eventData = applyTemplate(selectedTemplate, startTime);
      
      // Create the event
      const result = await addEvent({
        ...eventData,
        id: crypto.randomUUID(),
        description: eventData.notes || '',
        date: userSelectedDate.format('YYYY-MM-DD'),
        startsAt: eventData.start,
        endsAt: eventData.end,
        isAllDay: eventData.isAllDay || false,
      });

      if (result.success) {
        // Increment usage count
        await useTemplate(selectedTemplate.id);
        toast.success(`Created "${selectedTemplate.title}" from template`);
      } else {
        toast.error('Failed to create event from template');
      }
    } catch (error) {
      console.error('Error using template:', error);
      toast.error('Failed to create event from template');
    } finally {
      setTimeDialogOpen(false);
      setSelectedTemplate(null);
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent, template: EventTemplate) => {
    e.stopPropagation();
    const success = await toggleFavorite(template.id);
    if (success) {
      toast.success(template.isFavorite ? 'Removed from favorites' : 'Added to favorites');
    }
  };

  const handleDeleteTemplate = async (e: React.MouseEvent, template: EventTemplate) => {
    e.stopPropagation();
    const success = await deleteTemplate(template.id);
    if (success) {
      toast.success('Template deleted');
    } else {
      toast.error('Failed to delete template');
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'work': return 'bg-blue-500';
      case 'personal': return 'bg-green-500';
      case 'health': return 'bg-red-500';
      case 'social': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <ModuleContainer
      title={title}
      onRemove={onRemove}
      onTitleChange={onTitleChange}
      onMinimize={onMinimize}
      isMinimized={isMinimized}
      isDragging={isDragging}
    >
      <div className="p-3 space-y-3">
        {/* Search */}
        <Input
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-8 text-sm"
        />

        {/* Templates List */}
        <ScrollArea className="h-[250px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-20 text-muted-foreground text-sm">
              Loading templates...
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 text-muted-foreground text-sm">
              <FileText className="h-8 w-8 mb-2 opacity-50" />
              <p>No templates yet</p>
              <p className="text-xs">Create templates to quickly add events</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  onClick={() => handleUseTemplate(template)}
                  className="p-2 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: template.color }}
                        />
                        <span className="font-medium text-sm truncate">{template.name}</span>
                        {template.isFavorite && (
                          <Star className="h-3 w-3 text-yellow-500 flex-shrink-0" fill="currentColor" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Badge variant="outline" className={`text-[10px] py-0 ${getCategoryColor(template.category)} text-white border-0`}>
                          {template.category}
                        </Badge>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(template.duration)}
                        </span>
                        {template.usageCount > 0 && (
                          <span className="text-muted-foreground">
                            Used {template.usageCount}x
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => handleToggleFavorite(e, template)}>
                          <Star className="h-4 w-4 mr-2" />
                          {template.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={(e) => handleDeleteTemplate(e, template)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Quick Stats */}
        {templates.length > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
            <span>{templates.length} template{templates.length !== 1 ? 's' : ''}</span>
            <span>{favoriteTemplates.length} favorite{favoriteTemplates.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Time Selection Dialog */}
      <Dialog open={timeDialogOpen} onOpenChange={setTimeDialogOpen}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Use Template
            </DialogTitle>
          </DialogHeader>
          
          {selectedTemplate && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: selectedTemplate.color }}
                  />
                  <span className="font-medium">{selectedTemplate.title}</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Duration: {formatDuration(selectedTemplate.duration)}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Start Time on {userSelectedDate.format('MMM D, YYYY')}
                </label>
                <Input
                  type="time"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTimeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmUseTemplate}>
              Create Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleContainer>
  );
};

export default TemplatesModule;
