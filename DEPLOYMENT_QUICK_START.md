# Fluxion Lambda Deployment - Quick Start

## 🚀 Deploy Services to Lambda in 5 Minutes

### Prerequisites (One-time Setup)
```bash
# Install AWS CLI and SAM CLI
brew install aws-sam-cli
aws configure  # Enter your AWS credentials
```

### Deploy All Services
```bash
# Deploy to development
npm run deploy:dev

# Deploy to staging  
npm run deploy:staging

# Deploy to production
npm run deploy:prod
```

### Deploy Individual Services
```bash
# Deploy main service only
npm run deploy:main:dev

# Deploy admin service only
npm run deploy:admin:dev
```

### Build Without Deploying
```bash
# Build all services for Lambda
npm run build:lambda

# Build specific service
npm run build:lambda:main
npm run build:lambda:admin
```

## 📋 Available Commands

| Command | Description |
|---------|-------------|
| `npm run deploy:dev` | Deploy all services to development |
| `npm run deploy:staging` | Deploy all services to staging |
| `npm run deploy:prod` | Deploy all services to production |
| `npm run deploy:main:dev` | Deploy main service to dev |
| `npm run deploy:admin:dev` | Deploy admin service to dev |
| `npm run build:lambda` | Build all services for Lambda |
| `npm run build:lambda:main` | Build main service only |
| `npm run build:lambda:admin` | Build admin service only |
| `npm run validate:templates` | Validate SAM templates |
| `npm run logs:main` | Tail main service logs |
| `npm run logs:admin` | Tail admin service logs |

## 🔧 Direct Script Usage

```bash
# Deploy with full control
./scripts/deploy.sh [environment] [service] [command]

# Examples:
./scripts/deploy.sh dev                    # Deploy all to dev
./scripts/deploy.sh prod main-service      # Deploy main to prod
./scripts/deploy.sh staging admin-service build  # Build admin for staging
```

## 📁 Generated Files

After running deployment commands, these files are created:

```
deployment/
├── lambda-services/           # Built Lambda packages
│   ├── main-service/         # Ready-to-deploy main service
│   ├── admin-service/        # Ready-to-deploy admin service
│   └── authorizer/           # JWT authorizer function
├── layer-build/              # Shared library Lambda layer
└── parameters/               # Environment-specific parameters
```

## 🌐 Environment Configuration

### Development (Default)
Uses existing environment variables from `deployment/environment-configs/dev.env`

### Production
Set up AWS Systems Manager parameters:
```bash
aws ssm put-parameter --name "/fluxion/production/db-host" --value "your-rds-endpoint" --type "SecureString"
aws ssm put-parameter --name "/fluxion/production/db-password" --value "secure-password" --type "SecureString"
aws ssm put-parameter --name "/fluxion/production/jwt-secret" --value "production-jwt-secret" --type "SecureString"
```

## 📊 Monitoring

### View Logs
```bash
# Real-time log tailing
npm run logs:main
npm run logs:admin

# Or directly with SAM
sam logs --name fluxion-dev-main-service --tail
```

### CloudWatch Dashboard
After deployment, check AWS CloudWatch for:
- Function invocation metrics
- Error rates and alarms  
- Duration and memory usage
- API Gateway request metrics

## 🧪 Local Testing

### Test Lambda Functions Locally
```bash
# Start local Lambda environment
sam local start-api --template-file template-simple.yaml --port 3001

# Test specific function
sam local invoke MainServiceFunction --event services/main-service/events/api-gateway-event.json
```

### Verify Deployment
```bash
# Get API Gateway URLs
aws cloudformation describe-stacks --stack-name fluxion-microservices-dev --query 'Stacks[0].Outputs'

# Test endpoints
curl https://your-api-gateway-url/health
curl https://your-api-gateway-url/admin/health
```

## 🚨 Troubleshooting

### Build Fails
```bash
# Clean everything and rebuild
npm run clean
pnpm install
pnpm build:shared
npm run build:lambda
```

### Deployment Fails
```bash
# Validate templates first
npm run validate:templates

# Check AWS credentials
aws sts get-caller-identity

# Deploy with build-only first
./scripts/deploy.sh dev all build
```

### Function Errors
```bash
# Check logs immediately
npm run logs:main

# Test locally
sam local invoke MainServiceFunction --event services/main-service/events/api-gateway-event.json
```

## ✅ Success Indicators

After successful deployment, you should see:
1. ✅ CloudFormation stack created successfully
2. ✅ Lambda functions visible in AWS Console
3. ✅ API Gateway endpoints responding to health checks
4. ✅ CloudWatch logs showing function invocations
5. ✅ No errors in CloudWatch alarms

## 🔄 Development Workflow

1. **Local Development**: Continue using `npm run start:dev` as usual
2. **Lambda Testing**: Use `sam local invoke` for Lambda-specific testing
3. **Deployment**: Use `npm run deploy:dev` when ready to deploy
4. **Monitoring**: Use `npm run logs:main` to monitor deployed functions
5. **Iteration**: Repeat the cycle as needed

The framework is designed to complement, not replace, your existing local development workflow!