// Meeting Link Picker Component
import React, { useState } from 'react';
import { Video, Link2, Copy, Check, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { 
  MeetingProvider, 
  generateMeetingLink, 
  getMeetingProviderInfo,
  detectMeetingProvider,
  formatMeetingLink 
} from '@/lib/meeting-links';
import { toast } from 'sonner';

interface MeetingLinkPickerProps {
  value?: string;
  provider?: MeetingProvider;
  onChange: (url: string, provider: MeetingProvider) => void;
  eventTitle?: string;
  className?: string;
}

const providers: MeetingProvider[] = ['google_meet', 'zoom', 'teams', 'custom'];

export function MeetingLinkPicker({
  value,
  provider,
  onChange,
  eventTitle = 'Meeting',
  className,
}: MeetingLinkPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const handleProviderSelect = (selectedProvider: MeetingProvider) => {
    if (selectedProvider === 'custom') {
      // Show input for custom URL
      return;
    }

    const meeting = generateMeetingLink({
      provider: selectedProvider,
      eventTitle,
    });

    onChange(meeting.url, selectedProvider);
    setIsOpen(false);
    toast.success(`${getMeetingProviderInfo(selectedProvider).name} link added`);
  };

  const handleCustomUrl = () => {
    if (!customUrl.trim()) return;

    const detected = detectMeetingProvider(customUrl);
    onChange(customUrl, detected || 'custom');
    setCustomUrl('');
    setIsOpen(false);
    toast.success('Meeting link added');
  };

  const handleCopy = async () => {
    if (!value) return;
    
    await navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRemove = () => {
    onChange('', 'custom');
    toast.success('Meeting link removed');
  };

  // If there's already a value, show the link display
  if (value) {
    const info = getMeetingProviderInfo(provider || detectMeetingProvider(value) || 'custom');
    
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg border border-border">
          <span className="text-lg">{info.icon}</span>
          <a 
            href={value} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex-1 text-sm text-primary hover:underline truncate"
          >
            {formatMeetingLink(value, provider)}
          </a>
          <button
            onClick={handleCopy}
            className="p-1 hover:bg-muted rounded transition-colors"
            title="Copy link"
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 hover:bg-muted rounded transition-colors"
            title="Open link"
          >
            <ExternalLink className="h-4 w-4 text-muted-foreground" />
          </a>
        </div>
        <Button variant="ghost" size="sm" onClick={handleRemove}>
          Remove
        </Button>
      </div>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("w-full justify-start gap-2", className)}>
          <Video className="h-4 w-4" />
          Add video conferencing
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="p-3 border-b border-border">
          <h4 className="font-medium text-sm">Add meeting link</h4>
          <p className="text-xs text-muted-foreground">
            Generate or add a video conferencing link
          </p>
        </div>

        <div className="p-2">
          {/* Quick generate options */}
          <div className="space-y-1 mb-3">
            {providers.slice(0, 3).map((p) => {
              const info = getMeetingProviderInfo(p);
              return (
                <button
                  key={p}
                  onClick={() => handleProviderSelect(p)}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <span className="text-xl">{info.icon}</span>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{info.name}</div>
                    <div className="text-xs text-muted-foreground">{info.description}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom URL input */}
          <div className="border-t border-border pt-3">
            <label className="text-xs font-medium text-muted-foreground mb-2 block">
              Or paste a custom link
            </label>
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://..."
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                className="flex-1"
              />
              <Button 
                size="sm" 
                onClick={handleCustomUrl}
                disabled={!customUrl.trim()}
              >
                <Link2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Simple badge to show meeting info on event cards
export function MeetingBadge({ 
  url, 
  provider 
}: { 
  url?: string; 
  provider?: MeetingProvider;
}) {
  if (!url) return null;

  const info = getMeetingProviderInfo(provider || detectMeetingProvider(url) || 'custom');

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs hover:bg-primary/20 transition-colors"
      onClick={(e) => e.stopPropagation()}
    >
      <span>{info.icon}</span>
      <span>Join</span>
    </a>
  );
}
