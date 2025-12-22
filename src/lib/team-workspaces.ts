// Team Workspaces Types and Service
import { db } from '@/integrations/firebase/config';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';

export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface TeamMember {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: TeamRole;
  joinedAt: Date;
  invitedBy?: string;
}

export interface TeamWorkspace {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  ownerId: string;
  members: TeamMember[];
  createdAt: Date;
  updatedAt: Date;
  settings: {
    allowMemberInvites: boolean;
    defaultEventVisibility: 'team' | 'private';
    enableNotifications: boolean;
  };
}

export interface TeamInvite {
  id: string;
  teamId: string;
  teamName: string;
  email: string;
  role: TeamRole;
  invitedBy: string;
  invitedByName: string;
  createdAt: Date;
  expiresAt: Date;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
}

const TEAMS_COLLECTION = 'teams';
const INVITES_COLLECTION = 'team_invites';

// Create a new team workspace
export async function createTeamWorkspace(
  ownerId: string,
  ownerEmail: string,
  ownerName: string,
  data: { name: string; description?: string; color?: string; icon?: string }
): Promise<TeamWorkspace> {
  const teamRef = doc(collection(db, TEAMS_COLLECTION));
  
  const team: TeamWorkspace = {
    id: teamRef.id,
    name: data.name,
    description: data.description || '',
    color: data.color || '#8b5cf6',
    icon: data.icon || '👥',
    ownerId,
    members: [
      {
        id: ownerId,
        email: ownerEmail,
        displayName: ownerName,
        role: 'owner',
        joinedAt: new Date(),
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    settings: {
      allowMemberInvites: false,
      defaultEventVisibility: 'team',
      enableNotifications: true,
    },
  };

  await setDoc(teamRef, {
    ...team,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    members: team.members.map(m => ({
      ...m,
      joinedAt: Timestamp.fromDate(m.joinedAt),
    })),
  });

  return team;
}

// Get teams for a user
export async function getUserTeams(userId: string): Promise<TeamWorkspace[]> {
  const teamsQuery = query(
    collection(db, TEAMS_COLLECTION),
    where('members', 'array-contains-any', [{ id: userId }])
  );

  // This query won't work as expected with array-contains-any on objects
  // Instead, we'll query all teams and filter client-side for now
  const snapshot = await getDocs(collection(db, TEAMS_COLLECTION));
  
  const teams: TeamWorkspace[] = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    const isMember = data.members?.some((m: any) => m.id === userId);
    if (isMember) {
      teams.push({
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date(),
        members: data.members?.map((m: any) => ({
          ...m,
          joinedAt: m.joinedAt?.toDate?.() || new Date(),
        })) || [],
      } as TeamWorkspace);
    }
  });

  return teams;
}

// Get a specific team
export async function getTeam(teamId: string): Promise<TeamWorkspace | null> {
  const teamRef = doc(db, TEAMS_COLLECTION, teamId);
  const snapshot = await getDoc(teamRef);

  if (!snapshot.exists()) return null;

  const data = snapshot.data();
  return {
    id: snapshot.id,
    ...data,
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date(),
    members: data.members?.map((m: any) => ({
      ...m,
      joinedAt: m.joinedAt?.toDate?.() || new Date(),
    })) || [],
  } as TeamWorkspace;
}

// Update team details
export async function updateTeam(
  teamId: string, 
  updates: Partial<Pick<TeamWorkspace, 'name' | 'description' | 'color' | 'icon' | 'settings'>>
): Promise<void> {
  const teamRef = doc(db, TEAMS_COLLECTION, teamId);
  await updateDoc(teamRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

// Invite a member to team
export async function inviteToTeam(
  teamId: string,
  teamName: string,
  invitedBy: { id: string; name: string },
  inviteeEmail: string,
  role: TeamRole = 'member'
): Promise<TeamInvite> {
  const inviteRef = doc(collection(db, INVITES_COLLECTION));
  
  const invite: TeamInvite = {
    id: inviteRef.id,
    teamId,
    teamName,
    email: inviteeEmail.toLowerCase(),
    role,
    invitedBy: invitedBy.id,
    invitedByName: invitedBy.name,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    status: 'pending',
  };

  await setDoc(inviteRef, {
    ...invite,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromDate(invite.expiresAt),
  });

  return invite;
}

// Get pending invites for a user
export async function getPendingInvites(email: string): Promise<TeamInvite[]> {
  const invitesQuery = query(
    collection(db, INVITES_COLLECTION),
    where('email', '==', email.toLowerCase()),
    where('status', '==', 'pending')
  );

  const snapshot = await getDocs(invitesQuery);
  
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt?.toDate?.() || new Date(),
      expiresAt: data.expiresAt?.toDate?.() || new Date(),
    } as TeamInvite;
  });
}

// Accept team invite
export async function acceptInvite(
  inviteId: string,
  user: { id: string; email: string; displayName?: string; photoURL?: string }
): Promise<void> {
  const inviteRef = doc(db, INVITES_COLLECTION, inviteId);
  const inviteSnap = await getDoc(inviteRef);

  if (!inviteSnap.exists()) {
    throw new Error('Invite not found');
  }

  const invite = inviteSnap.data() as TeamInvite;

  if (invite.status !== 'pending') {
    throw new Error('Invite is no longer valid');
  }

  // Add member to team
  const teamRef = doc(db, TEAMS_COLLECTION, invite.teamId);
  const newMember: TeamMember = {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    role: invite.role,
    joinedAt: new Date(),
    invitedBy: invite.invitedBy,
  };

  await updateDoc(teamRef, {
    members: arrayUnion({
      ...newMember,
      joinedAt: Timestamp.fromDate(newMember.joinedAt),
    }),
    updatedAt: serverTimestamp(),
  });

  // Update invite status
  await updateDoc(inviteRef, {
    status: 'accepted',
  });
}

// Decline team invite
export async function declineInvite(inviteId: string): Promise<void> {
  const inviteRef = doc(db, INVITES_COLLECTION, inviteId);
  await updateDoc(inviteRef, {
    status: 'declined',
  });
}

// Remove member from team
export async function removeMember(teamId: string, memberId: string): Promise<void> {
  const team = await getTeam(teamId);
  if (!team) throw new Error('Team not found');

  const memberToRemove = team.members.find(m => m.id === memberId);
  if (!memberToRemove) throw new Error('Member not found');

  if (memberToRemove.role === 'owner') {
    throw new Error('Cannot remove the owner');
  }

  const teamRef = doc(db, TEAMS_COLLECTION, teamId);
  await updateDoc(teamRef, {
    members: team.members.filter(m => m.id !== memberId).map(m => ({
      ...m,
      joinedAt: Timestamp.fromDate(m.joinedAt),
    })),
    updatedAt: serverTimestamp(),
  });
}

// Update member role
export async function updateMemberRole(
  teamId: string,
  memberId: string,
  newRole: TeamRole
): Promise<void> {
  const team = await getTeam(teamId);
  if (!team) throw new Error('Team not found');

  const updatedMembers = team.members.map(m => 
    m.id === memberId ? { ...m, role: newRole } : m
  );

  const teamRef = doc(db, TEAMS_COLLECTION, teamId);
  await updateDoc(teamRef, {
    members: updatedMembers.map(m => ({
      ...m,
      joinedAt: Timestamp.fromDate(m.joinedAt),
    })),
    updatedAt: serverTimestamp(),
  });
}

// Delete team
export async function deleteTeam(teamId: string): Promise<void> {
  await deleteDoc(doc(db, TEAMS_COLLECTION, teamId));
}

// Check if user can perform action
export function canPerformAction(
  team: TeamWorkspace,
  userId: string,
  action: 'edit' | 'invite' | 'remove' | 'delete' | 'manage'
): boolean {
  const member = team.members.find(m => m.id === userId);
  if (!member) return false;

  switch (action) {
    case 'edit':
      return ['owner', 'admin'].includes(member.role);
    case 'invite':
      if (team.settings.allowMemberInvites) {
        return ['owner', 'admin', 'member'].includes(member.role);
      }
      return ['owner', 'admin'].includes(member.role);
    case 'remove':
      return ['owner', 'admin'].includes(member.role);
    case 'delete':
      return member.role === 'owner';
    case 'manage':
      return member.role === 'owner';
    default:
      return false;
  }
}
