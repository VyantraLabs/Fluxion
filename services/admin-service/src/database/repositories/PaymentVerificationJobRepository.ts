import { FindOptionsWhere, In, LessThanOrEqual } from 'typeorm';
import { BaseRepository } from './BaseRepository';
import { PaymentVerificationJob, VerificationStatus, JobPriority, BlockchainTransactionData, VerificationResult } from '../entities/PaymentVerificationJob';
import { TenantContext, PaginatedResult, QueryOptions } from '../../types/common';
import { FluxionError, ErrorCodes } from '../../types/common';

export interface CreateVerificationJobData {
  invoiceId: string;
  networkId: string;
  tokenId?: string;
  txHash: string;
  fromAddress?: string;
  expectedAmount: string;
  expectedRecipient: string;
  priority?: JobPriority;
  metadata?: {
    source?: string;
    userAgent?: string;
    clientIp?: string;
    customData?: Record<string, any>;
  };
}

export interface JobSearchOptions {
  status?: VerificationStatus | VerificationStatus[];
  priority?: JobPriority;
  invoiceId?: string;
  networkId?: string;
  txHash?: string;
  canRetry?: boolean;
}

export class PaymentVerificationJobRepository extends BaseRepository<PaymentVerificationJob> {
  constructor() {
    super(PaymentVerificationJob, 'PaymentVerificationJob');
  }

  /**
   * Create a new payment verification job
   */
  async create(tenantContext: TenantContext, data: CreateVerificationJobData): Promise<PaymentVerificationJob> {
    this.logger.info('Creating payment verification job', { 
      txHash: data.txHash,
      invoiceId: data.invoiceId,
      priority: data.priority || 'normal',
      tenantId: tenantContext.tenantId 
    });

    try {
      // Validate transaction hash format
      if (!PaymentVerificationJob.validateTransactionHash(data.txHash)) {
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR,
          'Invalid transaction hash format',
          400
        );
      }

      // Check for existing job with same transaction hash
      const existingJob = await this.findByTransactionHash(data.txHash);
      if (existingJob && !existingJob.isCompleted) {
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR,
          'Payment verification job already exists for this transaction',
          400
        );
      }

      const jobData = PaymentVerificationJob.createVerificationJob(
        data.invoiceId,
        data.networkId,
        data.txHash,
        data.expectedAmount,
        data.expectedRecipient,
        data.fromAddress,
        data.tokenId,
        data.priority || 'normal'
      );

      // Add metadata
      if (data.metadata) {
        jobData.metadata = {
          ...jobData.metadata,
          ...data.metadata,
          submitTime: new Date().toISOString(),
        };
      }

      const job = await super.create(tenantContext, jobData);

      this.logger.info('Payment verification job created', { 
        jobId: job.id,
        txHash: data.txHash,
        tenantId: tenantContext.tenantId 
      });

      return job;
    } catch (error: any) {
      this.logger.error('Failed to create verification job', { 
        error: error.message,
        txHash: data.txHash,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Find job by transaction hash
   */
  async findByTransactionHash(txHash: string): Promise<PaymentVerificationJob | null> {
    try {
      const job = await this.repository.findOne({
        where: { txHash: txHash.toLowerCase() },
        relations: ['invoice', 'network', 'token', 'payment'],
      });

      return job;
    } catch (error: any) {
      this.logger.error('Failed to find job by transaction hash', { 
        error: error.message,
        txHash 
      });
      throw error;
    }
  }

  /**
   * Find job by ID with relations
   */
  async findById(tenantContext: TenantContext, jobId: string): Promise<PaymentVerificationJob | null> {
    await this.setTenantContext(tenantContext);

    try {
      const job = await this.repository.findOne({
        where: { id: jobId },
        relations: ['invoice', 'network', 'token', 'payment'],
      });

      return job;
    } catch (error: any) {
      this.logger.error('Failed to find job by ID', { 
        error: error.message,
        jobId,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Get pending jobs ready for processing
   */
  async getPendingJobs(limit = 50): Promise<PaymentVerificationJob[]> {
    try {
      const jobs = await this.repository.find({
        where: [
          { status: 'pending' },
          { 
            status: 'failed',
            nextRetryAt: LessThanOrEqual(new Date()),
          }
        ],
        relations: ['invoice', 'network', 'token'],
        order: {
          priority: {
            'urgent': 1,
            'high': 2,
            'normal': 3,
            'low': 4,
          } as any,
          createdAt: 'ASC',
        },
        take: limit,
      });

      // Filter to only jobs that can actually be processed
      const processableJobs = jobs.filter(job => 
        job.status === 'pending' || 
        (job.status === 'failed' && job.canRetry)
      );

      this.logger.info('Retrieved pending verification jobs', { 
        count: processableJobs.length,
        limit 
      });

      return processableJobs;
    } catch (error: any) {
      this.logger.error('Failed to get pending jobs', { 
        error: error.message,
        limit 
      });
      throw error;
    }
  }

  /**
   * Search jobs with filtering and pagination
   */
  async searchJobs(
    tenantContext: TenantContext,
    searchOptions: JobSearchOptions = {},
    queryOptions: QueryOptions = {}
  ): Promise<PaginatedResult<PaymentVerificationJob>> {
    await this.setTenantContext(tenantContext);

    try {
      const queryBuilder = this.repository
        .createQueryBuilder('job')
        .leftJoinAndSelect('job.invoice', 'invoice')
        .leftJoinAndSelect('job.network', 'network')
        .leftJoinAndSelect('job.token', 'token')
        .leftJoinAndSelect('job.payment', 'payment')
        .where('invoice.organization_id = :organizationId', { 
          organizationId: tenantContext.tenantId 
        });

      // Apply search filters
      if (searchOptions.status) {
        if (Array.isArray(searchOptions.status)) {
          queryBuilder.andWhere('job.status IN (:...statuses)', { 
            statuses: searchOptions.status 
          });
        } else {
          queryBuilder.andWhere('job.status = :status', { 
            status: searchOptions.status 
          });
        }
      }

      if (searchOptions.priority) {
        queryBuilder.andWhere('job.priority = :priority', { 
          priority: searchOptions.priority 
        });
      }

      if (searchOptions.invoiceId) {
        queryBuilder.andWhere('job.invoice_id = :invoiceId', { 
          invoiceId: searchOptions.invoiceId 
        });
      }

      if (searchOptions.networkId) {
        queryBuilder.andWhere('job.network_id = :networkId', { 
          networkId: searchOptions.networkId 
        });
      }

      if (searchOptions.txHash) {
        queryBuilder.andWhere('job.tx_hash = :txHash', { 
          txHash: searchOptions.txHash.toLowerCase() 
        });
      }

      if (searchOptions.canRetry) {
        const now = new Date();
        queryBuilder.andWhere('job.status = :status', { status: 'failed' })
          .andWhere('job.retry_count < job.max_retries')
          .andWhere('(job.next_retry_at IS NULL OR job.next_retry_at <= :now)', { now });
      }

      // Apply ordering
      queryBuilder.orderBy('job.created_at', queryOptions.sortDirection === 'asc' ? 'ASC' : 'DESC');

      // Apply pagination
      const take = queryOptions.limit || 20;
      const skip = queryOptions.nextToken ? parseInt(queryOptions.nextToken) : 0;

      queryBuilder.take(take).skip(skip);

      const [jobs, total] = await queryBuilder.getManyAndCount();

      // Generate next token
      let nextToken: string | undefined;
      if (jobs.length === take && skip + jobs.length < total) {
        nextToken = (skip + jobs.length).toString();
      }

      return {
        items: jobs,
        total,
        nextToken,
      };
    } catch (error: any) {
      this.logger.error('Failed to search verification jobs', { 
        error: error.message,
        searchOptions,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Start processing job
   */
  async startJob(jobId: string): Promise<PaymentVerificationJob> {
    try {
      const job = await this.repository.findOne({
        where: { id: jobId },
      });

      if (!job) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Verification job not found', 404);
      }

      if (job.status !== 'pending' && !(job.status === 'failed' && job.canRetry)) {
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR,
          `Cannot start job in status: ${job.status}`,
          400
        );
      }

      job.start();
      const updatedJob = await this.repository.save(job);

      this.logger.info('Verification job started', { 
        jobId,
        txHash: job.txHash 
      });

      return updatedJob;
    } catch (error: any) {
      this.logger.error('Failed to start job', { 
        error: error.message,
        jobId 
      });
      throw error;
    }
  }

  /**
   * Mark job as verifying
   */
  async markAsVerifying(jobId: string): Promise<PaymentVerificationJob> {
    try {
      const job = await this.repository.findOne({
        where: { id: jobId },
      });

      if (!job) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Verification job not found', 404);
      }

      job.markAsVerifying();
      const updatedJob = await this.repository.save(job);

      this.logger.info('Job marked as verifying', { 
        jobId,
        txHash: job.txHash 
      });

      return updatedJob;
    } catch (error: any) {
      this.logger.error('Failed to mark job as verifying', { 
        error: error.message,
        jobId 
      });
      throw error;
    }
  }

  /**
   * Complete job successfully
   */
  async completeJob(
    jobId: string,
    result: VerificationResult,
    transactionData: BlockchainTransactionData,
    paymentId?: string
  ): Promise<PaymentVerificationJob> {
    try {
      const job = await this.repository.findOne({
        where: { id: jobId },
      });

      if (!job) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Verification job not found', 404);
      }

      job.complete(result, transactionData, paymentId);
      const updatedJob = await this.repository.save(job);

      this.logger.info('Verification job completed', { 
        jobId,
        txHash: job.txHash,
        isValid: result.isValid,
        paymentCreated: !!paymentId 
      });

      return updatedJob;
    } catch (error: any) {
      this.logger.error('Failed to complete job', { 
        error: error.message,
        jobId 
      });
      throw error;
    }
  }

  /**
   * Fail job with error
   */
  async failJob(jobId: string, error: string, errorCode?: string): Promise<PaymentVerificationJob> {
    try {
      const job = await this.repository.findOne({
        where: { id: jobId },
      });

      if (!job) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Verification job not found', 404);
      }

      job.fail(error, errorCode);
      const updatedJob = await this.repository.save(job);

      this.logger.info('Verification job failed', { 
        jobId,
        txHash: job.txHash,
        retryCount: job.retryCount,
        canRetry: job.canRetry,
        error 
      });

      return updatedJob;
    } catch (error: any) {
      this.logger.error('Failed to mark job as failed', { 
        error: error.message,
        jobId 
      });
      throw error;
    }
  }

  /**
   * Cancel job
   */
  async cancelJob(jobId: string, reason?: string): Promise<void> {
    try {
      const job = await this.repository.findOne({
        where: { id: jobId },
      });

      if (!job) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Verification job not found', 404);
      }

      if (job.isCompleted) {
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR,
          'Cannot cancel completed job',
          400
        );
      }

      job.cancel(reason);
      await this.repository.save(job);

      this.logger.info('Verification job cancelled', { 
        jobId,
        txHash: job.txHash,
        reason 
      });
    } catch (error: any) {
      this.logger.error('Failed to cancel job', { 
        error: error.message,
        jobId 
      });
      throw error;
    }
  }

  /**
   * Update verification data
   */
  async updateVerificationData(
    jobId: string,
    data: Partial<BlockchainTransactionData>
  ): Promise<PaymentVerificationJob> {
    try {
      const job = await this.repository.findOne({
        where: { id: jobId },
      });

      if (!job) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Verification job not found', 404);
      }

      job.updateVerificationData(data);
      const updatedJob = await this.repository.save(job);

      this.logger.debug('Job verification data updated', { 
        jobId,
        confirmations: data.confirmations,
        blockNumber: data.blockNumber 
      });

      return updatedJob;
    } catch (error: any) {
      this.logger.error('Failed to update verification data', { 
        error: error.message,
        jobId 
      });
      throw error;
    }
  }

  /**
   * Record webhook delivery
   */
  async recordWebhookDelivery(
    jobId: string,
    success: boolean,
    statusCode?: number,
    error?: string
  ): Promise<void> {
    try {
      const job = await this.repository.findOne({
        where: { id: jobId },
      });

      if (!job) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Verification job not found', 404);
      }

      job.recordWebhookDelivery(success, statusCode, error);
      await this.repository.save(job);

      this.logger.info('Webhook delivery recorded', { 
        jobId,
        success,
        statusCode 
      });
    } catch (error: any) {
      this.logger.error('Failed to record webhook delivery', { 
        error: error.message,
        jobId 
      });
      throw error;
    }
  }

  /**
   * Get job statistics
   */
  async getJobStats(tenantContext: TenantContext, days = 30): Promise<{
    total: number;
    completed: number;
    failed: number;
    pending: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    averageProcessingTime: number;
    successRate: number;
    retryRate: number;
  }> {
    await this.setTenantContext(tenantContext);

    try {
      const sinceDate = new Date();
      sinceDate.setDate(sinceDate.getDate() - days);

      const jobs = await this.repository
        .createQueryBuilder('job')
        .leftJoin('job.invoice', 'invoice')
        .where('invoice.organization_id = :organizationId', { 
          organizationId: tenantContext.tenantId 
        })
        .andWhere('job.created_at >= :sinceDate', { sinceDate })
        .getMany();

      const total = jobs.length;
      const completed = jobs.filter(j => j.status === 'completed').length;
      const failed = jobs.filter(j => j.status === 'failed').length;
      const pending = jobs.filter(j => j.isPending).length;

      // Count by status
      const byStatus: Record<string, number> = {};
      jobs.forEach(j => {
        byStatus[j.status] = (byStatus[j.status] || 0) + 1;
      });

      // Count by priority
      const byPriority: Record<string, number> = {};
      jobs.forEach(j => {
        byPriority[j.priority] = (byPriority[j.priority] || 0) + 1;
      });

      // Calculate average processing time
      const completedJobs = jobs.filter(j => j.processingDuration !== null);
      const totalProcessingTime = completedJobs.reduce((sum, j) => sum + (j.processingDuration || 0), 0);
      const averageProcessingTime = completedJobs.length > 0 ? totalProcessingTime / completedJobs.length : 0;

      const successRate = total > 0 ? (completed / total) * 100 : 0;
      const jobsWithRetries = jobs.filter(j => j.retryCount > 0).length;
      const retryRate = total > 0 ? (jobsWithRetries / total) * 100 : 0;

      return {
        total,
        completed,
        failed,
        pending,
        byStatus,
        byPriority,
        averageProcessingTime,
        successRate,
        retryRate,
      };
    } catch (error: any) {
      this.logger.error('Failed to get job stats', { 
        error: error.message,
        days,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Clean up old completed jobs
   */
  async cleanupOldJobs(daysOld = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await this.repository.delete({
        completedAt: LessThanOrEqual(cutoffDate),
        status: In(['completed', 'cancelled']),
      });

      const deletedCount = result.affected || 0;
      
      this.logger.info('Old verification jobs cleaned up', { 
        deletedCount,
        daysOld,
      });

      return deletedCount;
    } catch (error: any) {
      this.logger.error('Failed to cleanup old jobs', { 
        error: error.message,
        daysOld,
      });
      throw error;
    }
  }

  /**
   * Get jobs by invoice
   */
  async getJobsByInvoice(tenantContext: TenantContext, invoiceId: string): Promise<PaymentVerificationJob[]> {
    await this.setTenantContext(tenantContext);

    try {
      const jobs = await this.repository.find({
        where: { invoiceId },
        relations: ['network', 'token', 'payment'],
        order: { createdAt: 'DESC' },
      });

      return jobs;
    } catch (error: any) {
      this.logger.error('Failed to get jobs by invoice', { 
        error: error.message,
        invoiceId,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }
}