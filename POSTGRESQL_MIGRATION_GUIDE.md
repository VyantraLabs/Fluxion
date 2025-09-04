# PostgreSQL Migration Guide for Fluxion Web3 Payment Platform

## Overview

This guide outlines the complete migration from DynamoDB to PostgreSQL for the Fluxion backend, including all necessary steps, configurations, and deployment procedures.

## Migration Architecture

### What Changed
- **Database**: DynamoDB → PostgreSQL 15 with TypeORM
- **Caching**: Added Redis for performance optimization
- **Multi-tenancy**: Implemented row-level security (RLS)
- **API Compatibility**: Maintained 100% backward compatibility
- **Blockchain Config**: Dynamic network/token loading from database

### What Stayed the Same
- All existing API endpoints and request/response formats
- Frontend requires no changes
- Authentication and authorization logic
- Business logic and service layer interfaces

## Pre-Migration Setup

### 1. Install Dependencies

```bash
cd main-lambda
npm install
```

New dependencies added:
- `typeorm@^0.3.17` - PostgreSQL ORM
- `pg@^8.11.3` - PostgreSQL client
- `ioredis@^5.3.2` - Redis client
- `reflect-metadata@^0.1.13` - TypeORM metadata

### 2. Environment Configuration

Copy the example environment file:
```bash
cp .env.example .env
```

Update the following variables for your environment:

```bash
# Database Configuration
DB_HOST=localhost  # or your PostgreSQL host
DB_PORT=5432
DB_USERNAME=postgres  # or your PostgreSQL user
DB_PASSWORD=your_password
DB_DATABASE=fluxion_dev  # or your database name
DB_SSL=false  # true for production

# Redis Configuration
REDIS_HOST=localhost  # or your Redis host
REDIS_PORT=6379
REDIS_PASSWORD=  # if Redis requires auth

# JWT Secret (REQUIRED for production)
JWT_SECRET=your-secure-jwt-secret-here

# AWS SQS (existing)
NOTIFICATION_QUEUE_URL=your-sqs-queue-url
```

### 3. Local Development Setup

Use Docker Compose for local development:
```bash
# Start PostgreSQL, Redis, and admin tools
docker-compose -f docker-compose.dev.yml up -d postgres redis

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop services
docker-compose -f docker-compose.dev.yml down
```

Services started:
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **pgAdmin**: http://localhost:8080 (admin@fluxion.local / admin)
- **Redis Commander**: http://localhost:8081

## Database Migration Process

### 1. Create Database Schema

Run TypeORM migrations to create all tables:

```bash
# Generate migration (if needed)
npm run migration:generate

# Run migrations
npm run migration:run

# Verify tables were created
npm run typeorm -- query "SELECT tablename FROM pg_tables WHERE schemaname = 'public';"
```

### 2. Seed Initial Data

Populate blockchain networks and tokens:

```bash
# Run seeder
npm run seed:run

# Verify seed data
npm run typeorm -- query "SELECT * FROM blockchain_networks;"
npm run typeorm -- query "SELECT * FROM tokens;"
```

### 3. Data Migration from DynamoDB (Optional)

If you have existing DynamoDB data to migrate:

```bash
# First, backup your DynamoDB data
aws dynamodb scan --table-name your-table-name --output json > backup.json

# Run migration script (custom implementation needed)
npm run migrate:dynamodb-to-postgresql -- --source=backup.json --dry-run

# If dry-run looks good, run for real
npm run migrate:dynamodb-to-postgresql -- --source=backup.json
```

### 4. Enable Row-Level Security

RLS is automatically configured in migrations, but you can verify:

```sql
-- Connect to your database and run:
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;

-- Should show RLS enabled for:
-- users, invoices, payments, payroll_batches, 
-- payroll_recipients, organization_settings, audit_logs
```

## Application Configuration

### 1. Update TypeORM Data Source

The data source configuration is already set up in `src/database/data-source.ts`:

```typescript
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: config.database.password,
  database: config.database.database,
  // ... other configuration
});
```

### 2. Repository Pattern

New repository classes provide the same functionality as DynamoDB:

```typescript
// Import repositories
import { repositories } from '@/database/repositories';

// Use repositories (same as before, but with PostgreSQL)
const user = await repositories.users.findById(tenantContext, userId);
const invoice = await repositories.invoices.create(tenantContext, invoiceData);
```

### 3. Caching Layer

Redis caching is automatically enabled:

```typescript
// Import cache client
import { redisClient, CacheHelper } from '@/shared/cache/redis-client';

// Cache with TTL
await redisClient.set('key', data, { ttl: 300 });

// Get from cache
const cached = await redisClient.get('key');

// Cache with fallback pattern
const result = await CacheHelper.getOrSet(
  'cache-key',
  () => expensiveOperation(),
  { ttl: 600 }
);
```

## API Compatibility Layer

### How Backward Compatibility Works

The compatibility layer transforms PostgreSQL entities into DynamoDB-style responses:

```typescript
// PostgreSQL User entity automatically transformed to:
{
  PK: "TENANT#org-123",
  SK: "USER#user-456", 
  entityType: "user",
  user_id: "user-456",
  tenant_id: "org-123",
  email: "user@example.com",
  // ... all existing fields
}
```

### Supported Transformations

- **Users**: Full compatibility with existing UserRecord interface
- **Invoices**: Full compatibility with existing InvoiceRecord interface  
- **Payments**: Full compatibility with existing PaymentRecord interface
- **Pagination**: DynamoDB-style nextToken pagination maintained

### Testing Compatibility

```bash
# Run existing tests - they should all pass
npm test

# Test specific endpoints
curl http://localhost:3000/api/users/me
curl http://localhost:3000/api/invoices
curl http://localhost:3000/api/payments
```

## Multi-Tenancy Implementation

### Row-Level Security

Each multi-tenant table has RLS policies:

```sql
-- Example policy (automatically created by migration)
CREATE POLICY tenant_isolation_users ON users
USING (organization_id = current_setting('app.current_tenant_id', true)::uuid);
```

### Setting Tenant Context

```typescript
// In middleware or handlers
await setTenantContext(tenantId);

// All subsequent queries are automatically filtered by tenant
const users = await repositories.users.find(tenantContext, {});
```

## Blockchain Configuration

### Dynamic Network Loading

Networks and tokens are now loaded from the database instead of environment variables:

```typescript
// Get available networks for organization
const networks = await repositories.blockchainNetworks.find({}, { 
  where: { isActive: true } 
});

// Get tokens for a specific network
const tokens = await repositories.tokens.find({}, {
  where: { networkId: networkId, isActive: true }
});
```

### Removing Hardcoded Configs

Previous environment variables are no longer needed:
- ~~`POLYGON_RPC_URL`~~ → Stored in `blockchain_networks.rpc_url`
- ~~`USDC_CONTRACT`~~ → Stored in `tokens.contract_address`
- ~~`CHAIN_ID`~~ → Stored in `blockchain_networks.chain_id`

## Performance Optimizations

### 1. Connection Pooling

PostgreSQL uses connection pooling via TypeORM:

```typescript
// Configured in data-source.ts
extra: {
  max: 20,        // Maximum connections
  min: 5,         // Minimum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
}
```

### 2. Database Indexing

All necessary indexes are created by migrations:
- Primary keys and foreign keys
- Multi-tenant organization_id indexes
- Query-specific indexes (email, wallet_address, etc.)
- Composite indexes for common query patterns

### 3. Redis Caching

Cache configuration by data type:

```typescript
const cacheConfig = {
  networks: { ttl: 3600 },     // 1 hour (rarely changes)
  tokens: { ttl: 1800 },       // 30 minutes (stable)
  sessions: { ttl: 900 },      // 15 minutes (user activity)
  settings: { ttl: 300 },      // 5 minutes (organization settings)
};
```

### 4. Query Optimization

- Use TypeORM's query builder for complex queries
- Implement pagination for large datasets
- Use materialized views for complex aggregations (future enhancement)

## Testing and Validation

### 1. Unit Tests

Run existing unit tests to ensure compatibility:

```bash
npm run test
```

### 2. Integration Tests

Test database operations:

```bash
npm run test:integration
```

### 3. API Endpoint Testing

```bash
# Test user endpoints
curl -X GET http://localhost:3000/api/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test invoice endpoints  
curl -X GET http://localhost:3000/api/invoices \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test payment endpoints
curl -X GET http://localhost:3000/api/payments \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. Performance Testing

```bash
# Use Apache Bench or similar for load testing
ab -n 1000 -c 10 http://localhost:3000/api/health

# Monitor database connections
npm run typeorm -- query "SELECT count(*) FROM pg_stat_activity;"
```

## Deployment Guide

### 1. Development Environment

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up -d

# Run application
npm run start:dev
```

### 2. Staging Environment

Update environment variables:
```bash
NODE_ENV=staging
DB_HOST=your-staging-postgres-host
DB_SSL=true
REDIS_HOST=your-staging-redis-host
```

### 3. Production Environment

**Environment Setup:**
```bash
NODE_ENV=production
DB_HOST=your-production-postgres-host
DB_SSL=true
DB_POOL_MAX=50
REDIS_HOST=your-production-redis-host
ENABLE_REDIS_CACHE=true
```

**Database Setup:**
1. Create production PostgreSQL instance (RDS recommended)
2. Run migrations: `npm run migration:run`
3. Run seeders: `npm run seed:run`
4. Set up connection pooling (PgBouncer recommended)

**Redis Setup:**
1. Create production Redis instance (ElastiCache recommended)
2. Configure Redis cluster for high availability
3. Set up Redis AUTH if required

**Deployment Steps:**
```bash
# Build application
npm run build

# Run migrations (in production)
NODE_ENV=production npm run migration:run

# Start application
NODE_ENV=production npm start
```

## Monitoring and Maintenance

### 1. Health Checks

```bash
# Database health
curl http://localhost:3000/api/health/database

# Redis health  
curl http://localhost:3000/api/health/redis

# Overall health
curl http://localhost:3000/api/health
```

### 2. Database Maintenance

```sql
-- Monitor connection counts
SELECT count(*) FROM pg_stat_activity;

-- Monitor slow queries
SELECT query, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;

-- Vacuum and analyze (automated, but can run manually)
VACUUM ANALYZE;
```

### 3. Cache Monitoring

```bash
# Redis info
redis-cli info memory
redis-cli info stats

# Clear cache if needed
redis-cli flushdb
```

## Rollback Plan

If issues arise, you can rollback to DynamoDB:

1. **Keep DynamoDB tables** during initial migration period
2. **Feature flag**: Set `ENABLE_POSTGRESQL=false` to use DynamoDB
3. **Data sync**: Implement bidirectional sync during transition period

## Troubleshooting

### Common Issues

**Database Connection Issues:**
```bash
# Check if PostgreSQL is running
pg_isready -h localhost -p 5432

# Test connection
psql -h localhost -p 5432 -U postgres -d fluxion_dev -c "SELECT version();"
```

**Redis Connection Issues:**
```bash
# Check if Redis is running  
redis-cli ping

# Test Redis connection
redis-cli -h localhost -p 6379 info server
```

**Migration Issues:**
```bash
# Check migration status
npm run typeorm -- migration:show

# Revert last migration
npm run migration:revert

# Drop and recreate (development only)
npm run db:reset
```

**Performance Issues:**
- Check slow query log
- Monitor connection pool utilization
- Verify indexes are being used
- Check Redis hit rates

### Support

For issues or questions:
1. Check logs: `docker-compose logs -f`
2. Review TypeORM documentation
3. Check PostgreSQL performance guides
4. Monitor application metrics

## Conclusion

This migration provides:
- **Better Performance**: Connection pooling, indexing, caching
- **Improved Scalability**: Row-level security, horizontal scaling support
- **Enhanced Features**: Complex queries, transactions, referential integrity
- **Cost Optimization**: Predictable costs vs. DynamoDB's variable pricing
- **Better Development Experience**: SQL queries, pgAdmin, familiar tooling

The migration maintains 100% API compatibility, ensuring zero downtime and no frontend changes required.