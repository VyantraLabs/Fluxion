# Fluxion Lambda Deployment Framework

## Quick Start Guide

### 1. Prerequisites Setup

```bash
# Install required tools
brew install aws-sam-cli
brew install --cask docker

# Configure AWS credentials
aws configure

# Verify installation
sam --version
aws sts get-caller-identity
```

### 2. Local Development (Existing Workflow)

```bash
# Continue using existing local development
docker-compose -f docker-compose.dev.yml up -d
cd services/main-service && npm run start:dev
cd services/admin-service && npm run start:dev
```

### 3. Deploy to Lambda

#### Quick Deploy (All Services)
```bash
# Deploy all services to development
npm run deploy:dev

# Deploy to staging
npm run deploy:staging

# Deploy to production
npm run deploy:prod
```

#### Individual Service Deploy
```bash
# Deploy specific service
npm run deploy:main:dev
npm run deploy:admin:dev

# Or using script directly
./scripts/deploy.sh dev main-service
./scripts/deploy.sh dev admin-service
```

#### Build Only (No Deployment)
```bash
# Build all services for Lambda
npm run build:lambda

# Build specific service
npm run build:lambda:main
npm run build:lambda:admin
```

## Framework Components

### 1. Lambda Adapter (packages/fluxion-shared-lib/src/lambda/)
- **adapter.ts**: Converts Express apps to Lambda functions
- **types.ts**: Lambda-specific TypeScript definitions
- **utils.ts**: Lambda utility functions and helpers

### 2. Build Scripts (scripts/)
- **lambda-build.js**: Packages services for Lambda deployment
- **deploy.sh**: Full deployment automation script
- **package-shared-lib.js**: Creates Lambda layers from shared code

### 3. Service Configuration
- **services/*/src/lambda.ts**: Lambda handlers for each service
- **services/*/template.yaml**: Individual service SAM templates
- **services/*/samconfig.toml**: Service-specific SAM configuration

### 4. Environment Configuration
- **deployment/environment-configs/**: Environment variable files
- **deployment/parameters/**: CloudFormation parameter files
- **template-microservices.yaml**: Main SAM template
- **samconfig-microservices.toml**: SAM configuration

## Available Commands

### Root Level Commands
```bash
# Build Commands
npm run build:lambda              # Build all services
npm run build:lambda:main         # Build main service only
npm run build:lambda:admin        # Build admin service only
npm run package:shared-lib        # Package shared library layer

# Deployment Commands  
npm run deploy:dev                # Deploy all to dev
npm run deploy:staging            # Deploy all to staging
npm run deploy:prod               # Deploy all to production
npm run deploy:main:dev           # Deploy main service to dev
npm run deploy:admin:dev          # Deploy admin service to dev

# Monitoring Commands
npm run logs:main                 # Tail main service logs
npm run logs:admin                # Tail admin service logs
npm run validate:templates        # Validate SAM templates

# Local Testing Commands
npm run invoke:main:local         # Test main service locally
npm run invoke:admin:local        # Test admin service locally
```

### Service Level Commands
```bash
# In services/main-service/ or services/admin-service/
npm run build:lambda              # Build for Lambda
npm run deploy:dev                # Deploy to dev
npm run deploy:staging            # Deploy to staging
npm run deploy:prod               # Deploy to production
npm run validate:template         # Validate template
npm run logs:tail                 # Tail logs
npm run invoke:local              # Local invoke with test event
```

## Environment Setup

### Development Environment
No additional setup required - uses existing environment variables from `deployment/environment-configs/dev.env`.

### Production Environment
Set up AWS Systems Manager parameters:

```bash
# Database configuration
aws ssm put-parameter --name "/fluxion/production/db-host" --value "your-rds-endpoint" --type "SecureString"
aws ssm put-parameter --name "/fluxion/production/db-username" --value "postgres" --type "SecureString"
aws ssm put-parameter --name "/fluxion/production/db-password" --value "your-secure-password" --type "SecureString"
aws ssm put-parameter --name "/fluxion/production/db-database" --value "fluxion_prod" --type "SecureString"

# JWT configuration
aws ssm put-parameter --name "/fluxion/production/jwt-secret" --value "your-production-jwt-secret" --type "SecureString"

# Redis configuration
aws ssm put-parameter --name "/fluxion/production/redis-host" --value "your-elasticache-endpoint" --type "String"

# SQS configuration
aws ssm put-parameter --name "/fluxion/production/notification-queue-url" --value "your-sqs-queue-url" --type "String"

# S3 configuration
aws ssm put-parameter --name "/fluxion/production/s3-bucket" --value "your-s3-bucket-name" --type "String"

# VPC configuration (if using VPC)
aws ssm put-parameter --name "/fluxion/production/vpc-security-groups" --value "sg-12345,sg-67890" --type "String"
aws ssm put-parameter --name "/fluxion/production/vpc-subnets" --value "subnet-12345,subnet-67890" --type "String"
```

## Architecture

### Lambda Functions
1. **Main Service Function**: Handles primary API operations (invoices, payments, users)
2. **Admin Service Function**: Handles administrative operations  
3. **Authorizer Function**: JWT validation for API Gateway
4. **Notification Function**: Processes SQS messages for notifications

### API Gateway Integration
- Single API Gateway with different path patterns
- `/api/*` routes to Main Service
- `/admin/*` routes to Admin Service
- JWT authorizer validates all requests

### Monitoring
- CloudWatch Logs with structured JSON logging
- CloudWatch Alarms for errors and performance
- Dead Letter Queues for failed invocations
- X-Ray tracing for distributed debugging

## Testing

### Local Lambda Testing
```bash
# Start local Lambda environment
docker-compose -f docker-compose.lambda.yml up -d

# Test individual function
sam local invoke MainServiceFunction \
  --template-file template-simple.yaml \
  --event services/main-service/events/api-gateway-event.json

# Start local API Gateway
sam local start-api \
  --template-file template-simple.yaml \
  --port 3001
```

### Integration Testing
```bash
# Run existing tests
npm run test

# Test specific service
cd services/main-service && npm test
cd services/admin-service && npm test
```

## Deployment Verification

After deployment, verify the services:

```bash
# Get deployment outputs
aws cloudformation describe-stacks \
  --stack-name fluxion-microservices-dev \
  --query 'Stacks[0].Outputs'

# Test health endpoints
curl https://your-api-gateway-url/health
curl https://your-api-gateway-url/admin/health

# Monitor logs
npm run logs:main
npm run logs:admin
```

## Troubleshooting

### Build Issues
```bash
# Clean and rebuild
npm run clean
pnpm build:shared
npm run build:lambda
```

### Deployment Issues
```bash
# Validate templates
sam validate --template-file template-simple.yaml

# Check AWS configuration
aws sts get-caller-identity
aws configure list

# Debug deployment
./scripts/deploy.sh dev all validate
```

### Runtime Issues
```bash
# Check function logs
sam logs --name fluxion-dev-main-service --tail

# Test locally
sam local invoke MainServiceFunction --event services/main-service/events/api-gateway-event.json
```

## Migration Strategy

### Phase 1: Setup Framework
1. ✅ Install Lambda deployment framework
2. ✅ Configure environment parameters
3. ✅ Test local Lambda invocation

### Phase 2: Development Deployment
1. Deploy to development environment
2. Test all API endpoints
3. Verify monitoring and logging

### Phase 3: Staging & Production
1. Deploy to staging environment
2. Run integration tests
3. Deploy to production with monitoring

### Rollback Plan
- Each deployment creates CloudFormation changeset
- Use AWS CloudFormation console for manual rollback
- Keep previous versions for quick rollback

## Cost Optimization

### Resource Allocation
- **Main Service**: 512MB memory, 30s timeout
- **Admin Service**: 256MB memory, 30s timeout  
- **Authorizer**: 128MB memory, 10s timeout

### Concurrency Limits
- **Main Service**: 50 concurrent executions
- **Admin Service**: 25 concurrent executions
- **Total**: 100 concurrent executions across all functions

### Log Retention
- **Development**: 7 days
- **Staging**: 14 days
- **Production**: 30 days

This setup provides production-ready Lambda deployment while maintaining compatibility with existing local development workflows.