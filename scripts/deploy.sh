#!/bin/bash

# Fluxion Lambda Deployment Script
# Usage: ./scripts/deploy.sh [environment] [service] [command]
# Examples:
#   ./scripts/deploy.sh dev                    # Deploy all services to dev
#   ./scripts/deploy.sh prod main-service      # Deploy main-service to prod
#   ./scripts/deploy.sh staging admin-service build-only  # Build only

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="fluxion"
DEFAULT_ENV="dev"
DEFAULT_REGION="us-east-1"
STACK_PREFIX="${PROJECT_NAME}"

# Available services
SERVICES=("main-service" "admin-service")

# Available environments
ENVIRONMENTS=("dev" "staging" "production")

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

success() {
    echo -e "${GREEN}[SUCCESS] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

show_help() {
    cat << EOF
Fluxion Lambda Deployment Script

Usage: $0 [ENVIRONMENT] [SERVICE] [COMMAND]

ENVIRONMENTS:
  dev         Deploy to development environment
  staging     Deploy to staging environment
  production  Deploy to production environment

SERVICES:
  all            Deploy all services (default)
  main-service   Deploy main API service
  admin-service  Deploy admin service

COMMANDS:
  deploy      Build and deploy (default)
  build       Build only, no deployment
  package     Package for deployment
  validate    Validate SAM template
  delete      Delete CloudFormation stack

Examples:
  $0 dev                           # Deploy all services to dev
  $0 prod main-service            # Deploy main-service to production
  $0 staging admin-service build  # Build admin-service for staging
  $0 dev all validate             # Validate template for dev

Requirements:
  - AWS CLI configured
  - SAM CLI installed
  - Node.js 18.x or later
  - Docker (for local testing)

EOF
}

check_requirements() {
    log "Checking requirements..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        error "AWS CLI is not installed or not in PATH"
    fi
    
    # Check SAM CLI
    if ! command -v sam &> /dev/null; then
        error "SAM CLI is not installed or not in PATH"
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed or not in PATH"
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        error "Node.js version 18 or later is required (current: $(node --version))"
    fi
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        error "npm is not installed or not in PATH"
    fi
    
    # Check if we're in the project root
    if [ ! -f "package.json" ] || [ ! -d "services" ]; then
        error "Please run this script from the project root directory"
    fi
    
    success "All requirements satisfied"
}

validate_environment() {
    local env=$1
    if [[ ! " ${ENVIRONMENTS[@]} " =~ " ${env} " ]]; then
        error "Invalid environment: $env. Valid options: ${ENVIRONMENTS[*]}"
    fi
}

validate_service() {
    local service=$1
    if [ "$service" != "all" ] && [[ ! " ${SERVICES[@]} " =~ " ${service} " ]]; then
        error "Invalid service: $service. Valid options: all ${SERVICES[*]}"
    fi
}

setup_environment() {
    local env=$1
    log "Setting up environment for: $env"
    
    # Load environment-specific configuration
    ENV_FILE="deployment/environment-configs/${env}.env"
    if [ -f "$ENV_FILE" ]; then
        log "Loading environment variables from $ENV_FILE"
        set -a  # automatically export all variables
        source "$ENV_FILE"
        set +a
    else
        warn "Environment file not found: $ENV_FILE"
    fi
    
    # Set deployment parameters
    export ENVIRONMENT=$env
    export STACK_NAME="${STACK_PREFIX}-${env}"
    export S3_BUCKET="${PROJECT_NAME}-deployments-${env}-${AWS_REGION:-$DEFAULT_REGION}"
    export S3_PREFIX="lambda/${env}/$(date +%Y/%m/%d)"
    
    log "Environment: $ENVIRONMENT"
    log "Stack Name: $STACK_NAME"
    log "S3 Bucket: $S3_BUCKET"
    log "Region: ${AWS_REGION:-$DEFAULT_REGION}"
}

install_dependencies() {
    log "Installing project dependencies..."
    npm install
    success "Dependencies installed"
}

build_services() {
    local service=$1
    log "Building services..."
    
    if [ "$service" = "all" ]; then
        node scripts/lambda-build.js build
    else
        node scripts/lambda-build.js build "$service"
    fi
    
    success "Services built successfully"
}

validate_template() {
    log "Validating SAM template..."
    sam validate --template-file template.yaml
    success "Template validation passed"
}

create_s3_bucket() {
    local bucket=$1
    local region=${AWS_REGION:-$DEFAULT_REGION}
    
    log "Checking S3 bucket: $bucket"
    
    if ! aws s3 ls "s3://$bucket" &>/dev/null; then
        log "Creating S3 bucket: $bucket"
        if [ "$region" = "us-east-1" ]; then
            aws s3 mb "s3://$bucket"
        else
            aws s3 mb "s3://$bucket" --region "$region"
        fi
        success "S3 bucket created: $bucket"
    else
        log "S3 bucket already exists: $bucket"
    fi
}

package_services() {
    log "Packaging services for deployment..."
    
    create_s3_bucket "$S3_BUCKET"
    
    sam package \
        --template-file template.yaml \
        --s3-bucket "$S3_BUCKET" \
        --s3-prefix "$S3_PREFIX" \
        --output-template-file packaged-template.yaml
    
    success "Services packaged successfully"
}

deploy_stack() {
    local env=$1
    log "Deploying CloudFormation stack: $STACK_NAME"
    
    # Get VPC configuration for the environment
    PARAMETER_OVERRIDES="Environment=$env"
    
    if [ -n "$VPC_SECURITY_GROUP_IDS" ]; then
        PARAMETER_OVERRIDES="$PARAMETER_OVERRIDES VpcSecurityGroupIds=$VPC_SECURITY_GROUP_IDS"
    fi
    
    if [ -n "$VPC_SUBNET_IDS" ]; then
        PARAMETER_OVERRIDES="$PARAMETER_OVERRIDES VpcSubnetIds=$VPC_SUBNET_IDS"
    fi
    
    sam deploy \
        --template-file packaged-template.yaml \
        --stack-name "$STACK_NAME" \
        --parameter-overrides $PARAMETER_OVERRIDES \
        --capabilities CAPABILITY_IAM \
        --no-fail-on-empty-changeset \
        --region "${AWS_REGION:-$DEFAULT_REGION}" \
        --tags \
            Environment="$env" \
            Project="$PROJECT_NAME" \
            ManagedBy="SAM"
    
    success "Deployment completed successfully"
}

get_stack_outputs() {
    local stack_name=$1
    log "Getting stack outputs for: $stack_name"
    
    aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query 'Stacks[0].Outputs' \
        --output table \
        --region "${AWS_REGION:-$DEFAULT_REGION}"
}

delete_stack() {
    local stack_name=$1
    log "Deleting CloudFormation stack: $stack_name"
    
    read -p "Are you sure you want to delete stack '$stack_name'? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        aws cloudformation delete-stack \
            --stack-name "$stack_name" \
            --region "${AWS_REGION:-$DEFAULT_REGION}"
        
        log "Waiting for stack deletion to complete..."
        aws cloudformation wait stack-delete-complete \
            --stack-name "$stack_name" \
            --region "${AWS_REGION:-$DEFAULT_REGION}"
        
        success "Stack deleted successfully"
    else
        log "Stack deletion cancelled"
    fi
}

run_tests() {
    log "Running tests..."
    npm run test
    success "Tests passed"
}

main() {
    # Parse command line arguments
    local environment=${1:-$DEFAULT_ENV}
    local service=${2:-all}
    local command=${3:-deploy}
    
    # Show help if requested
    if [ "$1" = "-h" ] || [ "$1" = "--help" ] || [ "$1" = "help" ]; then
        show_help
        exit 0
    fi
    
    # Validate inputs
    validate_environment "$environment"
    validate_service "$service"
    
    log "Starting deployment process..."
    log "Environment: $environment"
    log "Service: $service"
    log "Command: $command"
    
    # Check requirements
    check_requirements
    
    # Setup environment
    setup_environment "$environment"
    
    # Execute command
    case $command in
        "deploy")
            install_dependencies
            build_services "$service"
            validate_template
            package_services
            deploy_stack "$environment"
            get_stack_outputs "$STACK_NAME"
            ;;
        "build")
            install_dependencies
            build_services "$service"
            validate_template
            ;;
        "package")
            package_services
            ;;
        "validate")
            validate_template
            ;;
        "delete")
            delete_stack "$STACK_NAME"
            ;;
        "test")
            run_tests
            ;;
        "outputs")
            get_stack_outputs "$STACK_NAME"
            ;;
        *)
            error "Unknown command: $command"
            ;;
    esac
    
    success "Operation completed successfully!"
}

# Run main function with all arguments
main "$@"