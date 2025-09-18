import { NotificationQueueRepository } from '../../database/repositories/NotificationQueueRepository';
import { NotificationQueue } from '../../database/entities/NotificationQueue';
import { TenantContext, PaginatedResult, QueryOptions } from '../../types/common';
import { FluxionError, ErrorCodes } from '../../types/common';
import { Logger } from '../../shared/utils/logger';
import { getNotificationService as getSQSNotificationService } from '../../shared/notifications/client';

export type NotificationType = 
  | 'invoice_sent' 
  | 'payment_received' 
  | 'payment_failed' 
  | 'payment_reminder' 
  | 'payment_overdue'
  | 'invoice_viewed';

export type NotificationChannel = 'email' | 'webhook' | 'sms';
export type NotificationPriority = 'high' | 'medium' | 'low';
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

export interface SendNotificationDto {
  type: NotificationType;
  recipientEmail: string;
  templateData: Record<string, any>;
  channels?: NotificationChannel[];
  priority?: NotificationPriority;
  scheduleAt?: Date;
}

export interface NotificationFilterDto {
  limit?: number;
  nextToken?: string;
  type?: NotificationType;
  status?: NotificationStatus;
  startDate?: Date;
  endDate?: Date;
}

export interface NotificationStatsDto {
  total: number;
  byStatus: Record<NotificationStatus, number>;
  byType: Record<NotificationType, number>;
  deliveryRate: number;
  averageDeliveryTime: number;
}

export class NotificationService {
  private notificationRepository: NotificationQueueRepository;
  private sqsNotificationService: any;
  private logger: Logger;

  constructor() {
    this.notificationRepository = new NotificationQueueRepository();
    this.sqsNotificationService = getSQSNotificationService();
    this.logger = new Logger('NotificationService');
  }

  /**
   * Send a notification
   */
  async sendNotification(
    tenantContext: TenantContext,
    notificationData: SendNotificationDto
  ): Promise<{
    notificationId: string;
    status: 'queued' | 'scheduled';
    message: string;
    scheduledAt?: string;
  }> {
    this.logger.info('Sending notification', {
      type: notificationData.type,
      recipient: notificationData.recipientEmail,
      tenantId: tenantContext.tenantId
    });

    try {
      // Create notification record
      const notification = await this.notificationRepository.create(tenantContext, {
        type: notificationData.type,
        recipientEmail: notificationData.recipientEmail,
        templateData: notificationData.templateData,
        channels: notificationData.channels || ['email'],
        priority: notificationData.priority || 'medium',
        scheduleAt: notificationData.scheduleAt,
        status: notificationData.scheduleAt ? 'pending' : 'pending',
        retryCount: 0
      });

      // If scheduled for future, just store it
      if (notificationData.scheduleAt && notificationData.scheduleAt > new Date()) {
        this.logger.info('Notification scheduled for future delivery', {
          notificationId: notification.id,
          scheduledAt: notificationData.scheduleAt.toISOString(),
          tenantId: tenantContext.tenantId
        });

        return {
          notificationId: notification.id,
          status: 'scheduled',
          message: 'Notification scheduled for future delivery',
          scheduledAt: notificationData.scheduleAt.toISOString()
        };
      }

      // Send immediate notification via SQS
      await this.sendToQueue(notification);

      this.logger.info('Notification queued successfully', {
        notificationId: notification.id,
        type: notificationData.type,
        recipient: notificationData.recipientEmail,
        tenantId: tenantContext.tenantId
      });

      return {
        notificationId: notification.id,
        status: 'queued',
        message: 'Notification queued for delivery'
      };
    } catch (error: any) {
      this.logger.error('Failed to send notification', {
        error: error.message,
        type: notificationData.type,
        recipient: notificationData.recipientEmail,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Get notifications with filtering and pagination
   */
  async getNotifications(
    tenantContext: TenantContext,
    filterOptions: NotificationFilterDto = {}
  ): Promise<PaginatedResult<NotificationQueue>> {
    this.logger.info('Retrieving notifications', {
      filterOptions,
      tenantId: tenantContext.tenantId
    });

    try {
      const queryOptions: QueryOptions = {
        limit: filterOptions.limit,
        nextToken: filterOptions.nextToken
      };

      const searchOptions = {
        type: filterOptions.type,
        status: filterOptions.status,
        startDate: filterOptions.startDate,
        endDate: filterOptions.endDate
      };

      const result = await this.notificationRepository.searchNotifications(
        tenantContext,
        searchOptions,
        queryOptions
      );

      this.logger.info('Notifications retrieved successfully', {
        count: result.items.length,
        total: result.total,
        tenantId: tenantContext.tenantId
      });

      return result;
    } catch (error: any) {
      this.logger.error('Failed to retrieve notifications', {
        error: error.message,
        filterOptions,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Get notification by ID
   */
  async getNotificationById(
    tenantContext: TenantContext,
    notificationId: string
  ): Promise<NotificationQueue> {
    this.logger.info('Retrieving notification by ID', {
      notificationId,
      tenantId: tenantContext.tenantId
    });

    const notification = await this.notificationRepository.findById(tenantContext, notificationId);

    if (!notification) {
      throw new FluxionError(
        ErrorCodes.NOT_FOUND,
        'Notification not found',
        404
      );
    }

    return notification;
  }

  /**
   * Retry a failed notification
   */
  async retryNotification(
    tenantContext: TenantContext,
    notificationId: string
  ): Promise<{
    message: string;
    retryAttempt: number;
  }> {
    this.logger.info('Retrying notification', {
      notificationId,
      tenantId: tenantContext.tenantId
    });

    try {
      const notification = await this.getNotificationById(tenantContext, notificationId);

      if (notification.status !== 'failed') {
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR,
          'Only failed notifications can be retried',
          400
        );
      }

      // Update retry count and reset status
      const updatedNotification = await this.notificationRepository.update(
        tenantContext,
        notificationId,
        {
          status: 'pending',
          retryCount: notification.retryCount + 1
        }
      );

      // Send to queue again
      await this.sendToQueue(updatedNotification);

      this.logger.info('Notification retry queued successfully', {
        notificationId,
        retryAttempt: updatedNotification.retryCount,
        tenantId: tenantContext.tenantId
      });

      return {
        message: 'Notification queued for retry',
        retryAttempt: updatedNotification.retryCount
      };
    } catch (error: any) {
      this.logger.error('Failed to retry notification', {
        error: error.message,
        notificationId,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(
    tenantContext: TenantContext,
    period: 'day' | 'week' | 'month' | 'year' = 'month'
  ): Promise<NotificationStatsDto> {
    this.logger.info('Retrieving notification statistics', {
      period,
      tenantId: tenantContext.tenantId
    });

    try {
      const stats = await this.notificationRepository.getStats(tenantContext, period);

      this.logger.info('Notification statistics retrieved successfully', {
        total: stats.total,
        period,
        tenantId: tenantContext.tenantId
      });

      return stats;
    } catch (error: any) {
      this.logger.error('Failed to retrieve notification statistics', {
        error: error.message,
        period,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Send invoice notification
   */
  async sendInvoiceNotification(
    tenantContext: TenantContext,
    invoiceId: string,
    type: 'invoice_sent' | 'payment_reminder' | 'payment_overdue',
    customMessage?: string
  ): Promise<string> {
    this.logger.info('Sending invoice notification', {
      invoiceId,
      type,
      tenantId: tenantContext.tenantId
    });

    try {
      // Import invoice service to get invoice details
      const { InvoiceService } = await import('./modules/invoices/service');
      const invoiceService = new InvoiceService();

      const invoice = await invoiceService.getInvoiceById(tenantContext, invoiceId);

      const templateData = {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.clientName,
        amount: invoice.amount.toString(),
        dueDate: invoice.dueDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
        paymentUrl: `${process.env.FRONTEND_URL || 'https://fluxion.app'}/invoice/${invoice.id}`,
        customMessage: customMessage || '',
        title: invoice.title,
        description: invoice.description
      };

      const result = await this.sendNotification(tenantContext, {
        type,
        recipientEmail: invoice.clientEmail,
        templateData,
        priority: type === 'payment_overdue' ? 'high' : 'medium'
      });

      this.logger.info('Invoice notification sent successfully', {
        invoiceId,
        notificationId: result.notificationId,
        type,
        tenantId: tenantContext.tenantId
      });

      return result.notificationId;
    } catch (error: any) {
      this.logger.error('Failed to send invoice notification', {
        error: error.message,
        invoiceId,
        type,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Send payment notification
   */
  async sendPaymentNotification(
    tenantContext: TenantContext,
    paymentId: string,
    type: 'payment_received' | 'payment_failed'
  ): Promise<string> {
    this.logger.info('Sending payment notification', {
      paymentId,
      type,
      tenantId: tenantContext.tenantId
    });

    try {
      // Import payment and invoice services
      const { PaymentService } = await import('./modules/payments/service');
      const { InvoiceService } = await import('./modules/invoices/service');
      const paymentService = new PaymentService();
      const invoiceService = new InvoiceService();

      const payment = await paymentService.getPaymentById(tenantContext, paymentId);
      const invoice = await invoiceService.getInvoiceById(tenantContext, payment.invoiceId);

      // Get creator's email for payment notifications
      const { UserService } = await import('./modules/users/service');
      const userService = new UserService();
      const creator = await userService.getUserByWallet(tenantContext, invoice.createdBy);

      if (!creator.email) {
        this.logger.warn('Creator email not available for payment notification', {
          paymentId,
          invoiceId: invoice.id,
          creatorWallet: invoice.createdBy
        });
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR,
          'Creator email not available for payment notification',
          400
        );
      }

      const templateData = {
        paymentId: payment.id,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        clientName: invoice.clientName,
        amount: payment.amount.toString(),
        txHash: payment.txHash,
        networkName: payment.networkName || 'Unknown',
        tokenSymbol: payment.tokenSymbol || 'Unknown',
        paymentDate: payment.verifiedAt?.toISOString() || payment.createdAt.toISOString(),
        errorReason: type === 'payment_failed' ? payment.errorMessage : undefined
      };

      const result = await this.sendNotification(tenantContext, {
        type,
        recipientEmail: creator.email,
        templateData,
        priority: 'high'
      });

      this.logger.info('Payment notification sent successfully', {
        paymentId,
        notificationId: result.notificationId,
        type,
        tenantId: tenantContext.tenantId
      });

      return result.notificationId;
    } catch (error: any) {
      this.logger.error('Failed to send payment notification', {
        error: error.message,
        paymentId,
        type,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Process scheduled notifications
   */
  async processScheduledNotifications(): Promise<void> {
    this.logger.info('Processing scheduled notifications');

    try {
      const scheduledNotifications = await this.notificationRepository.getScheduledNotifications();

      for (const notification of scheduledNotifications) {
        try {
          await this.sendToQueue(notification);
          
          // Update status to sent
          await this.notificationRepository.update(
            { tenantId: notification.organizationId, userId: '' }, // Minimal context for scheduled jobs
            notification.id,
            { status: 'sent' }
          );

          this.logger.info('Scheduled notification processed', {
            notificationId: notification.id,
            type: notification.type
          });
        } catch (error: any) {
          this.logger.error('Failed to process scheduled notification', {
            error: error.message,
            notificationId: notification.id
          });

          // Mark as failed
          await this.notificationRepository.update(
            { tenantId: notification.organizationId, userId: '' },
            notification.id,
            { 
              status: 'failed',
              errorMessage: error.message
            }
          );
        }
      }

      this.logger.info('Scheduled notifications processing completed', {
        processed: scheduledNotifications.length
      });
    } catch (error: any) {
      this.logger.error('Failed to process scheduled notifications', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Send notification to SQS queue
   */
  private async sendToQueue(notification: NotificationQueue): Promise<void> {
    try {
      // Map notification types to SQS notification service types
      const typeMap: Record<string, string> = {
        'invoice_sent': 'INVOICE_CREATED',
        'payment_received': 'PAYMENT_RECEIVED',
        'payment_failed': 'PAYMENT_FAILED',
        'payment_reminder': 'INVOICE_REMINDER',
        'payment_overdue': 'INVOICE_REMINDER',
        'invoice_viewed': 'INVOICE_VIEWED'
      };

      const sqsType = typeMap[notification.type] || 'INVOICE_CREATED';

      // Create message for SQS
      const message = {
        type: sqsType,
        data: notification.templateData,
        recipient: notification.recipientEmail,
        priority: notification.priority === 'high' ? 'high' : 
                 notification.priority === 'low' ? 'low' : 'normal'
      };

      // Send to SQS using existing notification service
      await this.sqsNotificationService.sendNotification(message);

      this.logger.info('Notification sent to SQS queue', {
        notificationId: notification.id,
        type: notification.type,
        sqsType
      });
    } catch (error: any) {
      this.logger.error('Failed to send notification to SQS queue', {
        error: error.message,
        notificationId: notification.id,
        type: notification.type
      });
      throw error;
    }
  }
}