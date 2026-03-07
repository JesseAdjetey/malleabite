import React, { useState } from 'react';
import { MessageCircle, Link2, Link2Off, Copy, Check, RefreshCw, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext.unified';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/integrations/firebase/config';
import { doc, getDoc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';

const functions = getFunctions(app, 'us-central1');

interface WhatsAppLinkProps {
  className?: string;
}

export function WhatsAppLink({ className }: WhatsAppLinkProps) {
  const { user } = useAuth();
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isLinked, setIsLinked] = useState(false);
  const [linkedPhone, setLinkedPhone] = useState<string | null>(null);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);

  // Check current link status on mount
  React.useEffect(() => {
    checkLinkStatus();
  }, [user]);

  const checkLinkStatus = async () => {
    if (!user?.uid) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const data = userDoc.data();
      if (data?.whatsappPhone) {
        setIsLinked(true);
        setLinkedPhone(data.whatsappPhone);
      } else {
        setIsLinked(false);
        setLinkedPhone(null);
      }
    } catch (err) {
      console.error('Failed to check WhatsApp link status:', err);
    }
  };

  const generateCode = async () => {
    setIsGenerating(true);
    try {
      const generateWhatsAppLinkCode = httpsCallable(functions, 'generateWhatsAppLinkCode');
      const result = await generateWhatsAppLinkCode();
      const data = result.data as { code: string; expiresInSeconds: number };
      setLinkCode(data.code);
      setExpiresAt(Date.now() + data.expiresInSeconds * 1000);
      toast.success('Link code generated! Send it to Mally on WhatsApp.');
    } catch (err: any) {
      console.error('Failed to generate link code:', err);
      toast.error('Failed to generate link code. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyCode = async () => {
    if (!linkCode) return;
    try {
      await navigator.clipboard.writeText(linkCode);
      setIsCopied(true);
      toast.success('Code copied to clipboard!');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error('Failed to copy code');
    }
  };

  const unlinkAccount = async () => {
    if (!user?.uid) return;
    setIsUnlinking(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        whatsappPhone: deleteField(),
        whatsappLinkedAt: deleteField(),
      });
      setIsLinked(false);
      setLinkedPhone(null);
      setLinkCode(null);
      toast.success('WhatsApp account unlinked.');
    } catch (err) {
      console.error('Failed to unlink:', err);
      toast.error('Failed to unlink. Please try again.');
    } finally {
      setIsUnlinking(false);
    }
  };

  const isExpired = expiresAt ? Date.now() > expiresAt : false;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-base">WhatsApp</CardTitle>
              <CardDescription className="text-xs">
                Manage your calendar via WhatsApp
              </CardDescription>
            </div>
          </div>
          <Badge variant={isLinked ? 'default' : 'secondary'} className={cn(
            'text-xs',
            isLinked && 'bg-green-600 hover:bg-green-600'
          )}>
            {isLinked ? 'Connected' : 'Not Connected'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLinked ? (
          /* ─── Connected State ────────────────────────────────────────── */
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <Smartphone className="h-4 w-4 text-green-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  Linked to {linkedPhone ? `+${linkedPhone.slice(0, 3)}•••••${linkedPhone.slice(-4)}` : 'WhatsApp'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Send messages to Mally on WhatsApp to manage your calendar
                </p>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1 px-1">
              <p>• Send <strong>"menu"</strong> to see all options</p>
              <p>• Send <strong>"today"</strong> to see your schedule</p>
              <p>• Send <strong>"todos"</strong> to see your tasks</p>
              <p>• Or just chat naturally with Mally AI</p>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="w-full text-destructive hover:text-destructive"
              onClick={unlinkAccount}
              disabled={isUnlinking}
            >
              <Link2Off className="h-3.5 w-3.5 mr-1.5" />
              {isUnlinking ? 'Unlinking...' : 'Unlink WhatsApp'}
            </Button>
          </div>
        ) : (
          /* ─── Not Connected State ────────────────────────────────────── */
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Link your WhatsApp to create events, manage todos, and chat with Mally AI — all from WhatsApp.
            </p>

            {linkCode && !isExpired ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-2 p-4 rounded-lg bg-muted/50 border border-border">
                  <span className="text-3xl font-mono font-bold tracking-[0.3em] text-primary">
                    {linkCode}
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={copyCode}
                  >
                    {isCopied ? (
                      <><Check className="h-3.5 w-3.5 mr-1.5" /> Copied!</>
                    ) : (
                      <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy Code</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateCode}
                    disabled={isGenerating}
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", isGenerating && "animate-spin")} />
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground text-center space-y-1">
                  <p>Send this code to <strong>Mally</strong> on WhatsApp</p>
                  <p className="text-[10px]">Code expires in 10 minutes</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  onClick={generateCode}
                  disabled={isGenerating}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  {isGenerating ? 'Generating...' : 'Generate Link Code'}
                </Button>

                {isExpired && (
                  <p className="text-xs text-amber-600 text-center">
                    Previous code expired. Generate a new one.
                  </p>
                )}

                <ol className="text-xs text-muted-foreground space-y-1 px-1 list-decimal list-inside">
                  <li>Click "Generate Link Code" above</li>
                  <li>Open WhatsApp and message the Mally bot</li>
                  <li>Send the 6-digit code</li>
                  <li>You're connected! 🎉</li>
                </ol>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
