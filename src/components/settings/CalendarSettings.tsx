// Calendar Settings Page - Comprehensive settings for all calendar features
import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Settings,
  Bell,
  Clock,
  Link2,
  Video,
  Trash2,
  Plus,
  ExternalLink,
  Check,
  Loader2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useWorkingHours, type WorkingHoursSettings, type OutOfOfficeSettings, DAY_NAMES } from '@/hooks/use-working-hours';
import { useEmailNotifications, Reminder } from '@/hooks/use-email-notifications';
import { useExternalCalendarSync, ExternalCalendar } from '@/hooks/use-external-calendar-sync';
import { useOfflineMode } from '@/hooks/use-offline-mode';
import { useVideoConferencing, ConferenceProvider } from '@/hooks/use-video-conferencing';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { cn } from '@/lib/utils';

export function CalendarSettings() {
  return (
    <div className="container max-w-4xl mx-auto py-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Calendar Settings</h1>
      </div>

      <Tabs defaultValue="working-hours" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="working-hours" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Working Hours</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Notifications</span>
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            <span className="hidden sm:inline">Integrations</span>
          </TabsTrigger>
          <TabsTrigger value="video" className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            <span className="hidden sm:inline">Video</span>
          </TabsTrigger>
          <TabsTrigger value="offline" className="flex items-center gap-2">
            <Wifi className="h-4 w-4" />
            <span className="hidden sm:inline">Offline</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="working-hours">
          <WorkingHoursSettings />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationSettings />
        </TabsContent>

        <TabsContent value="integrations">
          <IntegrationSettings />
        </TabsContent>

        <TabsContent value="video">
          <VideoConferencingSettings />
        </TabsContent>

        <TabsContent value="offline">
          <OfflineSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Working Hours Settings
function WorkingHoursSettings() {
  const { workingHours, loading, saving, saveWorkingHours, toggleDay } = useWorkingHours();

  if (loading) {
    return <SettingsCardSkeleton />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Working Hours</CardTitle>
        <CardDescription>
          Set your working hours to help others find times when you're available
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable Toggle */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">Enable Working Hours</Label>
            <p className="text-sm text-muted-foreground">
              Show others when you're typically available
            </p>
          </div>
          <Switch
            checked={workingHours?.enabled ?? false}
            onCheckedChange={(checked) => saveWorkingHours({ enabled: checked })}
          />
        </div>

        {/* Working Days */}
        <div className="space-y-2">
          <Label>Working Days</Label>
          <div className="flex flex-wrap gap-2">
            {DAY_NAMES.map((name, idx) => (
              <button
                key={idx}
                onClick={() => toggleDay(idx)}
                className={cn(
                  'px-3 py-2 rounded-md border text-sm transition-colors',
                  workingHours?.schedule?.[idx]?.enabled
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'hover:bg-accent'
                )}
              >
                {name.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>

        {/* Timezone */}
        <div className="space-y-2">
          <Label>Timezone</Label>
          <Select
            value={workingHours?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone}
            onValueChange={(value) => saveWorkingHours({ timeZone: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 
                'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
                'Australia/Sydney', 'Pacific/Auckland'].map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {saving && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Notification Settings
function NotificationSettings() {
  const {
    preferences,
    loading,
    updatePreferences,
    addDefaultReminder,
    removeDefaultReminder,
    requestPushPermission,
  } = useEmailNotifications();

  if (loading) {
    return <SettingsCardSkeleton />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
          <CardDescription>
            Choose which email notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <NotificationToggle
            label="Event Reminders"
            description="Get reminded before your events"
            checked={preferences?.enableEventReminders ?? true}
            onChange={(checked) => updatePreferences({ enableEventReminders: checked })}
          />
          <NotificationToggle
            label="Event Invitations"
            description="Receive emails when invited to events"
            checked={preferences?.enableInvitations ?? true}
            onChange={(checked) => updatePreferences({ enableInvitations: checked })}
          />
          <NotificationToggle
            label="Event Updates"
            description="Get notified when events are changed"
            checked={preferences?.enableEventUpdates ?? true}
            onChange={(checked) => updatePreferences({ enableEventUpdates: checked })}
          />
          <NotificationToggle
            label="Event Cancellations"
            description="Be notified when events are cancelled"
            checked={preferences?.enableCancellations ?? true}
            onChange={(checked) => updatePreferences({ enableCancellations: checked })}
          />
          <NotificationToggle
            label="RSVP Responses"
            description="Know when attendees respond to your invites"
            checked={preferences?.enableRSVPNotifications ?? true}
            onChange={(checked) => updatePreferences({ enableRSVPNotifications: checked })}
          />
          <NotificationToggle
            label="Daily Agenda"
            description="Receive a daily summary of your schedule"
            checked={preferences?.enableDailyAgenda ?? false}
            onChange={(checked) => updatePreferences({ enableDailyAgenda: checked })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Default Reminders</CardTitle>
          <CardDescription>
            Automatically add these reminders to new events
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {preferences?.defaultReminders?.map((reminder, idx) => (
              <Badge key={reminder.id} variant="secondary" className="flex items-center gap-2 px-3 py-1">
                {reminder.method === 'email' ? '📧' : reminder.method === 'push' ? '🔔' : '📱'}
                {reminder.value} {reminder.unit} before
                <button
                  onClick={() => removeDefaultReminder(reminder.id)}
                  className="ml-1 hover:text-destructive"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => addDefaultReminder('email', 30, 'minutes')}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Reminder
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Push Notifications</CardTitle>
          <CardDescription>
            Get browser notifications for upcoming events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-base">Enable Push Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive real-time notifications in your browser
              </p>
            </div>
            <Switch
              checked={preferences?.enablePushNotifications ?? false}
              onCheckedChange={async (checked) => {
                if (checked) {
                  await requestPushPermission();
                } else {
                  await updatePreferences({ enablePushNotifications: false });
                }
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Integration Settings
function IntegrationSettings() {
  const {
    externalCalendars,
    loading,
    addICSSubscription,
    syncCalendar,
    removeCalendar,
    connectGoogleCalendar,
    connectOutlookCalendar,
    syncing,
    getSubscriptionUrl,
    exportAsICS,
  } = useExternalCalendarSync();

  const [newIcsUrl, setNewIcsUrl] = useState('');
  const [newIcsName, setNewIcsName] = useState('');

  const handleAddIcs = async () => {
    if (newIcsUrl && newIcsName) {
      await addICSSubscription(newIcsName, newIcsUrl);
      setNewIcsUrl('');
      setNewIcsName('');
    }
  };

  if (loading) {
    return <SettingsCardSkeleton />;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Connected Calendars</CardTitle>
          <CardDescription>
            Sync calendars from other services to view them in Malleabite
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connected calendars list */}
          {externalCalendars.length > 0 && (
            <div className="space-y-2">
              {externalCalendars.map((cal) => (
                <div
                  key={cal.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: cal.color }}
                    />
                    <div>
                      <div className="font-medium">{cal.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {cal.provider.toUpperCase()} •
                        {cal.lastSyncAt
                          ? ` Last synced ${dayjs(cal.lastSyncAt).fromNow()}`
                          : ' Never synced'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {cal.lastSyncStatus === 'error' && (
                      <Badge variant="destructive">Error</Badge>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => syncCalendar(cal.id)}
                      disabled={syncing === cal.id}
                    >
                      {syncing === cal.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Sync'
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => removeCalendar(cal.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add ICS subscription */}
          <div className="space-y-2 pt-4 border-t">
            <Label>Subscribe to ICS Calendar</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Calendar name"
                value={newIcsName}
                onChange={(e) => setNewIcsName(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="ICS URL"
                value={newIcsUrl}
                onChange={(e) => setNewIcsUrl(e.target.value)}
                className="flex-[2]"
              />
              <Button onClick={handleAddIcs} disabled={!newIcsUrl || !newIcsName}>
                Add
              </Button>
            </div>
          </div>

          {/* Connect services */}
          <div className="pt-4 border-t space-y-3">
            <Label>Connect Calendar Service</Label>
            <div className="flex gap-2">
              <Button variant="outline" onClick={connectGoogleCalendar}>
                <img
                  src="https://www.google.com/favicon.ico"
                  alt="Google"
                  className="h-4 w-4 mr-2"
                />
                Google Calendar
              </Button>
              <Button variant="outline" onClick={connectOutlookCalendar}>
                <img
                  src="https://outlook.live.com/favicon.ico"
                  alt="Outlook"
                  className="h-4 w-4 mr-2"
                />
                Outlook
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Share Your Calendar</CardTitle>
          <CardDescription>
            Let others subscribe to your calendar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-muted rounded-lg">
            <Label className="text-sm">Your Calendar Feed URL</Label>
            <div className="flex gap-2 mt-2">
              <Input
                readOnly
                value={getSubscriptionUrl() || 'Sign in to get your feed URL'}
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                onClick={() => {
                  const url = getSubscriptionUrl();
                  if (url) {
                    navigator.clipboard.writeText(url);
                    toast.success('Copied to clipboard');
                  }
                }}
              >
                Copy
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Video Conferencing Settings
function VideoConferencingSettings() {
  const { 
    settings, 
    setSettings,
    isZoomConnected, 
    isTeamsConnected,
    connectZoom,
    connectTeams,
    disconnectProvider 
  } = useVideoConferencing();

  const providers = [
    { id: 'zoom' as ConferenceProvider, name: 'Zoom', connected: isZoomConnected },
    { id: 'google_meet' as ConferenceProvider, name: 'Google Meet', connected: false },
    { id: 'teams' as ConferenceProvider, name: 'Microsoft Teams', connected: isTeamsConnected },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Video Conferencing</CardTitle>
        <CardDescription>
          Configure default video meeting settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Default provider */}
        <div className="space-y-2">
          <Label>Default Video Provider</Label>
          <Select
            value={settings?.provider || 'jitsi'}
            onValueChange={(value) =>
              setSettings(prev => ({ ...prev, provider: value as ConferenceProvider }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="jitsi">Jitsi Meet (Free, No Sign-in)</SelectItem>
              <SelectItem value="zoom">Zoom</SelectItem>
              <SelectItem value="google_meet">Google Meet</SelectItem>
              <SelectItem value="teams">Microsoft Teams</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Auto-add video */}
        <NotificationToggle
          label="Auto-add Video to Events"
          description="Automatically generate a video meeting link for new events"
          checked={settings?.autoAddToEvents ?? false}
          onChange={(checked) => setSettings(prev => ({ ...prev, autoAddToEvents: checked }))}
        />

        {/* Connected accounts */}
        <div className="space-y-3 pt-4 border-t">
          <Label>Connected Accounts</Label>
          {providers.map((provider) => (
            <div
              key={provider.id}
              className="flex items-center justify-between p-3 bg-muted rounded-lg"
            >
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4" />
                <span>{provider.name}</span>
              </div>
              {provider.connected ? (
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-500">
                    <Check className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => disconnectProvider(provider.id)}
                  >
                    Disconnect
                  </Button>
                </div>
              ) : (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    if (provider.id === 'zoom') connectZoom();
                    else if (provider.id === 'teams') connectTeams();
                    else toast.info('Google Meet integration coming soon');
                  }}
                >
                  Connect
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Offline Settings
function OfflineSettings() {
  const {
    isOnline,
    isServiceWorkerReady,
    pendingChanges,
    lastSyncAt,
    syncOfflineChanges,
    isSyncing,
  } = useOfflineMode();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Offline Mode</CardTitle>
        <CardDescription>
          Use Malleabite even when you're offline
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status */}
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
          {isOnline ? (
            <Wifi className="h-5 w-5 text-green-500" />
          ) : (
            <WifiOff className="h-5 w-5 text-orange-500" />
          )}
          <div>
            <div className="font-medium">
              {isOnline ? 'You are online' : 'You are offline'}
            </div>
            <div className="text-sm text-muted-foreground">
              {isServiceWorkerReady
                ? 'Offline mode is enabled'
                : 'Offline mode is not available'}
            </div>
          </div>
        </div>

        {/* Pending changes */}
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">Pending Changes</Label>
            <p className="text-sm text-muted-foreground">
              {pendingChanges > 0
                ? `${pendingChanges} change${pendingChanges > 1 ? 's' : ''} waiting to sync`
                : 'All changes synced'}
            </p>
          </div>
          {pendingChanges > 0 && (
            <Button
              variant="outline"
              onClick={() => syncOfflineChanges()}
              disabled={!isOnline || isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Sync Now
            </Button>
          )}
        </div>

        {/* Last sync */}
        {lastSyncAt && (
          <div className="text-sm text-muted-foreground">
            Last synced: {dayjs(lastSyncAt).format('MMM D, YYYY [at] h:mm A')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Helper Components
function NotificationToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <Label className="text-base">{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SettingsCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 w-32 bg-muted animate-pulse rounded" />
        <div className="h-4 w-48 bg-muted animate-pulse rounded mt-2" />
      </CardHeader>
      <CardContent className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-muted animate-pulse rounded" />
        ))}
      </CardContent>
    </Card>
  );
}

export default CalendarSettings;
