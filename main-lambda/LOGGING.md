# Fluxion Logging Configuration

This document explains the logging configuration for the Fluxion main lambda service.

## Log Levels

The application uses Winston for logging with the following levels:
- `error`: Critical errors that need immediate attention
- `warn`: Warning conditions that should be reviewed
- `info`: General informational messages about application flow
- `debug`: Detailed debugging information (verbose)

## Environment Configuration

### LOG_LEVEL
Controls the application log level:
```bash
# Production (recommended)
LOG_LEVEL=info

# Development with verbose debugging
LOG_LEVEL=debug

# Quiet development
LOG_LEVEL=warn
```

### DB_LOGGING
Controls TypeORM database query logging:
```bash
# Disable SQL logging (recommended for clean logs)
DB_LOGGING=false

# Enable SQL logging (for database debugging)
DB_LOGGING=true
```

## Custom TypeORM Logger

The application uses a custom TypeORM logger (`src/shared/utils/typeorm-logger.ts`) that:

### Filters Out Verbose Queries
- Schema introspection queries (`information_schema`, `pg_catalog`)
- Connection management queries (`START TRANSACTION`, `COMMIT`)
- Utility queries (`SELECT version()`, `current_schema()`)

### Logs Important Events
- Application SQL queries (CREATE, UPDATE, DELETE, SELECT from business tables)
- Slow queries with execution time
- Failed queries with error details
- Migration and schema build events

## Request Logging

Request logging is handled by middleware (`src/shared/middleware/index.ts`) and:

### Skips Routine Requests
- Health check endpoints (`/health`)
- API documentation (`/api-docs/*`)

### Logs Important Requests
- All API endpoints with method, path, and response time
- Authentication requests
- Business logic operations

## Log Format

All logs are output in JSON format for easy parsing:

```json
{
  "timestamp": "2025-09-04T14:37:22.360Z",
  "level": "info",
  "context": "UserHandlers",
  "message": "User authenticated via API",
  "requestId": "req-1756996642259-il9v7uj3k",
  "wallet_address": "0xFCAd0B19bB29D4674531d6f115237E16AfCE377c"
}
```

## Best Practices

### Development
```bash
# Clean development with minimal logs
LOG_LEVEL=info
DB_LOGGING=false

# Debugging specific issues
LOG_LEVEL=debug
DB_LOGGING=true
```

### Production
```bash
# Production should always use info level
LOG_LEVEL=info
DB_LOGGING=false
```

## Debugging Guide

### To Debug Authentication Issues
```bash
LOG_LEVEL=debug
# Check logs for "UserService", "BlockchainService" contexts
```

### To Debug Database Issues  
```bash
DB_LOGGING=true
LOG_LEVEL=debug
# Check logs for SQL queries and "TypeORM" context
```

### To Debug API Issues
```bash
LOG_LEVEL=info
# Check request/response logs with timing information
```