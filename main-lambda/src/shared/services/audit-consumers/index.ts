import { Logger } from '@/shared/utils/logger';
import { auditEventService } from '../audit-event.service';
import { DatabaseAuditConsumer } from './database.consumer';
import { CloudWatchAuditConsumer } from './cloudwatch.consumer';
import { FileAuditConsumer } from './file.consumer';

export class AuditConsumerRegistry {
  private static instance: AuditConsumerRegistry;
  private logger = new Logger('AuditConsumerRegistry');
  private consumers: Map<string, any> = new Map();

  static getInstance(): AuditConsumerRegistry {
    if (!AuditConsumerRegistry.instance) {
      AuditConsumerRegistry.instance = new AuditConsumerRegistry();
    }
    return AuditConsumerRegistry.instance;
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing audit event consumers...');

    try {
      // Database Consumer (always enabled)
      const databaseConsumer = new DatabaseAuditConsumer();
      auditEventService.registerConsumer(databaseConsumer);
      this.consumers.set('database', databaseConsumer);
      this.logger.info('Registered database audit consumer');

      // CloudWatch Consumer (production only)
      const cloudwatchConsumer = new CloudWatchAuditConsumer();
      auditEventService.registerConsumer(cloudwatchConsumer);
      this.consumers.set('cloudwatch', cloudwatchConsumer);
      this.logger.info('Registered CloudWatch audit consumer');

      // File Consumer (development only)
      const fileConsumer = new FileAuditConsumer();
      auditEventService.registerConsumer(fileConsumer);
      this.consumers.set('file', fileConsumer);
      this.logger.info('Registered file audit consumer');

      // Log enabled consumers
      const enabledConsumers = auditEventService.getConsumerStats()
        .filter(consumer => consumer.enabled)
        .map(consumer => consumer.name);

      this.logger.info('Audit event system initialized', {
        totalConsumers: this.consumers.size,
        enabledConsumers,
        environment: process.env.NODE_ENV
      });

      // Schedule cleanup tasks
      await this.scheduleCleanupTasks();

    } catch (error: any) {
      this.logger.error('Failed to initialize audit event consumers', {
        error: error.message
      });
      throw error;
    }
  }

  async scheduleCleanupTasks(): Promise<void> {
    // Schedule daily cleanup of old log files (keep 30 days)
    const fileConsumer = this.consumers.get('file');
    if (fileConsumer && fileConsumer.isEnabled()) {
      setInterval(async () => {
        try {
          await fileConsumer.cleanupOldLogs(30);
        } catch (error: any) {
          this.logger.error('Failed to cleanup old audit log files', {
            error: error.message
          });
        }
      }, 24 * 60 * 60 * 1000); // Run once per day

      this.logger.info('Scheduled daily audit log file cleanup');
    }
  }

  getConsumer(name: string): any {
    return this.consumers.get(name);
  }

  getEnabledConsumers(): string[] {
    return auditEventService.getConsumerStats()
      .filter(consumer => consumer.enabled)
      .map(consumer => consumer.name);
  }

  async shutdown(): Promise<void> {
    this.logger.info('Shutting down audit event consumers...');

    try {
      // Close file consumer stream if enabled
      const fileConsumer = this.consumers.get('file');
      if (fileConsumer && fileConsumer.isEnabled()) {
        await fileConsumer.close();
      }

      // Clear all consumers
      auditEventService.disableAllConsumers();
      this.consumers.clear();

      this.logger.info('Audit event consumers shut down successfully');

    } catch (error: any) {
      this.logger.error('Failed to shutdown audit event consumers', {
        error: error.message
      });
    }
  }
}

// Export singleton instance
export const auditConsumerRegistry = AuditConsumerRegistry.getInstance();

// Re-export consumer classes
export { DatabaseAuditConsumer } from './database.consumer';
export { CloudWatchAuditConsumer } from './cloudwatch.consumer';
export { FileAuditConsumer } from './file.consumer';