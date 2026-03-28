import React, { useState, useEffect } from 'react';
import { Bell, Check, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useNotifications, AppNotification } from '@/hooks/use-notifications';
import { acceptModuleInvite, declineModuleInvite, ModuleInvite } from '@/hooks/use-module-sharing';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { useSidebarPages } from '@/hooks/use-sidebar-pages';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Timestamp,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { COLLECTIONS } from '@/integrations/firebase/firestore';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications();
  const { pages, addModule } = useSidebarPages();

  // Also query pending module_invites directly by email — works even when the
  // sender didn't find the recipient in the users collection (no user doc).
  const [emailInvites, setEmailInvites] = useState<AppNotification[]>([]);
  useEffect(() => {
    if (!user?.email) return;
    getDocs(query(
      collection(db, COLLECTIONS.MODULE_INVITES),
      where('recipientEmail', '==', user.email.toLowerCase()),
      where('status', '==', 'pending'),
    )).then(snap => {
      const synth: AppNotification[] = snap.docs.map(d => {
        const inv = d.data() as ModuleInvite;
        return {
          id: `invite-${d.id}`,
          userId: user.uid,
          type: 'module_invite' as const,
          data: {
            inviteId: d.id,
            moduleInstanceId: inv.moduleInstanceId,
            moduleType: inv.moduleType,
            moduleTitle: inv.moduleTitle,
            senderName: inv.senderName,
            senderEmail: inv.senderEmail,
            role: inv.role,
            shareMode: inv.shareMode ?? 'collaborative',
            listId: inv.listId ?? null,
          },
          read: false,
          createdAt: inv.createdAt ?? Timestamp.now(),
        };
      });
      setEmailInvites(synth);
    }).catch(() => {});
  }, [user?.email, user?.uid]);

  // Merge: email-based invites that don't already have a notifications doc
  const notifInviteIds = new Set(
    notifications
      .filter(n => n.type === 'module_invite')
      .map(n => n.data.inviteId as string)
  );
  const extraInvites = emailInvites.filter(ei => !notifInviteIds.has(ei.data.inviteId));
  const allNotifications = [...notifications, ...extraInvites].sort(
    (a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)
  );
  const totalUnread = unreadCount + extraInvites.length;

  const [open, setOpen] = useState(false);
  const [acceptingInvite, setAcceptingInvite] = useState<AppNotification | null>(null);
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [accepting, setAccepting] = useState(false);

  const handleNotificationClick = (notification: AppNotification) => {
    if (!notification.read && !notification.id.startsWith('invite-')) {
      markAsRead(notification.id);
    }
    if (notification.type === 'module_invite') {
      setAcceptingInvite(notification);
      setSelectedPageIndex(0);
    }
  };

  const handleAccept = async () => {
    console.log('[handleAccept] called', { acceptingInvite: !!acceptingInvite, user: user?.uid, pagesCount: pages.length, selectedPageIndex });
    if (!acceptingInvite || !user) {
      console.log('[handleAccept] early return — missing acceptingInvite or user');
      return;
    }
    setAccepting(true);

    try {
      const inviteId = acceptingInvite.data.inviteId as string;
      const targetPage = pages[selectedPageIndex];
      console.log('[handleAccept] inviteId:', inviteId, 'targetPage:', targetPage?.id, targetPage?.title);
      if (!targetPage) throw new Error('No page selected');

      // Fetch invite doc by ID (efficient single get)
      const inviteDocSnap = await getDocs(query(
        collection(db, COLLECTIONS.MODULE_INVITES),
        where('__name__', '==', inviteId)
      ));
      const inviteDoc = inviteDocSnap.docs[0];
      console.log('[handleAccept] inviteDoc found:', !!inviteDoc);

      const inviteData: ModuleInvite = inviteDoc
        ? { id: inviteDoc.id, ...inviteDoc.data() } as ModuleInvite
        : {
            id: inviteId,
            moduleInstanceId: acceptingInvite.data.moduleInstanceId,
            moduleType: acceptingInvite.data.moduleType,
            moduleTitle: acceptingInvite.data.moduleTitle,
            senderId: '',
            senderEmail: acceptingInvite.data.senderEmail ?? '',
            senderName: acceptingInvite.data.senderName ?? '',
            recipientEmail: user.email ?? '',
            role: acceptingInvite.data.role,
            status: 'pending',
            listId: acceptingInvite.data.listId ?? undefined,
            createdAt: acceptingInvite.createdAt,
            expiresAt: acceptingInvite.createdAt,
          };

      const isDuplicate = inviteData.shareMode === 'duplicate';

      if (isDuplicate) {
        // Duplicate mode: create an independent copy — no sharing relationship
        await addModule(targetPage.id, {
          type: inviteData.moduleType as any,
          title: inviteData.moduleTitle,
          // No listId → addModule creates a fresh list for todo modules
        });
        await updateDoc(doc(db, COLLECTIONS.MODULE_INVITES, inviteId), {
          status: 'accepted',
          recipientUserId: user.uid,
          updatedAt: serverTimestamp(),
        });
      } else {
        // Collaborative mode: shared live list
        console.log('[handleAccept] calling acceptModuleInvite...');
        await acceptModuleInvite({
          inviteId,
          inviteData,
          acceptingUser: {
            uid: user.uid,
            email: user.email ?? '',
            displayName: user.displayName,
          },
          targetPageIndex: selectedPageIndex,
          addSharedModule: () => {},
        });
        console.log('[handleAccept] acceptModuleInvite done, calling addModule...');
        const addResult = await addModule(targetPage.id, {
          type: inviteData.moduleType as any,
          title: inviteData.moduleTitle,
          listId: inviteData.listId ?? undefined,
          sharedFromInstanceId: inviteData.moduleInstanceId,
          sharedRole: inviteData.role,
          sharedOwnerName: inviteData.senderName,
        });
        console.log('[handleAccept] addModule result:', addResult);
      }

      toast.success(`"${acceptingInvite.data.moduleTitle}" added to your ${targetPage.title} page`);
      if (acceptingInvite.id.startsWith('invite-')) {
        setEmailInvites(prev => prev.filter(ei => ei.id !== acceptingInvite.id));
      }
      setAcceptingInvite(null);
      setOpen(false);
    } catch (err: any) {
      console.error('[handleAccept] error:', err);
      toast.error(err.message ?? 'Failed to accept invite');
    } finally {
      setAccepting(false);
    }
  };

  const handleDecline = async (notification: AppNotification) => {
    try {
      await declineModuleInvite(notification.data.inviteId);
      if (!notification.id.startsWith('invite-')) {
        await markAsRead(notification.id);
      } else {
        // Remove from email-based invite list
        setEmailInvites(prev => prev.filter(ei => ei.id !== notification.id));
      }
      toast.success('Invite declined');
    } catch {
      toast.error('Failed to decline invite');
    }
  };

  const notificationLabel = (n: AppNotification) => {
    if (n.type === 'module_invite') {
      return (
        <span>
          <span className="font-medium">{n.data.senderName}</span> invited you to their{' '}
          <span className="font-medium">{n.data.moduleTitle}</span>{' '}
          <span className="text-muted-foreground capitalize">
            ({n.data.shareMode === 'duplicate' ? 'Duplicate' : n.data.role})
          </span>
        </span>
      );
    }
    if (n.type === 'module_invite_accepted') {
      return (
        <span>
          <span className="font-medium">{n.data.acceptedByName}</span> accepted your invite to{' '}
          <span className="font-medium">{n.data.moduleTitle}</span>
        </span>
      );
    }
    return <span>New notification</span>;
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="relative h-8 w-8 p-0 rounded-lg hover:bg-black/10 dark:hover:bg-white/10"
          >
            <Bell className="h-4 w-4 text-gray-600 dark:text-gray-300" />
            {totalUnread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center leading-none">
                {totalUnread > 9 ? '9+' : totalUnread}
              </span>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          className="w-80 p-0 shadow-xl border-border"
          sideOffset={8}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="text-sm font-semibold">Notifications</p>
            {totalUnread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-primary hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {allNotifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No notifications yet
              </div>
            ) : (
              allNotifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "px-4 py-3 border-b border-border/50 last:border-0 cursor-pointer hover:bg-accent/50 transition-colors",
                    !n.read && "bg-primary/5"
                  )}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && (
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    )}
                    <div className={cn("flex-1 min-w-0", n.read && "pl-3.5")}>
                      <p className="text-sm leading-snug">{notificationLabel(n)}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {dayjs(n.createdAt?.toDate?.() ?? new Date()).fromNow()}
                      </p>

                      {/* Inline actions for module invites */}
                      {n.type === 'module_invite' && n.data.role && (
                        <div className="flex gap-2 mt-2" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleNotificationClick(n)}
                            className="flex items-center gap-1 text-xs bg-primary text-primary-foreground px-2.5 py-1 rounded-md hover:bg-primary/90 transition-colors"
                          >
                            <Check size={11} />
                            Accept
                          </button>
                          <button
                            onClick={() => handleDecline(n)}
                            className="flex items-center gap-1 text-xs bg-muted text-muted-foreground px-2.5 py-1 rounded-md hover:bg-muted/80 transition-colors"
                          >
                            <X size={11} />
                            Decline
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Page picker dialog for accepting invites */}
      <Dialog open={!!acceptingInvite} onOpenChange={(o) => { if (!o) setAcceptingInvite(null); }}>
        <DialogContent className="sm:max-w-sm bg-background border-border">
          <DialogHeader>
            <DialogTitle>Add to which page?</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">
              {acceptingInvite?.data.shareMode === 'duplicate'
                ? 'Choose where to add your personal copy of'
                : 'Choose where to add'}{' '}
              <span className="font-medium text-foreground">
                {acceptingInvite?.data.moduleTitle}
              </span>
            </p>
            <div className="grid gap-2 mt-3">
              {pages.map((page, idx) => (
                <button
                  key={page.id}
                  onClick={() => setSelectedPageIndex(idx)}
                  className={cn(
                    "w-full text-left px-4 py-2.5 rounded-lg border text-sm transition-all",
                    selectedPageIndex === idx
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border hover:border-primary/50 hover:bg-accent"
                  )}
                >
                  {page.title}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptingInvite(null)}>
              Cancel
            </Button>
            <Button onClick={handleAccept} disabled={accepting}>
              {accepting ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Add module
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NotificationBell;
