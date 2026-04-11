// AddCalendarFlow - Multi-step dialog for connecting external calendars.
// Steps: select source → authenticate → pick calendars → assign to group → done.

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
  AddCalendarStep,
} from '@/types/calendar';
import { useCalendarSync } from '@/hooks/use-calendar-sync';
import { cancelGoogleAuth } from '@/lib/google-calendar';
import { Loader2, Check, Calendar, Mail, ArrowRight, ArrowLeft, AlertTriangle, LayoutTemplate } from 'lucide-react';

interface AddCalendarFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: CalendarGroup[];
  defaultGroupId?: string;
  onOpenTemplates: (groupId?: string) => void;
  onComplete: (result: {
    source: CalendarSource;
    selectedCalendars: { id: string; name: string; color: string; primary: boolean }[];
    targetGroupId: string;
    accountEmail?: string;
    googleAccountId?: string;
    msAccountId?: string;
  }) => void;
}

type AddFlowOptionId = CalendarSource | 'template';

type AddFlowOption = {
  id: AddFlowOptionId;
  label: string;
  description: string;
  color: string;
  icon: React.ElementType;
  disabled?: boolean;
  badge?: string;
};

const SOURCE_OPTIONS: AddFlowOption[] = [
  {
    id: 'google',
    label: 'Google Calendar',
    description: 'Connect your Google Calendar',
    color: '#4285F4',
    icon: Calendar,
  },
  {
    id: 'template',
    label: 'Templates',
    description: 'Add from saved templates or create a new one',
    color: '#8B5CF6',
    icon: LayoutTemplate,
  },
  {
    id: 'microsoft',
    label: 'Microsoft Outlook',
    description: 'Sync your Outlook calendar',
    color: '#0078D4',
    icon: Mail,
  },
];

const AddCalendarFlow: React.FC<AddCalendarFlowProps> = ({
  open,
  onOpenChange,
  groups,
  defaultGroupId,
  onOpenTemplates,
  onComplete,
}) => {
  const {
    syncState,
    availableCalendars,
    lastAuthEmail,
    lastAuthGoogleAccountId,
    lastAuthMsAccountId,
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
  const [authError, setAuthError] = useState<string | null>(null);

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

  // Keep targetGroupId in sync when the dialog opens or defaultGroupId changes.
  // This handles the case where AddCalendarFlow is already mounted (with a stale
  // targetGroupId) when a different group's + button is clicked.
  useEffect(() => {
    if (open) {
      setTargetGroupId(defaultGroupId || groups[0]?.id || '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultGroupId]);

  // Reset on close
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setStep('select-source');
      setSelectedSource(null);
      setSelectedCalendarIds([]);
      setTargetGroupId(defaultGroupId || groups[0]?.id || '');
      setDiscoveryStatus('idle');
      setDiscoveryError(null);
      setAuthError(null);
      resetSyncState();
    }
    onOpenChange(isOpen);
  };

  // Step 1: Select source
  const handleOpenTemplates = () => {
    // Prefer the explicitly-passed defaultGroupId (from a group's + button) over the
    // targetGroupId state, which may be stale if groups weren't loaded at mount time.
    const groupId = defaultGroupId || (targetGroupId !== '' ? targetGroupId : undefined);
    handleOpenChange(false);
    // Defer opening TemplateManager so AddCalendarFlow's exit animation and focus trap
    // fully release before the next dialog mounts. Without this delay both dialogs exist
    // in the DOM simultaneously and Radix's outgoing focus trap blocks all clicks in the
    // incoming dialog.
    // 300ms > shadcn Dialog's duration-200 exit animation, ensuring the outgoing
    // focus trap fully releases before TemplateManager mounts.
    setTimeout(() => onOpenTemplates(groupId), 300);
  };

  const handleSelectSource = async (source: CalendarSource) => {
    resetSyncState();
    setDiscoveryStatus('idle');
    setDiscoveryError(null);
    setSelectedSource(source);
    setStep('authenticate');
    setAuthError(null);

    try {
      const authenticated = await authenticateSource(source);
      if (authenticated) {
        setStep('select-calendars');
        setDiscoveryStatus('loading');
        setDiscoveryError(null);
        setAuthError(null);

        // Small delay after auth — Google's token may need a moment to propagate
        await new Promise(r => setTimeout(r, 500));

        const tryDiscover = async (attempt: number): Promise<void> => {
          try {
            await discoverCalendars(source);
            setDiscoveryStatus('idle');
          } catch (discoverErr) {
            const msg = discoverErr instanceof Error ? discoverErr.message : 'Failed to load calendars';
            console.error(`[AddCalendarFlow] Calendar discovery failed (attempt ${attempt}):`, discoverErr);
            // Retry once on 401/expired — token may not have propagated yet
            if (attempt < 2 && msg.includes('expired')) {
              await new Promise(r => setTimeout(r, 1500));
              return tryDiscover(attempt + 1);
            }
            setDiscoveryStatus('error');
            setDiscoveryError(msg);
          }
        };

        await tryDiscover(1);
      } else {
        // Auth was declined or cancelled — go back
        setStep('select-source');
      }
    } catch (authErr: any) {
      // Auth threw (popup blocked, timeout, etc.) — show error on auth step
      const msg = authErr instanceof Error ? authErr.message : 'Authentication failed';
      console.error('[AddCalendarFlow] Authentication failed:', msg);
      setAuthError(msg);
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
      googleAccountId: lastAuthGoogleAccountId || undefined,
      msAccountId: lastAuthMsAccountId || undefined,
    });

    handleOpenChange(false);
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
            {step === 'select-source' && 'Choose what you want to add to your calendar.'}
            {step === 'authenticate' && `Authenticating with ${selectedSource}...`}
            {step === 'select-calendars' && 'Choose which calendars to import.'}
            {step === 'assign-group' && 'Pick a group for your new calendars.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 min-h-[200px]">
            {/* Step 1: Select Source */}
            {step === 'select-source' && (
              <div className="space-y-2">
                {SOURCE_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const isDisabled = Boolean(option.disabled);
                  return (
                    <motion.button
                      key={option.id}
                      whileHover={isDisabled ? undefined : { scale: 1.01 }}
                      whileTap={isDisabled ? undefined : { scale: 0.98 }}
                      onClick={() => {
                        if (option.id === 'template') {
                          handleOpenTemplates();
                          return;
                        }

                        if (isDisabled) return;
                        handleSelectSource(option.id);
                      }}
                      disabled={isDisabled}
                      className={cn(
                        'w-full flex items-center gap-3 p-3.5 rounded-xl border border-border/60',
                        !isDisabled && 'hover:border-primary/30 hover:bg-primary/[0.02]',
                        !isDisabled && 'dark:hover:bg-primary/[0.04]',
                        isDisabled && 'cursor-not-allowed opacity-70',
                        'transition-all duration-200 text-left'
                      )}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${option.color}15` }}
                      >
                        <Icon size={20} style={{ color: option.color }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-semibold text-foreground">{option.label}</div>
                          {option.badge && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                              {option.badge}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {option.description}
                        </div>
                      </div>
                      {!isDisabled && (
                        <ArrowRight size={16} className="text-muted-foreground/40" />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            )}

            {/* Step 2: Authenticating */}
            {step === 'authenticate' && (
              <div className="flex flex-col items-center justify-center py-6 gap-3">
                {authError ? (
                  <>
                    <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                      <AlertTriangle size={20} className="text-amber-600" />
                    </div>
                    <p className="text-sm font-medium text-foreground text-center">
                      Sign-in didn't complete
                    </p>
                    <p className="text-xs text-muted-foreground text-center max-w-[260px]">
                      {authError.includes('timed out') || authError.includes('popup')
                        ? 'Your browser may be blocking the sign-in popup. Check for a popup-blocked icon in the address bar.'
                        : authError}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAuthError(null);
                          setStep('select-source');
                          resetSyncState();
                        }}
                      >
                        <ArrowLeft size={14} className="mr-1" />
                        Back
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setAuthError(null);
                          if (selectedSource) handleSelectSource(selectedSource);
                        }}
                      >
                        Try Again
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">
                      {syncState.message || 'Connecting...'}
                    </p>
                    <p className="text-[11px] text-muted-foreground/60 text-center">
                      A sign-in window should open.
                      <br />
                      If it doesn't appear, check your popup blocker.
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 text-xs text-muted-foreground"
                      onClick={() => {
                        if (selectedSource === 'google') cancelGoogleAuth();
                        setAuthError(null);
                        setStep('select-source');
                        resetSyncState();
                      }}
                    >
                      Cancel
                    </Button>
                  </>
                )}
              </div>
            )}

            {/* Step 3: Select Calendars */}
            {step === 'select-calendars' && (
              <div className="space-y-2">
                {discoveryStatus === 'loading' ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground">
                      Discovering calendars...
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 text-xs text-muted-foreground"
                      onClick={() => {
                        setDiscoveryStatus('idle');
                        setDiscoveryError(null);
                        resetSyncState();
                        setStep('select-source');
                      }}
                    >
                      <ArrowLeft size={12} className="mr-1" />
                      Cancel
                    </Button>
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
              </div>
            )}

            {/* Step 4: Assign Group */}
            {step === 'assign-group' && (
              <div className="space-y-4">
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
              </div>
            )}
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
