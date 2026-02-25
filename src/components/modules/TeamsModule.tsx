import React, { useState } from 'react';
import ModuleContainer from './ModuleContainer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Plus, Loader2, Check, X, Mail } from 'lucide-react';
import { useTeamWorkspaces } from '@/hooks/use-team-workspaces';
import { toast } from 'sonner';
import { CreateTeamDialog } from '@/components/teams/CreateTeamDialog';
import { TeamDashboard } from '@/components/teams/TeamDashboard';

interface TeamsModuleProps {
  title?: string;
  onRemove?: () => void;
  onTitleChange?: (title: string) => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
  isDragging?: boolean;
  instanceId?: string;
}

const TeamsModule: React.FC<TeamsModuleProps> = ({
  title = 'Teams',
  onRemove,
  onTitleChange,
  onMinimize,
  isMinimized = false,
  isDragging = false,
}) => {
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

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const selectedTeam = teams.find(t => t.id === selectedTeamId);

  const handleAcceptInvite = async (inviteId: string) => {
    try {
      await acceptInvite(inviteId);
      toast.success('Invite accepted');
    } catch (err: any) {
      toast.error(err.message || 'Failed to accept invite');
    }
  };

  const handleDeclineInvite = async (inviteId: string) => {
    try {
      await declineInvite(inviteId);
      toast.success('Invite declined');
    } catch (err: any) {
      toast.error(err.message || 'Failed to decline invite');
    }
  };

  // Adapter: TeamDashboard expects checkPermission(teamId, action) but hook takes (team, action)
  const checkPermissionById = (teamId: string, action: string) => {
    const team = teams.find(t => t.id === teamId);
    if (!team) return false;
    return checkPermission(team, action as any);
  };

  return (
    <ModuleContainer
      title={title}
      onRemove={onRemove}
      onTitleChange={onTitleChange}
      onMinimize={onMinimize}
      isMinimized={isMinimized}
      isDragging={isDragging}
    >
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : selectedTeam ? (
          <TeamDashboard
            team={selectedTeam}
            onBack={() => setSelectedTeamId(null)}
            onInviteMember={async (teamId, email, role) => { await inviteMember(teamId, email, role); }}
            onRemoveMember={removeMember}
            onUpdateRole={updateMemberRole}
            onDeleteTeam={async (id) => { await deleteTeam(id); setSelectedTeamId(null); }}
            checkPermission={checkPermissionById}
          />
        ) : (
          <>
            {/* Pending Invites */}
            {pendingInvites.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" />
                  Pending ({pendingInvites.length})
                </p>
                {pendingInvites.map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{invite.teamName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {invite.invitedByName} &middot; {invite.role}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-green-500 hover:text-green-600 hover:bg-green-500/10"
                        onClick={() => handleAcceptInvite(invite.id)}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeclineInvite(invite.id)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Team List */}
            {teams.length > 0 ? (
              <div className="space-y-1.5">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => setSelectedTeamId(team.id)}
                  >
                    <div
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ backgroundColor: team.color }}
                    >
                      {team.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{team.name}</p>
                      {team.description && (
                        <p className="text-[11px] text-muted-foreground truncate">{team.description}</p>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      <Users className="h-3 w-3 mr-0.5" />
                      {team.members.length}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-3">No teams yet</p>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              className="w-full text-foreground"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              {teams.length > 0 ? 'New Team' : 'Create Your First Team'}
            </Button>
          </>
        )}
      </div>

      <CreateTeamDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onCreateTeam={createTeam}
      />
    </ModuleContainer>
  );
};

export default TeamsModule;
