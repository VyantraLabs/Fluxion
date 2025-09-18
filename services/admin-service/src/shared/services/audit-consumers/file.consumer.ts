import fs from 'fs';
import path from 'path';
import { Logger } from '../../utils/logger';
import { AuditEvent, EventConsumer } from '../audit-event.service';

export class FileAuditConsumer implements EventConsumer {
  name = 'file';
  private logger = new Logger('FileAuditConsumer');
  private logDirectory: string;
  private currentLogFile?: string;
  private fileStream?: fs.WriteStream;

  constructor() {
    this.logDirectory = process.env.AUDIT_LOG_DIRECTORY || path.join(process.cwd(), 'logs', 'audit');
    this.ensureLogDirectory();
  }

  isEnabled(): boolean {
    return process.env.NODE_ENV === 'development' || 
           process.env.ENABLE_FILE_AUDIT_LOGGING === 'true';
  }

  async handle(event: AuditEvent): Promise<void> {
    if (!this.isEnabled()) return;

    try {
      await this.ensureLogFile(event.timestamp);
      await this.writeLogEntry(event);

      this.logger.debug('Audit event written to file', {
        eventType: event.type,
        eventAction: event.action,
        userId: event.userId,
        organizationId: event.organizationId,
        logFile: this.currentLogFile
      });

    } catch (error: any) {
      this.logger.error('Failed to write audit event to file', {
        error: error.message,
        eventType: event.type,
        eventAction: event.action,
        userId: event.userId,
        organizationId: event.organizationId,
        logFile: this.currentLogFile
      });
      // Don't rethrow - file logging failures shouldn't block the application
    }
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDirectory)) {
      fs.mkdirSync(this.logDirectory, { recursive: true });
      this.logger.info(`Created audit log directory: ${this.logDirectory}`);
    }
  }

  private async ensureLogFile(timestamp: Date): Promise<void> {
    const dateStr = timestamp.toISOString().split('T')[0]; // YYYY-MM-DD
    const logFileName = `audit-${dateStr}.log`;
    const logFilePath = path.join(this.logDirectory, logFileName);

    if (this.currentLogFile !== logFilePath) {
      // Close current stream if exists
      if (this.fileStream) {
        this.fileStream.end();
      }

      // Open new stream
      this.fileStream = fs.createWriteStream(logFilePath, { flags: 'a' });
      this.currentLogFile = logFilePath;

      this.logger.debug(`Opened audit log file: ${logFilePath}`);
    }
  }

  private async writeLogEntry(event: AuditEvent): Promise<void> {
    if (!this.fileStream) {
      throw new Error('File stream not initialized');
    }

    const logEntry = {
      timestamp: event.timestamp.toISOString(),
      eventType: event.type,
      action: event.action,
      userId: event.userId,
      organizationId: event.organizationId,
      targetUserId: event.targetUserId,
      targetResourceId: event.targetResourceId,
      targetResourceType: event.targetResourceType,
      oldValues: event.oldValues,
      newValues: event.newValues,
      details: event.details,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      endpoint: event.endpoint,
      method: event.method,
      statusCode: event.statusCode,
      severity: event.severity,
      adminAction: event.adminAction,
      adminUserId: event.adminUserId,
      sessionId: event.sessionId,
      requestId: event.requestId,
      source: 'fluxion-audit-system'
    };

    return new Promise((resolve, reject) => {
      this.fileStream!.write(
        JSON.stringify(logEntry) + '\n',
        (error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        }
      );
    });
  }

  // Helper method for batch logging
  async handleBatch(events: AuditEvent[]): Promise<void> {
    if (!this.isEnabled() || !events.length) return;

    try {
      // Group events by date to ensure proper log file rotation
      const eventsByDate = new Map<string, AuditEvent[]>();
      
      for (const event of events) {
        const dateStr = event.timestamp.toISOString().split('T')[0];
        if (!eventsByDate.has(dateStr)) {
          eventsByDate.set(dateStr, []);
        }
        eventsByDate.get(dateStr)!.push(event);
      }

      // Write events to appropriate log files
      for (const [dateStr, dayEvents] of eventsByDate) {
        if (dayEvents.length > 0) {
          await this.ensureLogFile(dayEvents[0].timestamp);
          
          for (const event of dayEvents) {
            await this.writeLogEntry(event);
          }
        }
      }

      this.logger.info('Batch audit events written to file', {
        eventCount: events.length,
        logDirectory: this.logDirectory
      });

    } catch (error: any) {
      this.logger.error('Failed to write batch audit events to file', {
        error: error.message,
        eventCount: events.length,
        logDirectory: this.logDirectory
      });
    }
  }

  // Utility methods for log management
  async getLogFiles(): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(this.logDirectory);
      return files
        .filter(file => file.startsWith('audit-') && file.endsWith('.log'))
        .sort()
        .reverse(); // Most recent first
    } catch (error) {
      return [];
    }
  }

  async getLogFileSize(fileName: string): Promise<number> {
    try {
      const filePath = path.join(this.logDirectory, fileName);
      const stats = await fs.promises.stat(filePath);
      return stats.size;
    } catch (error) {
      return 0;
    }
  }

  async readLogFile(fileName: string, lines?: number): Promise<string[]> {
    try {
      const filePath = path.join(this.logDirectory, fileName);
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const allLines = content.trim().split('\n').filter(line => line.trim());
      
      if (lines && lines > 0) {
        return allLines.slice(-lines); // Return last N lines
      }
      
      return allLines;
    } catch (error) {
      return [];
    }
  }

  async cleanupOldLogs(daysToKeep: number = 30): Promise<void> {
    try {
      const files = await this.getLogFiles();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const filesToDelete = files.filter(fileName => {
        const match = fileName.match(/audit-(\d{4}-\d{2}-\d{2})\.log/);
        if (match) {
          const fileDate = new Date(match[1]);
          return fileDate < cutoffDate;
        }
        return false;
      });

      for (const fileName of filesToDelete) {
        const filePath = path.join(this.logDirectory, fileName);
        await fs.promises.unlink(filePath);
        this.logger.info(`Deleted old audit log file: ${fileName}`);
      }

      if (filesToDelete.length > 0) {
        this.logger.info(`Cleaned up ${filesToDelete.length} old audit log files`);
      }

    } catch (error: any) {
      this.logger.error('Failed to cleanup old audit log files', {
        error: error.message,
        logDirectory: this.logDirectory
      });
    }
  }

  // Close file stream on shutdown
  async close(): Promise<void> {
    if (this.fileStream) {
      return new Promise((resolve) => {
        this.fileStream!.end(() => {
          this.logger.info('Closed audit log file stream');
          resolve();
        });
      });
    }
  }
}