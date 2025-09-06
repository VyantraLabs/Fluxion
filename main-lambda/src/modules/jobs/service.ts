import { PaymentVerificationJobRepository } from '@/database/repositories/PaymentVerificationJobRepository';
import { PaymentVerificationJob } from '@/database/entities/PaymentVerificationJob';
import { TenantContext, PaginatedResult } from '@/types/common';
import { FluxionError, ErrorCodes } from '@/types/common';
import { Logger } from '@/shared/utils/logger';

export type JobType = 'payment_verification' | 'email_delivery' | 'reminder_processing' | 'scheduled_notifications';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TriggerJobDto {
  jobType: JobType;
  parameters?: Record<string, any>;
}

export interface JobFilterDto {
  limit?: number;
  nextToken?: string;
  status?: JobStatus;
  jobType?: JobType;
}

export interface JobStatsDto {
  total: number;
  byStatus: Record<JobStatus, number>;
  byType: Record<JobType, number>;
  successRate: number;
  averageProcessingTime: number;
}

export class BackgroundJobService {
  private jobRepository: PaymentVerificationJobRepository;
  private logger: Logger;

  constructor() {
    this.jobRepository = new PaymentVerificationJobRepository();
    this.logger = new Logger('BackgroundJobService');
  }

  /**
   * Trigger a background job
   */
  async triggerJob(
    tenantContext: TenantContext,
    jobType: JobType,
    parameters?: Record<string, any>
  ): Promise<{
    jobId: string;
    status: JobStatus;
    message: string;
  }> {
    this.logger.info('Triggering background job', {
      jobType,
      parameters,
      adminUser: tenantContext.userId
    });

    try {
      // Route job to appropriate processor
      let jobId: string;
      let message: string;

      switch (jobType) {
        case 'payment_verification':
          jobId = await this.triggerPaymentVerification(tenantContext, parameters);
          message = 'Payment verification job queued';
          break;
        
        case 'email_delivery':
          jobId = await this.triggerEmailDelivery(tenantContext, parameters);
          message = 'Email delivery job queued';
          break;
        
        case 'reminder_processing':
          jobId = await this.triggerReminderProcessing(tenantContext, parameters);
          message = 'Reminder processing job queued';
          break;
        
        case 'scheduled_notifications':
          jobId = await this.triggerScheduledNotifications(tenantContext, parameters);
          message = 'Scheduled notifications job queued';
          break;
        
        default:
          throw new FluxionError(
            ErrorCodes.VALIDATION_ERROR,
            `Unsupported job type: ${jobType}`,
            400
          );
      }

      this.logger.info('Background job triggered successfully', {
        jobId,
        jobType,
        adminUser: tenantContext.userId
      });

      return {
        jobId,
        status: 'queued',
        message
      };
    } catch (error: any) {
      this.logger.error('Failed to trigger background job', {
        error: error.message,
        jobType,
        parameters,
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }

  /**
   * Get background jobs with filtering and pagination
   */
  async getJobs(
    tenantContext: TenantContext,
    filterOptions: JobFilterDto = {}
  ): Promise<PaginatedResult<PaymentVerificationJob>> {
    this.logger.info('Retrieving background jobs', {
      filterOptions,
      adminUser: tenantContext.userId
    });

    try {
      // For now, we're using PaymentVerificationJob as the main job entity
      // In a full implementation, you'd have a generic Job entity
      const result = await this.jobRepository.searchJobs(tenantContext, {
        status: filterOptions.status,
        limit: filterOptions.limit,
        nextToken: filterOptions.nextToken
      });

      this.logger.info('Background jobs retrieved successfully', {
        count: result.items.length,
        total: result.total,
        adminUser: tenantContext.userId
      });

      return result;
    } catch (error: any) {
      this.logger.error('Failed to retrieve background jobs', {
        error: error.message,
        filterOptions,
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }

  /**
   * Get background job by ID
   */
  async getJobById(
    tenantContext: TenantContext,
    jobId: string
  ): Promise<PaymentVerificationJob> {
    this.logger.info('Retrieving background job by ID', {
      jobId,
      adminUser: tenantContext.userId
    });

    const job = await this.jobRepository.findById(tenantContext, jobId);

    if (!job) {
      throw new FluxionError(
        ErrorCodes.NOT_FOUND,
        'Background job not found',
        404
      );
    }

    return job;
  }

  /**
   * Retry a failed background job
   */
  async retryJob(
    tenantContext: TenantContext,
    jobId: string
  ): Promise<{
    message: string;
    newJobId: string;
  }> {
    this.logger.info('Retrying background job', {
      jobId,
      adminUser: tenantContext.userId
    });

    try {
      const job = await this.getJobById(tenantContext, jobId);

      if (job.status !== 'failed') {
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR,
          'Only failed jobs can be retried',
          400
        );
      }

      // Create a new job with the same parameters
      const newJob = await this.jobRepository.create(tenantContext, {
        invoiceId: job.invoiceId,
        paymentId: job.paymentId,
        priority: job.priority,
        maxRetries: job.maxRetries,
        retryCount: 0,
        status: 'queued'
      });

      // Start processing the new job
      await this.processPaymentVerificationJob(tenantContext, newJob.id);

      this.logger.info('Background job retry queued successfully', {
        originalJobId: jobId,
        newJobId: newJob.id,
        adminUser: tenantContext.userId
      });

      return {
        message: 'Job queued for retry',
        newJobId: newJob.id
      };
    } catch (error: any) {
      this.logger.error('Failed to retry background job', {
        error: error.message,
        jobId,
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }

  /**
   * Get background job statistics
   */
  async getJobStats(
    tenantContext: TenantContext,
    period: 'hour' | 'day' | 'week' | 'month' = 'day'
  ): Promise<JobStatsDto> {
    this.logger.info('Retrieving background job statistics', {
      period,
      adminUser: tenantContext.userId
    });

    try {
      const stats = await this.jobRepository.getJobStats(tenantContext, period);

      this.logger.info('Background job statistics retrieved successfully', {
        total: stats.total,
        period,
        adminUser: tenantContext.userId
      });

      return stats;
    } catch (error: any) {
      this.logger.error('Failed to retrieve background job statistics', {
        error: error.message,
        period,
        adminUser: tenantContext.userId
      });
      throw error;
    }
  }

  /**
   * Process payment verification jobs
   */
  async processPaymentVerificationJobs(): Promise<void> {
    this.logger.info('Processing payment verification jobs');

    try {
      const queuedJobs = await this.jobRepository.getQueuedJobs();

      for (const job of queuedJobs) {
        try {
          await this.processPaymentVerificationJob(
            { tenantId: job.organizationId, userId: '' },
            job.id
          );
        } catch (error: any) {
          this.logger.error('Failed to process payment verification job', {
            error: error.message,
            jobId: job.id
          });
        }
      }

      this.logger.info('Payment verification jobs processing completed', {
        processed: queuedJobs.length
      });
    } catch (error: any) {
      this.logger.error('Failed to process payment verification jobs', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Process reminder jobs
   */
  async processReminderJobs(): Promise<void> {
    this.logger.info('Processing reminder jobs');

    try {
      // Import invoice service to find overdue invoices
      const { InvoiceService } = await import('@/modules/invoices/service');
      const invoiceService = new InvoiceService();

      // Get all organizations to process reminders for each tenant
      const { OrganizationRepository } = await import('@/database/repositories/OrganizationRepository');
      const orgRepository = new OrganizationRepository();
      const organizations = await orgRepository.findAll();

      let totalRemindersProcessed = 0;

      for (const org of organizations) {
        try {
          const tenantContext = { tenantId: org.id, userId: '' };
          
          // Find invoices that need reminders
          const overdueInvoices = await invoiceService.getOverdueInvoices(tenantContext);
          const dueSoonInvoices = await invoiceService.getDueSoonInvoices(tenantContext);

          // Process overdue reminders
          for (const invoice of overdueInvoices) {
            await this.sendPaymentReminder(tenantContext, invoice.id, 'overdue');
          }

          // Process due soon reminders
          for (const invoice of dueSoonInvoices) {
            await this.sendPaymentReminder(tenantContext, invoice.id, 'due_soon');
          }

          totalRemindersProcessed += overdueInvoices.length + dueSoonInvoices.length;
        } catch (error: any) {
          this.logger.error('Failed to process reminders for organization', {
            error: error.message,
            organizationId: org.id
          });
        }
      }

      this.logger.info('Reminder jobs processing completed', {
        totalRemindersProcessed
      });
    } catch (error: any) {
      this.logger.error('Failed to process reminder jobs', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Trigger payment verification job
   */
  private async triggerPaymentVerification(
    tenantContext: TenantContext,
    parameters?: Record<string, any>
  ): Promise<string> {
    if (!parameters?.invoiceId && !parameters?.paymentId) {
      throw new FluxionError(
        ErrorCodes.VALIDATION_ERROR,
        'Either invoiceId or paymentId is required for payment verification',
        400
      );
    }

    const job = await this.jobRepository.create(tenantContext, {
      invoiceId: parameters.invoiceId,
      paymentId: parameters.paymentId,
      priority: parameters.priority || 'medium',
      maxRetries: parameters.maxRetries || 3,
      retryCount: 0,
      status: 'queued'
    });

    // Start processing immediately
    setImmediate(() => {
      this.processPaymentVerificationJob(tenantContext, job.id).catch(error => {
        this.logger.error('Failed to process payment verification job', {
          error: error.message,
          jobId: job.id
        });
      });
    });

    return job.id;
  }

  /**
   * Trigger email delivery job
   */
  private async triggerEmailDelivery(
    tenantContext: TenantContext,
    parameters?: Record<string, any>
  ): Promise<string> {
    if (!parameters?.notificationId && !parameters?.invoiceId) {
      throw new FluxionError(
        ErrorCodes.VALIDATION_ERROR,
        'Either notificationId or invoiceId is required for email delivery',
        400
      );
    }

    // For email delivery, we'll use the notification system
    const { NotificationService } = await import('@/modules/notifications/service');
    const notificationService = new NotificationService();

    let notificationId: string;

    if (parameters.invoiceId) {
      // Send invoice notification
      notificationId = await notificationService.sendInvoiceNotification(
        tenantContext,
        parameters.invoiceId,
        parameters.type || 'invoice_sent',
        parameters.customMessage
      );
    } else {
      // Retry existing notification
      const result = await notificationService.retryNotification(
        tenantContext,
        parameters.notificationId
      );
      notificationId = parameters.notificationId;
    }

    return notificationId;
  }

  /**
   * Trigger reminder processing job
   */
  private async triggerReminderProcessing(
    tenantContext: TenantContext,
    parameters?: Record<string, any>
  ): Promise<string> {
    const jobId = `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Start reminder processing
    setImmediate(() => {
      this.processReminderJobs().catch(error => {
        this.logger.error('Failed to process reminder jobs', {
          error: error.message,
          jobId
        });
      });
    });

    return jobId;
  }

  /**
   * Trigger scheduled notifications job
   */
  private async triggerScheduledNotifications(
    tenantContext: TenantContext,
    parameters?: Record<string, any>
  ): Promise<string> {
    const jobId = `scheduled_notifications_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Process scheduled notifications
    const { NotificationService } = await import('@/modules/notifications/service');
    const notificationService = new NotificationService();

    setImmediate(() => {
      notificationService.processScheduledNotifications().catch(error => {
        this.logger.error('Failed to process scheduled notifications', {
          error: error.message,
          jobId
        });
      });
    });

    return jobId;
  }

  /**
   * Process individual payment verification job
   */
  private async processPaymentVerificationJob(
    tenantContext: TenantContext,
    jobId: string
  ): Promise<void> {
    this.logger.info('Processing payment verification job', { jobId });

    try {
      const job = await this.jobRepository.findById(tenantContext, jobId);
      if (!job) return;

      // Mark job as running
      await this.jobRepository.update(tenantContext, jobId, {
        status: 'running',
        startedAt: new Date()
      });

      // Import payment service to verify payment
      const { PaymentService } = await import('@/modules/payments/service');
      const paymentService = new PaymentService();

      let result: any;

      if (job.paymentId) {
        // Verify specific payment
        result = await paymentService.verifyPayment(tenantContext, job.paymentId);
      } else if (job.invoiceId) {
        // Verify all pending payments for invoice
        result = await paymentService.verifyInvoicePayments(tenantContext, job.invoiceId);
      }

      // Mark job as completed
      await this.jobRepository.update(tenantContext, jobId, {
        status: 'completed',
        completedAt: new Date(),
        result: result
      });

      this.logger.info('Payment verification job completed successfully', { jobId });
    } catch (error: any) {
      this.logger.error('Payment verification job failed', {
        error: error.message,
        jobId
      });

      // Mark job as failed and increment retry count
      const job = await this.jobRepository.findById(tenantContext, jobId);
      if (job && job.retryCount < job.maxRetries) {
        // Retry the job
        await this.jobRepository.update(tenantContext, jobId, {
          status: 'queued',
          retryCount: job.retryCount + 1
        });

        // Schedule retry with exponential backoff
        const retryDelay = Math.pow(2, job.retryCount) * 1000; // 1s, 2s, 4s, 8s...
        setTimeout(() => {
          this.processPaymentVerificationJob(tenantContext, jobId);
        }, retryDelay);
      } else {
        // Max retries reached, mark as failed
        await this.jobRepository.update(tenantContext, jobId, {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: error.message
        });
      }
    }
  }

  /**
   * Send payment reminder
   */
  private async sendPaymentReminder(
    tenantContext: TenantContext,
    invoiceId: string,
    reminderType: 'due_soon' | 'overdue'
  ): Promise<void> {
    try {
      const { NotificationService } = await import('@/modules/notifications/service');
      const notificationService = new NotificationService();

      const notificationType = reminderType === 'overdue' ? 'payment_overdue' : 'payment_reminder';

      await notificationService.sendInvoiceNotification(
        tenantContext,
        invoiceId,
        notificationType
      );

      this.logger.info('Payment reminder sent', {
        invoiceId,
        reminderType,
        tenantId: tenantContext.tenantId
      });
    } catch (error: any) {
      this.logger.error('Failed to send payment reminder', {
        error: error.message,
        invoiceId,
        reminderType,
        tenantId: tenantContext.tenantId
      });
    }
  }
}