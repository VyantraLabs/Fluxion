# Fluxion Production Deployment Checklist

## Pre-Deployment Setup

### 1. Environment Configuration

#### AWS Account Setup
- [ ] Create AWS account with billing alerts enabled
- [ ] Set up IAM user with appropriate permissions
- [ ] Configure AWS CLI with credentials
- [ ] Enable AWS Cost Explorer and Budgets
- [ ] Set up billing alerts for $1, $5, and $10 thresholds

#### Supabase Projects
- [ ] Create Supabase development project
- [ ] Create Supabase staging project  
- [ ] Create Supabase production project
- [ ] Configure Row Level Security policies
- [ ] Set up backup policies
- [ ] Test database connectivity from Lambda

#### Vercel Setup
- [ ] Create Vercel account and link to GitHub
- [ ] Configure project settings
- [ ] Set up custom domains
- [ ] Configure environment variables
- [ ] Test preview deployments

#### GitHub Secrets
```bash
# AWS Credentials
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY

# Supabase Configuration
DEV_SUPABASE_URL
DEV_SUPABASE_SERVICE_KEY
STAGING_SUPABASE_URL  
STAGING_SUPABASE_SERVICE_KEY
PROD_SUPABASE_URL
PROD_SUPABASE_SERVICE_KEY

# Application Secrets
DEV_JWT_SECRET
STAGING_JWT_SECRET
PROD_JWT_SECRET
ALCHEMY_API_KEY

# Vercel Configuration
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID

# Monitoring
SLACK_WEBHOOK
```

### 2. Infrastructure Validation

#### SAM Template Validation
```bash
# Validate SAM templates
sam validate --template infrastructure/template-production.yaml
sam validate --lint

# Check for security issues
cfn_nag_scan --input-path infrastructure/template-production.yaml
```

#### Network Configuration
- [ ] Configure custom domains and SSL certificates
- [ ] Set up DNS records (A, CNAME, MX if needed)
- [ ] Test CORS configuration
- [ ] Verify API Gateway throttling limits
- [ ] Configure rate limiting

### 3. Security Setup

#### Secrets Management
- [ ] Store all secrets in AWS Systems Manager Parameter Store
- [ ] Configure secret rotation where applicable
- [ ] Validate least-privilege IAM policies
- [ ] Enable AWS CloudTrail for audit logging
- [ ] Configure AWS Config for compliance monitoring

#### Security Testing
```bash
# Run security scans
npm audit --production
docker run --rm -it -v "$(pwd):/src" securecodewarrior/docker-scout scan /src

# Check for sensitive data
git secrets --scan
truffleHog --regex --entropy=True .
```

## Deployment Process

### Phase 1: Development Environment

#### Backend Deployment
```bash
# Build and deploy development environment
cd main-lambda
npm run build

# Deploy with SAM
sam build --config-file ../infrastructure/samconfig-production.toml
sam deploy --config-env dev \
  --parameter-overrides \
    "Environment=dev" \
    "SupabaseUrl=$DEV_SUPABASE_URL" \
    "SupabaseServiceRoleKey=$DEV_SUPABASE_SERVICE_KEY" \
    "JWTSecret=$DEV_JWT_SECRET"
```

#### Frontend Deployment
```bash
cd frontend
npm run build
vercel --target=development
```

#### Validation Tests
- [ ] Health check endpoint returns 200
- [ ] Authentication flow works end-to-end
- [ ] Database connectivity confirmed
- [ ] All API endpoints respond correctly
- [ ] Frontend loads and functions properly

### Phase 2: Staging Environment

#### Database Migration
```bash
# Run database migrations on staging
cd main-lambda
SUPABASE_URL=$STAGING_SUPABASE_URL \
SUPABASE_SERVICE_ROLE_KEY=$STAGING_SUPABASE_SERVICE_KEY \
npm run migration:run
```

#### Backend Deployment
```bash
sam deploy --config-env staging \
  --parameter-overrides \
    "Environment=staging" \
    "SupabaseUrl=$STAGING_SUPABASE_URL" \
    "SupabaseServiceRoleKey=$STAGING_SUPABASE_SERVICE_KEY" \
    "JWTSecret=$STAGING_JWT_SECRET"
```

#### Integration Testing
- [ ] Run full test suite against staging
- [ ] Perform load testing
- [ ] Validate monitoring and alerting
- [ ] Test backup and recovery procedures
- [ ] Verify error handling and logging

### Phase 3: Production Deployment

#### Pre-Production Checklist
- [ ] All staging tests passing
- [ ] Security scan completed
- [ ] Performance benchmarks met
- [ ] Monitoring dashboards configured
- [ ] Rollback plan documented
- [ ] Team notification sent

#### Production Database Setup
```bash
# Create production database backup point
# Run migrations with extra care
cd main-lambda
SUPABASE_URL=$PROD_SUPABASE_URL \
SUPABASE_SERVICE_ROLE_KEY=$PROD_SUPABASE_SERVICE_KEY \
npm run migration:run
```

#### Production Deployment
```bash
# Deploy to production
sam deploy --config-env prod \
  --parameter-overrides \
    "Environment=prod" \
    "SupabaseUrl=$PROD_SUPABASE_URL" \
    "SupabaseServiceRoleKey=$PROD_SUPABASE_SERVICE_KEY" \
    "JWTSecret=$PROD_JWT_SECRET" \
  --confirm-changeset
```

#### Frontend Production Deploy
```bash
cd frontend
vercel --prod --target=production
```

## Post-Deployment Validation

### 1. Health Checks

#### System Health
```bash
# API health check
curl -f https://api.fluxion.app/health

# Database connectivity
curl -f https://api.fluxion.app/health/database

# External dependencies
curl -f https://api.fluxion.app/health/dependencies
```

#### Performance Validation
- [ ] API response times < 2 seconds
- [ ] Frontend loads within 3 seconds
- [ ] Database queries optimized
- [ ] No memory leaks detected
- [ ] Cold start times acceptable

### 2. Monitoring Setup

#### CloudWatch Configuration
- [ ] All alarms configured and active
- [ ] Dashboard displaying correctly
- [ ] Log groups created with proper retention
- [ ] Custom metrics publishing
- [ ] Cost monitoring alerts active

#### Business Metrics
- [ ] User authentication tracking
- [ ] Invoice creation metrics
- [ ] Payment processing metrics
- [ ] Error rate monitoring
- [ ] Performance benchmarks

### 3. Security Validation

#### Access Control
- [ ] API authentication working
- [ ] JWT token validation active
- [ ] Rate limiting functional
- [ ] CORS policies enforced
- [ ] Input validation active

#### Data Protection
- [ ] Sensitive data encrypted
- [ ] Access logs captured
- [ ] Audit trails active
- [ ] Backup encryption verified
- [ ] Data retention policies applied

## Ongoing Maintenance

### Daily Operations
- [ ] Monitor cost usage (automated)
- [ ] Check system health dashboard
- [ ] Review error logs
- [ ] Validate backup completion
- [ ] Monitor performance metrics

### Weekly Operations
- [ ] Review and rotate logs
- [ ] Update dependencies
- [ ] Security patch assessment
- [ ] Performance optimization review
- [ ] Cost optimization analysis

### Monthly Operations
- [ ] Disaster recovery test
- [ ] Security audit
- [ ] Performance benchmarking
- [ ] Cost analysis and optimization
- [ ] Update documentation

## Troubleshooting Guide

### Common Issues

#### Lambda Cold Starts
```bash
# Check cold start frequency
aws logs filter-log-events \
  --log-group-name "/aws/lambda/fluxion-main-prod" \
  --filter-pattern "INIT_START" \
  --start-time $(date -d '1 hour ago' +%s)000
```

#### Database Connection Issues
```bash
# Test database connectivity
psql "$SUPABASE_URL" -c "SELECT 1;"

# Check connection pool status
aws lambda invoke \
  --function-name fluxion-main-prod \
  --payload '{"health":"database"}' \
  response.json
```

#### High API Gateway Latency
```bash
# Check API Gateway metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Latency \
  --dimensions Name=ApiName,Value=fluxion-api-prod \
  --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average,Maximum
```

### Rollback Procedures

#### Application Rollback
```bash
# Rollback Lambda function
aws lambda update-function-configuration \
  --function-name fluxion-main-prod \
  --code-sha-256 <previous-version-sha>

# Rollback API Gateway stage
aws apigateway update-stage \
  --rest-api-id <api-id> \
  --stage-name prod \
  --patch-ops op=replace,path=/deploymentId,value=<previous-deployment-id>
```

#### Database Rollback
```bash
# Revert database migrations (if necessary)
cd main-lambda
SUPABASE_URL=$PROD_SUPABASE_URL \
SUPABASE_SERVICE_ROLE_KEY=$PROD_SUPABASE_SERVICE_KEY \
npm run migration:revert
```

#### Frontend Rollback
```bash
# Rollback Vercel deployment
vercel rollback <deployment-url> --scope=<team-id>
```

## Success Criteria

### Technical Metrics
- [ ] API availability > 99.9%
- [ ] Response times < 2 seconds (95th percentile)
- [ ] Error rate < 0.1%
- [ ] Database queries < 100ms average
- [ ] Frontend load time < 3 seconds

### Business Metrics
- [ ] User registration working
- [ ] Invoice creation functional
- [ ] Payment processing active
- [ ] Email notifications sending
- [ ] All core user journeys working

### Operational Metrics
- [ ] Monitoring alerts functional
- [ ] Cost within budget
- [ ] Security scans passing
- [ ] Backup procedures working
- [ ] Documentation up to date

## Emergency Contacts

### Technical Support
- Platform Team: platform@fluxion.app
- DevOps Lead: devops@fluxion.app
- Security Team: security@fluxion.app

### External Services
- AWS Support: [Support Case URL]
- Supabase Support: support@supabase.io
- Vercel Support: support@vercel.com

---

**Deployment Date**: ___________
**Deployed by**: ___________
**Reviewed by**: ___________
**Sign-off**: ___________