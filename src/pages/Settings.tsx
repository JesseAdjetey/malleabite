
import React, { useState } from 'react';
import UserProfile from '@/components/UserProfile';
import FocusTimeBlocks from '@/components/calendar/FocusTimeBlocks';
import { CalendarImportExport } from '@/components/calendar/CalendarImportExport';
import { GoogleCalendarSync } from '@/components/integrations/GoogleCalendarSync';
import { SlackNotifications } from '@/components/integrations/SlackNotifications';
import { ThemeSelector } from '@/components/theme/ThemeSelector';
import { LogOut, Mic, MicOff, Clock, FileUp, ChevronLeft, Crown, CreditCard, Plug2, Palette, Wrench, FileText, Zap, MoreHorizontal, BarChart3, FolderPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/contexts/AuthContext.unified';
import { toast } from '@/components/ui/use-toast';
import { useHeyMally } from '@/contexts/HeyMallyContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useSubscription } from '@/hooks/use-subscription';
import { useThemeStore } from '@/lib/stores/theme-store';
import { GroupedList, GroupedListHeader, GroupedListItem } from '@/components/ui/grouped-list';
import { haptics } from '@/lib/haptics';
import { motion, AnimatePresence } from 'framer-motion';
import { springs } from '@/lib/animations';

type SettingsSection = 'main' | 'profile' | 'focus' | 'voice' | 'import' | 'integrations' | 'appearance' | 'tools';

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
  const { subscription } = useSubscription();
  const { theme } = useThemeStore();
  const isPro = subscription?.isPro ?? false;

  const getThemeLabel = () => {
    switch (theme) {
      case 'light': return 'Light';
      case 'dark': return 'Dark';
      case 'system': return 'System';
    }
  };

  const handleSignOut = async () => {
    haptics.warning();
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

  const goTo = (section: SettingsSection) => {
    haptics.light();
    setActiveSection(section);
  };

  // Page wrapper with transition
  const PageWrapper = ({ children }: { children: React.ReactNode }) => (
    <motion.div
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={springs.page}
      className="min-h-screen bg-background pb-24 overflow-y-auto overflow-x-hidden"
    >
      {children}
    </motion.div>
  );

  // iOS-style back button
  const BackButton = ({ title }: { title: string }) => (
    <div className="flex items-center gap-2 mb-6">
      <button
        onClick={() => { haptics.light(); setActiveSection('main'); }}
        className="flex items-center gap-0.5 text-primary font-medium text-subheadline active:opacity-50 transition-opacity touch-manipulation"
      >
        <ChevronLeft className="h-5 w-5" />
        <span>Settings</span>
      </button>
      <div className="flex-1" />
    </div>
  );

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h1 className="text-large-title mb-6 px-1">{children}</h1>
  );

  // Main Settings Menu
  if (activeSection === 'main') {
    return (
      <PageWrapper>
        <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
          <h1 className="text-large-title mb-6">Settings</h1>

          {/* Profile & Subscription section */}
          <GroupedList className="mb-6">
            <button
              onClick={() => goTo('profile')}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:bg-muted/60 border-b border-separator/30"
            >
              <Avatar className="h-12 w-12 border-2 border-primary/30">
                <AvatarImage src={getAvatarUrl()} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-headline truncate">{getUserName()}</div>
                <div className="text-caption1 text-muted-foreground truncate">{user?.email}</div>
              </div>
              <ChevronLeft className="h-4 w-4 text-muted-foreground/50 rotate-180" />
            </button>

            <button
              onClick={() => { haptics.light(); navigate(isPro ? '/billing' : '/pricing'); }}
              className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors active:bg-muted/60"
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                isPro ? "bg-purple-600" : "bg-gradient-to-br from-amber-500 to-orange-500"
              )}>
                <Crown className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-subheadline">{isPro ? 'Pro Plan' : 'Free Plan'}</div>
                <div className="text-caption1 text-muted-foreground truncate">
                  {isPro ? 'Manage subscription' : 'Upgrade for unlimited features'}
                </div>
              </div>
              {!isPro && (
                <span className="px-2 py-0.5 bg-primary text-primary-foreground text-caption2 font-semibold rounded-full">
                  UPGRADE
                </span>
              )}
            </button>
          </GroupedList>

          {/* Preferences */}
          <GroupedListHeader>Preferences</GroupedListHeader>
          <GroupedList className="mb-2">
            <GroupedListItem
              icon={<Clock className="h-4 w-4 text-blue-500" />}
              iconBg="bg-blue-500/15"
              label="Focus Time"
              sublabel="Set your productive hours"
              onClick={() => goTo('focus')}
            />
            <GroupedListItem
              icon={<Palette className="h-4 w-4 text-purple-500" />}
              iconBg="bg-purple-500/15"
              label="Appearance"
              rightElement={<span className="text-caption1 text-muted-foreground">{getThemeLabel()}</span>}
              onClick={() => goTo('appearance')}
            />
            <GroupedListItem
              icon={<Mic className="h-4 w-4 text-green-500" />}
              iconBg="bg-green-500/15"
              label="Voice Control"
              sublabel={isWakeWordEnabled ? '"Hey Mally" is active' : 'Enable hands-free'}
              onClick={() => goTo('voice')}
              rightElement={
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full",
                  isWakeWordEnabled ? "bg-green-500" : "bg-muted-foreground/20"
                )} />
              }
            />
            <GroupedListItem
              icon={<FileUp className="h-4 w-4 text-orange-500" />}
              iconBg="bg-orange-500/15"
              label="Import & Export"
              sublabel="Backup or restore your data"
              onClick={() => goTo('import')}
            />
            <GroupedListItem
              icon={<Plug2 className="h-4 w-4 text-teal-500" />}
              iconBg="bg-teal-500/15"
              label="Integrations"
              sublabel="Google Calendar, Slack & more"
              onClick={() => goTo('integrations')}
            />
            <GroupedListItem
              icon={<Wrench className="h-4 w-4 text-gray-500" />}
              iconBg="bg-gray-500/15"
              label="Tools"
              sublabel="Templates, Patterns, Analytics"
              onClick={() => goTo('tools')}
            />
          </GroupedList>

          {/* Account */}
          <GroupedListHeader>Account</GroupedListHeader>
          <GroupedList>
            <GroupedListItem
              icon={<LogOut className="h-4 w-4 text-destructive" />}
              iconBg="bg-destructive/15"
              label="Sign Out"
              destructive
              showChevron={false}
              onClick={handleSignOut}
            />
          </GroupedList>
        </div>
      </PageWrapper>
    );
  }

  // Profile Section
  if (activeSection === 'profile') {
    return (
      <PageWrapper>
        <div className="px-4 pt-6 max-w-lg mx-auto">
          <BackButton title="Profile" />
          <SectionTitle>Profile</SectionTitle>
          <UserProfile />
        </div>
      </PageWrapper>
    );
  }

  // Focus Time Section
  if (activeSection === 'focus') {
    return (
      <PageWrapper>
        <div className="px-4 pt-6 max-w-lg mx-auto">
          <BackButton title="Focus Time" />
          <SectionTitle>Focus Time</SectionTitle>
          <FocusTimeBlocks />
        </div>
      </PageWrapper>
    );
  }

  // Voice Control Section
  if (activeSection === 'voice') {
    return (
      <PageWrapper>
        <div className="px-4 pt-6 max-w-lg mx-auto">
          <BackButton title="Voice Control" />
          <SectionTitle>Voice Control</SectionTitle>

          {/* Hero Toggle */}
          <GroupedList className="mb-6">
            <div className="flex items-center justify-between px-4 py-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                  isWakeWordEnabled ? "bg-green-500/15" : "bg-muted"
                )}>
                  {isWakeWordEnabled ? (
                    <div className="relative">
                      <Mic className="h-5 w-5 text-green-500" />
                      {isListening && (
                        <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 bg-green-500 rounded-full animate-ping" />
                      )}
                    </div>
                  ) : (
                    <MicOff className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <div className="text-subheadline font-medium">Hey Mally</div>
                  <div className="text-caption1 text-muted-foreground">
                    {isWakeWordEnabled ? (isListening ? 'Listening...' : 'Active') : 'Disabled'}
                  </div>
                </div>
              </div>
              <Switch
                checked={isWakeWordEnabled}
                onCheckedChange={() => { haptics.medium(); toggleWakeWord(); }}
                disabled={!isSupported}
              />
            </div>
          </GroupedList>

          {!isSupported && (
            <div className="px-4 py-3 mb-4 bg-yellow-500/10 rounded-2xl border border-yellow-500/20">
              <p className="text-footnote text-yellow-600 dark:text-yellow-400">
                Voice activation requires Chrome, Edge, or Safari
              </p>
            </div>
          )}

          {wakeWordError && (
            <div className="px-4 py-3 mb-4 bg-destructive/10 rounded-2xl border border-destructive/20">
              <p className="text-footnote text-destructive">{wakeWordError}</p>
            </div>
          )}

          {/* How it works */}
          <GroupedListHeader>How it works</GroupedListHeader>
          <GroupedList className="mb-4">
            {[
              { step: '1', text: 'Enable the toggle above' },
              { step: '2', text: 'Allow microphone access' },
              { step: '3', text: 'Say "Hey Mally" clearly' },
              { step: '4', text: 'Speak your request' },
            ].map((item, i) => (
              <div key={item.step} className={cn(
                "flex items-center gap-3 px-4 py-3",
                i < 3 && "border-b border-separator/30"
              )}>
                <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-caption1 font-semibold text-primary">
                  {item.step}
                </div>
                <span className="text-subheadline">{item.text}</span>
              </div>
            ))}
          </GroupedList>
        </div>
      </PageWrapper>
    );
  }

  // Appearance Section
  if (activeSection === 'appearance') {
    return (
      <PageWrapper>
        <div className="px-4 pt-6 max-w-lg mx-auto">
          <BackButton title="Appearance" />
          <SectionTitle>Appearance</SectionTitle>

          <GroupedListHeader>Theme</GroupedListHeader>
          <GroupedList className="mb-4 p-4">
            <ThemeSelector showLabel={false} size="lg" />
          </GroupedList>

          <GroupedListHeader>About Themes</GroupedListHeader>
          <GroupedList>
            <div className="px-4 py-3 border-b border-separator/30 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-subheadline"><strong className="font-medium">Light</strong> — Clean and bright for daytime</span>
            </div>
            <div className="px-4 py-3 border-b border-separator/30 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-indigo-500" />
              <span className="text-subheadline"><strong className="font-medium">Dark</strong> — Easier on the eyes at night</span>
            </div>
            <div className="px-4 py-3 flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-primary" />
              <span className="text-subheadline"><strong className="font-medium">System</strong> — Matches your device</span>
            </div>
          </GroupedList>
        </div>
      </PageWrapper>
    );
  }

  // Import/Export Section
  if (activeSection === 'import') {
    return (
      <PageWrapper>
        <div className="px-4 pt-6 max-w-lg mx-auto">
          <BackButton title="Import & Export" />
          <SectionTitle>Import & Export</SectionTitle>
          <CalendarImportExport />
        </div>
      </PageWrapper>
    );
  }

  // Integrations Section
  if (activeSection === 'integrations') {
    return (
      <PageWrapper>
        <div className="px-4 pt-6 max-w-lg mx-auto">
          <BackButton title="Integrations" />
          <SectionTitle>Integrations</SectionTitle>

          <p className="text-subheadline text-muted-foreground mb-4 px-1">
            Connect your favorite services to sync events and get notifications.
          </p>

          <div className="space-y-4">
            <GoogleCalendarSync />
            <SlackNotifications />
          </div>
        </div>
      </PageWrapper>
    );
  }

  // Tools Section
  if (activeSection === 'tools') {
    return (
      <PageWrapper>
        <div className="px-4 pt-6 max-w-lg mx-auto">
          <BackButton title="Tools" />
          <SectionTitle>Tools</SectionTitle>

          <GroupedList>
            <GroupedListItem
              icon={<FileText className="h-4 w-4 text-blue-500" />}
              iconBg="bg-blue-500/15"
              label="Templates"
              sublabel="Create events from saved templates"
              onClick={() => navigate('/templates')}
            />
            <GroupedListItem
              icon={<Zap className="h-4 w-4 text-yellow-500" />}
              iconBg="bg-yellow-500/15"
              label="Quick Schedule"
              sublabel="Rapidly add multiple events"
              onClick={() => navigate('/quick-schedule')}
            />
            <GroupedListItem
              icon={<MoreHorizontal className="h-4 w-4 text-purple-500" />}
              iconBg="bg-purple-500/15"
              label="Patterns"
              sublabel="Discover scheduling patterns"
              onClick={() => navigate('/patterns')}
            />
            <GroupedListItem
              icon={<FolderPlus className="h-4 w-4 text-green-500" />}
              iconBg="bg-green-500/15"
              label="Archive & Start Fresh"
              sublabel="Save and clear your calendar"
              onClick={() => navigate('/snapshots')}
            />
            <GroupedListItem
              icon={<BarChart3 className="h-4 w-4 text-teal-500" />}
              iconBg="bg-teal-500/15"
              label="Analytics"
              sublabel="View productivity insights"
              onClick={() => navigate('/analytics')}
            />
            <GroupedListItem
              icon={<FolderPlus className="h-4 w-4 text-orange-500" />}
              iconBg="bg-orange-500/15"
              label="Calendar Archives"
              sublabel="Access archived calendars"
              onClick={() => navigate('/calendar-archives')}
            />
          </GroupedList>
        </div>
      </PageWrapper>
    );
  }

  return null;
};

export default Settings;
