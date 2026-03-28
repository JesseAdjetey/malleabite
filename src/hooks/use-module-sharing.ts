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
import { ModuleType, ModuleInstance, generateModuleId } from '@/lib/stores/types';
import { useSidebarStore } from '@/lib/store';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ModuleCollaborator {
  userId: string;
  email: string;
  displayName: string;
  role: 'viewer' | 'editor';
  addedAt: Timestamp;
}

export interface ModuleShareData {
  ownerId: string;
  ownerEmail: string;
  ownerName: string;
  moduleType: ModuleType;
  moduleTitle: string;
  listId?: string; // for todo modules
  collaborators: ModuleCollaborator[];
  collaboratorIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ModuleInvite {
  id: string;
  moduleInstanceId: string;
  moduleType: string;
  moduleTitle: string;
  senderId: string;
  senderEmail: string;
  senderName: string;
  recipientEmail: string;
  recipientUserId?: string;
  role: 'viewer' | 'editor';
  shareMode?: 'collaborative' | 'duplicate'; // collaborative = live shared list, duplicate = independent copy
  status: 'pending' | 'accepted' | 'declined';
  listId?: string;
  todoSnapshot?: Array<{ text: string; completed: boolean }>; // for duplicate mode
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

// ─── useModuleShare hook ────────────────────────────────────────────────────────

export function useModuleShare(moduleInstanceId: string | undefined) {
  const { user } = useAuth();
  const [shareData, setShareData] = useState<ModuleShareData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!moduleInstanceId) {
      setLoading(false);
      return;
    }

    // Defer subscription by one tick so React 18 StrictMode's double-invoke
    // cleanup cancels the timeout before any listener is created, preventing
    // stale listener IDs from causing SDK internal assertion failures.
    let unsubscribe: (() => void) | undefined;
    const tid = setTimeout(() => {
      unsubscribe = onSnapshot(
        doc(db, COLLECTIONS.MODULE_SHARES, moduleInstanceId),
        (snap) => {
          if (snap.exists()) {
            setShareData(snap.data() as ModuleShareData);
          } else {
            setShareData(null);
          }
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
  }, [moduleInstanceId]);

  const isOwner = shareData ? shareData.ownerId === user?.uid : false;
  const isShared = !!(shareData && shareData.collaborators.length > 0);
  const myCollaborator = shareData?.collaborators.find(c => c.userId === user?.uid);
  const myRole: 'owner' | 'viewer' | 'editor' = isOwner
    ? 'owner'
    : myCollaborator?.role ?? 'viewer';

  return { shareData, isShared, isOwner, myRole, collaborators: shareData?.collaborators ?? [], loading };
}

// ─── Invite to module ──────────────────────────────────────────────────────────

export async function inviteToModule({
  moduleInstanceId,
  moduleType,
  moduleTitle,
  listId,
  recipientEmail,
  role,
  shareMode = 'collaborative',
  senderUser,
}: {
  moduleInstanceId: string;
  moduleType: string;
  moduleTitle: string;
  listId?: string;
  recipientEmail: string;
  role: 'viewer' | 'editor';
  shareMode?: 'collaborative' | 'duplicate';
  senderUser: { uid: string; email: string; displayName?: string | null };
}) {
  const normalizedEmail = recipientEmail.trim().toLowerCase();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  console.log('[inviteToModule] starting', { moduleInstanceId, normalizedEmail, role });

  // Upsert module_shares so the doc always exists (merge keeps existing collaborators)
  const shareRef = doc(db, COLLECTIONS.MODULE_SHARES, moduleInstanceId);
  console.log('[inviteToModule] writing module_shares...');
  await setDoc(shareRef, {
    ownerId: senderUser.uid,
    ownerEmail: senderUser.email ?? '',
    ownerName: senderUser.displayName ?? senderUser.email ?? 'Unknown',
    moduleType,
    moduleTitle,
    listId: listId ?? null,
    collaborators: [],
    collaboratorIds: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });
  console.log('[inviteToModule] module_shares done');

  // Best-effort: look up recipient's UID by email so we can create a notification
  let recipientUserId: string | undefined;
  try {
    const usersSnap = await getDocs(
      query(collection(db, COLLECTIONS.USERS), where('email', '==', normalizedEmail))
    );
    recipientUserId = usersSnap.empty ? undefined : usersSnap.docs[0].id;
  } catch {
    // Can't look up user — invite still created, in-app notification skipped
  }

  // For duplicate mode, snapshot the current todo items so the recipient gets a copy
  let todoSnapshot: Array<{ text: string; completed: boolean }> | undefined;
  if (shareMode === 'duplicate' && listId) {
    try {
      const itemsSnap = await getDocs(
        query(collection(db, 'todo_items'), where('listId', '==', listId))
      );
      todoSnapshot = itemsSnap.docs.map(d => ({
        text: d.data().text as string,
        completed: d.data().completed as boolean,
      }));
    } catch {
      // Can't read items (shouldn't happen for sender) — proceed without snapshot
    }
  }

  // Create invite document
  console.log('[inviteToModule] creating invite doc...');
  const inviteRef = await addDoc(collection(db, COLLECTIONS.MODULE_INVITES), {
    moduleInstanceId,
    moduleType,
    moduleTitle,
    senderId: senderUser.uid,
    senderEmail: senderUser.email ?? '',
    senderName: senderUser.displayName ?? senderUser.email ?? 'Unknown',
    recipientEmail: normalizedEmail,
    recipientUserId: recipientUserId ?? null,
    role,
    shareMode,
    status: 'pending',
    listId: listId ?? null,
    ...(todoSnapshot ? { todoSnapshot } : {}),
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(expiresAt),
  });
  console.log('[inviteToModule] invite created', inviteRef.id);

  // Create in-app notification for the recipient if they have an account
  if (recipientUserId) {
    try {
      await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), {
        userId: recipientUserId,
        type: 'module_invite',
        data: {
          inviteId: inviteRef.id,
          moduleInstanceId,
          moduleType,
          moduleTitle,
          senderName: senderUser.displayName ?? senderUser.email ?? 'Someone',
          senderEmail: senderUser.email ?? '',
          role,
          shareMode,
          listId: listId ?? null,
        },
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('[inviteToModule] notification creation failed:', err);
    }
  }

  return inviteRef.id;
}

// ─── Accept module invite ──────────────────────────────────────────────────────

export async function acceptModuleInvite({
  inviteId,
  inviteData,
  acceptingUser,
  targetPageIndex,
  addSharedModule,
}: {
  inviteId: string;
  inviteData: ModuleInvite;
  acceptingUser: { uid: string; email: string; displayName?: string | null };
  targetPageIndex: number;
  addSharedModule: (module: ModuleInstance, pageIndex: number) => void;
}) {
  const newCollaborator: ModuleCollaborator = {
    userId: acceptingUser.uid,
    email: acceptingUser.email ?? '',
    displayName: acceptingUser.displayName ?? acceptingUser.email ?? 'Unknown',
    role: inviteData.role,
    addedAt: Timestamp.now(),
  };

  // 1. Add collaborator to module_shares — skip getDoc (recipient can't read it yet).
  //    updateDoc is allowed by the rule: request.auth.uid in request.resource.data.collaboratorIds
  const shareRef = doc(db, COLLECTIONS.MODULE_SHARES, inviteData.moduleInstanceId);
  await updateDoc(shareRef, {
    collaborators: arrayUnion(newCollaborator),
    collaboratorIds: arrayUnion(acceptingUser.uid),
    updatedAt: serverTimestamp(),
  });

  // 2. Add recipient to the todo_list's collaboratorIds — skip getDoc.
  //    The update rule allows any auth user to change only collaboratorIds.
  if (inviteData.listId) {
    try {
      await updateDoc(doc(db, COLLECTIONS.TODO_LISTS, inviteData.listId), {
        collaboratorIds: arrayUnion(acceptingUser.uid),
      });
    } catch {
      // List may not exist — not fatal
    }
  }

  // 3. Add shared module instance to user's sidebar
  const newModule: ModuleInstance = {
    id: generateModuleId(),
    type: inviteData.moduleType as ModuleType,
    title: inviteData.moduleTitle,
    listId: inviteData.listId, // use owner's listId so todos load correctly
    sharedFromInstanceId: inviteData.moduleInstanceId,
    sharedRole: inviteData.role,
    sharedOwnerName: inviteData.senderName,
  };
  addSharedModule(newModule, targetPageIndex);

  // 4. Update invite status
  await updateDoc(doc(db, COLLECTIONS.MODULE_INVITES, inviteId), {
    status: 'accepted',
    recipientUserId: acceptingUser.uid,
    updatedAt: serverTimestamp(),
  });

  // 5. Notify sender (best-effort — senderId may be empty in email-only invite fallback)
  if (inviteData.senderId) {
    try {
      await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), {
        userId: inviteData.senderId,
        type: 'module_invite_accepted',
        data: {
          inviteId,
          moduleTitle: inviteData.moduleTitle,
          acceptedByName: acceptingUser.displayName ?? acceptingUser.email ?? 'Someone',
          acceptedByEmail: acceptingUser.email ?? '',
        },
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch {
      // Notification is best-effort
    }
  }
}

// ─── Decline invite ────────────────────────────────────────────────────────────

export async function declineModuleInvite(inviteId: string) {
  await updateDoc(doc(db, COLLECTIONS.MODULE_INVITES, inviteId), {
    status: 'declined',
    updatedAt: serverTimestamp(),
  });
}

// ─── Remove collaborator ───────────────────────────────────────────────────────

export async function removeCollaborator({
  moduleInstanceId,
  collaborator,
  listId,
}: {
  moduleInstanceId: string;
  collaborator: ModuleCollaborator;
  listId?: string;
}) {
  const shareRef = doc(db, COLLECTIONS.MODULE_SHARES, moduleInstanceId);
  await updateDoc(shareRef, {
    collaborators: arrayRemove(collaborator),
    collaboratorIds: arrayRemove(collaborator.userId),
    updatedAt: serverTimestamp(),
  });

  if (listId) {
    const listRef = doc(db, COLLECTIONS.TODO_LISTS, listId);
    const listSnap = await getDoc(listRef);
    if (listSnap.exists()) {
      await updateDoc(listRef, {
        collaboratorIds: arrayRemove(collaborator.userId),
      });
    }
  }
}

// ─── Update collaborator role ──────────────────────────────────────────────────

export async function updateCollaboratorRole({
  moduleInstanceId,
  collaborator,
  newRole,
}: {
  moduleInstanceId: string;
  collaborator: ModuleCollaborator;
  newRole: 'viewer' | 'editor';
}) {
  const shareRef = doc(db, COLLECTIONS.MODULE_SHARES, moduleInstanceId);
  const snap = await getDoc(shareRef);
  if (!snap.exists()) return;

  const data = snap.data() as ModuleShareData;
  const updated = data.collaborators.map(c =>
    c.userId === collaborator.userId ? { ...c, role: newRole } : c
  );

  await updateDoc(shareRef, {
    collaborators: updated,
    updatedAt: serverTimestamp(),
  });
}

// ─── Share token data ──────────────────────────────────────────────────────────

export interface ShareTokenData {
  moduleInstanceId: string;
  moduleType: string;
  moduleTitle: string;
  listId?: string | null;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
}

// ─── Get or create a share token ──────────────────────────────────────────────

export async function getOrCreateShareToken({
  moduleInstanceId,
  moduleType,
  moduleTitle,
  listId,
  senderUser,
}: {
  moduleInstanceId: string;
  moduleType: string;
  moduleTitle: string;
  listId?: string;
  senderUser: { uid: string; email: string; displayName?: string | null };
}): Promise<string> {
  // Check if a token already exists in module_shares
  const shareRef = doc(db, COLLECTIONS.MODULE_SHARES, moduleInstanceId);
  const shareSnap = await getDoc(shareRef);

  if (shareSnap.exists() && shareSnap.data().shareToken) {
    return shareSnap.data().shareToken as string;
  }

  const token = crypto.randomUUID();
  const ownerName = senderUser.displayName ?? senderUser.email ?? 'Someone';

  // Store token metadata in share_tokens (doc ID = token for direct lookup)
  await setDoc(doc(db, COLLECTIONS.SHARE_TOKENS, token), {
    moduleInstanceId,
    moduleType,
    moduleTitle,
    listId: listId ?? null,
    ownerId: senderUser.uid,
    ownerName,
    ownerEmail: senderUser.email ?? '',
    createdAt: serverTimestamp(),
  });

  // Persist token back to module_shares (create or update)
  if (!shareSnap.exists()) {
    await setDoc(shareRef, {
      ownerId: senderUser.uid,
      ownerEmail: senderUser.email ?? '',
      ownerName,
      moduleType,
      moduleTitle,
      listId: listId ?? null,
      collaborators: [],
      collaboratorIds: [],
      shareToken: token,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(shareRef, { shareToken: token, updatedAt: serverTimestamp() });
  }

  return token;
}

// ─── Accept share link (link-based invite) ────────────────────────────────────

export async function acceptShareLink({
  shareTokenData,
  acceptingUser,
  targetPageIndex,
  addSharedModule,
}: {
  shareTokenData: ShareTokenData;
  acceptingUser: { uid: string; email: string; displayName?: string | null };
  targetPageIndex: number;
  addSharedModule: (module: ModuleInstance, pageIndex: number) => void;
}) {
  const { moduleInstanceId, moduleType, moduleTitle, listId } = shareTokenData;

  const shareRef = doc(db, COLLECTIONS.MODULE_SHARES, moduleInstanceId);
  const shareSnap = await getDoc(shareRef);

  if (shareSnap.exists()) {
    const data = shareSnap.data() as ModuleShareData;
    if (data.ownerId === acceptingUser.uid) {
      throw new Error('already_owner');
    }
    if (data.collaboratorIds?.includes(acceptingUser.uid)) {
      throw new Error('already_collaborator');
    }
  }

  const newCollaborator: ModuleCollaborator = {
    userId: acceptingUser.uid,
    email: acceptingUser.email ?? '',
    displayName: acceptingUser.displayName ?? acceptingUser.email ?? 'Unknown',
    role: 'viewer',
    addedAt: Timestamp.now(),
  };

  if (shareSnap.exists()) {
    await updateDoc(shareRef, {
      collaborators: arrayUnion(newCollaborator),
      collaboratorIds: arrayUnion(acceptingUser.uid),
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(shareRef, {
      ownerId: shareTokenData.ownerId,
      ownerEmail: shareTokenData.ownerEmail,
      ownerName: shareTokenData.ownerName,
      moduleType,
      moduleTitle,
      listId: listId ?? null,
      collaborators: [newCollaborator],
      collaboratorIds: [acceptingUser.uid],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  if (listId) {
    const listRef = doc(db, COLLECTIONS.TODO_LISTS, listId);
    const listSnap = await getDoc(listRef);
    if (listSnap.exists()) {
      await updateDoc(listRef, { collaboratorIds: arrayUnion(acceptingUser.uid) });
    }
  }

  const newModule: ModuleInstance = {
    id: generateModuleId(),
    type: moduleType as ModuleType,
    title: moduleTitle,
    listId: listId ?? undefined,
    sharedFromInstanceId: moduleInstanceId,
    sharedRole: 'viewer',
    sharedOwnerName: shareTokenData.ownerName,
  };
  addSharedModule(newModule, targetPageIndex);

  // Notify owner
  await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), {
    userId: shareTokenData.ownerId,
    type: 'module_invite_accepted',
    data: {
      moduleTitle,
      acceptedByName: acceptingUser.displayName ?? acceptingUser.email ?? 'Someone',
      acceptedByEmail: acceptingUser.email ?? '',
      viaLink: true,
    },
    read: false,
    createdAt: serverTimestamp(),
  });
}

// ─── Pending invites for a module (for ManageAccessSheet) ─────────────────────

export function usePendingInvites(moduleInstanceId: string | undefined) {
  const [invites, setInvites] = useState<ModuleInvite[]>([]);

  useEffect(() => {
    if (!moduleInstanceId) return;

    let unsubscribe: (() => void) | undefined;
    const tid = setTimeout(() => {
      const q = query(
        collection(db, COLLECTIONS.MODULE_INVITES),
        where('moduleInstanceId', '==', moduleInstanceId),
        where('status', '==', 'pending')
      );

      unsubscribe = onSnapshot(
        q,
        (snap) => {
          setInvites(snap.docs.map(d => ({ id: d.id, ...d.data() } as ModuleInvite)));
        },
        () => {
          // Permission denied or index missing — fail silently
          setInvites([]);
        }
      );
    }, 0);

    return () => {
      clearTimeout(tid);
      unsubscribe?.();
    };
  }, [moduleInstanceId]);

  return invites;
}
