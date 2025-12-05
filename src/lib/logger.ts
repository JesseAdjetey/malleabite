/**
 * Centralized logging utility
 * Provides consistent logging across the application with environment-aware behavior
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

class Logger {
  private level: LogLevel;
  private enabledInProduction: boolean;

  constructor() {
    // Set log level based on environment
    this.level = this.getLogLevel();
    this.enabledInProduction = import.meta.env.VITE_ENABLE_DEBUG_LOGS === 'true';
  }

  private getLogLevel(): LogLevel {
    if (import.meta.env.PROD && !this.enabledInProduction) {
      return LogLevel.ERROR; // Only errors in production
    }
    
    const envLevel = import.meta.env.VITE_LOG_LEVEL;
    switch (envLevel) {
      case 'DEBUG':
        return LogLevel.DEBUG;
      case 'INFO':
        return LogLevel.INFO;
      case 'WARN':
        return LogLevel.WARN;
      case 'ERROR':
        return LogLevel.ERROR;
      case 'NONE':
        return LogLevel.NONE;
      default:
        return import.meta.env.DEV ? LogLevel.DEBUG : LogLevel.ERROR;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  private formatMessage(level: string, category: string, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] [${category}] ${message}`;
  }

  /**
   * Debug level logging - for detailed debugging information
   * Only shown in development unless explicitly enabled
   */
  debug(category: string, message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(
        `%c${this.formatMessage('DEBUG', category, message)}`,
        'color: #6b7280; font-size: 11px',
        ...args
      );
    }
  }

  /**
   * Info level logging - for general informational messages
   */
  info(category: string, message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(
        `%c${this.formatMessage('INFO', category, message)}`,
        'color: #3b82f6; font-weight: 500',
        ...args
      );
    }
  }

  /**
   * Warning level logging - for potentially harmful situations
   */
  warn(category: string, message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(
        `%c${this.formatMessage('WARN', category, message)}`,
        'color: #f59e0b; font-weight: 600',
        ...args
      );
    }
  }

  /**
   * Error level logging - for error events
   */
  error(category: string, message: string, error?: Error, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(
        `%c${this.formatMessage('ERROR', category, message)}`,
        'color: #ef4444; font-weight: bold',
        error || '',
        ...args
      );

      // Log stack trace if available
      if (error && error.stack) {
        console.error('Stack trace:', error.stack);
      }
    }
  }

  /**
   * Log API calls
   */
  api(method: string, endpoint: string, data?: any): void {
    this.debug('API', `${method} ${endpoint}`, data);
  }

  /**
   * Log Firebase operations
   */
  firebase(operation: string, collection: string, data?: any): void {
    this.debug('Firebase', `${operation} on ${collection}`, data);
  }

  /**
   * Log authentication events
   */
  auth(event: string, data?: any): void {
    this.info('Auth', event, data);
  }

  /**
   * Log navigation/routing
   */
  navigation(from: string, to: string): void {
    this.debug('Navigation', `${from} → ${to}`);
  }

  /**
   * Log performance metrics
   */
  performance(metric: string, value: number, unit: string = 'ms'): void {
    this.debug('Performance', `${metric}: ${value}${unit}`);
  }

  /**
   * Group related logs
   */
  group(label: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.group(`%c${label}`, 'color: #8b5cf6; font-weight: bold');
    }
  }

  /**
   * End log group
   */
  groupEnd(): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.groupEnd();
    }
  }

  /**
   * Log a table of data
   */
  table(data: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.table(data);
    }
  }

  /**
   * Time execution of operations
   */
  time(label: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.time(label);
    }
  }

  /**
   * End timing
   */
  timeEnd(label: string): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.timeEnd(label);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Category-specific convenience exports
export const logAuth = (event: string, data?: any) => logger.auth(event, data);
export const logAPI = (method: string, endpoint: string, data?: any) => logger.api(method, endpoint, data);
export const logFirebase = (operation: string, collection: string, data?: any) => 
  logger.firebase(operation, collection, data);
export const logNav = (from: string, to: string) => logger.navigation(from, to);
export const logPerf = (metric: string, value: number, unit?: string) => 
  logger.performance(metric, value, unit);
