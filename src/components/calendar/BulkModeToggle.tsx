import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckSquare, X, Trash2, Palette, Clock, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BulkModeToggleProps {
  isBulkMode: boolean;
  onToggle: () => void;
  selectedCount?: number;
  onDelete?: () => void;
  onUpdateColor?: (color: string) => void;
  onReschedule?: (days: number) => void;
  onDuplicate?: () => void;
  onDeselectAll?: () => void;
}

const colors = [
  { value: '#ef4444', label: 'Red' },
  { value: '#f97316', label: 'Orange' },
  { value: '#eab308', label: 'Yellow' },
  { value: '#22c55e', label: 'Green' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#6b7280', label: 'Gray' },
];

const BulkModeToggle: React.FC<BulkModeToggleProps> = ({
  isBulkMode,
  onToggle,
  selectedCount = 0,
  onDelete,
  onUpdateColor,
  onReschedule,
  onDuplicate,
  onDeselectAll,
}) => {
  const showActions = isBulkMode && selectedCount > 0;

  return (
    <HoverCard openDelay={100} closeDelay={200}>
      <HoverCardTrigger asChild>
        <Button
          variant={isBulkMode ? "default" : "outline"}
          size="sm"
          onClick={onToggle}
          className={cn(
            "relative transition-all",
            isBulkMode 
              ? "bg-primary hover:bg-primary/90 text-white" 
              : "text-gray-700 dark:text-white border-gray-300 dark:border-white/20 hover:bg-gray-100 dark:hover:bg-white/10"
          )}
        >
          {isBulkMode ? (
            <>
              <X className="h-4 w-4 mr-1" />
              <span>Exit Bulk Mode</span>
              {selectedCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                  {selectedCount}
                </span>
              )}
            </>
          ) : (
            <>
              <CheckSquare className="h-4 w-4 mr-1" />
              <span>Bulk Edit</span>
            </>
          )}
        </Button>
      </HoverCardTrigger>
      <HoverCardContent className="w-auto p-3" align="center" side="bottom">
        {showActions ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-center">
              {selectedCount} event{selectedCount !== 1 ? 's' : ''} selected
            </p>
            <div className="flex flex-wrap items-center gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={onDelete}
                className="hover:bg-red-50 hover:text-red-600 hover:border-red-300"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>

              <Select onValueChange={onUpdateColor}>
                <SelectTrigger className="w-[110px] h-8">
                  <Palette className="h-4 w-4 mr-1" />
                  <SelectValue placeholder="Color" />
                </SelectTrigger>
                <SelectContent>
                  {colors.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-3 w-3 rounded-full border" 
                          style={{ backgroundColor: color.value }}
                        />
                        {color.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                onClick={() => onReschedule?.(1)}
              >
                <Clock className="h-4 w-4 mr-1" />
                +1 Day
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={onDuplicate}
              >
                <Copy className="h-4 w-4 mr-1" />
                Duplicate
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDeselectAll}
              className="w-full text-muted-foreground"
            >
              Deselect All
            </Button>
          </div>
        ) : isBulkMode ? (
          <p className="text-sm text-muted-foreground">
            Click on events to select them
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Select multiple events for bulk operations
          </p>
        )}
      </HoverCardContent>
    </HoverCard>
  );
};

export default BulkModeToggle;
