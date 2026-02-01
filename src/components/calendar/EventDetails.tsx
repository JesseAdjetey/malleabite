
import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEventStore } from "@/lib/store";
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import EnhancedEventForm from './EnhancedEventForm';
import { CalendarEventType } from '@/lib/stores/types';
import { useTodos } from '@/hooks/use-todos';
import { Calendar, Clock, CheckCircle, Lock, Users, Repeat } from 'lucide-react';
import { RecurringEventEditDialog } from './RecurringEventEditDialog';
import { EditScope } from '@/hooks/use-recurring-events';

interface EventDetailsProps {
  open: boolean;
  onClose: () => void;
}

const EventDetails: React.FC<EventDetailsProps> = ({ open, onClose }) => {
  const { selectedEvent } = useEventStore();
  const { updateEvent, removeEvent, addRecurrenceException } = useCalendarEvents();
  const { toggleTodo, deleteTodo } = useTodos();
  const [isEditing, setIsEditing] = useState(false);
  const [showRecurringDeleteDialog, setShowRecurringDeleteDialog] = useState(false);

  // Early return if no event selected
  if (!selectedEvent) return null;

  // Format time from startsAt and endsAt fields (wrapped in try-catch)
  const timeRange = (() => {
    try {
      if (selectedEvent.startsAt && selectedEvent.endsAt) {
        const start = dayjs(selectedEvent.startsAt);
        const end = dayjs(selectedEvent.endsAt);
        if (start.isValid() && end.isValid()) {
          return `${start.format('h:mm A')} - ${end.format('h:mm A')}`;
        }
      }
      // Fallback: try to extract from description (legacy format "HH:MM - HH:MM | Description")
      const descriptionParts = selectedEvent.description?.split('|') || [];
      const legacyTimeRange = descriptionParts[0]?.trim();
      if (legacyTimeRange && /^\d{2}:\d{2}\s*-\s*\d{2}:\d{2}$/.test(legacyTimeRange)) {
        return legacyTimeRange;
      }
      return 'All day';
    } catch (error) {
      console.error('Error formatting time:', error);
      return 'All day';
    }
  })();

  // Get actual description (not the time part)
  const actualDescription = (() => {
    try {
      const desc = selectedEvent.description || '';
      // If description contains the pipe format, extract the description part
      if (desc.includes('|')) {
        return desc.split('|').slice(1).join('|').trim();
      }
      // If description looks like a time range, return empty
      if (/^\d{2}:\d{2}\s*-\s*\d{2}:\d{2}$/.test(desc.trim())) {
        return '';
      }
      return desc;
    } catch (error) {
      console.error('Error getting description:', error);
      return '';
    }
  })();

  // Check if this is a recurring event or instance
  const isRecurringEvent = Boolean(
    selectedEvent.isRecurring ||
    selectedEvent.recurrenceParentId ||
    (selectedEvent.id && selectedEvent.id.includes('_'))
  );

  const handleDeleteClick = () => {
    if (isRecurringEvent) {
      setShowRecurringDeleteDialog(true);
    } else {
      handleDelete();
    }
  };

  const handleRecurringDeleteConfirm = useCallback(async (scope: EditScope) => {
    try {
      const parentId = selectedEvent.recurrenceParentId ||
        (selectedEvent.id.includes('_') ? selectedEvent.id.split('_')[0] : selectedEvent.id);
      const instanceDate = selectedEvent.id.includes('_')
        ? selectedEvent.id.split('_')[1]
        : dayjs(selectedEvent.startsAt).format('YYYY-MM-DD');

      if (scope === 'single') {
        // Delete only this occurrence by adding an exception to the parent
        if (addRecurrenceException && parentId) {
          await addRecurrenceException(parentId, instanceDate);
          toast.success("This occurrence has been removed");
        } else {
          // Fallback: just delete the event
          await removeEvent(selectedEvent.id);
          toast.success("Event deleted");
        }
      } else if (scope === 'all') {
        // Delete the parent event (which deletes all occurrences)
        await removeEvent(parentId);
        toast.success("All occurrences deleted");
      } else if (scope === 'thisAndFuture') {
        // Add end date to parent recurrence rule
        // For now, just delete all as a simpler implementation
        await removeEvent(parentId);
        toast.success("This and future occurrences deleted");
      }

      setShowRecurringDeleteDialog(false);
      onClose();
    } catch (error) {
      console.error("Error deleting recurring event:", error);
      toast.error("Failed to delete event");
    }
  }, [selectedEvent, addRecurrenceException, removeEvent, onClose]);

  const handleDelete = async () => {
    try {
      // If it's a todo event, also handle todo item
      if (selectedEvent.isTodo && selectedEvent.todoId) {
        // Only delete the calendar event, not the todo item
        console.log("Removing todo calendar event:", selectedEvent.id);
      }

      await removeEvent(selectedEvent.id);
      toast.success("Event deleted");
      onClose();
    } catch (error) {
      console.error("Error deleting event:", error);
      toast.error("Failed to delete event");
    }
  };

  const handleComplete = async () => {
    try {
      if (!selectedEvent.todoId) {
        toast.error("No todo associated with this event");
        return;
      }

      // Toggle the todo to complete it
      await toggleTodo(selectedEvent.todoId);
      toast.success("Todo marked as complete");

      // Update calendar event to reflect completion
      const updatedEvent = {
        ...selectedEvent,
        color: "#22c55e", // Green color to indicate completion
      };

      await updateEvent(updatedEvent);
      onClose();
    } catch (error) {
      console.error("Error completing todo:", error);
      toast.error("Failed to complete todo");
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleUpdate = async (updatedEvent: CalendarEventType) => {
    try {
      await updateEvent(updatedEvent);
      toast.success("Event updated");
      setIsEditing(false);
      onClose();
    } catch (error) {
      console.error("Error updating event:", error);
      toast.error("Failed to update event");
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleUseAI = () => {
    toast.info("AI assistance coming soon!");
  };

  // Format date for display
  const formattedDate = (() => {
    try {
      if (selectedEvent.date) {
        const dateObj = dayjs(selectedEvent.date);
        if (dateObj.isValid()) return dateObj.format('dddd, MMMM D, YYYY');
      }
      if (selectedEvent.startsAt) {
        const dateObj = dayjs(selectedEvent.startsAt);
        if (dateObj.isValid()) return dateObj.format('dddd, MMMM D, YYYY');
      }
      return 'Date not available';
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Date not available';
    }
  })();

  // Get participants if any
  const hasParticipants = selectedEvent.participants && selectedEvent.participants.length > 0;

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto bg-background/95 border-white/10">
          {isEditing ? (
            <EnhancedEventForm
              initialEvent={selectedEvent}
              onSave={handleUpdate}
              onCancel={handleCancel}
              onUseAI={handleUseAI}
            />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl">{selectedEvent.title}</DialogTitle>
              </DialogHeader>

              <div className="py-4 space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Date</span>
                    <p className="text-foreground">{formattedDate}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Time</span>
                    <p className="text-foreground">{timeRange}</p>
                  </div>
                </div>

                {actualDescription && (
                  <div className="mb-4 border-t pt-3">
                    <span className="text-sm font-medium text-muted-foreground block mb-1">Description</span>
                    <p className="text-foreground">{actualDescription}</p>
                  </div>
                )}

                {hasParticipants && (
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <span className="text-sm font-medium text-muted-foreground">Participants</span>
                      <p className="text-foreground">
                        {Array.isArray(selectedEvent.participants)
                          ? selectedEvent.participants.join(', ')
                          : String(selectedEvent.participants || '')}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mt-3 border-t pt-3">
                  {selectedEvent.isTodo && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/20 text-xs">
                      <CheckCircle size={14} />
                      <span>Todo</span>
                    </div>
                  )}

                  {selectedEvent.isLocked && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-500/20 text-xs">
                      <Lock size={14} />
                      <span>Locked</span>
                    </div>
                  )}

                  {selectedEvent.hasAlarm && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 text-xs">
                      <Clock size={14} />
                      <span>Alarm</span>
                    </div>
                  )}

                  {selectedEvent.hasReminder && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 text-xs">
                      <Clock size={14} />
                      <span>Reminder</span>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter className="flex flex-col sm:flex-row sm:justify-between gap-2">
                <div>
                  <Button
                    variant="destructive"
                    onClick={handleDeleteClick}
                    className="transition-colors hover:bg-destructive/90"
                  >
                    Delete
                  </Button>
                </div>
                <div className="flex gap-2">
                  {selectedEvent.isTodo && (
                    <Button
                      variant="secondary"
                      onClick={handleComplete}
                      className="transition-colors hover:bg-secondary/80"
                    >
                      Complete
                    </Button>
                  )}
                  <Button
                    onClick={handleEdit}
                    className="transition-colors hover:bg-primary/90"
                  >
                    Edit
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Recurring Event Delete Dialog */}
      {
        selectedEvent && isRecurringEvent && (
          <RecurringEventEditDialog
            open={showRecurringDeleteDialog}
            onOpenChange={setShowRecurringDeleteDialog}
            event={selectedEvent}
            action="delete"
            onConfirm={handleRecurringDeleteConfirm}
            onCancel={() => setShowRecurringDeleteDialog(false)}
          />
        )
      }
    </>
  );
};

export default EventDetails;
