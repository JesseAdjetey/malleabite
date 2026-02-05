import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trash2, Palette, Clock, Copy, X, Calendar, Repeat } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RecurringDeleteScope } from '@/hooks/use-bulk-selection';

interface BulkActionToolbarProps {
  selectedCount: number;
  onDelete: (recurringScope?: RecurringDeleteScope) => void;
  onUpdateColor: (color: string) => void;
  onReschedule: (days: number) => void;
  onDuplicate: () => void;
  onDeselectAll: () => void;
  hasRecurringEvents?: boolean;
  recurringCount?: number;
}

const BulkActionToolbar: React.FC<BulkActionToolbarProps> = ({
  selectedCount,
  onDelete,
  onUpdateColor,
  onReschedule,
  onDuplicate,
  onDeselectAll,
  hasRecurringEvents = false,
  recurringCount = 0,
}) => {
  const [showRescheduleDialog, setShowRescheduleDialog] = useState(false);
  const [showRecurringDeleteDialog, setShowRecurringDeleteDialog] = useState(false);
  const [rescheduleOffset, setRescheduleOffset] = useState('1');

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

  const handleReschedule = () => {
    const days = parseInt(rescheduleOffset);
    if (!isNaN(days)) {
      onReschedule(days);
      setShowRescheduleDialog(false);
      setRescheduleOffset('1');
    }
  };

  const handleDeleteClick = () => {
    if (hasRecurringEvents) {
      setShowRecurringDeleteDialog(true);
    } else {
      onDelete();
    }
  };

  const handleRecurringDelete = (scope: RecurringDeleteScope) => {
    onDelete(scope);
    setShowRecurringDeleteDialog(false);
  };

  // Use Portal to render outside any overflow:hidden containers
  return createPortal(
    <>
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] animate-in slide-in-from-bottom-5">
        <Card className="glass border-2 border-primary shadow-2xl p-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">{selectedCount}</span>
              </div>
              <span className="text-sm font-medium">
                {selectedCount} event{selectedCount !== 1 ? 's' : ''} selected
              </span>
            </div>

            <div className="h-8 w-px bg-border" />

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteClick}
                className="hover:bg-red-50 hover:text-red-600 hover:border-red-300"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
                {hasRecurringEvents && (
                  <Repeat className="h-3 w-3 ml-1 text-yellow-500" />
                )}
              </Button>

              <Select onValueChange={onUpdateColor}>
                <SelectTrigger className="w-[130px] h-9">
                  <Palette className="h-4 w-4 mr-1" />
                  <SelectValue placeholder="Color" />
                </SelectTrigger>
                <SelectContent>
                  {colors.map((color) => (
                    <SelectItem key={color.value} value={color.value}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="h-4 w-4 rounded-full border" 
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
                onClick={() => setShowRescheduleDialog(true)}
              >
                <Clock className="h-4 w-4 mr-1" />
                Reschedule
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

            <div className="h-8 w-px bg-border" />

            <Button
              variant="ghost"
              size="sm"
              onClick={onDeselectAll}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>

      <Dialog open={showRescheduleDialog} onOpenChange={setShowRescheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Events</DialogTitle>
            <DialogDescription>
              Move {selectedCount} event{selectedCount !== 1 ? 's' : ''} forward or backward in time
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="offset">Days to move</Label>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="offset"
                  type="number"
                  value={rescheduleOffset}
                  onChange={(e) => setRescheduleOffset(e.target.value)}
                  placeholder="Enter number of days"
                  className="flex-1"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Use negative numbers to move backward (e.g., -7 for one week earlier)
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRescheduleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleReschedule}>
              Reschedule Events
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recurring Delete Confirmation Dialog */}
      <Dialog open={showRecurringDeleteDialog} onOpenChange={setShowRecurringDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-yellow-500" />
              Delete Recurring Events
            </DialogTitle>
            <DialogDescription>
              {recurringCount > 0 
                ? `${recurringCount} of the selected event${recurringCount !== 1 ? 's are' : ' is'} recurring.`
                : 'Some of the selected events are recurring.'
              } How would you like to delete them?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4"
              onClick={() => handleRecurringDelete('single')}
            >
              <div className="text-left">
                <div className="font-medium">Delete only these occurrences</div>
                <div className="text-sm text-muted-foreground">
                  Only the selected instances will be removed. Other occurrences will remain.
                </div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-auto p-4 border-red-200 hover:bg-red-50 hover:border-red-300"
              onClick={() => handleRecurringDelete('all')}
            >
              <div className="text-left">
                <div className="font-medium text-red-600">Delete all occurrences</div>
                <div className="text-sm text-muted-foreground">
                  All occurrences of the recurring events will be permanently deleted.
                </div>
              </div>
            </Button>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowRecurringDeleteDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>,
    document.body
  );
};

export default BulkActionToolbar;
