import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Calendar,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
  Unplug,
} from 'lucide-react';
import { useMicrosoftIntegration } from '@/hooks/use-microsoft-integration';

const MS_BLUE = '#0078d4';

type Step = 'connect' | 'pick' | 'synced';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function OutlookCalendarConnectDialog({ open, onOpenChange }: Props) {
  const ms = useMicrosoftIntegration();
  const [step, setStep] = useState<Step>(ms.status.connected ? 'synced' : 'connect');
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (ms.status.connected) setStep('synced');
    else setStep('connect');
  }, [ms.status.connected]);

  useEffect(() => {
    if (open && ms.status.connected && ms.calendars.length === 0) ms.loadCalendars();
  }, [open, ms.status.connected]);

  useEffect(() => {
    if (ms.calendars.length > 0 && !selectedCalendarId) {
      const def = ms.calendars.find((c) => c.isDefaultCalendar) || ms.calendars[0];
      setSelectedCalendarId(def.id);
    }
  }, [ms.calendars, selectedCalendarId]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type !== 'microsoft_oauth' || e.data.status !== 'connected') return;
      ms.loadCalendars();
      setStep('pick');
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [ms.loadCalendars]);

  const handleSync = async () => {
    if (!selectedCalendarId) return;
    setIsSyncing(true);
    try {
      await ms.syncCalendar(selectedCalendarId, false);
      setStep('synced');
      onOpenChange(false);
    } finally {
      setIsSyncing(false);
    }
  };

  const stepTitles: Record<Step, string> = {
    connect: 'Connect Outlook Calendar',
    pick: 'Choose a calendar',
    synced: 'Outlook Calendar',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${MS_BLUE}20` }}
            >
              <Calendar size={13} style={{ color: MS_BLUE }} />
            </div>
            {stepTitles[step]}
          </DialogTitle>
          <DialogDescription>
            {step === 'connect' && 'Sign in to view your Outlook events in Malleabite.'}
            {step === 'pick' && `Connected as ${ms.status.email} — choose a calendar.`}
            {step === 'synced' && 'Your Outlook calendar is synced.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 min-h-[160px]">

          {/* Step: connect */}
          {step === 'connect' && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: `${MS_BLUE}15` }}
              >
                <Calendar size={26} style={{ color: MS_BLUE }} />
              </div>
              <div>
                <p className="text-sm font-semibold">Microsoft Outlook</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-[220px] mx-auto">
                  View your Outlook events alongside your Malleabite calendar. Works with personal and work accounts.
                </p>
              </div>
              <Button onClick={ms.connect} className="gap-2 px-5" style={{ backgroundColor: MS_BLUE, color: 'white' }}>
                <ExternalLink size={14} />
                Sign in with Microsoft
              </Button>
              <p className="text-[11px] text-muted-foreground -mt-1">
                A popup will open and close automatically.
              </p>
            </div>
          )}

          {/* Step: pick */}
          {step === 'pick' && (
            <div className="space-y-3">
              {ms.calendarsLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
                  <Loader2 size={15} className="animate-spin" /> Loading calendars…
                </div>
              ) : ms.calendars.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <p className="text-sm text-muted-foreground">No calendars found.</p>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={ms.loadCalendars}>
                    <RefreshCw size={13} /> Retry
                  </Button>
                </div>
              ) : (
                <div className="space-y-1 max-h-52 overflow-y-auto">
                  {ms.calendars.map((cal) => {
                    const isSelected = cal.id === selectedCalendarId;
                    return (
                      <motion.button
                        key={cal.id}
                        whileHover={{ scale: 1.005 }}
                        whileTap={{ scale: 0.995 }}
                        onClick={() => setSelectedCalendarId(cal.id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm text-left transition-all',
                          isSelected
                            ? 'border-primary/30 bg-primary/[0.04]'
                            : 'border-transparent hover:border-border hover:bg-muted/40'
                        )}
                      >
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cal.color || MS_BLUE }}
                        />
                        <span className={cn('flex-1 truncate font-medium', isSelected && 'text-primary')}>
                          {cal.name}
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {cal.isDefaultCalendar && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Default</Badge>
                          )}
                          {isSelected && <Check size={13} style={{ color: MS_BLUE }} />}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}

              {selectedCalendarId && (
                <Button
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="w-full gap-2"
                  style={{ backgroundColor: MS_BLUE, color: 'white' }}
                >
                  {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
                  Sync this calendar
                </Button>
              )}
            </div>
          )}

          {/* Step: synced */}
          {step === 'synced' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-muted/30">
                <Calendar size={15} style={{ color: MS_BLUE }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">Outlook Calendar</p>
                  {ms.status.lastCalendarSyncAt && (
                    <p className="text-[11px] text-muted-foreground">
                      Last synced {formatTimeAgo(ms.status.lastCalendarSyncAt)}
                    </p>
                  )}
                </div>
                <Badge variant="secondary" className="text-[10px] flex-shrink-0">Active</Badge>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 flex-1"
                  onClick={() => ms.syncCalendar(selectedCalendarId!, false)}
                  disabled={isSyncing}
                >
                  {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Sync now
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 flex-1"
                  onClick={() => { ms.loadCalendars(); setStep('pick'); }}
                >
                  <ArrowLeft size={12} />
                  Change calendar
                </Button>
              </div>

              <div className="pt-1 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive h-8 text-xs"
                  onClick={async () => { await ms.disconnect(); setStep('connect'); }}
                >
                  <Unplug size={12} />
                  Disconnect Microsoft account
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
