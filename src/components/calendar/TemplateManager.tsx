// TemplateManager - Create and manage calendar templates.
// V2: Uses visual calendar-based template creation (template mode on the main view).
// The old form-based editor is replaced by entering template editing mode
// directly on the week/day view where users can create events visually.

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Trash2,
  Pencil,
  Calendar,
  X,
  Layers,
  ChevronRight,
  FolderOpen,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.unified';
import {
  CalendarTemplate,
  CalendarGroup,
  ConnectedCalendar,
} from '@/types/calendar';
import * as calendarService from '@/lib/services/calendarService';
import { useTemplateModeStore } from '@/lib/stores/template-mode-store';
import { useCalendarEvents } from '@/hooks/use-calendar-events.unified';
import { springs } from '@/lib/animations';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { nanoid } from 'nanoid';
import { CalendarEventType } from '@/lib/stores/types';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Template Manager ───────────────────────────────────────────────────

interface TemplateManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const TemplateManager: React.FC<TemplateManagerProps> = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<CalendarTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Group selection state for applying templates
  const [groups, setGroups] = useState<CalendarGroup[]>([]);
  const [calendars, setCalendars] = useState<ConnectedCalendar[]>([]);
  const [applyingTemplate, setApplyingTemplate] = useState<CalendarTemplate | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const enterTemplateMode = useTemplateModeStore(s => s.enterTemplateMode);
  const { addEvent: persistEvent } = useCalendarEvents();

  // Load templates + groups + calendars
  const loadTemplates = useCallback(async () => {
    if (!user?.uid) return;
    setLoading(true);
    const [data, grps, cals] = await Promise.all([
      calendarService.getCalendarTemplates(user.uid),
      calendarService.getCalendarGroups(user.uid),
      calendarService.getConnectedCalendars(user.uid),
    ]);
    setTemplates(data);
    setGroups(grps);
    setCalendars(cals);
    setLoading(false);
  }, [user?.uid]);

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open, loadTemplates]);

  // ─── Create Template (enters visual template mode) ────────────────────

  const handleCreate = () => {
    onOpenChange(false); // Close the dialog
    // Enter template mode — calendar views will intercept event saves
    enterTemplateMode({ name: '' });
    toast.info('Template mode active — add events to your calendar, then save');
  };

  // ─── Edit Template (enter template mode with existing events loaded) ──

  const handleEdit = (template: CalendarTemplate) => {
    onOpenChange(false);

    // Convert CalendarTemplateEvent[] → CalendarEventType[] for display
    const today = dayjs();
    const startOfWeek = today.startOf('week');

    const draftEvents: CalendarEventType[] = template.events.map((tmplEvt) => {
      const eventDay = startOfWeek.add(tmplEvt.dayOfWeek, 'day');
      const [sh, sm] = (tmplEvt.startTime || '09:00').split(':').map(Number);
      const [eh, em] = (tmplEvt.endTime || '10:00').split(':').map(Number);

      // Restore recurrence data from the template event
      const recurrenceRule = tmplEvt.recurrenceRule || {
        frequency: 'weekly' as const,
        interval: 1,
        daysOfWeek: [tmplEvt.dayOfWeek],
      };

      return {
        id: nanoid(),
        title: tmplEvt.title,
        description: tmplEvt.description || '',
        startsAt: eventDay.hour(sh).minute(sm).second(0).toISOString(),
        endsAt: eventDay.hour(eh).minute(em).second(0).toISOString(),
        color: tmplEvt.color || '#8B5CF6',
        date: eventDay.format('YYYY-MM-DD'),
        timeStart: tmplEvt.startTime,
        timeEnd: tmplEvt.endTime,
        isAllDay: tmplEvt.isAllDay || false,
        isRecurring: tmplEvt.isRecurring !== false,
        recurrenceRule,
      };
    });

    enterTemplateMode({
      templateId: template.id,
      name: template.name,
      description: template.description || '',
      events: draftEvents,
    });

    toast.info(`Editing template "${template.name}" — modify events, then save`);
  };

  // ─── Apply Template — Step 1: Show group picker ──────────────────────

  const handleApplyClick = (template: CalendarTemplate) => {
    // Pre-select the template's saved group or the first available group
    const defaultGroupId = template.targetGroupId || groups.find(g => g.name.toLowerCase() === 'personal')?.id || groups[0]?.id || null;
    setSelectedGroupId(defaultGroupId);
    setApplyingTemplate(template);
  };

  // ─── Apply Template — Step 2: Confirm and create events ───────────────

  const handleApplyConfirm = async () => {
    if (!applyingTemplate || !selectedGroupId || !user?.uid) return;

    // Find a calendar in the selected group to assign events to
    const calendar = calendars.find(c => c.groupId === selectedGroupId && c.isActive);
    const calendarId = calendar?.id || undefined;

    const today = dayjs();
    const startOfWeek = today.startOf('week');
    let created = 0;

    for (const tmplEvent of applyingTemplate.events) {
      const eventDay = startOfWeek.add(tmplEvent.dayOfWeek, 'day');
      if (eventDay.isBefore(today, 'day')) continue;

      const [sh, sm] = (tmplEvent.startTime || '09:00').split(':').map(Number);
      const [eh, em] = (tmplEvent.endTime || '10:00').split(':').map(Number);

      const startsAt = eventDay.hour(sh).minute(sm).second(0).toISOString();
      const endsAt = eventDay.hour(eh).minute(em).second(0).toISOString();

      // Use the recurrence rule stored on the template event,
      // or default to weekly on the event's day
      const recurrenceRule = tmplEvent.recurrenceRule || {
        frequency: 'weekly' as const,
        interval: 1,
        daysOfWeek: [tmplEvent.dayOfWeek],
      };
      const isRecurring = tmplEvent.isRecurring !== false; // default true

      const event: CalendarEventType = {
        id: nanoid(),
        title: tmplEvent.title,
        description: tmplEvent.description || `From template: ${applyingTemplate.name}`,
        startsAt,
        endsAt,
        color: tmplEvent.color || '#8B5CF6',
        date: eventDay.format('YYYY-MM-DD'),
        timeStart: tmplEvent.startTime,
        timeEnd: tmplEvent.endTime,
        calendarId,
        isRecurring,
        recurrenceRule,
      };

      await persistEvent(event);
      created++;
    }

    // Remember the selected group on the template for next time
    if (applyingTemplate.targetGroupId !== selectedGroupId) {
      try {
        await calendarService.updateCalendarTemplate(user.uid, applyingTemplate.id, {
          targetGroupId: selectedGroupId,
        });
        // Update local state
        setTemplates(prev => prev.map(t =>
          t.id === applyingTemplate.id ? { ...t, targetGroupId: selectedGroupId } : t
        ));
      } catch {
        // Non-critical — group preference just won't be saved
      }
    }

    setApplyingTemplate(null);
    setSelectedGroupId(null);

    if (created > 0) {
      const groupName = groups.find(g => g.id === selectedGroupId)?.name || 'selected group';
      toast.success(`Applied ${created} event${created !== 1 ? 's' : ''} from "${applyingTemplate.name}" to ${groupName}`);
    } else {
      toast.info('No upcoming events to apply from this template');
    }
  };

  // ─── Delete Template ──────────────────────────────────────────────────

  const handleDelete = async (templateId: string) => {
    if (!user?.uid) return;
    await calendarService.deleteCalendarTemplate(user.uid, templateId);
    toast.success('Template deleted');
    setTemplates(prev => prev.filter(t => t.id !== templateId));
    setConfirmDeleteId(null);
  };

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[70vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-title3">Calendar Templates</DialogTitle>
          <DialogDescription>
            Create templates visually on your calendar, then apply them anytime.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-2 py-2">
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Loading templates...
              </div>
            ) : templates.length === 0 ? (
              <div className="py-8 text-center">
                <Layers size={28} className="mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground mb-1">No templates yet.</p>
                <p className="text-[11px] text-muted-foreground/60 mb-4 max-w-[200px] mx-auto">
                  Create a template by adding events visually on your calendar.
                </p>
                <Button size="sm" onClick={handleCreate} className="gap-1.5">
                  <Plus size={14} />
                  Create Template
                </Button>
              </div>
            ) : (
              <AnimatePresence>
                {templates.map(tmpl => (
                  <motion.div
                    key={tmpl.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={springs.gentle}
                    className="border border-border/50 rounded-xl p-3 hover:border-border/80 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Calendar size={14} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold truncate">{tmpl.name}</div>
                        {tmpl.description && (
                          <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {tmpl.description}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-2 flex-wrap">
                          <span>{tmpl.events.length} event{tmpl.events.length !== 1 ? 's' : ''}</span>
                          {tmpl.events.slice(0, 3).map((evt, i) => (
                            <span key={i} className="inline-flex items-center gap-0.5">
                              <span
                                className="w-1.5 h-1.5 rounded-full inline-block"
                                style={{ backgroundColor: evt.color || '#8B5CF6' }}
                              />
                              {DAY_SHORT[evt.dayOfWeek]}
                            </span>
                          ))}
                          {tmpl.events.length > 3 && (
                            <span className="text-muted-foreground/40">+{tmpl.events.length - 3}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Add to Calendar */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-primary/60 hover:text-primary"
                          onClick={() => handleApplyClick(tmpl)}
                          title="Add to calendar"
                        >
                          <Plus size={13} />
                        </Button>
                        {/* Edit (enters template mode) */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEdit(tmpl)}
                          title="Edit on calendar"
                        >
                          <Pencil size={13} />
                        </Button>
                        {/* Delete with confirm */}
                        {confirmDeleteId === tmpl.id ? (
                          <div className="flex items-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(tmpl.id)}
                            >
                              <Trash2 size={13} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setConfirmDeleteId(null)}
                            >
                              <X size={13} />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive/60 hover:text-destructive"
                            onClick={() => setConfirmDeleteId(tmpl.id)}
                          >
                            <Trash2 size={13} />
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleCreate} className="gap-1.5">
            <Plus size={14} />
            New Template
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* ─── Group Selection Dialog (shown when applying a template) ────── */}
      <Dialog open={!!applyingTemplate} onOpenChange={(v) => { if (!v) { setApplyingTemplate(null); setSelectedGroupId(null); } }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-title3">Add to Calendar</DialogTitle>
            <DialogDescription>
              Choose which group to add the events from &ldquo;{applyingTemplate?.name}&rdquo; to.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 py-2">
            {groups.map((group) => {
              const isSelected = selectedGroupId === group.id;
              const calCount = calendars.filter(c => c.groupId === group.id).length;
              return (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroupId(group.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all
                    ${isSelected
                      ? 'bg-primary/10 border border-primary/30 ring-1 ring-primary/20'
                      : 'border border-border/50 hover:border-border/80 hover:bg-muted/30'
                    }`}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: group.color + '20' }}
                  >
                    <FolderOpen size={14} style={{ color: group.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{group.name}</div>
                    <div className="text-[10px] text-muted-foreground/60">
                      {calCount} calendar{calCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                  {isSelected && (
                    <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                  )}
                </button>
              );
            })}
            {groups.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No groups found.</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => { setApplyingTemplate(null); setSelectedGroupId(null); }}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!selectedGroupId}
              onClick={handleApplyConfirm}
              className="gap-1.5"
            >
              <Plus size={13} />
              Add to Calendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

export default TemplateManager;
