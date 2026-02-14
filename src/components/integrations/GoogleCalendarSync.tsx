// Google Calendar Sync Settings Component
import React, { useState } from 'react';
import { RefreshCw, Link2, Link2Off, Calendar, Check, AlertCircle, Upload, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useGoogleCalendar } from '@/hooks/use-google-calendar';
import { useCalendarEvents } from '@/hooks/use-calendar-events.unified';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CalendarEventType } from '@/lib/stores/types';

interface GoogleCalendarSyncProps {
  className?: string;
}

export function GoogleCalendarSync({ className }: GoogleCalendarSyncProps) {
  const {
    isConnected,
    isConnecting,
    isSyncing,
    calendars,
    selectedCalendar,
    setSelectedCalendar,
    error,
    lastSyncTime,
    syncEnabled,
    setSyncEnabled,
    connect,
    disconnect,
    importEvents,
    exportAllToGoogle,
  } = useGoogleCalendar();

  const { addEvent, updateEvent, events } = useCalendarEvents();

  const [importedCount, setImportedCount] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleConnect = async () => {
    try {
      await connect();
      toast.success('Connected to Google Calendar!');
    } catch {
      toast.error('Failed to connect to Google Calendar');
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setImportedCount(null);
    toast.success('Disconnected from Google Calendar');
  };

  // Import Google Calendar events → save each to Firestore
  const handleImport = async () => {
    try {
      const googleEvents = await importEvents();

      let saved = 0;
      let skipped = 0;

      for (const rawEvent of googleEvents) {
        const event = rawEvent as CalendarEventType;

        // Skip if already imported (matching googleEventId in local events)
        const alreadyExists = events.some(e => e.googleEventId === event.googleEventId);
        if (alreadyExists) {
          skipped++;
          continue;
        }

        const result = await addEvent(event);
        if (result.success) saved++;
      }

      setImportedCount(saved);
      if (saved > 0) {
        toast.success(`Imported ${saved} new events from Google Calendar${skipped > 0 ? ` (${skipped} already existed)` : ''}`);
      } else if (skipped > 0) {
        toast.success('All Google Calendar events are already up to date');
      } else {
        toast.success('No events found in the selected date range');
      }
    } catch {
      toast.error('Failed to import events');
    }
  };

  // Export unsynced local events → Google Calendar
  const handleExportToGoogle = async () => {
    setIsExporting(true);
    try {
      const count = await exportAllToGoogle(events, updateEvent);
      if (count > 0) {
        toast.success(`Exported ${count} events to Google Calendar`);
      } else {
        toast.success('All local events are already synced to Google Calendar');
      }
    } catch {
      toast.error('Failed to export events to Google Calendar');
    } finally {
      setIsExporting(false);
    }
  };

  const syncedCount = events.filter(e => e.googleEventId).length;

  return (
    <Card className={cn("glass", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            <CardTitle className="text-lg">Google Calendar</CardTitle>
          </div>
          {isConnected && (
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
              <Check className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
        </div>
        <CardDescription>
          2-way sync between Malleabite and Google Calendar
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {!isConnected ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connect your Google Calendar to import events and keep them in sync.
            </p>
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full"
            >
              {isConnecting ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Connecting...</>
              ) : (
                <><Link2 className="h-4 w-4 mr-2" />Connect Google Calendar</>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Calendar selector */}
            {calendars.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Calendar</label>
                <Select value={selectedCalendar} onValueChange={setSelectedCalendar}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a calendar" />
                  </SelectTrigger>
                  <SelectContent>
                    {calendars.map((cal) => (
                      <SelectItem key={cal.id} value={cal.id}>
                        {cal.summary} {cal.primary && '(Primary)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Sync status */}
            <div className="text-xs text-muted-foreground space-y-1">
              {lastSyncTime && (
                <div>Last synced: {lastSyncTime.toLocaleString()}</div>
              )}
              {syncedCount > 0 && (
                <div>{syncedCount} event{syncedCount !== 1 ? 's' : ''} linked to Google Calendar</div>
              )}
              {importedCount !== null && (
                <div className="text-green-400">{importedCount} events imported this session</div>
              )}
            </div>

            {/* Auto-sync toggle */}
            <button
              onClick={() => {
                setSyncEnabled(!syncEnabled);
                toast.success(syncEnabled ? 'Auto-sync disabled' : 'Auto-sync enabled — new events will push to Google Calendar');
              }}
              className="flex items-center justify-between w-full text-sm py-2 hover:opacity-80 transition-opacity"
            >
              <span className="text-foreground">Auto-sync new events to Google</span>
              {syncEnabled
                ? <ToggleRight className="h-5 w-5 text-green-400" />
                : <ToggleLeft className="h-5 w-5 text-muted-foreground" />
              }
            </button>

            {/* Action buttons */}
            <div className="flex gap-2">
              {/* Import: Google → Malleabite */}
              <Button
                onClick={handleImport}
                disabled={isSyncing}
                className="flex-1"
                variant="outline"
              >
                {isSyncing ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Importing...</>
                ) : (
                  <><RefreshCw className="h-4 w-4 mr-2" />Import from Google</>
                )}
              </Button>

              {/* Export: Malleabite → Google */}
              <Button
                onClick={handleExportToGoogle}
                disabled={isExporting}
                className="flex-1"
              >
                {isExporting ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Exporting...</>
                ) : (
                  <><Upload className="h-4 w-4 mr-2" />Push to Google</>
                )}
              </Button>
            </div>

            {/* Disconnect */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDisconnect}
              className="w-full text-muted-foreground hover:text-foreground"
            >
              <Link2Off className="h-4 w-4 mr-2" />
              Disconnect Google Calendar
            </Button>

            {/* Error display */}
            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 p-2 rounded">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
