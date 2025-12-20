
import React, { useState } from 'react';
import UserProfile from '@/components/UserProfile';
import FocusTimeBlocks from '@/components/calendar/FocusTimeBlocks';
import { CalendarImportExport } from '@/components/calendar/CalendarImportExport';
import { Upload, Home, LogOut, Mic, MicOff, Volume2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MobileNavigation from '@/components/MobileNavigation';
import { useAuth } from '@/contexts/AuthContext.unified';
import { toast } from '@/components/ui/use-toast';
import { useHeyMally } from '@/contexts/HeyMallyContext';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const navigate = useNavigate();
  const { signOut } = useAuth();
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

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-4">
      <div className="container mx-auto p-4 max-w-6xl text-white">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => navigate('/')} 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/10"
          >
            <Home className="h-5 w-5" />
            <span className="sr-only">Back to Dashboard</span>
          </Button>
          <h1 className="text-2xl font-bold">Settings</h1>
        </div>
        <Button
          onClick={handleSignOut}
          variant="outline"
          size="sm"
          className="gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:border-red-500/50"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6 bg-black/30 flex-wrap h-auto gap-1 p-1 w-full justify-start overflow-x-auto">
          <TabsTrigger value="profile" className="text-xs sm:text-sm px-2 sm:px-3">Profile</TabsTrigger>
          <TabsTrigger value="focus" className="text-xs sm:text-sm px-2 sm:px-3">Focus Time</TabsTrigger>
          <TabsTrigger value="voice" className="text-xs sm:text-sm px-2 sm:px-3">
            <Mic className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
            Voice
          </TabsTrigger>
          <TabsTrigger value="import-export" className="text-xs sm:text-sm px-2 sm:px-3">
            <Upload className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
            Import
          </TabsTrigger>
        </TabsList>

        <TabsContent value="voice">
          <div className="p-6 bg-black/30 rounded-lg shadow backdrop-blur-sm border border-white/10 space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-2 flex items-center gap-2">
                <Volume2 className="h-5 w-5 text-primary" />
                "Hey Mally" Voice Activation
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Enable hands-free activation by saying "Hey Mally" to open your AI assistant, 
                just like Siri or Google Assistant.
              </p>
              
              {!isSupported ? (
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-sm text-yellow-400">
                    ⚠️ Voice activation is not supported in this browser. 
                    Please use Chrome, Edge, or Safari for this feature.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-center gap-3">
                      {isWakeWordEnabled ? (
                        <div className="relative">
                          <Mic className="h-6 w-6 text-green-500" />
                          {isListening && (
                            <>
                              <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full animate-ping" />
                              <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full" />
                            </>
                          )}
                        </div>
                      ) : (
                        <MicOff className="h-6 w-6 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium">
                          {isWakeWordEnabled ? 'Hey Mally is Active' : 'Hey Mally is Disabled'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isWakeWordEnabled 
                            ? isListening 
                              ? 'Listening for "Hey Mally"...' 
                              : 'Starting...'
                            : 'Enable to use voice activation'}
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={toggleWakeWord}
                      variant={isWakeWordEnabled ? "destructive" : "default"}
                      size="sm"
                    >
                      {isWakeWordEnabled ? 'Disable' : 'Enable'}
                    </Button>
                  </div>

                  {wakeWordError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <p className="text-sm text-red-400">{wakeWordError}</p>
                    </div>
                  )}

                  <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
                    <h4 className="font-medium text-primary mb-2">How to use:</h4>
                    <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                      <li>Enable "Hey Mally" above</li>
                      <li>Allow microphone access when prompted</li>
                      <li>Say <span className="text-primary font-semibold">"Hey Mally"</span> to activate</li>
                      <li>Speak your request (e.g., "Schedule a meeting tomorrow at 3 PM")</li>
                    </ol>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    <p className="flex items-center gap-1">
                      <span className="inline-block w-2 h-2 bg-green-500 rounded-full" />
                      Works best in quiet environments
                    </p>
                    <p className="flex items-center gap-1 mt-1">
                      <span className="inline-block w-2 h-2 bg-primary rounded-full" />
                      Keep the app open for best results
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="profile">
          <div className="p-6 bg-black/30 rounded-lg shadow backdrop-blur-sm border border-white/10">
            <UserProfile />
          </div>
        </TabsContent>

        <TabsContent value="focus">
          <FocusTimeBlocks />
        </TabsContent>

        <TabsContent value="import-export">
          <div className="p-6 bg-black/30 rounded-lg shadow backdrop-blur-sm border border-white/10">
            <CalendarImportExport />
          </div>
        </TabsContent>
      </Tabs>
      <MobileNavigation />
      </div>
    </div>
  );
};

export default Settings;
