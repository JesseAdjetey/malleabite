import { logger } from '@/lib/logger';

const isPerfEnabled = import.meta.env.DEV || import.meta.env.VITE_CALENDAR_PERF_METRICS === 'true';
const lastLogByKey = new Map<string, number>();
const DEFAULT_THROTTLE_MS = 5000;

export function logCalendarPerf(
  key: string,
  metric: string,
  valueMs: number,
  metadata?: Record<string, unknown>,
  throttleMs: number = DEFAULT_THROTTLE_MS
): void {
  if (!isPerfEnabled) return;

  const now = Date.now();
  const last = lastLogByKey.get(key) ?? 0;
  if (now - last < throttleMs) return;

  lastLogByKey.set(key, now);
  logger.performance(metric, Number(valueMs.toFixed(2)), 'ms');

  if (metadata && Object.keys(metadata).length > 0) {
    logger.debug('CalendarPerf', `${metric} metadata`, metadata);
  }
}
