# Fluxion Notification Lambda

Production-ready serverless notification service for the Fluxion Web3 payment platform. Processes email and webhook notifications with comprehensive error handling, retry logic, and monitoring.

## Features

- **Multi-Channel Notifications**: Email, webhook, and SMS support
- **Professional Email Templates**: Handlebars-based with MJML styling
- **Background Job Processing**: Payment verification, scheduled notifications, reminders
- **Robust Error Handling**: Intelligent retry logic with exponential backoff
- **Comprehensive Monitoring**: CloudWatch metrics, alarms, and dashboards
- **High Performance**: Optimized for Lambda cold starts with template preloading
- **Production Ready**: Full test coverage, deployment automation, and observability

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Main Lambda   │───▶│ SQS Notification │───▶│ Notification    │
│   (API)         │    │ Queue           │    │ Lambda          │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                      │
                       ┌─────────────────────────────┼─────────────────────────────┐
                       │                             │                             │
                       ▼                             ▼                             ▼
              ┌─────────────────┐           ┌─────────────────┐           ┌─────────────────┐
              │ Email Service   │           │ Webhook Service │           │ Background Jobs │
              │ (SES/SendGrid)  │           │ (HTTP Client)   │           │ (Blockchain)    │
              └─────────────────┘           └─────────────────┘           └─────────────────┘
```

## Notification Types

### Email Notifications
- `invoice_sent`: New invoice created and sent to client
- `payment_received`: Payment confirmed on blockchain
- `payment_reminder`: Automated payment reminder
- `payment_overdue`: Overdue payment notification
- `invoice_cancelled`: Invoice cancellation notice
- `organization_invite`: Team member invitation
- `organization_welcome`: Welcome email for new organizations

### Background Jobs
- `payment_verification`: Blockchain transaction verification
- `scheduled_notification`: Time-based notification delivery
- `reminder_escalation`: Progressive reminder system

## Email Templates

Professional, responsive email templates built with Handlebars and MJML:

- **Responsive Design**: Optimized for desktop and mobile
- **Brand Customization**: Organization logos and colors
- **Multi-Language Ready**: Template variable system
- **Accessibility**: WCAG compliant markup
- **Professional Styling**: Clean, modern design

## Development

### Prerequisites

- Node.js 18+
- AWS CLI configured
- PostgreSQL (for local testing)
- TypeScript

### Setup

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run tests
npm test

# Start development server
npm run start:dev

# Build for production
npm run build
```

### Environment Variables

```bash
NODE_ENV=development
LOG_LEVEL=debug

# Database
DB_HOST=localhost
DB_PORT=5432
DB_DATABASE=fluxion_dev
DB_USERNAME=postgres
DB_PASSWORD=password

# Email Providers
SES_REGION=us-east-1
SENDGRID_API_KEY=your_sendgrid_key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email
SMTP_PASSWORD=your_password

# Blockchain
ETHEREUM_RPC_URL=https://eth-mainnet.alchemyapi.io/v2/your_key
POLYGON_RPC_URL=https://polygon-mainnet.alchemyapi.io/v2/your_key
ARBITRUM_RPC_URL=https://arb-mainnet.alchemyapi.io/v2/your_key
BASE_RPC_URL=https://base-mainnet.alchemyapi.io/v2/your_key

# Monitoring
CLOUDWATCH_NAMESPACE=Fluxion/NotificationLambda
```

### Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:cov

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- background-jobs.service.spec.ts
```

### Deployment

#### Using SAM CLI

```bash
# Build
sam build

# Deploy to development
sam deploy --config-env dev

# Deploy to production
sam deploy --config-env production
```

#### Using AWS CodeBuild

The service includes `buildspec.yml` for automated CI/CD pipeline deployment.

## Configuration

### Email Provider Priority

1. **Amazon SES** (Primary)
2. **SendGrid** (Fallback)
3. **SMTP** (Emergency fallback)

### Retry Logic

- **Transient Errors**: 3 retries with exponential backoff
- **Rate Limiting**: 5 retries with extended delays
- **Client Errors**: No retry (4xx except 408, 429)
- **System Errors**: No retry (configuration issues)

### Concurrency Limits

- **Lambda Concurrency**: 50 concurrent executions
- **SQS Batch Size**: 10 messages per invocation
- **Processing Limit**: 5 concurrent notifications per batch

## Monitoring

### CloudWatch Metrics

- `NotificationProcessed`: Total notifications processed
- `NotificationSuccessful`: Successfully delivered notifications
- `NotificationFailed`: Failed notification deliveries
- `AverageProcessingTime`: Average processing duration
- `SuccessRate`: Success rate percentage

### Alarms

- **Error Rate**: Triggers when errors exceed 5 in 10 minutes
- **Duration**: Triggers when average duration exceeds 2 minutes
- **Failed Notifications**: Triggers on sustained delivery failures

### Dashboard

Access the CloudWatch dashboard for real-time monitoring:
- Processing metrics and trends
- Error rates and failure analysis
- Performance monitoring
- Recent error logs

## Production Considerations

### Performance

- **Template Preloading**: Templates loaded during Lambda warm-up
- **Connection Pooling**: Reused database and email service connections
- **Batch Processing**: Efficient SQS batch processing
- **Memory Optimization**: 512MB Lambda memory for optimal performance

### Reliability

- **Dead Letter Queue**: Failed messages sent to DLQ after max retries
- **Circuit Breaker**: Automatic fallback to alternative email providers
- **Health Checks**: Comprehensive service health monitoring
- **Graceful Degradation**: Continues processing even with partial failures

### Security

- **Environment Variables**: Sensitive data via AWS Parameter Store
- **IAM Roles**: Least privilege access policies
- **Encryption**: At-rest and in-transit encryption
- **Audit Logging**: Comprehensive audit trail

### Scalability

- **Auto Scaling**: Lambda automatically scales based on SQS queue depth
- **Rate Limiting**: Respects email provider rate limits
- **Connection Limits**: Managed database connections
- **Cost Optimization**: Pay-per-use serverless architecture

## Troubleshooting

### Common Issues

1. **Template Rendering Failures**
   - Check template syntax and variable availability
   - Verify template files are included in deployment package

2. **Email Delivery Failures**
   - Verify email provider credentials
   - Check sender domain verification (SES)
   - Review rate limiting and quotas

3. **Blockchain Verification Issues**
   - Confirm RPC endpoint accessibility
   - Verify network configuration
   - Check transaction hash format

4. **Database Connection Errors**
   - Verify database credentials and connectivity
   - Check VPC configuration for Lambda
   - Review connection pool settings

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug
```

### Monitoring Logs

```bash
# View function logs
aws logs tail /aws/lambda/fluxion-notification-production --follow

# Filter error logs
aws logs filter-log-events --log-group-name /aws/lambda/fluxion-notification-production --filter-pattern "ERROR"
```

## API Reference

The notification service processes SQS messages with the following format:

### SQS Message Structure

```typescript
interface SQSNotificationMessage {
  type: NotificationType;
  recipientEmail: string;
  templateData: Record<string, any>;
  channels: ('email' | 'webhook' | 'sms')[];
  priority: 'high' | 'medium' | 'low';
  metadata: {
    organizationId: string;
    userId?: string;
    correlationId: string;
    requestId: string;
    timestamp: string;
    sourceService: string;
    environment: string;
  };
}
```

### Background Job Structure

```typescript
interface PaymentVerificationJob {
  jobId: string;
  type: 'payment_verification';
  invoiceId: string;
  transactionHash: string;
  networkId: number;
  expectedAmount: string;
  expectedRecipient: string;
  tokenAddress: string;
  retryAttempt: number;
  metadata: NotificationMetadata;
}
```

## Contributing

1. Follow TypeScript best practices
2. Maintain test coverage above 80%
3. Update documentation for API changes
4. Use conventional commit messages
5. Test locally before deployment

## License

Private software - Fluxion Web3 Payment Platform

---

*Generated with [Claude Code](https://claude.ai/code)*