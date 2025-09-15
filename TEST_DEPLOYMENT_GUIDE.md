# 🚀 Fluxion Test Environment Deployment Guide

## Quick Start - Deploy in 10 Minutes!

This guide will help you deploy Fluxion to a test environment with **zero cost** using:
- **Frontend**: Vercel (free subdomain provided)
- **Backend**: AWS Lambda (1M free requests/month) 
- **Database**: Supabase (500MB free PostgreSQL)

---

## 📋 Prerequisites

- [ ] Node.js 18+ installed
- [ ] Git repository (for Vercel deployment)
- [ ] AWS account (free tier)
- [ ] Supabase account (free)

---

## Step 1: Deploy Frontend to Vercel (5 minutes)

### Option A: Deploy via Vercel CLI (Recommended)

```bash
# 1. Navigate to frontend directory
cd /Users/rishi/Rishi/Vyantra/Projects/Fluxion/frontend

# 2. Login to Vercel (you'll need to create a free account)
npx vercel login

# 3. Deploy to Vercel
npx vercel --yes

# 4. For production deployment (with optimizations)
npx vercel --prod
```

**Your app will be available at:** `https://fluxion-frontend-[random].vercel.app`

### Option B: Deploy via GitHub Integration

1. Push your code to GitHub
2. Go to [vercel.com](https://vercel.com)
3. Click "Import Project"
4. Select your GitHub repository
5. Set root directory to `frontend`
6. Click "Deploy"

---

## Step 2: Set Up Supabase Database (5 minutes)

### Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up (free)
2. Click "New Project"
3. Project settings:
   - **Name**: fluxion-test
   - **Database Password**: [save this securely]
   - **Region**: Choose closest to you
   - **Plan**: Free tier

### Get Database Connection Details

After project creation, go to Settings → Database and note:
- **Host**: `db.[project-ref].supabase.co`
- **Port**: `5432`
- **Database**: `postgres`
- **User**: `postgres`
- **Password**: [your password]

### Connection String
```
postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

---

## Step 3: Migrate Database Schema

```bash
# 1. Navigate to backend
cd /Users/rishi/Rishi/Vyantra/Projects/Fluxion/main-lambda

# 2. Update .env with Supabase credentials
cat > .env.test << EOF
DB_HOST=db.[PROJECT-REF].supabase.co
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=[YOUR-PASSWORD]
DB_DATABASE=postgres
DB_SSL=true

JWT_SECRET=your-test-jwt-secret-change-this
JWT_EXPIRES_IN=24h

NODE_ENV=test
EOF

# 3. Run migrations
npm run migration:run

# 4. Seed initial data (optional)
npm run seed:run
```

---

## Step 4: Deploy Backend to AWS Lambda

### Prerequisites
```bash
# Install AWS SAM CLI if not already installed
brew install aws-sam-cli

# Configure AWS credentials
aws configure
```

### Deploy Backend

```bash
cd /Users/rishi/Rishi/Vyantra/Projects/Fluxion/main-lambda

# 1. Build the Lambda
sam build

# 2. Deploy (first time - will create stack)
sam deploy --guided \
  --stack-name fluxion-test \
  --parameter-overrides \
    Environment=test \
    DBHost=db.[PROJECT-REF].supabase.co \
    DBPort=5432 \
    DBUsername=postgres \
    DBPassword=[YOUR-PASSWORD] \
    DBDatabase=postgres \
    JWTSecret=your-test-jwt-secret

# Note the API Gateway URL from output
# Example: https://abc123.execute-api.us-east-1.amazonaws.com/Prod
```

---

## Step 5: Update Frontend with Backend URL

```bash
# 1. Go to Vercel Dashboard
# 2. Select your project
# 3. Go to Settings → Environment Variables
# 4. Add:
#    NEXT_PUBLIC_API_URL = https://[your-api-gateway-url]/Prod
#    NEXT_PUBLIC_ENVIRONMENT = test

# Or via CLI:
vercel env add NEXT_PUBLIC_API_URL production
# Enter: https://[your-api-gateway-url]/Prod

# 5. Redeploy to apply changes
vercel --prod
```

---

## Step 6: Test Your Deployment

### Frontend Health Check
```bash
curl https://your-app.vercel.app
```

### Backend Health Check
```bash
curl https://your-api-gateway-url/Prod/health
```

### Test Authentication Flow
1. Open `https://your-app.vercel.app`
2. Click "Connect Wallet"
3. Sign the message
4. Verify JWT token is received

---

## 🎯 Quick Deployment Checklist

- [ ] Vercel account created
- [ ] Frontend deployed to Vercel
- [ ] Supabase project created
- [ ] Database migrations run
- [ ] Backend deployed to AWS Lambda
- [ ] Environment variables updated
- [ ] End-to-end test completed

---

## 🔗 Your Test URLs

After deployment, you'll have:

- **Frontend**: `https://fluxion-frontend-[random].vercel.app`
- **Backend API**: `https://[api-id].execute-api.[region].amazonaws.com/Prod`
- **Database**: Supabase dashboard at `supabase.com/dashboard/project/[project-ref]`

---

## 🆓 Cost Breakdown

| Service | Free Tier | Your Usage | Cost |
|---------|-----------|------------|------|
| Vercel | 100GB bandwidth | ~10GB | $0 |
| AWS Lambda | 1M requests | ~100K | $0 |
| API Gateway | 1M requests | ~100K | $0 |
| Supabase | 500MB storage | ~50MB | $0 |
| **Total** | | | **$0** |

---

## 🚨 Troubleshooting

### Frontend not connecting to backend?
- Check CORS settings in Lambda
- Verify environment variables in Vercel
- Check API Gateway URL is correct

### Database connection errors?
- Verify Supabase is not paused (free tier pauses after 1 week of inactivity)
- Check SSL is enabled in connection string
- Verify password is correct

### Lambda timeout?
- Increase timeout in SAM template (default is 30s)
- Check Supabase connection pooling
- Verify cold start optimization

---

## 📝 Notes

- Vercel provides automatic SSL certificates
- Supabase free tier pauses after 1 week of inactivity (can be resumed)
- AWS Lambda cold starts may cause initial request delays
- All services include generous free tiers perfect for testing

---

## Next Steps

Once test environment is working:
1. Set up custom domain (optional)
2. Configure monitoring dashboards
3. Set up CI/CD with GitHub Actions
4. Add error tracking (Sentry free tier)
5. Configure backup strategy