// Google Calendar Sync Settings Component
import React, { useState } from 'react';
import { RefreshCw, Link2, Link2Off, Calendar, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useGoogleCalendar } from '@/hooks/use-google-calendar';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface GoogleCalendarSyncProps {
  onImport?: (events: any[]) => void;
  className?: string;
}

export function GoogleCalendarSync({ onImport, className }: GoogleCalendarSyncProps) {
  const {
    isConnected,
    isConnecting,
    isSyncing,
    calendars,
    selectedCalendar,
    setSelectedCalendar,
    error,
    lastSyncTime,
    connect,
    disconnect,
    importEvents,
  } = useGoogleCalendar();

  const [importedCount, setImportedCount] = useState<number | null>(null);

  const handleConnect = async () => {
    try {
      await connect();
      toast.success('Connected to Google Calendar!');
    } catch (err) {
      toast.error('Failed to connect to Google Calendar');
    }
  };

  const handleDisconnect = () => {
    disconnect();
    setImportedCount(null);
    toast.success('Disconnected from Google Calendar');
  };

  const handleImport = async () => {
    try {
      const events = await importEvents();
      setImportedCount(events.length);
      if (onImport) {
        onImport(events);
      }
      toast.success(`Imported ${events.length} events from Google Calendar`);
    } catch (err) {
      toast.error('Failed to import events');
    }
  };

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
          Sync your events with Google Calendar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected ? (
          // Not connected state
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
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Connect Google Calendar
                </>
              )}
            </Button>
          </div>
        ) : (
          // Connected state
          <div className="space-y-4">
            {/* Calendar selector */}
            {calendars.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Calendar</label>
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
            {lastSyncTime && (
              <div className="text-xs text-muted-foreground">
                Last synced: {lastSyncTime.toLocaleString()}
                {importedCount !== null && ` (${importedCount} events)`}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2">
              <Button 
                onClick={handleImport} 
                disabled={isSyncing}
                className="flex-1"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Syncing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Import Events
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={handleDisconnect}
              >
                <Link2Off className="h-4 w-4" />
              </Button>
            </div>

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
