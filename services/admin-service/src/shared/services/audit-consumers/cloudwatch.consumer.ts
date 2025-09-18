import AWS from 'aws-sdk';
import { Logger } from '../../utils/logger';
import { AuditEvent, EventConsumer } from '../audit-event.service';

export class CloudWatchAuditConsumer implements EventConsumer {
  name = 'cloudwatch';
  private logger = new Logger('CloudWatchAuditConsumer');
  private cloudWatchLogs: AWS.CloudWatchLogs;
  private logGroupName: string;
  private logStreamName: string;
  private sequenceToken?: string;

  constructor() {
    this.cloudWatchLogs = new AWS.CloudWatchLogs({
      region: process.env.AWS_REGION || 'us-east-1'
    });
    
    this.logGroupName = process.env.CLOUDWATCH_LOG_GROUP || '/fluxion/audit-logs';
    this.logStreamName = process.env.CLOUDWATCH_LOG_STREAM || 
      `audit-${new Date().toISOString().split('T')[0]}-${Date.now()}`;
  }

  isEnabled(): boolean {
    return !!(process.env.NODE_ENV === 'production' || process.env.ENABLE_CLOUDWATCH_LOGGING === 'true');
  }

  async handle(event: AuditEvent): Promise<void> {
    if (!this.isEnabled()) return;

    try {
      await this.ensureLogStream();
      await this.sendLogEvent(event);

      this.logger.debug('Audit event sent to CloudWatch', {
        eventType: event.type,
        eventAction: event.action,
        userId: event.userId,
        organizationId: event.organizationId,
        logGroup: this.logGroupName,
        logStream: this.logStreamName
      });

    } catch (error: any) {
      this.logger.error('Failed to send audit event to CloudWatch', {
        error: error.message,
        eventType: event.type,
        eventAction: event.action,
        userId: event.userId,
        organizationId: event.organizationId
      });
      // Don't rethrow - CloudWatch failures shouldn't block the application
    }
  }

  private async ensureLogStream(): Promise<void> {
    try {
      // First, ensure the log group exists
      await this.ensureLogGroup();

      // Check if log stream exists
      const streams = await this.cloudWatchLogs.describeLogStreams({
        logGroupName: this.logGroupName,
        logStreamNamePrefix: this.logStreamName
      }).promise();

      const existingStream = streams.logStreams?.find(
        stream => stream.logStreamName === this.logStreamName
      );

      if (existingStream) {
        this.sequenceToken = existingStream.uploadSequenceToken;
      } else {
        // Create log stream
        await this.cloudWatchLogs.createLogStream({
          logGroupName: this.logGroupName,
          logStreamName: this.logStreamName
        }).promise();
      }

    } catch (error: any) {
      if (error.code !== 'ResourceAlreadyExistsException') {
        throw error;
      }
    }
  }

  private async ensureLogGroup(): Promise<void> {
    try {
      await this.cloudWatchLogs.createLogGroup({
        logGroupName: this.logGroupName
      }).promise();

      // Set retention policy (30 days)
      await this.cloudWatchLogs.putRetentionPolicy({
        logGroupName: this.logGroupName,
        retentionInDays: 30
      }).promise();

    } catch (error: any) {
      if (error.code !== 'ResourceAlreadyExistsException') {
        throw error;
      }
    }
  }

  private async sendLogEvent(event: AuditEvent): Promise<void> {
    const logEntry = {
      timestamp: event.timestamp.getTime(),
      message: JSON.stringify({
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
        timestamp: event.timestamp.toISOString(),
        source: 'fluxion-audit-system'
      }, null, 2)
    };

    const params: AWS.CloudWatchLogs.PutLogEventsRequest = {
      logGroupName: this.logGroupName,
      logStreamName: this.logStreamName,
      logEvents: [logEntry]
    };

    if (this.sequenceToken) {
      params.sequenceToken = this.sequenceToken;
    }

    const result = await this.cloudWatchLogs.putLogEvents(params).promise();
    this.sequenceToken = result.nextSequenceToken;
  }

  // Helper method for batch logging
  async handleBatch(events: AuditEvent[]): Promise<void> {
    if (!this.isEnabled() || !events.length) return;

    try {
      await this.ensureLogStream();

      const logEvents = events.map(event => ({
        timestamp: event.timestamp.getTime(),
        message: JSON.stringify({
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
          timestamp: event.timestamp.toISOString(),
          source: 'fluxion-audit-system'
        }, null, 2)
      }));

      // CloudWatch has a limit of 10,000 log events per batch
      const batchSize = 1000;
      for (let i = 0; i < logEvents.length; i += batchSize) {
        const batch = logEvents.slice(i, i + batchSize);
        
        const params: AWS.CloudWatchLogs.PutLogEventsRequest = {
          logGroupName: this.logGroupName,
          logStreamName: this.logStreamName,
          logEvents: batch
        };

        if (this.sequenceToken) {
          params.sequenceToken = this.sequenceToken;
        }

        const result = await this.cloudWatchLogs.putLogEvents(params).promise();
        this.sequenceToken = result.nextSequenceToken;
      }

      this.logger.info('Batch audit events sent to CloudWatch', {
        eventCount: events.length,
        logGroup: this.logGroupName,
        logStream: this.logStreamName
      });

    } catch (error: any) {
      this.logger.error('Failed to send batch audit events to CloudWatch', {
        error: error.message,
        eventCount: events.length
      });
    }
  }
}