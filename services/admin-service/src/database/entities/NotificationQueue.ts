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
import { Organization } from './Organization';
import { Invoice } from './Invoice';
import { User } from './User';

export type NotificationType = 
  | 'invoice_sent' 
  | 'payment_received' 
  | 'payment_failed' 
  | 'payment_pending'
  | 'reminder' 
  | 'overdue'
  | 'invoice_cancelled'
  | 'invoice_draft'
  | 'partial_payment'
  | 'welcome'
  | 'system_maintenance';

export type NotificationStatus = 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface EmailTemplateData {
  // Invoice-related data
  invoiceId?: string;
  invoiceNumber?: string;
  invoiceTitle?: string;
  invoiceAmount?: string;
  invoiceStatus?: string;
  invoiceDueDate?: string;
  invoiceCreatedAt?: string;
  paymentUrl?: string;
  accessToken?: string;

  // Client/recipient data
  recipientName?: string;
  recipientEmail?: string;
  clientName?: string;

  // Payment data
  paymentAmount?: string;
  paymentToken?: string;
  paymentNetwork?: string;
  transactionHash?: string;
  confirmations?: number;

  // Company/sender data
  companyName?: string;
  companyEmail?: string;
  companyAddress?: string;
  companyLogo?: string;
  senderName?: string;

  // Template customization
  customMessage?: string;
  customSubject?: string;
  customFooter?: string;
  primaryColor?: string;
  
  // System data
  systemUrl?: string;
  supportEmail?: string;
  unsubscribeUrl?: string;
  
  // Additional context
  [key: string]: any;
}

@Entity('notification_queue')
@Index(['organizationId'])
@Index(['invoiceId'])
@Index(['userId'])
@Index(['type'])
@Index(['status'])
@Index(['priority'])
@Index(['scheduledFor'])
@Index(['organizationId', 'status'])
@Index(['status', 'scheduledFor'])
@Index(['type', 'status'])
@Check('retry_count_positive', 'retry_count >= 0')
@Check('retry_count_max', 'retry_count <= 10')
@Check('scheduled_for_valid', 'scheduled_for >= created_at')
export class NotificationQueue {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ name: 'organization_id', type: 'varchar', nullable: false })
  organizationId!: string;

  @Column({ name: 'invoice_id', type: 'varchar', nullable: true })
  invoiceId?: string;

  @Column({ name: 'user_id', type: 'varchar', nullable: true })
  userId?: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  type!: NotificationType;

  @Column({ name: 'recipient_email', type: 'varchar', length: 320, nullable: false })
  recipientEmail!: string;

  @Column({ name: 'recipient_name', type: 'varchar', length: 255, nullable: true })
  recipientName?: string;

  @Column({ type: 'varchar', length: 255, nullable: false })
  subject!: string;

  @Column({ name: 'email_template', type: 'varchar', length: 100, nullable: true })
  emailTemplate?: string; // Template name to use

  @Column({ name: 'template_data', type: 'jsonb', nullable: false })
  templateData!: EmailTemplateData;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: NotificationStatus;

  @Column({ type: 'varchar', length: 10, default: 'normal' })
  priority!: NotificationPriority;

  @Column({ name: 'scheduled_for', type: 'timestamptz', nullable: false })
  scheduledFor!: Date;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt?: Date;

  @Column({ name: 'retry_count', type: 'integer', default: 0 })
  retryCount!: number;

  @Column({ name: 'max_retries', type: 'integer', default: 3 })
  maxRetries!: number;

  @Column({ name: 'next_retry_at', type: 'timestamptz', nullable: true })
  nextRetryAt?: Date;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'error_code', type: 'varchar', length: 50, nullable: true })
  errorCode?: string;

  @Column({ name: 'provider_id', type: 'varchar', length: 255, nullable: true })
  providerId?: string; // External service ID (SendGrid, SES, etc.)

  @Column({ name: 'provider_status', type: 'varchar', length: 50, nullable: true })
  providerStatus?: string; // External service status

  @Column({ type: 'jsonb', default: {}, nullable: false })
  metadata!: {
    source?: string; // What triggered this notification
    campaign?: string; // Marketing campaign ID
    tags?: string[]; // Classification tags
    deliveryAttempts?: Array<{
      timestamp: string;
      status: string;
      error?: string;
      providerId?: string;
    }>;
    analytics?: {
      opened?: boolean;
      clicked?: boolean;
      openedAt?: string;
      clickedAt?: string;
      userAgent?: string;
    };
    customProperties?: Record<string, any>;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => Organization, organization => organization.notifications, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => Invoice, { nullable: true })
  @JoinColumn({ name: 'invoice_id' })
  invoice?: Invoice;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  // Computed properties
  get isOverdue(): boolean {
    return new Date() > this.scheduledFor && this.status === 'pending';
  }

  get canRetry(): boolean {
    return this.status === 'failed' && 
           this.retryCount < this.maxRetries &&
           (!this.nextRetryAt || new Date() >= this.nextRetryAt);
  }

  get isPending(): boolean {
    return this.status === 'pending' && new Date() >= this.scheduledFor;
  }

  get deliveryAttempts(): number {
    return this.metadata.deliveryAttempts?.length || 0;
  }

  get lastDeliveryAttempt(): Date | null {
    const attempts = this.metadata.deliveryAttempts;
    if (!attempts || attempts.length === 0) return null;
    
    const lastAttempt = attempts[attempts.length - 1];
    return new Date(lastAttempt.timestamp);
  }

  get isHighPriority(): boolean {
    return this.priority === 'high' || this.priority === 'urgent';
  }

  // Methods
  markAsProcessing(): void {
    this.status = 'processing';
    this.updatedAt = new Date();
  }

  markAsSent(providerId?: string, providerStatus?: string): void {
    this.status = 'sent';
    this.sentAt = new Date();
    if (providerId) this.providerId = providerId;
    if (providerStatus) this.providerStatus = providerStatus;
    
    this.recordDeliveryAttempt('sent', undefined, providerId);
  }

  markAsFailed(error: string, errorCode?: string): void {
    this.status = 'failed';
    this.errorMessage = error;
    this.errorCode = errorCode;
    this.retryCount += 1;

    this.recordDeliveryAttempt('failed', error);

    if (this.canRetry) {
      this.scheduleRetry();
    }
  }

  markAsCancelled(): void {
    this.status = 'cancelled';
    this.updatedAt = new Date();
  }

  scheduleRetry(delayMinutes?: number): void {
    if (this.retryCount >= this.maxRetries) {
      return;
    }

    // Exponential backoff: 5, 15, 45 minutes
    const delay = delayMinutes || Math.pow(3, this.retryCount) * 5;
    this.nextRetryAt = new Date(Date.now() + delay * 60 * 1000);
  }

  reschedule(newDate: Date): void {
    if (this.status === 'sent') {
      throw new Error('Cannot reschedule sent notification');
    }
    
    this.scheduledFor = newDate;
    if (this.status === 'failed') {
      this.status = 'pending';
      this.errorMessage = undefined;
      this.errorCode = undefined;
    }
  }

  updateTemplateData(data: Partial<EmailTemplateData>): void {
    this.templateData = { ...this.templateData, ...data };
  }

  addTag(tag: string): void {
    if (!this.metadata.tags) {
      this.metadata.tags = [];
    }
    if (!this.metadata.tags.includes(tag)) {
      this.metadata.tags.push(tag);
    }
  }

  removeTag(tag: string): void {
    if (this.metadata.tags) {
      this.metadata.tags = this.metadata.tags.filter(t => t !== tag);
    }
  }

  recordEmailOpened(userAgent?: string): void {
    this.metadata.analytics = {
      ...this.metadata.analytics,
      opened: true,
      openedAt: new Date().toISOString(),
      userAgent,
    };
  }

  recordEmailClicked(userAgent?: string): void {
    this.metadata.analytics = {
      ...this.metadata.analytics,
      clicked: true,
      clickedAt: new Date().toISOString(),
      userAgent,
    };
  }

  private recordDeliveryAttempt(status: string, error?: string, providerId?: string): void {
    if (!this.metadata.deliveryAttempts) {
      this.metadata.deliveryAttempts = [];
    }

    this.metadata.deliveryAttempts.push({
      timestamp: new Date().toISOString(),
      status,
      error,
      providerId,
    });

    // Keep only last 10 delivery attempts
    if (this.metadata.deliveryAttempts.length > 10) {
      this.metadata.deliveryAttempts = this.metadata.deliveryAttempts.slice(-10);
    }
  }

  // Static factory methods
  static createInvoiceSent(
    organizationId: string,
    invoiceId: string,
    recipientEmail: string,
    templateData: EmailTemplateData,
    scheduledFor?: Date
  ): Partial<NotificationQueue> {
    return {
      organizationId,
      invoiceId,
      type: 'invoice_sent',
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
  ): Partial<NotificationQueue> {
    return {
      organizationId,
      invoiceId,
      type: 'payment_received',
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
  ): Partial<NotificationQueue> {
    return {
      organizationId,
      invoiceId,
      type: 'reminder',
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

  // JSON serialization
  toJSON() {
    return {
      id: this.id,
      organizationId: this.organizationId,
      invoiceId: this.invoiceId,
      userId: this.userId,
      type: this.type,
      recipientEmail: this.recipientEmail,
      recipientName: this.recipientName,
      subject: this.subject,
      emailTemplate: this.emailTemplate,
      status: this.status,
      priority: this.priority,
      scheduledFor: this.scheduledFor,
      sentAt: this.sentAt,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
      nextRetryAt: this.nextRetryAt,
      errorMessage: this.errorMessage,
      errorCode: this.errorCode,
      providerId: this.providerId,
      providerStatus: this.providerStatus,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      // Computed properties
      isOverdue: this.isOverdue,
      canRetry: this.canRetry,
      isPending: this.isPending,
      deliveryAttempts: this.deliveryAttempts,
      lastDeliveryAttempt: this.lastDeliveryAttempt,
      isHighPriority: this.isHighPriority,
      metadata: {
        ...this.metadata,
        deliveryAttempts: undefined, // Hide detailed delivery attempts in standard JSON
        deliveryAttemptsCount: this.deliveryAttempts,
      },
    };
  }

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = ulid();
    }
  }
}