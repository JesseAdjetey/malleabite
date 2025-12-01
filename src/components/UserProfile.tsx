
import React from 'react';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/ui/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, User, UserCircle } from 'lucide-react';

const UserProfile = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    try {
      await signOut();
      // Force navigation to auth page after signout
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

  // Get user initials for avatar fallback
  const getInitials = () => {
    if (!user?.email) return '?';
    return user.email.substring(0, 2).toUpperCase();
  };

  // Helper functions for Firebase user object
  const getUserName = () => {
    return (user as any)?.displayName || user?.email;
  };

  const getUserId = () => {
    return (user as any)?.uid?.substring(0, 8);
  };

  const getAvatarUrl = () => {
    return (user as any)?.photoURL;
  };

  const getLastSignIn = () => {
    return (user as any)?.metadata?.lastSignInTime 
      ? new Date((user as any).metadata.lastSignInTime).toLocaleString() 
      : 'N/A';
  };

  const getCreatedAt = () => {
    return (user as any)?.metadata?.creationTime 
      ? new Date((user as any).metadata.creationTime).toLocaleString() 
      : 'N/A';
  };

  return (
    <div className="p-6 bg-card rounded-lg shadow">
      <div className="flex items-center gap-4 mb-6">
        <Avatar className="h-16 w-16 border-2 border-primary">
          <AvatarImage src={getAvatarUrl()} />
          <AvatarFallback className="bg-primary text-primary-foreground text-lg font-medium">
            {getInitials()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="font-semibold text-lg">{getUserName()}</h3>
          <p className="text-sm text-muted-foreground">User ID: {getUserId()}...</p>
        </div>
      </div>
      
      <div className="space-y-4 mt-4 bg-background/50 p-4 rounded-md">
        <div className="grid grid-cols-3 text-sm">
          <span className="font-medium">Email:</span>
          <span className="col-span-2">{user?.email}</span>
        </div>
        
        <div className="grid grid-cols-3 text-sm">
          <span className="font-medium">Last Sign In:</span>
          <span className="col-span-2">{getLastSignIn()}</span>
        </div>
        
        <div className="grid grid-cols-3 text-sm">
          <span className="font-medium">Created:</span>
          <span className="col-span-2">{getCreatedAt()}</span>
        </div>
        
        <div className="grid grid-cols-3 text-sm">
          <span className="font-medium">Backend:</span>
          <span className="col-span-2">Firebase</span>
        </div>
      </div>
      
      <div className="mt-6 flex justify-end">
        <Button variant="destructive" onClick={handleSignOut} className="gap-2">
          <LogOut size={16} />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default UserProfile;
