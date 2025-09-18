import { FindOptionsWhere } from 'typeorm';
import { BaseRepository } from './BaseRepository';
import { NotificationSettings, EmailNotificationSettings, ReminderSettings, EmailTemplateSettings } from '../entities/NotificationSettings';
import { TenantContext } from '../../types/common';
import { FluxionError, ErrorCodes } from '../../types/common';

export interface UpdateNotificationSettingsData {
  emailSettings?: Partial<EmailNotificationSettings>;
  reminderSettings?: Partial<ReminderSettings>;
  templateSettings?: Partial<EmailTemplateSettings>;
  webhookSettings?: any;
  integrationSettings?: any;
  globalUnsubscribe?: boolean;
  preferredLanguage?: string;
  preferredTimezone?: string;
}

export class NotificationSettingsRepository extends BaseRepository<NotificationSettings> {
  constructor() {
    super(NotificationSettings, 'NotificationSettings');
  }

  /**
   * Get or create notification settings for user
   */
  async getOrCreateUserSettings(tenantContext: TenantContext, userId: string): Promise<NotificationSettings> {
    await this.setTenantContext(tenantContext);

    try {
      // Try to find existing settings
      let settings = await this.repository.findOne({
        where: {
          organizationId: tenantContext.tenantId,
          userId,
        } as FindOptionsWhere<NotificationSettings>,
        relations: ['organization', 'user'],
      });

      // Create default settings if none exist
      if (!settings) {
        const defaultSettings = NotificationSettings.createDefault(tenantContext.tenantId, userId);
        settings = await super.create(tenantContext, defaultSettings);

        this.logger.info('Default notification settings created', { 
          userId,
          tenantId: tenantContext.tenantId 
        });
      }

      return settings;
    } catch (error: any) {
      this.logger.error('Failed to get or create user settings', { 
        error: error.message,
        userId,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Update user notification settings
   */
  async updateUserSettings(
    tenantContext: TenantContext,
    userId: string,
    updateData: UpdateNotificationSettingsData
  ): Promise<NotificationSettings> {
    await this.setTenantContext(tenantContext);

    try {
      const settings = await this.getOrCreateUserSettings(tenantContext, userId);

      // Update email settings
      if (updateData.emailSettings) {
        settings.updateEmailSettings(updateData.emailSettings);
      }

      // Update reminder settings
      if (updateData.reminderSettings) {
        settings.updateReminderSettings(updateData.reminderSettings);
      }

      // Update template settings
      if (updateData.templateSettings) {
        settings.updateTemplateSettings(updateData.templateSettings);
      }

      // Update webhook settings
      if (updateData.webhookSettings) {
        settings.updateWebhookSettings(updateData.webhookSettings);
      }

      // Update other fields
      if (typeof updateData.globalUnsubscribe === 'boolean') {
        if (updateData.globalUnsubscribe) {
          settings.unsubscribeFromAll('User requested unsubscribe');
        } else {
          settings.subscribeToAll();
        }
      }

      if (updateData.preferredLanguage) {
        settings.preferredLanguage = updateData.preferredLanguage;
      }

      if (updateData.preferredTimezone) {
        settings.preferredTimezone = updateData.preferredTimezone;
      }

      const updatedSettings = await this.repository.save(settings);

      this.logger.info('User notification settings updated', { 
        userId,
        tenantId: tenantContext.tenantId 
      });

      return updatedSettings;
    } catch (error: any) {
      this.logger.error('Failed to update user settings', { 
        error: error.message,
        userId,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Subscribe user to notification type
   */
  async subscribeToNotificationType(
    tenantContext: TenantContext,
    userId: string,
    notificationType: keyof EmailNotificationSettings
  ): Promise<void> {
    await this.setTenantContext(tenantContext);

    try {
      const settings = await this.getOrCreateUserSettings(tenantContext, userId);
      settings.enableNotificationType(notificationType);
      
      await this.repository.save(settings);

      this.logger.info('User subscribed to notification type', { 
        userId,
        notificationType,
        tenantId: tenantContext.tenantId 
      });
    } catch (error: any) {
      this.logger.error('Failed to subscribe to notification type', { 
        error: error.message,
        userId,
        notificationType,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Unsubscribe user from notification type
   */
  async unsubscribeFromNotificationType(
    tenantContext: TenantContext,
    userId: string,
    notificationType: keyof EmailNotificationSettings
  ): Promise<void> {
    await this.setTenantContext(tenantContext);

    try {
      const settings = await this.getOrCreateUserSettings(tenantContext, userId);
      settings.disableNotificationType(notificationType);
      
      await this.repository.save(settings);

      this.logger.info('User unsubscribed from notification type', { 
        userId,
        notificationType,
        tenantId: tenantContext.tenantId 
      });
    } catch (error: any) {
      this.logger.error('Failed to unsubscribe from notification type', { 
        error: error.message,
        userId,
        notificationType,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Unsubscribe user from all notifications
   */
  async unsubscribeFromAll(
    tenantContext: TenantContext,
    userId: string,
    reason?: string
  ): Promise<void> {
    await this.setTenantContext(tenantContext);

    try {
      const settings = await this.getOrCreateUserSettings(tenantContext, userId);
      settings.unsubscribeFromAll(reason);
      
      await this.repository.save(settings);

      this.logger.info('User unsubscribed from all notifications', { 
        userId,
        reason,
        tenantId: tenantContext.tenantId 
      });
    } catch (error: any) {
      this.logger.error('Failed to unsubscribe from all notifications', { 
        error: error.message,
        userId,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Generate email verification token
   */
  async generateEmailVerificationToken(
    tenantContext: TenantContext,
    userId: string
  ): Promise<string> {
    await this.setTenantContext(tenantContext);

    try {
      const settings = await this.getOrCreateUserSettings(tenantContext, userId);
      const token = settings.generateEmailVerificationToken();
      
      await this.repository.save(settings);

      this.logger.info('Email verification token generated', { 
        userId,
        tenantId: tenantContext.tenantId 
      });

      return token;
    } catch (error: any) {
      this.logger.error('Failed to generate email verification token', { 
        error: error.message,
        userId,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Verify email with token
   */
  async verifyEmail(
    tenantContext: TenantContext,
    userId: string,
    token: string
  ): Promise<boolean> {
    await this.setTenantContext(tenantContext);

    try {
      const settings = await this.getOrCreateUserSettings(tenantContext, userId);
      const verified = settings.verifyEmail(token);
      
      if (verified) {
        await this.repository.save(settings);
        this.logger.info('Email verified successfully', { 
          userId,
          tenantId: tenantContext.tenantId 
        });
      } else {
        this.logger.warn('Email verification failed', { 
          userId,
          tenantId: tenantContext.tenantId 
        });
      }

      return verified;
    } catch (error: any) {
      this.logger.error('Failed to verify email', { 
        error: error.message,
        userId,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Record email bounce
   */
  async recordBounce(
    tenantContext: TenantContext,
    userId: string
  ): Promise<void> {
    await this.setTenantContext(tenantContext);

    try {
      const settings = await this.getOrCreateUserSettings(tenantContext, userId);
      settings.recordBounce();
      
      await this.repository.save(settings);

      this.logger.info('Email bounce recorded', { 
        userId,
        bounceCount: settings.metadata.bounceCount,
        tenantId: tenantContext.tenantId 
      });
    } catch (error: any) {
      this.logger.error('Failed to record email bounce', { 
        error: error.message,
        userId,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Record email complaint
   */
  async recordComplaint(
    tenantContext: TenantContext,
    userId: string
  ): Promise<void> {
    await this.setTenantContext(tenantContext);

    try {
      const settings = await this.getOrCreateUserSettings(tenantContext, userId);
      settings.recordComplaint();
      
      await this.repository.save(settings);

      this.logger.info('Email complaint recorded', { 
        userId,
        complaintsCount: settings.metadata.complaintsCount,
        tenantId: tenantContext.tenantId 
      });
    } catch (error: any) {
      this.logger.error('Failed to record email complaint', { 
        error: error.message,
        userId,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Get all users who can receive a specific notification type
   */
  async getUsersForNotificationType(
    tenantContext: TenantContext,
    notificationType: keyof EmailNotificationSettings
  ): Promise<NotificationSettings[]> {
    await this.setTenantContext(tenantContext);

    try {
      const settings = await this.repository
        .createQueryBuilder('settings')
        .leftJoinAndSelect('settings.user', 'user')
        .where('settings.organization_id = :organizationId', { 
          organizationId: tenantContext.tenantId 
        })
        .andWhere('settings.global_unsubscribe = false')
        .andWhere('settings.email_verified = true')
        .andWhere(`settings.email_settings->>'${notificationType}' = 'true'`)
        .getMany();

      // Filter out users with high bounce/complaint rates
      return settings.filter(s => s.canReceiveEmails);
    } catch (error: any) {
      this.logger.error('Failed to get users for notification type', { 
        error: error.message,
        notificationType,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Get reminder settings for users who have reminders enabled
   */
  async getUsersWithRemindersEnabled(tenantContext: TenantContext): Promise<NotificationSettings[]> {
    await this.setTenantContext(tenantContext);

    try {
      const settings = await this.repository
        .createQueryBuilder('settings')
        .leftJoinAndSelect('settings.user', 'user')
        .where('settings.organization_id = :organizationId', { 
          organizationId: tenantContext.tenantId 
        })
        .andWhere('settings.global_unsubscribe = false')
        .andWhere('settings.email_verified = true')
        .andWhere(`settings.email_settings->>'reminders' = 'true'`)
        .andWhere(`settings.reminder_settings->>'enabled' = 'true'`)
        .getMany();

      return settings.filter(s => s.canReceiveEmails);
    } catch (error: any) {
      this.logger.error('Failed to get users with reminders enabled', { 
        error: error.message,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Get notification statistics for organization
   */
  async getNotificationStats(tenantContext: TenantContext): Promise<{
    totalUsers: number;
    verifiedEmails: number;
    unsubscribed: number;
    highBounceRate: number;
    highComplaintRate: number;
    webhookConfigured: number;
    byNotificationType: Record<string, number>;
  }> {
    await this.setTenantContext(tenantContext);

    try {
      const settings = await this.repository.find({
        where: {
          organizationId: tenantContext.tenantId,
        } as FindOptionsWhere<NotificationSettings>,
      });

      const totalUsers = settings.length;
      const verifiedEmails = settings.filter(s => s.emailVerified).length;
      const unsubscribed = settings.filter(s => s.globalUnsubscribe).length;
      const highBounceRate = settings.filter(s => s.hasHighBounceRate).length;
      const highComplaintRate = settings.filter(s => s.hasHighComplaintRate).length;
      const webhookConfigured = settings.filter(s => s.isWebhookConfigured).length;

      // Count users subscribed to each notification type
      const notificationTypes: (keyof EmailNotificationSettings)[] = [
        'invoicesSent', 'paymentsReceived', 'paymentsFailed', 'reminders', 
        'overdue', 'partialPayments', 'invoiceViewed', 'invoiceCancelled'
      ];

      const byNotificationType: Record<string, number> = {};
      notificationTypes.forEach(type => {
        byNotificationType[type] = settings.filter(s => s.emailSettings[type]).length;
      });

      return {
        totalUsers,
        verifiedEmails,
        unsubscribed,
        highBounceRate,
        highComplaintRate,
        webhookConfigured,
        byNotificationType,
      };
    } catch (error: any) {
      this.logger.error('Failed to get notification stats', { 
        error: error.message,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }

  /**
   * Update last notification sent timestamp
   */
  async updateLastNotificationSent(
    tenantContext: TenantContext,
    userId: string
  ): Promise<void> {
    await this.setTenantContext(tenantContext);

    try {
      await this.repository.update(
        {
          organizationId: tenantContext.tenantId,
          userId,
        } as FindOptionsWhere<NotificationSettings>,
        {
          lastNotificationSent: new Date(),
        }
      );

      this.logger.debug('Last notification sent timestamp updated', { 
        userId,
        tenantId: tenantContext.tenantId 
      });
    } catch (error: any) {
      this.logger.error('Failed to update last notification sent', { 
        error: error.message,
        userId,
        tenantId: tenantContext.tenantId 
      });
      throw error;
    }
  }
}