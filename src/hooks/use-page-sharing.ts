import { useState, useEffect } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  onSnapshot,
  query,
  where,
  arrayUnion,
  arrayRemove,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { COLLECTIONS } from '@/integrations/firebase/firestore';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { ModuleInstance, generateModuleId } from '@/lib/stores/types';
import { ModuleCollaborator } from './use-module-sharing';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface PageShareData {
  ownerId: string;
  ownerEmail: string;
  ownerName: string;
  pageTitle: string;
  collaborators: ModuleCollaborator[];
  collaboratorIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PageInvite {
  id: string;
  pageId: string;
  pageTitle: string;
  senderId: string;
  senderEmail: string;
  senderName: string;
  recipientEmail: string;
  recipientUserId?: string;
  role: 'viewer' | 'editor';
  shareMode: 'live' | 'duplicate';
  status: 'pending' | 'accepted' | 'declined';
  // Snapshot for duplicate mode: each module with optional todo items
  moduleSnapshot?: Array<{
    type: string;
    title: string;
    listId?: string;
    todoItems?: Array<{ text: string; completed: boolean }>;
  }>;
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

// ─── usePageShare hook ──────────────────────────────────────────────────────────

export function usePageShare(pageId: string | undefined) {
  const { user } = useAuth();
  const [shareData, setShareData] = useState<PageShareData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!pageId) {
      setLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    const tid = setTimeout(() => {
      unsubscribe = onSnapshot(
        doc(db, COLLECTIONS.PAGE_SHARES, pageId),
        (snap) => {
          setShareData(snap.exists() ? (snap.data() as PageShareData) : null);
          setLoading(false);
        },
        () => {
          setShareData(null);
          setLoading(false);
        }
      );
    }, 0);

    return () => {
      clearTimeout(tid);
      unsubscribe?.();
    };
  }, [pageId]);

  const isOwner = shareData ? shareData.ownerId === user?.uid : false;
  const isShared = !!(shareData && shareData.collaborators.length > 0);
  const myCollaborator = shareData?.collaborators.find(c => c.userId === user?.uid);
  const myRole: 'owner' | 'viewer' | 'editor' = isOwner
    ? 'owner'
    : myCollaborator?.role ?? 'viewer';

  return { shareData, isShared, isOwner, myRole, collaborators: shareData?.collaborators ?? [], loading };
}

// ─── Invite to page ─────────────────────────────────────────────────────────────

export async function inviteToPage({
  pageId,
  pageTitle,
  modules,
  recipientEmail,
  role,
  shareMode,
  senderUser,
}: {
  pageId: string;
  pageTitle: string;
  modules: ModuleInstance[];
  recipientEmail: string;
  role: 'viewer' | 'editor';
  shareMode: 'live' | 'duplicate';
  senderUser: { uid: string; email: string; displayName?: string | null };
}) {
  const normalizedEmail = recipientEmail.trim().toLowerCase();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  // Upsert page_shares so doc always exists
  const shareRef = doc(db, COLLECTIONS.PAGE_SHARES, pageId);
  await setDoc(shareRef, {
    ownerId: senderUser.uid,
    ownerEmail: senderUser.email ?? '',
    ownerName: senderUser.displayName ?? senderUser.email ?? 'Unknown',
    pageTitle,
    collaborators: [],
    collaboratorIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  // Look up recipient's UID for in-app notification
  let recipientUserId: string | undefined;
  try {
    const usersSnap = await getDocs(
      query(collection(db, COLLECTIONS.USERS), where('email', '==', normalizedEmail))
    );
    recipientUserId = usersSnap.empty ? undefined : usersSnap.docs[0].id;
  } catch {
    // Best-effort
  }

  // For duplicate mode, snapshot all module data including todo items
  let moduleSnapshot: PageInvite['moduleSnapshot'];
  if (shareMode === 'duplicate') {
    moduleSnapshot = await Promise.all(
      modules.map(async (m) => {
        const entry: NonNullable<PageInvite['moduleSnapshot']>[number] = {
          type: m.type,
          title: m.title,
          listId: m.listId,
        };
        if (m.type === 'todo' && m.listId) {
          try {
            const itemsSnap = await getDocs(
              query(collection(db, 'todo_items'), where('listId', '==', m.listId))
            );
            entry.todoItems = itemsSnap.docs.map(d => ({
              text: d.data().text as string,
              completed: d.data().completed as boolean,
            }));
          } catch {
            entry.todoItems = [];
          }
        }
        return entry;
      })
    );
  }

  // Create invite doc
  const inviteRef = await addDoc(collection(db, COLLECTIONS.PAGE_INVITES), {
    pageId,
    pageTitle,
    senderId: senderUser.uid,
    senderEmail: senderUser.email ?? '',
    senderName: senderUser.displayName ?? senderUser.email ?? 'Unknown',
    recipientEmail: normalizedEmail,
    recipientUserId: recipientUserId ?? null,
    role,
    shareMode,
    status: 'pending',
    ...(moduleSnapshot ? { moduleSnapshot } : {}),
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
  });

  // In-app notification for recipient
  if (recipientUserId) {
    try {
      await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), {
        userId: recipientUserId,
        type: 'page_invite',
        data: {
          inviteId: inviteRef.id,
          pageId,
          pageTitle,
          senderName: senderUser.displayName ?? senderUser.email ?? 'Someone',
          senderEmail: senderUser.email ?? '',
          role,
          shareMode,
        },
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch {
      // Best-effort
    }
  }

  return inviteRef.id;
}

// ─── Accept page invite ──────────────────────────────────────────────────────────

export async function acceptPageInvite({
  inviteId,
  inviteData,
  acceptingUser,
  addPage,
}: {
  inviteId: string;
  inviteData: PageInvite;
  acceptingUser: { uid: string; email: string; displayName?: string | null };
  addPage: (title: string, extraFields: Partial<{
    sharedFromPageId: string;
    sharedRole: 'viewer' | 'editor';
    sharedOwnerName: string;
    modules: ModuleInstance[];
  }>) => Promise<{ success: boolean; pageId?: string }>;
}) {
  if (inviteData.shareMode === 'duplicate') {
    // ── Duplicate: create an independent copy ──────────────────────────────
    // Build module list. For each todo module create a new list + copy items.
    const modules: ModuleInstance[] = [];

    if (inviteData.moduleSnapshot) {
      for (const snap of inviteData.moduleSnapshot) {
        const moduleId = generateModuleId();
        const entry: ModuleInstance = {
          id: moduleId,
          type: snap.type as any,
          title: snap.title,
        };

        if (snap.type === 'todo' && snap.todoItems && snap.todoItems.length > 0) {
          // Create a fresh list for the recipient
          const listRef = await addDoc(collection(db, 'todo_lists'), {
            name: snap.title,
            color: '#8b5cf6',
            userId: acceptingUser.uid,
            isDefault: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          entry.listId = listRef.id;

          // Copy items in parallel
          await Promise.all(snap.todoItems.map(item =>
            addDoc(collection(db, 'todo_items'), {
              text: item.text,
              completed: item.completed,
              listId: listRef.id,
              userId: acceptingUser.uid,
              createdAt: serverTimestamp(),
            })
          ));
        } else if (snap.type === 'todo' && (!snap.todoItems || snap.todoItems.length === 0)) {
          // Empty todo module — create an empty list
          const listRef = await addDoc(collection(db, 'todo_lists'), {
            name: snap.title,
            color: '#8b5cf6',
            userId: acceptingUser.uid,
            isDefault: false,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          entry.listId = listRef.id;
        }

        modules.push(entry);
      }
    }

    await addPage(inviteData.pageTitle, { modules });

  } else {
    // ── Live: create a proxy page pointing to owner's page ─────────────────
    const newCollaborator: ModuleCollaborator = {
      userId: acceptingUser.uid,
      email: acceptingUser.email ?? '',
      displayName: acceptingUser.displayName ?? acceptingUser.email ?? 'Unknown',
      role: inviteData.role,
      addedAt: Timestamp.now(),
    };

    // Add to page_shares (skip getDoc — use updateDoc directly like module sharing)
    const shareRef = doc(db, COLLECTIONS.PAGE_SHARES, inviteData.pageId);
    await updateDoc(shareRef, {
      collaborators: arrayUnion(newCollaborator),
      collaboratorIds: arrayUnion(acceptingUser.uid),
      updatedAt: serverTimestamp(),
    });

    // Add recipient to each todo list's collaboratorIds so Firestore rules allow read/write
    // Fetch the owner's page to find all todo module listIds
    try {
      const pageSnap = await getDoc(doc(db, 'sidebar_pages', inviteData.pageId));
      if (pageSnap.exists()) {
        const pageModules: ModuleInstance[] = (pageSnap.data().modules ?? []);
        const listIds = pageModules
          .filter(m => m.type === 'todo' && m.listId)
          .map(m => m.listId as string);

        await Promise.all(listIds.map(listId =>
          updateDoc(doc(db, COLLECTIONS.TODO_LISTS, listId), {
            collaboratorIds: arrayUnion(acceptingUser.uid),
          }).catch(() => {})
        ));
      }
    } catch {
      // Non-fatal — page may not be readable yet; rules will be updated
    }

    // Create proxy page in recipient's sidebar
    await addPage(inviteData.pageTitle, {
      sharedFromPageId: inviteData.pageId,
      sharedRole: inviteData.role,
      sharedOwnerName: inviteData.senderName,
      modules: [],
    });
  }

  // Mark invite as accepted
  await updateDoc(doc(db, COLLECTIONS.PAGE_INVITES, inviteId), {
    status: 'accepted',
    recipientUserId: acceptingUser.uid,
    updatedAt: serverTimestamp(),
  });

  // Notify sender
  if (inviteData.senderId) {
    try {
      await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), {
        userId: inviteData.senderId,
        type: 'page_invite_accepted',
        data: {
          inviteId,
          pageTitle: inviteData.pageTitle,
          acceptedByName: acceptingUser.displayName ?? acceptingUser.email ?? 'Someone',
          acceptedByEmail: acceptingUser.email ?? '',
        },
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch {
      // Best-effort
    }
  }
}

// ─── Decline page invite ─────────────────────────────────────────────────────────

export async function declinePageInvite(inviteId: string) {
  await updateDoc(doc(db, COLLECTIONS.PAGE_INVITES, inviteId), {
    status: 'declined',
    updatedAt: serverTimestamp(),
  });
}

// ─── Remove page collaborator ─────────────────────────────────────────────────────

export async function removePageCollaborator({
  pageId,
  collaborator,
  pageModules,
}: {
  pageId: string;
  collaborator: ModuleCollaborator;
  pageModules?: ModuleInstance[];
}) {
  const shareRef = doc(db, COLLECTIONS.PAGE_SHARES, pageId);
  await updateDoc(shareRef, {
    collaborators: arrayRemove(collaborator),
    collaboratorIds: arrayRemove(collaborator.userId),
    updatedAt: serverTimestamp(),
  });

  // Remove from each todo list's collaboratorIds
  if (pageModules) {
    const listIds = pageModules
      .filter(m => m.type === 'todo' && m.listId)
      .map(m => m.listId as string);
    await Promise.all(listIds.map(listId =>
      updateDoc(doc(db, COLLECTIONS.TODO_LISTS, listId), {
        collaboratorIds: arrayRemove(collaborator.userId),
      }).catch(() => {})
    ));
  }
}

// ─── Update page collaborator role ────────────────────────────────────────────────

export async function updatePageCollaboratorRole({
  pageId,
  collaborator,
  newRole,
}: {
  pageId: string;
  collaborator: ModuleCollaborator;
  newRole: 'viewer' | 'editor';
}) {
  const shareRef = doc(db, COLLECTIONS.PAGE_SHARES, pageId);
  const snap = await getDoc(shareRef);
  if (!snap.exists()) return;

  const data = snap.data() as PageShareData;
  const updated = data.collaborators.map(c =>
    c.userId === collaborator.userId ? { ...c, role: newRole } : c
  );

  await updateDoc(shareRef, {
    collaborators: updated,
    updatedAt: serverTimestamp(),
  });
}
