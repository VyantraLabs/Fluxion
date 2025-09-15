# Fluxion Platform Optimization Guide

This comprehensive guide covers performance optimization and cost monitoring strategies to maximize efficiency while staying within free tier limits.

## Table of Contents
- [Performance Optimization](#performance-optimization)
- [Cost Optimization](#cost-optimization)
- [Monitoring & Alerting](#monitoring--alerting)
- [Scaling Strategies](#scaling-strategies)
- [Troubleshooting](#troubleshooting)

## Performance Optimization

### Lambda Function Optimization

#### Cold Start Mitigation
```typescript
// main-lambda/src/shared/utils/performance.ts
export class PerformanceOptimizer {
  private static connectionPool: any;
  private static configCache = new Map<string, any>();

  // Pre-initialize connections outside handler
  static async initializeConnections() {
    if (!this.connectionPool) {
      this.connectionPool = await createConnectionPool({
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000
      });
    }
  }

  // Cache frequently accessed configuration
  static async getCachedConfig(key: string, ttl: number = 300000) {
    const cached = this.configCache.get(key);
    
    if (cached && (Date.now() - cached.timestamp) < ttl) {
      return cached.value;
    }

    const value = await this.fetchConfig(key);
    this.configCache.set(key, { value, timestamp: Date.now() });
    return value;
  }
}

// Initialize connections on module load
PerformanceOptimizer.initializeConnections();
```

#### Bundle Size Optimization
```json
// main-lambda/webpack.config.js
{
  "externals": {
    "aws-sdk": "aws-sdk",
    "@aws-sdk/client-s3": "@aws-sdk/client-s3"
  },
  "optimization": {
    "minimize": true,
    "sideEffects": false,
    "usedExports": true
  },
  "resolve": {
    "alias": {
      "ethers": "ethers/lib/ethers.min.js"
    }
  }
}
```

#### Memory and Timeout Tuning
```yaml
# SAM template optimization
MainLambda:
  Properties:
    MemorySize: 1024  # Sweet spot for Node.js performance
    Timeout: 29       # Just under API Gateway limit
    ReservedConcurrencyLimit: 50
    ProvisionedConcurrencyConfig:
      ProvisionedConcurrencyUnits: 5  # For critical paths only
```

### Database Performance

#### Supabase Connection Optimization
```typescript
// main-lambda/src/database/optimized-connection.ts
import { createClient } from '@supabase/supabase-js';

class OptimizedSupabaseClient {
  private static instance: OptimizedSupabaseClient;
  private client: any;
  private connectionPool: Map<string, any> = new Map();

  private constructor() {
    this.client = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false },
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'X-Client-Info': 'fluxion-lambda'
          }
        }
      }
    );
  }

  static getInstance(): OptimizedSupabaseClient {
    if (!OptimizedSupabaseClient.instance) {
      OptimizedSupabaseClient.instance = new OptimizedSupabaseClient();
    }
    return OptimizedSupabaseClient.instance;
  }

  // Use prepared statements for frequent queries
  async findInvoicesByOrganization(organizationId: string, limit: number = 20) {
    const cacheKey = `invoices:${organizationId}:${limit}`;
    
    if (this.connectionPool.has(cacheKey)) {
      const cached = this.connectionPool.get(cacheKey);
      if (Date.now() - cached.timestamp < 60000) { // 1 minute cache
        return cached.data;
      }
    }

    const { data, error } = await this.client
      .from('invoices')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (!error) {
      this.connectionPool.set(cacheKey, { data, timestamp: Date.now() });
    }

    return data;
  }

  // Batch operations for better performance
  async batchUpdateInvoices(updates: Array<{id: string, data: any}>) {
    const promises = updates.map(update => 
      this.client
        .from('invoices')
        .update(update.data)
        .eq('id', update.id)
    );

    return Promise.allSettled(promises);
  }
}
```

#### Query Optimization
```sql
-- Create optimized indexes for common queries
CREATE INDEX CONCURRENTLY idx_invoices_org_status_created 
ON invoices(organization_id, status, created_at DESC);

CREATE INDEX CONCURRENTLY idx_invoices_user_status 
ON invoices(user_id, status) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY idx_payments_invoice_status 
ON payments(invoice_id, status);

-- Use partial indexes for better performance
CREATE INDEX CONCURRENTLY idx_active_users 
ON users(organization_id, created_at) 
WHERE deleted_at IS NULL AND is_active = true;
```

### DynamoDB Optimization

#### Efficient Access Patterns
```typescript
// infrastructure/dynamodb-optimization.ts
export class DynamoDBOptimizer {
  
  // Batch operations to reduce API calls
  async batchGetConfigurations(keys: string[]): Promise<any[]> {
    const batchSize = 25; // DynamoDB batch limit
    const batches = [];
    
    for (let i = 0; i < keys.length; i += batchSize) {
      const batch = keys.slice(i, i + batchSize);
      batches.push(this.getBatch(batch));
    }
    
    const results = await Promise.all(batches);
    return results.flat();
  }

  // Use projection expressions to reduce data transfer
  async getConfigurationMinimal(pk: string, sk: string) {
    return this.dynamoClient.query({
      TableName: this.configTable,
      KeyConditionExpression: 'PK = :pk AND SK = :sk',
      ProjectionExpression: '#data, UpdatedAt, Version',
      ExpressionAttributeNames: { '#data': 'Data' },
      ExpressionAttributeValues: { ':pk': pk, ':sk': sk }
    }).promise();
  }

  // Implement write-through caching
  async updateConfigurationWithCache(pk: string, sk: string, data: any) {
    // Update DynamoDB
    await this.dynamoClient.update({
      TableName: this.configTable,
      Key: { PK: pk, SK: sk },
      UpdateExpression: 'SET #data = :data, UpdatedAt = :timestamp',
      ExpressionAttributeNames: { '#data': 'Data' },
      ExpressionAttributeValues: { 
        ':data': data, 
        ':timestamp': new Date().toISOString() 
      }
    }).promise();

    // Update cache
    this.cache.set(`${pk}:${sk}`, data, 300); // 5 minute cache
  }
}
```

### API Gateway Optimization

#### Response Caching
```yaml
# Enable response caching in SAM template
FluxionApi:
  Properties:
    CacheClusterEnabled: true
    CacheClusterSize: '0.5'  # Smallest size for free tier
    MethodSettings:
      - ResourcePath: "/networks"
        HttpMethod: "GET"
        CachingEnabled: true
        CacheTtlInSeconds: 3600  # 1 hour cache
      - ResourcePath: "/tokens/*"
        HttpMethod: "GET"
        CachingEnabled: true
        CacheTtlInSeconds: 1800  # 30 minute cache
```

#### Request Compression
```typescript
// main-lambda/src/shared/middleware/compression.ts
import compression from 'compression';

export const compressionMiddleware = compression({
  threshold: 1024,  // Only compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
});
```

## Cost Optimization

### Free Tier Monitoring

#### Automated Usage Tracking
```typescript
// scripts/cost-monitor.ts
interface FreeTierLimits {
  lambda: {
    invocations: 1000000;  // per month
    gbSeconds: 400000;     // per month
  };
  apiGateway: {
    requests: 1000000;     // per month
  };
  dynamodb: {
    storage: 25 * 1024 * 1024 * 1024; // 25GB
    readRequests: 200000000;           // per month
    writeRequests: 200000000;          // per month
  };
}

class FreeTierMonitor {
  async checkUsage(): Promise<UsageReport> {
    const [lambdaUsage, apiUsage, dynamoUsage] = await Promise.all([
      this.getLambdaUsage(),
      this.getAPIGatewayUsage(),
      this.getDynamoDBUsage()
    ]);

    return {
      lambda: {
        usage: lambdaUsage,
        percentage: (lambdaUsage.invocations / FreeTierLimits.lambda.invocations) * 100
      },
      apiGateway: {
        usage: apiUsage,
        percentage: (apiUsage.requests / FreeTierLimits.apiGateway.requests) * 100
      },
      dynamodb: {
        usage: dynamoUsage,
        percentage: (dynamoUsage.readRequests / FreeTierLimits.dynamodb.readRequests) * 100
      }
    };
  }

  async sendAlerts(report: UsageReport) {
    const alerts = [];
    
    Object.entries(report).forEach(([service, data]) => {
      if (data.percentage > 80) {
        alerts.push({
          service,
          percentage: data.percentage,
          severity: data.percentage > 95 ? 'critical' : 'warning'
        });
      }
    });

    if (alerts.length > 0) {
      await this.notificationService.sendAlert({
        title: 'Free Tier Usage Alert',
        alerts,
        timestamp: new Date().toISOString()
      });
    }
  }
}
```

### Cost-Effective Architecture Patterns

#### Intelligent Request Batching
```typescript
// main-lambda/src/shared/services/batch-processor.ts
export class BatchProcessor {
  private batchQueue: Map<string, any[]> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();

  // Batch similar requests to reduce Lambda invocations
  addToBatch(operation: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.batchQueue.has(operation)) {
        this.batchQueue.set(operation, []);
      }

      this.batchQueue.get(operation)!.push({ data, resolve, reject });

      // Process batch after 100ms or when 10 items accumulated
      if (!this.timers.has(operation)) {
        this.timers.set(operation, setTimeout(() => {
          this.processBatch(operation);
        }, 100));
      }

      if (this.batchQueue.get(operation)!.length >= 10) {
        this.processBatch(operation);
      }
    });
  }

  private async processBatch(operation: string) {
    const batch = this.batchQueue.get(operation) || [];
    if (batch.length === 0) return;

    this.batchQueue.set(operation, []);
    
    if (this.timers.has(operation)) {
      clearTimeout(this.timers.get(operation)!);
      this.timers.delete(operation);
    }

    try {
      const results = await this.executeBatchOperation(operation, batch.map(b => b.data));
      
      batch.forEach((item, index) => {
        item.resolve(results[index]);
      });
    } catch (error) {
      batch.forEach(item => {
        item.reject(error);
      });
    }
  }
}
```

#### Efficient Caching Strategy
```typescript
// main-lambda/src/shared/cache/multi-level-cache.ts
export class MultiLevelCache {
  private memoryCache = new Map<string, { value: any; expiry: number }>();
  private dynamoCache: DynamoDBCache;

  constructor() {
    this.dynamoCache = new DynamoDBCache();
  }

  async get(key: string): Promise<any> {
    // Level 1: Memory cache (fastest, limited space)
    const memoryResult = this.memoryCache.get(key);
    if (memoryResult && memoryResult.expiry > Date.now()) {
      return memoryResult.value;
    }

    // Level 2: DynamoDB cache (persistent, cost-effective)
    const dynamoResult = await this.dynamoCache.get(key);
    if (dynamoResult) {
      // Promote to memory cache
      this.memoryCache.set(key, {
        value: dynamoResult,
        expiry: Date.now() + 60000 // 1 minute
      });
      return dynamoResult;
    }

    return null;
  }

  async set(key: string, value: any, ttl: number = 3600): Promise<void> {
    // Set in both caches
    this.memoryCache.set(key, {
      value,
      expiry: Date.now() + Math.min(ttl * 1000, 300000) // Max 5 minutes in memory
    });

    await this.dynamoCache.set(key, value, ttl);
  }

  // Cleanup memory cache to prevent memory leaks
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.memoryCache.entries()) {
      if (item.expiry <= now) {
        this.memoryCache.delete(key);
      }
    }
  }
}
```

## Monitoring & Alerting

### Custom Metrics

#### Business Metrics Collection
```typescript
// main-lambda/src/shared/metrics/business-metrics.ts
export class BusinessMetrics {
  private cloudWatch = new AWS.CloudWatch();

  async recordInvoiceCreated(organizationId: string): Promise<void> {
    await this.cloudWatch.putMetricData({
      Namespace: 'Fluxion/Business',
      MetricData: [{
        MetricName: 'InvoicesCreated',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          { Name: 'OrganizationId', Value: organizationId },
          { Name: 'Environment', Value: process.env.ENVIRONMENT || 'dev' }
        ],
        Timestamp: new Date()
      }]
    }).promise();
  }

  async recordPaymentSuccess(amount: number, currency: string): Promise<void> {
    await this.cloudWatch.putMetricData({
      Namespace: 'Fluxion/Business',
      MetricData: [
        {
          MetricName: 'PaymentSuccess',
          Value: 1,
          Unit: 'Count',
          Timestamp: new Date()
        },
        {
          MetricName: 'PaymentAmount',
          Value: amount,
          Unit: 'None',
          Dimensions: [{ Name: 'Currency', Value: currency }],
          Timestamp: new Date()
        }
      ]
    }).promise();
  }

  async recordAuthenticationFailure(reason: string): Promise<void> {
    await this.cloudWatch.putMetricData({
      Namespace: 'Fluxion/Security',
      MetricData: [{
        MetricName: 'AuthenticationFailures',
        Value: 1,
        Unit: 'Count',
        Dimensions: [{ Name: 'Reason', Value: reason }],
        Timestamp: new Date()
      }]
    }).promise();
  }
}
```

#### Performance Tracking
```typescript
// main-lambda/src/shared/middleware/performance-tracking.ts
export const performanceTrackingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = process.hrtime.bigint();
  
  res.on('finish', () => {
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    // Record custom performance metrics
    const metrics = new BusinessMetrics();
    
    // Track API response times by endpoint
    const endpoint = req.route?.path || req.path;
    metrics.recordCustomMetric('APIResponseTime', duration, [
      { Name: 'Endpoint', Value: endpoint },
      { Name: 'Method', Value: req.method },
      { Name: 'StatusCode', Value: res.statusCode.toString() }
    ]);

    // Track slow queries
    if (duration > 5000) { // 5 seconds
      metrics.recordCustomMetric('SlowAPICall', 1, [
        { Name: 'Endpoint', Value: endpoint },
        { Name: 'Duration', Value: duration.toString() }
      ]);
    }
  });

  next();
};
```

### Alerting Best Practices

#### Smart Alert Grouping
```typescript
// infrastructure/alert-manager.ts
export class AlertManager {
  private alertGroups = new Map<string, AlertGroup>();

  async processAlert(alert: Alert): Promise<void> {
    const groupKey = this.getGroupKey(alert);
    
    if (!this.alertGroups.has(groupKey)) {
      this.alertGroups.set(groupKey, {
        alerts: [],
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        count: 0
      });
    }

    const group = this.alertGroups.get(groupKey)!;
    group.alerts.push(alert);
    group.lastSeen = Date.now();
    group.count++;

    // Send grouped alerts after 5 minutes or 10 similar alerts
    if (group.count >= 10 || (Date.now() - group.firstSeen) > 300000) {
      await this.sendGroupedAlert(groupKey, group);
      this.alertGroups.delete(groupKey);
    }
  }

  private getGroupKey(alert: Alert): string {
    return `${alert.service}:${alert.type}:${alert.severity}`;
  }

  private async sendGroupedAlert(groupKey: string, group: AlertGroup): Promise<void> {
    const message = {
      text: `🚨 Alert Group: ${groupKey}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Alert Summary*\n• Count: ${group.count}\n• Duration: ${Math.round((group.lastSeen - group.firstSeen) / 1000)}s\n• First seen: ${new Date(group.firstSeen).toLocaleTimeString()}`
          }
        }
      ]
    };

    await this.slackNotifier.send(message);
  }
}
```

## Scaling Strategies

### Horizontal Scaling

#### Lambda Concurrency Management
```typescript
// infrastructure/scaling-config.ts
export interface ScalingConfiguration {
  lambda: {
    reservedConcurrency: number;
    provisionedConcurrency?: number;
    targetUtilization: number;
  };
  dynamodb: {
    readCapacity: {
      min: number;
      max: number;
      targetUtilization: number;
    };
    writeCapacity: {
      min: number;
      max: number;
      targetUtilization: number;
    };
  };
}

export const getScalingConfig = (environment: string): ScalingConfiguration => {
  switch (environment) {
    case 'production':
      return {
        lambda: {
          reservedConcurrency: 50,
          provisionedConcurrency: 5,
          targetUtilization: 0.7
        },
        dynamodb: {
          readCapacity: { min: 5, max: 100, targetUtilization: 0.7 },
          writeCapacity: { min: 5, max: 50, targetUtilization: 0.7 }
        }
      };
    case 'staging':
      return {
        lambda: {
          reservedConcurrency: 10,
          targetUtilization: 0.8
        },
        dynamodb: {
          readCapacity: { min: 1, max: 10, targetUtilization: 0.7 },
          writeCapacity: { min: 1, max: 5, targetUtilization: 0.7 }
        }
      };
    default:
      return {
        lambda: {
          reservedConcurrency: 5,
          targetUtilization: 0.8
        },
        dynamodb: {
          readCapacity: { min: 1, max: 5, targetUtilization: 0.7 },
          writeCapacity: { min: 1, max: 2, targetUtilization: 0.7 }
        }
      };
  }
};
```

### Vertical Scaling

#### Memory Optimization
```bash
#!/bin/bash
# scripts/optimize-lambda-memory.sh

# Test different memory configurations and find optimal settings
FUNCTION_NAME="fluxion-main-prod"
MEMORY_CONFIGS=(512 768 1024 1536 2048)

for memory in "${MEMORY_CONFIGS[@]}"; do
  echo "Testing memory configuration: ${memory}MB"
  
  # Update function memory
  aws lambda update-function-configuration \
    --function-name $FUNCTION_NAME \
    --memory-size $memory
  
  # Wait for update to complete
  aws lambda wait function-updated --function-name $FUNCTION_NAME
  
  # Run load test
  artillery run load-test.yml --output memory-test-${memory}.json
  
  # Get cost and performance metrics
  aws logs filter-log-events \
    --log-group-name "/aws/lambda/${FUNCTION_NAME}" \
    --start-time $(date -d '5 minutes ago' +%s)000 \
    --filter-pattern "REPORT RequestId" \
    --query 'events[*].message' \
    > performance-${memory}.log
done

# Analyze results and recommend optimal configuration
python3 analyze-performance.py
```

## Troubleshooting

### Common Performance Issues

#### Cold Start Debugging
```typescript
// main-lambda/src/shared/diagnostics/cold-start-tracker.ts
export class ColdStartTracker {
  private static isWarm = false;
  private static initTime: number;

  static recordInit(): void {
    if (!this.isWarm) {
      this.initTime = Date.now();
      this.isWarm = true;
      
      // Record cold start metric
      const metrics = new AWS.CloudWatch();
      metrics.putMetricData({
        Namespace: 'Fluxion/Performance',
        MetricData: [{
          MetricName: 'ColdStart',
          Value: 1,
          Unit: 'Count',
          Timestamp: new Date()
        }]
      }).promise();
    }
  }

  static getInitDuration(): number {
    return this.isWarm ? Date.now() - this.initTime : 0;
  }
}

// Add to handler entry point
export const handler = async (event: any, context: any) => {
  ColdStartTracker.recordInit();
  
  const initDuration = ColdStartTracker.getInitDuration();
  if (initDuration > 3000) { // Log if init takes more than 3 seconds
    console.warn(`Long initialization time: ${initDuration}ms`);
  }
  
  // Rest of handler logic...
};
```

#### Database Connection Issues
```typescript
// main-lambda/src/shared/diagnostics/db-health-checker.ts
export class DatabaseHealthChecker {
  async checkHealth(): Promise<HealthReport> {
    const startTime = Date.now();
    
    try {
      // Test basic connectivity
      const connectResult = await this.testConnection();
      
      // Test query performance
      const queryResult = await this.testQuery();
      
      // Check connection pool status
      const poolStatus = await this.checkConnectionPool();
      
      return {
        status: 'healthy',
        checks: {
          connectivity: connectResult,
          queryPerformance: queryResult,
          connectionPool: poolStatus
        },
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        responseTime: Date.now() - startTime
      };
    }
  }

  private async testConnection(): Promise<CheckResult> {
    const start = Date.now();
    try {
      await this.supabase.from('organizations').select('count').limit(1);
      return { status: 'pass', duration: Date.now() - start };
    } catch (error) {
      return { status: 'fail', error: error.message, duration: Date.now() - start };
    }
  }

  private async testQuery(): Promise<CheckResult> {
    const start = Date.now();
    try {
      const result = await this.supabase
        .from('invoices')
        .select('id')
        .limit(1);
      
      const duration = Date.now() - start;
      
      // Alert if query takes too long
      if (duration > 1000) {
        console.warn(`Slow database query detected: ${duration}ms`);
      }
      
      return { status: 'pass', duration };
    } catch (error) {
      return { status: 'fail', error: error.message, duration: Date.now() - start };
    }
  }
}
```

### Error Recovery Patterns

#### Circuit Breaker Implementation
```typescript
// main-lambda/src/shared/patterns/circuit-breaker.ts
export class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;

  constructor(
    private failureThreshold: number = 5,
    private resetTimeout: number = 60000, // 1 minute
    private monitoringPeriod: number = 300000 // 5 minutes
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= 3) { // Require 3 successes to close
        this.state = 'CLOSED';
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      
      // Send alert
      this.sendAlert();
    }
  }

  private sendAlert(): void {
    console.error(`Circuit breaker opened due to ${this.failureCount} failures`);
    // Send notification to monitoring system
  }
}
```

This optimization guide provides comprehensive strategies for maximizing Fluxion's performance while maintaining cost-effectiveness within AWS free tier limits. Regular monitoring and iterative improvements based on these patterns will ensure optimal platform operation.