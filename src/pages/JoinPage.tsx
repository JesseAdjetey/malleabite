import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { COLLECTIONS } from '@/integrations/firebase/firestore';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { useSidebarStore } from '@/lib/store';
import {
  acceptShareLink,
  ShareTokenData,
} from '@/hooks/use-module-sharing';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

type Status = 'loading' | 'ready' | 'accepting' | 'done' | 'error' | 'already_joined' | 'not_found';

export default function JoinPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { pages, addSharedModule } = useSidebarStore();

  const [status, setStatus] = useState<Status>('loading');
  const [tokenData, setTokenData] = useState<ShareTokenData | null>(null);

  // Fetch token metadata once auth is resolved
  useEffect(() => {
    if (authLoading || !token) return;

    (async () => {
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.SHARE_TOKENS, token));
        if (!snap.exists()) {
          setStatus('not_found');
          return;
        }
        setTokenData(snap.data() as ShareTokenData);
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    })();
  }, [token, authLoading]);

  const handleAccept = async () => {
    if (!user || !tokenData) return;

    setStatus('accepting');
    try {
      await acceptShareLink({
        shareTokenData: tokenData,
        acceptingUser: {
          uid: user.uid,
          email: user.email ?? '',
          displayName: user.displayName,
        },
        targetPageIndex: 0,
        addSharedModule,
      });
      setStatus('done');
      toast.success(`"${tokenData.moduleTitle}" added to your sidebar!`);
      setTimeout(() => navigate('/'), 1500);
    } catch (err: any) {
      if (err.message === 'already_owner') {
        toast.info("This is your own module.");
        navigate('/');
      } else if (err.message === 'already_collaborator') {
        setStatus('already_joined');
      } else {
        toast.error('Failed to join module');
        setStatus('ready');
      }
    }
  };

  if (authLoading || status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (status === 'not_found') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3 max-w-sm px-4">
          <XCircle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-xl font-semibold">Invalid link</h1>
          <p className="text-sm text-muted-foreground">
            This share link is invalid or has expired.
          </p>
          <Button asChild variant="outline"><Link to="/">Go home</Link></Button>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3 max-w-sm px-4">
          <XCircle className="h-12 w-12 text-destructive mx-auto" />
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <Button asChild variant="outline"><Link to="/">Go home</Link></Button>
        </div>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
          <p className="text-sm text-muted-foreground">Redirecting you…</p>
        </div>
      </div>
    );
  }

  if (status === 'already_joined') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3 max-w-sm px-4">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
          <h1 className="text-xl font-semibold">Already joined</h1>
          <p className="text-sm text-muted-foreground">
            You already have access to <strong>{tokenData?.moduleTitle}</strong>.
          </p>
          <Button asChild><Link to="/">Go to app</Link></Button>
        </div>
      </div>
    );
  }

  // status === 'ready'
  if (!user) {
    // Not logged in — redirect to auth with return URL
    const returnUrl = `/join/${token}`;
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-sm px-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              {tokenData?.ownerName} shared a module with you
            </p>
            <h1 className="text-2xl font-bold">{tokenData?.moduleTitle}</h1>
            <p className="text-sm text-muted-foreground">
              Sign in to join as a viewer.
            </p>
          </div>
          <Button asChild className="w-full">
            <Link to={`/auth?redirect=${encodeURIComponent(returnUrl)}`}>
              Sign in to join
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4 max-w-sm px-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            {tokenData?.ownerName} shared a module with you
          </p>
          <h1 className="text-2xl font-bold">{tokenData?.moduleTitle}</h1>
          <p className="text-sm text-muted-foreground">
            You'll join as a <strong>viewer</strong>. The module will appear on your home page.
          </p>
        </div>
        <div className="flex gap-2 justify-center">
          <Button
            onClick={handleAccept}
            disabled={status === 'accepting'}
            className="px-8"
          >
            {status === 'accepting'
              ? <><Loader2 size={14} className="animate-spin mr-2" />Joining…</>
              : 'Join module'
            }
          </Button>
          <Button variant="outline" asChild>
            <Link to="/">Cancel</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
