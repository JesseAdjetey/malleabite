import { toast } from 'sonner';

export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface AppError {
  message: string;
  code?: string;
  severity: ErrorSeverity;
  error?: Error;
  context?: Record<string, any>;
  userId?: string;
}

/**
 * Centralized error handling utility
 * Handles logging, user notifications, and error tracking
 */
class ErrorHandler {
  private static instance: ErrorHandler;

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Main error handling method
   * @param appError - The error details
   */
  handle(appError: AppError): void {
    // Log to console in development
    if (import.meta.env.DEV) {
      this.logToConsole(appError);
    }

    // Send to error tracking service in production
    if (import.meta.env.PROD && appError.severity !== ErrorSeverity.INFO) {
      this.sendToErrorTracking(appError);
    }

    // Show user-friendly notification
    this.displayToUser(appError);
  }

  /**
   * Handle Firebase authentication errors
   */
  handleAuthError(error: any): void {
    const appError: AppError = {
      message: this.getAuthErrorMessage(error.code),
      code: error.code,
      severity: ErrorSeverity.ERROR,
      error: error,
      context: { type: 'auth' }
    };

    this.handle(appError);
  }

  /**
   * Handle Firestore errors
   */
  handleFirestoreError(error: any, operation: string): void {
    const appError: AppError = {
      message: `Failed to ${operation}. Please try again.`,
      code: error.code,
      severity: ErrorSeverity.ERROR,
      error: error,
      context: { type: 'firestore', operation }
    };

    this.handle(appError);
  }

  /**
   * Handle network errors
   */
  handleNetworkError(error: any): void {
    const appError: AppError = {
      message: 'Network error. Please check your internet connection.',
      code: 'network-error',
      severity: ErrorSeverity.WARNING,
      error: error,
      context: { type: 'network' }
    };

    this.handle(appError);
  }

  /**
   * Log error to console with formatting
   */
  private logToConsole(appError: AppError): void {
    const style = this.getConsoleStyle(appError.severity);
    
    console.group(`%c[${appError.severity.toUpperCase()}] ${appError.message}`, style);
    
    if (appError.code) {
      console.log('Code:', appError.code);
    }
    
    if (appError.error) {
      console.error('Error:', appError.error);
    }
    
    if (appError.context) {
      console.log('Context:', appError.context);
    }
    
    console.groupEnd();
  }

  /**
   * Get console style based on severity
   */
  private getConsoleStyle(severity: ErrorSeverity): string {
    const styles = {
      [ErrorSeverity.INFO]: 'color: #3b82f6; font-weight: bold',
      [ErrorSeverity.WARNING]: 'color: #f59e0b; font-weight: bold',
      [ErrorSeverity.ERROR]: 'color: #ef4444; font-weight: bold',
      [ErrorSeverity.CRITICAL]: 'color: #dc2626; font-weight: bold; font-size: 14px'
    };

    return styles[severity];
  }

  /**
   * Display user-friendly notification
   */
  private displayToUser(appError: AppError): void {
    const userMessage = this.getUserFriendlyMessage(appError);

    switch (appError.severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.ERROR:
        toast.error(userMessage, {
          duration: 5000,
        });
        break;
      case ErrorSeverity.WARNING:
        toast.warning(userMessage, {
          duration: 4000,
        });
        break;
      case ErrorSeverity.INFO:
        toast.info(userMessage, {
          duration: 3000,
        });
        break;
    }
  }

  /**
   * Get user-friendly error message
   */
  private getUserFriendlyMessage(appError: AppError): string {
    // If a custom message is provided, use it
    if (appError.message && !appError.message.includes('auth/')) {
      return appError.message;
    }

    // Map technical error codes to user-friendly messages
    const errorMessages: Record<string, string> = {
      // Auth errors
      'auth/user-not-found': 'No account found with this email address',
      'auth/wrong-password': 'Incorrect password. Please try again',
      'auth/email-already-in-use': 'This email is already registered',
      'auth/weak-password': 'Password should be at least 6 characters',
      'auth/invalid-email': 'Please enter a valid email address',
      'auth/user-disabled': 'This account has been disabled',
      'auth/too-many-requests': 'Too many attempts. Please try again later',
      'auth/network-request-failed': 'Network error. Please check your connection',
      
      // Firestore errors
      'permission-denied': 'You don\'t have permission to perform this action',
      'unavailable': 'Service temporarily unavailable. Please try again',
      'deadline-exceeded': 'Request timed out. Please try again',
      'not-found': 'The requested item was not found',
      'already-exists': 'This item already exists',
      
      // Network errors
      'network-error': 'Network error. Please check your internet connection',
      'fetch-failed': 'Failed to fetch data. Please try again',
    };

    return errorMessages[appError.code || ''] || appError.message || 'An unexpected error occurred';
  }

  /**
   * Get user-friendly auth error message
   */
  private getAuthErrorMessage(code: string): string {
    const authErrors: Record<string, string> = {
      'auth/user-not-found': 'No account found with this email',
      'auth/wrong-password': 'Incorrect password',
      'auth/email-already-in-use': 'Email already registered',
      'auth/weak-password': 'Password too weak (min 6 characters)',
      'auth/invalid-email': 'Invalid email address',
      'auth/user-disabled': 'Account disabled',
      'auth/too-many-requests': 'Too many attempts. Try later',
    };

    return authErrors[code] || 'Authentication failed';
  }

  /**
   * Send error to tracking service
   * TODO: Integrate with Sentry, LogRocket, or similar
   */
  private sendToErrorTracking(appError: AppError): void {
    // Placeholder for error tracking integration
    // Example with Sentry:
    /*
    if (window.Sentry) {
      Sentry.captureException(appError.error || new Error(appError.message), {
        level: this.getSentryLevel(appError.severity),
        tags: {
          code: appError.code,
          userId: appError.userId,
        },
        extra: appError.context,
      });
    }
    */

    // For now, just log that we would send to tracking
    if (import.meta.env.DEV) {
      console.info('Would send to error tracking:', appError);
    }
  }

  /**
   * Map severity to Sentry level
   */
  private getSentryLevel(severity: ErrorSeverity): string {
    const mapping = {
      [ErrorSeverity.INFO]: 'info',
      [ErrorSeverity.WARNING]: 'warning',
      [ErrorSeverity.ERROR]: 'error',
      [ErrorSeverity.CRITICAL]: 'fatal'
    };

    return mapping[severity];
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Convenience functions
export const handleError = (message: string, error?: Error, context?: Record<string, any>) => {
  errorHandler.handle({
    message,
    severity: ErrorSeverity.ERROR,
    error,
    context
  });
};

export const handleWarning = (message: string, context?: Record<string, any>) => {
  errorHandler.handle({
    message,
    severity: ErrorSeverity.WARNING,
    context
  });
};

export const handleInfo = (message: string, context?: Record<string, any>) => {
  errorHandler.handle({
    message,
    severity: ErrorSeverity.INFO,
    context
  });
};
