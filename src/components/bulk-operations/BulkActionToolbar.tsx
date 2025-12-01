import { useState } from 'react';
import { CheckSquare, Square, Edit2, Trash2, Calendar, Palette, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface BulkActionToolbarProps {
  selectedCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkDelete: () => void;
  onBulkEdit: () => void;
  onBulkReschedule: () => void;
  onBulkChangeColor: (color: string) => void;
  onBulkDuplicate: () => void;
}

const COLORS = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#10b981', label: 'Green' },
  { value: '#f59e0b', label: 'Orange' },
  { value: '#ef4444', label: 'Red' },
  { value: '#ec4899', label: 'Pink' },
];

export function BulkActionToolbar({
  selectedCount,
  onSelectAll,
  onDeselectAll,
  onBulkDelete,
  onBulkEdit,
  onBulkReschedule,
  onBulkChangeColor,
  onBulkDuplicate,
}: BulkActionToolbarProps) {
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);

  if (selectedCount === 0) {
    return null;
  }

  const handleDelete = () => {
    if (window.confirm(`Delete ${selectedCount} event(s)?`)) {
      onBulkDelete();
      toast.success(`Deleted ${selectedCount} events`);
    }
  };

  const handleColorChange = (color: string) => {
    onBulkChangeColor(color);
    setIsColorPickerOpen(false);
    toast.success(`Changed color for ${selectedCount} events`);
  };

  const handleDuplicate = () => {
    onBulkDuplicate();
    toast.success(`Duplicated ${selectedCount} events`);
  };

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-4">
          {/* Selection Info */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm">
              {selectedCount} selected
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={onSelectAll}
              className="text-xs"
            >
              Select All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDeselectAll}
              className="text-xs"
            >
              <Square className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>

          <div className="w-px h-8 bg-gray-300 dark:bg-gray-600" />

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkEdit}
              className="gap-1"
            >
              <Edit2 className="h-4 w-4" />
              Edit
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onBulkReschedule}
              className="gap-1"
            >
              <Calendar className="h-4 w-4" />
              Reschedule
            </Button>

            {/* Color Picker */}
            <Select onValueChange={handleColorChange}>
              <SelectTrigger className="w-[120px] h-9">
                <Palette className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Color" />
              </SelectTrigger>
              <SelectContent>
                {COLORS.map((color) => (
                  <SelectItem key={color.value} value={color.value}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded-full"
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
              onClick={handleDuplicate}
              className="gap-1"
            >
              <Copy className="h-4 w-4" />
              Duplicate
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              className="gap-1"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
