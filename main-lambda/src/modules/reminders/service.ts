import { ReminderJobRepository } from '@/database/repositories/ReminderJobRepository';
import { InvoiceRepository } from '@/database/repositories/InvoiceRepository';
import { NotificationSettingsRepository } from '@/database/repositories/NotificationSettingsRepository';
import { NotificationService } from '@/modules/notifications/service';
import { ReminderJob, ReminderType, ReminderConfiguration, ReminderStatus } from '@/database/entities/ReminderJob';
import { Invoice } from '@/database/entities/Invoice';
import { TenantContext, PaginatedResult, FluxionError, ErrorCodes } from '@/types/common';
import { Logger } from '@/shared/utils/logger';

export interface CreateReminderDto {
  invoiceId: string;
  type: ReminderType;
  configuration: ReminderConfiguration;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  maxOccurrences?: number;
  scheduledFor?: Date;
}

export interface UpdateReminderDto {
  configuration?: Partial<ReminderConfiguration>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  scheduledFor?: Date;
  maxOccurrences?: number;
}

export interface ReminderSearchFilters {
  status?: ReminderStatus;
  type?: ReminderType;
  invoiceId?: string;
  scheduledFrom?: Date;
  scheduledTo?: Date;
  priority?: string;
}

export interface BulkReminderDto {
  invoiceIds: string[];
  reminderType: ReminderType;
  configuration: ReminderConfiguration;
  replaceExisting?: boolean;
}

export interface BulkReminderResult {
  created: number;
  skipped: number;
  failed: number;
  results: Array<{
    invoiceId: string;
    status: 'created' | 'skipped' | 'failed';
    reminderId?: string;
    error?: string;
  }>;
}

export interface ReminderStats {
  total: number;
  byStatus: Record<ReminderStatus, number>;
  byType: Record<ReminderType, number>;
  effectiveness: {
    paymentRate: number; // Percentage of invoices paid after reminder
    avgResponseTime: number; // Average days between reminder and payment
  };
  scheduled: number;
  overdue: number;
}

export class ReminderService {
  private reminderRepository: ReminderJobRepository;
  private invoiceRepository: InvoiceRepository;
  private notificationSettingsRepository: NotificationSettingsRepository;
  private notificationService: NotificationService;
  private logger: Logger;

  constructor() {
    this.reminderRepository = new ReminderJobRepository();
    this.invoiceRepository = new InvoiceRepository();
    this.notificationSettingsRepository = new NotificationSettingsRepository();
    this.notificationService = new NotificationService();
    this.logger = new Logger('ReminderService');
  }

  /**
   * Create a new reminder for an invoice
   */
  async createReminder(
    tenantContext: TenantContext,
    reminderData: CreateReminderDto,
    userId?: string
  ): Promise<ReminderJob> {
    this.logger.info('Creating reminder', {
      invoiceId: reminderData.invoiceId,
      type: reminderData.type,
      tenantId: tenantContext.tenantId
    });

    try {
      // Verify invoice exists and belongs to tenant
      const invoice = await this.invoiceRepository.findById(
        tenantContext,
        reminderData.invoiceId
      );
      if (!invoice) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Invoice not found', 404);
      }

      // Calculate scheduled date if not provided
      let scheduledFor = reminderData.scheduledFor;
      if (!scheduledFor) {
        scheduledFor = this.calculateReminderDate(invoice, reminderData.configuration);
      }

      // Check if reminder should be skipped based on current invoice state
      const skipCheck = this.shouldSkipReminder(invoice, reminderData);
      if (skipCheck.skip) {
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR,
          `Cannot create reminder: ${skipCheck.reason}`,
          400
        );
      }

      const createData = {
        organizationId: tenantContext.tenantId,
        invoiceId: reminderData.invoiceId,
        userId,
        type: reminderData.type,
        configuration: reminderData.configuration,
        priority: reminderData.priority || 'normal',
        scheduledFor,
        maxOccurrences: reminderData.maxOccurrences,
        status: 'scheduled' as ReminderStatus,
        metadata: {
          originalDueDate: invoice.dueDate?.toISOString(),
          invoiceAmount: invoice.amount,
          clientEmail: invoice.clientEmail,
          reminderReason: this.generateReminderReason(reminderData.type, reminderData.configuration),
        },
      };

      const reminder = await this.reminderRepository.create(tenantContext, createData);

      this.logger.info('Reminder created successfully', {
        reminderId: reminder.id,
        invoiceId: reminderData.invoiceId,
        scheduledFor: scheduledFor.toISOString(),
        tenantId: tenantContext.tenantId
      });

      return reminder;
    } catch (error: any) {
      this.logger.error('Failed to create reminder', {
        error: error.message,
        invoiceId: reminderData.invoiceId,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Get reminder by ID
   */
  async getReminderById(tenantContext: TenantContext, reminderId: string): Promise<ReminderJob> {
    const reminder = await this.reminderRepository.findById(tenantContext, reminderId);
    if (!reminder) {
      throw new FluxionError(ErrorCodes.NOT_FOUND, 'Reminder not found', 404);
    }
    return reminder;
  }

  /**
   * Update reminder
   */
  async updateReminder(
    tenantContext: TenantContext,
    reminderId: string,
    updateData: UpdateReminderDto
  ): Promise<ReminderJob> {
    this.logger.info('Updating reminder', { reminderId, tenantId: tenantContext.tenantId });

    try {
      const existingReminder = await this.getReminderById(tenantContext, reminderId);

      // Prevent updates to completed reminders
      if (['sent', 'cancelled', 'skipped'].includes(existingReminder.status)) {
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR,
          `Cannot update reminder with status: ${existingReminder.status}`,
          400
        );
      }

      const updates: Partial<ReminderJob> = {};

      if (updateData.configuration) {
        updates.configuration = { ...existingReminder.configuration, ...updateData.configuration };
      }

      if (updateData.priority) {
        updates.priority = updateData.priority;
      }

      if (updateData.scheduledFor) {
        updates.scheduledFor = updateData.scheduledFor;
        // Reset status to scheduled if it was failed
        if (existingReminder.status === 'failed') {
          updates.status = 'scheduled';
          updates.retryCount = 0;
          updates.errorMessage = undefined;
          updates.errorCode = undefined;
        }
      }

      if (updateData.maxOccurrences !== undefined) {
        updates.maxOccurrences = updateData.maxOccurrences;
      }

      const updatedReminder = await this.reminderRepository.update(
        tenantContext,
        reminderId,
        updates
      );

      this.logger.info('Reminder updated successfully', { reminderId, tenantId: tenantContext.tenantId });

      return updatedReminder;
    } catch (error: any) {
      this.logger.error('Failed to update reminder', {
        error: error.message,
        reminderId,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Cancel a reminder
   */
  async cancelReminder(tenantContext: TenantContext, reminderId: string): Promise<void> {
    this.logger.info('Cancelling reminder', { reminderId, tenantId: tenantContext.tenantId });

    try {
      const reminder = await this.getReminderById(tenantContext, reminderId);

      if (['sent', 'cancelled'].includes(reminder.status)) {
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR,
          `Cannot cancel reminder with status: ${reminder.status}`,
          400
        );
      }

      await this.reminderRepository.update(tenantContext, reminderId, {
        status: 'cancelled',
        metadata: {
          ...reminder.metadata,
          skipReasons: [...(reminder.metadata.skipReasons || []), 'Manually cancelled'],
        },
      });

      this.logger.info('Reminder cancelled successfully', { reminderId, tenantId: tenantContext.tenantId });
    } catch (error: any) {
      this.logger.error('Failed to cancel reminder', {
        error: error.message,
        reminderId,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Search reminders with filters
   */
  async searchReminders(
    tenantContext: TenantContext,
    filters: ReminderSearchFilters,
    options: { limit?: number; nextToken?: string } = {}
  ): Promise<PaginatedResult<ReminderJob>> {
    this.logger.info('Searching reminders', {
      filters,
      tenantId: tenantContext.tenantId
    });

    try {
      const result = await this.reminderRepository.searchReminders(
        tenantContext,
        filters,
        { limit: options.limit || 20, nextToken: options.nextToken }
      );

      this.logger.info('Reminders search completed', {
        count: result.items.length,
        total: result.total,
        tenantId: tenantContext.tenantId
      });

      return result;
    } catch (error: any) {
      this.logger.error('Failed to search reminders', {
        error: error.message,
        filters,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Get all reminders for a specific invoice
   */
  async getInvoiceReminders(tenantContext: TenantContext, invoiceId: string): Promise<ReminderJob[]> {
    this.logger.info('Getting invoice reminders', { invoiceId, tenantId: tenantContext.tenantId });

    try {
      // Verify invoice exists
      const invoice = await this.invoiceRepository.findById(tenantContext, invoiceId);
      if (!invoice) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Invoice not found', 404);
      }

      const reminders = await this.reminderRepository.findByInvoiceId(tenantContext, invoiceId);

      this.logger.info('Invoice reminders retrieved', {
        invoiceId,
        count: reminders.length,
        tenantId: tenantContext.tenantId
      });

      return reminders;
    } catch (error: any) {
      this.logger.error('Failed to get invoice reminders', {
        error: error.message,
        invoiceId,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Setup default reminders for an invoice
   */
  async setupInvoiceReminders(
    tenantContext: TenantContext,
    invoiceId: string,
    reminderType: 'standard' | 'aggressive' | 'minimal' | 'custom',
    customSchedule?: { dueDateReminders?: number[]; overdueReminders?: number[] },
    replaceExisting: boolean = false,
    userId?: string
  ): Promise<{ reminders: ReminderJob[]; setupType: string; totalCreated: number }> {
    this.logger.info('Setting up invoice reminders', {
      invoiceId,
      reminderType,
      replaceExisting,
      tenantId: tenantContext.tenantId
    });

    try {
      // Verify invoice exists
      const invoice = await this.invoiceRepository.findById(tenantContext, invoiceId);
      if (!invoice) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Invoice not found', 404);
      }

      // Remove existing reminders if requested
      if (replaceExisting) {
        const existingReminders = await this.getInvoiceReminders(tenantContext, invoiceId);
        for (const reminder of existingReminders) {
          if (['scheduled', 'pending', 'failed'].includes(reminder.status)) {
            await this.cancelReminder(tenantContext, reminder.id);
          }
        }
      }

      // Get reminder schedule based on type
      const schedule = this.getReminderSchedule(reminderType, customSchedule);
      
      // Get organization's notification settings for defaults
      const orgSettings = await this.getOrganizationReminderSettings(tenantContext);
      
      const createdReminders: ReminderJob[] = [];

      // Create due date reminders
      for (const daysBefore of schedule.dueDateReminders) {
        try {
          const configuration: ReminderConfiguration = {
            intervalDays: daysBefore,
            isOverdueReminder: false,
            businessDaysOnly: orgSettings.businessDaysOnly,
            excludeWeekends: orgSettings.excludeWeekends,
            reminderTime: orgSettings.reminderTime,
            timezone: orgSettings.timezone,
            webhookEnabled: orgSettings.webhookEnabled,
            smsEnabled: false,
            customMessage: `Your invoice is due in ${daysBefore} day(s). Please ensure timely payment.`,
          };

          const reminder = await this.createReminder(tenantContext, {
            invoiceId,
            type: 'due_date',
            configuration,
            priority: daysBefore <= 1 ? 'high' : 'normal',
            maxOccurrences: 1,
          }, userId);

          createdReminders.push(reminder);
        } catch (error: any) {
          this.logger.warn('Failed to create due date reminder', {
            invoiceId,
            daysBefore,
            error: error.message
          });
        }
      }

      // Create overdue reminders
      for (const daysAfter of schedule.overdueReminders) {
        try {
          const configuration: ReminderConfiguration = {
            intervalDays: daysAfter,
            isOverdueReminder: true,
            businessDaysOnly: orgSettings.businessDaysOnly,
            excludeWeekends: orgSettings.excludeWeekends,
            reminderTime: orgSettings.reminderTime,
            timezone: orgSettings.timezone,
            webhookEnabled: orgSettings.webhookEnabled,
            smsEnabled: false,
            customMessage: `Your invoice is now ${daysAfter} day(s) overdue. Please pay immediately to avoid additional fees.`,
            conditions: {
              statuses: ['sent', 'overdue'],
              excludeStatuses: ['paid', 'cancelled'],
            },
          };

          const reminder = await this.createReminder(tenantContext, {
            invoiceId,
            type: 'overdue',
            configuration,
            priority: 'high',
            maxOccurrences: 3,
          }, userId);

          createdReminders.push(reminder);
        } catch (error: any) {
          this.logger.warn('Failed to create overdue reminder', {
            invoiceId,
            daysAfter,
            error: error.message
          });
        }
      }

      this.logger.info('Invoice reminders setup completed', {
        invoiceId,
        reminderType,
        totalCreated: createdReminders.length,
        tenantId: tenantContext.tenantId
      });

      return {
        reminders: createdReminders,
        setupType: reminderType,
        totalCreated: createdReminders.length,
      };
    } catch (error: any) {
      this.logger.error('Failed to setup invoice reminders', {
        error: error.message,
        invoiceId,
        reminderType,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Create bulk reminders for multiple invoices
   */
  async createBulkReminders(
    tenantContext: TenantContext,
    bulkData: BulkReminderDto,
    userId?: string
  ): Promise<BulkReminderResult> {
    this.logger.info('Creating bulk reminders', {
      invoiceCount: bulkData.invoiceIds.length,
      reminderType: bulkData.reminderType,
      tenantId: tenantContext.tenantId
    });

    const result: BulkReminderResult = {
      created: 0,
      skipped: 0,
      failed: 0,
      results: [],
    };

    for (const invoiceId of bulkData.invoiceIds) {
      try {
        // Check if reminder should be replaced or skipped
        if (!bulkData.replaceExisting) {
          const existingReminders = await this.getInvoiceReminders(tenantContext, invoiceId);
          const hasActiveReminder = existingReminders.some(r => 
            r.type === bulkData.reminderType && 
            ['scheduled', 'pending'].includes(r.status)
          );

          if (hasActiveReminder) {
            result.skipped++;
            result.results.push({
              invoiceId,
              status: 'skipped',
              error: 'Active reminder of same type already exists',
            });
            continue;
          }
        }

        const reminder = await this.createReminder(tenantContext, {
          invoiceId,
          type: bulkData.reminderType,
          configuration: bulkData.configuration,
        }, userId);

        result.created++;
        result.results.push({
          invoiceId,
          status: 'created',
          reminderId: reminder.id,
        });
      } catch (error: any) {
        result.failed++;
        result.results.push({
          invoiceId,
          status: 'failed',
          error: error.message,
        });
      }
    }

    this.logger.info('Bulk reminder creation completed', {
      total: bulkData.invoiceIds.length,
      created: result.created,
      skipped: result.skipped,
      failed: result.failed,
      tenantId: tenantContext.tenantId
    });

    return result;
  }

  /**
   * Get reminder statistics
   */
  async getReminderStats(tenantContext: TenantContext): Promise<ReminderStats> {
    this.logger.info('Getting reminder statistics', { tenantId: tenantContext.tenantId });

    try {
      const stats = await this.reminderRepository.getReminderStats(tenantContext);
      
      // Calculate effectiveness metrics
      const effectiveness = await this.calculateReminderEffectiveness(tenantContext);

      const result: ReminderStats = {
        total: stats.total,
        byStatus: stats.byStatus,
        byType: stats.byType,
        effectiveness,
        scheduled: stats.byStatus.scheduled || 0,
        overdue: stats.overdueCount || 0,
      };

      this.logger.info('Reminder statistics calculated', {
        total: result.total,
        tenantId: tenantContext.tenantId
      });

      return result;
    } catch (error: any) {
      this.logger.error('Failed to get reminder statistics', {
        error: error.message,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Manually execute a reminder (trigger immediate delivery)
   */
  async executeReminder(
    tenantContext: TenantContext,
    reminderId: string
  ): Promise<{ executed: boolean; notificationId?: string; message: string }> {
    this.logger.info('Manually executing reminder', { reminderId, tenantId: tenantContext.tenantId });

    try {
      const reminder = await this.getReminderById(tenantContext, reminderId);

      if (!['scheduled', 'pending', 'failed'].includes(reminder.status)) {
        throw new FluxionError(
          ErrorCodes.VALIDATION_ERROR,
          `Cannot execute reminder with status: ${reminder.status}`,
          400
        );
      }

      // Get the invoice to check current state
      const invoice = await this.invoiceRepository.findById(tenantContext, reminder.invoiceId);
      if (!invoice) {
        throw new FluxionError(ErrorCodes.NOT_FOUND, 'Invoice not found', 404);
      }

      // Check if reminder should be skipped
      const skipCheck = reminder.shouldSkipReminder(invoice);
      if (skipCheck.skip) {
        // Mark as skipped instead of executing
        await this.reminderRepository.update(tenantContext, reminderId, {
          status: 'skipped',
          metadata: {
            ...reminder.metadata,
            skipReasons: [...(reminder.metadata.skipReasons || []), skipCheck.reason!],
          },
        });

        return {
          executed: false,
          message: `Reminder skipped: ${skipCheck.reason}`,
        };
      }

      // Execute the reminder by creating notification
      const notificationId = await this.sendReminderNotification(tenantContext, reminder, invoice);

      // Update reminder status
      await this.reminderRepository.update(tenantContext, reminderId, {
        status: 'sent',
        sentAt: new Date(),
        notificationId,
        occurrenceCount: reminder.occurrenceCount + 1,
        metadata: {
          ...reminder.metadata,
          deliveryAttempts: [
            ...(reminder.metadata.deliveryAttempts || []),
            {
              timestamp: new Date().toISOString(),
              method: 'email' as const,
              status: 'success' as const,
            },
          ],
        },
      });

      this.logger.info('Reminder executed successfully', {
        reminderId,
        notificationId,
        tenantId: tenantContext.tenantId
      });

      return {
        executed: true,
        notificationId,
        message: 'Reminder executed successfully',
      };
    } catch (error: any) {
      this.logger.error('Failed to execute reminder', {
        error: error.message,
        reminderId,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  /**
   * Process due reminders (called by background job processor)
   */
  async processDueReminders(tenantContext: TenantContext): Promise<{ processed: number; failed: number }> {
    this.logger.info('Processing due reminders', { tenantId: tenantContext.tenantId });

    try {
      const dueReminders = await this.reminderRepository.findDueReminders(tenantContext);
      
      let processed = 0;
      let failed = 0;

      for (const reminder of dueReminders) {
        try {
          await this.executeReminder(tenantContext, reminder.id);
          processed++;
        } catch (error: any) {
          this.logger.error('Failed to process due reminder', {
            error: error.message,
            reminderId: reminder.id
          });
          failed++;

          // Mark reminder as failed
          await this.reminderRepository.update(tenantContext, reminder.id, {
            status: 'failed',
            errorMessage: error.message,
            retryCount: reminder.retryCount + 1,
          });
        }
      }

      this.logger.info('Due reminders processing completed', {
        total: dueReminders.length,
        processed,
        failed,
        tenantId: tenantContext.tenantId
      });

      return { processed, failed };
    } catch (error: any) {
      this.logger.error('Failed to process due reminders', {
        error: error.message,
        tenantId: tenantContext.tenantId
      });
      throw error;
    }
  }

  // Private helper methods

  private calculateReminderDate(invoice: Invoice, configuration: ReminderConfiguration): Date {
    const baseDate = configuration.isOverdueReminder 
      ? (invoice.dueDate || new Date()) 
      : (invoice.dueDate || new Date());

    const targetDate = new Date(baseDate);
    
    if (configuration.isOverdueReminder) {
      // Add days for overdue reminders
      targetDate.setDate(targetDate.getDate() + configuration.intervalDays);
    } else {
      // Subtract days for due date reminders
      targetDate.setDate(targetDate.getDate() - configuration.intervalDays);
    }

    // Set the time based on configuration
    const [hours, minutes] = configuration.reminderTime.split(':').map(Number);
    targetDate.setHours(hours, minutes, 0, 0);

    // Handle business days and weekend exclusions
    if (configuration.businessDaysOnly || configuration.excludeWeekends) {
      while (this.isNonBusinessDay(targetDate, configuration)) {
        if (configuration.isOverdueReminder) {
          targetDate.setDate(targetDate.getDate() + 1);
        } else {
          targetDate.setDate(targetDate.getDate() - 1);
        }
      }
    }

    return targetDate;
  }

  private isNonBusinessDay(date: Date, configuration: ReminderConfiguration): boolean {
    const dayOfWeek = date.getDay();
    
    if (configuration.excludeWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
      return true;
    }

    // Additional business day logic can be added here (holidays, etc.)
    return false;
  }

  private shouldSkipReminder(
    invoice: Invoice, 
    reminderData: CreateReminderDto
  ): { skip: boolean; reason?: string } {
    // Check invoice status
    if (invoice.isPaid) {
      return { skip: true, reason: 'Invoice is already paid' };
    }

    if (invoice.status === 'cancelled') {
      return { skip: true, reason: 'Invoice is cancelled' };
    }

    if (invoice.status === 'draft') {
      return { skip: true, reason: 'Invoice is still in draft status' };
    }

    // Check if due date reminder makes sense
    if (!reminderData.configuration.isOverdueReminder && !invoice.dueDate) {
      return { skip: true, reason: 'Invoice has no due date for due date reminder' };
    }

    // Check amount conditions
    const config = reminderData.configuration;
    if (config.conditions) {
      const amount = parseFloat(invoice.amount);
      
      if (config.conditions.minAmount && amount < parseFloat(config.conditions.minAmount)) {
        return { skip: true, reason: `Invoice amount ${amount} below minimum ${config.conditions.minAmount}` };
      }

      if (config.conditions.maxAmount && amount > parseFloat(config.conditions.maxAmount)) {
        return { skip: true, reason: `Invoice amount ${amount} above maximum ${config.conditions.maxAmount}` };
      }

      if (config.conditions.statuses && !config.conditions.statuses.includes(invoice.status)) {
        return { skip: true, reason: `Invoice status ${invoice.status} not in allowed statuses` };
      }

      if (config.conditions.excludeStatuses && config.conditions.excludeStatuses.includes(invoice.status)) {
        return { skip: true, reason: `Invoice status ${invoice.status} is excluded` };
      }
    }

    return { skip: false };
  }

  private generateReminderReason(type: ReminderType, configuration: ReminderConfiguration): string {
    if (configuration.isOverdueReminder) {
      return `Invoice overdue by ${configuration.intervalDays} day(s)`;
    } else {
      return `Invoice due in ${configuration.intervalDays} day(s)`;
    }
  }

  private getReminderSchedule(
    type: 'standard' | 'aggressive' | 'minimal' | 'custom',
    customSchedule?: { dueDateReminders?: number[]; overdueReminders?: number[] }
  ): { dueDateReminders: number[]; overdueReminders: number[] } {
    switch (type) {
      case 'minimal':
        return {
          dueDateReminders: [3], // 3 days before due
          overdueReminders: [7], // 7 days after due
        };
      
      case 'standard':
        return {
          dueDateReminders: [7, 3, 1], // 7, 3, 1 days before due
          overdueReminders: [1, 7, 14], // 1, 7, 14 days after due
        };
      
      case 'aggressive':
        return {
          dueDateReminders: [14, 7, 3, 1], // 14, 7, 3, 1 days before due
          overdueReminders: [1, 3, 7, 14, 30], // 1, 3, 7, 14, 30 days after due
        };
      
      case 'custom':
        return {
          dueDateReminders: customSchedule?.dueDateReminders || [7, 3, 1],
          overdueReminders: customSchedule?.overdueReminders || [1, 7, 14],
        };
      
      default:
        return {
          dueDateReminders: [7, 3, 1],
          overdueReminders: [1, 7, 14],
        };
    }
  }

  private async getOrganizationReminderSettings(tenantContext: TenantContext): Promise<{
    businessDaysOnly: boolean;
    excludeWeekends: boolean;
    reminderTime: string;
    timezone: string;
    webhookEnabled: boolean;
  }> {
    try {
      // Try to get organization's notification settings
      const settings = await this.notificationSettingsRepository.findByOrganization(tenantContext);
      
      if (settings && settings.reminderSettings) {
        return {
          businessDaysOnly: settings.reminderSettings.businessDaysOnly,
          excludeWeekends: settings.reminderSettings.excludeWeekends,
          reminderTime: settings.reminderSettings.reminderTime,
          timezone: settings.reminderSettings.timezone,
          webhookEnabled: settings.webhookSettings.enabled,
        };
      }
    } catch (error) {
      this.logger.warn('Could not load organization reminder settings, using defaults', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tenantId: tenantContext.tenantId
      });
    }

    // Return defaults
    return {
      businessDaysOnly: false,
      excludeWeekends: false,
      reminderTime: '09:00',
      timezone: 'UTC',
      webhookEnabled: false,
    };
  }

  private async sendReminderNotification(
    tenantContext: TenantContext,
    reminder: ReminderJob,
    invoice: Invoice
  ): Promise<string> {
    const templateData = {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceTitle: invoice.title,
      invoiceAmount: invoice.amount,
      invoiceDueDate: invoice.dueDate?.toISOString(),
      invoiceStatus: invoice.status,
      clientName: invoice.clientName,
      clientEmail: invoice.clientEmail,
      paymentUrl: `${process.env.FRONTEND_URL || 'https://fluxion.app'}/invoice/${invoice.id}`,
      customMessage: reminder.configuration.customMessage,
      reminderType: reminder.type,
      daysOverdue: reminder.configuration.isOverdueReminder ? reminder.configuration.intervalDays : undefined,
      daysTillDue: !reminder.configuration.isOverdueReminder ? reminder.configuration.intervalDays : undefined,
    };

    const notificationId = await this.notificationService.sendNotification(tenantContext, {
      type: reminder.type === 'overdue' ? 'payment_overdue' : 'payment_reminder',
      recipientEmail: invoice.clientEmail || '',
      templateData,
      priority: reminder.priority === 'urgent' ? 'urgent' : 'normal',
      scheduledFor: new Date(), // Send immediately when executed
    });

    return notificationId;
  }

  private async calculateReminderEffectiveness(
    tenantContext: TenantContext
  ): Promise<{ paymentRate: number; avgResponseTime: number }> {
    try {
      const effectiveness = await this.reminderRepository.getReminderEffectiveness(tenantContext);
      return effectiveness;
    } catch (error) {
      this.logger.warn('Could not calculate reminder effectiveness', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tenantId: tenantContext.tenantId
      });
      
      return {
        paymentRate: 0,
        avgResponseTime: 0,
      };
    }
  }
}