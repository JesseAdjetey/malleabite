/**
 * RescheduleOptionsSheet
 *
 * Slides up when the user clicks a conflicting event (mode = 'suggest') or
 * when the caller wants to surface manual reschedule options.
 *
 * Props:
 *  - event         — the event to potentially reschedule
 *  - allEvents     — full list so we can scan for free slots
 *  - conflicts     — the AlgoEventConflict[] for this event (from useConflictMap)
 *  - open / onOpenChange — controlled visibility
 */
import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Info,
  Lock,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CalendarEventType } from '@/lib/stores/types';
import type { AlgoEventConflict } from '@/hooks/use-conflict-detection';
import { type AlternativeSlot } from '@/lib/algorithms/conflict-detection';
import { useRescheduler } from '@/hooks/use-rescheduler';

interface RescheduleOptionsSheetProps {
  event: CalendarEventType;
  allEvents: CalendarEventType[];
  conflicts: AlgoEventConflict[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Severity helpers ────────────────────────────────────────────────────────

function severityIcon(severity: AlgoEventConflict['severity']) {
  switch (severity) {
    case 'critical': return <AlertTriangle className="h-4 w-4 text-destructive" />;
    case 'warning':  return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    case 'info':     return <Info className="h-4 w-4 text-blue-400" />;
  }
}

function severityLabel(type: AlgoEventConflict['type']) {
  switch (type) {
    case 'overlap':            return 'Hard Overlap';
    case 'double-booking':     return 'Double Booking';
    case 'tight-schedule':     return 'Tight Gap';
    case 'travel-time':        return 'Travel Time';
    case 'back-to-back':       return 'Back-to-Back';
    case 'outside-work-hours': return 'Outside Work Hours';
  }
}

function slotScoreColor(score: number) {
  if (score >= 85) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  if (score >= 65) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  return 'bg-muted text-muted-foreground border-border';
}

// ─── Component ───────────────────────────────────────────────────────────────

export function RescheduleOptionsSheet({
  event,
  allEvents,
  conflicts,
  open,
  onOpenChange,
}: RescheduleOptionsSheetProps) {
  const { getSuggestedSlots, applyReschedule } = useRescheduler();
  const [slots, setSlots] = useState<AlternativeSlot[]>([]);
  const [applying, setApplying] = useState<string | null>(null); // slot start ISO

  // Recompute slots whenever the sheet opens or the event changes
  useEffect(() => {
    if (!open) return;
    setSlots(getSuggestedSlots(event, allEvents));
  }, [open, event, allEvents, getSuggestedSlots]);

  const handleApply = async (slot: AlternativeSlot) => {
    setApplying(slot.start);
    const result = await applyReschedule(event, slot.start, slot.end);
    setApplying(null);
    if (result.success) onOpenChange(false);
  };

  const isLocked = !!event.isLocked;

  // Highest severity across all conflicts
  const topSeverity: AlgoEventConflict['severity'] =
    conflicts.some((c) => c.severity === 'critical')
      ? 'critical'
      : conflicts.some((c) => c.severity === 'warning')
      ? 'warning'
      : 'info';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[85dvh] overflow-y-auto pb-safe"
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2 text-base">
            {severityIcon(topSeverity)}
            <span>Scheduling Conflict</span>
            {isLocked && (
              <Badge variant="outline" className="ml-auto text-xs gap-1">
                <Lock className="h-3 w-3" /> Locked
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        {/* Event summary */}
        <div className="mb-4 rounded-xl bg-muted/50 border border-border/60 p-3">
          <div className="flex items-center gap-2 mb-0.5">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: event.color ?? '#8B5CF6' }}
            />
            <span className="font-medium text-sm truncate">{event.title}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-4">
            <Clock className="h-3 w-3" />
            {dayjs(event.startsAt).format('ddd MMM D, h:mm A')} –{' '}
            {dayjs(event.endsAt).format('h:mm A')}
          </div>
        </div>

        {/* Conflict list */}
        <div className="space-y-2 mb-5">
          {conflicts.map((conflict) => (
            <div
              key={conflict.id}
              className={cn(
                'rounded-lg border px-3 py-2 text-sm flex items-start gap-2',
                conflict.severity === 'critical'
                  ? 'border-destructive/30 bg-destructive/5'
                  : conflict.severity === 'warning'
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : 'border-blue-500/30 bg-blue-500/5',
              )}
            >
              <span className="mt-0.5 flex-shrink-0">{severityIcon(conflict.severity)}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium text-xs opacity-70">
                    {severityLabel(conflict.type)}
                  </span>
                  {!conflict.canAutoResolve && (
                    <Badge variant="outline" className="text-[10px] py-0 px-1 gap-0.5">
                      <Lock className="h-2.5 w-2.5" /> Hard conflict
                    </Badge>
                  )}
                </div>
                <p className="text-xs mt-0.5 text-muted-foreground leading-snug">
                  {conflict.message}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Alternative slots */}
        {isLocked ? (
          <div className="text-center py-6 text-muted-foreground text-sm flex flex-col items-center gap-2">
            <Lock className="h-5 w-5 opacity-40" />
            <p>This event is locked and cannot be auto-rescheduled.</p>
            <p className="text-xs opacity-60">Unlock it in event details to move it.</p>
          </div>
        ) : slots.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm flex flex-col items-center gap-2">
            <Calendar className="h-5 w-5 opacity-40" />
            <p>No free slots found in your work hours.</p>
            <p className="text-xs opacity-60">Try expanding your search window in Settings → Scheduling.</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2 px-0.5">
              Suggested times
            </p>
            <div className="space-y-2">
              {slots.map((slot) => (
                <button
                  key={slot.start}
                  onClick={() => handleApply(slot)}
                  disabled={applying !== null}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-xl border px-4 py-3',
                    'bg-card hover:bg-muted/60 active:scale-[0.99] transition-all duration-150',
                    'disabled:opacity-50 disabled:pointer-events-none',
                    applying === slot.start && 'opacity-70',
                  )}
                >
                  {applying === slot.start ? (
                    <RefreshCw className="h-4 w-4 text-primary animate-spin flex-shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="flex-1 text-left text-sm">{slot.label}</span>
                  <span
                    className={cn(
                      'text-[11px] font-semibold px-2 py-0.5 rounded-full border',
                      slotScoreColor(slot.score),
                    )}
                  >
                    {slot.score}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Dismiss */}
        <Button
          variant="ghost"
          className="w-full mt-4 text-muted-foreground"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4 mr-1.5" />
          Keep conflict
        </Button>
      </SheetContent>
    </Sheet>
  );
}
