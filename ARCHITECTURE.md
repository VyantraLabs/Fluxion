# Fluxion Platform Architecture

**Version**: 2.0.0 Production  
**Last Updated**: September 5, 2025  
**Status**: Production-Ready System - 100% Complete
**Architecture**: Serverless Multi-Service with Enterprise Features

## 🏗️ System Overview

Fluxion is a production-ready Web3 payment platform built with a modern, scalable serverless architecture. The system handles crypto-native invoicing, payment processing, and automated notifications with enterprise-grade security and multi-tenant isolation.

### High-Level Architecture

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│   Next.js Frontend  │    │   Main Lambda API   │    │ Notification Lambda │
│  (Dashboard/Portal) │───▶│  (Express + JWT)    │───▶│ (Email/Webhooks)    │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
           │                        │                           │
           │                        ▼                           ▼
           │               ┌─────────────────────┐    ┌─────────────────────┐
           │               │   PostgreSQL DB     │    │   SQS Message       │
           │               │ (Multi-tenant +     │    │   Queue             │
           │               │  TypeORM)          │    └─────────────────────┘
           │               └─────────────────────┘              │
           │                        │                           ▼
           ▼                        ▼                ┌─────────────────────┐
┌─────────────────────┐    ┌─────────────────────┐  │ Multi-Provider      │
│  Blockchain RPCs    │    │   Redis Cache       │  │ Email Service       │
│ (ETH/Polygon/ARB/   │    │ (Session/Cache)     │  │ (SES/SendGrid/SMTP) │
│  Base Networks)     │    └─────────────────────┘  └─────────────────────┘
└─────────────────────┘
```

## 📊 Technology Stack

### **Backend Services**
- **Runtime**: Node.js 20.x with TypeScript
- **Framework**: Express.js deployed as AWS Lambda
- **Database**: PostgreSQL 15 with TypeORM
- **Cache**: Redis with multi-level caching strategy
- **Authentication**: JWT with wallet signature verification
- **Queue Processing**: AWS SQS with multiple priority tiers
- **File Storage**: AWS S3 for documents and assets

### **Frontend Application**
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript with strict mode
- **Styling**: Tailwind CSS with responsive design
- **State Management**: React Context API + SWR for data fetching
- **Web3 Integration**: Ethers.js v6 for blockchain interactions

### **Infrastructure & DevOps**
- **Cloud Provider**: AWS (Lambda, RDS, ElastiCache, SQS, S3)
- **Deployment**: SAM CLI with multi-environment configuration
- **Monitoring**: CloudWatch with custom dashboards and alerts
- **Security**: VPC isolation, IAM roles, Parameter Store for secrets
- **CI/CD**: GitHub Actions with automated testing and deployment

## 🗄️ Database Architecture

### **Multi-Tenant PostgreSQL Design**

The system uses PostgreSQL with row-level security (RLS) for tenant isolation. Each organization has isolated data through `organization_id` foreign keys.

#### Core Entities (12 Tables)

```sql
-- Core business entities
organizations (tenant root)
├── users (wallet-based accounts)
├── invoices (invoice lifecycle)
├── payments (payment tracking)
├── invoice_templates (reusable templates)
└── audit_logs (activity tracking)

-- Configuration entities  
blockchain_networks (dynamic network config)
└── tokens (multi-network token support)

-- Advanced features
invoice_access_tokens (secure client access)
notification_queue (email processing)
notification_settings (user preferences)
payment_verification_jobs (background processing)
```

#### Key Design Patterns

**Row-Level Security (RLS)**
```sql
-- Example RLS policy
CREATE POLICY invoice_isolation_policy ON invoices
  USING (organization_id = current_setting('app.current_organization_id')::uuid);
```

**Optimized Indexes**
```sql
-- Critical performance indexes
CREATE INDEX idx_invoices_org_status ON invoices(organization_id, status);
CREATE INDEX idx_payments_invoice_status ON payments(invoice_id, status);
CREATE INDEX idx_tokens_network_active ON tokens(network_id, is_active);
```

**JSONB for Flexibility**
- Invoice metadata (custom fields, branding)
- Notification template data
- Organization preferences
- Job processing results

## 🔄 API Architecture

### **RESTful API Design**

The main Lambda function serves a comprehensive REST API with 30+ endpoints organized into logical modules:

#### Authentication Module
- `POST /users/auth/message` - Get challenge message
- `POST /users/auth/verify` - Verify wallet signature
- `POST /users/auth/refresh` - Refresh JWT token

#### Invoice Management Module
- `GET/POST /invoices` - List/create invoices
- `GET/PUT/DELETE /invoices/:id` - Invoice CRUD
- `POST /invoices/:id/send` - Send to client
- `GET /public/invoice/:token` - Public client access

#### Payment Processing Module  
- `POST /invoices/:id/pay` - Submit payment
- `GET /payments/:id/status` - Payment verification status
- `POST /payments/verify` - Manual payment verification

#### Template Management Module
- `GET/POST /templates` - Template management
- `POST /invoices/from-template/:id` - Create from template

#### Configuration Module
- `GET /config` - Complete app configuration
- `GET /networks` - Blockchain networks
- `GET /tokens` - Available tokens

### **Response Format Standardization**

```typescript
// Success response
{
  success: true,
  data: T,
  meta: {
    requestId: string,
    timestamp: string,
    pagination?: PaginationMeta
  }
}

// Error response  
{
  success: false,
  error: {
    code: string,
    message: string,
    details?: any
  },
  meta: {
    requestId: string,
    timestamp: string
  }
}
```

## 🔐 Security Architecture

### **Multi-Layer Security Model**

#### 1. Authentication & Authorization
- **Web3 Authentication**: Cryptographic wallet signature verification
- **JWT Tokens**: Secure session management with organization context
- **Multi-Tenant Isolation**: Database-level tenant separation with RLS
- **Role-Based Access**: Granular permissions per organization

#### 2. Client Access Security
```typescript
// Secure client access tokens
{
  token: "cryptographically_secure_random_64_chars",
  expiresAt: Date,
  maxViews: number,
  accessCount: number,
  clientEmail?: string
}
```

#### 3. API Security Patterns
- **Rate Limiting**: Tiered limits by endpoint and user type
- **Input Validation**: Comprehensive Zod schema validation
- **CSRF Protection**: Token-based protection for state changes
- **SQL Injection Prevention**: TypeORM query builder protection

#### 4. Infrastructure Security
- **VPC Isolation**: Private subnets for database and cache
- **Security Groups**: Strict firewall rules
- **Secrets Management**: AWS Parameter Store with encryption
- **Audit Logging**: Comprehensive activity tracking

## 🚀 Scalability Architecture

### **Auto-Scaling Infrastructure**

#### Lambda Function Scaling
```typescript
const lambdaConfigurations = {
  mainLambda: {
    timeout: 300,
    memorySize: 1024,
    reservedConcurrency: 50,
    provisionedConcurrency: 5, // Keep warm
    autoScaling: {
      targetUtilization: 70,
      scaleUpCooldown: 60,
      scaleDownCooldown: 300
    }
  },
  
  notificationLambda: {
    timeout: 180,
    memorySize: 512,
    reservedConcurrency: 20,
    batchSize: 5, // SQS batch processing
    autoScaling: {
      targetUtilization: 80
    }
  }
}
```

#### Database Scaling Strategy
- **Connection Pooling**: Optimized PostgreSQL connections (max 50 per Lambda)
- **Read Replicas**: Aurora Auto Scaling for read-heavy operations
- **Query Optimization**: Indexed queries for common operations
- **Connection Management**: PgBouncer for connection pooling

#### Queue-Based Processing
```typescript
// Multi-tier queue system
const queueTiers = {
  'payment-verification-critical': {
    priority: 'critical',
    concurrency: 10,
    visibilityTimeout: 60,
    maxRetries: 5
  },
  'email-notifications-high': {
    priority: 'high', 
    concurrency: 5,
    batchSize: 3,
    maxRetries: 3
  },
  'system-maintenance-low': {
    priority: 'low',
    concurrency: 1,
    batchSize: 10,
    maxRetries: 1
  }
}
```

### **Caching Strategy**

#### Multi-Level Caching
```typescript
// L1: Lambda in-memory (5 minutes)
// L2: Redis cluster (1 hour) 
// L3: S3 long-term (24 hours)

class CacheStrategy {
  async get<T>(key: string): Promise<T | null> {
    // Try L1 cache first
    let value = this.l1Cache.get<T>(key);
    if (value) return value;
    
    // Try L2 Redis cache
    value = await this.redisCache.get<T>(key);
    if (value) {
      this.l1Cache.set(key, value);
      return value;
    }
    
    // Try L3 S3 cache for static data
    return await this.s3Cache.get<T>(key);
  }
}
```

#### Cache Warming Strategy
- **Startup Cache**: Pre-load essential configuration data
- **Predictive Caching**: Cache based on usage patterns
- **Background Refresh**: Asynchronous cache updates

## 🔄 Background Job Architecture

### **SQS-Based Job Processing**

#### Job Types & Workflows

**1. Payment Verification Jobs**
```typescript
interface PaymentVerificationJob {
  jobId: string;
  invoiceId: string;
  txHash: string;
  networkId: string;
  expectedAmount: string;
  retryCount: number;
}

// Processing workflow
1. Validate job data
2. Fetch transaction from blockchain
3. Verify transaction details
4. Create payment record
5. Update invoice status
6. Trigger success notifications
```

**2. Email Notification Jobs**
```typescript
interface EmailNotificationJob {
  type: 'invoice_sent' | 'payment_received' | 'reminder';
  recipientEmail: string;
  templateData: Record<string, any>;
  scheduledFor: Date;
  retryCount: number;
}

// Processing workflow
1. Load email template
2. Render email content
3. Send via provider (SES → SendGrid → SMTP)
4. Update notification status
5. Log delivery metrics
```

**3. Scheduled Maintenance Jobs**
- Overdue invoice status updates
- Expired access token cleanup  
- Payment confirmation monitoring
- Reminder escalation processing

#### Error Handling & Retry Logic
```typescript
class JobRetryHandler {
  async scheduleRetry(jobData: JobData, error: Error): Promise<void> {
    const retryCount = jobData.retryCount + 1;
    
    if (retryCount > this.maxRetries) {
      await this.moveToDeadLetter(jobData, error);
      return;
    }
    
    // Exponential backoff with jitter
    const delay = Math.min(
      this.baseDelay * Math.pow(2, retryCount) + Math.random() * 1000,
      this.maxDelay
    );
    
    await this.scheduleJob({
      ...jobData,
      retryCount,
      scheduledFor: new Date(Date.now() + delay)
    });
  }
}
```

## 📧 Notification Architecture

### **Multi-Provider Email System**

#### Provider Failover Strategy
```typescript
class EmailService {
  private providers = [
    new SESProvider(),      // Primary
    new SendGridProvider(), // Fallback
    new SMTPProvider()      // Last resort
  ];
  
  async sendEmail(emailData: EmailData): Promise<EmailResult> {
    for (const provider of this.providers) {
      try {
        const result = await provider.send(emailData);
        await this.recordSuccess(provider.name, result);
        return result;
      } catch (error) {
        await this.recordFailure(provider.name, error);
        continue; // Try next provider
      }
    }
    
    throw new Error('All email providers failed');
  }
}
```

#### Template System
- **7 Professional Templates**: Invoice sent, payment received, reminders, overdue alerts
- **Handlebars + MJML**: Dynamic content with responsive design
- **Multi-language Support**: Template localization ready
- **Custom Branding**: Organization logos and color schemes

#### Automated Reminder System
```typescript
class ReminderScheduler {
  scheduleInvoiceReminders(invoiceId: string): void {
    const reminderIntervals = [7, 3, 1]; // Days before due
    const overdueIntervals = [1, 7, 14];  // Days after due
    
    // Schedule pre-due reminders
    reminderIntervals.forEach(days => {
      this.scheduleNotification({
        type: 'reminder',
        invoiceId,
        scheduledFor: dueDate.subtract(days, 'days')
      });
    });
  }
}
```

## 🌐 Blockchain Integration

### **Multi-Chain Support Architecture**

#### Dynamic Network Configuration
```typescript
// Networks stored in database - runtime configuration
interface NetworkConfig {
  id: string;
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  gasSettings: {
    gasPrice?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  };
  isActive: boolean;
  isTestnet: boolean;
}

// Currently supported networks
const supportedNetworks = [
  { name: 'Ethereum', chainId: 1, symbol: 'ETH' },
  { name: 'Polygon', chainId: 137, symbol: 'MATIC' },
  { name: 'Arbitrum One', chainId: 42161, symbol: 'ETH' },
  { name: 'Base', chainId: 8453, symbol: 'ETH' }
];
```

#### Payment Verification Process
```typescript
class PaymentVerifier {
  async verifyPayment(txHash: string, expectedData: ExpectedPayment): Promise<VerificationResult> {
    // 1. Fetch transaction from blockchain
    const tx = await this.blockchainClient.getTransaction(txHash);
    
    // 2. Verify transaction details
    const checks = {
      exists: !!tx,
      confirmed: tx.blockNumber > 0,
      correctAmount: this.compareAmounts(tx.value, expectedData.amount),
      correctRecipient: tx.to.toLowerCase() === expectedData.recipient.toLowerCase(),
      correctToken: await this.verifyTokenTransfer(tx, expectedData.tokenAddress)
    };
    
    // 3. Return comprehensive verification result
    return {
      isValid: Object.values(checks).every(check => check === true),
      checks,
      confirmations: await this.getConfirmations(tx.blockNumber),
      transaction: tx
    };
  }
}
```

## 📊 Monitoring & Observability

### **Comprehensive Monitoring Stack**

#### CloudWatch Integration
```typescript
class MonitoringService {
  async recordBusinessMetrics(invoiceId: string, action: string, duration: number): Promise<void> {
    await this.cloudWatch.putMetricData([
      {
        MetricName: 'InvoiceActionDuration',
        Value: duration,
        Unit: 'Milliseconds',
        Dimensions: [
          { Name: 'Action', Value: action },
          { Name: 'Environment', Value: process.env.NODE_ENV }
        ]
      },
      {
        MetricName: 'InvoiceActionCount',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          { Name: 'Action', Value: action },
          { Name: 'Status', Value: 'success' }
        ]
      }
    ]);
  }
}
```

#### Health Check System
```typescript
// Multi-level health checks
const healthChecks = {
  '/health': 'Basic service health',
  '/health/database': 'PostgreSQL connection',
  '/health/cache': 'Redis connection', 
  '/health/queues': 'SQS queue status',
  '/health/blockchain': 'RPC endpoint status'
};
```

#### Structured Logging
```typescript
// Correlation ID tracking
interface LogContext {
  requestId: string;
  organizationId?: string;
  userId?: string;
  action: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Example log entry
{
  "timestamp": "2025-09-05T10:00:00.000Z",
  "level": "info",
  "context": "InvoiceService",
  "message": "Invoice created successfully",
  "requestId": "req-123-abc",
  "organizationId": "org_abc_123",
  "invoiceId": "inv_456_def",
  "duration": 150
}
```

## 🔧 Development Architecture

### **Modular Code Organization**

```
main-lambda/src/
├── modules/                    # Feature modules
│   ├── invoices/              # Invoice management
│   │   ├── handlers.ts        # Express route handlers
│   │   ├── service.ts         # Business logic
│   │   ├── validation.ts      # Request validation
│   │   └── types.ts           # TypeScript types
│   ├── payments/              # Payment processing
│   ├── users/                 # User management
│   ├── templates/             # Template management
│   └── notifications/         # Notification handling
├── database/                  # Data layer
│   ├── entities/              # TypeORM entities
│   ├── repositories/          # Custom repositories
│   ├── migrations/            # Schema migrations
│   └── seeds/                 # Initial data
├── shared/                    # Cross-cutting concerns
│   ├── middleware/            # Express middleware
│   ├── services/              # Shared services
│   ├── validation/            # Zod schemas
│   ├── errors/                # Custom error classes
│   └── utils/                 # Utility functions
└── config/                    # Configuration
    ├── database.ts            # Database config
    ├── swagger.ts             # API documentation
    └── environment.ts         # Environment variables
```

### **Testing Strategy**

#### Test Coverage Requirements
- **Unit Tests**: >80% coverage for services and utilities
- **Integration Tests**: API endpoint testing with test database
- **Database Tests**: Repository and migration testing
- **End-to-End Tests**: Critical user workflows

#### Test Organization
```typescript
// Service testing pattern
describe('InvoiceService', () => {
  beforeEach(async () => {
    await setupTestDatabase();
    await seedTestData();
  });
  
  afterEach(async () => {
    await cleanupTestDatabase();
  });
  
  describe('createInvoice', () => {
    it('should create invoice with valid data', async () => {
      const result = await invoiceService.createInvoice(validInvoiceData);
      expect(result.success).toBe(true);
      expect(result.data.id).toBeDefined();
    });
  });
});
```

## 🚀 Deployment Architecture

### **Multi-Environment Strategy**

#### Environment Configurations
```yaml
# Development
Environment: dev
Database: fluxion-dev.cluster-xyz.rds.amazonaws.com
Redis: fluxion-dev.cache.amazonaws.com
LogLevel: debug
EmailProvider: development (mock)

# Staging  
Environment: staging
Database: fluxion-staging.cluster-xyz.rds.amazonaws.com
Redis: fluxion-staging.cache.amazonaws.com
LogLevel: info
EmailProvider: sendgrid

# Production
Environment: production
Database: fluxion-prod.cluster-xyz.rds.amazonaws.com
Redis: fluxion-prod.cache.amazonaws.com
LogLevel: warn
EmailProvider: ses-primary
```

#### Deployment Pipeline
```typescript
// SAM deployment configuration
const deploymentConfig = {
  dev: {
    stackName: 'fluxion-dev',
    parameters: {
      Environment: 'dev',
      DatabaseUrl: '{{resolve:ssm:/fluxion/dev/database-url}}',
      JwtSecret: '{{resolve:ssm:/fluxion/dev/jwt-secret}}'
    }
  },
  
  production: {
    stackName: 'fluxion-production',
    parameters: {
      Environment: 'production',
      DatabaseUrl: '{{resolve:ssm:/fluxion/prod/database-url}}',
      JwtSecret: '{{resolve:ssm:/fluxion/prod/jwt-secret}}'
    }
  }
};
```

## 📈 Performance Optimization

### **Database Performance**
- **Connection Pooling**: 50 connections max per Lambda
- **Query Optimization**: Eager loading for related entities
- **Index Strategy**: Compound indexes for common query patterns
- **Row-Level Security**: Optimized tenant filtering

### **API Performance**  
- **Response Caching**: Redis caching for frequently accessed data
- **Pagination**: Cursor-based pagination for large datasets
- **Compression**: Gzip compression for all responses
- **Lambda Warming**: Provisioned concurrency for critical functions

### **Frontend Performance**
- **Code Splitting**: Dynamic imports for route-based splitting
- **Image Optimization**: Next.js automatic image optimization
- **Caching Strategy**: SWR with background revalidation
- **Bundle Optimization**: Tree shaking and dead code elimination

---

## 🎯 Production Readiness Checklist

### ✅ **Infrastructure**
- [x] Multi-environment deployment configuration
- [x] Auto-scaling policies for all services  
- [x] Database backup and recovery procedures
- [x] Monitoring and alerting setup
- [x] Security hardening and audit compliance

### ✅ **Application Features**
- [x] Complete invoice lifecycle management
- [x] Multi-chain payment processing
- [x] Professional notification system
- [x] Background job processing
- [x] Client portal with secure access

### ✅ **Quality Assurance**
- [x] >80% test coverage across all services
- [x] Comprehensive error handling and logging
- [x] Performance optimization and caching
- [x] Security auditing and vulnerability testing
- [x] API documentation and integration guides

---

**This architecture document represents the complete production-ready Fluxion platform, designed to scale from startup to enterprise while maintaining security, performance, and reliability.**

*Last Updated: September 5, 2025*