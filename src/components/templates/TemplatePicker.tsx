import { FileText, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useTemplates } from '@/hooks/use-templates';
import type { EventTemplate } from '@/types/template';

interface TemplatePickerProps {
  onSelectTemplate: (template: EventTemplate) => void;
}

export function TemplatePicker({ onSelectTemplate }: TemplatePickerProps) {
  const { favoriteTemplates, mostUsedTemplates } = useTemplates();

  const displayTemplates = favoriteTemplates.length > 0 
    ? favoriteTemplates.slice(0, 5) 
    : mostUsedTemplates.slice(0, 5);

  if (displayTemplates.length === 0) {
    return null;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <FileText className="h-4 w-4" />
          Use Template
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">Quick Templates</h4>
            <Badge variant="secondary" className="text-xs">
              {displayTemplates.length}
            </Badge>
          </div>
          
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {displayTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => onSelectTemplate(template)}
                className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: template.color }}
                      />
                      <span className="font-medium text-sm">{template.name}</span>
                      {template.isFavorite && (
                        <Star className="h-3 w-3 text-yellow-500" fill="currentColor" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {template.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {template.duration} min
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {template.category}
                      </Badge>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
          
          <div className="pt-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => window.open('/templates', '_blank')}
            >
              Browse All Templates →
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
