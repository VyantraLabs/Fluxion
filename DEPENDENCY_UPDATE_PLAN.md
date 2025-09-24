# Fluxion Dependency Update Plan

## Overview
This document outlines the planned dependency updates for all Fluxion packages to their latest stable versions.

## Dependencies to Update

### Shared Library (@fluxion/shared-lib)

#### DevDependencies
- `@types/bcrypt`: 5.0.2 → 6.0.0
- `@types/express`: 4.17.23 → 5.0.3  
- `@types/jest`: 29.5.14 → 30.0.0
- `@typescript-eslint/eslint-plugin`: 6.21.0 → 8.44.1
- `@typescript-eslint/parser`: 6.21.0 → 8.44.1
- `eslint`: 8.57.1 → 9.36.0
- `jest`: 29.7.0 → 30.1.3
- `ts-jest`: 29.4.2 → 29.4.4

#### Dependencies
- `@aws-sdk/client-sqs`: 3.890.0 → 3.894.0
- `bcrypt`: 5.1.1 → 6.0.0 (Breaking change - requires testing)
- `dotenv`: 16.6.1 → 17.2.2
- `express`: 4.21.2 → 5.1.0 (Major version update - breaking changes)
- `helmet`: 7.2.0 → 8.1.0
- `ioredis`: 5.7.0 → 5.8.0
- `rate-limiter-flexible`: 3.0.6 → 7.3.2 (Major version update)

### Admin Service (@fluxion/admin-service)

#### DevDependencies
- `@types/ioredis`: 5.0.0 → 5.0.0 (No change)
- `@types/uuid`: 9.0.8 → 11.0.0
- `@typescript-eslint/eslint-plugin`: 8.44.0 → 8.44.1
- `@typescript-eslint/parser`: 8.44.0 → 8.44.1
- `eslint`: 9.35.0 → 9.36.0

### Root Workspace

#### DevDependencies
- `@types/node`: 20.19.16 → 24.5.2

## Breaking Changes to Review

### 1. Express 4.x → 5.x
- **Impact**: Major breaking changes in middleware, router behavior
- **Action Required**: Review all Express usage patterns
- **Risk**: High - core framework upgrade

### 2. bcrypt 5.x → 6.x
- **Impact**: Potential API changes in password hashing
- **Action Required**: Test authentication flows thoroughly
- **Risk**: Medium - affects user authentication

### 3. rate-limiter-flexible 3.x → 7.x
- **Impact**: Configuration and API changes
- **Action Required**: Update rate limiting configuration
- **Risk**: Medium - affects API protection

### 4. ESLint 8.x → 9.x
- **Impact**: Configuration format changes, new rules
- **Action Required**: Update ESLint configuration files
- **Risk**: Low - development tool only

### 5. Jest 29.x → 30.x
- **Impact**: Test configuration and API changes
- **Action Required**: Update test configurations and scripts
- **Risk**: Low - testing framework

## Update Strategy

### Phase 1: Low Risk Updates (Safe to update immediately)
```bash
# AWS SDK updates
pnpm update @aws-sdk/client-sqs --latest

# TypeScript types
pnpm update @types/node @types/uuid --latest

# Minor version updates
pnpm update dotenv helmet ioredis --latest

# ESLint tooling
pnpm update @typescript-eslint/eslint-plugin @typescript-eslint/parser --latest
```

### Phase 2: Medium Risk Updates (Requires testing)
```bash
# Update bcrypt with testing
pnpm update bcrypt --latest
# Test: Authentication flows, password hashing

# Update ESLint major version
pnpm update eslint --latest
# Action: Update .eslintrc configuration

# Update Jest and testing tools
pnpm update jest ts-jest @types/jest --latest
# Action: Update jest.config.js, test all test suites
```

### Phase 3: High Risk Updates (Staged deployment)
```bash
# Express major version update
pnpm update express @types/express --latest
# Action: Comprehensive testing of all endpoints

# Rate limiter major update
pnpm update rate-limiter-flexible --latest
# Action: Update rate limiting configuration and test
```

## Testing Checklist

### After Each Phase
- [ ] All services start successfully
- [ ] Authentication flows work correctly
- [ ] API endpoints respond properly
- [ ] Rate limiting functions correctly
- [ ] Tests pass (unit and integration)
- [ ] ESLint and TypeScript compilation passes
- [ ] Lambda deployment still works

### Specific Tests Required

#### Express 5.x Update
- [ ] Middleware execution order unchanged
- [ ] Route handlers function correctly
- [ ] Error handling middleware works
- [ ] Static file serving (if used)
- [ ] Request/response object changes

#### bcrypt 6.x Update
- [ ] Password hashing produces valid hashes
- [ ] Password verification works correctly
- [ ] Existing password hashes still validate
- [ ] Performance impact assessment

#### Rate Limiter 7.x Update
- [ ] Rate limiting triggers correctly
- [ ] Redis integration works
- [ ] Configuration format updated
- [ ] Error handling in rate limiter

## Rollback Plan

For each phase, maintain ability to rollback:

1. **Git Branching**: Create feature branch for each phase
2. **Package Lock**: Commit package-lock.json changes separately
3. **Version Pinning**: Keep specific versions in emergency rollback branch
4. **Testing**: Comprehensive testing before merging to main

## Recommended Execution

1. **Start with Phase 1** - Low risk updates first
2. **Test thoroughly** after each phase
3. **Update one major dependency at a time** in Phase 3
4. **Monitor production** after each deployment
5. **Keep rollback branch** ready for 48 hours post-deployment

## Commands for Execution

### Phase 1: Safe Updates
```bash
cd packages/fluxion-shared-lib
pnpm update @aws-sdk/client-sqs dotenv helmet ioredis --latest
cd ../../
pnpm update @types/node --latest
```

### Phase 2: Medium Risk
```bash
cd packages/fluxion-shared-lib
pnpm update @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint --latest
pnpm update jest ts-jest @types/jest --latest
pnpm update bcrypt --latest
```

### Phase 3: High Risk (One at a time)
```bash
# Update Express
cd packages/fluxion-shared-lib
pnpm update express @types/express --latest
# Test thoroughly before proceeding

# Update Rate Limiter
pnpm update rate-limiter-flexible --latest
# Update configuration and test
```

## Success Criteria

✅ All services start and respond correctly
✅ Authentication and authorization work
✅ Rate limiting functions properly  
✅ All tests pass
✅ Lambda deployment successful
✅ No performance degradation
✅ Security features intact

## Notes

- This update plan prioritizes stability over having the absolute latest versions
- Major version updates require careful review and testing
- Consider updating in development environment first
- Monitor error logs closely after production deployment
- Some dependencies might have security vulnerabilities that need immediate attention

Last Updated: September 23, 2025