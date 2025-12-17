// Recurring Event Edit Dialog - Edit single, all, or future occurrences
import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { CalendarDays, AlertTriangle, Repeat } from 'lucide-react';
import { EditScope } from '@/hooks/use-recurring-events';
import { CalendarEventType, RecurrenceRule } from '@/lib/stores/types';
import dayjs from 'dayjs';

// Helper to describe recurrence pattern
function describeRecurrence(rule?: RecurrenceRule): string {
  if (!rule) return 'regularly';
  
  const freq = rule.frequency.toLowerCase();
  const interval = rule.interval || 1;
  
  if (interval === 1) {
    switch (freq) {
      case 'daily': return 'every day';
      case 'weekly': return 'every week';
      case 'monthly': return 'every month';
      case 'yearly': return 'every year';
      default: return freq;
    }
  }
  
  return `every ${interval} ${freq.replace(/ly$/, '')}s`;
}

interface RecurringEventEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEventType;
  action: 'edit' | 'delete';
  onConfirm: (scope: EditScope) => void;
  onCancel?: () => void;
}

export function RecurringEventEditDialog({
  open,
  onOpenChange,
  event,
  action,
  onConfirm,
  onCancel,
}: RecurringEventEditDialogProps) {
  const [selectedScope, setSelectedScope] = useState<EditScope>('single');

  const handleConfirm = useCallback(() => {
    onConfirm(selectedScope);
    onOpenChange(false);
  }, [selectedScope, onConfirm, onOpenChange]);

  const handleCancel = useCallback(() => {
    onCancel?.();
    onOpenChange(false);
  }, [onCancel, onOpenChange]);

  const isDelete = action === 'delete';
  const eventDate = dayjs(event.startsAt).format('dddd, MMMM D, YYYY');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isDelete ? (
              <AlertTriangle className="h-5 w-5 text-destructive" />
            ) : (
              <Repeat className="h-5 w-5" />
            )}
            {isDelete ? 'Delete Recurring Event' : 'Edit Recurring Event'}
          </DialogTitle>
          <DialogDescription>
            This event repeats {describeRecurrence(event.recurrenceRule)}.
            Choose which occurrences to {isDelete ? 'delete' : 'edit'}.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <div className="font-medium">{event.title}</div>
            <div className="text-sm text-muted-foreground">
              <CalendarDays className="inline h-3 w-3 mr-1" />
              {eventDate}
            </div>
          </div>

          <RadioGroup
            value={selectedScope}
            onValueChange={(value) => setSelectedScope(value as EditScope)}
            className="space-y-3"
          >
            {/* Single occurrence */}
            <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
              <RadioGroupItem value="single" id="single" className="mt-1" />
              <Label htmlFor="single" className="cursor-pointer flex-1">
                <div className="font-medium">This event only</div>
                <div className="text-sm text-muted-foreground">
                  Only {isDelete ? 'delete' : 'change'} this occurrence on {dayjs(event.startsAt).format('MMM D')}
                </div>
              </Label>
            </div>

            {/* This and following */}
            <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
              <RadioGroupItem value="thisAndFollowing" id="thisAndFollowing" className="mt-1" />
              <Label htmlFor="thisAndFollowing" className="cursor-pointer flex-1">
                <div className="font-medium">This and following events</div>
                <div className="text-sm text-muted-foreground">
                  {isDelete ? 'Delete' : 'Change'} this and all future occurrences
                </div>
              </Label>
            </div>

            {/* All occurrences */}
            <div className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer">
              <RadioGroupItem value="all" id="all" className="mt-1" />
              <Label htmlFor="all" className="cursor-pointer flex-1">
                <div className="font-medium">All events</div>
                <div className="text-sm text-muted-foreground">
                  {isDelete ? 'Delete' : 'Change'} all occurrences in the series
                </div>
              </Label>
            </div>
          </RadioGroup>

          {isDelete && selectedScope !== 'single' && (
            <div className="mt-4 p-3 bg-destructive/10 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
              <div className="text-sm text-destructive">
                {selectedScope === 'all'
                  ? 'This will permanently delete all occurrences of this event.'
                  : 'This will permanently delete this and all future occurrences.'}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            variant={isDelete ? 'destructive' : 'default'}
            onClick={handleConfirm}
          >
            {isDelete ? 'Delete' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RecurringEventEditDialog;
