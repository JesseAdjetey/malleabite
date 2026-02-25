import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users, UserPlus, Crown, Shield, Eye, Trash2,
  ChevronLeft, Mail, Loader2, Settings,
} from 'lucide-react';
import { TeamWorkspace, TeamRole } from '@/lib/team-workspaces';
import { toast } from 'sonner';

const roleIcons: Record<TeamRole, React.ElementType> = {
  owner: Crown,
  admin: Shield,
  member: Users,
  viewer: Eye,
};

const roleColors: Record<TeamRole, string> = {
  owner: 'text-yellow-500 bg-yellow-500/10',
  admin: 'text-blue-500 bg-blue-500/10',
  member: 'text-green-500 bg-green-500/10',
  viewer: 'text-gray-500 bg-gray-500/10',
};

interface TeamDashboardProps {
  team: TeamWorkspace;
  onBack: () => void;
  onInviteMember: (teamId: string, email: string, role: TeamRole) => Promise<void>;
  onRemoveMember: (teamId: string, memberId: string) => Promise<void>;
  onUpdateRole: (teamId: string, memberId: string, role: TeamRole) => Promise<void>;
  onDeleteTeam: (teamId: string) => Promise<void>;
  checkPermission: (teamId: string, action: string) => boolean;
}

export function TeamDashboard({
  team,
  onBack,
  onInviteMember,
  onRemoveMember,
  onUpdateRole,
  onDeleteTeam,
  checkPermission,
}: TeamDashboardProps) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('member');
  const [isInviting, setIsInviting] = useState(false);
  const canManage = checkPermission(team.id, 'manage_members');
  const canDelete = checkPermission(team.id, 'delete_team');

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      await onInviteMember(team.id, inviteEmail.trim(), inviteRole);
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send invite');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = async (memberId: string, name: string) => {
    try {
      await onRemoveMember(team.id, memberId);
      toast.success(`${name} removed from team`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove member');
    }
  };

  const handleDelete = async () => {
    try {
      await onDeleteTeam(team.id);
      toast.success('Team deleted');
      onBack();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete team');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold shrink-0" style={{ backgroundColor: team.color }}>
            {team.name[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold truncate">{team.name}</h2>
            {team.description && (
              <p className="text-sm text-muted-foreground truncate">{team.description}</p>
            )}
          </div>
        </div>
        <Badge variant="secondary" className="shrink-0">
          <Users className="h-3 w-3 mr-1" />
          {team.members.length}
        </Badge>
      </div>

      {/* Invite Member */}
      {canManage && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Invite Member
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="pl-9"
                  onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                />
              </div>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as TeamRole)}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleInvite} disabled={!inviteEmail.trim() || isInviting}>
                {isInviting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Invite'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Members ({team.members.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {team.members.map((member) => {
            const RoleIcon = roleIcons[member.role];
            return (
              <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="text-xs">
                    {(member.displayName || member.email)[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{member.displayName || member.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                </div>
                <Badge variant="secondary" className={`text-xs ${roleColors[member.role]}`}>
                  <RoleIcon className="h-3 w-3 mr-1" />
                  {member.role}
                </Badge>
                {canManage && member.role !== 'owner' && (
                  <div className="flex items-center gap-1">
                    <Select
                      value={member.role}
                      onValueChange={(v) => onUpdateRole(team.id, member.id, v as TeamRole)}
                    >
                      <SelectTrigger className="w-24 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="viewer">Viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleRemove(member.id, member.displayName || member.email)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Danger Zone */}
      {canDelete && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-destructive flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-1.5" />
              Delete Team
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
