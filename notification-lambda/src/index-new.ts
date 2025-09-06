/**
 * Fluxion Notification Lambda - Main Handler
 * Processes SQS messages for comprehensive notification delivery
 * Supports email, webhook, and scheduled notification processing
 */

import { SQSHandler, SQSEvent, SQSRecord, Context } from 'aws-lambda';
import { logger } from './utils/logger';
import { emailService } from './services/email.service';
import { webhookService } from './services/webhook.service';
import { backgroundJobsService } from './services/background-jobs.service';
import { renderEmailTemplate, preloadTemplates } from './templates/template-engine';
import {
  SQSNotificationMessage,
  NotificationProcessingResult,
  EmailDeliveryRequest,
  WebhookDeliveryRequest,
  BackgroundJob,
  NotificationType
} from './types/notifications';

// Lambda cold start optimization - preload templates
let templatesPreloaded = false;

/**
 * Warm up function to preload templates and initialize services
 */
async function warmUp(): Promise<void> {
  if (templatesPreloaded) return;
  
  try {
    await preloadTemplates();
    templatesPreloaded = true;
    logger.info('Lambda warmed up successfully', {
      templatesPreloaded: true,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    logger.error('Lambda warm up failed', {
      error: error instanceof Error ? error.message : error
    });
    // Don't throw - let individual requests handle template loading
  }
}

/**
 * Process notification statistics tracking
 */
interface ProcessingStats {
  totalProcessed: number;
  successful: number;
  failed: number;
  retries: number;
  channelBreakdown: {
    email: { sent: number; failed: number };
    webhook: { sent: number; failed: number };
    sms: { sent: number; failed: number };
  };
  typeBreakdown: { [key in NotificationType]?: { sent: number; failed: number } };
}

/**
 * Initialize processing statistics
 */
function initializeStats(): ProcessingStats {
  return {
    totalProcessed: 0,
    successful: 0,
    failed: 0,
    retries: 0,
    channelBreakdown: {
      email: { sent: 0, failed: 0 },
      webhook: { sent: 0, failed: 0 },
      sms: { sent: 0, failed: 0 }
    },
    typeBreakdown: {}
  };
}

/**
 * Main Lambda handler for processing SQS notification messages
 */
export const handler: SQSHandler = async (event: SQSEvent, context: Context) => {
  const startTime = Date.now();
  const stats = initializeStats();
  
  // Warm up lambda on cold start
  await warmUp();
  
  logger.info('Notification Lambda invoked', { 
    recordCount: event.Records.length,
    requestId: context.awsRequestId,
    environment: process.env.NODE_ENV || 'development',
    remainingTimeMs: context.getRemainingTimeInMillis(),
    timestamp: new Date().toISOString()
  });

  const results: NotificationProcessingResult[] = [];

  // Process records in parallel with concurrency limit
  const concurrencyLimit = Math.min(event.Records.length, 5); // Max 5 concurrent
  
  const processRecord = async (record: SQSRecord): Promise<NotificationProcessingResult> => {
    try {
      const result = await processNotificationMessage(record, context);
      updateStats(stats, result);
      return result;
    } catch (error) {
      logger.error('Critical error processing notification record', {
        messageId: record.messageId,
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      const failedResult: NotificationProcessingResult = {
        notificationId: record.messageId,
        type: 'invoice_sent', // Default fallback
        status: 'failed',
        channels: ['email'],
        results: {},
        processingTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown critical error',
        processedAt: new Date().toISOString()
      };
      
      updateStats(stats, failedResult);
      return failedResult;
    }
  };

  // Process records with controlled concurrency
  const chunks = [];
  for (let i = 0; i < event.Records.length; i += concurrencyLimit) {
    chunks.push(event.Records.slice(i, i + concurrencyLimit));
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.allSettled(
      chunk.map(record => processRecord(record))
    );
    
    for (const result of chunkResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        logger.error('Promise rejected in chunk processing', {
          error: result.reason
        });
      }
    }
  }

  const totalProcessingTime = Date.now() - startTime;
  
  // Log final statistics
  logger.info('Notification batch processing completed', {
    totalRecords: event.Records.length,
    processedRecords: results.length,
    successfulNotifications: stats.successful,
    failedNotifications: stats.failed,
    totalProcessingTimeMs: totalProcessingTime,
    averageProcessingTimeMs: Math.round(totalProcessingTime / results.length),
    requestId: context.awsRequestId,
    stats,
    timestamp: new Date().toISOString()
  });

  // In production, you might want to send metrics to CloudWatch here
  await sendMetricsToCloudWatch(stats, totalProcessingTime, context);

  // Return results for monitoring (optional)
  return {
    processedRecords: results.length,
    successful: stats.successful,
    failed: stats.failed,
    processingTimeMs: totalProcessingTime
  };
};

/**
 * Process individual notification message
 */
async function processNotificationMessage(
  record: SQSRecord, 
  context: Context
): Promise<NotificationProcessingResult> {
  const messageStartTime = Date.now();
  const messageId = record.messageId;
  
  logger.info('Processing notification message', { 
    messageId,
    remainingTimeMs: context.getRemainingTimeInMillis()
  });

  let notification: SQSNotificationMessage;
  
  // Parse and validate SQS message
  try {
    notification = JSON.parse(record.body);
    validateNotificationMessage(notification);
  } catch (error) {
    logger.error('Failed to parse or validate notification message', { 
      error: error instanceof Error ? error.message : error,
      messageId,
      body: record.body.substring(0, 1000) // Truncate for logging
    });
    throw new Error(`Invalid message format: ${error}`);
  }

  logger.info('Processing notification', { 
    type: notification.type,
    recipient: notification.recipientEmail.replace(/(.{3}).*@/, '$1***@'),
    priority: notification.priority,
    channels: notification.channels,
    messageId,
    correlationId: notification.metadata.correlationId
  });

  const result: NotificationProcessingResult = {
    notificationId: messageId,
    type: notification.type,
    status: 'pending',
    channels: notification.channels,
    results: {},
    processingTimeMs: 0,
    processedAt: new Date().toISOString()
  };

  // Check if this is a background job
  if (isBackgroundJob(notification)) {
    return await processBackgroundJobMessage(notification, result, messageStartTime);
  }

  // Process regular notification channels
  const channelPromises = notification.channels.map(channel => 
    processNotificationChannel(channel, notification, result)
  );

  await Promise.allSettled(channelPromises);
  
  // Determine final status
  const hasSuccessfulChannel = Object.values(result.results).some(
    channelResult => channelResult && 'status' in channelResult && channelResult.status === 'sent'
  );
  
  result.status = hasSuccessfulChannel ? 'sent' : 'failed';
  result.processingTimeMs = Date.now() - messageStartTime;
  
  logger.info('Notification processing completed', {
    messageId,
    type: notification.type,
    status: result.status,
    channels: notification.channels,
    processingTimeMs: result.processingTimeMs,
    correlationId: notification.metadata.correlationId
  });

  return result;
}

/**
 * Process notification for a specific channel (email, webhook, sms)
 */
async function processNotificationChannel(
  channel: 'email' | 'webhook' | 'sms',
  notification: SQSNotificationMessage,
  result: NotificationProcessingResult
): Promise<void> {
  try {
    switch (channel) {
      case 'email':
        result.results.email = await processEmailNotification(notification);
        break;
      case 'webhook':
        result.results.webhook = await processWebhookNotification(notification);
        break;
      case 'sms':
        // SMS implementation would go here
        logger.warn('SMS notifications not yet implemented', {
          notificationId: result.notificationId
        });
        break;
      default:
        logger.warn('Unknown notification channel', { channel });
    }
  } catch (error) {
    logger.error(`Failed to process ${channel} notification`, {
      notificationId: result.notificationId,
      channel,
      error: error instanceof Error ? error.message : error
    });
    
    result.results[channel] = {
      status: 'failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      deliveredAt: new Date().toISOString()
    };
  }
}

/**
 * Process email notification
 */
async function processEmailNotification(notification: SQSNotificationMessage) {
  try {
    // Render email template
    const compiledTemplate = renderEmailTemplate(
      notification.type,
      notification.templateData,
      notification.recipientEmail
    );
    
    // Create email delivery request
    const emailRequest: EmailDeliveryRequest = {
      notificationId: notification.metadata.correlationId,
      recipientEmail: notification.recipientEmail,
      subject: compiledTemplate.subject,
      bodyHtml: compiledTemplate.bodyHtml,
      bodyText: compiledTemplate.bodyText,
      priority: notification.priority,
      metadata: notification.metadata
    };
    
    // Send email via service
    return await emailService.sendEmail(emailRequest);
  } catch (error) {
    logger.error('Email processing failed', {
      type: notification.type,
      recipient: notification.recipientEmail.replace(/(.{3}).*@/, '$1***@'),
      error: error instanceof Error ? error.message : error
    });
    throw error;
  }
}

/**
 * Process webhook notification
 */
async function processWebhookNotification(notification: SQSNotificationMessage) {
  try {
    // This would typically get webhook URL from organization settings
    // For now, we'll skip if no webhook URL is configured
    const webhookUrl = process.env.TEST_WEBHOOK_URL;
    if (!webhookUrl) {
      logger.info('No webhook URL configured, skipping webhook delivery');
      return {
        status: 'sent',
        deliveredAt: new Date().toISOString()
      };
    }
    
    // Create webhook payload
    const payload = webhookService.createWebhookPayload(
      notification.type,
      notification.templateData,
      notification.metadata
    );
    
    // Generate signature
    const secret = process.env.WEBHOOK_SECRET || 'default-secret';
    const signature = webhookService.generateSignature(payload, secret);
    
    // Create webhook delivery request
    const webhookRequest: WebhookDeliveryRequest = {
      notificationId: notification.metadata.correlationId,
      webhookUrl,
      payload,
      signature,
      retryAttempt: 0,
      metadata: notification.metadata
    };
    
    // Send webhook
    return await webhookService.sendWebhook(webhookRequest);
  } catch (error) {
    logger.error('Webhook processing failed', {
      type: notification.type,
      error: error instanceof Error ? error.message : error
    });
    throw error;
  }
}

/**
 * Process background job message
 */
async function processBackgroundJobMessage(
  notification: SQSNotificationMessage,
  result: NotificationProcessingResult,
  startTime: number
): Promise<NotificationProcessingResult> {
  try {
    // Extract job from notification
    const job: BackgroundJob = notification.templateData as any; // Type assertion for background jobs
    
    // Process the job
    const jobResult = await backgroundJobsService.processJob(job);
    
    result.status = jobResult.status === 'completed' ? 'sent' : 'failed';
    result.error = jobResult.error;
    result.results = { job: jobResult };
    result.processingTimeMs = Date.now() - startTime;
    
    return result;
  } catch (error) {
    logger.error('Background job processing failed', {
      error: error instanceof Error ? error.message : error,
      notificationId: result.notificationId
    });
    
    result.status = 'failed';
    result.error = error instanceof Error ? error.message : 'Unknown job processing error';
    result.processingTimeMs = Date.now() - startTime;
    
    return result;
  }
}

/**
 * Validate notification message structure
 */
function validateNotificationMessage(notification: any): void {
  if (!notification.type) {
    throw new Error('Missing notification type');
  }
  
  if (!notification.recipientEmail) {
    throw new Error('Missing recipient email');
  }
  
  if (!notification.templateData) {
    throw new Error('Missing template data');
  }
  
  if (!notification.metadata) {
    throw new Error('Missing metadata');
  }
  
  if (!notification.metadata.organizationId) {
    throw new Error('Missing organization ID in metadata');
  }
  
  if (!notification.metadata.correlationId) {
    throw new Error('Missing correlation ID in metadata');
  }

  // Validate channels
  if (notification.channels && !Array.isArray(notification.channels)) {
    throw new Error('Channels must be an array');
  }
  
  // Validate priority
  if (notification.priority && !['high', 'medium', 'low'].includes(notification.priority)) {
    throw new Error('Invalid priority level');
  }
}

/**
 * Check if notification is a background job
 */
function isBackgroundJob(notification: SQSNotificationMessage): boolean {
  return notification.type.startsWith('job_') || 
         (notification.templateData as any).jobId !== undefined;
}

/**
 * Update processing statistics
 */
function updateStats(stats: ProcessingStats, result: NotificationProcessingResult): void {
  stats.totalProcessed++;
  
  if (result.status === 'sent') {
    stats.successful++;
  } else {
    stats.failed++;
  }
  
  // Update channel breakdown
  for (const channel of result.channels) {
    const channelResult = result.results[channel];
    if (channelResult && 'status' in channelResult) {
      if (channelResult.status === 'sent') {
        stats.channelBreakdown[channel].sent++;
      } else {
        stats.channelBreakdown[channel].failed++;
      }
    }
  }
  
  // Update type breakdown
  if (!stats.typeBreakdown[result.type]) {
    stats.typeBreakdown[result.type] = { sent: 0, failed: 0 };
  }
  
  if (result.status === 'sent') {
    stats.typeBreakdown[result.type]!.sent++;
  } else {
    stats.typeBreakdown[result.type]!.failed++;
  }
}

/**
 * Send metrics to CloudWatch (placeholder implementation)
 */
async function sendMetricsToCloudWatch(
  stats: ProcessingStats, 
  totalProcessingTime: number, 
  context: Context
): Promise<void> {
  // In production, implement CloudWatch metrics
  logger.info('Metrics would be sent to CloudWatch', {
    namespace: 'Fluxion/NotificationLambda',
    metrics: {
      TotalProcessed: stats.totalProcessed,
      Successful: stats.successful,
      Failed: stats.failed,
      ProcessingTimeMs: totalProcessingTime,
      MemoryUsed: context.memoryLimitInMB,
      Environment: process.env.NODE_ENV || 'development'
    }
  });
}