// Team Workspaces React Hook
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext.unified';
import {
  TeamWorkspace,
  TeamInvite,
  TeamRole,
  getUserTeams,
  getTeam,
  createTeamWorkspace,
  updateTeam,
  inviteToTeam,
  getPendingInvites,
  acceptInvite,
  declineInvite,
  removeMember,
  updateMemberRole,
  deleteTeam,
  canPerformAction,
} from '@/lib/team-workspaces';

export function useTeamWorkspaces() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<TeamWorkspace[]>([]);
  const [pendingInvites, setPendingInvites] = useState<TeamInvite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load teams and invites
  const loadTeams = useCallback(async () => {
    if (!user) {
      setTeams([]);
      setPendingInvites([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [userTeams, invites] = await Promise.all([
        getUserTeams(user.uid),
        getPendingInvites(user.email || ''),
      ]);

      setTeams(userTeams);
      setPendingInvites(invites.filter(i => new Date(i.expiresAt) > new Date()));
    } catch (err) {
      console.error('Error loading teams:', err);
      setError('Failed to load teams');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  // Create a new team
  const createTeam = useCallback(async (
    data: { name: string; description?: string; color?: string; icon?: string }
  ) => {
    if (!user?.email) throw new Error('User not authenticated');

    const team = await createTeamWorkspace(
      user.uid,
      user.email,
      (user as any).displayName || user.email.split('@')[0],
      data
    );

    setTeams(prev => [...prev, team]);
    return team;
  }, [user]);

  // Update a team
  const updateTeamDetails = useCallback(async (
    teamId: string,
    updates: Partial<Pick<TeamWorkspace, 'name' | 'description' | 'color' | 'icon' | 'settings'>>
  ) => {
    await updateTeam(teamId, updates);
    setTeams(prev => prev.map(t => 
      t.id === teamId ? { ...t, ...updates, updatedAt: new Date() } : t
    ));
  }, []);

  // Invite a member
  const inviteMember = useCallback(async (
    teamId: string,
    email: string,
    role: TeamRole = 'member'
  ) => {
    if (!user) throw new Error('User not authenticated');

    const team = teams.find(t => t.id === teamId);
    if (!team) throw new Error('Team not found');

    return inviteToTeam(
      teamId,
      team.name,
      { id: user.uid, name: (user as any).displayName || user.email || 'Unknown' },
      email,
      role
    );
  }, [user, teams]);

  // Accept an invite
  const handleAcceptInvite = useCallback(async (inviteId: string) => {
    if (!user?.email) throw new Error('User not authenticated');

    await acceptInvite(inviteId, {
      id: user.uid,
      email: user.email,
      displayName: (user as any).displayName,
      photoURL: (user as any).photoURL,
    });

    // Reload teams
    await loadTeams();
  }, [user, loadTeams]);

  // Decline an invite
  const handleDeclineInvite = useCallback(async (inviteId: string) => {
    await declineInvite(inviteId);
    setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
  }, []);

  // Remove a member
  const handleRemoveMember = useCallback(async (teamId: string, memberId: string) => {
    await removeMember(teamId, memberId);
    
    const updatedTeam = await getTeam(teamId);
    if (updatedTeam) {
      setTeams(prev => prev.map(t => t.id === teamId ? updatedTeam : t));
    }
  }, []);

  // Update member role
  const handleUpdateRole = useCallback(async (
    teamId: string,
    memberId: string,
    newRole: TeamRole
  ) => {
    await updateMemberRole(teamId, memberId, newRole);
    
    const updatedTeam = await getTeam(teamId);
    if (updatedTeam) {
      setTeams(prev => prev.map(t => t.id === teamId ? updatedTeam : t));
    }
  }, []);

  // Delete a team
  const handleDeleteTeam = useCallback(async (teamId: string) => {
    await deleteTeam(teamId);
    setTeams(prev => prev.filter(t => t.id !== teamId));
  }, []);

  // Check permissions
  const checkPermission = useCallback((
    team: TeamWorkspace,
    action: 'edit' | 'invite' | 'remove' | 'delete' | 'manage'
  ): boolean => {
    if (!user) return false;
    return canPerformAction(team, user.uid, action);
  }, [user]);

  return {
    teams,
    pendingInvites,
    isLoading,
    error,
    refresh: loadTeams,
    createTeam,
    updateTeam: updateTeamDetails,
    inviteMember,
    acceptInvite: handleAcceptInvite,
    declineInvite: handleDeclineInvite,
    removeMember: handleRemoveMember,
    updateMemberRole: handleUpdateRole,
    deleteTeam: handleDeleteTeam,
    checkPermission,
  };
}
