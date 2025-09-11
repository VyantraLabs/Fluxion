# RBAC Implementation Guide

This guide demonstrates how to implement the new Role-Based Access Control (RBAC) system in the Fluxion Web3 payment platform.

## Overview

The new RBAC system provides:
- **Granular Permissions**: Fine-grained control over application features
- **Flexible Roles**: System-wide and organization-scoped roles
- **Multiple Auth Methods**: JWT, API keys, wallet signatures with fallbacks
- **Migration Support**: Seamless transition from legacy admin flags
- **Comprehensive Testing**: Full test coverage for security validation

## Quick Start

### 1. Replace Authentication Middleware

**Before (Legacy):**
```typescript
// Old authentication
import { authenticateJWT, adminOnly } from '@/shared/middleware';

router.get('/invoices', authenticateJWT, adminOnly, getInvoices);
```

**After (Enhanced RBAC):**
```typescript
// New RBAC authentication
import { enhancedAuth, requirePermissions } from '@/shared/middleware/enhanced-auth';

router.get('/invoices', 
  enhancedAuth(),
  requirePermissions({ permissions: 'invoice:read_all' }),
  getInvoices
);
```

### 2. Use Permission-Based Authorization

```typescript
import { requirePermissions, requireRoles } from '@/shared/middleware/enhanced-auth';

// Single permission
router.post('/invoices', 
  enhancedAuth(),
  requirePermissions({ permissions: 'invoice:create' }),
  createInvoice
);

// Multiple permissions (any)
router.put('/invoices/:id', 
  enhancedAuth(),
  requirePermissions({ 
    permissions: ['invoice:update', 'invoice:read_all'],
    requireAll: false // User needs ANY of these permissions
  }),
  updateInvoice
);

// Multiple permissions (all)
router.delete('/invoices/:id', 
  enhancedAuth(),
  requirePermissions({ 
    permissions: ['invoice:delete', 'invoice:read_all'],
    requireAll: true // User needs ALL of these permissions
  }),
  deleteInvoice
);

// Role-based authorization
router.get('/admin/users', 
  enhancedAuth(),
  requireRoles(['admin', 'owner']),
  getUsers
);

// System admin only
import { requireSystemAdmin } from '@/shared/middleware/enhanced-auth';

router.get('/admin/system/networks', 
  enhancedAuth(),
  requireSystemAdmin(),
  getNetworks
);
```

## Permission Structure

### Invoice Management
```typescript
// Basic invoice operations
'invoice:create'     // Create new invoices
'invoice:read'       // Read own invoices  
'invoice:read_all'   // Read all org invoices
'invoice:update'     // Update invoices
'invoice:delete'     // Delete invoices
'invoice:send'       // Send invoices to clients
```

### Payment Processing
```typescript
'payment:initiate'   // Process payments
'payment:verify'     // Verify blockchain transactions
'payment:refund'     // Process refunds
```

### User Management
```typescript
'user:invite'        // Invite new users
'user:manage'        // Update user profiles
'user:remove'        // Remove users
'user:assign_roles'  // Assign/modify user roles
```

### Organization Settings
```typescript
'org:settings'       // Modify org settings
'org:branding'       // Update branding
'org:integrations'   // Manage integrations
'org:billing'        // Access billing
```

### System Administration
```typescript
'system:networks'    // Manage blockchain networks
'system:tokens'      // Manage supported tokens
'system:settings'    // System configuration
'system:audit'       // System audit logs
'system:cross_tenant' // Cross-organization access
```

## Role Hierarchy

### System Roles (Cross-Organization)
```typescript
SystemRoleKey.SUPER_ADMIN    // Full platform access
SystemRoleKey.SYSTEM_ADMIN   // Technical system ops
SystemRoleKey.SUPPORT_AGENT  // Customer support
```

### Organization Roles
```typescript
OrganizationRoleKey.OWNER    // Full org control + billing
OrganizationRoleKey.ADMIN    // User/settings management
OrganizationRoleKey.MANAGER  // Invoice/payment operations
OrganizationRoleKey.MEMBER   // Create/manage own invoices
OrganizationRoleKey.VIEWER   // Read-only access
OrganizationRoleKey.CLIENT   // External payment access
```

## Enhanced Authentication Service

### Standard Authentication
```typescript
import { EnhancedAuthService } from '@/modules/users/enhanced-auth.service';

const authService = new EnhancedAuthService();

// Standard authentication
const authResponse = await authService.authenticateWallet({
  wallet_address: '0x...',
  signature: '0x...',
  message: 'Sign this message...'
});
```

### Development Mode (Skip Signature)
```typescript
// Skip signature verification for development
const authResponse = await authService.authenticateWallet({
  wallet_address: '0x...',
  signature: '', // Can be empty
  message: ''   // Can be empty
}, {
  developmentMode: true, // NODE_ENV=development required
  createUserIfNotExists: true,
  defaultOrganizationRole: OrganizationRoleKey.ADMIN
});
```

### Auto-Create Users
```typescript
// Automatically create users on first login
const authResponse = await authService.authenticateWallet({
  wallet_address: '0x...',
  signature: '0x...',
  message: 'Sign this message...'
}, {
  createUserIfNotExists: true,
  defaultOrganizationRole: OrganizationRoleKey.MEMBER
});
```

## Migration Strategy

### 1. Run Database Migration
```bash
cd main-lambda
npm run migration:run
```

### 2. Initialize RBAC System
```bash
# Seeds roles, permissions, and migrates existing users
npm run seed:rbac
```

### 3. Update Route Handlers Gradually

**Phase 1: Critical Admin Routes**
```typescript
// High-security admin routes first
router.get('/admin/*', enhancedAuth(), requireSystemAdmin(), handler);
```

**Phase 2: User Management**
```typescript
// User operations with granular permissions
router.post('/users/invite', 
  enhancedAuth(), 
  requirePermissions({ permissions: 'user:invite' }), 
  inviteUser
);
```

**Phase 3: Business Logic Routes**
```typescript
// Invoice and payment operations
router.post('/invoices', 
  enhancedAuth(), 
  requirePermissions({ permissions: 'invoice:create' }), 
  createInvoice
);
```

### 4. Legacy Compatibility Mode

The system maintains backward compatibility during migration:

```typescript
// Legacy users automatically get RBAC roles assigned
// based on their existing role and admin flags

// is_super_admin -> SystemRoleKey.SUPER_ADMIN
// is_admin -> SystemRoleKey.SYSTEM_ADMIN  
// role: 'owner' -> OrganizationRoleKey.OWNER
// role: 'admin' -> OrganizationRoleKey.ADMIN
// etc.
```

## Programmatic Permission Checks

### In Service Layer
```typescript
import { RBACService } from '@/shared/services/rbac.service';

class InvoiceService {
  constructor(private rbacService: RBACService) {}

  async createInvoice(userId: string, invoiceData: any) {
    // Check permission programmatically
    const hasPermission = await this.rbacService.hasPermission(
      userId,
      'invoice:create',
      { organizationId: invoiceData.organizationId }
    );

    if (!hasPermission) {
      throw new Error('Insufficient permissions');
    }

    // Proceed with invoice creation
    // ...
  }
}
```

### In Request Handlers
```typescript
export const updateInvoice = async (req: Request, res: Response) => {
  const { auth } = req; // Contains user permissions and roles

  // Access user context
  console.log('User ID:', auth.userId);
  console.log('Permissions:', auth.permissions);
  console.log('Is System Admin:', auth.isSystemAdmin);

  // Additional permission checks if needed
  if (invoiceData.amount > 10000 && !auth.permissions.includes('invoice:high_value')) {
    return res.status(403).json({ error: 'High-value invoice permission required' });
  }

  // Continue with business logic
  // ...
};
```

## Role Management API

### Assign Roles
```typescript
import { RBACService } from '@/shared/services/rbac.service';

const rbacService = new RBACService(dataSource);

// Assign organization role
await rbacService.assignRole(
  userId,
  OrganizationRoleKey.ADMIN,
  organizationId,
  grantedByUserId,
  90 // Optional: expires in 90 days
);

// Assign system role
await rbacService.assignRole(
  userId,
  SystemRoleKey.SUPPORT_AGENT,
  undefined, // No organization for system roles
  grantedByUserId
);
```

### Remove Roles
```typescript
await rbacService.removeRole(
  userId,
  OrganizationRoleKey.ADMIN,
  organizationId
);
```

### Check User Permissions
```typescript
const userPermissions = await rbacService.getUserPermissions(
  userId,
  organizationId // Optional: filter by organization
);

console.log('Permissions:', userPermissions.permissions);
console.log('Roles:', userPermissions.roles);
console.log('Is System Admin:', userPermissions.isSystemAdmin);
```

## Testing Examples

### Permission Testing
```typescript
describe('Invoice Permissions', () => {
  test('admin can read all invoices', async () => {
    await rbacService.assignRole(userId, OrganizationRoleKey.ADMIN, orgId, userId);
    
    const hasPermission = await rbacService.hasPermission(
      userId, 
      'invoice:read_all',
      { organizationId: orgId }
    );
    
    expect(hasPermission).toBe(true);
  });

  test('viewer cannot create invoices', async () => {
    await rbacService.assignRole(userId, OrganizationRoleKey.VIEWER, orgId, userId);
    
    const hasPermission = await rbacService.hasPermission(
      userId, 
      'invoice:create',
      { organizationId: orgId }
    );
    
    expect(hasPermission).toBe(false);
  });
});
```

### Integration Testing
```typescript
describe('Invoice API with RBAC', () => {
  test('POST /invoices requires invoice:create permission', async () => {
    const token = await generateUserToken(viewerUserId); // Viewer role
    
    const response = await request(app)
      .post('/invoices')
      .set('Authorization', `Bearer ${token}`)
      .send(invoiceData);
    
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });
});
```

## Security Best Practices

### 1. Principle of Least Privilege
```typescript
// Give users minimum required permissions
// Default to MEMBER role, not ADMIN
const defaultRole = OrganizationRoleKey.MEMBER;
```

### 2. Organization Isolation
```typescript
// Always check organization context for business data
requirePermissions({ 
  permissions: 'invoice:read_all',
  organizationSpecific: true // Enforces organization context
})
```

### 3. System Admin Restrictions
```typescript
// Require explicit system permissions, don't rely on wildcards
requirePermissions({ 
  permissions: 'system:networks',
  allowSystemOverride: false // Prevent admin override
})
```

### 4. Audit Role Changes
```typescript
// All role assignments are logged with grantedBy and timestamp
await rbacService.assignRole(userId, role, orgId, adminUserId);
// Creates audit trail automatically
```

## Production Deployment Checklist

### 1. Database Setup
- [ ] Run migration: `npm run migration:run`
- [ ] Initialize RBAC: `npm run seed:rbac`
- [ ] Verify role assignments: Check user_roles table

### 2. Environment Configuration
```bash
# Required environment variables
JWT_SECRET=your-production-jwt-secret
NODE_ENV=production

# Optional: Enable development bypasses (DEV ONLY)
SKIP_SIGNATURE_VERIFICATION=false
```

### 3. Route Updates
- [ ] Update critical admin routes first
- [ ] Test user management endpoints
- [ ] Verify business logic permissions
- [ ] Update frontend permission checks

### 4. Monitoring
- [ ] Set up permission denial alerts
- [ ] Monitor authentication failure rates
- [ ] Track role assignment changes
- [ ] Audit system admin access

## Troubleshooting

### Common Issues

**1. "User permissions not found"**
```bash
# User may not have been migrated to RBAC
# Re-run the seed script
npm run seed:rbac
```

**2. "Permission denied" for existing admin**
```bash
# Check if user has proper RBAC roles
SELECT ur.*, r.key as role_key 
FROM user_roles ur 
JOIN roles r ON ur.role_id = r.id 
WHERE ur.user_id = 'your-user-id';
```

**3. Authentication failures in development**
```typescript
// Use development mode for testing
const authResponse = await authService.authenticateWallet(data, {
  developmentMode: true
});
```

**4. Cross-organization access issues**
```typescript
// Ensure user has system role for cross-org access
await rbacService.assignRole(
  userId, 
  SystemRoleKey.SUPPORT_AGENT, 
  undefined, 
  adminUserId
);
```

## Support

For issues or questions about the RBAC implementation:

1. Check the test files for usage examples
2. Review the RBACService methods for programmatic access
3. Examine the enhanced-auth middleware for route protection
4. Test with the comprehensive test suite

The RBAC system is designed to be backwards compatible while providing comprehensive security for the Fluxion platform.