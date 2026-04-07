import React, { useState, useEffect, useRef } from 'react';
import ModuleContainer from './ModuleContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Copy, Plus, Clock, Loader2, Link2, Power, Trash2, Users,
  Calendar, ChevronRight, Share2, MessageCircle, Mail, X, Check, Sparkles,
} from 'lucide-react';
import { useAppointmentScheduling, BookingPageFormData } from '@/hooks/use-appointment-scheduling';
import { useGroupMeets, CreateGroupMeetData } from '@/hooks/use-group-meets';
import { GroupMeetSession, GroupMeetSlot } from '@/lib/stores/types';
import { useCalendarFilterStore } from '@/lib/stores/calendar-filter-store';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { useModuleSize } from '@/contexts/ModuleSizeContext';
import { cn } from '@/lib/utils';

interface BookingModuleProps {
  title?: string;
  onRemove?: () => void;
  onTitleChange?: (title: string) => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
  isDragging?: boolean;
  instanceId?: string;
  moveTargets?: { id: string; title: string }[];
  onMoveToPage?: (pageId: string) => void;
  onShare?: () => void;
  isReadOnly?: boolean;
  contentReadOnly?: boolean;
}

// ─── Share Sheet ──────────────────────────────────────────────────────────────

const ShareSheet: React.FC<{ sessionId: string; title: string; organizerName: string; onClose: () => void }> = ({
  sessionId, title, organizerName, onClose,
}) => {
  const url = `${window.location.origin}/meet/${sessionId}`;
  const message = `Hey! ${organizerName} is trying to schedule "${title}". Takes 10 seconds to fill in your availability: ${url}`;

  const copy = () => {
    navigator.clipboard.writeText(url);
    toast.success('Link copied!');
  };

  const whatsapp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
  };

  const email = () => {
    window.open(
      `mailto:?subject=${encodeURIComponent(`Scheduling: ${title}`)}&body=${encodeURIComponent(message)}`,
      '_blank'
    );
  };

  return (
    <div className="space-y-3 p-3 rounded-lg bg-muted/50 border border-border/50">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Share link</p>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-2 bg-background rounded-md px-2 py-1.5 border border-border/50">
        <span className="text-xs text-muted-foreground truncate flex-1">{url}</span>
        <button onClick={copy} className="text-muted-foreground hover:text-foreground shrink-0">
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={whatsapp}>
          <MessageCircle className="h-3.5 w-3.5 text-green-500" />
          WhatsApp
        </Button>
        <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={email}>
          <Mail className="h-3.5 w-3.5" />
          Email
        </Button>
      </div>
    </div>
  );
};

// ─── Group Meet Item ──────────────────────────────────────────────────────────

const GroupMeetItem: React.FC<{
  session: GroupMeetSession;
  isOrganizer: boolean;
  onConfirm: (slot: GroupMeetSlot) => void;
  onShare: () => void;
  onAddParticipant: (name: string, email: string) => void;
}> = ({ session, isOrganizer, onConfirm, onShare, onAddParticipant }) => {
  const [expanded, setExpanded] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showSlotPicker, setShowSlotPicker] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  const respondedCount = session.participants.filter(p => p.responded).length;
  const totalCount = session.participants.length;

  const statusColor = {
    collecting: 'text-amber-600 dark:text-yellow-500',
    confirmed: 'text-green-600 dark:text-green-500',
    expired: 'text-muted-foreground',
    cancelled: 'text-red-600 dark:text-red-500',
  }[session.status];

  const handleInvite = () => {
    if (!inviteEmail.includes('@')) return;
    onAddParticipant(inviteName, inviteEmail);
    setInviteName('');
    setInviteEmail('');
    setShowInvite(false);
  };

  return (
    <div className="rounded-lg bg-muted/50 hover:bg-muted border border-border/40 transition-colors">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 p-2 text-left text-foreground"
      >
        <Users className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{session.title}</p>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {session.duration}min
            {session.status === 'confirmed' && session.confirmedSlot ? (
              <span className="text-green-500 font-medium">
                · {dayjs(session.confirmedSlot.start).format('ddd D MMM, h:mma')}
              </span>
            ) : session.autoConfirm && session.confirmedSlot ? (
              <span className="text-purple-400 font-medium">
                · Auto: {dayjs(session.confirmedSlot.start).format('ddd D MMM, h:mma')}
              </span>
            ) : (
              <span className={statusColor}>
                · {totalCount > 0 ? `${respondedCount}/${totalCount} responded` : 'No invitees yet'}
              </span>
            )}
          </div>
        </div>
        <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="px-2 pb-2 space-y-2">
          {/* Participants */}
          {session.participants.length > 0 && (
            <div className="space-y-1">
              {session.participants.map(p => (
                <div key={p.id} className="flex items-center gap-2 text-xs">
                  <div className={`h-1.5 w-1.5 rounded-full ${p.responded ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                  <span className="truncate text-muted-foreground">{p.name || p.email}</span>
                  {p.responded && <Check className="h-3 w-3 text-green-500 ml-auto shrink-0" />}
                </div>
              ))}
            </div>
          )}

          {/* Invite more inline form */}
          {showInvite && session.status === 'collecting' && (
            <div className="space-y-1.5">
              <div className="flex gap-1.5">
                <Input
                  value={inviteName}
                  onChange={e => setInviteName(e.target.value)}
                  placeholder="Name"
                  className="h-7 text-xs flex-1"
                />
                <Input
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="Email"
                  className="h-7 text-xs flex-1"
                  type="email"
                  onKeyDown={e => e.key === 'Enter' && handleInvite()}
                />
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" variant="ghost" className="h-7 flex-1 text-xs" onClick={() => setShowInvite(false)}>Cancel</Button>
                <Button size="sm" className="h-7 flex-1 text-xs" onClick={handleInvite} disabled={!inviteEmail.includes('@')}>Add</Button>
              </div>
            </div>
          )}

          {/* Invite + Share — visible to all members of the session */}
          <div className="flex flex-wrap gap-1.5">
            {!showInvite && (
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 text-foreground border-border" onClick={() => { setShowInvite(true); setShowSlotPicker(false); }}>
                <Plus className="h-3 w-3" /> Invite
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 text-foreground border-border" onClick={onShare}>
              <Share2 className="h-3 w-3" /> Share link
            </Button>
            {/* Pick time — organizer only */}
            {isOrganizer && session.status === 'collecting' && session.proposedSlots.length > 0 && !showSlotPicker && (
              <Button size="sm" className="h-7 px-2 text-xs" onClick={() => { setShowSlotPicker(true); setShowInvite(false); }}>
                Pick time ({session.proposedSlots.length})
              </Button>
            )}
          </div>

          {/* Slot picker — organizer only, while collecting */}
          {isOrganizer && session.status === 'collecting' && showSlotPicker && (
            <div className="space-y-1 mt-0.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground font-medium">Select a time to confirm:</p>
                <button onClick={() => setShowSlotPicker(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </div>
              {session.proposedSlots.slice(0, 6).map(slot => {
                const rc = session.participants.filter(p => p.responded).length;
                const allFree = rc > 0 && slot.votes === rc;
                return (
                  <button
                    key={slot.start}
                    onClick={() => { onConfirm(slot); setShowSlotPicker(false); }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left border transition-colors ${
                      allFree
                        ? 'border-green-500/40 bg-green-500/5 hover:bg-green-500/10 text-foreground'
                        : 'border-border/40 hover:bg-muted/60 text-muted-foreground'
                    }`}
                  >
                    <span className="flex-1">{dayjs(slot.start).format('ddd D MMM, h:mma')}</span>
                    <span className={`text-[10px] font-semibold px-1 rounded ${allFree ? 'text-green-500' : 'text-amber-500'}`}>
                      {slot.votes}/{rc}
                    </span>
                    {allFree && <Check className="h-3 w-3 text-green-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Auto-pick indicator — updates live as more people respond */}
          {session.autoConfirm && session.status === 'collecting' && session.confirmedSlot && (
            <div className="flex items-center gap-1.5 text-xs text-purple-400">
              <Sparkles className="h-3 w-3 shrink-0" />
              Auto-pick · {dayjs(session.confirmedSlot.start).format('ddd MMM D, h:mma')}
            </div>
          )}

          {/* Manually confirmed */}
          {session.status === 'confirmed' && session.confirmedSlot && (
            <div className="flex items-center gap-1.5 text-xs text-green-500 font-medium">
              <Check className="h-3.5 w-3.5" />
              Confirmed · {dayjs(session.confirmedSlot.start).format('ddd MMM D, h:mma')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── New Group Meet Form ──────────────────────────────────────────────────────

interface NewGroupMeetFormProps {
  instanceId: string;
  organizerName: string;
  onDone: (sessionId: string, title: string) => void;
  onCancel: () => void;
}

const NewGroupMeetForm: React.FC<NewGroupMeetFormProps> = ({ instanceId, onDone, onCancel }) => {
  const { createGroupMeet } = useGroupMeets(instanceId);
  // Get all calendars from the filter store (includes Personal + all connected Google calendars)
  // Deduplicate by ID to avoid showing the same calendar twice (two sync paths can both add same calendar)
  const rawCalendars = useCalendarFilterStore(s => s.accounts);
  const allCalendars = rawCalendars.filter((cal, idx, arr) => arr.findIndex(c => c.id === cal.id) === idx);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('30');
  const [window, setWindow] = useState('week');
  const [locationType, setLocationType] = useState<'video' | 'in_person' | 'phone'>('video');
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [participants, setParticipants] = useState<{ name: string; email: string }[]>([]);
  const [creating, setCreating] = useState(false);
  // Start with [] so calendarIds=undefined (all events queried) before calendars load.
  // Once allCalendars loads, pre-select every calendar so all events are checked by default.
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const calendarInitialized = useRef(false);
  useEffect(() => {
    if (!calendarInitialized.current && allCalendars.length > 0) {
      calendarInitialized.current = true;
      setSelectedCalendarIds(allCalendars.map(c => c.id));
    }
  }, [allCalendars]);

  const toggleCalendar = (id: string) => {
    setSelectedCalendarIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const addParticipant = () => setParticipants(p => [...p, { name: '', email: '' }]);
  const removeParticipant = (i: number) => setParticipants(p => p.filter((_, idx) => idx !== i));
  const updateParticipant = (i: number, field: 'name' | 'email', value: string) => {
    setParticipants(p => p.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  };

  const getWindow = () => {
    const start = dayjs().toISOString();
    const end = window === '3days'
      ? dayjs().add(3, 'day').endOf('day').toISOString()
      : window === 'week'
      ? dayjs().add(7, 'day').endOf('day').toISOString()
      : dayjs().add(14, 'day').endOf('day').toISOString();
    return { start, end };
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    const validParticipants = participants.filter(p => p.email.includes('@'));
    setCreating(true);
    try {
      const data: CreateGroupMeetData = {
        title: title.trim(),
        duration: parseInt(duration),
        window: getWindow(),
        locationType,
        participants: validParticipants,
        autoConfirm,
        moduleInstanceId: instanceId,
        calendarIds: selectedCalendarIds.length > 0 ? selectedCalendarIds : undefined,
      };
      const session = await createGroupMeet(data);
      if (session) {
        onDone(session.id, session.title);
        toast.success('Group meeting created');
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-3 p-3 rounded-lg bg-muted/50 border border-border/50">
      <div>
        <Label className="text-xs">Meeting title</Label>
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Team catch-up"
          className="h-8 mt-1 text-sm"
        />
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs">Duration</Label>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger className="h-8 mt-1 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {['15', '30', '45', '60', '90'].map(d => (
                <SelectItem key={d} value={d}>{d} min</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <Label className="text-xs">Window</Label>
          <Select value={window} onValueChange={setWindow}>
            <SelectTrigger className="h-8 mt-1 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3days">Next 3 days</SelectItem>
              <SelectItem value="week">This week</SelectItem>
              <SelectItem value="2weeks">Next 2 weeks</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <Label className="text-xs">Location</Label>
          <Select value={locationType} onValueChange={v => setLocationType(v as any)}>
            <SelectTrigger className="h-8 mt-1 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="video">Video</SelectItem>
              <SelectItem value="in_person">In person</SelectItem>
              <SelectItem value="phone">Phone</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 flex flex-col justify-end">
          <button
            onClick={() => setAutoConfirm(a => !a)}
            className={`h-8 text-xs rounded-md border px-2 flex items-center gap-1.5 transition-colors ${
              autoConfirm ? 'border-primary/60 bg-primary/10 text-primary' : 'border-border/50 text-muted-foreground'
            }`}
          >
            <div className={`h-2 w-2 rounded-full ${autoConfirm ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
            Auto-confirm
          </button>
        </div>
      </div>

      {/* ── Calendar picker ── */}
      {allCalendars.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs">Check availability from</Label>
          <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5">
            {allCalendars.map(cal => {
              const checked = selectedCalendarIds.includes(cal.id);
              return (
                <button
                  key={cal.id}
                  type="button"
                  onClick={() => toggleCalendar(cal.id)}
                  className={`w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md border transition-colors ${
                    checked ? 'border-primary/40 bg-primary/5' : 'border-border/30 text-muted-foreground'
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ background: cal.color || '#6366f1' }}
                  />
                  <span className="flex-1 text-left truncate">{cal.name}</span>
                  <div className={`h-3.5 w-3.5 rounded border flex items-center justify-center ${
                    checked ? 'bg-primary border-primary' : 'border-border/60'
                  }`}>
                    {checked && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Participants <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <button onClick={addParticipant} className="text-xs text-primary hover:underline flex items-center gap-0.5">
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        {participants.map((p, i) => (
          <div key={i} className="flex gap-1.5">
            <Input
              value={p.name}
              onChange={e => updateParticipant(i, 'name', e.target.value)}
              placeholder="Name"
              className="h-7 text-xs flex-1"
            />
            <Input
              value={p.email}
              onChange={e => updateParticipant(i, 'email', e.target.value)}
              placeholder="Email"
              className="h-7 text-xs flex-1"
              type="email"
            />
            {participants.length > 1 && (
              <button onClick={() => removeParticipant(i)} className="text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={handleCreate}
          disabled={!title.trim() || creating}
        >
          {creating && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
          Create
        </Button>
      </div>
    </div>
  );
};

// ─── Main Module ──────────────────────────────────────────────────────────────

type CreateMode = 'page' | 'group_meet' | null;

const BookingModule: React.FC<BookingModuleProps> = ({
  title = 'Booking',
  onRemove,
  onTitleChange,
  onMinimize,
  isMinimized = false,
  isDragging = false,
  instanceId,
  moveTargets,
  onMoveToPage,
  onShare: onShareModule,
  isReadOnly,
  contentReadOnly,
}) => {
  const { user } = useAuth();
  const { sizeLevel } = useModuleSize();

  const {
    bookingPages,
    loading: pagesLoading,
    createBookingPage,
    deleteBookingPage,
    togglePageActive,
    copyBookingUrl,
  } = useAppointmentScheduling();

  const { sessions, confirmSlot, addParticipantToSession } = useGroupMeets(instanceId);

  const [createMode, setCreateMode] = useState<CreateMode>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDuration, setNewDuration] = useState('30');
  const [newLocationType, setNewLocationType] = useState<'video' | 'in_person' | 'phone' | 'custom'>('video');
  const [creatingPage, setCreatingPage] = useState(false);
  const [shareSessionId, setShareSessionId] = useState<string | null>(null);
  const [shareTitle, setShareTitle] = useState('');

  // Derive organizer name from auth — we pass this into the share sheet
  // We can't use useAuth here without prop drilling, so we read from the first session if available
  const organizerName = sessions[0]?.organizerName ?? 'Someone';

  const handleCreatePage = async () => {
    if (!newTitle.trim()) return;
    setCreatingPage(true);
    try {
      await createBookingPage({
        title: newTitle.trim(),
        duration: parseInt(newDuration),
        locationType: newLocationType,
      } as BookingPageFormData);
      setNewTitle('');
      setCreateMode(null);
    } catch {
      toast.error('Failed to create booking page');
    } finally {
      setCreatingPage(false);
    }
  };

  const handleGroupMeetDone = (sessionId: string, title: string) => {
    setCreateMode(null);
    setShareSessionId(sessionId);
    setShareTitle(title);
  };

  // Only block on booking pages loading — group meets load independently
  const loading = pagesLoading;
  const hasContent = bookingPages.length > 0 || sessions.length > 0;

  return (
    <ModuleContainer
      title={title}
      onRemove={onRemove}
      onTitleChange={onTitleChange}
      onMinimize={onMinimize}
      isMinimized={isMinimized}
      isDragging={isDragging}
      moveTargets={moveTargets}
      onMoveToPage={onMoveToPage}
      onShare={onShareModule}
      isReadOnly={isReadOnly}
    >
      <div className={cn("space-y-3 overflow-y-auto pr-0.5", sizeLevel >= 2 ? "flex-1 min-h-0 h-full" : "max-h-[420px]")}>
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !hasContent && !createMode && !shareSessionId ? (
          <div className="text-center py-4">
            <Calendar className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-3">No bookings yet</p>
            <div className="flex gap-2 justify-center flex-wrap">
              <Button size="sm" variant="outline" className="text-foreground" onClick={() => setCreateMode('page')}>
                <Link2 className="h-3.5 w-3.5 mr-1" /> Booking page
              </Button>
              <Button size="sm" onClick={() => setCreateMode('group_meet')}>
                <Users className="h-3.5 w-3.5 mr-1" /> Group meet
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* ── Booking Pages ── */}
            {bookingPages.map(page => (
              <div
                key={page.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted border border-border/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{page.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {page.duration}min
                    <Badge
                      variant={page.isActive ? 'default' : 'secondary'}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {page.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyBookingUrl(page)} title="Copy link">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => togglePageActive(page.id)} title={page.isActive ? 'Deactivate' : 'Activate'}>
                    <Power className={`h-3.5 w-3.5 ${page.isActive ? 'text-green-500' : 'text-muted-foreground'}`} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteBookingPage(page.id)} title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}

            {/* ── Group Meets ── */}
            {sessions.map(session => (
              <GroupMeetItem
                key={session.id}
                session={session}
                isOrganizer={user?.uid === session.organizerId}
                onConfirm={slot => confirmSlot(session.id, slot)}
                onShare={() => { setShareSessionId(session.id); setShareTitle(session.title); }}
                onAddParticipant={(name, email) => addParticipantToSession(session.id, { name, email })}
              />
            ))}

            {/* ── Add buttons ── */}
            {!createMode && !shareSessionId && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="flex-1 text-foreground" onClick={() => setCreateMode('page')}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Page
                </Button>
                <Button variant="outline" size="sm" className="flex-1 text-foreground" onClick={() => setCreateMode('group_meet')}>
                  <Users className="h-3.5 w-3.5 mr-1" /> Group meet
                </Button>
              </div>
            )}
          </>
        )}

        {/* ── Share sheet (shown after creating a group meet) ── */}
        {shareSessionId && (
          <ShareSheet
            sessionId={shareSessionId}
            title={shareTitle}
            organizerName={organizerName}
            onClose={() => setShareSessionId(null)}
          />
        )}

        {/* ── Create booking page form ── */}
        {createMode === 'page' && (
          <div className="space-y-3 p-3 rounded-lg bg-muted/50 border border-border/50">
            <div>
              <Label className="text-xs">Title</Label>
              <Input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="e.g. 30-Min Meeting"
                className="h-8 mt-1 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs">Duration</Label>
                <Select value={newDuration} onValueChange={setNewDuration}>
                  <SelectTrigger className="h-8 mt-1 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['15', '30', '45', '60'].map(d => (
                      <SelectItem key={d} value={d}>{d} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-xs">Type</Label>
                <Select value={newLocationType} onValueChange={v => setNewLocationType(v as any)}>
                  <SelectTrigger className="h-8 mt-1 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="in_person">In Person</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setCreateMode(null)}>Cancel</Button>
              <Button size="sm" className="flex-1" onClick={handleCreatePage} disabled={!newTitle.trim() || creatingPage}>
                {creatingPage && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                Create
              </Button>
            </div>
          </div>
        )}

        {/* ── Create group meet form ── */}
        {createMode === 'group_meet' && instanceId && (
          <NewGroupMeetForm
            instanceId={instanceId}
            organizerName={organizerName}
            onDone={handleGroupMeetDone}
            onCancel={() => setCreateMode(null)}
          />
        )}
        {createMode === 'group_meet' && !instanceId && (
          <p className="text-xs text-muted-foreground text-center py-2">
            Module needs to be saved first before creating group meets.
          </p>
        )}
      </div>
    </ModuleContainer>
  );
};

export default BookingModule;
