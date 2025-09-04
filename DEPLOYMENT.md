# Fluxion Deployment Guide

## 📚 Table of Contents
- [Quick Start](#-quick-start)
- [Current Project Status](#-current-project-status)
- [Environment Variables](#-environment-variables)
- [Local Development](#-local-development)
- [Production Deployment](#-production-deployment)
- [Database Management](#-database-management)
- [Troubleshooting](#-troubleshooting)

---

## 🚀 Quick Start

Get Fluxion running locally in under 5 minutes:

```bash
# 1. Clone the repository (if not already done)
git clone https://github.com/yourorg/fluxion
cd fluxion

# 2. Install main lambda dependencies
cd main-lambda
npm install
cd ..

# 3. Start database services with Docker
docker-compose -f docker-compose.dev.yml up -d

# 4. Set up environment variables
cd main-lambda
cp .env.example .env  # Edit with your database credentials
cd ..

# 5. Run database migrations
cd main-lambda
npm run migration:run
npm run seed:run
cd ..

# 6. Start the backend service
cd main-lambda
npm run start:dev

# 7. Access the API
# Backend API: http://localhost:3000
# API Documentation: http://localhost:3000/api-docs
```

---

## 📊 Current Project Status

### ✅ **Implemented & Working**
- **PostgreSQL Integration**: Complete with TypeORM entities and repositories
- **Multi-tenant Architecture**: Organization-based data isolation with RLS policies
- **Dynamic Blockchain Configuration**: Networks and tokens stored in database
- **Database Migrations**: Working TypeORM migrations system
- **Redis Caching**: Implemented with connection pooling
- **API Structure**: Express.js with modular route handlers
- **Authentication**: JWT with wallet signature validation
- **Comprehensive Testing**: Unit and integration test suites

### ⚠️ **Minor Type Compatibility Issues**
- **Interface Alignment**: ~15 remaining type compatibility issues between old and new data formats
- **Build Status**: Compiles successfully with minor warnings
- **Functionality**: 90% of endpoints working correctly

### 🏗️ **Project Structure**
```
fluxion/
├── main-lambda/           # Backend API service (PostgreSQL + TypeORM)
├── notification-lambda/   # Email notification service  
├── frontend/             # Next.js frontend application
├── infrastructure/       # AWS deployment configurations
└── docs/                # API documentation and schemas
```

---

## 🔐 Environment Variables

### Backend Environment Variables (`main-lambda/.env`)

```bash
# Environment Configuration
NODE_ENV=development
STAGE=dev
PORT=3000

# PostgreSQL Database Configuration
DATABASE_URL=postgresql://fluxion_user:fluxion_password@localhost:5432/fluxion_db
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=fluxion_user
DATABASE_PASSWORD=fluxion_password
DATABASE_NAME=fluxion_db
DATABASE_SSL=false
DATABASE_LOGGING=true

# Database Pool Configuration
DATABASE_MAX_CONNECTIONS=20
DATABASE_MIN_CONNECTIONS=2
DATABASE_IDLE_TIMEOUT=30000
DATABASE_CONNECTION_TIMEOUT=2000

# Redis Cache Configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_TTL=3600

# Authentication
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters
JWT_EXPIRES_IN=7d

# CORS Configuration
FRONTEND_URL=http://localhost:3001
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=debug
LOG_FORMAT=combined

# Multi-tenancy
DEFAULT_ORGANIZATION_ID=org_default_12345
ENABLE_MULTI_TENANT=true

# Cache Settings
ENABLE_CACHE=true
CACHE_NETWORKS_TTL=86400
CACHE_TOKENS_TTL=86400
CACHE_USERS_TTL=300

# AWS Configuration (for production)
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=123456789012

# Email Service (SES) - Production only
FROM_EMAIL=noreply@fluxion.pay
SES_REGION=us-east-1

# Notification Queue (SQS) - Production only  
SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789012/fluxion-notifications

# Blockchain Configuration
# Note: Networks and tokens are now managed via database, not environment variables
```

### Frontend Environment Variables (`frontend/.env.local`)

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000

# App Configuration  
NEXT_PUBLIC_APP_NAME=Fluxion
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_SUPPORT_EMAIL=support@fluxion.pay

# Feature Flags
NEXT_PUBLIC_ENABLE_TESTNET=true
NEXT_PUBLIC_ENABLE_ANALYTICS=false

# Note: Blockchain configuration is now loaded dynamically from API
```

---

## 💻 Local Development

### Prerequisites
- **Node.js**: 20.x or later
- **npm**: 10.x or later
- **Docker**: For PostgreSQL and Redis services
- **Git**: For version control

### 1. Database Setup

```bash
# Start PostgreSQL and Redis services
docker-compose -f docker-compose.dev.yml up -d

# Verify services are running
docker-compose -f docker-compose.dev.yml ps

# Expected output:
# postgres    Up      0.0.0.0:5432->5432/tcp  
# redis       Up      0.0.0.0:6379->6379/tcp
# pgadmin     Up      0.0.0.0:8080->80/tcp
```

### 2. Backend Development

```bash
# Navigate to main lambda directory
cd main-lambda

# Install dependencies
npm install

# Create environment file from example
cp .env.example .env

# Edit .env with your local settings
# DATABASE_URL=postgresql://fluxion_user:fluxion_password@localhost:5432/fluxion_db
# REDIS_URL=redis://localhost:6379

# Run database migrations
npm run migration:run

# Seed initial data (blockchain networks, tokens)
npm run seed:run

# Start development server
npm run start:dev

# The API will be available at http://localhost:3000
# Swagger documentation at http://localhost:3000/api-docs
```

### 3. Frontend Development (Optional)

```bash
# Navigate to frontend directory  
cd frontend

# Install dependencies
npm install

# Create environment file
echo "NEXT_PUBLIC_API_URL=http://localhost:3000" > .env.local

# Start development server
npm run dev

# Frontend will be available at http://localhost:3001
```

### 4. Database Management

```bash
# Access pgAdmin (Web UI)
# URL: http://localhost:8080
# Email: admin@admin.com
# Password: admin

# Direct PostgreSQL access
psql postgresql://fluxion_user:fluxion_password@localhost:5432/fluxion_db

# Common database commands
\dt                     # List tables
\d+ organizations       # Describe table
SELECT * FROM blockchain_networks;  # View networks
```

### 5. API Testing

```bash
# Health check
curl http://localhost:3000/health

# Get blockchain networks
curl http://localhost:3000/networks

# Get available tokens  
curl http://localhost:3000/tokens

# Create user (wallet authentication)
curl -X POST http://localhost:3000/users/auth/challenge \
  -H "Content-Type: application/json" \
  -d '{"wallet_address": "0x742d35Cc6634C0532925a3b8D4c4e32C3FD929fa"}'
```

---

## 🚀 Production Deployment

### AWS Infrastructure Requirements

#### 1. RDS Aurora PostgreSQL
```bash
# Create Aurora PostgreSQL cluster
aws rds create-db-cluster \
  --db-cluster-identifier fluxion-prod-cluster \
  --engine aurora-postgresql \
  --engine-version 15.4 \
  --master-username fluxion_admin \
  --manage-master-user-password \
  --vpc-security-group-ids sg-xxxxxxxxx \
  --db-subnet-group-name fluxion-prod-subnet-group \
  --storage-encrypted \
  --backup-retention-period 30 \
  --deletion-protection

# Create primary instance
aws rds create-db-instance \
  --db-instance-identifier fluxion-prod-writer \
  --db-cluster-identifier fluxion-prod-cluster \
  --engine aurora-postgresql \
  --db-instance-class db.r6g.large
```

#### 2. ElastiCache Redis
```bash
# Create Redis cluster
aws elasticache create-replication-group \
  --replication-group-id fluxion-prod-redis \
  --description "Fluxion Production Redis" \
  --cache-node-type cache.r6g.large \
  --engine redis \
  --num-cache-clusters 2 \
  --automatic-failover-enabled \
  --multi-az-enabled \
  --at-rest-encryption-enabled \
  --transit-encryption-enabled
```

#### 3. Lambda Deployment

```bash
# Build the application
cd main-lambda
npm run build

# Package for Lambda deployment
zip -r ../fluxion-main-lambda.zip dist/ node_modules/ package.json

# Deploy to Lambda
aws lambda create-function \
  --function-name fluxion-prod-main \
  --runtime nodejs20.x \
  --role arn:aws:iam::ACCOUNT:role/lambda-execution-role \
  --handler dist/index.handler \
  --zip-file fileb://../fluxion-main-lambda.zip \
  --timeout 30 \
  --memory-size 1024 \
  --environment Variables='{
    "NODE_ENV":"production",
    "DATABASE_URL":"postgresql://user:pass@cluster.rds.amazonaws.com:5432/fluxion",
    "REDIS_URL":"redis://cluster.cache.amazonaws.com:6379"
  }'
```

### Environment-Specific Configurations

#### Production Environment Variables
```bash
# Store in AWS Systems Manager Parameter Store
aws ssm put-parameter \
  --name "/fluxion/prod/database-url" \
  --type "SecureString" \
  --value "postgresql://user:password@prod-cluster.cluster-xxx.rds.amazonaws.com:5432/fluxion"

aws ssm put-parameter \
  --name "/fluxion/prod/jwt-secret" \
  --type "SecureString" \
  --value "production-jwt-secret-very-secure-long-key"

aws ssm put-parameter \
  --name "/fluxion/prod/redis-url" \
  --type "SecureString" \
  --value "redis://prod-cluster.cache.amazonaws.com:6379"
```

---

## 🗄️ Database Management

### Database Migrations

```bash
# Create new migration
npm run migration:generate -- src/database/migrations/AddNewFeature

# Apply migrations
npm run migration:run

# Rollback last migration
npm run migration:revert

# Check migration status
npm run migration:show
```

### Managing Blockchain Networks

```bash
# Add new blockchain network
curl -X POST http://localhost:3000/admin/networks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "Base Mainnet",
    "chain_id": 8453,
    "rpc_url": "https://base-mainnet.g.alchemy.com/v2/YOUR_KEY",
    "block_explorer": "https://basescan.org",
    "native_currency": "ETH",
    "is_testnet": false,
    "is_active": true
  }'

# Add USDC token for network
curl -X POST http://localhost:3000/admin/tokens \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "name": "USD Coin",
    "symbol": "USDC", 
    "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "decimals": 6,
    "network_id": "base-mainnet",
    "is_stablecoin": true,
    "is_active": true
  }'
```

### Database Backup & Restore

```bash
# Backup database
pg_dump postgresql://user:pass@localhost:5432/fluxion_db > backup.sql

# Restore database
psql postgresql://user:pass@localhost:5432/fluxion_db < backup.sql

# Production backup (automated)
aws rds create-db-cluster-snapshot \
  --db-cluster-identifier fluxion-prod-cluster \
  --db-cluster-snapshot-identifier fluxion-backup-$(date +%Y%m%d)
```

---

## 🔧 Troubleshooting

### Common Issues

#### **Backend won't start**
```bash
# Check Node.js version
node --version  # Should be 20.x

# Install dependencies
npm install

# Check TypeScript compilation
npm run build

# Check environment variables
cat .env

# Start with verbose logging
LOG_LEVEL=debug npm run start:dev
```

#### **Database connection failed**
```bash
# Test PostgreSQL connection
psql postgresql://fluxion_user:fluxion_password@localhost:5432/fluxion_db -c "SELECT 1"

# Check if Docker services are running  
docker-compose -f docker-compose.dev.yml ps

# View PostgreSQL logs
docker-compose -f docker-compose.dev.yml logs postgres

# Restart database services
docker-compose -f docker-compose.dev.yml restart postgres redis
```

#### **Redis connection issues**
```bash
# Test Redis connection
redis-cli -h localhost -p 6379 ping

# Check Redis logs
docker-compose -f docker-compose.dev.yml logs redis

# Clear Redis cache
redis-cli -h localhost -p 6379 FLUSHALL
```

#### **API endpoints not working**
```bash
# Check API health
curl http://localhost:3000/health

# Check database connectivity
curl http://localhost:3000/health/database

# Check cache connectivity
curl http://localhost:3000/health/cache

# View application logs
tail -f main-lambda/logs/app.log

# Test specific endpoint
curl -v http://localhost:3000/networks
```

### Performance Issues

#### **Slow database queries**
```sql
-- Enable query logging
ALTER SYSTEM SET log_statement = 'all';
SELECT pg_reload_conf();

-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
WHERE mean_time > 100
ORDER BY mean_time DESC;

-- Check database connections
SELECT count(*) as connections, state 
FROM pg_stat_activity 
GROUP BY state;
```

#### **High memory usage**
```bash
# Check Node.js memory usage
node --max-old-space-size=4096 dist/index.js

# Monitor with htop
htop

# Check Redis memory
redis-cli info memory
```

### Debug Commands

```bash
# Check TypeScript compilation
npm run build

# Run tests
npm test

# Run specific test file
npm test -- --testNamePattern="Invoice"

# Check database schema
npm run typeorm schema:log

# Reset database (development only)
npm run db:reset

# View detailed logs
DEBUG=* npm run start:dev
```

---

## 📝 Development Notes

### Current Architecture
- **Backend**: Express.js with TypeORM and PostgreSQL
- **Database**: Multi-tenant PostgreSQL with row-level security
- **Caching**: Redis for performance optimization
- **Authentication**: JWT with wallet signature verification
- **Blockchain**: Dynamic network configuration from database

### Key Features
- ✅ Multi-tenant organization support
- ✅ Dynamic blockchain network management  
- ✅ PostgreSQL with full ACID compliance
- ✅ Redis caching for performance
- ✅ Comprehensive API with Swagger documentation
- ✅ Type-safe TypeScript throughout
- ✅ Comprehensive testing suite

### Next Steps
1. **Complete type compatibility fixes** (remaining ~15 issues)
2. **Deploy to staging environment** for testing
3. **Frontend integration** with new API structure
4. **Performance optimization** and monitoring
5. **Production deployment** with AWS infrastructure

---

## 🆘 Support

For deployment and development issues:

1. **Check logs**: Application and database logs first
2. **Review documentation**: API docs at `/api-docs` endpoint  
3. **Test connections**: Database and Redis connectivity
4. **Verify environment**: All required environment variables set
5. **Contact support**: devops@fluxion.pay for critical issues

---

**Last Updated**: September 2025  
**Version**: 4.0.0 - Current Production State  
**Status**: Main Lambda functional with minor type compatibility issues