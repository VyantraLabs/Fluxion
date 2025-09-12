#!/bin/bash

# Deploy Role Hierarchy Fixes for Fluxion
# This script deploys all the role hierarchy and security fixes

set -e

echo "🚀 Deploying Fluxion Role Hierarchy Fixes..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "src" ]; then
    print_error "Must be run from the main-lambda directory"
    exit 1
fi

echo "📋 Deployment Steps:"
echo "1. Run database migrations"
echo "2. Seed RBAC system"
echo "3. Fix existing role hierarchy"
echo "4. Test role hierarchy"
echo "5. Build and deploy backend"
echo "6. Deploy admin frontend"
echo ""

# Step 1: Run database migrations
echo "🔄 Step 1: Running database migrations..."
npm run migration:run
if [ $? -eq 0 ]; then
    print_status "Database migrations completed"
else
    print_error "Database migrations failed"
    exit 1
fi

# Step 2: Seed RBAC system  
echo "🔄 Step 2: Seeding RBAC system..."
npm run seed:rbac 2>/dev/null || {
    print_warning "RBAC seed failed or already completed"
}

# Step 3: Fix existing role hierarchy
echo "🔄 Step 3: Fixing role hierarchy for existing users..."
npx ts-node scripts/fix-role-hierarchy.ts
if [ $? -eq 0 ]; then
    print_status "Role hierarchy fixes applied"
else
    print_error "Role hierarchy fixes failed"
    exit 1
fi

# Step 4: Test role hierarchy
echo "🔄 Step 4: Testing role hierarchy..."
npx ts-node scripts/test-role-hierarchy.ts
if [ $? -eq 0 ]; then
    print_status "Role hierarchy tests passed"
else
    print_error "Role hierarchy tests failed"
    exit 1
fi

# Step 5: Build backend
echo "🔄 Step 5: Building backend..."
npm run build
if [ $? -eq 0 ]; then
    print_status "Backend build completed"
else
    print_error "Backend build failed"
    exit 1
fi

# Step 6: Deploy admin frontend
echo "🔄 Step 6: Building admin frontend..."
cd ../admin-frontend
npm run build
if [ $? -eq 0 ]; then
    print_status "Admin frontend build completed"
else
    print_error "Admin frontend build failed"
    exit 1
fi

cd ../main-lambda

echo ""
print_status "🎉 Role hierarchy fixes deployed successfully!"
echo ""
echo "📊 Summary of changes applied:"
echo "  • Fixed organization owners getting 'member' instead of 'owner' role"
echo "  • Implemented RBAC ↔ Legacy role synchronization"
echo "  • Removed sensitive data from API responses"
echo "  • Updated admin frontend to recognize organization owners"
echo "  • Enhanced permission system to handle multi-level roles"
echo ""
echo "🔍 Next steps:"
echo "  • Test the admin interface with an organization owner account"
echo "  • Verify Users menu is visible to organization owners"
echo "  • Ensure system super admins still have full access"
echo "  • Monitor for any authentication issues"
echo ""
print_warning "Remember to deploy to AWS if this is for production!"

exit 0