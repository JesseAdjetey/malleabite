
import React, { useState } from 'react';
import UserProfile from '@/components/UserProfile';
import { GoogleCalendarSync } from '@/components/integrations/GoogleCalendarSync';
import { SlackNotifications } from '@/components/integrations/SlackNotifications';
import { WhatsAppLink } from '@/components/integrations/WhatsAppLink';
import { ThemeSelector } from '@/components/theme/ThemeSelector';
import { SchedulingSettings } from '@/components/settings/SchedulingSettings';
import { LogOut, ChevronLeft, Crown, Plug2, Palette, Globe, Volume2, CalendarClock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '@/contexts/AuthContext.unified';
import { toast } from '@/components/ui/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useSubscription } from '@/hooks/use-subscription';
import { useThemeStore } from '@/lib/stores/theme-store';
import { useSettingsStore } from '@/lib/stores/settings-store';
import { sounds } from '@/lib/sounds';
import { useAutoTranslateSafe } from '@/i18n/TranslationProvider';
import { SUPPORTED_LANGUAGES, type LanguageCode } from '@/i18n/config';
import { GroupedList, GroupedListHeader, GroupedListItem } from '@/components/ui/grouped-list';
import { haptics } from '@/lib/haptics';
import { motion, AnimatePresence } from 'framer-motion';
import { springs } from '@/lib/animations';

type SettingsSection = 'main' | 'profile' | 'focus' | 'integrations' | 'appearance' | 'language' | 'scheduling';

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

const Settings = () => {
  const [activeSection, setActiveSection] = useState<SettingsSection>('main');
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { aiAutoExecute, setAiAutoExecute } = useSettingsStore();
  const [soundsEnabled, setSoundsEnabled] = useState(sounds.enabled);
  const handleToggleSounds = (val: boolean) => { sounds.setEnabled(val); setSoundsEnabled(val); };
  const { subscription } = useSubscription();
  const { theme } = useThemeStore();
  const isPro = subscription?.isPro ?? false;
  const { currentLang, setLanguage } = useAutoTranslateSafe();

  const getCurrentLangLabel = () =>
    SUPPORTED_LANGUAGES.find((l) => l.code === currentLang)?.label || 'English';

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
          <div className="flex items-center gap-2 mb-6">
            <button
              onClick={() => { haptics.light(); navigate(-1); }}
              className="flex items-center gap-0.5 text-primary font-medium text-subheadline active:opacity-50 transition-opacity touch-manipulation"
            >
              <ChevronLeft className="h-5 w-5" />
              <span>Back</span>
            </button>
            <div className="flex-1" />
          </div>
          <h1 className="text-large-title mb-6 px-1">Settings</h1>

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

            <div className="w-full flex items-center gap-3 px-4 py-3 text-left">
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                isPro ? "bg-purple-600" : "bg-gradient-to-br from-amber-500 to-orange-500"
              )}>
                <Crown className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-subheadline">{isPro ? 'Pro Plan' : '1 Week Trial'}</div>
                <div className="text-caption1 text-muted-foreground">
                  {isPro ? 'Manage subscription' : 'Early tester — 1 week full access'}
                </div>
              </div>
              {!isPro && (
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 text-caption2 font-semibold rounded-full border border-amber-500/30">
                  TRIAL
                </span>
              )}
            </div>
          </GroupedList>

          {/* Preferences */}
          <GroupedListHeader>Preferences</GroupedListHeader>
          <GroupedList className="mb-2">
            <GroupedListItem
              icon={<Palette className="h-4 w-4 text-purple-500" />}
              iconBg="bg-purple-500/15"
              label="Appearance"
              rightElement={<span className="text-caption1 text-muted-foreground">{getThemeLabel()}</span>}
              onClick={() => goTo('appearance')}
            />
            <GroupedListItem
              icon={<Globe className="h-4 w-4 text-sky-500" />}
              iconBg="bg-sky-500/15"
              label="Language"
              rightElement={<span className="text-caption1 text-muted-foreground">{getCurrentLangLabel()}</span>}
              onClick={() => goTo('language')}
            />
            <GroupedListItem
              icon={<Volume2 className="h-4 w-4 text-indigo-500" />}
              iconBg="bg-indigo-500/15"
              label="UI Sounds"
              sublabel={soundsEnabled ? 'Sound effects on' : 'Sound effects off'}
              rightElement={
                <Switch checked={soundsEnabled} onCheckedChange={handleToggleSounds} />
              }
            />
<GroupedListItem
              icon={<Plug2 className="h-4 w-4 text-teal-500/40" />}
              iconBg="bg-teal-500/8"
              label="Integrations"
              sublabel="Coming soon"
              className="opacity-40 pointer-events-none select-none"
            />
            <GroupedListItem
              icon={<CalendarClock className="h-4 w-4 text-rose-500/40" />}
              iconBg="bg-rose-500/8"
              label="Scheduling"
              sublabel="Coming soon"
              className="opacity-40 pointer-events-none select-none"
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
            <WhatsAppLink />
            <SlackNotifications />
          </div>
        </div>
      </PageWrapper>
    );
  }


  // Language Section
  if (activeSection === 'language') {
    return (
      <PageWrapper>
        <div className="px-4 pt-6 max-w-lg mx-auto">
          <BackButton title="Language" />
          <SectionTitle>Language</SectionTitle>

          <p className="text-subheadline text-muted-foreground mb-4 px-1">
            Choose your preferred language. The app will automatically translate all content.
          </p>

          <GroupedList>
            {SUPPORTED_LANGUAGES.map((lang, i) => (
              <button
                key={lang.code}
                onClick={() => { haptics.light(); setLanguage(lang.code as LanguageCode); }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-muted/60",
                  i < SUPPORTED_LANGUAGES.length - 1 && "border-b border-separator/30"
                )}
              >
                <span className="text-lg" data-no-translate>{getFlagEmoji(lang.flag)}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-subheadline font-medium" data-no-translate>{lang.label}</span>
                </div>
                {currentLang === lang.code && (
                  <span className="text-primary font-semibold text-caption1">✓</span>
                )}
              </button>
            ))}
          </GroupedList>
        </div>
      </PageWrapper>
    );
  }

  // Scheduling Section
  if (activeSection === 'scheduling') {
    return (
      <PageWrapper>
        <div className="px-4 pt-6 max-w-lg mx-auto">
          <BackButton title="Scheduling" />
          <SectionTitle>Scheduling</SectionTitle>
          <SchedulingSettings />
        </div>
      </PageWrapper>
    );
  }

  return null;
};

/** Convert country code to flag emoji (e.g., "US" → 🇺🇸) */
function getFlagEmoji(countryCode: string): string {
  return [...countryCode.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

export default Settings;
