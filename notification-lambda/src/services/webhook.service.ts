/**
 * Comprehensive webhook service with retry logic, signature verification, and circuit breaker
 * Handles webhook delivery for notification events with full error handling and monitoring
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import * as crypto from 'crypto';
import { logger } from '../utils/logger';
import { config } from '../config';
import {
  WebhookDeliveryRequest,
  WebhookDeliveryResult,
  WebhookPayload,
  NotificationMetadata,
  RetryConfig
} from '../types/notifications';

/**
 * Circuit breaker states
 */
enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half-open'
}

/**
 * Circuit breaker for webhook endpoints
 */
class CircuitBreaker {
  private failures: number = 0;
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private nextAttempt: Date = new Date();
  private readonly threshold: number = 5;
  private readonly timeout: number = 60000; // 1 minute
  private readonly resetTimeout: number = 300000; // 5 minutes

  constructor(private url: string) {}

  canExecute(): boolean {
    if (this.state === CircuitBreakerState.CLOSED) {
      return true;
    }
    
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() > this.nextAttempt.getTime()) {
        this.state = CircuitBreakerState.HALF_OPEN;
        return true;
      }
      return false;
    }

    // HALF_OPEN state - allow one request through
    return true;
  }

  onSuccess(): void {
    this.failures = 0;
    this.state = CircuitBreakerState.CLOSED;
  }

  onFailure(): void {
    this.failures++;
    
    if (this.failures >= this.threshold) {
      this.state = CircuitBreakerState.OPEN;
      this.nextAttempt = new Date(Date.now() + this.resetTimeout);
      logger.warn('Circuit breaker opened for webhook URL', {
        url: this.url,
        failures: this.failures,
        nextAttempt: this.nextAttempt
      });
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getFailures(): number {
    return this.failures;
  }
}

/**
 * Webhook service with comprehensive delivery management
 */
export class WebhookService {
  private axiosInstance: AxiosInstance;
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private defaultRetryConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 60000,
    backoffMultiplier: 2,
    retryableErrors: ['ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT']
  };

  constructor() {
    this.axiosInstance = axios.create({
      timeout: 30000, // 30 second timeout
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Fluxion-Webhook-Service/1.0'
      },
      maxRedirects: 3,
      validateStatus: (status) => status < 500 // Retry on 5xx errors
    });

    // Request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        logger.debug('Webhook request initiated', {
          url: config.url,
          method: config.method,
          headers: this.sanitizeHeaders(config.headers)
        });
        return config;
      },
      (error) => {
        logger.error('Webhook request interceptor error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Response interceptor for logging
    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.debug('Webhook response received', {
          url: response.config.url,
          status: response.status,
          statusText: response.statusText,
          responseTime: response.headers['x-response-time']
        });
        return response;
      },
      (error) => {
        logger.error('Webhook response error', {
          url: error.config?.url,
          status: error.response?.status,
          statusText: error.response?.statusText,
          error: error.message
        });
        return Promise.reject(error);
      }
    );

    logger.info('Webhook service initialized', {
      timeout: 30000,
      maxRedirects: 3,
      retryConfig: this.defaultRetryConfig
    });
  }

  /**
   * Send webhook with automatic retry logic
   */
  async sendWebhook(request: WebhookDeliveryRequest, retryConfig?: Partial<RetryConfig>): Promise<WebhookDeliveryResult> {
    const startTime = Date.now();
    const finalRetryConfig = { ...this.defaultRetryConfig, ...retryConfig };
    
    logger.info('Sending webhook', {
      notificationId: request.notificationId,
      url: this.maskUrl(request.webhookUrl),
      retryAttempt: request.retryAttempt,
      maxAttempts: finalRetryConfig.maxAttempts
    });

    // Check circuit breaker
    const circuitBreaker = this.getOrCreateCircuitBreaker(request.webhookUrl);
    if (!circuitBreaker.canExecute()) {
      const result: WebhookDeliveryResult = {
        status: 'failed',
        error: 'Circuit breaker is open - too many recent failures',
        deliveredAt: new Date().toISOString()
      };
      
      logger.warn('Webhook blocked by circuit breaker', {
        notificationId: request.notificationId,
        url: this.maskUrl(request.webhookUrl),
        circuitBreakerState: circuitBreaker.getState()
      });
      
      return result;
    }

    let lastError: string = '';
    
    for (let attempt = 1; attempt <= finalRetryConfig.maxAttempts; attempt++) {
      try {
        const result = await this.executeWebhookRequest(request, attempt);
        
        if (result.status === 'sent') {
          circuitBreaker.onSuccess();
          this.logWebhookMetrics('success', request.webhookUrl, Date.now() - startTime, attempt);
          return result;
        }
        
        lastError = result.error || 'Unknown error';
        
        // Don't retry if it's not a retryable error
        if (result.httpStatus && !this.isRetryableHttpStatus(result.httpStatus)) {
          logger.info('Non-retryable HTTP status, stopping retries', {
            notificationId: request.notificationId,
            httpStatus: result.httpStatus,
            attempt
          });
          break;
        }
        
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        
        logger.warn('Webhook attempt failed', {
          notificationId: request.notificationId,
          attempt,
          maxAttempts: finalRetryConfig.maxAttempts,
          error: lastError
        });
        
        // Check if error is retryable
        if (!this.isRetryableError(error, finalRetryConfig.retryableErrors)) {
          logger.info('Non-retryable error, stopping retries', {
            notificationId: request.notificationId,
            error: lastError,
            attempt
          });
          break;
        }
      }
      
      // Calculate delay for next attempt (if not the last attempt)
      if (attempt < finalRetryConfig.maxAttempts) {
        const delay = Math.min(
          finalRetryConfig.baseDelayMs * Math.pow(finalRetryConfig.backoffMultiplier, attempt - 1),
          finalRetryConfig.maxDelayMs
        );
        
        logger.info('Retrying webhook after delay', {
          notificationId: request.notificationId,
          attempt: attempt + 1,
          delayMs: delay
        });
        
        await this.sleep(delay);
      }
    }

    // All attempts failed
    circuitBreaker.onFailure();
    const totalTime = Date.now() - startTime;
    this.logWebhookMetrics('failure', request.webhookUrl, totalTime, finalRetryConfig.maxAttempts);
    
    // Calculate next retry time for scheduling
    const nextRetryDelay = Math.min(
      finalRetryConfig.baseDelayMs * Math.pow(finalRetryConfig.backoffMultiplier, request.retryAttempt),
      finalRetryConfig.maxDelayMs * 6 // Max 6 minutes for scheduled retries
    );
    const nextRetryAt = new Date(Date.now() + nextRetryDelay).toISOString();

    logger.error('All webhook attempts failed', {
      notificationId: request.notificationId,
      url: this.maskUrl(request.webhookUrl),
      attempts: finalRetryConfig.maxAttempts,
      totalTime,
      lastError
    });

    return {
      status: 'failed',
      error: `All ${finalRetryConfig.maxAttempts} attempts failed. Last error: ${lastError}`,
      deliveredAt: new Date().toISOString(),
      nextRetryAt
    };
  }

  /**
   * Execute a single webhook request
   */
  private async executeWebhookRequest(request: WebhookDeliveryRequest, attempt: number): Promise<WebhookDeliveryResult> {
    const requestConfig: AxiosRequestConfig = {
      method: 'POST',
      url: request.webhookUrl,
      data: request.payload,
      headers: {
        'Content-Type': 'application/json',
        'X-Fluxion-Signature': request.signature,
        'X-Fluxion-Notification-Id': request.notificationId,
        'X-Fluxion-Retry-Attempt': attempt.toString(),
        'X-Fluxion-Timestamp': new Date().toISOString()
      },
      timeout: 30000
    };

    try {
      const response: AxiosResponse = await this.axiosInstance.request(requestConfig);
      
      logger.info('Webhook delivered successfully', {
        notificationId: request.notificationId,
        url: this.maskUrl(request.webhookUrl),
        status: response.status,
        attempt
      });

      return {
        status: 'sent',
        httpStatus: response.status,
        responseBody: typeof response.data === 'string' ? 
          response.data.substring(0, 1000) : 
          JSON.stringify(response.data).substring(0, 1000),
        deliveredAt: new Date().toISOString()
      };

    } catch (error: any) {
      const httpStatus = error.response?.status;
      const responseBody = error.response?.data ? 
        (typeof error.response.data === 'string' ? 
          error.response.data.substring(0, 1000) : 
          JSON.stringify(error.response.data).substring(0, 1000)) : 
        undefined;

      logger.error('Webhook request failed', {
        notificationId: request.notificationId,
        url: this.maskUrl(request.webhookUrl),
        httpStatus,
        error: error.message,
        attempt
      });

      return {
        status: 'failed',
        httpStatus,
        responseBody,
        error: error.message,
        deliveredAt: new Date().toISOString()
      };
    }
  }

  /**
   * Generate webhook signature using HMAC-SHA256
   */
  generateSignature(payload: WebhookPayload, secret: string): string {
    const jsonPayload = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(jsonPayload);
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: WebhookPayload, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Create webhook payload for notification
   */
  createWebhookPayload(
    notificationType: string,
    templateData: any,
    metadata: NotificationMetadata
  ): WebhookPayload {
    return {
      event: notificationType,
      timestamp: new Date().toISOString(),
      data: {
        invoice: this.extractInvoiceData(templateData),
        payment: this.extractPaymentData(templateData),
        organization: this.extractOrganizationData(templateData)
      },
      metadata: {
        notificationId: metadata.correlationId,
        correlationId: metadata.correlationId,
        version: '1.0'
      }
    };
  }

  /**
   * Get webhook service health status
   */
  getHealthStatus() {
    const circuitBreakerStats = Array.from(this.circuitBreakers.entries()).map(([url, breaker]) => ({
      url: this.maskUrl(url),
      state: breaker.getState(),
      failures: breaker.getFailures()
    }));

    return {
      serviceName: 'WebhookService',
      status: 'healthy',
      circuitBreakers: circuitBreakerStats,
      totalEndpoints: this.circuitBreakers.size
    };
  }

  /**
   * Test webhook endpoint connectivity
   */
  async testWebhookEndpoint(url: string): Promise<{ success: boolean; error?: string; responseTime?: number }> {
    const startTime = Date.now();
    
    try {
      const testPayload = {
        event: 'webhook_test',
        timestamp: new Date().toISOString(),
        data: {
          message: 'This is a test webhook from Fluxion'
        }
      };

      const response = await this.axiosInstance.post(url, testPayload, {
        timeout: 10000,
        headers: {
          'X-Fluxion-Test': 'true'
        }
      });

      const responseTime = Date.now() - startTime;

      return {
        success: response.status >= 200 && response.status < 300,
        responseTime
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      return {
        success: false,
        error: error.message,
        responseTime
      };
    }
  }

  /**
   * Private helper methods
   */
  private getOrCreateCircuitBreaker(url: string): CircuitBreaker {
    if (!this.circuitBreakers.has(url)) {
      this.circuitBreakers.set(url, new CircuitBreaker(url));
    }
    return this.circuitBreakers.get(url)!;
  }

  private isRetryableHttpStatus(status: number): boolean {
    // Retry on server errors (5xx) and specific client errors
    return status >= 500 || status === 408 || status === 429;
  }

  private isRetryableError(error: any, retryableErrors: string[]): boolean {
    if (!error.code) return false;
    return retryableErrors.includes(error.code);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private maskUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.hostname}${urlObj.pathname}`;
    } catch {
      return url.substring(0, 50) + '...';
    }
  }

  private sanitizeHeaders(headers: any): any {
    const sanitized = { ...headers };
    if (sanitized['X-Fluxion-Signature']) {
      sanitized['X-Fluxion-Signature'] = '[REDACTED]';
    }
    return sanitized;
  }

  private extractInvoiceData(templateData: any): any {
    return {
      id: templateData.invoiceId || '',
      number: templateData.invoiceNumber || '',
      amount: templateData.amount || '',
      currency: templateData.currency || '',
      status: templateData.status || 'pending',
      dueDate: templateData.dueDate || '',
      createdAt: templateData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  private extractPaymentData(templateData: any): any {
    if (!templateData.paymentId && !templateData.transactionHash) {
      return undefined;
    }

    return {
      id: templateData.paymentId || '',
      amount: templateData.amount || '',
      currency: templateData.currency || '',
      transactionHash: templateData.transactionHash || '',
      network: templateData.networkName || '',
      status: templateData.paymentStatus || 'completed',
      processedAt: templateData.paymentDate || new Date().toISOString()
    };
  }

  private extractOrganizationData(templateData: any): any {
    return {
      id: templateData.organizationId || '',
      name: templateData.organizationName || '',
      email: templateData.creatorEmail || ''
    };
  }

  private logWebhookMetrics(result: 'success' | 'failure', url: string, durationMs: number, attempts: number): void {
    logger.info('Webhook delivery metrics', {
      result,
      url: this.maskUrl(url),
      durationMs,
      attempts,
      timestamp: new Date().toISOString()
    });

    // In production, these metrics would be sent to CloudWatch
    // For now, we just log them for visibility
  }
}

// Singleton instance
export const webhookService = new WebhookService();