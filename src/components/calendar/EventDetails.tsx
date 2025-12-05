
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEventStore } from "@/lib/store";
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import EnhancedEventForm from './EnhancedEventForm';
import { CalendarEventType } from '@/lib/stores/types';
import { useTodos } from '@/hooks/use-todos';
import { Calendar, Clock, CheckCircle, Lock, Users } from 'lucide-react';

interface EventDetailsProps {
  open: boolean;
  onClose: () => void;
}

const EventDetails: React.FC<EventDetailsProps> = ({ open, onClose }) => {
  const { selectedEvent } = useEventStore();
  const { updateEvent, removeEvent } = useCalendarEvents();
  const { toggleTodo, deleteTodo } = useTodos();
  const [isEditing, setIsEditing] = useState(false);

  if (!selectedEvent) return null;

  // Extract time information from description (format: "HH:MM - HH:MM | Description")
  const descriptionParts = selectedEvent.description.split('|');
  const timeRange = descriptionParts[0].trim();
  const actualDescription = descriptionParts.length > 1 ? descriptionParts[1].trim() : '';

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
      
      await toggleTodo(selectedEvent.todoId, true);
      toast.success("Todo marked as complete");
      
      // Update calendar event to reflect completion
      const updatedEvent = {
        ...selectedEvent,
        color: "bg-green-500/70", // Change color to indicate completion
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
  const formattedDate = selectedEvent.date 
    ? dayjs(selectedEvent.date).format('dddd, MMMM D, YYYY')
    : dayjs(selectedEvent.startsAt).format('dddd, MMMM D, YYYY');
    
  // Get participants if any
  const hasParticipants = selectedEvent.participants && selectedEvent.participants.length > 0;

  return (
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
                    <p className="text-foreground">{selectedEvent.participants?.join(', ')}</p>
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
                  onClick={handleDelete}
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
  );
};

export default EventDetails;
