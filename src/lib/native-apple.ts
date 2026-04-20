/**
 * TypeScript bridge for Apple Reminders + Calendar.
 * - On iOS (Capacitor): routes through the native AppleDataPlugin (EventKit).
 * - On macOS (Electron): routes through window.electronAPI (JXA/osascript).
 * - On web/Android: all methods gracefully no-op / return empty.
 */

import { Capacitor } from '@capacitor/core';

export interface AppleReminder {
  id: string;
  title: string;
  notes: string;
  isCompleted: boolean;
  dueDate?: string;        // ISO8601
  completionDate?: string; // ISO8601
  calendarId: string;
  calendarTitle: string;
}

export interface AppleReminderList {
  id: string;
  title: string;
}

export interface AppleCalendar {
  id: string;
  title: string;
  color: string;           // hex
  isSubscribed: boolean;
  allowsContentModifications: boolean;
}

export interface AppleEvent {
  id: string;
  title: string;
  notes: string;
  startDate: string;       // ISO8601
  endDate: string;         // ISO8601
  allDay: boolean;
  calendarId: string;
  calendarTitle: string;
  calendarColor: string;
}

// ─── Platform detection ───────────────────────────────────────────────────────

function getCapacitorPlugin(): any | null {
  if (!Capacitor.isNativePlatform()) return null;
  if (Capacitor.getPlatform() !== 'ios') return null;
  try {
    return (Capacitor as any).Plugins?.AppleData ?? null;
  } catch {
    return null;
  }
}

function getElectronAPI(): any | null {
  try {
    const api = (window as any).electronAPI;
    if (!api) return null;
    // Only available on macOS Electron
    if (api.platform !== 'darwin') return null;
    return api;
  } catch {
    return null;
  }
}

export function isAppleDataAvailable(): boolean {
  return getCapacitorPlugin() !== null || getElectronAPI() !== null;
}

// ─── Permissions ──────────────────────────────────────────────────────────────

export async function requestRemindersPermission(): Promise<boolean> {
  const electron = getElectronAPI();
  if (electron) {
    const result = await electron.requestRemindersPermission();
    return result.granted === true;
  }
  const plugin = getCapacitorPlugin();
  if (!plugin) return false;
  const result = await plugin.requestRemindersPermission();
  return result.granted === true;
}

export async function requestCalendarPermission(): Promise<boolean> {
  const electron = getElectronAPI();
  if (electron) {
    const result = await electron.requestCalendarPermission();
    return result.granted === true;
  }
  const plugin = getCapacitorPlugin();
  if (!plugin) return false;
  const result = await plugin.requestCalendarPermission();
  return result.granted === true;
}

// ─── Reminders ────────────────────────────────────────────────────────────────

export async function getAppleReminderLists(): Promise<AppleReminderList[]> {
  const electron = getElectronAPI();
  if (electron) {
    const result = await electron.getReminderLists();
    return result.lists ?? [];
  }
  const plugin = getCapacitorPlugin();
  if (!plugin) return [];
  const result = await plugin.getReminderLists?.();
  return result?.lists ?? [];
}

export async function getAppleReminders(listId?: string): Promise<AppleReminder[]> {
  const electron = getElectronAPI();
  if (electron) {
    const result = await electron.getReminders(listId);
    return result.reminders ?? [];
  }
  const plugin = getCapacitorPlugin();
  if (!plugin) return [];
  const result = await plugin.getReminders(listId ? { listId } : undefined);
  return result.reminders ?? [];
}

export async function createAppleReminder(params: {
  title: string;
  notes?: string;
  dueDate?: string;
  listId?: string;
  flagged?: boolean;
}): Promise<{ id: string; title: string; calendarId?: string } | null> {
  const electron = getElectronAPI();
  if (electron) {
    const result = await electron.createReminder(params);
    return result.reminder ?? null;
  }
  const plugin = getCapacitorPlugin();
  if (!plugin) return null;
  const result = await plugin.createReminder(params);
  return result.reminder ?? null;
}

export async function updateAppleReminder(params: {
  reminderId: string;
  title?: string;
  notes?: string;
  dueDate?: string;
}): Promise<AppleReminder | null> {
  const electron = getElectronAPI();
  if (electron) {
    const result = await electron.updateReminder(params);
    return result.reminder ?? null;
  }
  const plugin = getCapacitorPlugin();
  if (!plugin) return null;
  const result = await plugin.updateReminder(params);
  return result.reminder ?? null;
}

export async function deleteAppleReminder(reminderId: string): Promise<boolean> {
  const electron = getElectronAPI();
  if (electron) {
    const result = await electron.deleteReminder(reminderId);
    return result.deleted === true;
  }
  const plugin = getCapacitorPlugin();
  if (!plugin) return false;
  const result = await plugin.deleteReminder({ reminderId });
  return result.deleted === true;
}

export async function completeAppleReminder(reminderId: string): Promise<boolean> {
  const electron = getElectronAPI();
  if (electron) {
    const result = await electron.completeReminder(reminderId);
    return result.completed === true;
  }
  const plugin = getCapacitorPlugin();
  if (!plugin) return false;
  const result = await plugin.completeReminder({ reminderId });
  return result.completed === true;
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

export async function getAppleCalendars(): Promise<AppleCalendar[]> {
  const electron = getElectronAPI();
  if (electron) {
    const result = await electron.getCalendars();
    return result.calendars ?? [];
  }
  const plugin = getCapacitorPlugin();
  if (!plugin) return [];
  const result = await plugin.getCalendars();
  return result.calendars ?? [];
}

export async function getAppleEvents(startDate: string, endDate: string): Promise<AppleEvent[]> {
  const electron = getElectronAPI();
  if (electron) {
    const result = await electron.getEvents(startDate, endDate);
    return result.events ?? [];
  }
  const plugin = getCapacitorPlugin();
  if (!plugin) return [];
  const result = await plugin.getEvents({ startDate, endDate });
  return result.events ?? [];
}

export async function createAppleEvent(params: {
  title: string;
  startDate: string;
  endDate: string;
  notes?: string;
  allDay?: boolean;
  calendarId?: string;
}): Promise<AppleEvent | null> {
  const electron = getElectronAPI();
  if (electron) {
    const result = await electron.createEvent(params);
    return result.event ?? null;
  }
  const plugin = getCapacitorPlugin();
  if (!plugin) return null;
  const result = await plugin.createEvent(params);
  return result.event ?? null;
}

export async function updateAppleEvent(params: {
  eventId: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
}): Promise<AppleEvent | null> {
  const electron = getElectronAPI();
  if (electron) {
    // No direct updateEvent in electron bridge — use main process later
    return null;
  }
  const plugin = getCapacitorPlugin();
  if (!plugin) return null;
  const result = await plugin.updateEvent(params);
  return result.event ?? null;
}

export async function deleteAppleEvent(eventId: string): Promise<boolean> {
  const electron = getElectronAPI();
  if (electron) {
    const result = await electron.deleteEvent(eventId);
    return result.deleted === true;
  }
  const plugin = getCapacitorPlugin();
  if (!plugin) return false;
  const result = await plugin.deleteEvent({ eventId });
  return result.deleted === true;
}
