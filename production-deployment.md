# Production Deployment Guide for Fluxion PostgreSQL Architecture

## Overview

This guide covers deploying the Fluxion Web3 payment platform with PostgreSQL to production environments on AWS, including database setup, connection pooling, monitoring, and security configurations.

## AWS Architecture Overview

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Application   │    │   Load Balancer  │    │   CloudFront    │
│   (ECS/Lambda)  │◄──►│    (ALB/NLB)     │◄──►│      (CDN)      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │
         ▼                        ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │   ElastiCache    │    │      S3         │
│  (RDS/Aurora)   │    │    (Redis)       │    │   (Storage)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │
         ▼                        ▼
┌─────────────────┐    ┌──────────────────┐
│   Monitoring    │    │   Security       │
│ (CloudWatch)    │    │  (WAF/Secrets)   │
└─────────────────┘    └──────────────────┘
```

## Database Setup

### 1. Amazon RDS PostgreSQL

#### Basic RDS Configuration
```bash
# Create RDS subnet group
aws rds create-db-subnet-group \
    --db-subnet-group-name fluxion-subnet-group \
    --db-subnet-group-description "Subnet group for Fluxion PostgreSQL" \
    --subnet-ids subnet-12345678 subnet-87654321

# Create RDS parameter group for PostgreSQL 15
aws rds create-db-parameter-group \
    --db-parameter-group-name fluxion-postgres15 \
    --db-parameter-group-family postgres15 \
    --description "Parameter group for Fluxion PostgreSQL"

# Create RDS instance
aws rds create-db-instance \
    --db-instance-identifier fluxion-prod \
    --db-instance-class db.r6g.xlarge \
    --engine postgres \
    --engine-version 15.4 \
    --master-username postgres \
    --master-user-password $(aws secretsmanager get-secret-value --secret-id fluxion/db/master-password --query SecretString --output text) \
    --allocated-storage 100 \
    --storage-type gp3 \
    --storage-encrypted \
    --kms-key-id alias/fluxion-db-key \
    --db-subnet-group-name fluxion-subnet-group \
    --vpc-security-group-ids sg-12345678 \
    --db-parameter-group-name fluxion-postgres15 \
    --backup-retention-period 30 \
    --preferred-backup-window "03:00-04:00" \
    --preferred-maintenance-window "sun:04:00-sun:05:00" \
    --multi-az \
    --auto-minor-version-upgrade \
    --deletion-protection \
    --enable-performance-insights \
    --performance-insights-retention-period 7 \
    --monitoring-interval 60 \
    --monitoring-role-arn arn:aws:iam::ACCOUNT:role/rds-monitoring-role
```

#### Aurora PostgreSQL Configuration (Recommended for High Availability)
```bash
# Create Aurora cluster
aws rds create-db-cluster \
    --db-cluster-identifier fluxion-aurora-cluster \
    --engine aurora-postgresql \
    --engine-version 15.4 \
    --master-username postgres \
    --master-user-password $(aws secretsmanager get-secret-value --secret-id fluxion/db/master-password --query SecretString --output text) \
    --db-subnet-group-name fluxion-subnet-group \
    --vpc-security-group-ids sg-12345678 \
    --backup-retention-period 30 \
    --preferred-backup-window "03:00-04:00" \
    --preferred-maintenance-window "sun:04:00-sun:05:00" \
    --storage-encrypted \
    --kms-key-id alias/fluxion-db-key \
    --enable-cloudwatch-logs-exports postgresql

# Create Aurora instances
aws rds create-db-instance \
    --db-instance-identifier fluxion-aurora-instance-1 \
    --db-instance-class db.r6g.xlarge \
    --engine aurora-postgresql \
    --db-cluster-identifier fluxion-aurora-cluster \
    --enable-performance-insights \
    --performance-insights-retention-period 7

aws rds create-db-instance \
    --db-instance-identifier fluxion-aurora-instance-2 \
    --db-instance-class db.r6g.large \
    --engine aurora-postgresql \
    --db-cluster-identifier fluxion-aurora-cluster \
    --enable-performance-insights \
    --performance-insights-retention-period 7
```

### 2. Database Configuration

#### PostgreSQL Parameters
```sql
-- Connect to RDS instance and configure parameters
-- These should be set in the RDS parameter group

-- Connection and authentication
max_connections = 200
shared_preload_libraries = 'pg_stat_statements,auto_explain'

-- Memory settings
shared_buffers = '2GB'                    -- 25% of available memory
effective_cache_size = '6GB'              -- 75% of available memory
work_mem = '32MB'                         -- For sorting/hashing operations
maintenance_work_mem = '512MB'            -- For VACUUM, CREATE INDEX

-- Checkpoint and WAL settings
checkpoint_completion_target = 0.9
wal_buffers = '16MB'
default_statistics_target = 100

-- Query planning
random_page_cost = 1.1                    -- For SSD storage
effective_io_concurrency = 200            -- For SSD storage

-- Logging
log_statement = 'mod'                     -- Log all modifications
log_min_duration_statement = 1000         -- Log queries longer than 1s
log_connections = on
log_disconnections = on
log_lock_waits = on

-- Performance monitoring
track_activities = on
track_counts = on
track_io_timing = on
track_functions = 'all'
```

#### Row Level Security Setup
```sql
-- Connect as superuser to set up RLS
CREATE ROLE fluxion_app LOGIN PASSWORD '${SECURE_PASSWORD}';

-- Grant necessary permissions
GRANT CONNECT ON DATABASE fluxion_prod TO fluxion_app;
GRANT USAGE ON SCHEMA public TO fluxion_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO fluxion_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO fluxion_app;

-- Grant permissions on future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fluxion_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT USAGE, SELECT ON SEQUENCES TO fluxion_app;

-- Set up RLS policies for multi-tenancy
-- (Use the RLS policies from DB_SCHEMA.md)
```

## Connection Pooling

### 1. PgBouncer on AWS

#### ECS Task Definition for PgBouncer
```json
{
  "family": "fluxion-pgbouncer",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::ACCOUNT:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::ACCOUNT:role/fluxion-pgbouncer-role",
  "containerDefinitions": [
    {
      "name": "pgbouncer",
      "image": "pgbouncer/pgbouncer:latest",
      "portMappings": [
        {
          "containerPort": 6432,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "DATABASES_HOST",
          "value": "fluxion-aurora-cluster.cluster-xxxxx.us-east-1.rds.amazonaws.com"
        },
        {
          "name": "DATABASES_PORT",
          "value": "5432"
        },
        {
          "name": "DATABASES_USER",
          "value": "fluxion_app"
        },
        {
          "name": "DATABASES_DBNAME",
          "value": "fluxion_prod"
        },
        {
          "name": "POOL_MODE",
          "value": "transaction"
        },
        {
          "name": "MAX_CLIENT_CONN",
          "value": "1000"
        },
        {
          "name": "DEFAULT_POOL_SIZE",
          "value": "25"
        },
        {
          "name": "MIN_POOL_SIZE",
          "value": "5"
        },
        {
          "name": "RESERVE_POOL_SIZE",
          "value": "5"
        },
        {
          "name": "MAX_DB_CONNECTIONS",
          "value": "100"
        },
        {
          "name": "MAX_USER_CONNECTIONS",
          "value": "100"
        }
      ],
      "secrets": [
        {
          "name": "DATABASES_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:fluxion/db/app-password-xxxxx"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/fluxion-pgbouncer",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "psql -h localhost -p 6432 -U fluxion_app -d fluxion_prod -c 'SELECT 1' || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

### 2. Application Connection Configuration

```typescript
// src/config/database.prod.ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

export const productionDbConfig = (configService: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: configService.get<string>('PGBOUNCER_HOST'), // PgBouncer endpoint
  port: configService.get<number>('PGBOUNCER_PORT', 6432),
  username: configService.get<string>('DB_USERNAME'),
  password: configService.get<string>('DB_PASSWORD'),
  database: configService.get<string>('DB_DATABASE'),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false, // Never true in production
  logging: ['error', 'warn'],
  maxQueryExecutionTime: 1000, // Log slow queries
  
  // Connection pool settings for production
  extra: {
    max: 20,                      // Maximum connections per instance
    min: 5,                       // Minimum connections per instance
    idleTimeoutMillis: 30000,     // Close idle connections after 30s
    connectionTimeoutMillis: 5000, // Connection timeout
    acquireTimeoutMillis: 10000,  // Time to wait for connection from pool
    
    // SSL configuration for RDS
    ssl: {
      require: true,
      rejectUnauthorized: false   // RDS uses self-signed certificates
    },
    
    // Application name for monitoring
    application_name: `fluxion-${process.env.NODE_ENV}-${process.env.AWS_REGION}`,
    
    // Statement timeout (prevent long-running queries)
    statement_timeout: '30s',
    idle_in_transaction_session_timeout: '60s',
  },
});
```

## Caching Layer

### 1. Amazon ElastiCache Redis

#### Redis Cluster Configuration
```bash
# Create Redis subnet group
aws elasticache create-cache-subnet-group \
    --cache-subnet-group-name fluxion-redis-subnet-group \
    --cache-subnet-group-description "Subnet group for Fluxion Redis" \
    --subnet-ids subnet-12345678 subnet-87654321

# Create Redis parameter group
aws elasticache create-cache-parameter-group \
    --cache-parameter-group-name fluxion-redis-params \
    --cache-parameter-group-family redis7.x \
    --description "Parameter group for Fluxion Redis"

# Create Redis replication group (cluster mode)
aws elasticache create-replication-group \
    --replication-group-id fluxion-redis-cluster \
    --description "Fluxion Redis Cluster" \
    --cache-node-type cache.r7g.large \
    --engine redis \
    --engine-version 7.0 \
    --num-cache-clusters 3 \
    --cache-parameter-group-name fluxion-redis-params \
    --cache-subnet-group-name fluxion-redis-subnet-group \
    --security-group-ids sg-87654321 \
    --at-rest-encryption-enabled \
    --transit-encryption-enabled \
    --auth-token $(aws secretsmanager get-secret-value --secret-id fluxion/redis/auth-token --query SecretString --output text) \
    --automatic-failover-enabled \
    --multi-az-enabled \
    --preferred-cache-cluster-azs us-east-1a us-east-1b us-east-1c
```

### 2. Caching Strategy Implementation

```typescript
// src/services/cache.service.ts
import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class CacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  // Cache configuration per data type
  private readonly CACHE_CONFIGS = {
    // Blockchain network data (stable, cache for 1 hour)
    networks: { ttl: 3600, prefix: 'networks' },
    
    // Token data (stable, cache for 30 minutes)
    tokens: { ttl: 1800, prefix: 'tokens' },
    
    // User sessions (cache for 15 minutes)
    sessions: { ttl: 900, prefix: 'session' },
    
    // Organization settings (cache for 5 minutes)
    settings: { ttl: 300, prefix: 'org-settings' },
    
    // Invoice data (cache for 2 minutes)
    invoices: { ttl: 120, prefix: 'invoices' },
    
    // Payment status (cache for 30 seconds)
    payments: { ttl: 30, prefix: 'payments' },
  };

  async get<T>(key: string, type: keyof typeof this.CACHE_CONFIGS): Promise<T | null> {
    const config = this.CACHE_CONFIGS[type];
    const fullKey = `${config.prefix}:${key}`;
    return await this.cacheManager.get<T>(fullKey);
  }

  async set<T>(key: string, value: T, type: keyof typeof this.CACHE_CONFIGS): Promise<void> {
    const config = this.CACHE_CONFIGS[type];
    const fullKey = `${config.prefix}:${key}`;
    await this.cacheManager.set(fullKey, value, config.ttl);
  }

  async del(key: string, type: keyof typeof this.CACHE_CONFIGS): Promise<void> {
    const config = this.CACHE_CONFIGS[type];
    const fullKey = `${config.prefix}:${key}`;
    await this.cacheManager.del(fullKey);
  }

  async invalidatePattern(pattern: string): Promise<void> {
    // For Redis cache manager with pattern support
    const keys = await this.cacheManager.store.keys(pattern);
    if (keys.length > 0) {
      await this.cacheManager.store.del(...keys);
    }
  }

  // Cached database query wrapper
  async cacheQuery<T>(
    key: string,
    type: keyof typeof this.CACHE_CONFIGS,
    queryFn: () => Promise<T>
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key, type);
    if (cached !== null) {
      return cached;
    }

    // Execute query and cache result
    const result = await queryFn();
    await this.set(key, result, type);
    return result;
  }
}

// src/config/cache.config.ts
import { CacheModuleAsyncOptions } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';

export const cacheConfig: CacheModuleAsyncOptions = {
  useFactory: async (configService: ConfigService) => ({
    store: await redisStore({
      socket: {
        host: configService.get<string>('REDIS_HOST'),
        port: configService.get<number>('REDIS_PORT', 6379),
        tls: configService.get<boolean>('REDIS_TLS', true),
      },
      password: configService.get<string>('REDIS_PASSWORD'),
      db: configService.get<number>('REDIS_DB', 0),
      keyPrefix: 'fluxion:',
      lazyConnect: true,
      
      // Connection pool settings
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: false,
      connectTimeout: 10000,
      commandTimeout: 5000,
      
      // Cluster configuration (if using Redis Cluster)
      ...(configService.get<boolean>('REDIS_CLUSTER_MODE') && {
        enableAutoPipelining: true,
        scaleReads: 'slave',
      }),
    }),
    
    // Global TTL (can be overridden per operation)
    ttl: 300, // 5 minutes default
    max: 1000, // Maximum number of items in cache
  }),
  inject: [ConfigService],
};
```

## Security Configuration

### 1. AWS Secrets Manager

```bash
# Create database password
aws secretsmanager create-secret \
    --name fluxion/db/master-password \
    --description "Master password for Fluxion PostgreSQL" \
    --generate-random-password \
    --password-length 32 \
    --exclude-characters '"@/\'

aws secretsmanager create-secret \
    --name fluxion/db/app-password \
    --description "Application user password for Fluxion PostgreSQL" \
    --generate-random-password \
    --password-length 32 \
    --exclude-characters '"@/\'

# Create Redis auth token
aws secretsmanager create-secret \
    --name fluxion/redis/auth-token \
    --description "Auth token for Fluxion Redis cluster" \
    --generate-random-password \
    --password-length 64 \
    --exclude-characters '"@/\'

# Create JWT secrets
aws secretsmanager create-secret \
    --name fluxion/app/jwt-secret \
    --description "JWT signing secret for Fluxion application" \
    --generate-random-password \
    --password-length 64

# Create encryption key for sensitive data
aws secretsmanager create-secret \
    --name fluxion/app/encryption-key \
    --description "Encryption key for sensitive application data" \
    --generate-random-password \
    --password-length 32
```

### 2. IAM Roles and Policies

#### Application Task Role
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:fluxion/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "kms:Decrypt"
      ],
      "Resource": [
        "arn:aws:kms:us-east-1:ACCOUNT:key/fluxion-secrets-key-id"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": [
        "arn:aws:logs:us-east-1:ACCOUNT:log-group:/ecs/fluxion-*"
      ]
    }
  ]
}
```

### 3. Network Security

#### VPC Security Groups
```bash
# Database security group
aws ec2 create-security-group \
    --group-name fluxion-db-sg \
    --description "Security group for Fluxion PostgreSQL database" \
    --vpc-id vpc-12345678

# Allow PostgreSQL access from application
aws ec2 authorize-security-group-ingress \
    --group-id sg-db-12345678 \
    --protocol tcp \
    --port 5432 \
    --source-group sg-app-87654321

# Redis security group
aws ec2 create-security-group \
    --group-name fluxion-redis-sg \
    --description "Security group for Fluxion Redis cluster" \
    --vpc-id vpc-12345678

# Allow Redis access from application
aws ec2 authorize-security-group-ingress \
    --group-id sg-redis-12345678 \
    --protocol tcp \
    --port 6379 \
    --source-group sg-app-87654321
```

## Monitoring and Alerting

### 1. CloudWatch Configuration

#### Custom Metrics
```typescript
// src/monitoring/metrics.service.ts
import { Injectable } from '@nestjs/common';
import { CloudWatch } from 'aws-sdk';

@Injectable()
export class MetricsService {
  private cloudwatch: CloudWatch;
  private namespace = 'Fluxion/Application';

  constructor() {
    this.cloudwatch = new CloudWatch({
      region: process.env.AWS_REGION,
    });
  }

  async putMetric(metricName: string, value: number, unit: string = 'Count', dimensions?: any[]) {
    const params: CloudWatch.PutMetricDataRequest = {
      Namespace: this.namespace,
      MetricData: [
        {
          MetricName: metricName,
          Value: value,
          Unit: unit,
          Timestamp: new Date(),
          Dimensions: dimensions,
        },
      ],
    };

    try {
      await this.cloudwatch.putMetricData(params).promise();
    } catch (error) {
      console.error('Failed to put metric:', error);
    }
  }

  // Business metrics
  async recordInvoiceCreated(organizationId: string) {
    await this.putMetric('InvoicesCreated', 1, 'Count', [
      { Name: 'OrganizationId', Value: organizationId },
    ]);
  }

  async recordPaymentProcessed(organizationId: string, amount: number, token: string) {
    await Promise.all([
      this.putMetric('PaymentsProcessed', 1, 'Count', [
        { Name: 'OrganizationId', Value: organizationId },
        { Name: 'Token', Value: token },
      ]),
      this.putMetric('PaymentAmount', amount, 'None', [
        { Name: 'Token', Value: token },
      ]),
    ]);
  }

  // Database metrics
  async recordDatabaseQueryTime(queryType: string, duration: number) {
    await this.putMetric('DatabaseQueryDuration', duration, 'Milliseconds', [
      { Name: 'QueryType', Value: queryType },
    ]);
  }

  // Cache metrics
  async recordCacheHit(cacheType: string) {
    await this.putMetric('CacheHits', 1, 'Count', [
      { Name: 'CacheType', Value: cacheType },
    ]);
  }

  async recordCacheMiss(cacheType: string) {
    await this.putMetric('CacheMisses', 1, 'Count', [
      { Name: 'CacheType', Value: cacheType },
    ]);
  }
}
```

#### CloudWatch Alarms
```bash
# Database connection alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "FluxionDB-HighConnections" \
    --alarm-description "High database connections" \
    --metric-name DatabaseConnections \
    --namespace AWS/RDS \
    --statistic Average \
    --period 300 \
    --threshold 150 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 2 \
    --alarm-actions arn:aws:sns:us-east-1:ACCOUNT:fluxion-alerts \
    --dimensions Name=DBInstanceIdentifier,Value=fluxion-prod

# High error rate alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "FluxionApp-HighErrorRate" \
    --alarm-description "High application error rate" \
    --metric-name 4XXError \
    --namespace AWS/ApplicationELB \
    --statistic Sum \
    --period 300 \
    --threshold 10 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 2 \
    --alarm-actions arn:aws:sns:us-east-1:ACCOUNT:fluxion-alerts

# High response time alarm
aws cloudwatch put-metric-alarm \
    --alarm-name "FluxionApp-HighResponseTime" \
    --alarm-description "High application response time" \
    --metric-name TargetResponseTime \
    --namespace AWS/ApplicationELB \
    --statistic Average \
    --period 300 \
    --threshold 2.0 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 3 \
    --alarm-actions arn:aws:sns:us-east-1:ACCOUNT:fluxion-alerts
```

### 2. Application Performance Monitoring

#### Health Check Endpoints
```typescript
// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { CacheHealthIndicator } from './cache-health.indicator';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private cache: CacheHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.cache.pingCheck('redis'),
    ]);
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.db.pingCheck('database', { timeout: 300 }),
      () => this.cache.pingCheck('redis', { timeout: 300 }),
    ]);
  }

  @Get('live')
  live() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
```

## Deployment Scripts

### 1. Infrastructure as Code (CDK)

```typescript
// infrastructure/lib/fluxion-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export class FluxionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, 'FluxionVPC', {
      maxAzs: 3,
      natGateways: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    // Database
    const dbSecret = new secretsmanager.Secret(this, 'DatabaseSecret', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'postgres' }),
        generateStringKey: 'password',
        passwordLength: 32,
        excludeCharacters: '"@/\\',
      },
    });

    const database = new rds.DatabaseCluster(this, 'FluxionDatabase', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_15_4,
      }),
      credentials: rds.Credentials.fromSecret(dbSecret),
      instanceProps: {
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.R6G, ec2.InstanceSize.XLARGE),
        vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      },
      instances: 2,
      backup: {
        retention: cdk.Duration.days(30),
        preferredWindow: '03:00-04:00',
      },
      preferredMaintenanceWindow: 'sun:04:00-sun:05:00',
      storageEncrypted: true,
      monitoringInterval: cdk.Duration.minutes(1),
      enablePerformanceInsights: true,
      cloudwatchLogsExports: ['postgresql'],
      deletionProtection: true,
    });

    // Redis
    const redisSubnetGroup = new elasticache.CfnSubnetGroup(this, 'RedisSubnetGroup', {
      description: 'Subnet group for Fluxion Redis',
      subnetIds: vpc.selectSubnets({ subnetType: ec2.SubnetType.PRIVATE_ISOLATED }).subnetIds,
    });

    const redis = new elasticache.CfnReplicationGroup(this, 'FluxionRedis', {
      description: 'Fluxion Redis Cluster',
      replicationGroupId: 'fluxion-redis',
      cacheNodeType: 'cache.r7g.large',
      engine: 'redis',
      engineVersion: '7.0',
      numCacheClusters: 3,
      cacheSubnetGroupName: redisSubnetGroup.ref,
      securityGroupIds: [database.connections.securityGroups[0].securityGroupId],
      atRestEncryptionEnabled: true,
      transitEncryptionEnabled: true,
      automaticFailoverEnabled: true,
      multiAzEnabled: true,
      authToken: dbSecret.secretValueFromJson('password').toString(),
    });

    // ECS Cluster
    const cluster = new ecs.Cluster(this, 'FluxionCluster', {
      vpc,
      containerInsights: true,
    });

    // Application Load Balancer
    const alb = new elbv2.ApplicationLoadBalancer(this, 'FluxionALB', {
      vpc,
      internetFacing: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
    });

    // Outputs
    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: database.clusterEndpoint.socketAddress,
      description: 'Aurora PostgreSQL cluster endpoint',
    });

    new cdk.CfnOutput(this, 'RedisEndpoint', {
      value: redis.attrPrimaryEndPointAddress,
      description: 'ElastiCache Redis primary endpoint',
    });

    new cdk.CfnOutput(this, 'LoadBalancerDNS', {
      value: alb.loadBalancerDnsName,
      description: 'Application Load Balancer DNS name',
    });
  }
}
```

### 2. Deployment Pipeline

```yaml
# .github/workflows/deploy-production.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: fluxion-app
  ECS_SERVICE: fluxion-service
  ECS_CLUSTER: fluxion-cluster

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}

      - name: Login to Amazon ECR
        uses: aws-actions/amazon-ecr-login@v1

      - name: Build and push Docker image
        run: |
          IMAGE_TAG=$(git rev-parse --short HEAD)
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          echo "IMAGE_URI=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_ENV

      - name: Run database migrations
        run: |
          aws ecs run-task \
            --cluster $ECS_CLUSTER \
            --task-definition fluxion-migration-task \
            --launch-type FARGATE \
            --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx,subnet-yyy],securityGroups=[sg-zzz],assignPublicIp=DISABLED}" \
            --overrides '{"containerOverrides":[{"name":"migration","environment":[{"name":"IMAGE_URI","value":"'$IMAGE_URI'"}]}]}'

      - name: Update ECS service
        run: |
          aws ecs update-service \
            --cluster $ECS_CLUSTER \
            --service $ECS_SERVICE \
            --force-new-deployment

      - name: Wait for deployment
        run: |
          aws ecs wait services-stable \
            --cluster $ECS_CLUSTER \
            --services $ECS_SERVICE
```

## Performance Benchmarks

### Expected Performance Metrics

| Metric | Target | Alert Threshold |
|--------|---------|----------------|
| API Response Time | < 200ms (95th percentile) | > 500ms |
| Database Connections | < 50% of max | > 80% of max |
| Cache Hit Ratio | > 80% | < 60% |
| Error Rate | < 0.1% | > 1% |
| Throughput | > 1000 req/min | < 500 req/min |

### Load Testing

```javascript
// load-test/scenarios/invoice-creation.js
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '5m', target: 100 }, // Ramp up
    { duration: '10m', target: 100 }, // Stay at 100 users
    { duration: '5m', target: 0 }, // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'], // Error rate under 1%
  },
};

export default function () {
  const payload = {
    title: 'Test Invoice',
    amount: '250.00',
    client_email: 'test@example.com',
    network_id: 'network-uuid',
    token_id: 'token-uuid',
  };

  const response = http.post('https://api.fluxion.com/invoices', JSON.stringify(payload), {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${__ENV.API_TOKEN}`,
    },
  });

  check(response, {
    'status is 201': (r) => r.status === 201,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has invoice ID': (r) => JSON.parse(r.body).invoice_id !== undefined,
  });
}
```

This production deployment guide provides a comprehensive approach to deploying Fluxion with PostgreSQL at enterprise scale, with proper security, monitoring, and performance optimization.