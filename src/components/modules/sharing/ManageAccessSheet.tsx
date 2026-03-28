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
import { Loader2, X, Crown, Clock, Link, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Timestamp, collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { COLLECTIONS } from '@/integrations/firebase/firestore';
import { useAuth } from '@/contexts/AuthContext.firebase';
import {
  inviteToModule,
  removeCollaborator,
  updateCollaboratorRole,
  getOrCreateShareToken,
  ModuleCollaborator,
  ModuleShareData,
  ModuleInvite,
} from '@/hooks/use-module-sharing';
import { ModuleType } from '@/lib/stores/types';

interface ManageAccessSheetProps {
  moduleInstanceId: string;
  moduleType: ModuleType | string;
  moduleTitle: string;
  listId?: string;
  isOwnModule?: boolean;
  open: boolean;
  onClose: () => void;
}

const ManageAccessSheet: React.FC<ManageAccessSheetProps> = ({
  moduleInstanceId,
  moduleType,
  moduleTitle,
  listId,
  isOwnModule = false,
  open,
  onClose,
}) => {
  const { user } = useAuth();

  // Local state — populated via one-time fetches (no onSnapshot to avoid SDK panics)
  const [shareData, setShareData] = useState<ModuleShareData | null>(null);
  const [pendingInvites, setPendingInvites] = useState<ModuleInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // Fetch data whenever the sheet opens or after a mutation
  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);

    (async () => {
      // Fetch share data and pending invites independently so one failure
      // doesn't wipe both results.
      try {
        const shareSnap = await getDoc(doc(db, COLLECTIONS.MODULE_SHARES, moduleInstanceId));
        if (!cancelled) {
          setShareData(shareSnap.exists() ? (shareSnap.data() as ModuleShareData) : null);
        }
      } catch {
        // Permission denied — leave shareData as-is
      }

      try {
        // Single-field query only — no composite index needed, filter client-side
        const invitesSnap = await getDocs(query(
          collection(db, COLLECTIONS.MODULE_INVITES),
          where('moduleInstanceId', '==', moduleInstanceId),
        ));
        if (!cancelled) {
          const pending = invitesSnap.docs
            .map(d => ({ id: d.id, ...d.data() } as ModuleInvite))
            .filter(inv => inv.status === 'pending');
          setPendingInvites(pending);
        }
      } catch (err) {
        console.error('[ManageAccessSheet] pending invites fetch error:', err);
      }

      if (!cancelled) setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [open, moduleInstanceId, refreshKey]);

  const isFirestoreOwner = shareData?.ownerId === user?.uid;
  const collaborators: ModuleCollaborator[] = shareData?.collaborators ?? [];
  const canManage = isOwnModule || isFirestoreOwner;

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'viewer' | 'editor'>('viewer');
  const [inviteShareMode, setInviteShareMode] = useState<'collaborative' | 'duplicate'>('collaborative');
  const [sending, setSending] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSendInvite = async () => {
    if (!user || !inviteEmail.trim()) return;
    const trimmedEmail = inviteEmail.trim().toLowerCase();
    if (trimmedEmail === user.email?.toLowerCase()) {
      toast.error("You can't invite yourself.");
      return;
    }
    console.log('[handleSendInvite] clicked', trimmedEmail);
    setSending(true);
    try {
      await inviteToModule({
        moduleInstanceId,
        moduleType,
        moduleTitle,
        listId,
        recipientEmail: trimmedEmail,
        role: inviteRole,
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
          moduleInstanceId,
          moduleType: moduleType as any,
          moduleTitle,
          senderId: user.uid,
          senderEmail: user.email ?? '',
          senderName: user.displayName ?? user.email ?? 'Unknown',
          recipientEmail: trimmedEmail,
          role: inviteRole,
          shareMode: inviteShareMode,
          status: 'pending',
          listId,
          createdAt: Timestamp.now(),
          expiresAt: Timestamp.fromDate(expiresAt),
        } as ModuleInvite,
      ]);
    } catch (err: any) {
      console.error('[handleSendInvite] error:', err);
      toast.error(err?.message || 'Failed to send invite');
    } finally {
      setSending(false);
    }
  };

  const handleRemove = async (collaborator: ModuleCollaborator) => {
    setRemovingId(collaborator.userId);
    try {
      await removeCollaborator({ moduleInstanceId, collaborator, listId });
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
      await updateCollaboratorRole({ moduleInstanceId, collaborator, newRole });
      refresh();
    } catch {
      toast.error('Failed to update role');
    }
  };

  const handleGetShareLink = async () => {
    if (!user) return;
    if (shareLink) return;
    setGeneratingLink(true);
    try {
      const token = await getOrCreateShareToken({
        moduleInstanceId,
        moduleType,
        moduleTitle,
        listId,
        senderUser: { uid: user.uid, email: user.email ?? '', displayName: user.displayName },
      });
      setShareLink(`${window.location.origin}/join/${token}`);
    } catch {
      toast.error('Failed to generate share link');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareLink) return;
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    if (!shareLink) return;
    const text = encodeURIComponent(
      `Hey! I'd like to share my *${moduleTitle}* module with you on Malleabite. Click the link to join as a viewer:\n${shareLink}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
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
          <SheetTitle className="text-base">
            Manage Access
            <span className="text-muted-foreground font-normal ml-2">— {moduleTitle}</span>
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
                      {(isOwnModule || shareData?.ownerId === user?.uid) && (
                        <span className="text-muted-foreground font-normal ml-1">(you)</span>
                      )}
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
                    {canManage ? (
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
                    ) : (
                      <Badge variant="secondary" className="text-xs capitalize flex-shrink-0">
                        {collab.role}
                      </Badge>
                    )}
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
                        {invite.shareMode === 'duplicate' ? 'Duplicate' : invite.role} · Pending
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Invite section — owner only */}
          {canManage && (
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
                    onClick={() => setInviteShareMode('collaborative')}
                    className={`flex-1 px-3 py-2 transition-colors ${inviteShareMode === 'collaborative' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-accent'}`}
                  >
                    Collaborative
                  </button>
                  <button
                    onClick={() => setInviteShareMode('duplicate')}
                    className={`flex-1 px-3 py-2 transition-colors ${inviteShareMode === 'duplicate' ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:bg-accent'}`}
                  >
                    Duplicate
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {inviteShareMode === 'collaborative'
                    ? 'Live shared list — changes sync for everyone.'
                    : 'Recipient gets their own independent copy.'}
                </p>
                {/* Role select — only relevant for collaborative */}
                {inviteShareMode === 'collaborative' && (
                  <div className="flex gap-2">
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'viewer' | 'editor')}>
                      <SelectTrigger className="flex-1 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">
                          <div>
                            <p className="font-medium">Viewer</p>
                            <p className="text-xs text-muted-foreground">Can see but not edit</p>
                          </div>
                        </SelectItem>
                        <SelectItem value="editor">
                          <div>
                            <p className="font-medium">Editor</p>
                            <p className="text-xs text-muted-foreground">Can add, edit, delete</p>
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
          )}

          {/* Share link — owner only */}
          {canManage && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                Share link
              </p>
              {!shareLink ? (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleGetShareLink}
                  disabled={generatingLink}
                >
                  {generatingLink
                    ? <><Loader2 size={14} className="animate-spin mr-2" />Generating…</>
                    : <><Link size={14} className="mr-2" />Generate share link</>
                  }
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={shareLink}
                      className="bg-muted/30 text-xs"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyLink}
                      title="Copy link"
                    >
                      {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    </Button>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full text-[#25D366] border-[#25D366]/30 hover:bg-[#25D366]/10"
                    onClick={handleWhatsApp}
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4 mr-2 fill-[#25D366]" xmlns="http://www.w3.org/2000/svg">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                    </svg>
                    Share via WhatsApp
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Anyone with this link can join as a viewer.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ManageAccessSheet;
