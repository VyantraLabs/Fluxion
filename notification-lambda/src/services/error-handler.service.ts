/**
 * Comprehensive error handling and retry service for Fluxion notifications
 * Handles classification, retry logic, and error recovery patterns
 */

import { logger } from '../utils/logger';
import {
  NotificationError,
  RetryConfig,
  NotificationProcessingResult,
  SQSNotificationMessage
} from '../types/notifications';

/**
 * Error classifications for different handling strategies
 */
export enum ErrorClassification {
  RETRYABLE_TRANSIENT = 'retryable_transient',    // Network issues, timeouts, 5xx errors
  RETRYABLE_RATE_LIMIT = 'retryable_rate_limit',  // Rate limiting, 429 errors
  NON_RETRYABLE_CLIENT = 'non_retryable_client',  // 4xx errors (except 408, 429)
  NON_RETRYABLE_SYSTEM = 'non_retryable_system',  // System configuration errors
  FATAL = 'fatal'                                 // Unrecoverable errors
}

/**
 * Error patterns for classification
 */
const ERROR_PATTERNS = {
  [ErrorClassification.RETRYABLE_TRANSIENT]: [
    /ECONNRESET/i,
    /ENOTFOUND/i,
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /EPIPE/i,
    /socket hang up/i,
    /network timeout/i,
    /temporary failure/i,
    /service unavailable/i,
    /internal server error/i,
    /bad gateway/i,
    /gateway timeout/i
  ],
  [ErrorClassification.RETRYABLE_RATE_LIMIT]: [
    /rate limit/i,
    /quota exceeded/i,
    /too many requests/i,
    /throttled/i,
    /429/
  ],
  [ErrorClassification.NON_RETRYABLE_CLIENT]: [
    /400/,
    /401/,
    /403/,
    /404/,
    /405/,
    /406/,
    /409/,
    /410/,
    /422/,
    /invalid.*email/i,
    /malformed.*request/i,
    /authentication.*failed/i,
    /unauthorized/i,
    /forbidden/i,
    /not found/i,
    /bad request/i
  ],
  [ErrorClassification.NON_RETRYABLE_SYSTEM]: [
    /template.*not found/i,
    /configuration.*error/i,
    /missing.*credentials/i,
    /invalid.*configuration/i,
    /no.*provider.*available/i
  ],
  [ErrorClassification.FATAL]: [
    /out of memory/i,
    /maximum.*exceeded/i,
    /lambda.*timeout/i,
    /function.*timeout/i
  ]
};

/**
 * HTTP status code classifications
 */
const HTTP_STATUS_CLASSIFICATIONS = {
  [ErrorClassification.RETRYABLE_TRANSIENT]: [500, 502, 503, 504],
  [ErrorClassification.RETRYABLE_RATE_LIMIT]: [429],
  [ErrorClassification.NON_RETRYABLE_CLIENT]: [400, 401, 403, 404, 405, 406, 409, 410, 422],
  // 408 (Request Timeout) is treated as retryable transient
  retryable_timeout: [408]
};

/**
 * Retry configurations for different error types
 */
const RETRY_CONFIGS: { [key in ErrorClassification]: RetryConfig } = {
  [ErrorClassification.RETRYABLE_TRANSIENT]: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    retryableErrors: ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT']
  },
  [ErrorClassification.RETRYABLE_RATE_LIMIT]: {
    maxAttempts: 5,
    baseDelayMs: 2000,
    maxDelayMs: 60000,
    backoffMultiplier: 2.5,
    retryableErrors: ['rate limit', '429', 'throttled']
  },
  [ErrorClassification.NON_RETRYABLE_CLIENT]: {
    maxAttempts: 0, // No retry
    baseDelayMs: 0,
    maxDelayMs: 0,
    backoffMultiplier: 1,
    retryableErrors: []
  },
  [ErrorClassification.NON_RETRYABLE_SYSTEM]: {
    maxAttempts: 0, // No retry
    baseDelayMs: 0,
    maxDelayMs: 0,
    backoffMultiplier: 1,
    retryableErrors: []
  },
  [ErrorClassification.FATAL]: {
    maxAttempts: 0, // No retry
    baseDelayMs: 0,
    maxDelayMs: 0,
    backoffMultiplier: 1,
    retryableErrors: []
  }
};

/**
 * Error handling and retry service
 */
export class ErrorHandlerService {
  private errorCounts: Map<string, number> = new Map();
  private lastErrorTimes: Map<string, Date> = new Map();

  /**
   * Classify error for appropriate handling
   */
  classifyError(error: Error | any, httpStatus?: number): ErrorClassification {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = error?.code || '';
    const errorName = error?.name || '';

    // Check HTTP status first if available
    if (httpStatus) {
      for (const [classification, statusCodes] of Object.entries(HTTP_STATUS_CLASSIFICATIONS)) {
        if (statusCodes.includes(httpStatus)) {
          return classification as ErrorClassification;
        }
      }
      
      // Special case for 408 (Request Timeout)
      if (httpStatus === 408) {
        return ErrorClassification.RETRYABLE_TRANSIENT;
      }
    }

    // Check error patterns
    const fullErrorText = `${errorMessage} ${errorCode} ${errorName}`.toLowerCase();
    
    for (const [classification, patterns] of Object.entries(ERROR_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(fullErrorText)) {
          return classification as ErrorClassification;
        }
      }
    }

    // Default to retryable transient for unknown errors
    return ErrorClassification.RETRYABLE_TRANSIENT;
  }

  /**
   * Create structured notification error
   */
  createNotificationError(
    error: Error | any,
    type: 'validation' | 'provider' | 'network' | 'timeout' | 'system',
    httpStatus?: number,
    details?: Record<string, any>
  ): NotificationError {
    const classification = this.classifyError(error, httpStatus);
    const retryable = this.isRetryable(classification);
    
    return {
      code: this.getErrorCode(error, classification),
      message: error instanceof Error ? error.message : String(error),
      type,
      retryable,
      details: {
        ...details,
        classification,
        httpStatus,
        timestamp: new Date().toISOString(),
        errorName: error?.name,
        errorCode: error?.code
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get retry configuration for error classification
   */
  getRetryConfig(classification: ErrorClassification): RetryConfig {
    return { ...RETRY_CONFIGS[classification] };
  }

  /**
   * Calculate next retry delay with exponential backoff and jitter
   */
  calculateRetryDelay(
    attempt: number,
    config: RetryConfig,
    classification: ErrorClassification
  ): number {
    if (attempt >= config.maxAttempts) {
      return 0; // No more retries
    }

    let baseDelay = config.baseDelayMs;
    
    // Special handling for rate limit errors
    if (classification === ErrorClassification.RETRYABLE_RATE_LIMIT) {
      // Use longer delays for rate limiting
      baseDelay = Math.min(baseDelay * Math.pow(config.backoffMultiplier, attempt), config.maxDelayMs);
    } else {
      // Standard exponential backoff
      baseDelay = Math.min(baseDelay * Math.pow(config.backoffMultiplier, attempt - 1), config.maxDelayMs);
    }

    // Add jitter to prevent thundering herd (±25%)
    const jitter = baseDelay * 0.25 * (Math.random() - 0.5);
    const finalDelay = Math.max(0, baseDelay + jitter);

    return Math.round(finalDelay);
  }

  /**
   * Check if error should be retried
   */
  shouldRetry(
    error: Error | any,
    attempt: number,
    maxAttempts: number,
    httpStatus?: number
  ): boolean {
    const classification = this.classifyError(error, httpStatus);
    const config = this.getRetryConfig(classification);
    
    if (attempt >= maxAttempts || attempt >= config.maxAttempts) {
      return false;
    }

    return this.isRetryable(classification);
  }

  /**
   * Track error frequency for circuit breaker patterns
   */
  trackError(errorKey: string, error: NotificationError): void {
    const currentCount = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, currentCount + 1);
    this.lastErrorTimes.set(errorKey, new Date());

    logger.error('Error tracked', {
      errorKey,
      count: currentCount + 1,
      classification: error.details?.classification,
      retryable: error.retryable
    });
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStats(errorKey?: string): {
    totalErrors: number;
    errorsByKey: { [key: string]: number };
    recentErrors: { [key: string]: Date };
  } {
    if (errorKey) {
      return {
        totalErrors: this.errorCounts.get(errorKey) || 0,
        errorsByKey: { [errorKey]: this.errorCounts.get(errorKey) || 0 },
        recentErrors: { [errorKey]: this.lastErrorTimes.get(errorKey) || new Date(0) }
      };
    }

    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0);
    
    return {
      totalErrors,
      errorsByKey: Object.fromEntries(this.errorCounts.entries()),
      recentErrors: Object.fromEntries(this.lastErrorTimes.entries())
    };
  }

  /**
   * Reset error counts (useful for testing or periodic cleanup)
   */
  resetErrorCounts(): void {
    this.errorCounts.clear();
    this.lastErrorTimes.clear();
    logger.info('Error counts reset');
  }

  /**
   * Handle notification processing error with recovery logic
   */
  async handleNotificationError(
    notification: SQSNotificationMessage,
    error: Error | any,
    attempt: number,
    httpStatus?: number
  ): Promise<{
    shouldRetry: boolean;
    retryDelay: number;
    notificationError: NotificationError;
    nextAttempt?: Date;
  }> {
    const classification = this.classifyError(error, httpStatus);
    const config = this.getRetryConfig(classification);
    
    const notificationError = this.createNotificationError(
      error,
      this.getErrorType(error, httpStatus),
      httpStatus,
      {
        notificationId: notification.metadata.correlationId,
        notificationType: notification.type,
        attempt,
        classification
      }
    );

    // Track the error
    const errorKey = `${notification.type}_${classification}`;
    this.trackError(errorKey, notificationError);

    // Determine retry logic
    const shouldRetry = this.shouldRetry(error, attempt, config.maxAttempts, httpStatus);
    const retryDelay = shouldRetry ? this.calculateRetryDelay(attempt, config, classification) : 0;
    
    const result = {
      shouldRetry,
      retryDelay,
      notificationError,
      nextAttempt: shouldRetry ? new Date(Date.now() + retryDelay) : undefined
    };

    // Log the error handling decision
    logger.error('Notification error handled', {
      notificationId: notification.metadata.correlationId,
      type: notification.type,
      classification,
      attempt,
      maxAttempts: config.maxAttempts,
      shouldRetry: result.shouldRetry,
      retryDelayMs: result.retryDelay,
      nextAttempt: result.nextAttempt?.toISOString(),
      error: notificationError.message
    });

    return result;
  }

  /**
   * Create error recovery strategy
   */
  createRecoveryStrategy(
    error: NotificationError,
    notification: SQSNotificationMessage
  ): {
    strategy: 'retry' | 'fallback' | 'skip' | 'dlq';
    action: string;
    delay?: number;
  } {
    const classification = error.details?.classification as ErrorClassification;
    
    switch (classification) {
      case ErrorClassification.RETRYABLE_TRANSIENT:
        return {
          strategy: 'retry',
          action: 'Retry with exponential backoff',
          delay: 1000
        };
        
      case ErrorClassification.RETRYABLE_RATE_LIMIT:
        return {
          strategy: 'retry',
          action: 'Retry with longer delay for rate limiting',
          delay: 5000
        };
        
      case ErrorClassification.NON_RETRYABLE_CLIENT:
        return {
          strategy: 'skip',
          action: 'Skip due to client error - manual intervention required'
        };
        
      case ErrorClassification.NON_RETRYABLE_SYSTEM:
        return {
          strategy: 'fallback',
          action: 'Try alternative service or notify administrators'
        };
        
      case ErrorClassification.FATAL:
        return {
          strategy: 'dlq',
          action: 'Send to dead letter queue - system issue'
        };
        
      default:
        return {
          strategy: 'retry',
          action: 'Default retry strategy',
          delay: 2000
        };
    }
  }

  /**
   * Private helper methods
   */
  private isRetryable(classification: ErrorClassification): boolean {
    return classification === ErrorClassification.RETRYABLE_TRANSIENT ||
           classification === ErrorClassification.RETRYABLE_RATE_LIMIT;
  }

  private getErrorCode(error: Error | any, classification: ErrorClassification): string {
    const errorCode = error?.code || error?.name || 'UNKNOWN_ERROR';
    return `${classification.toUpperCase()}_${errorCode}`;
  }

  private getErrorType(
    error: Error | any,
    httpStatus?: number
  ): 'validation' | 'provider' | 'network' | 'timeout' | 'system' {
    if (httpStatus && httpStatus >= 400 && httpStatus < 500) {
      return 'validation';
    }
    
    if (httpStatus && httpStatus >= 500) {
      return 'provider';
    }
    
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    
    if (errorMessage.includes('timeout') || errorMessage.includes('etimedout')) {
      return 'timeout';
    }
    
    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return 'network';
    }
    
    return 'system';
  }
}

// Singleton instance
export const errorHandlerService = new ErrorHandlerService();