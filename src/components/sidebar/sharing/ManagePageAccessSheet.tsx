import React, { useState, useEffect, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, X, Crown, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Timestamp, collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { COLLECTIONS } from '@/integrations/firebase/firestore';
import { useAuth } from '@/contexts/AuthContext.firebase';
import {
  inviteToPage,
  removePageCollaborator,
  updatePageCollaboratorRole,
  PageShareData,
  PageInvite,
} from '@/hooks/use-page-sharing';
import { ModuleCollaborator } from '@/hooks/use-module-sharing';
import { ModuleInstance } from '@/lib/stores/types';

interface ManagePageAccessSheetProps {
  pageId: string;
  pageTitle: string;
  modules: ModuleInstance[];
  open: boolean;
  onClose: () => void;
}

const ManagePageAccessSheet: React.FC<ManagePageAccessSheetProps> = ({
  pageId,
  pageTitle,
  modules,
  open,
  onClose,
}) => {
  const { user } = useAuth();

  const [shareData, setShareData] = useState<PageShareData | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PageInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const shareSnap = await getDoc(doc(db, COLLECTIONS.PAGE_SHARES, pageId));
        if (!cancelled) {
          setShareData(shareSnap.exists() ? (shareSnap.data() as PageShareData) : null);
        }
      } catch {
        // Permission denied — leave shareData as-is
      }

      try {
        const invitesSnap = await getDocs(query(
          collection(db, COLLECTIONS.PAGE_INVITES),
          where('pageId', '==', pageId),
        ));
        if (!cancelled) {
          const pending = invitesSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as PageInvite))
            .filter(inv => inv.status === 'pending');
          setPendingInvites(pending);
        }
      } catch (err) {
        console.error('[ManagePageAccessSheet] pending invites fetch error:', err);
      }

      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [open, pageId, refreshKey]);

  const collaborators: ModuleCollaborator[] = shareData?.collaborators ?? [];

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteShareMode, setInviteShareMode] = useState<'live' | 'duplicate'>('live');
  const [inviteRole, setInviteRole] = useState<'viewer' | 'editor'>('viewer');
  const [sending, setSending] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleSendInvite = async () => {
    if (!user || !inviteEmail.trim()) return;
    const trimmedEmail = inviteEmail.trim().toLowerCase();
    if (trimmedEmail === user.email?.toLowerCase()) {
      toast.error("You can't invite yourself.");
      return;
    }
    setSending(true);
    try {
      await inviteToPage({
        pageId,
        pageTitle,
        modules,
        recipientEmail: trimmedEmail,
        role: inviteShareMode === 'live' ? inviteRole : 'viewer',
        shareMode: inviteShareMode,
        senderUser: { uid: user.uid, email: user.email ?? '', displayName: user.displayName },
      });
      toast.success(`Invite sent to ${trimmedEmail}`);
      setInviteEmail('');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      setPendingInvites(prev => [
        ...prev,
        {
          id: `optimistic-${Date.now()}`,
          pageId,
          pageTitle,
          senderId: user.uid,
          senderEmail: user.email ?? '',
          senderName: user.displayName ?? user.email ?? 'Unknown',
          recipientEmail: trimmedEmail,
          role: inviteShareMode === 'live' ? inviteRole : 'viewer',
          shareMode: inviteShareMode,
          status: 'pending',
          createdAt: Timestamp.now(),
          expiresAt: Timestamp.fromDate(expiresAt),
        } as PageInvite,
      ]);
    } catch (err: any) {
      console.error('[ManagePageAccessSheet] invite error:', err);
      toast.error(err?.message || 'Failed to send invite');
    } finally {
      setSending(false);
    }
  };

  const handleRemove = async (collaborator: ModuleCollaborator) => {
    setRemovingId(collaborator.userId);
    try {
      await removePageCollaborator({ pageId, collaborator, pageModules: modules });
      toast.success(`Removed ${collaborator.email}`);
      refresh();
    } catch {
      toast.error('Failed to remove collaborator');
    } finally {
      setRemovingId(null);
    }
  };

  const handleRoleChange = async (collaborator: ModuleCollaborator, newRole: 'viewer' | 'editor') => {
    try {
      await updatePageCollaboratorRole({ pageId, collaborator, newRole });
      refresh();
    } catch {
      toast.error('Failed to update role');
    }
  };

  const initials = (name: string) =>
    name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="right"
        className="top-3 bottom-3 right-3 h-auto w-full sm:max-w-md flex flex-col gap-0 p-0 rounded-2xl shadow-2xl border border-border/60"
      >
        <SheetHeader className="px-6 py-4 border-b border-border">
          <SheetTitle className="text-base flex items-center gap-2">
            <Users size={16} className="text-primary" />
            Share Page
            <span className="text-muted-foreground font-normal ml-1">— {pageTitle}</span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

          {/* People with access */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              People with access
            </p>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 size={14} className="animate-spin" />
                Loading...
              </div>
            ) : (
              <div className="space-y-2">
                {/* Owner row */}
                <div className="flex items-center gap-3 py-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                    {initials(shareData?.ownerName ?? user?.displayName ?? user?.email ?? '?')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {shareData?.ownerName ?? user?.displayName ?? user?.email}
                      <span className="text-muted-foreground font-normal ml-1">(you)</span>
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {shareData?.ownerEmail ?? user?.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Crown size={12} className="text-yellow-500" />
                    <span className="text-xs text-muted-foreground">Owner</span>
                  </div>
                </div>

                {/* Collaborators */}
                {collaborators.map((collab) => (
                  <div key={collab.userId} className="flex items-center gap-3 py-2">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {initials(collab.displayName || collab.email)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{collab.displayName || collab.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{collab.email}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Select
                        value={collab.role}
                        onValueChange={(v) => handleRoleChange(collab, v as 'viewer' | 'editor')}
                      >
                        <SelectTrigger className="h-7 text-xs w-24 border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="editor">Editor</SelectItem>
                        </SelectContent>
                      </Select>
                      <button
                        onClick={() => handleRemove(collab)}
                        disabled={removingId === collab.userId}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors ml-1"
                      >
                        {removingId === collab.userId
                          ? <Loader2 size={14} className="animate-spin" />
                          : <X size={14} />
                        }
                      </button>
                    </div>
                  </div>
                ))}

                {collaborators.length === 0 && !loading && (
                  <p className="text-sm text-muted-foreground py-2">
                    Only you have access. Invite someone below.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Pending invites */}
          {pendingInvites.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Pending invites
              </p>
              <div className="space-y-2">
                {pendingInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center gap-3 py-2">
                    <div className="w-8 h-8 rounded-full bg-muted/50 border border-dashed border-border flex items-center justify-center flex-shrink-0">
                      <Clock size={14} className="text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{invite.recipientEmail}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {invite.shareMode === 'duplicate'
                          ? 'Duplicate'
                          : `${invite.role === 'viewer' ? 'Viewer' : 'Editor'} · Live`
                        }
                        {' '}· Pending
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                      {invite.shareMode === 'duplicate' ? 'Copy' : invite.role}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invite section */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Invite someone
            </p>
            <div className="space-y-2">
              <Input
                type="email"
                placeholder="Email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendInvite()}
                className="bg-muted/30"
              />

              {/* Share mode toggle */}
              <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                <button
                  onClick={() => setInviteShareMode('live')}
                  className={`flex-1 px-3 py-2 transition-colors ${inviteShareMode === 'live' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-accent'}`}
                >
                  Live
                </button>
                <button
                  onClick={() => setInviteShareMode('duplicate')}
                  className={`flex-1 px-3 py-2 transition-colors ${inviteShareMode === 'duplicate' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-accent'}`}
                >
                  Duplicate
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                {inviteShareMode === 'live'
                  ? 'Recipient sees your page live. Choose their access level.'
                  : 'Recipient gets an independent copy of this page and all its content.'}
              </p>

              {inviteShareMode === 'live' && (
                <div className="flex gap-2">
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'viewer' | 'editor')}>
                    <SelectTrigger className="flex-1 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">
                        <div>
                          <p className="font-medium">Viewer</p>
                          <p className="text-xs text-muted-foreground">Read-only, sees all live changes</p>
                        </div>
                      </SelectItem>
                      <SelectItem value="editor">
                        <div>
                          <p className="font-medium">Editor</p>
                          <p className="text-xs text-muted-foreground">Can edit module content</p>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={handleSendInvite}
                    disabled={sending || !inviteEmail.trim()}
                    className="px-4"
                  >
                    {sending ? <Loader2 size={14} className="animate-spin" /> : 'Invite'}
                  </Button>
                </div>
              )}

              {inviteShareMode === 'duplicate' && (
                <Button
                  onClick={handleSendInvite}
                  disabled={sending || !inviteEmail.trim()}
                  className="w-full"
                >
                  {sending ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
                  Send duplicate invite
                </Button>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ManagePageAccessSheet;
