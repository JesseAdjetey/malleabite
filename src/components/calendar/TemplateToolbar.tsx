// TemplateToolbar — Floating toolbar shown when in template editing mode.
// Lets the user name the template, see draft event count, save, or cancel.

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTemplateModeStore } from '@/lib/stores/template-mode-store';
import { useAuth } from '@/contexts/AuthContext.unified';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { X, Save, Layers, Trash2 } from 'lucide-react';
import { springs } from '@/lib/animations';
import { toast } from 'sonner';
import * as calendarService from '@/lib/services/calendarService';
import { CalendarTemplateEvent } from '@/types/calendar';
import dayjs from 'dayjs';

const TemplateToolbar: React.FC = () => {
  const { user } = useAuth();
  const {
    isTemplateMode,
    editingTemplateId,
    templateName,
    templateDescription,
    draftEvents,
    setTemplateName,
    exitTemplateMode,
    clearDraftEvents,
  } = useTemplateModeStore();

  const [saving, setSaving] = useState(false);

  if (!isTemplateMode) return null;

  const handleSave = async () => {
    if (!user?.uid) return;
    if (!templateName.trim()) {
      toast.error('Please enter a template name');
      return;
    }
    if (draftEvents.length === 0) {
      toast.error('Add at least one event to the template');
      return;
    }

    setSaving(true);
    try {
      // Convert CalendarEventType → CalendarTemplateEvent
      // NOTE: Firestore rejects `undefined` values — use empty string or omit optional fields
      const templateEvents: CalendarTemplateEvent[] = draftEvents.map((evt) => {
        const start = dayjs(evt.startsAt);
        const end = dayjs(evt.endsAt);

        // Default to weekly recurrence on the event's day if no explicit rule
        const defaultRule = {
          frequency: 'weekly' as const,
          interval: 1,
          daysOfWeek: [start.day()],
        };
        const hasRecurrence = evt.isRecurring && evt.recurrenceRule;
        const recurrenceRule = hasRecurrence
          ? {
            frequency: evt.recurrenceRule!.frequency,
            interval: evt.recurrenceRule!.interval || 1,
            ...(evt.recurrenceRule!.daysOfWeek ? { daysOfWeek: evt.recurrenceRule!.daysOfWeek } : {}),
            ...(evt.recurrenceRule!.dayOfMonth ? { dayOfMonth: evt.recurrenceRule!.dayOfMonth } : {}),
            ...(evt.recurrenceRule!.monthOfYear !== undefined ? { monthOfYear: evt.recurrenceRule!.monthOfYear } : {}),
            ...(evt.recurrenceRule!.endDate ? { endDate: evt.recurrenceRule!.endDate } : {}),
            ...(evt.recurrenceRule!.count ? { count: evt.recurrenceRule!.count } : {}),
          }
          : defaultRule;

        const te: CalendarTemplateEvent = {
          title: evt.title || 'Untitled',
          dayOfWeek: start.day(), // 0 = Sunday
          startTime: start.format('HH:mm'),
          endTime: end.format('HH:mm'),
          color: evt.color || '#8B5CF6',
          isAllDay: evt.isAllDay || false,
          isRecurring: true, // Templates are always recurring by design
          recurrenceRule,
        };
        if (evt.description) te.description = evt.description;
        if ((evt as any).location) te.location = (evt as any).location;
        return te;
      });

      const templatePayload: Record<string, any> = {
        name: templateName.trim(),
        events: templateEvents,
        isActive: false,
      };
      if (templateDescription.trim()) {
        templatePayload.description = templateDescription.trim();
      }

      if (editingTemplateId) {
        await calendarService.updateCalendarTemplate(user.uid, editingTemplateId, templatePayload);
        toast.success('Template updated');
      } else {
        await calendarService.createCalendarTemplate(user.uid, templatePayload as any);
        toast.success('Template created');
      }

      exitTemplateMode();
    } catch (err) {
      console.error('Template save failed:', err);
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    exitTemplateMode();
  };

  const handleClearAll = () => {
    clearDraftEvents();
    toast.info('Cleared all draft events');
  };

  return (
    <AnimatePresence>
      {isTemplateMode && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={springs.snappy}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50
            bg-background/95 backdrop-blur-xl border border-primary/30
            rounded-2xl shadow-2xl shadow-primary/10
            px-4 py-3 flex items-center gap-3 min-w-[420px] max-w-[600px]"
        >
          {/* Template indicator */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Layers size={16} className="text-primary" />
            </div>
          </div>

          {/* Name input */}
          <Input
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Template name..."
            className="h-8 text-sm bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 px-2 flex-1 min-w-[120px] text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
            autoFocus
          />

          <Separator orientation="vertical" className="h-6" />

          {/* Event count badge */}
          <Badge variant="secondary" className="text-xs font-medium px-2.5 py-0.5 flex-shrink-0">
            {draftEvents.length} event{draftEvents.length !== 1 ? 's' : ''}
          </Badge>

          {/* Clear all */}
          {draftEvents.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
              onClick={handleClearAll}
            >
              <Trash2 size={14} />
            </Button>
          )}

          <Separator orientation="vertical" className="h-6" />

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-8 text-xs text-gray-900 dark:text-gray-100"
            >
              <X size={14} className="mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !templateName.trim() || draftEvents.length === 0}
              className="h-8 text-xs gap-1.5"
            >
              <Save size={14} />
              {saving ? 'Saving...' : editingTemplateId ? 'Update' : 'Save Template'}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TemplateToolbar;
