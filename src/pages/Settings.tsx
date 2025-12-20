
import React, { useState } from 'react';
import UserProfile from '@/components/UserProfile';
import FocusTimeBlocks from '@/components/calendar/FocusTimeBlocks';
import { CalendarImportExport } from '@/components/calendar/CalendarImportExport';
import { ChevronRight, LogOut, Mic, MicOff, Clock, FileUp, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import MobileNavigation from '@/components/MobileNavigation';
import { useAuth } from '@/contexts/AuthContext.unified';
import { toast } from '@/components/ui/use-toast';
import { useHeyMally } from '@/contexts/HeyMallyContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

type SettingsSection = 'main' | 'profile' | 'focus' | 'voice' | 'import';

const Settings = () => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('main');
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { 
    isWakeWordEnabled, 
    isListening, 
    isSupported, 
    toggleWakeWord,
    error: wakeWordError 
  } = useHeyMally();

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

  const getAvatarUrl = () => (user as any)?.photoURL;
  const getUserName = () => (user as any)?.displayName || user?.email?.split('@')[0] || 'User';

  // Menu Item Component
  const MenuItem = ({ 
    icon: Icon, 
    label, 
    sublabel, 
    onClick, 
    rightElement,
    variant = 'default'
  }: { 
    icon: any; 
    label: string; 
    sublabel?: string;
    onClick?: () => void;
    rightElement?: React.ReactNode;
    variant?: 'default' | 'danger';
  }) => (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-2xl transition-all active:scale-[0.98]",
        "bg-white/5 hover:bg-white/10 border border-white/10",
        variant === 'danger' && "border-red-500/20 hover:bg-red-500/10"
      )}
    >
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center",
        variant === 'default' ? "bg-primary/20" : "bg-red-500/20"
      )}>
        <Icon className={cn(
          "h-5 w-5",
          variant === 'default' ? "text-primary" : "text-red-400"
        )} />
      </div>
      <div className="flex-1 text-left">
        <p className={cn(
          "font-medium",
          variant === 'danger' && "text-red-400"
        )}>{label}</p>
        {sublabel && <p className="text-xs text-muted-foreground">{sublabel}</p>}
      </div>
      {rightElement || <ChevronRight className="h-5 w-5 text-muted-foreground" />}
    </button>
  );

  // Back Button Component
  const BackButton = ({ title }: { title: string }) => (
    <div className="flex items-center gap-3 mb-6">
      <button
        onClick={() => setActiveSection('main')}
        className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <h1 className="text-xl font-semibold">{title}</h1>
    </div>
  );

  // Main Settings Menu
  if (activeSection === 'main') {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate('/')}
              className="hidden md:flex w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 items-center justify-center transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h1 className="text-2xl font-bold">Settings</h1>
          </div>

          {/* Profile Card */}
          <button
            onClick={() => setActiveSection('profile')}
            className="w-full flex items-center gap-4 p-4 mb-6 rounded-2xl bg-gradient-to-r from-primary/20 to-purple-600/20 border border-primary/30 transition-all active:scale-[0.98]"
          >
            <Avatar className="h-14 w-14 border-2 border-primary/50">
              <AvatarImage src={getAvatarUrl()} />
              <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 text-left">
              <p className="font-semibold text-lg">{getUserName()}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>

          {/* Settings Groups */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 mb-2">
              Preferences
            </p>
            
            <MenuItem
              icon={Clock}
              label="Focus Time"
              sublabel="Set your productive hours"
              onClick={() => setActiveSection('focus')}
            />

            <MenuItem
              icon={Mic}
              label="Voice Control"
              sublabel={isWakeWordEnabled ? '"Hey Mally" is active' : 'Enable hands-free mode'}
              onClick={() => setActiveSection('voice')}
              rightElement={
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  isWakeWordEnabled ? "bg-green-500" : "bg-muted-foreground/30"
                )} />
              }
            />

            <MenuItem
              icon={FileUp}
              label="Import & Export"
              sublabel="Backup or restore your data"
              onClick={() => setActiveSection('import')}
            />
          </div>

          {/* Sign Out */}
          <div className="mt-8">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 mb-2">
              Account
            </p>
            <MenuItem
              icon={LogOut}
              label="Sign Out"
              onClick={handleSignOut}
              variant="danger"
              rightElement={null}
            />
          </div>
        </div>
        <MobileNavigation />
      </div>
    );
  }

  // Profile Section
  if (activeSection === 'profile') {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="px-4 pt-6 max-w-lg mx-auto">
          <BackButton title="Profile" />
          <UserProfile />
        </div>
        <MobileNavigation />
      </div>
    );
  }

  // Focus Time Section
  if (activeSection === 'focus') {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="px-4 pt-6 max-w-lg mx-auto">
          <BackButton title="Focus Time" />
          <FocusTimeBlocks />
        </div>
        <MobileNavigation />
      </div>
    );
  }

  // Voice Control Section
  if (activeSection === 'voice') {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="px-4 pt-6 max-w-lg mx-auto">
          <BackButton title="Voice Control" />

          {/* Hero Toggle */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-primary/20 via-purple-600/10 to-transparent border border-primary/20 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center transition-colors",
                  isWakeWordEnabled ? "bg-green-500/20" : "bg-white/10"
                )}>
                  {isWakeWordEnabled ? (
                    <div className="relative">
                      <Mic className="h-7 w-7 text-green-500" />
                      {isListening && (
                        <span className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full animate-ping" />
                      )}
                    </div>
                  ) : (
                    <MicOff className="h-7 w-7 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-lg">Hey Mally</p>
                  <p className="text-sm text-muted-foreground">
                    {isWakeWordEnabled ? (isListening ? 'Listening...' : 'Active') : 'Disabled'}
                  </p>
                </div>
              </div>
              <Switch
                checked={isWakeWordEnabled}
                onCheckedChange={toggleWakeWord}
                disabled={!isSupported}
              />
            </div>

            {!isSupported && (
              <div className="p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20">
                <p className="text-xs text-yellow-400">
                  Voice activation requires Chrome, Edge, or Safari
                </p>
              </div>
            )}

            {wakeWordError && (
              <div className="p-3 bg-red-500/10 rounded-xl border border-red-500/20">
                <p className="text-xs text-red-400">{wakeWordError}</p>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-1">
              How it works
            </p>
            
            {[
              { step: '1', text: 'Enable the toggle above' },
              { step: '2', text: 'Allow microphone access' },
              { step: '3', text: 'Say "Hey Mally" clearly' },
              { step: '4', text: 'Speak your request' },
            ].map((item) => (
              <div key={item.step} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-semibold text-primary">
                  {item.step}
                </div>
                <p className="text-sm">{item.text}</p>
              </div>
            ))}
          </div>

          {/* Tips */}
          <div className="mt-6 p-4 rounded-2xl bg-white/5 border border-white/10">
            <p className="text-xs font-medium text-muted-foreground mb-3">Pro Tips</p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Works best in quiet environments
              </p>
              <p className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                Keep the app tab open
              </p>
            </div>
          </div>
        </div>
        <MobileNavigation />
      </div>
    );
  }

  // Import/Export Section
  if (activeSection === 'import') {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="px-4 pt-6 max-w-lg mx-auto">
          <BackButton title="Import & Export" />
          <CalendarImportExport />
        </div>
        <MobileNavigation />
      </div>
    );
  }

  return null;
};

export default Settings;
