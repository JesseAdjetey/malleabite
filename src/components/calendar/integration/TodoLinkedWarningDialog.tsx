
import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Calendar, ArrowRight, Plus } from 'lucide-react';
import { useEventStore } from '@/lib/stores/event-store';
import type { EntityRef } from '@/lib/entity-links/types';
import dayjs from 'dayjs';

interface TodoLinkedWarningDialogProps {
  open: boolean;
  onClose: () => void;
  todoTitle: string;
  linkedEventRefs: EntityRef[];
  onNavigateToEvent: (eventId: string) => void;
  onScheduleAnyway: () => void;
}

const TodoLinkedWarningDialog: React.FC<TodoLinkedWarningDialogProps> = ({
  open,
  onClose,
  todoTitle,
  linkedEventRefs,
  onNavigateToEvent,
  onScheduleAnyway,
}) => {
  const events = useEventStore(state => state.events);

  const linkedEvents = linkedEventRefs
    .filter(ref => ref.type === 'event')
    .map(ref => {
      const event = events.find(e => e.id === ref.id);
      return { ref, event };
    });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[380px] bg-background/95 backdrop-blur-xl border-border/60 p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={14} className="text-amber-500" />
            </div>
            Already scheduled
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-4">
          {/* Todo label */}
          <div className="rounded-xl bg-muted/40 px-3 py-2.5">
            <p className="text-xs text-muted-foreground mb-0.5">Todo</p>
            <p className="text-sm font-semibold text-foreground truncate">"{todoTitle}"</p>
          </div>

          {/* Linked events */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
              Already on calendar
            </p>
            <div className="space-y-1.5">
              {linkedEvents.map(({ ref, event }) => {
                const dateLabel = event?.startsAt
                  ? dayjs(event.startsAt).format('ddd, MMM D [at] h:mm A')
                  : event?.date
                  ? dayjs(event.date).format('ddd, MMM D')
                  : null;

                return (
                  <div
                    key={ref.id}
                    className="flex items-center gap-2.5 rounded-xl border border-border/40 bg-muted/20 px-3 py-2.5"
                  >
                    <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                      <Calendar size={13} className="text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">
                        {ref.title || todoTitle}
                      </p>
                      {dateLabel && (
                        <p className="text-[11px] text-muted-foreground">{dateLabel}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onNavigateToEvent(ref.id)}
                      className="h-7 gap-1 text-[11px] text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 flex-shrink-0 px-2"
                    >
                      Go to event
                      <ArrowRight size={11} />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={onScheduleAnyway}
              variant="outline"
              className="flex-1 gap-1.5 border-border/60"
            >
              <Plus size={14} />
              Schedule anyway
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TodoLinkedWarningDialog;
