// MergeCalendarsDialog - Merge or copy events between calendars.
// Allows selecting a source and target calendar, then copies/moves events.
// Source can be a calendar group or specific calendar.
// Target can be an existing calendar or a new one.

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  ArrowRight,
  Copy,
  Scissors,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  FolderInput,
} from 'lucide-react';
import { useCalendarGroups } from '@/hooks/use-calendar-groups';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { useEventStore } from '@/lib/stores/event-store';
import { CalendarGroup, ConnectedCalendar } from '@/types/calendar';
import { CalendarEventType } from '@/lib/stores/types';
import { springs } from '@/lib/animations';
import { toast } from 'sonner';
import { nanoid } from 'nanoid';
import dayjs from 'dayjs';

// ─── Types ──────────────────────────────────────────────────────────────────

type MergeMode = 'copy' | 'move';

interface CalendarOption {
  id: string;
  name: string;
  color: string;
  type: 'calendar' | 'group' | 'unassigned';
  groupName?: string;
}

// ─── Component ──────────────────────────────────────────────────────────────

interface MergeCalendarsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MergeCalendarsDialog: React.FC<MergeCalendarsDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { groups, calendars, getGroupCalendars, createGroup, addCalendar } =
    useCalendarGroups();
  const { addEvent, removeEvent } = useCalendarEvents();
  const events = useEventStore((s) => s.events);

  // Local UI state
  const [sourceId, setSourceId] = useState<string>('');
  const [targetId, setTargetId] = useState<string>('');
  const [mode, setMode] = useState<MergeMode>('copy');
  const [creating, setCreating] = useState(false);
  const [newCalName, setNewCalName] = useState('');
  const [step, setStep] = useState<'select' | 'confirm' | 'done'>('select');
  const [processing, setProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);

  // Reset on close
  const handleOpenChange = useCallback(
    (v: boolean) => {
      if (!v) {
        setSourceId('');
        setTargetId('');
        setMode('copy');
        setCreating(false);
        setNewCalName('');
        setStep('select');
        setProcessing(false);
        setProcessedCount(0);
      }
      onOpenChange(v);
    },
    [onOpenChange]
  );

  // Build source / target options from groups + calendars
  const calendarOptions = useMemo<CalendarOption[]>(() => {
    const opts: CalendarOption[] = [];

    // Unassigned events (no calendarId)
    const unassignedCount = events.filter(
      (e) => !e.calendarId && !e.id.startsWith('synced_')
    ).length;
    if (unassignedCount > 0) {
      opts.push({
        id: '__unassigned__',
        name: `Unassigned Events (${unassignedCount})`,
        color: '#6b7280',
        type: 'unassigned',
      });
    }

    // Each group as an option (representing all calendars in the group)
    for (const group of groups) {
      const groupCals = getGroupCalendars(group.id);
      if (groupCals.length > 0) {
        opts.push({
          id: `group_${group.id}`,
          name: `${group.name} (group — ${groupCals.length} cal${groupCals.length > 1 ? 's' : ''})`,
          color: group.color,
          type: 'group',
        });
      }

      // Individual calendars within the group
      for (const cal of groupCals) {
        opts.push({
          id: cal.id,
          name: cal.name,
          color: cal.color,
          type: 'calendar',
          groupName: group.name,
        });
      }
    }

    return opts;
  }, [groups, calendars, events, getGroupCalendars]);

  // Count events for the selected source
  const sourceEvents = useMemo<CalendarEventType[]>(() => {
    if (!sourceId) return [];

    if (sourceId === '__unassigned__') {
      return events.filter((e) => !e.calendarId && !e.id.startsWith('synced_'));
    }

    if (sourceId.startsWith('group_')) {
      const groupId = sourceId.replace('group_', '');
      const groupCals = getGroupCalendars(groupId);
      const calIds = new Set(groupCals.map((c) => c.id));
      return events.filter((e) => e.calendarId && calIds.has(e.calendarId));
    }

    // Specific calendar
    return events.filter((e) => e.calendarId === sourceId);
  }, [sourceId, events, getGroupCalendars]);

  // Target options exclude the source
  const targetOptions = useMemo(() => {
    return calendarOptions.filter((o) => {
      // Can't merge into unassigned
      if (o.type === 'unassigned') return false;
      // Can't merge into itself
      if (o.id === sourceId) return false;
      // If source is a group, exclude calendars within that group
      if (sourceId.startsWith('group_')) {
        const groupId = sourceId.replace('group_', '');
        if (o.type === 'calendar' && getGroupCalendars(groupId).some((c) => c.id === o.id)) {
          return false;
        }
        if (o.id === sourceId) return false;
      }
      return true;
    });
  }, [calendarOptions, sourceId, getGroupCalendars]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleProceed = useCallback(() => {
    if (!sourceId || (!targetId && !creating)) return;
    if (creating && !newCalName.trim()) return;
    setStep('confirm');
  }, [sourceId, targetId, creating, newCalName]);

  const handleExecute = useCallback(async () => {
    if (sourceEvents.length === 0) return;

    setProcessing(true);
    setProcessedCount(0);

    try {
      let finalTargetCalId = targetId;

      // Create new calendar if needed
      if (creating && newCalName.trim()) {
        // Find the first group to put the new calendar in
        const defaultGroup = groups[0];
        if (!defaultGroup) {
          toast.error('No calendar group available');
          setProcessing(false);
          return;
        }

        const newCal = await addCalendar({
          source: 'google' as any, // Local calendar
          groupId: defaultGroup.id,
          accountEmail: '',
          name: newCalName.trim(),
          color: '#3b82f6',
          sourceCalendarId: `local_${nanoid(8)}`,
        });
        if (newCal) {
          finalTargetCalId = newCal.id;
        } else {
          toast.error('Failed to create target calendar');
          setProcessing(false);
          return;
        }
      }

      // Process events
      let processed = 0;
      for (const event of sourceEvents) {
        // Skip synced (read-only) events for move mode
        if (mode === 'move' && event.id.startsWith('synced_')) {
          continue;
        }

        // Create a copy with new calendarId
        const newEvent: CalendarEventType = {
          ...event,
          id: nanoid(),
          calendarId: finalTargetCalId || undefined,
          source: 'malleabite',
          isLocked: false,
          googleEventId: undefined, // Don't carry over sync IDs
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await addEvent(newEvent);
        processed++;
        setProcessedCount(processed);

        // For move mode, remove the original
        if (mode === 'move' && !event.id.startsWith('synced_')) {
          await removeEvent(event.id);
        }
      }

      setStep('done');
      toast.success(
        `${mode === 'copy' ? 'Copied' : 'Moved'} ${processed} event${processed !== 1 ? 's' : ''} successfully`
      );
    } catch (err) {
      console.error('Merge failed:', err);
      toast.error('Failed to merge events. Some events may have been processed.');
    } finally {
      setProcessing(false);
    }
  }, [
    sourceEvents,
    targetId,
    creating,
    newCalName,
    groups,
    addCalendar,
    addEvent,
    removeEvent,
    mode,
  ]);

  // ─── UI Helpers ──────────────────────────────────────────────────────────

  const sourceName = calendarOptions.find((o) => o.id === sourceId)?.name || '';
  const targetName = creating
    ? newCalName || 'New Calendar'
    : calendarOptions.find((o) => o.id === targetId)?.name || '';

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-title3 flex items-center gap-2">
            <FolderInput className="h-5 w-5" />
            Merge Calendars
          </DialogTitle>
          <DialogDescription>
            Copy or move events between your calendars.
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {/* ─── Step 1: Select Source & Target ─────────────────────────── */}
          {step === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={springs.snappy}
              className="space-y-5 py-2"
            >
              {/* Mode Toggle */}
              <div className="space-y-2">
                <Label className="text-footnote font-medium">Action</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={mode === 'copy' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMode('copy')}
                    className="flex-1 gap-2"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy Events
                  </Button>
                  <Button
                    type="button"
                    variant={mode === 'move' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMode('move')}
                    className="flex-1 gap-2"
                  >
                    <Scissors className="h-3.5 w-3.5" />
                    Move Events
                  </Button>
                </div>
                <p className="text-caption2 text-muted-foreground">
                  {mode === 'copy'
                    ? 'Events will be duplicated to the target — originals stay.'
                    : 'Events will be removed from source and added to target.'}
                </p>
              </div>

              <Separator />

              {/* Source Selection */}
              <div className="space-y-2">
                <Label className="text-footnote font-medium">From (Source)</Label>
                <ScrollArea className="h-36 rounded-lg border bg-muted/30 p-1">
                  {calendarOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSourceId(opt.id);
                        // Reset target if it conflicts
                        if (opt.id === targetId) setTargetId('');
                      }}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left',
                        sourceId === opt.id
                          ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                          : 'hover:bg-muted/50'
                      )}
                    >
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: opt.color }}
                      />
                      <span className="truncate">{opt.name}</span>
                      {opt.groupName && opt.type === 'calendar' && (
                        <span className="ml-auto text-caption2 text-muted-foreground">
                          {opt.groupName}
                        </span>
                      )}
                    </button>
                  ))}
                  {calendarOptions.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No calendars available
                    </p>
                  )}
                </ScrollArea>
                {sourceId && (
                  <p className="text-caption2 text-muted-foreground">
                    {sourceEvents.length} event{sourceEvents.length !== 1 ? 's' : ''} will be{' '}
                    {mode === 'copy' ? 'copied' : 'moved'}
                  </p>
                )}
              </div>

              <div className="flex justify-center">
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
              </div>

              {/* Target Selection */}
              <div className="space-y-2">
                <Label className="text-footnote font-medium">To (Target)</Label>

                {/* Create new option */}
                <button
                  type="button"
                  onClick={() => {
                    setCreating(true);
                    setTargetId('');
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors border border-dashed',
                    creating
                      ? 'bg-primary/10 text-primary border-primary/30'
                      : 'hover:bg-muted/50 border-muted-foreground/20'
                  )}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create New Calendar
                </button>

                {creating && (
                  <Input
                    value={newCalName}
                    onChange={(e) => setNewCalName(e.target.value)}
                    placeholder="New calendar name..."
                    className="h-9"
                    autoFocus
                    maxLength={40}
                  />
                )}

                <ScrollArea className="h-32 rounded-lg border bg-muted/30 p-1">
                  {targetOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setTargetId(opt.id);
                        setCreating(false);
                      }}
                      className={cn(
                        'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left',
                        targetId === opt.id && !creating
                          ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                          : 'hover:bg-muted/50'
                      )}
                    >
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ backgroundColor: opt.color }}
                      />
                      <span className="truncate">{opt.name}</span>
                    </button>
                  ))}
                </ScrollArea>
              </div>
            </motion.div>
          )}

          {/* ─── Step 2: Confirm ───────────────────────────────────────── */}
          {step === 'confirm' && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={springs.snappy}
              className="space-y-4 py-2"
            >
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1 text-center">
                    <p className="text-footnote text-muted-foreground">From</p>
                    <p className="font-medium text-sm truncate">{sourceName}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 text-center">
                    <p className="text-footnote text-muted-foreground">To</p>
                    <p className="font-medium text-sm truncate">{targetName}</p>
                  </div>
                </div>

                <Separator />

                <div className="text-center space-y-1">
                  <p className="text-2xl font-semibold">{sourceEvents.length}</p>
                  <p className="text-footnote text-muted-foreground">
                    event{sourceEvents.length !== 1 ? 's' : ''} will be{' '}
                    {mode === 'copy' ? 'copied' : 'moved'}
                  </p>
                </div>

                {mode === 'move' && (
                  <div className="flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 p-2">
                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-caption2 text-amber-700 dark:text-amber-400">
                      Move will remove events from the source. Synced (external) events
                      cannot be moved, only copied.
                    </p>
                  </div>
                )}
              </div>

              {processing && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing {processedCount} / {sourceEvents.length}...
                </div>
              )}
            </motion.div>
          )}

          {/* ─── Step 3: Done ──────────────────────────────────────────── */}
          {step === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={springs.snappy}
              className="flex flex-col items-center gap-3 py-6"
            >
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-title3 font-medium">Merge Complete</p>
              <p className="text-footnote text-muted-foreground text-center">
                {processedCount} event{processedCount !== 1 ? 's' : ''}{' '}
                {mode === 'copy' ? 'copied' : 'moved'} to{' '}
                <span className="font-medium text-foreground">{targetName}</span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Footer ──────────────────────────────────────────────────── */}
        <DialogFooter className="gap-2">
          {step === 'select' && (
            <>
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleProceed}
                disabled={
                  !sourceId ||
                  sourceEvents.length === 0 ||
                  (!targetId && !creating) ||
                  (creating && !newCalName.trim())
                }
              >
                Review
              </Button>
            </>
          )}

          {step === 'confirm' && (
            <>
              <Button
                variant="ghost"
                onClick={() => setStep('select')}
                disabled={processing}
              >
                Back
              </Button>
              <Button
                onClick={handleExecute}
                disabled={processing}
                className={cn(
                  mode === 'move' && 'bg-amber-600 hover:bg-amber-700'
                )}
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing...
                  </>
                ) : mode === 'copy' ? (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy {sourceEvents.length} Events
                  </>
                ) : (
                  <>
                    <Scissors className="h-4 w-4 mr-2" />
                    Move {sourceEvents.length} Events
                  </>
                )}
              </Button>
            </>
          )}

          {step === 'done' && (
            <Button onClick={() => handleOpenChange(false)} className="w-full">
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MergeCalendarsDialog;
