// Team Workspaces Settings Component
import React, { useState } from 'react';
import { 
  Users, Plus, Settings, Mail, Crown, Shield, Eye, 
  Trash2, Check, X, UserPlus, ChevronRight, Loader2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTeamWorkspaces } from '@/hooks/use-team-workspaces';
import { TeamWorkspace, TeamRole, TeamMember } from '@/lib/team-workspaces';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const roleIcons = {
  owner: Crown,
  admin: Shield,
  member: Users,
  viewer: Eye,
};

const roleColors = {
  owner: 'text-yellow-500 bg-yellow-500/10',
  admin: 'text-blue-500 bg-blue-500/10',
  member: 'text-green-500 bg-green-500/10',
  viewer: 'text-gray-500 bg-gray-500/10',
};

export function TeamWorkspacesSettings() {
  const {
    teams,
    pendingInvites,
    isLoading,
    createTeam,
    inviteMember,
    acceptInvite,
    declineInvite,
    removeMember,
    updateMemberRole,
    deleteTeam,
    checkPermission,
  } = useTeamWorkspaces();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<TeamWorkspace | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('member');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;

    setIsSubmitting(true);
    try {
      await createTeam({ name: newTeamName.trim() });
      setNewTeamName('');
      setIsCreateOpen(false);
      toast.success('Team created!');
    } catch (error) {
      toast.error('Failed to create team');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInvite = async () => {
    if (!selectedTeam || !inviteEmail.trim()) return;

    setIsSubmitting(true);
    try {
      await inviteMember(selectedTeam.id, inviteEmail.trim(), inviteRole);
      setInviteEmail('');
      toast.success(`Invitation sent to ${inviteEmail}`);
    } catch (error) {
      toast.error('Failed to send invitation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAccept = async (inviteId: string) => {
    try {
      await acceptInvite(inviteId);
      toast.success('You joined the team!');
    } catch (error) {
      toast.error('Failed to accept invitation');
    }
  };

  const handleDecline = async (inviteId: string) => {
    try {
      await declineInvite(inviteId);
      toast.success('Invitation declined');
    } catch (error) {
      toast.error('Failed to decline invitation');
    }
  };

  if (isLoading) {
    return (
      <Card className="glass">
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Pending Invitations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between p-3 bg-background rounded-lg"
              >
                <div>
                  <p className="font-medium">{invite.teamName}</p>
                  <p className="text-xs text-muted-foreground">
                    Invited by {invite.invitedByName} as {invite.role}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleAccept(invite.id)}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDecline(invite.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Teams List */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Team Workspaces</CardTitle>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New Team
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Team Workspace</DialogTitle>
                  <DialogDescription>
                    Create a shared calendar workspace for your team.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Team Name</label>
                    <Input
                      placeholder="e.g., Marketing Team"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleCreateTeam}
                    disabled={!newTeamName.trim() || isSubmitting}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Create Team'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <CardDescription>
            Collaborate with your team on shared calendars
          </CardDescription>
        </CardHeader>
        <CardContent>
          {teams.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>You're not part of any team yet.</p>
              <p className="text-sm">Create a team or accept an invitation to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left",
                    "hover:bg-muted border border-transparent",
                    selectedTeam?.id === team.id && "bg-muted border-primary/30"
                  )}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                    style={{ backgroundColor: team.color + '20' }}
                  >
                    {team.icon}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{team.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {team.members.length} member{team.members.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Team Details */}
      {selectedTeam && (
        <Card className="glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                  style={{ backgroundColor: selectedTeam.color + '20' }}
                >
                  {selectedTeam.icon}
                </div>
                <div>
                  <CardTitle className="text-lg">{selectedTeam.name}</CardTitle>
                  <CardDescription>{selectedTeam.description || 'No description'}</CardDescription>
                </div>
              </div>
              {checkPermission(selectedTeam, 'manage') && (
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Invite Members */}
            {checkPermission(selectedTeam, 'invite') && (
              <div className="space-y-3">
                <label className="text-sm font-medium">Invite Members</label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1"
                  />
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as TeamRole)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleInvite} disabled={!inviteEmail.trim() || isSubmitting}>
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Members List */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Members</label>
              <div className="space-y-2">
                {selectedTeam.members.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    team={selectedTeam}
                    canManage={checkPermission(selectedTeam, 'remove')}
                    onRemove={() => removeMember(selectedTeam.id, member.id)}
                    onRoleChange={(role) => updateMemberRole(selectedTeam.id, member.id, role)}
                  />
                ))}
              </div>
            </div>

            {/* Danger Zone */}
            {checkPermission(selectedTeam, 'delete') && (
              <div className="pt-4 border-t border-border">
                <Button
                  variant="outline"
                  className="text-red-500 border-red-500/30 hover:bg-red-500/10"
                  onClick={() => {
                    if (confirm(`Delete "${selectedTeam.name}"? This cannot be undone.`)) {
                      deleteTeam(selectedTeam.id);
                      setSelectedTeam(null);
                      toast.success('Team deleted');
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Team
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MemberRow({
  member,
  team,
  canManage,
  onRemove,
  onRoleChange,
}: {
  member: TeamMember;
  team: TeamWorkspace;
  canManage: boolean;
  onRemove: () => void;
  onRoleChange: (role: TeamRole) => void;
}) {
  const RoleIcon = roleIcons[member.role];
  const isOwner = member.role === 'owner';

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
      <Avatar className="h-8 w-8">
        <AvatarImage src={member.photoURL} />
        <AvatarFallback className="text-xs">
          {member.displayName?.[0] || member.email[0].toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {member.displayName || member.email.split('@')[0]}
        </p>
        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
      </div>
      <Badge variant="outline" className={cn("gap-1", roleColors[member.role])}>
        <RoleIcon className="h-3 w-3" />
        {member.role}
      </Badge>
      {canManage && !isOwner && (
        <Button
          variant="ghost"
          size="sm"
          className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
