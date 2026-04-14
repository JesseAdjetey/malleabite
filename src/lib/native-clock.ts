/**
 * Android Clock app integration via Capacitor plugin.
 *
 * Only available on Android. On iOS, this gracefully no-ops.
 * Use `isAndroidClockAvailable()` to gate UI elements.
 */

import { Capacitor } from '@capacitor/core';

interface ClockPlugin {
  setAlarm(options: {
    hour: number;
    minutes: number;
    message?: string;
    vibrate?: boolean;
  }): Promise<{ success: boolean }>;
  setTimer(options: {
    seconds: number;
    message?: string;
  }): Promise<{ success: boolean }>;
}

function getClockPlugin(): ClockPlugin | null {
  if (!Capacitor.isNativePlatform()) return null;
  if (Capacitor.getPlatform() !== 'android') return null;
  try {
    return (Capacitor as any).Plugins?.Clock ?? null;
  } catch {
    return null;
  }
}

export function isAndroidClockAvailable(): boolean {
  return getClockPlugin() !== null;
}

/**
 * Opens the Android Clock app pre-filled to set an alarm.
 * @param hour     - 0–23
 * @param minutes  - 0–59
 * @param label    - Optional label shown in the Clock app
 */
export async function openAndroidAlarm(hour: number, minutes: number, label?: string): Promise<void> {
  const plugin = getClockPlugin();
  if (!plugin) {
    console.warn('[NativeClock] Android Clock plugin not available on this platform.');
    return;
  }
  await plugin.setAlarm({ hour, minutes, message: label });
}

/**
 * Opens the Android Clock app pre-filled to set a countdown timer.
 * @param seconds  - Total duration in seconds
 * @param label    - Optional label shown in the Clock app
 */
export async function openAndroidTimer(seconds: number, label?: string): Promise<void> {
  const plugin = getClockPlugin();
  if (!plugin) {
    console.warn('[NativeClock] Android Clock plugin not available on this platform.');
    return;
  }
  await plugin.setTimer({ seconds, message: label });
}
