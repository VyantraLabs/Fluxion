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

export type ReminderType = 'due_date' | 'overdue' | 'payment_pending' | 'custom';
export type ReminderStatus = 'scheduled' | 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled' | 'skipped';
export type ReminderPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface ReminderConfiguration {
  intervalDays: number; // Days before/after due date
  isOverdueReminder: boolean; // true = after due date, false = before
  maxOccurrences?: number; // Maximum times this reminder can be sent
  businessDaysOnly: boolean;
  excludeWeekends: boolean;
  reminderTime: string; // HH:MM format (24-hour)
  timezone: string;
  customMessage?: string;
  emailTemplate?: string; // Override default template
  webhookEnabled: boolean;
  smsEnabled: boolean;
  conditions?: {
    minAmount?: string; // Only send if invoice amount >= this
    maxAmount?: string; // Only send if invoice amount <= this
    statuses?: string[]; // Only send if invoice status in this array
    excludeStatuses?: string[]; // Don't send if invoice status in this array
  };
}

@Entity('reminder_jobs')
@Index(['organizationId'])
@Index(['invoiceId'])
@Index(['userId'])
@Index(['type'])
@Index(['status'])
@Index(['priority'])
@Index(['scheduledFor'])
@Index(['organizationId', 'status'])
@Index(['status', 'scheduledFor'])
@Index(['invoiceId', 'type'])
@Check('scheduled_for_valid', 'scheduled_for >= created_at')
@Check('occurrence_count_positive', 'occurrence_count >= 0')
@Check('max_occurrences_positive', 'max_occurrences IS NULL OR max_occurrences > 0')
export class ReminderJob {
  @PrimaryColumn({ type: 'varchar' })
  id!: string;

  @Column({ name: 'organization_id', type: 'varchar', nullable: false })
  organizationId!: string;

  @Column({ name: 'invoice_id', type: 'varchar', nullable: false })
  invoiceId!: string;

  @Column({ name: 'user_id', type: 'varchar', nullable: true })
  userId?: string;

  @Column({ type: 'varchar', length: 20, nullable: false })
  type!: ReminderType;

  @Column({ type: 'varchar', length: 20, default: 'scheduled' })
  status!: ReminderStatus;

  @Column({ type: 'varchar', length: 10, default: 'normal' })
  priority!: ReminderPriority;

  @Column({ name: 'scheduled_for', type: 'timestamptz', nullable: false })
  scheduledFor!: Date;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt?: Date;

  @Column({ name: 'occurrence_count', type: 'integer', default: 0 })
  occurrenceCount!: number;

  @Column({ name: 'max_occurrences', type: 'integer', nullable: true })
  maxOccurrences?: number;

  @Column({ name: 'retry_count', type: 'integer', default: 0 })
  retryCount!: number;

  @Column({ name: 'max_retries', type: 'integer', default: 3 })
  maxRetries!: number;

  @Column({ name: 'next_retry_at', type: 'timestamptz', nullable: true })
  nextRetryAt?: Date;

  @Column({ type: 'jsonb', nullable: false })
  configuration!: ReminderConfiguration;

  @Column({ name: 'notification_id', type: 'varchar', nullable: true })
  notificationId?: string; // Links to NotificationQueue when sent

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'error_code', type: 'varchar', length: 50, nullable: true })
  errorCode?: string;

  @Column({ type: 'jsonb', default: {}, nullable: false })
  metadata!: {
    originalDueDate?: string;
    invoiceAmount?: string;
    clientEmail?: string;
    reminderReason?: string;
    skipReasons?: string[];
    deliveryAttempts?: Array<{
      timestamp: string;
      method: 'email' | 'webhook' | 'sms';
      status: 'success' | 'failed';
      error?: string;
    }>;
    customData?: Record<string, any>;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => Organization, organization => organization.reminderJobs, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => Invoice, invoice => invoice.reminderJobs, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invoice_id' })
  invoice!: Invoice;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  // Computed properties
  get isDue(): boolean {
    return new Date() >= this.scheduledFor && this.status === 'scheduled';
  }

  get canRetry(): boolean {
    return this.status === 'failed' && 
           this.retryCount < this.maxRetries &&
           (!this.nextRetryAt || new Date() >= this.nextRetryAt);
  }

  get hasReachedMaxOccurrences(): boolean {
    return !!(this.maxOccurrences && this.occurrenceCount >= this.maxOccurrences);
  }

  get isRecurring(): boolean {
    return !this.maxOccurrences || this.maxOccurrences > 1;
  }

  get nextScheduledDate(): Date | null {
    if (!this.isRecurring || this.hasReachedMaxOccurrences) {
      return null;
    }

    const config = this.configuration;
    const baseDate = new Date(this.scheduledFor);
    
    // For recurring reminders, calculate next occurrence
    if (config.isOverdueReminder) {
      // Overdue reminders: add interval days after the previous reminder
      baseDate.setDate(baseDate.getDate() + config.intervalDays);
    } else {
      // Due date reminders: not typically recurring, but handle edge cases
      return null;
    }

    return baseDate;
  }

  // Methods
  markAsProcessing(): void {
    this.status = 'processing';
  }

  markAsSent(notificationId?: string): void {
    this.status = 'sent';
    this.sentAt = new Date();
    this.occurrenceCount += 1;
    if (notificationId) {
      this.notificationId = notificationId;
    }

    this.recordDeliveryAttempt('email', 'success');
    
    // Schedule next occurrence if this is recurring
    const nextDate = this.nextScheduledDate;
    if (nextDate && !this.hasReachedMaxOccurrences) {
      this.scheduleNextOccurrence(nextDate);
    }
  }

  markAsFailed(error: string, errorCode?: string): void {
    this.status = 'failed';
    this.errorMessage = error;
    this.errorCode = errorCode;
    this.retryCount += 1;

    this.recordDeliveryAttempt('email', 'failed', error);

    if (this.canRetry) {
      this.scheduleRetry();
    }
  }

  markAsCancelled(reason?: string): void {
    this.status = 'cancelled';
    if (reason) {
      this.metadata = {
        ...this.metadata,
        skipReasons: [...(this.metadata.skipReasons || []), reason],
      };
    }
  }

  markAsSkipped(reason: string): void {
    this.status = 'skipped';
    this.metadata = {
      ...this.metadata,
      skipReasons: [...(this.metadata.skipReasons || []), reason],
    };
  }

  scheduleRetry(delayMinutes?: number): void {
    if (this.retryCount >= this.maxRetries) {
      return;
    }

    // Exponential backoff: 5, 15, 45 minutes
    const delay = delayMinutes || Math.pow(3, this.retryCount) * 5;
    this.nextRetryAt = new Date(Date.now() + delay * 60 * 1000);
    this.status = 'scheduled';
  }

  scheduleNextOccurrence(date: Date): void {
    this.scheduledFor = date;
    this.status = 'scheduled';
    this.sentAt = undefined;
    this.errorMessage = undefined;
    this.errorCode = undefined;
    this.retryCount = 0;
    this.nextRetryAt = undefined;
  }

  reschedule(newDate: Date): void {
    if (this.status === 'processing') {
      throw new Error('Cannot reschedule reminder that is currently processing');
    }
    
    this.scheduledFor = newDate;
    if (this.status === 'failed' || this.status === 'cancelled') {
      this.status = 'scheduled';
      this.errorMessage = undefined;
      this.errorCode = undefined;
      this.retryCount = 0;
    }
  }

  updateConfiguration(config: Partial<ReminderConfiguration>): void {
    this.configuration = { ...this.configuration, ...config };
  }

  private recordDeliveryAttempt(method: 'email' | 'webhook' | 'sms', status: 'success' | 'failed', error?: string): void {
    if (!this.metadata.deliveryAttempts) {
      this.metadata.deliveryAttempts = [];
    }

    this.metadata.deliveryAttempts.push({
      timestamp: new Date().toISOString(),
      method,
      status,
      error,
    });

    // Keep only last 10 delivery attempts
    if (this.metadata.deliveryAttempts.length > 10) {
      this.metadata.deliveryAttempts = this.metadata.deliveryAttempts.slice(-10);
    }
  }

  // Static factory methods
  static createDueDateReminder(
    organizationId: string,
    invoiceId: string,
    daysBefore: number,
    configuration: Partial<ReminderConfiguration> = {}
  ): Partial<ReminderJob> {
    const defaultConfig: ReminderConfiguration = {
      intervalDays: daysBefore,
      isOverdueReminder: false,
      businessDaysOnly: false,
      excludeWeekends: false,
      reminderTime: '09:00',
      timezone: 'UTC',
      webhookEnabled: false,
      smsEnabled: false,
      ...configuration,
    };

    return {
      organizationId,
      invoiceId,
      type: 'due_date',
      configuration: defaultConfig,
      status: 'scheduled',
      priority: daysBefore <= 1 ? 'high' : 'normal',
      occurrenceCount: 0,
      maxOccurrences: 1, // Due date reminders typically sent once
      metadata: {
        reminderReason: `Invoice due in ${daysBefore} day(s)`,
      },
    };
  }

  static createOverdueReminder(
    organizationId: string,
    invoiceId: string,
    daysAfter: number,
    maxOccurrences: number = 3,
    configuration: Partial<ReminderConfiguration> = {}
  ): Partial<ReminderJob> {
    const defaultConfig: ReminderConfiguration = {
      intervalDays: daysAfter,
      isOverdueReminder: true,
      businessDaysOnly: true,
      excludeWeekends: true,
      reminderTime: '10:00',
      timezone: 'UTC',
      webhookEnabled: true,
      smsEnabled: false,
      conditions: {
        statuses: ['overdue', 'sent'],
        excludeStatuses: ['paid', 'cancelled'],
      },
      ...configuration,
    };

    return {
      organizationId,
      invoiceId,
      type: 'overdue',
      configuration: defaultConfig,
      status: 'scheduled',
      priority: 'high',
      occurrenceCount: 0,
      maxOccurrences,
      metadata: {
        reminderReason: `Invoice overdue by ${daysAfter} day(s)`,
      },
    };
  }

  // Business logic validation
  shouldSkipReminder(invoice: Invoice): { skip: boolean; reason?: string } {
    const config = this.configuration;

    // Check invoice status conditions
    if (config.conditions?.statuses && !config.conditions.statuses.includes(invoice.status)) {
      return { skip: true, reason: `Invoice status ${invoice.status} not in allowed statuses` };
    }

    if (config.conditions?.excludeStatuses && config.conditions.excludeStatuses.includes(invoice.status)) {
      return { skip: true, reason: `Invoice status ${invoice.status} is excluded` };
    }

    // Check amount conditions
    const amount = parseFloat(invoice.amount);
    if (config.conditions?.minAmount && amount < parseFloat(config.conditions.minAmount)) {
      return { skip: true, reason: `Invoice amount ${amount} below minimum ${config.conditions.minAmount}` };
    }

    if (config.conditions?.maxAmount && amount > parseFloat(config.conditions.maxAmount)) {
      return { skip: true, reason: `Invoice amount ${amount} above maximum ${config.conditions.maxAmount}` };
    }

    // Check if invoice is paid
    if (invoice.isPaid) {
      return { skip: true, reason: 'Invoice already paid' };
    }

    // Check if invoice is cancelled
    if (invoice.status === 'cancelled') {
      return { skip: true, reason: 'Invoice is cancelled' };
    }

    // Check max occurrences
    if (this.hasReachedMaxOccurrences) {
      return { skip: true, reason: 'Maximum reminder occurrences reached' };
    }

    return { skip: false };
  }

  // JSON serialization
  toJSON() {
    return {
      id: this.id,
      organizationId: this.organizationId,
      invoiceId: this.invoiceId,
      userId: this.userId,
      type: this.type,
      status: this.status,
      priority: this.priority,
      scheduledFor: this.scheduledFor,
      sentAt: this.sentAt,
      occurrenceCount: this.occurrenceCount,
      maxOccurrences: this.maxOccurrences,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
      nextRetryAt: this.nextRetryAt,
      configuration: this.configuration,
      notificationId: this.notificationId,
      errorMessage: this.errorMessage,
      errorCode: this.errorCode,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      // Computed properties
      isDue: this.isDue,
      canRetry: this.canRetry,
      hasReachedMaxOccurrences: this.hasReachedMaxOccurrences,
      isRecurring: this.isRecurring,
      nextScheduledDate: this.nextScheduledDate,
      metadata: this.metadata,
    };
  }

  @BeforeInsert()
  generateId(): void {
    if (!this.id) {
      this.id = ulid();
    }
  }
}