/**
 * SchedulingSettings
 *
 * iOS-style settings panel for conflict detection and rescheduling preferences.
 * Uses the same GroupedList / GroupedListItem pattern as the main Settings page.
 */
import React from 'react';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GroupedList, GroupedListHeader, GroupedListItem } from '@/components/ui/grouped-list';
import { useSettingsStore, type RescheduleMode, type ReschedulingPreferences } from '@/lib/stores/settings-store';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock, Zap, CalendarClock, BriefcaseBusiness } from 'lucide-react';

// ─── small inline row used for select + slider controls ─────────────────────

function SettingRow({
  label,
  sublabel,
  children,
}: {
  label: string;
  sublabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-separator/30 last:border-b-0">
      <div className="flex-1 pr-4 min-w-0">
        <div className="text-subheadline">{label}</div>
        {sublabel && (
          <div className="text-caption1 text-muted-foreground mt-0.5">{sublabel}</div>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Mode selector chip group ────────────────────────────────────────────────

const MODES: { value: RescheduleMode; label: string; description: string }[] = [
  { value: 'off',     label: 'Off',     description: 'No conflict detection' },
  { value: 'manual',  label: 'Manual',  description: 'Show glow, no prompts' },
  { value: 'suggest', label: 'Suggest', description: 'Show options sheet' },
  { value: 'auto',    label: 'Auto',    description: 'Move events silently' },
];

function ModeSelector({
  value,
  onChange,
}: {
  value: RescheduleMode;
  onChange: (v: RescheduleMode) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1 p-1 bg-muted rounded-xl">
      {MODES.map((m) => (
        <button
          key={m.value}
          onClick={() => onChange(m.value)}
          className={cn(
            'py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
            value === m.value
              ? 'bg-background shadow-sm text-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function SchedulingSettings() {
  const { reschedulingPrefs, setReschedulingPrefs } = useSettingsStore();
  const set = (patch: Partial<ReschedulingPreferences>) => setReschedulingPrefs(patch);

  const isOff = reschedulingPrefs.mode === 'off';

  const selectedMode = MODES.find((m) => m.value === reschedulingPrefs.mode);

  return (
    <div className="space-y-6">
      {/* ── Mode ── */}
      <div>
        <GroupedListHeader>Conflict Mode</GroupedListHeader>
        <GroupedList>
          <div className="px-4 py-3">
            <ModeSelector
              value={reschedulingPrefs.mode}
              onChange={(v) => set({ mode: v })}
            />
            {selectedMode && (
              <p className="text-caption1 text-muted-foreground mt-2 text-center">
                {selectedMode.description}
              </p>
            )}
          </div>
        </GroupedList>
      </div>

      {/* ── Buffer & gaps — hidden when off ── */}
      {!isOff && (
        <>
          <div>
            <GroupedListHeader>Buffers & Gaps</GroupedListHeader>
            <GroupedList>
              <SettingRow
                label="Min gap between events"
                sublabel="Warn when gap is shorter than this"
              >
                <Select
                  value={String(reschedulingPrefs.minBufferMinutes)}
                  onValueChange={(v) => set({ minBufferMinutes: Number(v) })}
                >
                  <SelectTrigger className="w-24 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 5, 10, 15, 30].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n === 0 ? 'None' : `${n} min`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              <SettingRow
                label="Travel time buffer"
                sublabel="Extra gap when event has a location"
              >
                <Select
                  value={String(reschedulingPrefs.travelTimeBuffer)}
                  onValueChange={(v) => set({ travelTimeBuffer: Number(v) })}
                >
                  <SelectTrigger className="w-24 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 5, 10, 15, 20, 30, 45, 60].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n === 0 ? 'None' : `${n} min`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              <SettingRow
                label="Focus block buffer"
                sublabel="Buffer before / after focus time blocks"
              >
                <Select
                  value={String(reschedulingPrefs.focusBlockBuffer)}
                  onValueChange={(v) => set({ focusBlockBuffer: Number(v) })}
                >
                  <SelectTrigger className="w-24 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 15, 30, 45, 60].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n === 0 ? 'None' : `${n} min`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              <SettingRow
                label="Max consecutive meetings"
                sublabel="Warn when this many back-to-back"
              >
                <Select
                  value={String(reschedulingPrefs.maxConsecutiveMeetings)}
                  onValueChange={(v) => set({ maxConsecutiveMeetings: Number(v) })}
                >
                  <SelectTrigger className="w-24 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 2, 3, 4, 5].map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n === 0 ? 'Off' : `${n}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>
            </GroupedList>
          </div>

          {/* ── Work hours ── */}
          <div>
            <GroupedListHeader>Work Hours</GroupedListHeader>
            <GroupedList>
              <SettingRow label="Day starts" sublabel="Used when finding open slots">
                <Select
                  value={String(reschedulingPrefs.workdayStart)}
                  onValueChange={(v) => set({ workdayStart: Number(v) })}
                >
                  <SelectTrigger className="w-24 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 13 }, (_, i) => i + 5).map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              <SettingRow label="Day ends">
                <Select
                  value={String(reschedulingPrefs.workdayEnd)}
                  onValueChange={(v) => set({ workdayEnd: Number(v) })}
                >
                  <SelectTrigger className="w-24 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 13 }, (_, i) => i + 12).map((h) => (
                      <SelectItem key={h} value={String(h)}>
                        {h < 12 ? `${h}:00 AM` : h === 12 ? '12:00 PM' : `${h - 12}:00 PM`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>

              <SettingRow label="Snap to interval" sublabel="Round rescheduled times">
                <Select
                  value={String(reschedulingPrefs.snapToMinutes)}
                  onValueChange={(v) => set({ snapToMinutes: Number(v) as 15 | 30 })}
                >
                  <SelectTrigger className="w-24 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                  </SelectContent>
                </Select>
              </SettingRow>
            </GroupedList>
          </div>

          {/* ── Auto mode options — only shown when auto ── */}
          {reschedulingPrefs.mode === 'auto' && (
            <div>
              <GroupedListHeader>Auto-Reschedule</GroupedListHeader>
              <GroupedList>
                <SettingRow
                  label="Move which event"
                  sublabel="When auto-resolving a conflict"
                >
                  <Select
                    value={reschedulingPrefs.autoRescheduleTarget}
                    onValueChange={(v) =>
                      set({ autoRescheduleTarget: v as ReschedulingPreferences['autoRescheduleTarget'] })
                    }
                  >
                    <SelectTrigger className="w-36 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newer_event">Newer event</SelectItem>
                      <SelectItem value="shorter_event">Shorter event</SelectItem>
                      <SelectItem value="lower_priority">Lower priority</SelectItem>
                    </SelectContent>
                  </Select>
                </SettingRow>

                <SettingRow
                  label="Search window"
                  sublabel="Days ahead to look for an open slot"
                >
                  <Select
                    value={String(reschedulingPrefs.autoSearchDays)}
                    onValueChange={(v) => set({ autoSearchDays: Number(v) })}
                  >
                    <SelectTrigger className="w-24 h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[3, 5, 7, 14, 30].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n} days
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </SettingRow>
              </GroupedList>
            </div>
          )}
        </>
      )}
    </div>
  );
}
