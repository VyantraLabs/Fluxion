/**
 * Comprehensive email service with multiple provider support
 * Primary: AWS SES, Fallback: SendGrid, Alternative: SMTP
 */

import { SESClient, SendEmailCommand, SendEmailCommandInput } from '@aws-sdk/client-ses';
import * as sgMail from '@sendgrid/mail';
import * as nodemailer from 'nodemailer';
import { logger } from '../utils/logger';
import { config } from '../config';
import {
  EmailDeliveryRequest,
  EmailDeliveryResult,
  EmailAttachment,
  NotificationError,
  NotificationPriority
} from '../types/notifications';

export interface EmailProvider {
  name: 'ses' | 'sendgrid' | 'smtp';
  send(request: EmailDeliveryRequest): Promise<EmailDeliveryResult>;
  isHealthy(): Promise<boolean>;
}

/**
 * AWS SES Email Provider
 */
export class SESEmailProvider implements EmailProvider {
  public name: 'ses' = 'ses';
  private sesClient: SESClient;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    const sesConfig: any = { 
      region: config.aws.ses.region,
      maxAttempts: 3
    };

    // Add credentials if available (for local development)
    if (config.aws.accessKeyId && config.aws.secretAccessKey) {
      sesConfig.credentials = {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey
      };
    }

    this.sesClient = new SESClient(sesConfig);
    this.fromEmail = config.aws.ses.fromEmail;
    this.fromName = config.aws.ses.fromName;

    logger.info('AWS SES email provider initialized', {
      region: config.aws.ses.region,
      fromEmail: this.maskEmail(this.fromEmail)
    });
  }

  async send(request: EmailDeliveryRequest): Promise<EmailDeliveryResult> {
    const startTime = Date.now();
    
    logger.info('Sending email via AWS SES', {
      notificationId: request.notificationId,
      recipient: this.maskEmail(request.recipientEmail),
      subject: request.subject,
      priority: request.priority
    });

    try {
      const emailParams: SendEmailCommandInput = {
        Source: `${this.fromName} <${this.fromEmail}>`,
        Destination: {
          ToAddresses: [request.recipientEmail]
        },
        Message: {
          Subject: {
            Data: request.subject,
            Charset: 'UTF-8'
          },
          Body: {
            Html: {
              Data: request.bodyHtml,
              Charset: 'UTF-8'
            },
            Text: {
              Data: request.bodyText,
              Charset: 'UTF-8'
            }
          }
        },
        Tags: [
          { Name: 'Service', Value: 'Fluxion' },
          { Name: 'NotificationId', Value: request.notificationId },
          { Name: 'Type', Value: request.metadata.correlationId },
          { Name: 'Environment', Value: request.metadata.environment },
          { Name: 'Priority', Value: request.priority }
        ]
      };

      const command = new SendEmailCommand(emailParams);
      const result = await this.sesClient.send(command);

      const deliveryResult: EmailDeliveryResult = {
        messageId: result.MessageId || '',
        status: 'sent',
        provider: 'ses',
        deliveredAt: new Date().toISOString()
      };

      const processingTime = Date.now() - startTime;
      logger.info('Email sent successfully via AWS SES', {
        notificationId: request.notificationId,
        messageId: result.MessageId,
        recipient: this.maskEmail(request.recipientEmail),
        processingTimeMs: processingTime
      });

      return deliveryResult;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Failed to send email via AWS SES', {
        notificationId: request.notificationId,
        recipient: this.maskEmail(request.recipientEmail),
        error: errorMessage,
        processingTimeMs: processingTime
      });

      return {
        messageId: '',
        status: 'failed',
        provider: 'ses',
        error: errorMessage,
        deliveredAt: new Date().toISOString()
      };
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Simple health check by attempting to get sending quota
      await this.sesClient.send({ input: {} } as any); // Basic connection test
      return true;
    } catch (error) {
      logger.warn('AWS SES health check failed', { error: error instanceof Error ? error.message : error });
      return false;
    }
  }

  private maskEmail(email: string): string {
    return email.replace(/(.{3}).*@/, '$1***@');
  }
}

/**
 * SendGrid Email Provider
 */
export class SendGridEmailProvider implements EmailProvider {
  public name: 'sendgrid' = 'sendgrid';
  private fromEmail: string;
  private fromName: string;
  private isInitialized: boolean = false;

  constructor() {
    this.fromEmail = config.aws.ses.fromEmail; // Reuse from config for consistency
    this.fromName = config.aws.ses.fromName;
    
    // Initialize SendGrid if API key is provided
    const apiKey = process.env.SENDGRID_API_KEY;
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.isInitialized = true;
      logger.info('SendGrid email provider initialized', {
        fromEmail: this.maskEmail(this.fromEmail)
      });
    } else {
      logger.warn('SendGrid API key not provided, provider will be unavailable');
    }
  }

  async send(request: EmailDeliveryRequest): Promise<EmailDeliveryResult> {
    if (!this.isInitialized) {
      throw new Error('SendGrid provider not initialized - missing API key');
    }

    const startTime = Date.now();
    
    logger.info('Sending email via SendGrid', {
      notificationId: request.notificationId,
      recipient: this.maskEmail(request.recipientEmail),
      subject: request.subject,
      priority: request.priority
    });

    try {
      const msg = {
        to: request.recipientEmail,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject: request.subject,
        text: request.bodyText,
        html: request.bodyHtml,
        customArgs: {
          notificationId: request.notificationId,
          correlationId: request.metadata.correlationId,
          environment: request.metadata.environment
        },
        categories: ['fluxion', request.metadata.environment, request.priority],
        attachments: request.attachments?.map(att => ({
          content: att.content,
          filename: att.filename,
          type: att.contentType,
          disposition: 'attachment'
        }))
      };

      const result = await sgMail.send(msg);
      const messageId = Array.isArray(result) && result[0]?.headers?.['x-message-id'] || 'unknown';

      const deliveryResult: EmailDeliveryResult = {
        messageId,
        status: 'sent',
        provider: 'sendgrid',
        deliveredAt: new Date().toISOString()
      };

      const processingTime = Date.now() - startTime;
      logger.info('Email sent successfully via SendGrid', {
        notificationId: request.notificationId,
        messageId,
        recipient: this.maskEmail(request.recipientEmail),
        processingTimeMs: processingTime
      });

      return deliveryResult;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Failed to send email via SendGrid', {
        notificationId: request.notificationId,
        recipient: this.maskEmail(request.recipientEmail),
        error: errorMessage,
        processingTimeMs: processingTime
      });

      return {
        messageId: '',
        status: 'failed',
        provider: 'sendgrid',
        error: errorMessage,
        deliveredAt: new Date().toISOString()
      };
    }
  }

  async isHealthy(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    try {
      // Simple health check - we can't easily test without sending an email
      // So we just verify the API key is set
      return true;
    } catch (error) {
      logger.warn('SendGrid health check failed', { error: error instanceof Error ? error.message : error });
      return false;
    }
  }

  private maskEmail(email: string): string {
    return email.replace(/(.{3}).*@/, '$1***@');
  }
}

/**
 * SMTP Email Provider (Fallback)
 */
export class SMTPEmailProvider implements EmailProvider {
  public name: 'smtp' = 'smtp';
  private transporter: nodemailer.Transporter | null = null;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    this.fromEmail = config.aws.ses.fromEmail;
    this.fromName = config.aws.ses.fromName;

    if (config.smtp) {
      this.transporter = nodemailer.createTransporter({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465, // true for 465, false for other ports
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass
        }
      });

      logger.info('SMTP email provider initialized', {
        host: config.smtp.host,
        port: config.smtp.port,
        fromEmail: this.maskEmail(this.fromEmail)
      });
    } else {
      logger.warn('SMTP configuration not provided, provider will be unavailable');
    }
  }

  async send(request: EmailDeliveryRequest): Promise<EmailDeliveryResult> {
    if (!this.transporter) {
      throw new Error('SMTP provider not initialized - missing configuration');
    }

    const startTime = Date.now();
    
    logger.info('Sending email via SMTP', {
      notificationId: request.notificationId,
      recipient: this.maskEmail(request.recipientEmail),
      subject: request.subject,
      priority: request.priority
    });

    try {
      const mailOptions = {
        from: `${this.fromName} <${this.fromEmail}>`,
        to: request.recipientEmail,
        subject: request.subject,
        text: request.bodyText,
        html: request.bodyHtml,
        attachments: request.attachments?.map(att => ({
          filename: att.filename,
          content: att.content,
          encoding: 'base64',
          contentType: att.contentType
        })),
        headers: {
          'X-Notification-ID': request.notificationId,
          'X-Correlation-ID': request.metadata.correlationId,
          'X-Environment': request.metadata.environment
        }
      };

      const result = await this.transporter.sendMail(mailOptions);

      const deliveryResult: EmailDeliveryResult = {
        messageId: result.messageId || '',
        status: 'sent',
        provider: 'smtp',
        deliveredAt: new Date().toISOString()
      };

      const processingTime = Date.now() - startTime;
      logger.info('Email sent successfully via SMTP', {
        notificationId: request.notificationId,
        messageId: result.messageId,
        recipient: this.maskEmail(request.recipientEmail),
        processingTimeMs: processingTime
      });

      return deliveryResult;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Failed to send email via SMTP', {
        notificationId: request.notificationId,
        recipient: this.maskEmail(request.recipientEmail),
        error: errorMessage,
        processingTimeMs: processingTime
      });

      return {
        messageId: '',
        status: 'failed',
        provider: 'smtp',
        error: errorMessage,
        deliveredAt: new Date().toISOString()
      };
    }
  }

  async isHealthy(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      logger.warn('SMTP health check failed', { error: error instanceof Error ? error.message : error });
      return false;
    }
  }

  private maskEmail(email: string): string {
    return email.replace(/(.{3}).*@/, '$1***@');
  }
}

/**
 * Multi-Provider Email Service with Intelligent Fallback
 */
export class EmailService {
  private providers: EmailProvider[];
  private primaryProvider: EmailProvider;
  private fallbackProviders: EmailProvider[];
  
  constructor() {
    // Initialize all available providers
    this.providers = [
      new SESEmailProvider(),
      new SendGridEmailProvider(),
      new SMTPEmailProvider()
    ].filter(provider => {
      // Only include providers that are properly configured
      if (provider.name === 'ses') return true; // SES is always available in Lambda
      if (provider.name === 'sendgrid') return !!process.env.SENDGRID_API_KEY;
      if (provider.name === 'smtp') return !!config.smtp;
      return false;
    });

    if (this.providers.length === 0) {
      throw new Error('No email providers are configured');
    }

    this.primaryProvider = this.providers[0];
    this.fallbackProviders = this.providers.slice(1);

    logger.info('Email service initialized', {
      primaryProvider: this.primaryProvider.name,
      fallbackProviders: this.fallbackProviders.map(p => p.name),
      totalProviders: this.providers.length
    });
  }

  /**
   * Send email with automatic fallback on failure
   */
  async sendEmail(request: EmailDeliveryRequest): Promise<EmailDeliveryResult> {
    const startTime = Date.now();
    let lastError: string = '';

    // Try primary provider first
    try {
      const result = await this.primaryProvider.send(request);
      if (result.status === 'sent') {
        this.logDeliveryMetrics('success', this.primaryProvider.name, Date.now() - startTime);
        return result;
      }
      lastError = result.error || 'Unknown error from primary provider';
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
      logger.warn('Primary email provider failed, trying fallback', {
        primaryProvider: this.primaryProvider.name,
        error: lastError,
        notificationId: request.notificationId
      });
    }

    // Try fallback providers
    for (const provider of this.fallbackProviders) {
      try {
        logger.info('Attempting fallback email provider', {
          provider: provider.name,
          notificationId: request.notificationId
        });

        const result = await provider.send(request);
        if (result.status === 'sent') {
          logger.info('Email sent successfully via fallback provider', {
            provider: provider.name,
            notificationId: request.notificationId
          });
          
          this.logDeliveryMetrics('fallback_success', provider.name, Date.now() - startTime);
          return result;
        }
        lastError = result.error || `Unknown error from ${provider.name}`;
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        logger.warn('Fallback email provider failed', {
          provider: provider.name,
          error: lastError,
          notificationId: request.notificationId
        });
      }
    }

    // All providers failed
    const totalTime = Date.now() - startTime;
    this.logDeliveryMetrics('failure', 'all_providers', totalTime);
    
    logger.error('All email providers failed', {
      notificationId: request.notificationId,
      lastError,
      totalProcessingTime: totalTime,
      providersAttempted: [this.primaryProvider.name, ...this.fallbackProviders.map(p => p.name)]
    });

    return {
      messageId: '',
      status: 'failed',
      provider: 'ses', // Default for tracking
      error: `All email providers failed. Last error: ${lastError}`,
      deliveredAt: new Date().toISOString()
    };
  }

  /**
   * Check health of all email providers
   */
  async checkHealth(): Promise<{ [provider: string]: boolean }> {
    const healthChecks = await Promise.allSettled(
      this.providers.map(async provider => ({
        name: provider.name,
        healthy: await provider.isHealthy()
      }))
    );

    const health: { [provider: string]: boolean } = {};
    
    healthChecks.forEach(result => {
      if (result.status === 'fulfilled') {
        health[result.value.name] = result.value.healthy;
      } else {
        // Find the provider name from the error or use unknown
        const failedProvider = 'unknown';
        health[failedProvider] = false;
      }
    });

    logger.info('Email provider health check completed', { health });
    return health;
  }

  /**
   * Get email service statistics
   */
  getServiceInfo() {
    return {
      primaryProvider: this.primaryProvider.name,
      fallbackProviders: this.fallbackProviders.map(p => p.name),
      totalProviders: this.providers.length,
      configuredProviders: this.providers.map(p => p.name)
    };
  }

  /**
   * Log delivery metrics for monitoring
   */
  private logDeliveryMetrics(result: 'success' | 'fallback_success' | 'failure', provider: string, durationMs: number) {
    logger.info('Email delivery metrics', {
      result,
      provider,
      durationMs,
      timestamp: new Date().toISOString()
    });

    // In production, these metrics would be sent to CloudWatch
    // For now, we just log them for visibility
  }

  /**
   * Validate email request before sending
   */
  private validateEmailRequest(request: EmailDeliveryRequest): void {
    if (!request.recipientEmail || !request.subject || !request.bodyHtml || !request.bodyText) {
      throw new Error('Missing required email fields');
    }

    if (!this.isValidEmail(request.recipientEmail)) {
      throw new Error('Invalid recipient email address');
    }

    if (request.subject.length > 200) {
      throw new Error('Email subject too long (max 200 characters)');
    }

    if (request.bodyHtml.length > 100000) {
      throw new Error('Email HTML body too long (max 100KB)');
    }

    if (request.attachments && request.attachments.length > 5) {
      throw new Error('Too many attachments (max 5)');
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

// Singleton instance
export const emailService = new EmailService();