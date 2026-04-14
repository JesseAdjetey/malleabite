import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ExternalLink, Eye, EyeOff, AlertCircle, BookOpen } from 'lucide-react';

interface CanvasConnectSheetProps {
  open: boolean;
  onClose: () => void;
  onConnect: (baseUrl: string, token: string) => Promise<boolean>;
  connecting: boolean;
}

export default function CanvasConnectSheet({
  open,
  onClose,
  onConnect,
  connecting,
}: CanvasConnectSheetProps) {
  const [baseUrl, setBaseUrl] = useState('');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async () => {
    setError('');

    if (!baseUrl.trim()) {
      setError('Enter your Canvas URL (e.g. https://canvas.university.edu)');
      return;
    }
    if (!token.trim()) {
      setError('Enter your Canvas API token');
      return;
    }

    // Basic URL validation
    try {
      new URL(baseUrl.trim());
    } catch {
      setError('Enter a valid URL starting with https://');
      return;
    }

    const ok = await onConnect(baseUrl.trim(), token.trim());
    if (ok) {
      setBaseUrl('');
      setToken('');
      onClose();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#E66000]/15 flex items-center justify-center">
              <BookOpen size={16} className="text-[#E66000]" />
            </div>
            <SheetTitle>Connect Canvas</SheetTitle>
          </div>
          <SheetDescription>
            Link your Canvas LMS account to sync courses and assignments directly into Malleabite.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          {/* Canvas URL */}
          <div className="space-y-1.5">
            <Label htmlFor="canvas-url">Canvas URL</Label>
            <Input
              id="canvas-url"
              placeholder="https://canvas.university.edu"
              value={baseUrl}
              onChange={e => setBaseUrl(e.target.value)}
              disabled={connecting}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              The base URL of your institution's Canvas instance.
            </p>
          </div>

          {/* API Token */}
          <div className="space-y-1.5">
            <Label htmlFor="canvas-token">API Token</Label>
            <div className="relative">
              <Input
                id="canvas-token"
                type={showToken ? 'text' : 'password'}
                placeholder="Paste your Canvas API token"
                value={token}
                onChange={e => setToken(e.target.value)}
                disabled={connecting}
                className="pr-10"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowToken(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showToken ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* How to get token */}
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-medium">How to get your API token:</p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Log in to your Canvas account</li>
              <li>Go to <strong>Account → Settings</strong></li>
              <li>Scroll to <strong>Approved Integrations</strong></li>
              <li>Click <strong>+ New Access Token</strong></li>
              <li>Give it a name (e.g. "Malleabite") and generate</li>
              <li>Copy the token and paste it above</li>
            </ol>
            <a
              href="https://community.canvaslms.com/t5/Student-Guide/How-do-I-manage-API-access-tokens-as-a-student/ta-p/273"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
            >
              View Canvas guide <ExternalLink size={11} />
            </a>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <AlertCircle size={14} className="text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={connecting}>
              Cancel
            </Button>
            <Button
              className="flex-1 bg-[#E66000] hover:bg-[#E66000]/90 text-white"
              onClick={handleConnect}
              disabled={connecting || !baseUrl || !token}
            >
              {connecting ? 'Connecting…' : 'Connect'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
