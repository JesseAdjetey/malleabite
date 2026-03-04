// Template Mode Store
// Manages the "template editing" mode where the calendar view is used
// to visually create/edit template events instead of real events.

import { create } from 'zustand';
import { CalendarEventType } from './types';
import { nanoid } from 'nanoid';

interface TemplateModeState {
  // Mode flags
  isTemplateMode: boolean;
  editingTemplateId: string | null; // null = creating new, string = editing existing

  // Template metadata
  templateName: string;
  templateDescription: string;

  // Draft events (visual on calendar, not persisted until save)
  draftEvents: CalendarEventType[];

  // Actions
  enterTemplateMode: (opts?: {
    templateId?: string;
    name?: string;
    description?: string;
    events?: CalendarEventType[];
  }) => void;
  exitTemplateMode: () => void;

  setTemplateName: (name: string) => void;
  setTemplateDescription: (desc: string) => void;

  addDraftEvent: (event: CalendarEventType) => void;
  updateDraftEvent: (event: CalendarEventType) => void;
  deleteDraftEvent: (id: string) => void;
  clearDraftEvents: () => void;
}

export const useTemplateModeStore = create<TemplateModeState>()((set) => ({
  isTemplateMode: false,
  editingTemplateId: null,
  templateName: '',
  templateDescription: '',
  draftEvents: [],

  enterTemplateMode: (opts) =>
    set({
      isTemplateMode: true,
      editingTemplateId: opts?.templateId ?? null,
      templateName: opts?.name ?? '',
      templateDescription: opts?.description ?? '',
      draftEvents: opts?.events ?? [],
    }),

  exitTemplateMode: () =>
    set({
      isTemplateMode: false,
      editingTemplateId: null,
      templateName: '',
      templateDescription: '',
      draftEvents: [],
    }),

  setTemplateName: (name) => set({ templateName: name }),
  setTemplateDescription: (desc) => set({ templateDescription: desc }),

  addDraftEvent: (event) =>
    set((state) => ({
      draftEvents: [...state.draftEvents, { ...event, id: event.id || nanoid() }],
    })),

  updateDraftEvent: (event) =>
    set((state) => ({
      draftEvents: state.draftEvents.map((e) => (e.id === event.id ? { ...e, ...event } : e)),
    })),

  deleteDraftEvent: (id) =>
    set((state) => ({
      draftEvents: state.draftEvents.filter((e) => e.id !== id),
    })),

  clearDraftEvents: () => set({ draftEvents: [] }),
}));
