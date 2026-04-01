/**
 * Structured audit logger for Cloud Functions.
 * Logs are written to Google Cloud Logging automatically via console.log in JSON format.
 * Anomalies trigger console.error which routes to Cloud Error Reporting.
 *
 * To set up alerts:
 *   Google Cloud Console → Logging → Log-based Alerts → filter: jsonPayload.anomaly=true
 */

type AuditEvent =
  | 'auth.signin'
  | 'auth.signout'
  | 'auth.signup'
  | 'auth.failed'
  | 'api.request'
  | 'api.rate_limited'
  | 'data.read'
  | 'data.write'
  | 'data.delete'
  | 'anomaly.rapid_requests'
  | 'anomaly.multiple_failures'
  | 'anomaly.unauthorized_access';

interface AuditLog {
  event: AuditEvent;
  userId?: string;
  ip?: string;
  endpoint?: string;
  metadata?: Record<string, unknown>;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  anomaly?: boolean;
  timestamp: string;
}

// Per-function-instance counters for anomaly detection (resets on cold start)
const failureCounters = new Map<string, { count: number; windowStart: number }>();

const ANOMALY_THRESHOLDS = {
  authFailures: { max: 5, windowMs: 60_000 },    // 5 failed auths in 1 min
  rapidRequests: { max: 50, windowMs: 60_000 },  // 50 requests in 1 min
};

export function auditLog(event: AuditEvent, details: Omit<AuditLog, 'event' | 'timestamp' | 'severity'> & { severity?: AuditLog['severity'] }) {
  const log: AuditLog = {
    event,
    severity: details.severity ?? 'INFO',
    timestamp: new Date().toISOString(),
    ...details,
  };

  if (log.anomaly || log.severity === 'CRITICAL' || log.severity === 'ERROR') {
    console.error(JSON.stringify(log));
  } else if (log.severity === 'WARNING') {
    console.warn(JSON.stringify(log));
  } else {
    console.log(JSON.stringify(log));
  }
}

export function trackFailure(key: string, event: AuditEvent, userId?: string, ip?: string): boolean {
  const now = Date.now();
  const threshold = ANOMALY_THRESHOLDS.authFailures;
  const entry = failureCounters.get(key) ?? { count: 0, windowStart: now };

  if (now - entry.windowStart > threshold.windowMs) {
    entry.count = 1;
    entry.windowStart = now;
  } else {
    entry.count += 1;
  }

  failureCounters.set(key, entry);

  if (entry.count >= threshold.max) {
    auditLog('anomaly.multiple_failures', {
      severity: 'CRITICAL',
      anomaly: true,
      userId,
      ip,
      metadata: { failureCount: entry.count, windowMs: threshold.windowMs, trackedEvent: event },
    });
    return true; // anomaly detected
  }

  return false;
}
