// Slack Notifications Settings Component
import React, { useState, useEffect } from 'react';
import { MessageSquare, Link2, Link2Off, Check, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  getSlackWebhook, 
  setSlackWebhook, 
  removeSlackWebhook, 
  isSlackConnected,
  testSlackWebhook 
} from '@/lib/slack-client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SlackNotificationsProps {
  className?: string;
}

export function SlackNotifications({ className }: SlackNotificationsProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if already connected on mount
    setIsConnected(isSlackConnected());
    const savedWebhook = getSlackWebhook();
    if (savedWebhook) {
      // Mask the webhook URL for display
      setWebhookUrl('••••••••••••••••');
    }
  }, []);

  const handleConnect = async () => {
    if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
      setError('Please enter a valid Slack webhook URL');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const success = await testSlackWebhook(webhookUrl);
      
      if (success) {
        setSlackWebhook(webhookUrl);
        setIsConnected(true);
        setWebhookUrl('••••••••••••••••');
        toast.success('Connected to Slack! A test notification was sent.');
      } else {
        setError('Failed to connect. Please check your webhook URL.');
      }
    } catch (err) {
      setError('Connection failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    removeSlackWebhook();
    setIsConnected(false);
    setWebhookUrl('');
    setError(null);
    toast.success('Disconnected from Slack');
  };

  return (
    <Card className={cn("glass", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-lg">Slack Notifications</CardTitle>
          </div>
          {isConnected && (
            <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/30">
              <Check className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          )}
        </div>
        <CardDescription>
          Get event reminders and daily digests in Slack
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected ? (
          // Not connected state
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Slack Webhook URL</label>
              <Input
                type="url"
                placeholder="https://hooks.slack.com/services/..."
                value={webhookUrl}
                onChange={(e) => {
                  setWebhookUrl(e.target.value);
                  setError(null);
                }}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Create an{' '}
                <a
                  href="https://api.slack.com/messaging/webhooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Incoming Webhook
                  <ExternalLink className="h-3 w-3" />
                </a>{' '}
                in your Slack workspace
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 p-2 rounded">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <Button 
              onClick={handleConnect} 
              disabled={isLoading || !webhookUrl}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Testing Connection...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 mr-2" />
                  Connect to Slack
                </>
              )}
            </Button>
          </div>
        ) : (
          // Connected state
          <div className="space-y-4">
            <div className="bg-muted/50 p-3 rounded-lg">
              <div className="text-sm text-muted-foreground mb-1">Webhook URL</div>
              <div className="font-mono text-sm">{webhookUrl}</div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Notifications Enabled</div>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-500" />
                  Event reminders
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-500" />
                  Daily schedule digest
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-500" />
                  Event created notifications
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-3 w-3 text-green-500" />
                  Event updated notifications
                </li>
              </ul>
            </div>

            <Button 
              variant="outline" 
              onClick={handleDisconnect}
              className="w-full"
            >
              <Link2Off className="h-4 w-4 mr-2" />
              Disconnect from Slack
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
