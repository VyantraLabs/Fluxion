import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
  Check,
  BeforeInsert,
} from 'typeorm';
import { ulid } from 'ulid';
import { Invoice } from './Invoice';
import { BlockchainNetwork } from './BlockchainNetwork';
import { Token } from './Token';
import { Payment } from './Payment';

export type VerificationStatus = 'pending' | 'processing' | 'verifying' | 'completed' | 'failed' | 'cancelled';

export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface BlockchainTransactionData {
  blockNumber?: string;
  blockHash?: string;
  transactionIndex?: number;
  confirmations?: number;
  requiredConfirmations?: number;
  gasUsed?: string;
  gasPrice?: string;
  transactionFee?: string;
  status?: 'success' | 'failed';
  timestamp?: string;
  fromAddress?: string;
  toAddress?: string;
  value?: string;
  tokenAddress?: string;
  tokenAmount?: string;
  logs?: any[];
  receipt?: any;
}

export interface VerificationResult {
  isValid: boolean;
  amountMatch: boolean;
  recipientMatch: boolean;
  tokenMatch: boolean;
  networkMatch: boolean;
  sufficientConfirmations: boolean;
  reason?: string;
  actualAmount?: string;
  actualRecipient?: string;
  actualToken?: string;
  actualSender?: string;
}

@Entity('payment_verification_jobs')
@Index(['invoiceId'])
@Index(['chainId'])
@Index(['txHash'])
@Index(['status'])
@Index(['priority'])
@Index(['nextRetryAt'])
@Index(['status', 'nextRetryAt'])
@Index(['priority', 'createdAt'])
@Check('retry_count_positive', 'retry_count >= 0')
@Check('retry_count_max', 'retry_count <= 20')
@Check('tx_hash_format', "tx_hash ~* '^0x[a-fA-F0-9]{64}$'")
export class PaymentVerificationJob {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ name: 'invoice_id', type: 'varchar', nullable: false })
  invoiceId!: string;

  @Column({ name: 'chain_id', type: 'integer', nullable: false })
  chainId!: number;

  @Column({ name: 'token_id', type: 'varchar', nullable: true })
  tokenId?: string;

  @Column({ name: 'tx_hash', type: 'varchar', length: 66, nullable: false })
  txHash!: string;

  @Column({ name: 'from_address', type: 'varchar', length: 42, nullable: true })
  fromAddress?: string;

  @Column({ name: 'expected_amount', type: 'decimal', precision: 36, scale: 18, nullable: false })
  expectedAmount!: string;

  @Column({ name: 'expected_recipient', type: 'varchar', length: 42, nullable: false })
  expectedRecipient!: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: VerificationStatus;

  @Column({ type: 'varchar', length: 10, default: 'normal' })
  priority!: JobPriority;

  @Column({ name: 'retry_count', type: 'integer', default: 0 })
  retryCount!: number;

  @Column({ name: 'max_retries', type: 'integer', default: 10 })
  maxRetries!: number;

  @Column({ name: 'next_retry_at', type: 'timestamptz', nullable: true })
  nextRetryAt?: Date;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt?: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'error_code', type: 'varchar', length: 50, nullable: true })
  errorCode?: string;

  @Column({ name: 'verification_data', type: 'jsonb', nullable: true })
  verificationData?: BlockchainTransactionData;

  @Column({ name: 'verification_result', type: 'jsonb', nullable: true })
  verificationResult?: VerificationResult;

  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId?: string; // Links to created Payment record if successful

  @Column({ name: 'webhook_delivered', type: 'boolean', default: false })
  webhookDelivered!: boolean;

  @Column({ name: 'notification_sent', type: 'boolean', default: false })
  notificationSent!: boolean;

  @Column({ type: 'jsonb', default: {}, nullable: false })
  metadata!: {
    source?: string; // mobile, web, api
    userAgent?: string;
    clientIp?: string;
    submitTime?: string;
    processingSteps?: Array<{
      step: string;
      timestamp: string;
      duration?: number;
      status: 'started' | 'completed' | 'failed';
      details?: any;
    }>;
    retryHistory?: Array<{
      attempt: number;
      timestamp: string;
      errorCode?: string;
      errorMessage?: string;
      blockNumber?: string;
      confirmations?: number;
    }>;
    webhookAttempts?: Array<{
      timestamp: string;
      status: 'success' | 'failed';
      statusCode?: number;
      error?: string;
    }>;
    customData?: Record<string, any>;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => Invoice, invoice => invoice.verificationJobs, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invoice_id' })
  invoice!: Invoice;

  @ManyToOne(() => BlockchainNetwork, { nullable: false })
  @JoinColumn({ name: 'chain_id' })
  network!: BlockchainNetwork;

  @ManyToOne(() => Token, { nullable: true })
  @JoinColumn({ name: 'token_id' })
  token?: Token;

  @ManyToOne(() => Payment, { nullable: true })
  @JoinColumn({ name: 'payment_id' })
  payment?: Payment;

  // Computed properties
  get isCompleted(): boolean {
    return this.status === 'completed' || this.status === 'failed' || this.status === 'cancelled';
  }

  get canRetry(): boolean {
    return this.status === 'failed' && 
           this.retryCount < this.maxRetries &&
           (!this.nextRetryAt || new Date() >= this.nextRetryAt);
  }

  get isPending(): boolean {
    return this.status === 'pending' || 
           (this.status === 'failed' && this.canRetry);
  }

  get processingDuration(): number | null {
    if (!this.startedAt || !this.completedAt) return null;
    return this.completedAt.getTime() - this.startedAt.getTime();
  }

  get confirmations(): number {
    return this.verificationData?.confirmations || 0;
  }

  get requiredConfirmations(): number {
    return this.verificationData?.requiredConfirmations || 12; // Default confirmations required
  }

  get hasMinConfirmations(): boolean {
    return this.confirmations >= this.requiredConfirmations;
  }

  get isHighPriority(): boolean {
    return this.priority === 'high' || this.priority === 'urgent';
  }

  get retryHistory(): Array<any> {
    return this.metadata.retryHistory || [];
  }

  get processingSteps(): Array<any> {
    return this.metadata.processingSteps || [];
  }

  // Methods
  start(): void {
    this.status = 'processing';
    this.startedAt = new Date();
    this.addProcessingStep('job_started', 'started');
  }

  markAsVerifying(): void {
    this.status = 'verifying';
    this.addProcessingStep('verification_started', 'started');
  }

  complete(result: VerificationResult, transactionData: BlockchainTransactionData, paymentId?: string): void {
    this.status = 'completed';
    this.completedAt = new Date();
    this.verificationResult = result;
    this.verificationData = transactionData;
    if (paymentId) this.paymentId = paymentId;
    
    this.addProcessingStep('verification_completed', 'completed', {
      isValid: result.isValid,
      paymentCreated: !!paymentId,
    });
  }

  fail(error: string, errorCode?: string): void {
    this.status = 'failed';
    this.errorMessage = error;
    this.errorCode = errorCode;
    this.retryCount += 1;
    
    this.recordRetryAttempt(errorCode, error);
    this.addProcessingStep('verification_failed', 'failed', { error, errorCode });

    if (this.canRetry) {
      this.scheduleRetry();
    }
  }

  cancel(reason?: string): void {
    this.status = 'cancelled';
    this.completedAt = new Date();
    this.errorMessage = reason;
    
    this.addProcessingStep('job_cancelled', 'completed', { reason });
  }

  scheduleRetry(delayMinutes?: number): void {
    if (this.retryCount >= this.maxRetries) {
      return;
    }

    // Exponential backoff with jitter: base 2^retry_count minutes + random jitter
    const baseDelay = delayMinutes || Math.pow(2, Math.min(this.retryCount, 8)); // Cap at 256 minutes
    const jitter = Math.random() * baseDelay * 0.1; // 10% jitter
    const totalDelay = baseDelay + jitter;
    
    this.nextRetryAt = new Date(Date.now() + totalDelay * 60 * 1000);
    this.status = 'pending';
  }

  updateVerificationData(data: Partial<BlockchainTransactionData>): void {
    this.verificationData = { ...this.verificationData, ...data };
  }

  recordWebhookDelivery(success: boolean, statusCode?: number, error?: string): void {
    this.webhookDelivered = success;
    
    if (!this.metadata.webhookAttempts) {
      this.metadata.webhookAttempts = [];
    }
    
    this.metadata.webhookAttempts.push({
      timestamp: new Date().toISOString(),
      status: success ? 'success' : 'failed',
      statusCode,
      error,
    });
  }

  recordNotificationSent(): void {
    this.notificationSent = true;
  }

  addProcessingStep(step: string, status: 'started' | 'completed' | 'failed', details?: any): void {
    if (!this.metadata.processingSteps) {
      this.metadata.processingSteps = [];
    }

    const existingStep = this.metadata.processingSteps.find(s => s.step === step && s.status === 'started');
    if (existingStep && status !== 'started') {
      // Update existing step
      existingStep.status = status;
      existingStep.duration = new Date().getTime() - new Date(existingStep.timestamp).getTime();
      if (details) existingStep.details = details;
    } else {
      // Add new step
      this.metadata.processingSteps.push({
        step,
        timestamp: new Date().toISOString(),
        status,
        details,
      });
    }

    // Keep only last 20 steps to prevent unbounded growth
    if (this.metadata.processingSteps.length > 20) {
      this.metadata.processingSteps = this.metadata.processingSteps.slice(-20);
    }
  }

  private recordRetryAttempt(errorCode?: string, errorMessage?: string): void {
    if (!this.metadata.retryHistory) {
      this.metadata.retryHistory = [];
    }

    this.metadata.retryHistory.push({
      attempt: this.retryCount,
      timestamp: new Date().toISOString(),
      errorCode,
      errorMessage,
      blockNumber: this.verificationData?.blockNumber,
      confirmations: this.verificationData?.confirmations,
    });

    // Keep only last 10 retry attempts
    if (this.metadata.retryHistory.length > 10) {
      this.metadata.retryHistory = this.metadata.retryHistory.slice(-10);
    }
  }

  // Static factory methods
  static createVerificationJob(
    invoiceId: string,
    chainId: number,
    txHash: string,
    expectedAmount: string,
    expectedRecipient: string,
    fromAddress?: string,
    tokenId?: string,
    priority: JobPriority = 'normal'
  ): Partial<PaymentVerificationJob> {
    return {
      invoiceId,
      chainId,
      tokenId,
      txHash: txHash.toLowerCase(),
      fromAddress: fromAddress?.toLowerCase(),
      expectedAmount,
      expectedRecipient: expectedRecipient.toLowerCase(),
      priority,
      status: 'pending',
      retryCount: 0,
      maxRetries: priority === 'urgent' ? 15 : 10,
      webhookDelivered: false,
      notificationSent: false,
      metadata: {
        source: 'api',
        submitTime: new Date().toISOString(),
        processingSteps: [],
        retryHistory: [],
      },
    };
  }

  static validateTransactionHash(txHash: string): boolean {
    return /^0x[a-fA-F0-9]{64}$/.test(txHash);
  }

  static validateAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }

  // JSON serialization
  toJSON() {
    return {
      id: this.id,
      invoiceId: this.invoiceId,
      chainId: this.chainId,
      tokenId: this.tokenId,
      txHash: this.txHash,
      fromAddress: this.fromAddress,
      expectedAmount: this.expectedAmount,
      expectedRecipient: this.expectedRecipient,
      status: this.status,
      priority: this.priority,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
      nextRetryAt: this.nextRetryAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      errorMessage: this.errorMessage,
      errorCode: this.errorCode,
      verificationData: this.verificationData,
      verificationResult: this.verificationResult,
      paymentId: this.paymentId,
      webhookDelivered: this.webhookDelivered,
      notificationSent: this.notificationSent,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      // Computed properties
      isCompleted: this.isCompleted,
      canRetry: this.canRetry,
      isPending: this.isPending,
      processingDuration: this.processingDuration,
      confirmations: this.confirmations,
      requiredConfirmations: this.requiredConfirmations,
      hasMinConfirmations: this.hasMinConfirmations,
      isHighPriority: this.isHighPriority,
      metadata: {
        ...this.metadata,
        processingStepsCount: this.processingSteps.length,
        retryHistoryCount: this.retryHistory.length,
      },
    };
  }

  // Minimal JSON for public tracking
  toPublicJSON() {
    return {
      id: this.id,
      status: this.status,
      txHash: this.txHash,
      confirmations: this.confirmations,
      requiredConfirmations: this.requiredConfirmations,
      hasMinConfirmations: this.hasMinConfirmations,
      retryCount: this.retryCount,
      createdAt: this.createdAt,
      completedAt: this.completedAt,
      verificationResult: this.verificationResult ? {
        isValid: this.verificationResult.isValid,
        reason: this.verificationResult.reason,
      } : undefined,
    };
  }

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = ulid();
    }
  }
}