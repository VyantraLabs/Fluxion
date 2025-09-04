/**
 * Local development server for notification Lambda
 * This file simulates SQS message processing for local testing
 */

// Load configuration first
import { config } from '@/config';
import { SQSEvent, SQSRecord, Context } from 'aws-lambda';
import { handler } from './index';
import { Logger } from '@/utils/logger';

const logger = new Logger('NotificationLocalServer');

logger.info('Starting Fluxion Notification Lambda in local development mode', {
  port: config.port,
  environment: config.environment,
  from_email: config.aws.ses.fromEmail,
  from_name: config.aws.ses.fromName,
  log_level: config.logging.level,
  region: config.aws.region,
  ses_region: config.aws.ses.region
});

/**
 * Create a mock Lambda context for testing
 */
function createMockContext(): Context {
  return {
    callbackWaitsForEmptyEventLoop: true,
    functionName: 'fluxion-notification-lambda-local',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789012:function:fluxion-notification-lambda-local',
    memoryLimitInMB: '128',
    awsRequestId: `test-request-${Date.now()}`,
    logGroupName: '/aws/lambda/fluxion-notification-lambda-local',
    logStreamName: `2024/01/01/[$LATEST]${Date.now().toString(16)}`,
    getRemainingTimeInMillis: () => 30000,
    done: () => {},
    fail: () => {},
    succeed: () => {}
  };
}

/**
 * Create a mock SQS event for testing
 */
function createMockSQSEvent(notificationData: any): SQSEvent {
  const record: SQSRecord = {
    messageId: `test-message-${Date.now()}`,
    receiptHandle: 'test-receipt-handle',
    body: JSON.stringify(notificationData),
    attributes: {
      ApproximateReceiveCount: '1',
      SentTimestamp: Date.now().toString(),
      SenderId: 'test-sender',
      ApproximateFirstReceiveTimestamp: Date.now().toString()
    },
    messageAttributes: {},
    md5OfBody: 'test-md5',
    eventSource: 'aws:sqs',
    eventSourceARN: 'arn:aws:sqs:us-east-1:123456789012:test-queue',
    awsRegion: 'us-east-1'
  };

  return {
    Records: [record]
  };
}

/**
 * Test different notification types
 */
async function testNotifications() {
  logger.info('Testing notification lambda with sample data...');

  // Test Invoice Created notification
  try {
    const invoiceCreatedEvent = createMockSQSEvent({
      type: 'INVOICE_CREATED',
      data: {
        invoice_id: 'inv_test_123',
        client_email: 'rishi@vyantra.io',
        client_name: 'John Doe',
        creator_name: 'Jane Smith',
        amount: 1500,
        payment_url: 'https://app.fluxion.pay/invoice/inv_test_123',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        description: 'Website development services'
      },
      recipient: 'rishi@vyantra.io',
      priority: 'high',
      timestamp: new Date().toISOString(),
      requestId: 'test-req-123'
    });

    logger.info('Testing INVOICE_CREATED notification...');
    await handler(invoiceCreatedEvent, createMockContext(), () => {});
  } catch (error) {
    logger.error('Failed to test INVOICE_CREATED notification:', error);
  }

  // Test Payment Received notification
  try {
    const paymentReceivedEvent = createMockSQSEvent({
      type: 'PAYMENT_RECEIVED',
      data: {
        invoice_id: 'inv_test_123',
        payment_id: 'pay_test_456',
        creator_email: 'rishi@vyantra.io',
        client_name: 'John Doe',
        amount: 1500,
        tx_hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        payment_date: new Date().toISOString()
      },
      recipient: 'rishi@vyantra.io',
      priority: 'high',
      timestamp: new Date().toISOString(),
      requestId: 'test-req-456'
    });

    logger.info('Testing PAYMENT_RECEIVED notification...');
    await handler(paymentReceivedEvent, createMockContext(), () => {});
  } catch (error) {
    logger.error('Failed to test PAYMENT_RECEIVED notification:', error);
  }

  // Test Invoice Reminder notification
  try {
    const reminderEvent = createMockSQSEvent({
      type: 'INVOICE_REMINDER',
      data: {
        invoice_id: 'inv_test_789',
        client_email: 'client@example.com',
        client_name: 'John Doe',
        creator_name: 'Jane Smith',
        amount: 2500,
        payment_url: 'https://app.fluxion.pay/invoice/inv_test_789',
        due_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
        days_overdue: 3
      },
      recipient: 'client@example.com',
      priority: 'normal',
      timestamp: new Date().toISOString(),
      requestId: 'test-req-789'
    });

    logger.info('Testing INVOICE_REMINDER notification...');
    await handler(reminderEvent, createMockContext(), () => {});
  } catch (error) {
    logger.error('Failed to test INVOICE_REMINDER notification:', error);
  }

  logger.info('Notification testing completed');
}

// Run tests immediately when started
testNotifications().then(() => {
  logger.info('🚀 Notification Lambda local testing completed!', {
    port: config.port,
    environment: config.environment,
    timestamp: new Date().toISOString(),
    note: 'Lambda function has been tested with sample notifications'
  });
}).catch((error) => {
  logger.error('Failed to run notification tests:', error);
  process.exit(1);
});

// Keep the process alive for potential future testing
setInterval(() => {
  logger.debug('Notification Lambda local server is still running...', {
    timestamp: new Date().toISOString()
  });
}, 60000); // Log every minute

// Enhanced error handling for development
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception thrown:', { error: error.message, stack: error.stack });
  process.exit(1);
});