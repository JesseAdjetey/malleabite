
import React, { useState } from 'react';
import ModuleContainer from './ModuleContainer';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, Clock, Plus, RefreshCw, Send, X } from 'lucide-react';
import { useInvites } from '@/hooks/use-invites';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';

interface InvitesModuleProps {
  title?: string;
  onRemove?: () => void;
  onTitleChange?: (title: string) => void;
}

const InvitesModule: React.FC<InvitesModuleProps> = ({ 
  title = "Event Invites",
  onRemove, 
  onTitleChange,
}) => {
  const { receivedInvites, sentInvites, loading, respondToInvite, deleteInvite, fetchInvites } = useInvites();
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user } = useAuth();
  
  const refreshInvites = async () => {
    setIsRefreshing(true);
    await fetchInvites();
    setIsRefreshing(false);
  };
  
  // Format timestamp to a readable time
  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '';
    return dayjs(timestamp).format('MMM D, h:mm A');
  };
  
  // Extract name from email
  const getNameFromEmail = (email: string | null) => {
    if (!email) return '';
    return email.split('@')[0];
  };

  return (
    <ModuleContainer 
      title={title} 
      onRemove={onRemove}
      onTitleChange={onTitleChange}
    >
      <div className="mb-2 flex justify-between items-center">
        <Button 
          variant="outline" 
          size="sm" 
          className="h-7 flex items-center justify-center text-gray-700 dark:text-gray-300" 
          onClick={refreshInvites}
          disabled={isRefreshing}
        >
          {isRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" /> : <RefreshCw className="h-3.5 w-3.5 flex-shrink-0" />}
        </Button>
        
        <SendInviteDialog 
          isOpen={isInviteDialogOpen} 
          setIsOpen={setIsInviteDialogOpen} 
          onSuccess={refreshInvites}
        />
      </div>
      
      <Tabs defaultValue="received">
        <TabsList className="w-full mb-2 grid grid-cols-2">
          <TabsTrigger value="received">
            Received {receivedInvites.length > 0 && `(${receivedInvites.length})`}
          </TabsTrigger>
          <TabsTrigger value="sent">
            Sent {sentInvites.length > 0 && `(${sentInvites.length})`}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="received" className="space-y-2 max-h-64 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : receivedInvites.length === 0 ? (
            <div className="text-center py-4 text-sm text-gray-600 dark:text-gray-400">
              No invites received
            </div>
          ) : (
            receivedInvites.map(invite => (
              <div 
                key={invite.id}
                className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 p-2 rounded-lg"
              >
                <Avatar className="h-6 w-6 flex-shrink-0">
                  <AvatarImage src="" />
                  <AvatarFallback className="text-xs bg-primary/30">
                    {getNameFromEmail(invite.invitee_email || '').substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate text-gray-800 dark:text-white">{invite.event?.title || 'Unnamed event'}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {formatTime(invite.event?.startsAt || invite.created_at)}
                  </div>
                </div>
                
                {invite.status === 'pending' ? (
                  <div className="flex gap-1">
                    <button 
                      className="p-1 rounded-full bg-green-500/20 hover:bg-green-500/40 transition-colors"
                      onClick={() => respondToInvite(invite.id, true)}
                    >
                      <Check size={14} className="text-green-500" />
                    </button>
                    <button 
                      className="p-1 rounded-full bg-red-500/20 hover:bg-red-500/40 transition-colors"
                      onClick={() => respondToInvite(invite.id, false)}
                    >
                      <X size={14} className="text-red-500" />
                    </button>
                  </div>
                ) : (
                  <div className="text-xs italic">
                    {invite.status === 'accepted' ? (
                      <span className="text-green-600 dark:text-green-400">Accepted</span>
                    ) : (
                      <span className="text-red-600 dark:text-red-400">Declined</span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </TabsContent>
        
        <TabsContent value="sent" className="space-y-2 max-h-64 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : sentInvites.length === 0 ? (
            <div className="text-center py-4 text-sm text-gray-600 dark:text-gray-400">
              No invites sent
            </div>
          ) : (
            sentInvites.map(invite => (
              <div 
                key={invite.id}
                className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 p-2 rounded-lg"
              >
                <Avatar className="h-6 w-6 flex-shrink-0">
                  <AvatarImage src="" />
                  <AvatarFallback className="text-xs bg-primary/30">
                    {getNameFromEmail(invite.invitee_email || '').substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate text-gray-800 dark:text-white">{invite.event?.title || 'Unnamed event'}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    To: {invite.invitee_email}
                  </div>
                </div>
                
                <div className="flex-shrink-0 ml-1">
                  {invite.status === 'pending' ? (
                    <span className="text-xs bg-yellow-500/20 text-yellow-400 px-1.5 rounded">Pending</span>
                  ) : invite.status === 'accepted' ? (
                    <span className="text-xs bg-green-500/20 text-green-400 px-1.5 rounded">Accepted</span>
                  ) : (
                    <span className="text-xs bg-red-500/20 text-red-400 px-1.5 rounded">Declined</span>
                  )}
                </div>
                
                <button 
                  className="p-1 rounded-full bg-red-500/20 hover:bg-red-500/40 transition-colors flex-shrink-0"
                  onClick={() => deleteInvite(invite.id)}
                >
                  <X size={14} className="text-red-500" />
                </button>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </ModuleContainer>
  );
};

interface SendInviteDialogProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onSuccess?: () => void;
}

const SendInviteDialog: React.FC<SendInviteDialogProps> = ({ isOpen, setIsOpen, onSuccess }) => {
  const { events } = useCalendarEvents();
  const { sendInvite } = useInvites();
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [isSending, setIsSending] = useState(false);
  
  const handleSend = async () => {
    if (!selectedEvent) {
      toast.error("Please select an event");
      return;
    }
    
    if (!email) {
      toast.error("Please enter recipient email");
      return;
    }
    
    if (!email.includes('@')) {
      toast.error("Please enter a valid email");
      return;
    }
    
    setIsSending(true);
    
    try {
      const result = await sendInvite(selectedEvent, email, message);
      
      if (result.success) {
        setSelectedEvent("");
        setEmail("");
        setMessage("");
        setIsOpen(false);
        if (onSuccess) onSuccess();
      }
    } finally {
      setIsSending(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className="h-7 flex items-center gap-1">
          <Plus className="h-3.5 w-3.5 flex-shrink-0" /> 
          <span>Invite</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Send Event Invite</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="event">Select Event</Label>
            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger id="event">
                <SelectValue placeholder="Select an event" />
              </SelectTrigger>
              <SelectContent>
                {events.map((event) => (
                  <SelectItem key={event.id} value={event.id}>
                    {event.title} - {dayjs(event.startsAt).format('MMM D')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="email">Recipient Email</Label>
            <Input 
              id="email" 
              placeholder="example@domain.com" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="message">Message (Optional)</Label>
            <Textarea 
              id="message" 
              placeholder="Add a personal message..." 
              value={message} 
              onChange={(e) => setMessage(e.target.value)} 
            />
          </div>
        </div>
        <Button onClick={handleSend} className="w-full flex items-center justify-center gap-2" disabled={isSending}>
          {isSending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
              <span>Sending...</span>
            </>
          ) : (
            <>
              <Send className="h-4 w-4 flex-shrink-0" />
              <span>Send Invite</span>
            </>
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default InvitesModule;
