// AddCalendarFlow - Multi-step dialog for connecting external calendars.
// Steps: select source → authenticate → pick calendars → assign to group → done.

import React, { useState, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CalendarSource,
  CalendarGroup,
  CALENDAR_SOURCES,
  AddCalendarStep,
} from '@/types/calendar';
import { useCalendarSync } from '@/hooks/use-calendar-sync';
import { Loader2, Check, Calendar, Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { springs } from '@/lib/animations';

interface AddCalendarFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: CalendarGroup[];
  defaultGroupId?: string;
  onComplete: (result: {
    source: CalendarSource;
    selectedCalendars: { id: string; name: string; color: string; primary: boolean }[];
    targetGroupId: string;
    accountEmail?: string;
  }) => void;
}

const SOURCE_ICONS: Record<CalendarSource, React.ElementType> = {
  google: Calendar,
  microsoft: Mail,
  apple: Calendar,
};

const AddCalendarFlow: React.FC<AddCalendarFlowProps> = ({
  open,
  onOpenChange,
  groups,
  defaultGroupId,
  onComplete,
}) => {
  const {
    syncState,
    availableCalendars,
    lastAuthEmail,
    authenticateSource,
    discoverCalendars,
    resetSyncState,
  } = useCalendarSync();

  const [step, setStep] = useState<AddCalendarStep['step']>('select-source');
  const [selectedSource, setSelectedSource] = useState<CalendarSource | null>(null);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [targetGroupId, setTargetGroupId] = useState<string>(defaultGroupId || groups[0]?.id || '');

  // Local discovery state — independent of syncState so stale auth status
  // can't keep the calendar-selection spinner stuck.
  const [discoveryStatus, setDiscoveryStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);

  // Safety timeout — if discovery takes too long, show error UI instead of
  // an infinite spinner.
  useEffect(() => {
    if (discoveryStatus !== 'loading') return;
    const safetyTimer = setTimeout(() => {
      setDiscoveryStatus('error');
      setDiscoveryError('Loading calendars timed out. Please try again.');
    }, 20_000);
    return () => clearTimeout(safetyTimer);
  }, [discoveryStatus]);

  // Keep targetGroupId in sync if groups load after mount or defaultGroupId changes
  useEffect(() => {
    if (!targetGroupId && groups.length > 0) {
      setTargetGroupId(defaultGroupId || groups[0].id);
    }
  }, [groups, defaultGroupId, targetGroupId]);

  // Reset on close
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setStep('select-source');
      setSelectedSource(null);
      setSelectedCalendarIds([]);
      setTargetGroupId(defaultGroupId || groups[0]?.id || '');
      setDiscoveryStatus('idle');
      setDiscoveryError(null);
      resetSyncState();
    }
    onOpenChange(isOpen);
  };

  // Step 1: Select source
  const handleSelectSource = async (source: CalendarSource) => {
    setSelectedSource(source);
    setStep('authenticate');

    try {
      const authenticated = await authenticateSource(source);
      if (authenticated) {
        setStep('select-calendars');
        setDiscoveryStatus('loading');
        setDiscoveryError(null);
        try {
          await discoverCalendars(source);
          // Only move to idle if the call succeeded —
          // discoverCalendars now re-throws on failure.
          setDiscoveryStatus('idle');
        } catch (discoverErr) {
          const msg = discoverErr instanceof Error ? discoverErr.message : 'Failed to load calendars';
          console.error('[AddCalendarFlow] Calendar discovery failed:', discoverErr);
          setDiscoveryStatus('error');
          setDiscoveryError(msg);
        }
      } else {
        // Auth was declined or cancelled — go back
        setStep('select-source');
      }
    } catch (authErr) {
      // Auth threw (popup blocked, timeout, etc.) — go back
      console.error('[AddCalendarFlow] Authentication failed:', authErr);
      setStep('select-source');
    }
  };

  // Step 2: Pick calendars
  const toggleCalendar = (calendarId: string) => {
    setSelectedCalendarIds(prev =>
      prev.includes(calendarId)
        ? prev.filter(id => id !== calendarId)
        : [...prev, calendarId]
    );
  };

  // Step 3: Assign group and finish
  const handleComplete = () => {
    if (!selectedSource || selectedCalendarIds.length === 0) return;

    const selected = availableCalendars.filter(c =>
      selectedCalendarIds.includes(c.id)
    );

    onComplete({
      source: selectedSource,
      selectedCalendars: selected,
      targetGroupId,
      accountEmail: lastAuthEmail || undefined,
    });

    handleOpenChange(false);
  };

  // Slide animation direction
  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 40 : -40,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction > 0 ? -40 : 40,
      opacity: 0,
    }),
  };

  const stepTitles: Record<AddCalendarStep['step'], string> = {
    'select-source': 'Add Calendar',
    'authenticate': 'Connecting...',
    'select-calendars': 'Select Calendars',
    'assign-group': 'Assign to Group',
    'done': 'Done',
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-title3">
            {stepTitles[step]}
          </DialogTitle>
          <DialogDescription>
            {step === 'select-source' && 'Choose a calendar provider to connect.'}
            {step === 'authenticate' && `Authenticating with ${selectedSource}...`}
            {step === 'select-calendars' && 'Choose which calendars to import.'}
            {step === 'assign-group' && 'Pick a group for your new calendars.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 min-h-[200px]">
          <AnimatePresence mode="wait" custom={1}>
            {/* Step 1: Select Source */}
            {step === 'select-source' && (
              <motion.div
                key="source"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                custom={1}
                transition={springs.gentle}
                className="space-y-2"
              >
                {Object.values(CALENDAR_SOURCES).map(source => {
                  const Icon = SOURCE_ICONS[source.id];
                  return (
                    <motion.button
                      key={source.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectSource(source.id)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3.5 rounded-xl border border-border/60',
                        'hover:border-primary/30 hover:bg-primary/[0.02]',
                        'dark:hover:bg-primary/[0.04]',
                        'transition-all duration-200 text-left'
                      )}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${source.color}15` }}
                      >
                        <Icon size={20} style={{ color: source.color }} />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-foreground">{source.label}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {source.id === 'google' && 'Connect your Google Calendar'}
                          {source.id === 'microsoft' && 'Connect Outlook calendar'}
                          {source.id === 'apple' && 'Connect Apple Calendar'}
                        </div>
                      </div>
                      <ArrowRight size={16} className="text-muted-foreground/40" />
                    </motion.button>
                  );
                })}
              </motion.div>
            )}

            {/* Step 2: Authenticating */}
            {step === 'authenticate' && (
              <motion.div
                key="auth"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                custom={1}
                transition={springs.gentle}
                className="flex flex-col items-center justify-center py-8 gap-4"
              >
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  {syncState.message || 'Connecting...'}
                </p>
              </motion.div>
            )}

            {/* Step 3: Select Calendars */}
            {step === 'select-calendars' && (
              <motion.div
                key="calendars"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                custom={1}
                transition={springs.gentle}
                className="space-y-2"
              >
                {discoveryStatus === 'loading' ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground">
                      Discovering calendars...
                    </p>
                  </div>
                ) : discoveryStatus === 'error' ? (
                  <div className="flex flex-col items-center py-6 gap-3 text-center">
                    <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                      <span className="text-destructive text-lg">!</span>
                    </div>
                    <p className="text-sm text-destructive font-medium">Something went wrong</p>
                    <p className="text-xs text-muted-foreground max-w-[260px]">
                      {discoveryError || 'Failed to load calendars.'}
                    </p>
                    <div className="flex gap-2 mt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setDiscoveryStatus('idle'); setDiscoveryError(null); resetSyncState(); setStep('select-source'); }}
                      >
                        <ArrowLeft size={14} className="mr-1" />
                        Back
                      </Button>
                      <Button
                        size="sm"
                        onClick={async () => {
                          if (!selectedSource) return;
                          setDiscoveryStatus('loading');
                          setDiscoveryError(null);
                          try {
                            await discoverCalendars(selectedSource);
                            setDiscoveryStatus('idle');
                          } catch (err) {
                            setDiscoveryStatus('error');
                            setDiscoveryError(err instanceof Error ? err.message : 'Failed to load calendars');
                          }
                        }}
                      >
                        Retry
                      </Button>
                    </div>
                  </div>
                ) : availableCalendars.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No calendars found.
                  </div>
                ) : (
                  availableCalendars.map(cal => (
                    <motion.label
                      key={cal.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border cursor-pointer',
                        'transition-all duration-200',
                        selectedCalendarIds.includes(cal.id)
                          ? 'border-primary/40 bg-primary/[0.03]'
                          : 'border-border/40 hover:border-border'
                      )}
                    >
                      <Checkbox
                        checked={selectedCalendarIds.includes(cal.id)}
                        onCheckedChange={() => toggleCalendar(cal.id)}
                      />
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cal.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{cal.name}</div>
                        {cal.primary && (
                          <span className="text-[10px] text-primary">Primary</span>
                        )}
                      </div>
                    </motion.label>
                  ))
                )}
              </motion.div>
            )}

            {/* Step 4: Assign Group */}
            {step === 'assign-group' && (
              <motion.div
                key="group"
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                custom={1}
                transition={springs.gentle}
                className="space-y-4"
              >
                {groups.length === 0 ? (
                  <div className="text-center py-6 space-y-3">
                    <p className="text-sm text-muted-foreground">
                      No calendar groups found. A default group will be created automatically.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => {
                        // Skip group assignment — use empty string, CalendarDropdown will handle it
                        if (!selectedSource || selectedCalendarIds.length === 0) return;
                        const selected = availableCalendars.filter(c =>
                          selectedCalendarIds.includes(c.id)
                        );
                        onComplete({
                          source: selectedSource,
                          selectedCalendars: selected,
                          targetGroupId: '',
                        });
                        handleOpenChange(false);
                      }}
                    >
                      Add without group
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label className="text-footnote font-medium">
                        Add to group
                      </Label>
                      <Select value={targetGroupId} onValueChange={setTargetGroupId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a group" />
                        </SelectTrigger>
                        <SelectContent>
                          {groups.map(g => (
                            <SelectItem key={g.id} value={g.id}>
                              {g.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
                      <p className="text-[12px] text-muted-foreground">
                        {selectedCalendarIds.length} calendar{selectedCalendarIds.length !== 1 ? 's' : ''} will be added to this group.
                      </p>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="gap-2">
          {step === 'select-calendars' && (
            <>
              <Button variant="outline" onClick={() => setStep('select-source')}>
                <ArrowLeft size={14} className="mr-1" />
                Back
              </Button>
              <Button
                onClick={() => setStep('assign-group')}
                disabled={selectedCalendarIds.length === 0}
              >
                Next
                <ArrowRight size={14} className="ml-1" />
              </Button>
            </>
          )}
          {step === 'assign-group' && (
            <>
              <Button variant="outline" onClick={() => setStep('select-calendars')}>
                <ArrowLeft size={14} className="mr-1" />
                Back
              </Button>
              <Button onClick={handleComplete} disabled={!targetGroupId}>
                <Check size={14} className="mr-1" />
                Add Calendars
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddCalendarFlow;
