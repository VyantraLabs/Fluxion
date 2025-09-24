# Base Path Configuration System

This document describes the configurable base path system implemented for all Fluxion microservices.

## Overview

The base path configuration system provides a consistent, environment-configurable way to organize API endpoints across all microservices. Each service gets a unique base path that includes API version and service identifier.

## Architecture

### Configuration Structure

All APIs follow this pattern:
```
/{API_PREFIX}/{API_VERSION}/{SERVICE_NAME}/{ENDPOINT}
```

Default configuration:
- **API_PREFIX**: `/api`
- **API_VERSION**: `v1`
- **SERVICE_NAME**: `main-service`, `admin-service`, `notification-service`

### Service Endpoints

Each service automatically gets these standardized endpoints:

#### Main Service (`/api/v1/main-service`)
- **Health**: `/api/v1/main-service/health`
- **Metrics**: `/api/v1/main-service/metrics`
- **Documentation**: `/api/v1/main-service/docs`
- **Service Info**: `/api/v1/main-service/info`
- **Business Endpoints**:
  - Invoices: `/api/v1/main-service/invoices`
  - Payments: `/api/v1/main-service/payments`
  - Users: `/api/v1/main-service/users`
  - Organizations: `/api/v1/main-service/organizations`
  - Templates: `/api/v1/main-service/templates`
  - Dashboard: `/api/v1/main-service/dashboard`
  - Config: `/api/v1/main-service/config`
  - Reminders: `/api/v1/main-service/reminders`

#### Admin Service (`/api/v1/admin-service`)
- **Health**: `/api/v1/admin-service/health`
- **Metrics**: `/api/v1/admin-service/metrics`
- **Documentation**: `/api/v1/admin-service/docs`
- **Service Info**: `/api/v1/admin-service/info`
- **Business Endpoints**:
  - Organizations: `/api/v1/admin-service/organizations`
  - Analytics: `/api/v1/admin-service/analytics`
  - Jobs: `/api/v1/admin-service/jobs`
  - Notifications: `/api/v1/admin-service/notifications`

## Environment Configuration

### Environment Variables

Configure base paths using these environment variables:

```bash
# Global API configuration
API_PREFIX=/api
API_VERSION=v1

# Individual service base paths (optional - will use defaults if not specified)
MAIN_SERVICE_BASE_PATH=/api/v1/main-service
ADMIN_SERVICE_BASE_PATH=/api/v1/admin-service
NOTIFICATION_SERVICE_BASE_PATH=/api/v1/notification-service

# Service ports
MAIN_SERVICE_PORT=3000
ADMIN_SERVICE_PORT=3001
NOTIFICATION_SERVICE_PORT=3002
```

### Environment-Specific Examples

#### Development
```bash
API_PREFIX=/api
API_VERSION=v1
MAIN_SERVICE_BASE_PATH=/api/v1/main-service
ADMIN_SERVICE_BASE_PATH=/api/v1/admin-service
```

#### Staging
```bash
API_PREFIX=/api
API_VERSION=v1
MAIN_SERVICE_BASE_PATH=/api/v1/main-service
ADMIN_SERVICE_BASE_PATH=/api/v1/admin-service
```

#### Production
```bash
API_PREFIX=/api
API_VERSION=v1
MAIN_SERVICE_BASE_PATH=/api/v1/main-service
ADMIN_SERVICE_BASE_PATH=/api/v1/admin-service
```

## Implementation Details

### Shared Library

The base path configuration is implemented in `@fluxion/shared-lib`:

#### `packages/fluxion-shared-lib/src/config/base-paths.ts`
- Contains configuration types and environment variable parsing
- Provides `getBasePathConfig()` and `getServiceBasePaths()` functions
- Includes validation and logging utilities

#### `packages/fluxion-shared-lib/src/config/router-factory.ts`
- Provides `ServiceRouter` class for consistent route mounting
- Includes helper functions for creating route modules
- Provides standardized health check and metrics handlers

### Service Integration

Each service uses the router factory:

```typescript
import { createServiceRouter, createRouteModule } from '@fluxion/shared-lib/config/router-factory';

// Create service router
const serviceRouter = createServiceRouter({
  serviceName: 'main', // or 'admin', 'notification'
  app,
  logger
});

// Setup standard endpoints (health, metrics, docs, info)
serviceRouter.setupServiceEndpoints({
  healthHandler: customHealthHandler,
  metricsHandler: createMetricsHandler('service-name'),
  swaggerSetup: (app, basePath) => setupSwagger(app, basePath)
});

// Mount business logic routes
serviceRouter.mountRoutes([
  createRouteModule('/invoices', invoiceRoutes, 'Invoice management'),
  createRouteModule('/payments', paymentRoutes, 'Payment processing'),
  // ... other routes
]);
```

### Legacy Compatibility

The system maintains backward compatibility:

- Root endpoints (`/`, `/health`, `/metrics`) still work
- Legacy environment variables (`API_BASE_PATH`, `ADMIN_BASE_PATH`) are supported
- Existing clients can continue using old paths during migration

## Benefits

### For Development
- **Clear Service Identification**: Each service has a distinct base path
- **Version Management**: API version is configurable across all services
- **Environment Flexibility**: Different paths for dev/staging/production
- **Consistent Structure**: All services follow the same pattern

### For Operations
- **Load Balancer Configuration**: Easy to route traffic by path prefix
- **Monitoring**: Service-specific metrics and health checks
- **Documentation**: Each service has its own Swagger docs
- **Debugging**: Clear service boundaries for troubleshooting

### For API Consumers
- **Predictable URLs**: Consistent pattern across all services
- **Service Discovery**: Easy to find service-specific documentation
- **Version Support**: Clear API versioning strategy
- **Health Monitoring**: Standardized health check endpoints

## Usage Examples

### cURL Examples

```bash
# Health checks
curl http://localhost:3000/api/v1/main-service/health
curl http://localhost:3001/api/v1/admin-service/health

# Service information
curl http://localhost:3000/api/v1/main-service/info
curl http://localhost:3001/api/v1/admin-service/info

# Business endpoints
curl http://localhost:3000/api/v1/main-service/invoices
curl http://localhost:3001/api/v1/admin-service/analytics

# Documentation
curl http://localhost:3000/api/v1/main-service/docs
curl http://localhost:3001/api/v1/admin-service/docs
```

### Frontend Integration

```typescript
// API client configuration
const API_CONFIG = {
  mainService: {
    baseURL: process.env.MAIN_SERVICE_BASE_PATH || '/api/v1/main-service',
    health: '/health',
    invoices: '/invoices',
    payments: '/payments'
  },
  adminService: {
    baseURL: process.env.ADMIN_SERVICE_BASE_PATH || '/api/v1/admin-service',
    health: '/health',
    organizations: '/organizations',
    analytics: '/analytics'
  }
};

// Usage
const invoices = await fetch(`${API_CONFIG.mainService.baseURL}${API_CONFIG.mainService.invoices}`);
const analytics = await fetch(`${API_CONFIG.adminService.baseURL}${API_CONFIG.adminService.analytics}`);
```

## Migration Guide

### For Existing Clients

1. **Immediate**: Continue using existing endpoints (legacy compatibility maintained)
2. **Gradual Migration**: Update clients to use new versioned paths
3. **Final Cutover**: Remove legacy endpoint support after migration complete

### For Load Balancers

```nginx
# Nginx configuration example
upstream main-service {
    server main-service:3000;
}

upstream admin-service {
    server admin-service:3001;
}

server {
    listen 80;
    
    # Route to main service
    location /api/v1/main-service/ {
        proxy_pass http://main-service;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Route to admin service
    location /api/v1/admin-service/ {
        proxy_pass http://admin-service;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Legacy support (optional)
    location /api/ {
        proxy_pass http://main-service;
    }
}
```

## Monitoring and Observability

### Health Check Aggregation

```bash
#!/bin/bash
# Health check script for all services

services=(
  "main-service:3000"
  "admin-service:3001"
)

for service in "${services[@]}"; do
  name=$(echo $service | cut -d: -f1)
  port=$(echo $service | cut -d: -f2)
  
  echo "Checking $name..."
  curl -f "http://localhost:$port/api/v1/$name/health" || echo "$name is unhealthy"
done
```

### Metrics Collection

Each service exposes metrics at `/{service-path}/metrics` in a consistent format for monitoring tools like Prometheus.

## Troubleshooting

### Common Issues

1. **404 on New Paths**: Ensure services are using the updated router factory
2. **Environment Variables**: Check that all required env vars are set
3. **Legacy Path Conflicts**: Verify legacy compatibility is configured correctly
4. **Load Balancer**: Update routing rules to include new service paths

### Debug Commands

```bash
# Test configuration
node test-base-paths.js

# Check service info
curl http://localhost:3000/api/v1/main-service/info

# Verify all endpoints
curl http://localhost:3000/api/v1/main-service/health
curl http://localhost:3000/api/v1/main-service/metrics
curl http://localhost:3000/api/v1/main-service/docs
```

## Future Enhancements

- **Service Discovery**: Automatic service registration and discovery
- **API Gateway Integration**: Native support for API gateways
- **Rate Limiting**: Per-service rate limiting configuration
- **Authentication**: Service-specific authentication policies
- **Monitoring**: Enhanced metrics and tracing integration