// UserProfile Component - Mobile-First Design
import React from 'react';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, Mail, Calendar, Shield, Clock } from 'lucide-react';

const UserProfile = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/auth', { replace: true });
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        title: "Error",
        description: "There was an issue signing out.",
        variant: "destructive",
      });
    }
  };

  const getInitials = () => {
    if (!user?.email) return '?';
    return user.email.substring(0, 2).toUpperCase();
  };

  const getUserName = () => (user as any)?.displayName || user?.email?.split('@')[0] || 'User';
  const getUserId = () => (user as any)?.uid?.substring(0, 8);
  const getAvatarUrl = () => (user as any)?.photoURL;
  
  const getLastSignIn = () => {
    return (user as any)?.metadata?.lastSignInTime 
      ? new Date((user as any).metadata.lastSignInTime).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : 'N/A';
  };

  const getCreatedAt = () => {
    return (user as any)?.metadata?.creationTime 
      ? new Date((user as any).metadata.creationTime).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      : 'N/A';
  };

  // Info Row Component
  const InfoRow = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
    <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
      <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Profile Header */}
      <div className="text-center py-6">
        <Avatar className="h-24 w-24 mx-auto mb-4 border-4 border-primary/30 ring-4 ring-primary/10">
          <AvatarImage src={getAvatarUrl()} />
          <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-white text-2xl font-bold">
            {getInitials()}
          </AvatarFallback>
        </Avatar>
        <h2 className="text-xl font-bold mb-1">{getUserName()}</h2>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
      </div>

      {/* Account Info */}
      <div className="space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
          Account Details
        </p>
        
        <InfoRow 
          icon={Mail} 
          label="Email" 
          value={user?.email || 'Not set'} 
        />
        
        <InfoRow 
          icon={Clock} 
          label="Last Sign In" 
          value={getLastSignIn()} 
        />
        
        <InfoRow 
          icon={Calendar} 
          label="Member Since" 
          value={getCreatedAt()} 
        />
        
        <InfoRow 
          icon={Shield} 
          label="Backend" 
          value="Firebase" 
        />
      </div>

      {/* Sign Out Button */}
      <button
        onClick={handleSignOut}
        className="w-full flex items-center justify-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 font-medium transition-all hover:bg-red-500/20 active:scale-[0.98]"
      >
        <LogOut className="h-5 w-5" />
        Sign Out
      </button>
    </div>
  );
};

export default UserProfile;
