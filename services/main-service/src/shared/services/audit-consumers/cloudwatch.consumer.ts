import { 
  CloudWatchLogsClient, 
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  DescribeLogStreamsCommand,
  PutLogEventsCommand,
  PutRetentionPolicyCommand,
  PutLogEventsCommandInput 
} from '@aws-sdk/client-cloudwatch-logs';
import { Logger } from '../../utils/logger';
import { AuditEvent, EventConsumer } from '../audit-event.service';

export class CloudWatchAuditConsumer implements EventConsumer {
  name = 'cloudwatch';
  private logger = new Logger('CloudWatchAuditConsumer');
  private cloudWatchLogs: CloudWatchLogsClient;
  private logGroupName: string;
  private logStreamName: string;
  private sequenceToken?: string;

  constructor() {
    this.cloudWatchLogs = new CloudWatchLogsClient({
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
      const command = new DescribeLogStreamsCommand({
        logGroupName: this.logGroupName,
        logStreamNamePrefix: this.logStreamName
      });
      const streams = await this.cloudWatchLogs.send(command);

      const existingStream = streams.logStreams?.find(
        stream => stream.logStreamName === this.logStreamName
      );

      if (existingStream) {
        this.sequenceToken = existingStream.uploadSequenceToken;
      } else {
        // Create log stream
        const createCommand = new CreateLogStreamCommand({
          logGroupName: this.logGroupName,
          logStreamName: this.logStreamName
        });
        await this.cloudWatchLogs.send(createCommand);
      }

    } catch (error: any) {
      if (error.name !== 'ResourceAlreadyExistsException') {
        throw error;
      }
    }
  }

  private async ensureLogGroup(): Promise<void> {
    try {
      const createCommand = new CreateLogGroupCommand({
        logGroupName: this.logGroupName
      });
      await this.cloudWatchLogs.send(createCommand);

      // Set retention policy (30 days)
      const retentionCommand = new PutRetentionPolicyCommand({
        logGroupName: this.logGroupName,
        retentionInDays: 30
      });
      await this.cloudWatchLogs.send(retentionCommand);

    } catch (error: any) {
      if (error.name !== 'ResourceAlreadyExistsException') {
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

    const params: PutLogEventsCommandInput = {
      logGroupName: this.logGroupName,
      logStreamName: this.logStreamName,
      logEvents: [logEntry]
    };

    if (this.sequenceToken) {
      params.sequenceToken = this.sequenceToken;
    }

    const command = new PutLogEventsCommand(params);
    const result = await this.cloudWatchLogs.send(command);
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
        
        const params: PutLogEventsCommandInput = {
          logGroupName: this.logGroupName,
          logStreamName: this.logStreamName,
          logEvents: batch
        };

        if (this.sequenceToken) {
          params.sequenceToken = this.sequenceToken;
        }

        const command = new PutLogEventsCommand(params);
        const result = await this.cloudWatchLogs.send(command);
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