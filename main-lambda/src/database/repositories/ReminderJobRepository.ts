import { Repository, SelectQueryBuilder } from 'typeorm';
import { BaseRepository } from './BaseRepository';
import { ReminderJob, ReminderType, ReminderStatus } from '@/database/entities/ReminderJob';
import { TenantContext, PaginatedResult, QueryOptions } from '@/types/common';
import { Logger } from '@/shared/utils/logger';

export interface CreateReminderJobData {
  organizationId: string;
  invoiceId: string;
  userId?: string;
  type: ReminderType;
  configuration: any;
  priority?: string;
  scheduledFor: Date;
  maxOccurrences?: number;
  status?: ReminderStatus;
  metadata?: any;
}

export interface UpdateReminderJobData {
  status?: ReminderStatus;
  priority?: string;
  scheduledFor?: Date;
  configuration?: any;
  maxOccurrences?: number;
  sentAt?: Date;
  occurrenceCount?: number;
  retryCount?: number;
  nextRetryAt?: Date;
  notificationId?: string;
  errorMessage?: string;
  errorCode?: string;
  metadata?: any;
}

export interface ReminderSearchOptions {
  status?: ReminderStatus;
  type?: ReminderType;
  invoiceId?: string;
  priority?: string;
  scheduledFrom?: Date;
  scheduledTo?: Date;
  isOverdue?: boolean;
}

export interface ReminderStatsResult {
  total: number;
  byStatus: Record<ReminderStatus, number>;
  byType: Record<ReminderType, number>;
  overdueCount: number;
}

export interface ReminderEffectivenessResult {
  paymentRate: number;
  avgResponseTime: number;
}

export class ReminderJobRepository extends BaseRepository<ReminderJob> {
  protected entityName = 'ReminderJob';
  private logger = new Logger('ReminderJobRepository');

  constructor() {
    super(ReminderJob);
  }

  /**
   * Create a new reminder job
   */
  async create(tenantContext: TenantContext, data: CreateReminderJobData): Promise<ReminderJob> {
    this.logger.info('Creating reminder job', {
      invoiceId: data.invoiceId,
      type: data.type,
      tenantId: tenantContext.tenantId
    });

    const reminder = this.repository.create({
      ...data,
      organizationId: tenantContext.tenantId,
    });

    const savedReminder = await this.repository.save(reminder);

    this.logger.info('Reminder job created successfully', {
      reminderId: savedReminder.id,
      tenantId: tenantContext.tenantId
    });

    return savedReminder;
  }

  /**
   * Update a reminder job
   */
  async update(
    tenantContext: TenantContext,
    reminderId: string,
    updates: UpdateReminderJobData
  ): Promise<ReminderJob> {
    this.logger.info('Updating reminder job', {
      reminderId,
      tenantId: tenantContext.tenantId
    });

    await this.repository.update(
      { id: reminderId, organizationId: tenantContext.tenantId },
      { ...updates, updatedAt: new Date() }
    );

    const updatedReminder = await this.findById(tenantContext, reminderId);
    if (!updatedReminder) {
      throw new Error('Reminder not found after update');
    }

    this.logger.info('Reminder job updated successfully', {
      reminderId,
      tenantId: tenantContext.tenantId
    });

    return updatedReminder;
  }

  /**
   * Find reminder by ID
   */
  async findById(tenantContext: TenantContext, reminderId: string): Promise<ReminderJob | null> {
    return this.repository.findOne({
      where: { id: reminderId, organizationId: tenantContext.tenantId },
      relations: ['organization', 'invoice', 'user'],
    });
  }

  /**
   * Find all reminders for a specific invoice
   */
  async findByInvoiceId(tenantContext: TenantContext, invoiceId: string): Promise<ReminderJob[]> {
    return this.repository.find({
      where: { invoiceId, organizationId: tenantContext.tenantId },
      order: { scheduledFor: 'ASC' },
      relations: ['invoice'],
    });
  }

  /**
   * Find reminders that are due for execution
   */
  async findDueReminders(tenantContext: TenantContext): Promise<ReminderJob[]> {
    const now = new Date();

    return this.repository
      .createQueryBuilder('reminder')
      .where('reminder.organizationId = :organizationId', { organizationId: tenantContext.tenantId })
      .andWhere('reminder.status IN (:...statuses)', { statuses: ['scheduled', 'pending'] })
      .andWhere('reminder.scheduledFor <= :now', { now })
      .orderBy('reminder.priority', 'DESC')
      .addOrderBy('reminder.scheduledFor', 'ASC')
      .getMany();
  }

  /**
   * Find overdue reminders (past scheduled time and still pending)
   */
  async findOverdueReminders(tenantContext: TenantContext): Promise<ReminderJob[]> {
    const overdueThreshold = new Date();
    overdueThreshold.setMinutes(overdueThreshold.getMinutes() - 30); // 30 minutes grace period

    return this.repository
      .createQueryBuilder('reminder')
      .where('reminder.organizationId = :organizationId', { organizationId: tenantContext.tenantId })
      .andWhere('reminder.status = :status', { status: 'scheduled' })
      .andWhere('reminder.scheduledFor < :threshold', { threshold: overdueThreshold })
      .orderBy('reminder.scheduledFor', 'ASC')
      .getMany();
  }

  /**
   * Search reminders with filters and pagination
   */
  async searchReminders(
    tenantContext: TenantContext,
    filters: ReminderSearchOptions,
    options: QueryOptions = {}
  ): Promise<PaginatedResult<ReminderJob>> {
    this.logger.info('Searching reminders', {
      filters,
      tenantId: tenantContext.tenantId
    });

    const qb = this.repository
      .createQueryBuilder('reminder')
      .leftJoinAndSelect('reminder.invoice', 'invoice')
      .leftJoinAndSelect('reminder.user', 'user')
      .where('reminder.organizationId = :organizationId', { organizationId: tenantContext.tenantId });

    // Apply filters
    if (filters.status) {
      qb.andWhere('reminder.status = :status', { status: filters.status });
    }

    if (filters.type) {
      qb.andWhere('reminder.type = :type', { type: filters.type });
    }

    if (filters.invoiceId) {
      qb.andWhere('reminder.invoiceId = :invoiceId', { invoiceId: filters.invoiceId });
    }

    if (filters.priority) {
      qb.andWhere('reminder.priority = :priority', { priority: filters.priority });
    }

    if (filters.scheduledFrom) {
      qb.andWhere('reminder.scheduledFor >= :scheduledFrom', { scheduledFrom: filters.scheduledFrom });
    }

    if (filters.scheduledTo) {
      qb.andWhere('reminder.scheduledFor <= :scheduledTo', { scheduledTo: filters.scheduledTo });
    }

    if (filters.isOverdue !== undefined) {
      const now = new Date();
      if (filters.isOverdue) {
        qb.andWhere('reminder.scheduledFor < :now', { now })
          .andWhere('reminder.status IN (:...pendingStatuses)', { pendingStatuses: ['scheduled', 'pending'] });
      } else {
        qb.andWhere('(reminder.scheduledFor >= :now OR reminder.status NOT IN (:...pendingStatuses))', { 
          now, 
          pendingStatuses: ['scheduled', 'pending'] 
        });
      }
    }

    // Apply sorting
    qb.orderBy('reminder.priority', 'DESC')
      .addOrderBy('reminder.scheduledFor', 'ASC')
      .addOrderBy('reminder.createdAt', 'DESC');

    // Apply pagination
    const limit = Math.min(options.limit || 20, 100);
    let offset = 0;

    if (options.nextToken) {
      try {
        const decodedToken = Buffer.from(options.nextToken, 'base64').toString('utf-8');
        offset = parseInt(decodedToken, 10) || 0;
      } catch (error) {
        this.logger.warn('Invalid pagination token', { token: options.nextToken });
      }
    }

    const [items, total] = await qb
      .skip(offset)
      .take(limit + 1) // Take one extra to check for more results
      .getManyAndCount();

    const hasMore = items.length > limit;
    if (hasMore) {
      items.pop(); // Remove the extra item
    }

    const nextToken = hasMore 
      ? Buffer.from((offset + limit).toString()).toString('base64')
      : undefined;

    this.logger.info('Reminders search completed', {
      total,
      returned: items.length,
      hasMore,
      tenantId: tenantContext.tenantId
    });

    return {
      items,
      total,
      nextToken,
      hasMore,
    };
  }

  /**
   * Get reminder statistics
   */
  async getReminderStats(tenantContext: TenantContext): Promise<ReminderStatsResult> {
    this.logger.info('Getting reminder statistics', { tenantId: tenantContext.tenantId });

    const qb = this.repository
      .createQueryBuilder('reminder')
      .where('reminder.organizationId = :organizationId', { organizationId: tenantContext.tenantId });

    // Get total count
    const total = await qb.getCount();

    // Get counts by status
    const statusCounts = await qb
      .select('reminder.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('reminder.status')
      .getRawMany();

    const byStatus: Record<ReminderStatus, number> = {
      scheduled: 0,
      pending: 0,
      processing: 0,
      sent: 0,
      failed: 0,
      cancelled: 0,
      skipped: 0,
    };

    statusCounts.forEach(row => {
      byStatus[row.status as ReminderStatus] = parseInt(row.count, 10);
    });

    // Get counts by type
    const typeCounts = await this.repository
      .createQueryBuilder('reminder')
      .select('reminder.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('reminder.organizationId = :organizationId', { organizationId: tenantContext.tenantId })
      .groupBy('reminder.type')
      .getRawMany();

    const byType: Record<ReminderType, number> = {
      due_date: 0,
      overdue: 0,
      payment_pending: 0,
      custom: 0,
    };

    typeCounts.forEach(row => {
      byType[row.type as ReminderType] = parseInt(row.count, 10);
    });

    // Get overdue count
    const now = new Date();
    const overdueCount = await this.repository
      .createQueryBuilder('reminder')
      .where('reminder.organizationId = :organizationId', { organizationId: tenantContext.tenantId })
      .andWhere('reminder.status IN (:...statuses)', { statuses: ['scheduled', 'pending'] })
      .andWhere('reminder.scheduledFor < :now', { now })
      .getCount();

    this.logger.info('Reminder statistics calculated', {
      total,
      overdueCount,
      tenantId: tenantContext.tenantId
    });

    return {
      total,
      byStatus,
      byType,
      overdueCount,
    };
  }

  /**
   * Get reminder effectiveness metrics
   */
  async getReminderEffectiveness(tenantContext: TenantContext): Promise<ReminderEffectivenessResult> {
    this.logger.info('Calculating reminder effectiveness', { tenantId: tenantContext.tenantId });

    // Query to get payment rate after reminders
    const paymentRateQuery = `
      SELECT 
        COUNT(CASE WHEN i.status = 'paid' THEN 1 END) as paid_after_reminder,
        COUNT(*) as total_invoices_with_reminders
      FROM reminder_jobs r
      INNER JOIN invoices i ON r.invoice_id = i.id
      WHERE r.organization_id = $1 
        AND r.status = 'sent'
        AND r.sent_at IS NOT NULL
    `;

    // Query to get average response time (days between reminder sent and payment)
    const responseTimeQuery = `
      SELECT 
        AVG(EXTRACT(DAY FROM (i.paid_at - r.sent_at))) as avg_response_days
      FROM reminder_jobs r
      INNER JOIN invoices i ON r.invoice_id = i.id
      WHERE r.organization_id = $1
        AND r.status = 'sent'
        AND r.sent_at IS NOT NULL
        AND i.paid_at IS NOT NULL
        AND i.paid_at > r.sent_at
    `;

    try {
      const paymentRateResult = await this.repository.manager.query(
        paymentRateQuery, 
        [tenantContext.tenantId]
      );

      const responseTimeResult = await this.repository.manager.query(
        responseTimeQuery,
        [tenantContext.tenantId]
      );

      const paidAfterReminder = parseInt(paymentRateResult[0]?.paid_after_reminder || '0', 10);
      const totalWithReminders = parseInt(paymentRateResult[0]?.total_invoices_with_reminders || '0', 10);
      const avgResponseDays = parseFloat(responseTimeResult[0]?.avg_response_days || '0');

      const paymentRate = totalWithReminders > 0 ? paidAfterReminder / totalWithReminders : 0;

      this.logger.info('Reminder effectiveness calculated', {
        paidAfterReminder,
        totalWithReminders,
        paymentRate,
        avgResponseTime: avgResponseDays,
        tenantId: tenantContext.tenantId
      });

      return {
        paymentRate: Math.round(paymentRate * 100) / 100, // Round to 2 decimal places
        avgResponseTime: Math.round(avgResponseDays * 10) / 10, // Round to 1 decimal place
      };
    } catch (error) {
      this.logger.error('Failed to calculate reminder effectiveness', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tenantId: tenantContext.tenantId
      });

      return {
        paymentRate: 0,
        avgResponseTime: 0,
      };
    }
  }

  /**
   * Find reminders that need retry (failed but can be retried)
   */
  async findRetryableReminders(tenantContext: TenantContext): Promise<ReminderJob[]> {
    const now = new Date();

    return this.repository
      .createQueryBuilder('reminder')
      .where('reminder.organizationId = :organizationId', { organizationId: tenantContext.tenantId })
      .andWhere('reminder.status = :status', { status: 'failed' })
      .andWhere('reminder.retryCount < reminder.maxRetries')
      .andWhere('(reminder.nextRetryAt IS NULL OR reminder.nextRetryAt <= :now)', { now })
      .orderBy('reminder.priority', 'DESC')
      .addOrderBy('reminder.nextRetryAt', 'ASC')
      .getMany();
  }

  /**
   * Clean up old completed reminders (for maintenance)
   */
  async cleanupOldReminders(
    tenantContext: TenantContext, 
    olderThanDays: number = 90
  ): Promise<{ deleted: number }> {
    this.logger.info('Cleaning up old reminders', {
      olderThanDays,
      tenantId: tenantContext.tenantId
    });

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .from(ReminderJob)
      .where('organizationId = :organizationId', { organizationId: tenantContext.tenantId })
      .andWhere('status IN (:...completedStatuses)', { completedStatuses: ['sent', 'cancelled', 'skipped'] })
      .andWhere('updatedAt < :cutoffDate', { cutoffDate })
      .execute();

    const deleted = result.affected || 0;

    this.logger.info('Old reminders cleanup completed', {
      deleted,
      cutoffDate: cutoffDate.toISOString(),
      tenantId: tenantContext.tenantId
    });

    return { deleted };
  }

  /**
   * Get upcoming reminders (scheduled for the next few days)
   */
  async getUpcomingReminders(
    tenantContext: TenantContext,
    daysAhead: number = 7
  ): Promise<ReminderJob[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.repository
      .createQueryBuilder('reminder')
      .leftJoinAndSelect('reminder.invoice', 'invoice')
      .where('reminder.organizationId = :organizationId', { organizationId: tenantContext.tenantId })
      .andWhere('reminder.status IN (:...statuses)', { statuses: ['scheduled', 'pending'] })
      .andWhere('reminder.scheduledFor BETWEEN :now AND :futureDate', { now, futureDate })
      .orderBy('reminder.scheduledFor', 'ASC')
      .getMany();
  }

  /**
   * Update reminder status in bulk
   */
  async bulkUpdateStatus(
    tenantContext: TenantContext,
    reminderIds: string[],
    status: ReminderStatus,
    additionalUpdates?: Partial<UpdateReminderJobData>
  ): Promise<{ updated: number }> {
    if (reminderIds.length === 0) {
      return { updated: 0 };
    }

    this.logger.info('Bulk updating reminder status', {
      count: reminderIds.length,
      status,
      tenantId: tenantContext.tenantId
    });

    const updates = {
      status,
      updatedAt: new Date(),
      ...additionalUpdates,
    };

    const result = await this.repository
      .createQueryBuilder()
      .update(ReminderJob)
      .set(updates)
      .where('id IN (:...reminderIds)', { reminderIds })
      .andWhere('organizationId = :organizationId', { organizationId: tenantContext.tenantId })
      .execute();

    const updated = result.affected || 0;

    this.logger.info('Bulk status update completed', {
      updated,
      tenantId: tenantContext.tenantId
    });

    return { updated };
  }
}