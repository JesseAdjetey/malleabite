// Calendar Filter Bridge Hook
// Syncs ConnectedCalendar data from Firestore into the existing
// useCalendarFilterStore so the MonthView/WeekView/DayView filtering
// works automatically without modifying those components.

import { useEffect, useRef } from 'react';
import { useCalendarGroups } from '@/hooks/use-calendar-groups';
import { useCalendarPreferences } from '@/hooks/use-calendar-preferences';
import { useTemplateEventsLoader, templateCalendarId } from '@/hooks/use-template-events-loader';
import {
  useCalendarFilterStore,
  CalendarAccount,
  PERSONAL_CALENDAR_ID,
} from '@/lib/stores/calendar-filter-store';
import { ConnectedCalendar } from '@/types/calendar';

/**
 * Mount this hook once at a high level (e.g. Mainview).
 * It watches connected calendars and preferences, then keeps
 * the legacy calendar-filter-store in sync so existing views
 * continue to filter events correctly.
 */
export function useCalendarFilterBridge() {
  const { calendars, loading: groupsLoading } = useCalendarGroups();
  const { visibleCalendars, loading: prefsLoading } = useCalendarPreferences();
  const { templates, loading: templatesLoading } = useTemplateEventsLoader();

  const filterStore = useCalendarFilterStore;
  const prevCalendarIdsRef = useRef<string[]>([]);
  const prevVisibleRef = useRef<string[]>([]);

  // ─── Sync connected calendars → filter store accounts ─────────────────

  useEffect(() => {
    if (groupsLoading) return;

    const { accounts, addAccount, removeAccount, updateAccount, setCalendarVisible } = filterStore.getState();

    // Build a set of current connected calendar IDs
    const connectedIds = new Set(calendars.map(c => c.id));
    const existingIds = new Set(accounts.map(a => a.id));

    // Snapshot current preferences so newly added accounts get the right
    // visibility immediately — without waiting for the visibility useEffect to run.
    const visibleSet = new Set(visibleCalendars);
    const hasPrefs = visibleCalendars.length > 0 || prevVisibleRef.current.length > 0;

    // Add new calendars that aren't in the filter store yet
    calendars.forEach((cal: ConnectedCalendar) => {
      if (!existingIds.has(cal.id)) {
        const account: CalendarAccount = {
          id: cal.id,
          name: cal.name,
          color: cal.color,
          visible: cal.isActive,
          isDefault: false,
          isGoogle: cal.source === 'google',
        };
        addAccount(account);
        // Apply saved preferences to this new account immediately if available.
        // Without this, we'd have to wait for the visibility useEffect to re-run.
        if (!prefsLoading && hasPrefs) {
          setCalendarVisible(cal.id, visibleSet.has(cal.id));
        }
      } else {
        // Update existing account metadata (name, color) — never touch visibility here.
        // Visibility is owned exclusively by the preferences useEffect below.
        updateAccount(cal.id, {
          name: cal.name,
          color: cal.color,
          isGoogle: cal.source === 'google',
        });
      }
    });

    // Remove accounts that no longer exist as connected calendars
    // (but keep the Personal calendar)
    const prevIds = prevCalendarIdsRef.current;
    prevIds.forEach(id => {
      if (!connectedIds.has(id) && id !== PERSONAL_CALENDAR_ID) {
        removeAccount(id);
      }
    });

    prevCalendarIdsRef.current = Array.from(connectedIds);
  }, [calendars, groupsLoading, visibleCalendars, prefsLoading, filterStore]);

  // ─── Sync templates → filter store accounts ───────────────────────────

  useEffect(() => {
    if (templatesLoading) return;

    const { accounts, addAccount, updateAccount, removeAccount } = filterStore.getState();

    const templateIds = new Set(templates.map(t => templateCalendarId(t.id)));
    const existingIds = new Set(accounts.map(a => a.id));

    // Add/update template accounts
    templates.forEach(tmpl => {
      const calId = templateCalendarId(tmpl.id);
      const color = tmpl.events[0]?.color || '#8B5CF6';
      if (!existingIds.has(calId)) {
        addAccount({
          id: calId,
          name: `📋 ${tmpl.name}`,
          color,
          visible: tmpl.isActive,
          isDefault: false,
          isGoogle: false,
        });
      } else {
        updateAccount(calId, {
          name: `📋 ${tmpl.name}`,
          color,
          visible: tmpl.isActive,
        });
      }
    });

    // Remove stale template accounts (templates that were deleted)
    accounts.forEach(a => {
      if (a.id.startsWith('template_') && !templateIds.has(a.id)) {
        removeAccount(a.id);
      }
    });
  }, [templates, templatesLoading, filterStore]);

  // ─── Sync visibility preferences → filter store hidden set ────────────
  // IMPORTANT: Do NOT add `calendars` to this dependency array.
  // `toggleCalendar()` updates ConnectedCalendar.isActive in Firestore, which
  // causes `calendars` to update before the preferences Firestore save completes
  // (the prefs save has a 300ms debounce). If `calendars` were a dep here, this
  // effect would re-run with stale preferences and revert the optimistic toggle,
  // causing the visible flicker (off → on → off) the user sees.
  // Newly added calendars are handled in the accounts useEffect above.

  useEffect(() => {
    if (prefsLoading || groupsLoading) return;

    const { accounts, setCalendarVisible } = filterStore.getState();
    const visibleSet = new Set(visibleCalendars);
    const hadVisibilityPrefsBefore = prevVisibleRef.current.length > 0;

    // Keep legacy behavior on first load (empty prefs + no history => show all).
    // Once the user has toggled anything in this session, an empty list means
    // "hide all" — not "no preferences set".
    const hasPreferences = visibleCalendars.length > 0 || hadVisibilityPrefsBefore;

    accounts.forEach(account => {
      const shouldBeVisible = hasPreferences
        ? visibleSet.has(account.id)
        : true;

      // setCalendarVisible is idempotent — safe to call even if already correct.
      setCalendarVisible(account.id, shouldBeVisible);
    });

    prevVisibleRef.current = visibleCalendars;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCalendars, prefsLoading, groupsLoading, filterStore]);
}
