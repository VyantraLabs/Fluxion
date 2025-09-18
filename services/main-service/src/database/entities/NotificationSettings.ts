import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { Organization } from './Organization';
import { User } from './User';

export interface EmailNotificationSettings {
  invoicesSent: boolean;
  paymentsReceived: boolean;
  paymentsFailed: boolean;
  reminders: boolean;
  overdue: boolean;
  partialPayments: boolean;
  invoiceViewed: boolean;
  invoiceCancelled: boolean;
  systemUpdates: boolean;
  marketingEmails: boolean;
}

export interface ReminderSettings {
  enabled: boolean;
  intervals: number[]; // Days before due date [7, 3, 1]
  overdueIntervals: number[]; // Days after due date [1, 7, 14]
  maxReminders: number;
  reminderTime: string; // Time of day in HH:MM format (24-hour)
  timezone: string; // Timezone for reminder scheduling
  businessDaysOnly: boolean;
  excludeWeekends: boolean;
  customMessage?: string;
}

export interface EmailTemplateSettings {
  fromName?: string;
  fromEmail?: string;
  replyToEmail?: string;
  signature?: string;
  customFooter?: string;
  brandColor?: string;
  logoUrl?: string;
  companyName?: string;
  companyAddress?: string;
  supportEmail?: string;
  unsubscribeText?: string;
  customCSS?: string;
}

export interface WebhookSettings {
  enabled: boolean;
  url?: string;
  secret?: string;
  events: string[]; // Which events to send webhooks for
  retryAttempts: number;
  timeout: number; // Timeout in seconds
  headers?: Record<string, string>;
}

export interface IntegrationSettings {
  slackWebhook?: string;
  discordWebhook?: string;
  teamsWebhook?: string;
  zapierUrl?: string;
  customIntegrations?: Array<{
    name: string;
    url: string;
    type: 'webhook' | 'api';
    events: string[];
    active: boolean;
  }>;
}

@Entity('notification_settings')
@Index(['organizationId'])
@Index(['userId'])
@Index(['organizationId', 'userId'], { unique: true })
export class NotificationSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organization_id', type: 'uuid', nullable: false })
  organizationId!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: false })
  userId!: string;

  // Email notification preferences
  @Column({ name: 'email_settings', type: 'jsonb', nullable: false })
  emailSettings!: EmailNotificationSettings;

  // Reminder configuration
  @Column({ name: 'reminder_settings', type: 'jsonb', nullable: false })
  reminderSettings!: ReminderSettings;

  // Email template customization
  @Column({ name: 'template_settings', type: 'jsonb', nullable: false })
  templateSettings!: EmailTemplateSettings;

  // Webhook configuration
  @Column({ name: 'webhook_settings', type: 'jsonb', default: {}, nullable: false })
  webhookSettings!: WebhookSettings;

  // Third-party integrations
  @Column({ name: 'integration_settings', type: 'jsonb', default: {}, nullable: false })
  integrationSettings!: IntegrationSettings;

  // Global settings
  @Column({ name: 'global_unsubscribe', type: 'boolean', default: false })
  globalUnsubscribe!: boolean;

  @Column({ name: 'email_verified', type: 'boolean', default: false })
  emailVerified!: boolean;

  @Column({ name: 'email_verification_token', type: 'varchar', length: 64, nullable: true })
  emailVerificationToken?: string;

  @Column({ name: 'email_verification_expires', type: 'timestamptz', nullable: true })
  emailVerificationExpires?: Date;

  @Column({ name: 'preferred_language', type: 'varchar', length: 10, default: 'en' })
  preferredLanguage!: string;

  @Column({ name: 'preferred_timezone', type: 'varchar', length: 50, default: 'UTC' })
  preferredTimezone!: string;

  @Column({ name: 'last_notification_sent', type: 'timestamptz', nullable: true })
  lastNotificationSent?: Date;

  @Column({ type: 'jsonb', default: {}, nullable: false })
  metadata!: {
    optOutReasons?: string[];
    optOutDate?: string;
    bounceCount?: number;
    complaintsCount?: number;
    lastBounceDate?: string;
    lastComplaintDate?: string;
    suppressionList?: boolean;
    customPreferences?: Record<string, any>;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  // Relations
  @ManyToOne(() => Organization, organization => organization.notificationSettings, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => User, user => user.notificationSettings, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  // Computed properties
  get canReceiveEmails(): boolean {
    return !this.globalUnsubscribe && 
           this.emailVerified && 
           !(this.metadata.suppressionList);
  }

  get hasHighBounceRate(): boolean {
    const bounceCount = this.metadata.bounceCount || 0;
    return bounceCount > 5; // Threshold for high bounce rate
  }

  get hasHighComplaintRate(): boolean {
    const complaintsCount = this.metadata.complaintsCount || 0;
    return complaintsCount > 2; // Threshold for high complaint rate
  }

  get shouldSuppressEmails(): boolean {
    return this.globalUnsubscribe || 
           !this.emailVerified || 
           this.hasHighBounceRate || 
           this.hasHighComplaintRate ||
           !!this.metadata.suppressionList;
  }

  get isWebhookConfigured(): boolean {
    return this.webhookSettings.enabled && 
           !!this.webhookSettings.url && 
           this.webhookSettings.events.length > 0;
  }

  get activeIntegrations(): number {
    const integrations = this.integrationSettings.customIntegrations || [];
    return integrations.filter(i => i.active).length;
  }

  // Methods
  updateEmailSettings(settings: Partial<EmailNotificationSettings>): void {
    this.emailSettings = { ...this.emailSettings, ...settings };
  }

  updateReminderSettings(settings: Partial<ReminderSettings>): void {
    this.reminderSettings = { ...this.reminderSettings, ...settings };
  }

  updateTemplateSettings(settings: Partial<EmailTemplateSettings>): void {
    this.templateSettings = { ...this.templateSettings, ...settings };
  }

  updateWebhookSettings(settings: Partial<WebhookSettings>): void {
    this.webhookSettings = { ...this.webhookSettings, ...settings };
  }

  enableNotificationType(type: keyof EmailNotificationSettings): void {
    this.emailSettings[type] = true;
  }

  disableNotificationType(type: keyof EmailNotificationSettings): void {
    this.emailSettings[type] = false;
  }

  subscribeToAll(): void {
    this.globalUnsubscribe = false;
    Object.keys(this.emailSettings).forEach(key => {
      if (key !== 'marketingEmails') { // Keep marketing emails separate
        (this.emailSettings as any)[key] = true;
      }
    });
  }

  unsubscribeFromAll(reason?: string): void {
    this.globalUnsubscribe = true;
    if (reason) {
      if (!this.metadata.optOutReasons) {
        this.metadata.optOutReasons = [];
      }
      this.metadata.optOutReasons.push(reason);
      this.metadata.optOutDate = new Date().toISOString();
    }
  }

  recordBounce(): void {
    this.metadata.bounceCount = (this.metadata.bounceCount || 0) + 1;
    this.metadata.lastBounceDate = new Date().toISOString();

    // Auto-suppress after too many bounces
    if (this.metadata.bounceCount > 5) {
      this.metadata.suppressionList = true;
    }
  }

  recordComplaint(): void {
    this.metadata.complaintsCount = (this.metadata.complaintsCount || 0) + 1;
    this.metadata.lastComplaintDate = new Date().toISOString();

    // Auto-suppress after complaints
    if (this.metadata.complaintsCount > 2) {
      this.metadata.suppressionList = true;
      this.globalUnsubscribe = true;
    }
  }

  generateEmailVerificationToken(): string {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    this.emailVerificationToken = token;
    this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    return token;
  }

  verifyEmail(token: string): boolean {
    if (!this.emailVerificationToken || 
        !this.emailVerificationExpires ||
        new Date() > this.emailVerificationExpires) {
      return false;
    }

    if (this.emailVerificationToken !== token) {
      return false;
    }

    this.emailVerified = true;
    this.emailVerificationToken = undefined;
    this.emailVerificationExpires = undefined;
    this.metadata.suppressionList = false;

    return true;
  }

  addCustomIntegration(integration: {
    name: string;
    url: string;
    type: 'webhook' | 'api';
    events: string[];
    active?: boolean;
  }): void {
    if (!this.integrationSettings.customIntegrations) {
      this.integrationSettings.customIntegrations = [];
    }

    this.integrationSettings.customIntegrations.push({
      ...integration,
      active: integration.active ?? true,
    });
  }

  removeCustomIntegration(name: string): void {
    if (this.integrationSettings.customIntegrations) {
      this.integrationSettings.customIntegrations = 
        this.integrationSettings.customIntegrations.filter(i => i.name !== name);
    }
  }

  setReminderSchedule(intervals: number[], overdueIntervals: number[]): void {
    this.reminderSettings = {
      ...this.reminderSettings,
      intervals,
      overdueIntervals,
    };
  }

  // Static factory methods
  static createDefault(organizationId: string, userId: string): Partial<NotificationSettings> {
    return {
      organizationId,
      userId,
      emailSettings: {
        invoicesSent: true,
        paymentsReceived: true,
        paymentsFailed: true,
        reminders: true,
        overdue: true,
        partialPayments: true,
        invoiceViewed: false,
        invoiceCancelled: true,
        systemUpdates: true,
        marketingEmails: false,
      },
      reminderSettings: {
        enabled: true,
        intervals: [7, 3, 1], // 7, 3, and 1 days before due date
        overdueIntervals: [1, 7, 14], // 1, 7, and 14 days after due date
        maxReminders: 5,
        reminderTime: '09:00',
        timezone: 'UTC',
        businessDaysOnly: false,
        excludeWeekends: false,
      },
      templateSettings: {
        fromName: 'Fluxion',
        signature: 'Best regards,\nThe Fluxion Team',
        brandColor: '#2563eb',
        unsubscribeText: 'You can unsubscribe from these notifications at any time.',
      },
      webhookSettings: {
        enabled: false,
        events: [],
        retryAttempts: 3,
        timeout: 30,
      },
      integrationSettings: {},
      globalUnsubscribe: false,
      emailVerified: false,
      preferredLanguage: 'en',
      preferredTimezone: 'UTC',
      metadata: {},
    };
  }

  // JSON serialization
  toJSON() {
    return {
      id: this.id,
      organizationId: this.organizationId,
      userId: this.userId,
      emailSettings: this.emailSettings,
      reminderSettings: this.reminderSettings,
      templateSettings: {
        ...this.templateSettings,
        // Don't expose sensitive webhook secrets in JSON
      },
      webhookSettings: {
        ...this.webhookSettings,
        secret: this.webhookSettings.secret ? '***' : undefined,
      },
      integrationSettings: this.integrationSettings,
      globalUnsubscribe: this.globalUnsubscribe,
      emailVerified: this.emailVerified,
      preferredLanguage: this.preferredLanguage,
      preferredTimezone: this.preferredTimezone,
      lastNotificationSent: this.lastNotificationSent,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      // Computed properties
      canReceiveEmails: this.canReceiveEmails,
      hasHighBounceRate: this.hasHighBounceRate,
      hasHighComplaintRate: this.hasHighComplaintRate,
      shouldSuppressEmails: this.shouldSuppressEmails,
      isWebhookConfigured: this.isWebhookConfigured,
      activeIntegrations: this.activeIntegrations,
      metadata: {
        ...this.metadata,
        // Don't expose email verification token
        emailVerificationToken: undefined,
      },
    };
  }

  // Public JSON (minimal data for client-side)
  toPublicJSON() {
    return {
      emailSettings: this.emailSettings,
      reminderSettings: {
        enabled: this.reminderSettings.enabled,
        intervals: this.reminderSettings.intervals,
        reminderTime: this.reminderSettings.reminderTime,
        timezone: this.reminderSettings.timezone,
      },
      globalUnsubscribe: this.globalUnsubscribe,
      emailVerified: this.emailVerified,
      preferredLanguage: this.preferredLanguage,
      preferredTimezone: this.preferredTimezone,
      canReceiveEmails: this.canReceiveEmails,
    };
  }
}