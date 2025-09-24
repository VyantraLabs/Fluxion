# Fluxion Lambda Deployment Framework

A comprehensive deployment framework for deploying Fluxion microservices to AWS Lambda with support for both Lambda and local development.

## Overview

This framework provides:
- **Easy Lambda deployment** with simple build commands
- **Local development support** alongside Lambda deployment
- **Automatic packaging** of dependencies and shared libraries
- **Environment-specific configurations**
- **SAM CLI integration** with CloudFormation
- **Individual service deployment** capability

## Quick Start

### Prerequisites

Install required tools:
```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /

# Install SAM CLI
brew install aws-sam-cli

# Install Docker
brew install --cask docker

# Configure AWS credentials
aws configure
```

### 1. Deploy All Services to Development

```bash
# Build and deploy all services to dev environment
npm run deploy:dev

# Or using the script directly
./scripts/deploy.sh dev
```

### 2. Deploy Individual Service

```bash
# Deploy only main service to dev
npm run deploy:main:dev

# Deploy only admin service to dev
npm run deploy:admin:dev

# Or using the script
./scripts/deploy.sh dev main-service
```

### 3. Build Without Deployment

```bash
# Build all services for Lambda
npm run build:lambda

# Build specific service
npm run build:lambda:main
npm run build:lambda:admin
```

## Directory Structure

```
fluxion/
├── scripts/
│   ├── lambda-build.js           # Build script for packaging services
│   ├── deploy.sh                 # Deployment script for all services
│   └── package-shared-lib.js     # Script to package shared library
├── packages/fluxion-shared-lib/
│   └── src/lambda/               # Lambda utilities
│       ├── adapter.ts            # Express to Lambda adapter
│       ├── types.ts              # Lambda-specific type definitions
│       └── utils.ts              # Lambda utility functions
├── services/
│   ├── main-service/
│   │   ├── src/lambda.ts         # Lambda handler
│   │   ├── template.yaml         # SAM template for individual deployment
│   │   ├── samconfig.toml        # SAM configuration
│   │   └── events/               # Test events for local development
│   └── admin-service/
│       ├── src/lambda.ts         # Lambda handler
│       ├── template.yaml         # SAM template for individual deployment
│       ├── samconfig.toml        # SAM configuration
│       └── events/               # Test events for local development
├── deployment/
│   ├── lambda-services/          # Built Lambda packages (generated)
│   ├── parameters/               # Environment parameter files
│   └── environment-configs/      # Environment variable files
├── template-microservices.yaml   # Main SAM template for all services
├── samconfig-microservices.toml  # SAM configuration for microservices
└── docker-compose.lambda.yml     # Docker setup for local Lambda testing
```

## Available Commands

### Root Package Commands

```bash
# Build Commands
npm run build:lambda              # Build all services for Lambda
npm run build:lambda:main         # Build main service only
npm run build:lambda:admin        # Build admin service only
npm run package:shared-lib        # Package shared library as Lambda layer

# Deployment Commands
npm run deploy:dev                # Deploy all services to dev
npm run deploy:staging            # Deploy all services to staging
npm run deploy:prod               # Deploy all services to production
npm run deploy:main:dev           # Deploy main service to dev
npm run deploy:admin:dev          # Deploy admin service to dev

# Validation and Testing
npm run validate:templates        # Validate SAM templates
npm run logs:main                 # Tail main service logs
npm run logs:admin                # Tail admin service logs
npm run invoke:main:local         # Invoke main service locally
npm run invoke:admin:local        # Invoke admin service locally
```

### Service-Specific Commands

```bash
# In services/main-service/ or services/admin-service/
npm run build:lambda              # Build service for Lambda
npm run deploy:dev                # Deploy to dev environment
npm run deploy:staging            # Deploy to staging environment
npm run deploy:prod               # Deploy to production environment
npm run package:lambda            # Package for deployment
npm run validate:template         # Validate SAM template
npm run logs:tail                 # Tail Lambda logs
npm run invoke:local              # Invoke locally with test event
```

## Environment Configuration

### 1. Environment Variables

Environment-specific variables are stored in:
- `deployment/environment-configs/dev.env`
- `deployment/environment-configs/staging.env` 
- `deployment/environment-configs/production.env`

### 2. AWS Systems Manager Parameters

For production deployments, sensitive values are stored in AWS SSM:

```bash
# Set database credentials
aws ssm put-parameter --name "/fluxion/production/db-host" --value "your-db-host" --type "SecureString"
aws ssm put-parameter --name "/fluxion/production/db-username" --value "postgres" --type "SecureString"
aws ssm put-parameter --name "/fluxion/production/db-password" --value "your-password" --type "SecureString"
aws ssm put-parameter --name "/fluxion/production/db-database" --value "fluxion_prod" --type "SecureString"

# Set JWT secret
aws ssm put-parameter --name "/fluxion/production/jwt-secret" --value "your-secure-jwt-secret" --type "SecureString"

# Set other service URLs
aws ssm put-parameter --name "/fluxion/production/redis-host" --value "your-redis-host" --type "String"
aws ssm put-parameter --name "/fluxion/production/notification-queue-url" --value "your-sqs-url" --type "String"
aws ssm put-parameter --name "/fluxion/production/s3-bucket" --value "your-s3-bucket" --type "String"
```

### 3. VPC Configuration (Production)

For production deployments in VPC:

```bash
# Set VPC configuration
aws ssm put-parameter --name "/fluxion/production/vpc-security-groups" --value "sg-12345,sg-67890" --type "String"
aws ssm put-parameter --name "/fluxion/production/vpc-subnets" --value "subnet-12345,subnet-67890" --type "String"
```

## Local Development

### 1. Traditional Local Development

Continue using the existing local development setup:

```bash
# Start local services with Docker
docker-compose -f docker-compose.dev.yml up -d

# Start main service locally
cd services/main-service && npm run start:dev

# Start admin service locally  
cd services/admin-service && npm run start:dev
```

### 2. Local Lambda Testing

Test Lambda functions locally using SAM:

```bash
# Start local Lambda environment
docker-compose -f docker-compose.lambda.yml up -d

# Invoke specific function with test event
sam local invoke MainServiceFunction \
  --template-file template-microservices.yaml \
  --event services/main-service/events/api-gateway-event.json \
  --env-vars deployment/environment-configs/dev.env.json

# Start local API Gateway
sam local start-api \
  --template-file template-microservices.yaml \
  --env-vars deployment/environment-configs/dev.env.json \
  --docker-network fluxion_default
```

### 3. Debug Lambda Functions

```bash
# Start Lambda function in debug mode
sam local invoke MainServiceFunction \
  --template-file template-microservices.yaml \
  --event services/main-service/events/api-gateway-event.json \
  --debug-port 5858 \
  --debug-args='-e'
```

## Deployment Strategies

### 1. Full Stack Deployment

Deploy all services together:

```bash
./scripts/deploy.sh dev              # Deploy to development
./scripts/deploy.sh staging         # Deploy to staging  
./scripts/deploy.sh production      # Deploy to production
```

### 2. Individual Service Deployment

Deploy services independently:

```bash
./scripts/deploy.sh dev main-service     # Deploy main service only
./scripts/deploy.sh dev admin-service    # Deploy admin service only
```

### 3. Build-Only Mode

Build without deploying:

```bash
./scripts/deploy.sh dev all build       # Build all services
./scripts/deploy.sh dev main-service build  # Build main service only
```

## Architecture Components

### 1. Lambda Adapter

The Lambda adapter (`packages/fluxion-shared-lib/src/lambda/adapter.ts`) converts Express applications to Lambda functions:

```typescript
import { createLambdaAdapter } from '@fluxion/shared-lib/lambda/adapter';
import { app } from './app';

const adapter = createLambdaAdapter(app);
export const handler = adapter.handler;
```

### 2. Environment Validation

Lambda utilities provide environment validation:

```typescript
import { validateEnvironment } from '@fluxion/shared-lib/lambda/utils';

validateEnvironment(['JWT_SECRET', 'DB_HOST', 'DB_PASSWORD']);
```

### 3. Response Formatting

Standardized Lambda response helpers:

```typescript
import { successResponse, errorResponse } from '@fluxion/shared-lib/lambda/utils';

return successResponse(data, 200);
return errorResponse('Error message', 400, 'VALIDATION_ERROR');
```

## Monitoring and Logging

### 1. CloudWatch Integration

All Lambda functions automatically log to CloudWatch:
- `/aws/lambda/fluxion-{environment}-main-service`
- `/aws/lambda/fluxion-{environment}-admin-service`
- `/aws/lambda/fluxion-{environment}-authorizer`

### 2. Structured Logging

All services use structured JSON logging:

```typescript
import { Logger } from '@fluxion/shared-lib/utils/logger';

const logger = new Logger('ServiceName');
logger.info('Request processed', { userId, requestId, duration });
```

### 3. CloudWatch Alarms

Automatic alarms for:
- Function errors (threshold: 5 for main, 3 for admin)
- High duration (threshold: 25 seconds)
- Dead letter queue messages

### 4. Tail Logs

```bash
# Tail logs in real-time
npm run logs:main                 # Main service logs
npm run logs:admin                # Admin service logs

# Or directly with SAM
sam logs --name fluxion-dev-main-service --tail
```

## Security Features

### 1. JWT Authorizer

API Gateway uses a Lambda authorizer for JWT validation:
- Validates JWT tokens on all protected endpoints
- Extracts user context and passes to Lambda functions
- Denies access for invalid or expired tokens

### 2. VPC Integration

Production deployments support VPC integration:
- Lambda functions can run in private subnets
- Database and Redis connections over private network
- NAT Gateway for outbound internet access

### 3. IAM Policies

Least-privilege IAM policies:
- Lambda execution role with minimal permissions
- Service-specific permissions (SQS, S3, CloudWatch)
- Environment-specific resource access

## Performance Optimization

### 1. Lambda Layers

Shared dependencies packaged as Lambda layers:
- Reduces deployment package size
- Faster cold starts
- Shared across all functions

### 2. Warm-up Strategy

Automatic function warming:
- CloudWatch Events trigger functions every 5 minutes
- Reduces cold start latency
- Configurable warming schedule

### 3. Reserved Concurrency

Resource allocation per service:
- Main service: 50 concurrent executions
- Admin service: 25 concurrent executions
- Prevents resource contention

## Troubleshooting

### Common Issues

1. **Build Fails**
   ```bash
   # Clean and rebuild
   npm run clean
   npm run build:shared
   npm run build:lambda
   ```

2. **Deployment Fails**
   ```bash
   # Validate template first
   npm run validate:templates
   
   # Check AWS credentials
   aws sts get-caller-identity
   ```

3. **Function Timeouts**
   ```bash
   # Check logs
   npm run logs:main
   
   # Increase timeout in template.yaml
   Timeout: 60  # seconds
   ```

4. **Database Connection Issues**
   ```bash
   # Verify SSM parameters
   aws ssm get-parameter --name "/fluxion/dev/db-host"
   
   # Test connection
   sam local invoke MainServiceFunction --event services/main-service/events/api-gateway-event.json
   ```

### Debug Commands

```bash
# Validate all templates
find . -name "template.yaml" -exec sam validate --template-file {} \;

# Build with verbose output
sam build --debug

# Deploy with debug output
sam deploy --debug

# Local API with debug
sam local start-api --debug
```

## Migration from Existing Setup

### 1. Existing Services Continue Working

The deployment framework is additive:
- Local development continues to work as before
- Docker Compose setup remains unchanged
- Express applications run normally in local mode

### 2. Gradual Migration

Migrate services one at a time:
1. Deploy to development environment first
2. Test Lambda version alongside local version
3. Switch traffic gradually using API Gateway stages
4. Monitor performance and error rates

### 3. Rollback Strategy

Each deployment creates a CloudFormation changeset:
- Review changes before deployment
- Automatic rollback on failure
- Manual rollback using CloudFormation console

## Environment Promotion

### Development → Staging → Production

1. **Development Testing**
   ```bash
   ./scripts/deploy.sh dev
   # Test functionality
   ```

2. **Staging Deployment**
   ```bash
   ./scripts/deploy.sh staging
   # Integration testing
   ```

3. **Production Deployment**
   ```bash
   ./scripts/deploy.sh production
   # Monitor closely
   ```

### Blue/Green Deployment

For zero-downtime production deployments:

1. Deploy to new stack with different name
2. Test new deployment thoroughly
3. Switch DNS or API Gateway routing
4. Monitor and rollback if needed

## Cost Optimization

### 1. Function Sizing

- **Main Service**: 512MB (handles complex operations)
- **Admin Service**: 256MB (lighter admin operations)
- **Authorizer**: 128MB (simple JWT validation)

### 2. Reserved Concurrency

Prevents runaway costs:
- Total reserved concurrency: 100 executions
- Per-service limits to control usage
- Scales automatically within limits

### 3. Log Retention

- Development: 7 days
- Staging: 14 days  
- Production: 30 days (configurable)

## Support and Maintenance

### Updating the Framework

1. **Add New Service**
   - Create service directory in `services/`
   - Add service configuration to `scripts/lambda-build.js`
   - Update root package.json scripts
   - Create service-specific SAM template

2. **Modify Build Process**
   - Update `scripts/lambda-build.js`
   - Modify packaging logic in `scripts/package-shared-lib.js`
   - Test with build-only mode first

3. **Change Environment Configuration**
   - Update environment files in `deployment/environment-configs/`
   - Modify parameter files in `deployment/parameters/`
   - Update SAM configuration files

### Getting Help

- Check CloudWatch logs for function errors
- Use SAM local for debugging
- Validate templates before deployment
- Test with individual service deployment first

## Advanced Features

### Custom Authorizers

The framework includes a JWT-based Lambda authorizer:
- Validates all API requests
- Extracts user context
- Supports role-based access control

### Dead Letter Queues

Failed Lambda invocations go to DLQs:
- Automatic retry mechanism
- 14-day message retention
- CloudWatch alarms on DLQ messages

### API Gateway Features

- **CORS Configuration**: Supports cross-origin requests
- **Request Tracing**: X-Ray integration for distributed tracing
- **Rate Limiting**: Configurable throttling limits
- **Access Logging**: Detailed request/response logging

### Multi-Environment Support

- **Parameter Isolation**: Environment-specific configurations
- **Resource Naming**: Consistent naming across environments
- **Tag Management**: Automatic resource tagging
- **Cost Allocation**: Environment-based cost tracking