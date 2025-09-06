/**
 * Background job processing service for payment verification, scheduled notifications, and reminder escalation
 * Handles blockchain transaction verification, automated reminders, and job scheduling
 */

import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { config } from '../config';
import {
  PaymentVerificationJob,
  ScheduledNotificationJob,
  ReminderEscalationJob,
  BackgroundJob,
  NotificationType,
  NotificationMetadata,
  SQSNotificationMessage,
  BlockchainServiceConfig
} from '../types/notifications';

/**
 * Job processing results
 */
interface JobProcessingResult {
  jobId: string;
  status: 'completed' | 'failed' | 'retry';
  result?: any;
  error?: string;
  nextRetryAt?: string;
  processingTimeMs: number;
}

/**
 * Blockchain network configuration
 */
const BLOCKCHAIN_NETWORKS: BlockchainServiceConfig['networks'] = {
  1: {
    name: 'Ethereum',
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.alchemyapi.io/v2/demo',
    explorerUrl: 'https://etherscan.io',
    currency: 'ETH'
  },
  137: {
    name: 'Polygon',
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    currency: 'MATIC'
  },
  42161: {
    name: 'Arbitrum',
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    currency: 'ETH'
  },
  8453: {
    name: 'Base',
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    currency: 'ETH'
  }
};

/**
 * ERC-20 ABI for token balance and transfer verification
 */
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

/**
 * Background job processing service
 */
export class BackgroundJobsService {
  private providers: Map<number, ethers.JsonRpcProvider> = new Map();
  private jobQueue: Map<string, BackgroundJob> = new Map();
  private processingJobs: Set<string> = new Set();

  constructor() {
    this.initializeBlockchainProviders();
    logger.info('Background jobs service initialized', {
      supportedNetworks: Object.keys(BLOCKCHAIN_NETWORKS),
      providersCount: this.providers.size
    });
  }

  /**
   * Initialize blockchain providers for all supported networks
   */
  private initializeBlockchainProviders(): void {
    for (const [networkId, networkConfig] of Object.entries(BLOCKCHAIN_NETWORKS)) {
      try {
        const provider = new ethers.JsonRpcProvider(networkConfig.rpcUrl, {
          chainId: parseInt(networkId),
          name: networkConfig.name
        });
        
        this.providers.set(parseInt(networkId), provider);
        logger.info('Blockchain provider initialized', {
          networkId: parseInt(networkId),
          name: networkConfig.name,
          rpcUrl: networkConfig.rpcUrl
        });
      } catch (error) {
        logger.error('Failed to initialize blockchain provider', {
          networkId: parseInt(networkId),
          name: networkConfig.name,
          error: error instanceof Error ? error.message : error
        });
      }
    }
  }

  /**
   * Process a background job based on its type
   */
  async processJob(job: BackgroundJob): Promise<JobProcessingResult> {
    const startTime = Date.now();
    
    // Prevent duplicate processing
    if (this.processingJobs.has(job.jobId)) {
      logger.warn('Job already being processed', { jobId: job.jobId });
      return {
        jobId: job.jobId,
        status: 'failed',
        error: 'Job already in progress',
        processingTimeMs: Date.now() - startTime
      };
    }

    this.processingJobs.add(job.jobId);
    
    try {
      logger.info('Processing background job', {
        jobId: job.jobId,
        type: job.type,
        metadata: job.metadata
      });

      let result: JobProcessingResult;

      switch (job.type) {
        case 'payment_verification':
          result = await this.processPaymentVerificationJob(job as PaymentVerificationJob);
          break;
        case 'scheduled_notification':
          result = await this.processScheduledNotificationJob(job as ScheduledNotificationJob);
          break;
        case 'reminder_escalation':
          result = await this.processReminderEscalationJob(job as ReminderEscalationJob);
          break;
        default:
          result = {
            jobId: job.jobId,
            status: 'failed',
            error: `Unknown job type: ${(job as any).type}`,
            processingTimeMs: Date.now() - startTime
          };
      }

      result.processingTimeMs = Date.now() - startTime;
      
      logger.info('Background job processing completed', {
        jobId: job.jobId,
        status: result.status,
        processingTimeMs: result.processingTimeMs
      });

      return result;
    } catch (error) {
      const result: JobProcessingResult = {
        jobId: job.jobId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTimeMs: Date.now() - startTime
      };

      logger.error('Background job processing failed', {
        jobId: job.jobId,
        type: job.type,
        error: result.error,
        processingTimeMs: result.processingTimeMs
      });

      return result;
    } finally {
      this.processingJobs.delete(job.jobId);
    }
  }

  /**
   * Process payment verification job
   */
  private async processPaymentVerificationJob(job: PaymentVerificationJob): Promise<JobProcessingResult> {
    logger.info('Processing payment verification job', {
      jobId: job.jobId,
      invoiceId: job.invoiceId,
      transactionHash: job.transactionHash,
      networkId: job.networkId
    });

    try {
      // Get blockchain provider for the network
      const provider = this.providers.get(job.networkId);
      if (!provider) {
        throw new Error(`Unsupported network ID: ${job.networkId}`);
      }

      // Get transaction receipt
      const receipt = await provider.getTransactionReceipt(job.transactionHash);
      if (!receipt) {
        // Transaction not found or not yet confirmed
        if (job.retryAttempt < 5) { // Retry for up to 5 attempts
          return {
            jobId: job.jobId,
            status: 'retry',
            error: 'Transaction not yet confirmed',
            nextRetryAt: new Date(Date.now() + 30000).toISOString() // Retry in 30 seconds
          };
        } else {
          throw new Error('Transaction not found after maximum retries');
        }
      }

      // Verify transaction success
      if (receipt.status !== 1) {
        throw new Error('Transaction failed on blockchain');
      }

      // Get transaction details
      const transaction = await provider.getTransaction(job.transactionHash);
      if (!transaction) {
        throw new Error('Transaction details not found');
      }

      // Verify transaction parameters
      const verification = await this.verifyPaymentTransaction(
        transaction,
        receipt,
        job.expectedAmount,
        job.expectedRecipient,
        job.tokenAddress,
        provider
      );

      if (!verification.valid) {
        throw new Error(`Payment verification failed: ${verification.reason}`);
      }

      logger.info('Payment verification successful', {
        jobId: job.jobId,
        transactionHash: job.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString()
      });

      // Return success with verification details
      return {
        jobId: job.jobId,
        status: 'completed',
        result: {
          verified: true,
          transactionHash: job.transactionHash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          actualAmount: verification.actualAmount,
          actualRecipient: verification.actualRecipient,
          confirmations: await provider.getBlockNumber() - receipt.blockNumber
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Payment verification failed', {
        jobId: job.jobId,
        transactionHash: job.transactionHash,
        networkId: job.networkId,
        error: errorMessage,
        retryAttempt: job.retryAttempt
      });

      // Determine if we should retry
      const retryableErrors = ['Transaction not yet confirmed', 'Network error', 'RPC error'];
      const shouldRetry = job.retryAttempt < 3 && retryableErrors.some(err => errorMessage.includes(err));

      if (shouldRetry) {
        return {
          jobId: job.jobId,
          status: 'retry',
          error: errorMessage,
          nextRetryAt: new Date(Date.now() + Math.pow(2, job.retryAttempt) * 60000).toISOString()
        };
      }

      return {
        jobId: job.jobId,
        status: 'failed',
        error: errorMessage
      };
    }
  }

  /**
   * Process scheduled notification job
   */
  private async processScheduledNotificationJob(job: ScheduledNotificationJob): Promise<JobProcessingResult> {
    logger.info('Processing scheduled notification job', {
      jobId: job.jobId,
      type: job.notificationType,
      scheduleAt: job.scheduleAt,
      recipient: job.recipientEmail.replace(/(.{3}).*@/, '$1***@')
    });

    try {
      // Check if it's time to send the notification
      const scheduleTime = new Date(job.scheduleAt);
      const now = new Date();

      if (now < scheduleTime) {
        // Not yet time to send, reschedule
        return {
          jobId: job.jobId,
          status: 'retry',
          error: 'Notification not yet scheduled',
          nextRetryAt: job.scheduleAt
        };
      }

      // Create SQS notification message
      const notificationMessage: SQSNotificationMessage = {
        type: job.notificationType,
        recipientEmail: job.recipientEmail,
        templateData: job.templateData,
        channels: job.channels,
        priority: 'medium',
        metadata: job.metadata
      };

      // Here you would typically send the message to SQS
      // For now, we'll simulate successful scheduling
      logger.info('Scheduled notification sent', {
        jobId: job.jobId,
        type: job.notificationType,
        recipient: job.recipientEmail.replace(/(.{3}).*@/, '$1***@')
      });

      return {
        jobId: job.jobId,
        status: 'completed',
        result: {
          notificationType: job.notificationType,
          recipient: job.recipientEmail,
          sentAt: now.toISOString()
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Scheduled notification job failed', {
        jobId: job.jobId,
        error: errorMessage
      });

      return {
        jobId: job.jobId,
        status: 'failed',
        error: errorMessage
      };
    }
  }

  /**
   * Process reminder escalation job
   */
  private async processReminderEscalationJob(job: ReminderEscalationJob): Promise<JobProcessingResult> {
    logger.info('Processing reminder escalation job', {
      jobId: job.jobId,
      invoiceId: job.invoiceId,
      escalationLevel: job.escalationLevel,
      daysPastDue: job.daysPastDue
    });

    try {
      // Determine the notification type based on escalation level
      let notificationType: NotificationType;
      let urgencyLevel: string;

      if (job.escalationLevel === 1) {
        notificationType = 'payment_reminder';
        urgencyLevel = 'firm';
      } else if (job.escalationLevel === 2) {
        notificationType = 'payment_overdue';
        urgencyLevel = 'urgent';
      } else {
        notificationType = 'payment_overdue';
        urgencyLevel = 'critical';
      }

      // Create escalated notification data
      const escalatedTemplateData = {
        ...job.metadata,
        invoiceId: job.invoiceId,
        escalationLevel: job.escalationLevel,
        daysPastDue: job.daysPastDue,
        urgencyLevel,
        lastReminderSent: job.lastReminderSent,
        currentYear: new Date().getFullYear()
      };

      logger.info('Reminder escalation processed', {
        jobId: job.jobId,
        invoiceId: job.invoiceId,
        escalationLevel: job.escalationLevel,
        notificationType
      });

      return {
        jobId: job.jobId,
        status: 'completed',
        result: {
          invoiceId: job.invoiceId,
          escalationLevel: job.escalationLevel,
          notificationType,
          processedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Reminder escalation job failed', {
        jobId: job.jobId,
        invoiceId: job.invoiceId,
        error: errorMessage
      });

      return {
        jobId: job.jobId,
        status: 'failed',
        error: errorMessage
      };
    }
  }

  /**
   * Verify payment transaction details
   */
  private async verifyPaymentTransaction(
    transaction: ethers.TransactionResponse,
    receipt: ethers.TransactionReceipt,
    expectedAmount: string,
    expectedRecipient: string,
    tokenAddress: string,
    provider: ethers.JsonRpcProvider
  ): Promise<{
    valid: boolean;
    reason?: string;
    actualAmount?: string;
    actualRecipient?: string;
  }> {
    try {
      // For native token transfers (ETH, MATIC, etc.)
      if (!tokenAddress || tokenAddress === ethers.ZeroAddress) {
        const actualAmount = transaction.value.toString();
        const actualRecipient = transaction.to || '';

        if (actualRecipient.toLowerCase() !== expectedRecipient.toLowerCase()) {
          return {
            valid: false,
            reason: 'Recipient address mismatch',
            actualAmount,
            actualRecipient
          };
        }

        if (actualAmount !== expectedAmount) {
          return {
            valid: false,
            reason: 'Amount mismatch',
            actualAmount,
            actualRecipient
          };
        }

        return {
          valid: true,
          actualAmount,
          actualRecipient
        };
      }

      // For ERC-20 token transfers
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      
      // Find Transfer event in the logs
      const transferEvents = receipt.logs
        .filter(log => log.address.toLowerCase() === tokenAddress.toLowerCase())
        .map(log => {
          try {
            return tokenContract.interface.parseLog({
              topics: log.topics,
              data: log.data
            });
          } catch {
            return null;
          }
        })
        .filter(event => event?.name === 'Transfer');

      if (transferEvents.length === 0) {
        return {
          valid: false,
          reason: 'No Transfer event found'
        };
      }

      // Get the Transfer event (assuming the first one is the payment)
      const transferEvent = transferEvents[0];
      if (!transferEvent) {
        return {
          valid: false,
          reason: 'Transfer event parsing failed'
        };
      }

      const actualRecipient = transferEvent.args.to;
      const actualAmount = transferEvent.args.value.toString();

      // Verify recipient
      if (actualRecipient.toLowerCase() !== expectedRecipient.toLowerCase()) {
        return {
          valid: false,
          reason: 'Recipient address mismatch',
          actualAmount,
          actualRecipient
        };
      }

      // Verify amount
      if (actualAmount !== expectedAmount) {
        return {
          valid: false,
          reason: 'Amount mismatch',
          actualAmount,
          actualRecipient
        };
      }

      return {
        valid: true,
        actualAmount,
        actualRecipient
      };

    } catch (error) {
      logger.error('Payment verification error', {
        transactionHash: transaction.hash,
        error: error instanceof Error ? error.message : error
      });

      return {
        valid: false,
        reason: `Verification error: ${error instanceof Error ? error.message : error}`
      };
    }
  }

  /**
   * Get service health and statistics
   */
  getServiceHealth() {
    const networkHealth = Array.from(this.providers.entries()).map(([networkId, provider]) => ({
      networkId,
      name: BLOCKCHAIN_NETWORKS[networkId]?.name || 'Unknown',
      status: 'connected' // In real implementation, you'd check connectivity
    }));

    return {
      serviceName: 'BackgroundJobsService',
      status: 'healthy',
      networks: networkHealth,
      activeJobs: this.processingJobs.size,
      queuedJobs: this.jobQueue.size
    };
  }

  /**
   * Add job to processing queue
   */
  addJob(job: BackgroundJob): void {
    this.jobQueue.set(job.jobId, job);
    logger.info('Job added to queue', {
      jobId: job.jobId,
      type: job.type,
      queueSize: this.jobQueue.size
    });
  }

  /**
   * Get next job from queue
   */
  getNextJob(): BackgroundJob | null {
    const jobs = Array.from(this.jobQueue.values());
    if (jobs.length === 0) return null;

    // Simple FIFO for now - in production you might prioritize by job type or metadata
    const nextJob = jobs[0];
    this.jobQueue.delete(nextJob.jobId);
    
    return nextJob;
  }

  /**
   * Clear completed jobs from memory (would typically persist to database)
   */
  cleanup(): void {
    // In production, you'd persist job results to database and clean up memory
    logger.info('Background jobs cleanup completed', {
      processedJobs: this.processingJobs.size,
      queuedJobs: this.jobQueue.size
    });
  }
}

// Singleton instance
export const backgroundJobsService = new BackgroundJobsService();