import { FindOptionsWhere, In, LessThanOrEqual, MoreThan } from 'typeorm';
import { BaseRepository } from './BaseRepository';
import { NotificationQueue, NotificationType, NotificationStatus, NotificationPriority, EmailTemplateData } from '@/database/entities/NotificationQueue';
import { TenantContext, PaginatedResult, QueryOptions } from '@/types/common';
import { FluxionError, ErrorCodes } from '@/types/common';

export interface CreateNotificationData {
  invoiceId?: string;
  userId?: string;
  type: NotificationType;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  emailTemplate?: string;
  templateData: EmailTemplateData;
  priority?: NotificationPriority;
  scheduledFor?: Date;
  maxRetries?: number;
  metadata?: {
    source?: string;
    campaign?: string;
    tags?: string[];
  };
}

export interface NotificationSearchOptions {
  status?: NotificationStatus | NotificationStatus[];
  type?: NotificationType | NotificationType[];
  priority?: NotificationPriority;
  invoiceId?: string;
  userId?: string;
  scheduledBefore?: Date;
  scheduledAfter?: Date;
  recipientEmail?: string;
}

export class NotificationQueueRepository extends BaseRepository<NotificationQueue> {
  constructor() {
    super(NotificationQueue, 'NotificationQueue');
  }

  /**
   * Create a new notification
   */
  async create(tenantContext: TenantContext, data: CreateNotificationData): Promise<NotificationQueue> {
    this.logger.info('Creating notification', { 
      type: data.type,
      recipientEmail: data.recipientEmail,
      tenantId: tenantContext.tenantId 
    });

    try {
      const notification = await super.create(tenantContext, {
        ...data,
        organizationId: tenantContext.tenantId,
        status: 'pending',
        priority: data.priority || 'normal',
        scheduledFor: data.scheduledFor || new Date(),
        maxRetries: data.maxRetries || 3,
        retryCount: 0,
        metadata: {
          ...data.metadata,
          source: data.metadata?.source || 'system',
        },
      });

      this.logger.info('Notification created', { 
        notificationId: notification.id,
        type: data.type,
        tenantId: tenantContext.tenantId 
      });

      return notification;
    } catch (error: any) {
      this.logger.error('Failed to create notification', { 
        error: error.message,
        type: data.type,
        recipientEmail: data.recipientEmail,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Get pending notifications ready to be processed
   */
  async getPendingNotifications(limit = 50): Promise<NotificationQueue[]> {
    try {
      const now = new Date();
      const notifications = await this.repository.find({
        where: {
          status: 'pending',
          scheduledFor: LessThanOrEqual(now),
        },
        relations: ['organization', 'invoice', 'user'],
        order: {
          priority: {
            'urgent': 1,
            'high': 2,
            'normal': 3,
            'low': 4,
          } as any,
          scheduledFor: 'ASC',
        },
        take: limit,
      });

      this.logger.info('Retrieved pending notifications', { 
        count: notifications.length,
        limit 
      });

      return notifications;
    } catch (error: any) {
      this.logger.error('Failed to get pending notifications', { 
        error: error.message,
        limit 
      });
      throw error;
    }
  }

  /**
   * Get failed notifications that can be retried
   */
  async getRetriableNotifications(limit = 50): Promise<NotificationQueue[]> {
    try {
      const now = new Date();
      const notifications = await this.repository.find({
        where: {
          status: 'failed',
          nextRetryAt: LessThanOrEqual(now),
        },
        relations: ['organization', 'invoice', 'user'],
        order: {
          priority: {
            'urgent': 1,
            'high': 2,
            'normal': 3,
            'low': 4,
          } as any,
          nextRetryAt: 'ASC',
        },
        take: limit,
      });

      // Filter only those that can actually be retried
      const retriableNotifications = notifications.filter(n => n.canRetry);

      this.logger.info('Retrieved retriable notifications', { 
        count: retriableNotifications.length,
        limit 
      });

      return retriableNotifications;
    } catch (error: any) {
      this.logger.error('Failed to get retriable notifications', { 
        error: error.message,
        limit 
      });
      throw error;
    }
  }

  /**
   * Search notifications with filtering and pagination
   */
  async searchNotifications(
    tenantContext: TenantContext,
    searchOptions: NotificationSearchOptions = {},
    queryOptions: QueryOptions = {}
  ): Promise<PaginatedResult<NotificationQueue>> {
    await this.setTenantContext(tenantContext);

    try {
      const where: FindOptionsWhere<NotificationQueue> = {
        organizationId: tenantContext.tenantId,
      };

      // Apply search filters
      if (searchOptions.status) {
        if (Array.isArray(searchOptions.status)) {
          where.status = In(searchOptions.status);
        } else {
          where.status = searchOptions.status;
        }
      }

      if (searchOptions.type) {
        if (Array.isArray(searchOptions.type)) {
          where.type = In(searchOptions.type);
        } else {
          where.type = searchOptions.type;
        }
      }

      if (searchOptions.priority) {
        where.priority = searchOptions.priority;
      }

      if (searchOptions.invoiceId) {
        where.invoiceId = searchOptions.invoiceId;
      }

      if (searchOptions.userId) {
        where.userId = searchOptions.userId;
      }

      if (searchOptions.recipientEmail) {
        where.recipientEmail = searchOptions.recipientEmail;
      }

      if (searchOptions.scheduledBefore) {
        where.scheduledFor = LessThanOrEqual(searchOptions.scheduledBefore);
      }

      if (searchOptions.scheduledAfter) {
        where.scheduledFor = MoreThan(searchOptions.scheduledAfter);
      }

      const [notifications, total] = await this.repository.findAndCount({
        where,
        relations: ['invoice', 'user'],
        order: { 
          createdAt: queryOptions.sortDirection === 'asc' ? 'ASC' : 'DESC' 
        },
        take: queryOptions.limit || 20,
        skip: queryOptions.nextToken ? parseInt(queryOptions.nextToken) : 0,
      });

      // Generate next token for pagination
      let nextToken: string | undefined;
      const offset = (queryOptions.nextToken ? parseInt(queryOptions.nextToken) : 0);
      if (notifications.length === (queryOptions.limit || 20) && offset + notifications.length < total) {
        nextToken = (offset + notifications.length).toString();
      }

      return {
        items: notifications,
        total,
        nextToken,
      };
    } catch (error: any) {
      this.logger.error('Failed to search notifications', { 
        error: error.message,
        searchOptions,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Update notification status
   */
  async updateStatus(
    id: string, 
    status: NotificationStatus, 
    errorMessage?: string,
    errorCode?: string,
    providerId?: string
  ): Promise<NotificationQueue> {
    try {
      const notification = await this.repository.findOne({
        where: { id },
      });

      if (!notification) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Notification not found', 404);
      }

      switch (status) {
        case 'processing':
          notification.markAsProcessing();
          break;
        case 'sent':
          notification.markAsSent(providerId);
          break;
        case 'failed':
          notification.markAsFailed(errorMessage || 'Unknown error', errorCode);
          break;
        case 'cancelled':
          notification.markAsCancelled();
          break;
      }

      const updatedNotification = await this.repository.save(notification);

      this.logger.info('Notification status updated', { 
        notificationId: id,
        oldStatus: notification.status,
        newStatus: status,
      });

      return updatedNotification;
    } catch (error: any) {
      this.logger.error('Failed to update notification status', { 
        error: error.message,
        notificationId: id,
        newStatus: status,
      });
      throw error;
    }
  }

  /**
   * Reschedule notification
   */
  async reschedule(
    tenantContext: TenantContext,
    id: string, 
    newScheduledDate: Date
  ): Promise<NotificationQueue> {
    await this.setTenantContext(tenantContext);

    try {
      const notification = await this.repository.findOne({
        where: { 
          id,
          organizationId: tenantContext.tenantId,
        },
      });

      if (!notification) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Notification not found', 404);
      }

      notification.reschedule(newScheduledDate);
      const updatedNotification = await this.repository.save(notification);

      this.logger.info('Notification rescheduled', { 
        notificationId: id,
        newScheduledDate,
        tenantId: tenantContext.tenantId 
      });

      return updatedNotification;
    } catch (error: any) {
      this.logger.error('Failed to reschedule notification', { 
        error: error.message,
        notificationId: id,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Cancel notification
   */
  async cancel(tenantContext: TenantContext, id: string, reason?: string): Promise<void> {
    await this.setTenantContext(tenantContext);

    try {
      const notification = await this.repository.findOne({
        where: { 
          id,
          organizationId: tenantContext.tenantId,
        },
      });

      if (!notification) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Notification not found', 404);
      }

      if (notification.status === 'sent') {
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR, 
          'Cannot cancel notification that has already been sent', 
          400
        );
      }

      notification.markAsCancelled();
      if (reason) {
        notification.errorMessage = reason;
      }

      await this.repository.save(notification);

      this.logger.info('Notification cancelled', { 
        notificationId: id,
        reason,
        tenantId: tenantContext.tenantId 
      });
    } catch (error: any) {
      this.logger.error('Failed to cancel notification', { 
        error: error.message,
        notificationId: id,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Get notification statistics for organization
   */
  async getNotificationStats(tenantContext: TenantContext, days = 30): Promise<{
    total: number;
    sent: number;
    failed: number;
    pending: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    averageRetryCount: number;
    successRate: number;
  }> {
    await this.setTenantContext(tenantContext);

    try {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);

      const notifications = await this.repository.find({
        where: {
          organizationId: tenantContext.tenantId,
          createdAt: MoreThan(sinceDate),
        },
      });

      const total = notifications.length;
      const sent = notifications.filter(n => n.status === 'sent').length;
      const failed = notifications.filter(n => n.status === 'failed').length;
      const pending = notifications.filter(n => n.status === 'pending').length;

      // Count by type
      const byType: Record<string, number> = {};
      notifications.forEach(n => {
        byType[n.type] = (byType[n.type] || 0) + 1;
      });

      // Count by status
      const byStatus: Record<string, number> = {};
      notifications.forEach(n => {
        byStatus[n.status] = (byStatus[n.status] || 0) + 1;
      });

      const totalRetries = notifications.reduce((sum, n) => sum + n.retryCount, 0);
      const averageRetryCount = total > 0 ? totalRetries / total : 0;
      const successRate = total > 0 ? (sent / total) * 100 : 0;

      return {
        total,
        sent,
        failed,
        pending,
        byType,
        byStatus,
        averageRetryCount,
        successRate,
      };
    } catch (error: any) {
      this.logger.error('Failed to get notification stats', { 
        error: error.message,
        days,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Clean up old notifications
   */
  async cleanupOldNotifications(daysOld = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await this.repository.delete({
        createdAt: LessThanOrEqual(cutoffDate),
        status: In(['sent', 'cancelled', 'failed']),
      });

      const deletedCount = result.affected || 0;
      
      this.logger.info('Old notifications cleaned up', { 
        deletedCount,
        daysOld,
      });

      return deletedCount;
    } catch (error: any) {
      this.logger.error('Failed to cleanup old notifications', { 
        error: error.message,
        daysOld,
      });
      throw error;
    }
  }

  /**
   * Bulk update notification status
   */
  async bulkUpdateStatus(
    ids: string[], 
    status: NotificationStatus,
    errorMessage?: string
  ): Promise<number> {
    try {
      const updateData: Partial<NotificationQueue> = { status };
      
      if (status === 'sent') {
        updateData.sentAt = new Date();
      } else if (status === 'failed' && errorMessage) {
        updateData.errorMessage = errorMessage;
      }

      const result = await this.repository.update(
        { id: In(ids) },
        updateData
      );

      const updatedCount = result.affected || 0;

      this.logger.info('Bulk notification status update', { 
        updatedCount,
        newStatus: status,
        totalRequested: ids.length,
      });

      return updatedCount;
    } catch (error: any) {
      this.logger.error('Failed to bulk update notification status', { 
        error: error.message,
        idsCount: ids.length,
        newStatus: status,
      });
      throw error;
    }
  }

  /**
   * Create invoice-related notifications
   */
  static createInvoiceSent(
    organizationId: string,
    invoiceId: string,
    recipientEmail: string,
    templateData: EmailTemplateData,
    scheduledFor?: Date
  ): CreateNotificationData {
    return {
      type: 'invoice_sent',
      invoiceId,
      recipientEmail,
      recipientName: templateData.recipientName,
      subject: `Invoice ${templateData.invoiceNumber} - ${templateData.invoiceTitle}`,
      emailTemplate: 'invoice_sent',
      templateData,
      priority: 'normal',
      scheduledFor: scheduledFor || new Date(),
      metadata: {
        source: 'invoice_send',
        tags: ['invoice', 'client_communication'],
      },
    };
  }

  static createPaymentReceived(
    organizationId: string,
    invoiceId: string,
    recipientEmail: string,
    templateData: EmailTemplateData
  ): CreateNotificationData {
    return {
      type: 'payment_received',
      invoiceId,
      recipientEmail,
      recipientName: templateData.recipientName,
      subject: `Payment Received - Invoice ${templateData.invoiceNumber}`,
      emailTemplate: 'payment_received',
      templateData,
      priority: 'high',
      scheduledFor: new Date(),
      metadata: {
        source: 'payment_verification',
        tags: ['payment', 'confirmation'],
      },
    };
  }

  static createReminder(
    organizationId: string,
    invoiceId: string,
    recipientEmail: string,
    templateData: EmailTemplateData,
    scheduledFor: Date
  ): CreateNotificationData {
    return {
      type: 'reminder',
      invoiceId,
      recipientEmail,
      recipientName: templateData.recipientName,
      subject: `Reminder: Invoice ${templateData.invoiceNumber} Due ${templateData.invoiceDueDate}`,
      emailTemplate: 'invoice_reminder',
      templateData,
      priority: 'normal',
      scheduledFor,
      metadata: {
        source: 'reminder_scheduler',
        tags: ['reminder', 'due_date'],
      },
    };
  }
}