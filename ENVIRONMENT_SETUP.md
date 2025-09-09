# 🔧 Fluxion Environment Setup Guide

This guide explains all environment variables required to run the Fluxion application successfully, including the new S3-based template storage system.

## 📋 Quick Setup Checklist

### ✅ **Required for Basic Operation**
- [ ] PostgreSQL database running
- [ ] Redis server running  
- [ ] JWT secret configured
- [ ] S3 bucket created and configured
- [ ] Database migrations run

### ✅ **Required for Production**  
- [ ] AWS credentials configured
- [ ] SQS queue setup for notifications
- [ ] All security configurations validated
- [ ] S3 bucket with proper CORS and permissions

---

## 🚀 Local Development Setup

### 1. **Copy Environment Template**
```bash
cd main-lambda
cp .env.example .env
```

### 2. **Required Variables for Local Development**
Edit your `.env` file with these **minimum required** variables:

```bash
# Database (Required)
DB_PASSWORD=postgres

# Authentication (Required)  
JWT_SECRET=your-local-jwt-secret-minimum-32-characters

# S3 Template Storage (Required)
S3_BUCKET_NAME=fluxion-templates-dev
S3_BUCKET_URL=https://fluxion-templates-dev.s3.ap-south-1.amazonaws.com

# SQS Notifications (Required)
NOTIFICATION_QUEUE_URL=https://sqs.ap-south-1.amazonaws.com/your-account/fluxion-notifications-dev
```

### 3. **Start Required Services**
```bash
# Start PostgreSQL and Redis
docker-compose -f docker-compose.dev.yml up -d

# Run database migrations
npm run migration:run

# Start the application
npm run start:dev
```

---

## 🏭 Production Environment Setup  

### **Required Production Variables**

```bash
# Core Application
NODE_ENV=production
PORT=3000

# Database Configuration  
DB_HOST=your-rds-endpoint.amazonaws.com
DB_USERNAME=fluxion_app
DB_PASSWORD=your-secure-database-password
DB_DATABASE=fluxion_prod
DB_SSL=true

# AWS Credentials (Required)
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=AKIA...your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-access-key

# S3 Template Storage (Required)
S3_BUCKET_NAME=fluxion-templates-prod
S3_BUCKET_URL=https://fluxion-templates-prod.s3.ap-south-1.amazonaws.com
S3_REGION=ap-south-1

# SQS Notifications (Required)
NOTIFICATION_QUEUE_URL=https://sqs.ap-south-1.amazonaws.com/921157071358/fluxion-notifications-prod

# Security (Required)
JWT_SECRET=your-super-secure-jwt-secret-minimum-32-characters-production

# Application URLs
FRONTEND_URL=https://app.fluxion.pay
```

---

## 🔐 AWS Services Setup

### **1. S3 Bucket for Template Storage**

Create an S3 bucket for storing template files:

```bash
# Create S3 bucket
aws s3 mb s3://fluxion-templates-prod --region ap-south-1

# Set bucket policy for public read access to templates
aws s3api put-bucket-policy --bucket fluxion-templates-prod --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::fluxion-templates-prod/templates/*"
    }
  ]
}'

# Set CORS configuration
aws s3api put-bucket-cors --bucket fluxion-templates-prod --cors-configuration '{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedOrigins": ["*"],
      "MaxAgeSeconds": 3000
    }
  ]
}'
```

### **2. Upload Template Files**

The seeded templates reference these S3 paths. Upload actual template files:

```bash
# Example template structure in S3
templates/
├── invoices/
│   ├── professional-service.json
│   ├── modern-product.json
│   └── freelancer.json
├── payslips/
│   ├── standard-employee.json  
│   └── contractor.json
├── reminders/
│   ├── friendly-reminder.json
│   └── final-notice.json
├── receipts/
│   └── payment-confirmation.json
├── estimates/
│   └── project-estimate.json
└── previews/
    ├── professional-service.png
    ├── modern-product.png
    └── [other-template-previews].png
```

### **3. SQS Queue for Notifications**

```bash
# Create SQS queue
aws sqs create-queue --queue-name fluxion-notifications-prod --region ap-south-1

# Get queue URL
aws sqs get-queue-url --queue-name fluxion-notifications-prod --region ap-south-1
```

### **4. IAM Permissions**

Your application needs these AWS permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::fluxion-templates-prod/*"
    },
    {
      "Effect": "Allow", 
      "Action": [
        "s3:ListBucket"
      ],
      "Resource": "arn:aws:s3:::fluxion-templates-prod"
    },
    {
      "Effect": "Allow",
      "Action": [
        "sqs:SendMessage",
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage"
      ],
      "Resource": "arn:aws:sqs:ap-south-1:*:fluxion-notifications-*"
    }
  ]
}
```

---

## 📝 Complete Environment Variable Reference

### **Database Configuration**
```bash
DB_HOST=localhost                    # Database host
DB_PORT=5432                        # Database port  
DB_USERNAME=postgres                # Database username
DB_PASSWORD=password                # Database password (REQUIRED)
DB_DATABASE=fluxion_local           # Database name
DB_SSL=false                        # Enable SSL (true for production)
DB_LOGGING=true                     # Enable query logging
```

### **Database Pool Settings**
```bash
DB_POOL_MAX=20                      # Maximum connections
DB_POOL_MIN=2                       # Minimum connections
DB_IDLE_TIMEOUT=30000               # Idle timeout (ms)
DB_CONNECTION_TIMEOUT=2000          # Connection timeout (ms)
```

### **Redis Configuration**
```bash
REDIS_HOST=localhost                # Redis host
REDIS_PORT=6379                     # Redis port
REDIS_PASSWORD=                     # Redis password (optional)
REDIS_DB=0                          # Default Redis database
REDIS_CACHE_DB=1                    # Cache database
REDIS_SESSION_DB=2                  # Session database
```

### **Authentication & Security**
```bash
JWT_SECRET=your-jwt-secret          # JWT signing secret (REQUIRED, 32+ chars)
JWT_EXPIRES_IN=7d                   # JWT expiration time
```

### **AWS Configuration**
```bash
AWS_REGION=ap-south-1               # AWS region
AWS_ACCESS_KEY_ID=AKIA...           # AWS access key
AWS_SECRET_ACCESS_KEY=...           # AWS secret key
```

### **S3 Template Storage** ⭐ **New Feature**
```bash
S3_BUCKET_NAME=fluxion-templates    # S3 bucket name (REQUIRED)
S3_BUCKET_URL=https://...           # Full S3 bucket URL (REQUIRED)  
S3_REGION=ap-south-1                # S3 bucket region
```

### **SQS Notifications**
```bash
NOTIFICATION_QUEUE_URL=https://sqs.ap-south-1.amazonaws.com/.../queue-name
```

### **Blockchain Configuration** 
```bash
DEFAULT_BLOCKCHAIN_NETWORK=polygon  # Default network
POLYGON_RPC_URL=https://...         # Polygon RPC endpoint
ETHEREUM_RPC_URL=https://...        # Ethereum RPC endpoint  
ARBITRUM_RPC_URL=https://...        # Arbitrum RPC endpoint
BASE_RPC_URL=https://...            # Base RPC endpoint
```

### **Application Settings**
```bash
NODE_ENV=development                # Environment (development|production)
PORT=3000                          # Server port
FRONTEND_URL=http://localhost:3001  # Frontend application URL
LOG_LEVEL=debug                    # Logging level
```

### **Feature Toggles**
```bash
ENABLE_RLS=true                    # Row-level security
ENABLE_AUDIT_LOGGING=true          # Audit logging
ENABLE_REDIS_CACHE=false           # Redis caching
```

### **Rate Limiting**
```bash
RATE_LIMIT_WINDOW_MS=60000         # Rate limit window
RATE_LIMIT_MAX_REQUESTS=100        # Max requests per window
```

---

## 🚨 Critical Setup Requirements

### **For S3 Template Storage to Work:**

1. **S3 Bucket Must Exist**: Create the bucket referenced in `S3_BUCKET_NAME`
2. **Public Read Access**: Templates need to be publicly readable
3. **CORS Configuration**: Enable CORS for frontend access
4. **Template Files**: Upload actual JSON template files to S3
5. **Environment Variables**: Both `S3_BUCKET_NAME` and `S3_BUCKET_URL` are required

### **Validation on Startup:**

The application validates these configurations on startup:
- ✅ S3 bucket URL format
- ✅ JWT secret length (32+ characters in production)  
- ✅ Database connection parameters
- ✅ Required AWS credentials
- ✅ SQS queue URL format

---

## 🛠 Troubleshooting

### **Configuration Errors**
```bash
# If you see: "S3_BUCKET_NAME is required" 
# Add to .env:
S3_BUCKET_NAME=your-bucket-name

# If you see: "S3_BUCKET_URL must be a valid URL"
# Ensure format: https://bucket-name.s3.region.amazonaws.com  
S3_BUCKET_URL=https://fluxion-templates.s3.ap-south-1.amazonaws.com
```

### **Template Loading Issues**
```bash
# Check S3 bucket permissions
aws s3api get-bucket-policy --bucket fluxion-templates-prod

# Test template URL access
curl https://fluxion-templates.s3.ap-south-1.amazonaws.com/templates/invoices/professional-service.json
```

### **Database Migration Issues**  
```bash
# Reset database (development only)
npm run db:reset

# Run specific migration
npm run typeorm -- migration:run

# Check migration status
npm run typeorm -- migration:show
```

---

## 🎯 Quick Start Commands

```bash
# 1. Clone and setup
git clone <repository>
cd main-lambda

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your values

# 4. Start services
docker-compose -f docker-compose.dev.yml up -d

# 5. Run migrations
npm run migration:run

# 6. Start application
npm run start:dev

# 7. Verify setup
curl http://localhost:3000/health
```

**🎉 Your Fluxion application with S3-based template storage is now ready!**