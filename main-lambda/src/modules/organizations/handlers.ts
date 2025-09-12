import { Router, Request, Response } from 'express';
import { Logger } from '@/shared/utils/logger';
import { 
  authenticateJWT, 
  validateRequest, 
  asyncHandler 
} from '@/shared/middleware';
import { 
  extractTenantContext,
  requireTenantContext,
  getTenantContext
} from '@/shared/middleware/tenant';
import { RBACService } from '@/shared/services/rbac.service';
import { UsersService } from '@/shared/services/users.service';
import { repositories } from '@/database/repositories';
import { AppDataSource } from '@/database/data-source';

const router = Router();
const logger = new Logger('OrganizationHandlers');
const rbacService = new RBACService();
const usersService = new UsersService();
const organizationRepository = repositories.organizations;

// All organization routes require authentication and tenant context
router.use(authenticateJWT);
router.use(extractTenantContext());
router.use(requireTenantContext());

/**
 * @swagger
 * /organizations/{organizationId}/users:
 *   get:
 *     tags:
 *       - Organizations
 *     summary: Get users in organization
 *     description: |
 *       Returns all users within the specified organization.
 *       Requires RBAC permissions: 'org:users:read' or 'user:read'
 *       Regular users can see basic information about their organization members.
 *       Organization owners/admins can view users from organizations they manage.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: organizationId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: ulid
 *           pattern: '^[0-9A-HJKMNP-TV-Z]{26}$'
 *         description: The organization ID to view users from
 *         example: '01HXYZ123456789ABCDEF000000'
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Maximum number of users to return
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of users to skip
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *         description: Search by name, email, or wallet address
 *     responses:
 *       200:
 *         description: Organization users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: '01HXYZ123456789ABCDEF000001'
 *                           email:
 *                             type: string
 *                             example: 'user@example.com'
 *                           walletAddress:
 *                             type: string
 *                             example: '0x742d35Cc6635C0532925a3b8D0aC0199'
 *                           displayName:
 *                             type: string
 *                             example: 'John Doe'
 *                           role:
 *                             type: string
 *                             example: 'member'
 *                           isActive:
 *                             type: boolean
 *                             example: true
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                             example: '2025-09-01T10:00:00Z'
 *                           lastLoginAt:
 *                             type: string
 *                             format: date-time
 *                             example: '2025-09-09T08:30:00Z'
 *                     organization:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: '01HXYZ123456789ABCDEF000000'
 *                         name:
 *                           type: string
 *                           example: 'Acme Corporation'
 *                         slug:
 *                           type: string
 *                           example: 'acme-corporation-742d35cc'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 25
 *                         limit:
 *                           type: integer
 *                           example: 50
 *                         offset:
 *                           type: integer
 *                           example: 0
 *                 meta:
 *                   $ref: '#/components/schemas/ResponseMeta'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Insufficient permissions to view organization users
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/:organizationId/users', 
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const userId = req.context!.userId!;
    const { organizationId } = req.params;
    const { limit = 50, offset = 0, search } = req.query;
    
    // Validate organizationId format (ULID)
    if (!organizationId || !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(organizationId)) {
      return res.error('INVALID_REQUEST', 'Invalid organization ID format. Must be a valid ULID.', 400);
    }
    
    try {
      // Get authenticated user to verify they exist in the organization
      // userId in JWT context is actually the wallet address
      const walletAddress = req.context!.walletAddress!;
      const authUser = await usersService.getUserByWallet(tenantContext, walletAddress);
      
      // Use the organizationId from the path parameter
      const targetOrganizationId = organizationId;
      
      // Verify user has permission to view users in the target organization
      if (targetOrganizationId !== tenantContext.tenantId) {
        // User is trying to view a different organization - check cross-org permissions
        const canManageCrossOrg = await rbacService.hasPermission(
          authUser.id,
          ['system:cross_tenant', 'user:manage', 'org:users:read'],
          { 
            requireAll: false,
            organizationId: targetOrganizationId,
            allowSystemOverride: true 
          }
        );
        
        if (!canManageCrossOrg) {
          // Check if user has owner/admin role in the target organization via RBAC
          const userRoles = await rbacService.getUserRoles(authUser.id, targetOrganizationId);
          const hasManagementRole = userRoles.some(ur => 
            ['owner', 'admin', 'system_admin', 'super_admin'].includes(ur.role.key) && 
            !ur.isExpired
          );
          
          if (!hasManagementRole) {
            logger.warn('User lacks permission to view users in different organization', {
              userId: authUser.id,
              requestedOrgId: targetOrganizationId,
              userOrgId: tenantContext.tenantId
            });
            return res.error('FORBIDDEN', 'Insufficient permissions to view users in this organization', 403);
          }
        }
      } else {
        // Check permissions for user's own organization
        const hasPermission = await rbacService.hasPermission(
          authUser.id, 
          ['org:users:read', 'user:read'], 
          { 
            requireAll: false, // ANY permission is sufficient
            organizationId: targetOrganizationId,
            allowSystemOverride: true 
          }
        );

        if (!hasPermission) {
          logger.warn('User lacks permission to view organization users', {
            userId: authUser.id,
            organizationId: targetOrganizationId
          });
          return res.error('FORBIDDEN', 'Insufficient permissions to view organization users', 403);
        }
      }

      // Build search filter
      let searchFilter = '';
      let searchParams: any[] = [targetOrganizationId];
      
      if (search && typeof search === 'string') {
        searchFilter = `
          AND (
            u.email ILIKE $2
            OR CONCAT_WS(' ', u.first_name, u.last_name) ILIKE $2
            OR u.wallet_address ILIKE $2
          )
        `;
        searchParams.push(`%${search}%`);
      }

      // Query organization users with basic information (no sensitive admin details)
      const usersQuery = `
        SELECT 
          u.id,
          u.email,
          u.wallet_address as "walletAddress",
          u.first_name,
          u.last_name,
          CONCAT_WS(' ', u.first_name, u.last_name) as "displayName",
          u.is_active as "isActive",
          u.created_at as "createdAt",
          u.last_login_at as "lastLoginAt"
        FROM users u
        WHERE u.organization_id = $1 
          AND u.deleted_at IS NULL
          ${searchFilter}
        ORDER BY u.created_at DESC
        LIMIT ${parseInt(limit as string, 10)}
        OFFSET ${parseInt(offset as string, 10)}
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM users u
        WHERE u.organization_id = $1 
          AND u.deleted_at IS NULL
          ${searchFilter}
      `;

      const [orgUsersResult, countResult] = await Promise.all([
        AppDataSource.query(usersQuery, searchParams),
        AppDataSource.query(countQuery, searchParams.slice(0, searchParams.length === 1 ? 1 : 2))
      ]);

      const total = parseInt(countResult[0]?.total || '0', 10);

      // Enrich user data with roles from RBAC system
      const enrichedUsers = await Promise.all(
        orgUsersResult.map(async (user: any) => {
          try {
            // Get user's roles in this organization
            const userRoles = await rbacService.getUserRoles(user.id, targetOrganizationId);
            
            // Determine primary role (highest priority role)
            const roleHierarchy = ['super_admin', 'system_admin', 'support', 'owner', 'admin', 'member'];
            const primaryRole = userRoles.reduce((highest, current) => {
              const currentIndex = roleHierarchy.indexOf(current?.role?.key);
              const highestIndex = roleHierarchy.indexOf(highest);
              return currentIndex !== -1 && currentIndex < highestIndex ? current.role.key : highest;
            }, 'member');

            return {
              ...user,
              role: primaryRole
            };
          } catch (error: any) {
            logger.warn('Failed to get user role, defaulting to member', {
              userId: user.id,
              organizationId: targetOrganizationId,
              error: error.message
            });
            
            // Default to member role if RBAC lookup fails
            return {
              ...user,
              role: 'member'
            };
          }
        })
      );

      // Get organization details
      const organization = await organizationRepository.findById(targetOrganizationId);

      logger.info('Organization users retrieved successfully', {
        organizationId: targetOrganizationId,
        userOrgId: tenantContext.tenantId,
        userCount: enrichedUsers.length,
        total,
        requestedBy: authUser.id,
        hasSearch: !!search,
        isCrossOrg: targetOrganizationId !== tenantContext.tenantId
      });

      res.success({
        users: enrichedUsers,
        organization: organization ? {
          id: organization.id,
          name: organization.name,
          slug: organization.slug
        } : null,
        pagination: {
          total,
          limit: parseInt(limit as string, 10),
          offset: parseInt(offset as string, 10)
        }
      });

    } catch (error: any) {
      logger.error('Failed to retrieve organization users', {
        error: error.message,
        userId,
        organizationId: organizationId,
        userOrgId: tenantContext.tenantId,
        isCrossOrg: organizationId !== tenantContext.tenantId
      });
      
      if (error.code === 'NOT_FOUND') {
        return res.error('NOT_FOUND', 'User or organization not found', 404);
      }
      
      return res.error('INTERNAL_ERROR', 'Failed to retrieve organization users', 500);
    }
  })
);

/**
 * @swagger
 * /organizations:
 *   get:
 *     tags:
 *       - Organizations
 *     summary: Get organizations for authenticated user
 *     description: |
 *       Returns all organizations where the authenticated user has any role or membership.
 *       Uses JWT token to determine user context and filter organizations.
 *       Proper REST semantics - no hardcoded paths.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's organizations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         example: '01HXYZ123456789ABCDEF000000'
 *                       name:
 *                         type: string
 *                         example: 'Acme Corporation'
 *                       slug:
 *                         type: string
 *                         example: 'acme-corporation-742d35cc'
 *                       role:
 *                         type: string
 *                         example: 'owner'
 *                       userCount:
 *                         type: integer
 *                         example: 15
 *                       isActive:
 *                         type: boolean
 *                         example: true
 *                       joinedAt:
 *                         type: string
 *                         format: date-time
 *                         example: '2025-09-01T10:00:00Z'
 *                       permissions:
 *                         type: array
 *                         items:
 *                           type: string
 *                         example: ['invoice:create', 'invoice:read', 'user:read']
 *                 meta:
 *                   $ref: '#/components/schemas/ResponseMeta'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/', 
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const userId = req.context!.userId!;
    
    try {
      // Get authenticated user by their wallet address
      const walletAddress = req.context?.walletAddress;
      if (!walletAddress) {
        logger.error('No wallet address in request context', { userId });
        return res.error('UNAUTHORIZED', 'Invalid authentication context', 401);
      }
      
      logger.info('Getting user by wallet address', { walletAddress, userId });
      
      const authUser = await usersService.getUserByWallet(tenantContext, walletAddress);
      if (!authUser) {
        logger.error('User not found', { walletAddress, userId });
        return res.error('NOT_FOUND', 'User not found', 404);
      }
      
      logger.info('User found', { 
        userId: authUser.id, 
        organizationId: authUser.tenant_id || authUser.organization?.id || 'Unknown',
        hasOrganization: !!authUser.organization,
        organizationName: authUser.organization?.name || 'Unknown'
      });
      
      // Check if user has system admin permissions for global stats
      let hasSystemAdmin = false;
      try {
        hasSystemAdmin = await rbacService.hasPermission(
          authUser.id, 
          ['system:admin', 'system:cross_tenant', 'system:*'],
          { requireAll: false, allowSystemOverride: true }
        );
      } catch (error: any) {
        logger.warn('Failed to check system admin permissions', { 
          error: error.message, 
          userId: authUser.id 
        });
        // Continue without system admin privileges
      }

      // Get all organizations where user has roles using RBAC system
      logger.info('Getting user roles', { userId: authUser.id });
      let userRoles: any[] = [];
      try {
        userRoles = await rbacService.getUserRoles(authUser.id) || [];
        logger.info('User roles found', { roleCount: userRoles.length });
      } catch (error: any) {
        logger.error('Failed to get user roles', { 
          error: error.message, 
          userId: authUser.id 
        });
        // Continue with empty roles
      }
      
      // Group roles by organization and get organization details
      // Filter out system organizations (those starting with '0100...' or '0000...')
      const allOrganizationIds = [...new Set(userRoles.map(ur => ur?.organizationId).filter(Boolean))];
      const organizationIds = allOrganizationIds.filter(orgId => {
        // Exclude system organizations by ID pattern
        return orgId && 
               !orgId.startsWith('010000000000000000000000') && 
               !orgId.startsWith('00000000-0000-0000-0000');
      });
      
      if (organizationIds.length === 0) {
        // User has no organization roles, return their primary organization
        const primaryOrgId = authUser.tenant_id || authUser.organization?.id;
        
        if (!primaryOrgId) {
          logger.warn('No organization ID found for user', { 
            userId: authUser.id,
            tenant_id: authUser.tenant_id,
            organization: authUser.organization 
          });
          return res.success({
            organizations: [],
            globalStats: hasSystemAdmin ? await getGlobalStats() : undefined
          });
        }
        
        const primaryOrg = await organizationRepository.findById(primaryOrgId);
        
        if (!primaryOrg) {
          logger.warn('Primary organization not found', { 
            primaryOrgId,
            userId: authUser.id 
          });
          return res.success({
            organizations: [],
            globalStats: hasSystemAdmin ? await getGlobalStats() : undefined
          });
        }

        // Get enhanced stats for primary organization with error handling
        let userCount = 0;
        let invoiceCount = 0; 
        let revenue = 0;
        
        try {
          [userCount, invoiceCount, revenue] = await Promise.all([
            repositories.users.countByOrganization(primaryOrg.id).catch(() => 0),
            getInvoiceCount(primaryOrg.id).catch(() => 0),
            getOrganizationRevenue(primaryOrg.id).catch(() => 0)
          ]);
        } catch (error: any) {
          logger.warn('Failed to get organization stats', { 
            error: error.message, 
            organizationId: primaryOrg.id 
          });
        }
        
        const organizations = [{
          id: primaryOrg.id,
          name: primaryOrg.name,
          slug: primaryOrg.slug,
          role: 'member', // Default role since no RBAC roles found
          userCount,
          isActive: primaryOrg.isActive,
          joinedAt: authUser.created_at || new Date().toISOString(),
          permissions: [],
          stats: {
            user_count: userCount,
            invoice_count: invoiceCount,
            revenue: revenue
          }
        }];

        return res.success({
          organizations,
          globalStats: hasSystemAdmin ? await getGlobalStats() : undefined
        });
      }

      // Get organization details for all organizations where user has roles
      const organizationsWithRoles = await Promise.all(
        organizationIds.map(async (orgId) => {
          try {
            const organization = await organizationRepository.findById(orgId);
            if (!organization) {
              logger.warn('Organization not found', { orgId });
              return null;
            }

            // Get user's roles and permissions for this organization
            const orgRoles = userRoles.filter(ur => ur?.organizationId === orgId && !ur?.isExpired);
            
            let userPermissions: any = null;
            try {
              userPermissions = await rbacService.getUserPermissions(authUser.id, orgId);
            } catch (error: any) {
              logger.warn('Failed to get user permissions', { 
                error: error.message, 
                userId: authUser.id, 
                orgId 
              });
            }

            // Get enhanced stats for this organization with error handling
            let userCount = 0;
            let invoiceCount = 0;
            let revenue = 0;
            
            try {
              [userCount, invoiceCount, revenue] = await Promise.all([
                repositories.users.countByOrganization(orgId).catch(() => 0),
                getInvoiceCount(orgId).catch(() => 0),
                getOrganizationRevenue(orgId).catch(() => 0)
              ]);
            } catch (error: any) {
              logger.warn('Failed to get organization stats', { 
                error: error.message, 
                orgId 
              });
            }

            // Determine primary role (highest priority role)
            const roleHierarchy = ['super_admin', 'system_admin', 'support', 'owner', 'admin', 'member'];
            const primaryRole = orgRoles.reduce((highest, current) => {
              const currentIndex = roleHierarchy.indexOf(current?.role?.key);
              const highestIndex = roleHierarchy.indexOf(highest);
              return currentIndex !== -1 && currentIndex < highestIndex ? current.role.key : highest;
            }, 'member');

            return {
              id: organization.id,
              name: organization.name,
              slug: organization.slug,
              role: primaryRole,
              userCount,
              isActive: organization.isActive,
              joinedAt: orgRoles[0]?.createdAt || authUser.created_at || new Date().toISOString(),
              permissions: userPermissions ? userPermissions.permissions : [],
              stats: {
                user_count: userCount,
                invoice_count: invoiceCount,
                revenue: revenue
              }
            };
          } catch (error: any) {
            logger.error('Failed to process organization', { 
              error: error.message, 
              orgId 
            });
            return null;
          }
        })
      );

      const validOrganizations = organizationsWithRoles.filter(Boolean);

      logger.info('User organizations retrieved successfully', {
        userId: authUser.id,
        organizationCount: validOrganizations.length,
        hasSystemAdmin
      });

      // Return organizations with optional global stats for system admins
      res.success({
        organizations: validOrganizations,
        globalStats: hasSystemAdmin ? await getGlobalStats() : undefined
      });

    } catch (error: any) {
      logger.error('Failed to retrieve user organizations', {
        error: error.message,
        userId,
        organizationId: tenantContext?.tenantId
      });
      
      if (error.code === 'NOT_FOUND') {
        return res.error('NOT_FOUND', 'User not found', 404);
      }
      
      return res.error('INTERNAL_ERROR', 'Failed to retrieve user organizations', 500);
    }

    // Helper functions for organization statistics
    async function getInvoiceCount(organizationId: string): Promise<number> {
      try {
        const result = await AppDataSource.query(
          'SELECT COUNT(*) as count FROM invoices WHERE organization_id = $1 AND deleted_at IS NULL',
          [organizationId]
        );
        return parseInt(result[0]?.count || '0', 10);
      } catch (error) {
        logger.error('Failed to get invoice count', { error, organizationId });
        return 0;
      }
    }

    async function getOrganizationRevenue(organizationId: string): Promise<number> {
      try {
        const result = await AppDataSource.query(`
          SELECT COALESCE(SUM(p.amount), 0) as revenue
          FROM payments p
          INNER JOIN invoices i ON p.invoice_id = i.id
          WHERE i.organization_id = $1 
            AND p.status = 'completed'
            AND p.deleted_at IS NULL
            AND i.deleted_at IS NULL
        `, [organizationId]);
        return parseFloat(result[0]?.revenue || '0');
      } catch (error) {
        logger.error('Failed to get organization revenue', { error, organizationId });
        return 0;
      }
    }

    async function getGlobalStats() {
      try {
        const [userResult, invoiceResult, revenueResult] = await Promise.all([
          AppDataSource.query('SELECT COUNT(*) as count FROM users WHERE deleted_at IS NULL'),
          AppDataSource.query('SELECT COUNT(*) as count FROM invoices WHERE deleted_at IS NULL'),
          AppDataSource.query(`
            SELECT COALESCE(SUM(amount), 0) as revenue 
            FROM payments 
            WHERE status = 'completed' AND deleted_at IS NULL
          `)
        ]);

        return {
          totalUsers: parseInt(userResult[0]?.count || '0', 10),
          totalInvoices: parseInt(invoiceResult[0]?.count || '0', 10),
          totalRevenue: parseFloat(revenueResult[0]?.revenue || '0')
        };
      } catch (error) {
        logger.error('Failed to get global stats', { error });
        return {
          totalUsers: 0,
          totalInvoices: 0,
          totalRevenue: 0
        };
      }
    }
  })
);

/**
 * @swagger
 * /organizations/my-organizations:
 *   get:
 *     tags:
 *       - Organizations
 *     summary: Get organizations for authenticated user (DEPRECATED)
 *     description: |
 *       DEPRECATED: Use GET /organizations instead.
 *       Legacy endpoint for backward compatibility.
 *     deprecated: true
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User's organizations retrieved successfully (wrapped in organizations key)
 */
router.get('/my-organizations',
  asyncHandler(async (req: Request, res: Response) => {
    // Reuse the main organizations handler logic but wrap in organizations key for legacy compatibility
    const tenantContext = getTenantContext(req);
    const userId = req.context!.userId!;
    
    try {
      const walletAddress = req.context?.walletAddress;
      if (!walletAddress) {
        logger.error('No wallet address in request context', { userId });
        return res.error('UNAUTHORIZED', 'Invalid authentication context', 401);
      }
      
      const authUser = await usersService.getUserByWallet(tenantContext, walletAddress);
      if (!authUser) {
        logger.error('User not found', { walletAddress, userId });
        return res.error('NOT_FOUND', 'User not found', 404);
      }
      
      let userRoles: any[] = [];
      try {
        userRoles = await rbacService.getUserRoles(authUser.id) || [];
      } catch (error: any) {
        logger.warn('Failed to get user roles in legacy handler', { 
          error: error.message, 
          userId: authUser.id 
        });
      }
      
      const organizationIds = [...new Set(userRoles.map(ur => ur?.organizationId).filter(Boolean))];
      
      if (organizationIds.length === 0) {
        const primaryOrgId = authUser.tenant_id || authUser.organization?.id;
        
        if (!primaryOrgId) {
          return res.success({ organizations: [] });
        }
        
        const primaryOrg = await organizationRepository.findById(primaryOrgId);
        if (!primaryOrg) {
          return res.success({ organizations: [] });
        }

        const userCount = await repositories.users.countByOrganization(primaryOrg.id);
        return res.success({ 
          organizations: [{
            id: primaryOrg.id,
            name: primaryOrg.name,
            slug: primaryOrg.slug,
            role: 'member', // Default role since no RBAC roles found
            userCount,
            isActive: primaryOrg.isActive,
            joinedAt: authUser.created_at || new Date().toISOString(),
            permissions: []
          }] 
        });
      }

      const organizationsWithRoles = await Promise.all(
        organizationIds.map(async (orgId) => {
          const organization = await organizationRepository.findById(orgId);
          if (!organization) return null;

          const orgRoles = userRoles.filter(ur => ur.organizationId === orgId && !ur.isExpired);
          const userPermissions = await rbacService.getUserPermissions(authUser.id, orgId);
          const userCount = await repositories.users.countByOrganization(orgId);

          const roleHierarchy = ['super_admin', 'system_admin', 'support', 'owner', 'admin', 'member'];
          const primaryRole = orgRoles.reduce((highest, current) => {
            const currentIndex = roleHierarchy.indexOf(current.role.key);
            const highestIndex = roleHierarchy.indexOf(highest);
            return currentIndex < highestIndex ? current.role.key : highest;
          }, 'member');

          return {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            role: primaryRole,
            userCount,
            isActive: organization.isActive,
            joinedAt: orgRoles[0]?.createdAt || authUser.createdAt,
            permissions: userPermissions ? userPermissions.permissions : []
          };
        })
      );

      const validOrganizations = organizationsWithRoles.filter(Boolean);
      
      // Legacy format with organizations wrapper
      res.success({ organizations: validOrganizations });

    } catch (error: any) {
      logger.error('Failed to retrieve user organizations (legacy)', {
        error: error.message,
        userId
      });
      
      if (error.code === 'NOT_FOUND') {
        return res.error('NOT_FOUND', 'User not found', 404);
      }
      
      return res.error('INTERNAL_ERROR', 'Failed to retrieve user organizations', 500);
    }
  })
);

// =============================================================================
// ORGANIZATION USER MANAGEMENT ENDPOINTS
// =============================================================================

/**
 * @swagger
 * /organizations/{organizationId}/users/invite:
 *   post:
 *     tags:
 *       - Organizations
 *     summary: Invite user to organization (owner/org_admin only)
 *     description: Send invitation to a user to join the organization
 *     security:
 *       - bearerAuth: []
 */
router.post('/:organizationId/users/invite',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const userId = req.context!.userId!;
    const { organizationId } = req.params;
    const { email, roleKey, message } = req.body;
    
    try {
      const walletAddress = req.context!.walletAddress!;
      const authUser = await usersService.getUserByWallet(tenantContext, walletAddress);
      
      // Check permissions
      const hasPermission = await rbacService.hasPermission(
        authUser.id,
        ['user:invite', 'org:admin'],
        { requireAll: false, organizationId, allowSystemOverride: true }
      );
      
      if (!hasPermission) {
        return res.error('FORBIDDEN', 'Insufficient permissions to invite users', 403);
      }
      
      // Use organization service to send invitation
      const invitation = await usersService.inviteUserToOrganization(
        tenantContext,
        organizationId,
        email,
        roleKey || 'member',
        authUser.id,
        message
      );
      
      logger.info('User invitation sent', {
        organizationId,
        email,
        roleKey,
        invitedBy: authUser.id
      });
      
      res.success(invitation, 201);
      
    } catch (error: any) {
      logger.error('Failed to invite user', {
        error: error.message,
        organizationId,
        email,
        userId
      });
      
      return res.error('INTERNAL_ERROR', 'Failed to send invitation', 500);
    }
  })
);

/**
 * @swagger
 * /organizations/{organizationId}/users/{userId}/roles:
 *   put:
 *     tags:
 *       - Organizations
 *     summary: Change user organization roles (owner/org_admin only)
 *     description: Update user's role within the organization
 *     security:
 *       - bearerAuth: []
 */
router.put('/:organizationId/users/:targetUserId/roles',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const { organizationId, targetUserId } = req.params;
    const { roleKey, reason } = req.body;
    
    try {
      const walletAddress = req.context!.walletAddress!;
      const authUser = await usersService.getUserByWallet(tenantContext, walletAddress);
      
      // Check permissions
      const hasPermission = await rbacService.hasPermission(
        authUser.id,
        ['user:manage', 'org:admin'],
        { requireAll: false, organizationId, allowSystemOverride: true }
      );
      
      if (!hasPermission) {
        return res.error('FORBIDDEN', 'Insufficient permissions to change user roles', 403);
      }
      
      // Change user role
      await rbacService.assignRole(targetUserId, roleKey, organizationId, authUser.id);
      
      logger.info('User role changed', {
        organizationId,
        targetUserId,
        roleKey,
        changedBy: authUser.id,
        reason
      });
      
      res.success({ success: true });
      
    } catch (error: any) {
      logger.error('Failed to change user role', {
        error: error.message,
        organizationId,
        targetUserId,
        roleKey
      });
      
      return res.error('INTERNAL_ERROR', 'Failed to change user role', 500);
    }
  })
);

/**
 * @swagger
 * /organizations/{organizationId}/users/{userId}:
 *   delete:
 *     tags:
 *       - Organizations
 *     summary: Remove user from organization (owner/org_admin only)
 *     description: Remove a user from the organization
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:organizationId/users/:targetUserId',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const { organizationId, targetUserId } = req.params;
    const { reason } = req.body;
    
    try {
      const walletAddress = req.context!.walletAddress!;
      const authUser = await usersService.getUserByWallet(tenantContext, walletAddress);
      
      // Check permissions
      const hasPermission = await rbacService.hasPermission(
        authUser.id,
        ['user:manage', 'org:admin'],
        { requireAll: false, organizationId, allowSystemOverride: true }
      );
      
      if (!hasPermission) {
        return res.error('FORBIDDEN', 'Insufficient permissions to remove users', 403);
      }
      
      // Remove all user roles from the organization
      const userRoles = await rbacService.getUserRoles(targetUserId, organizationId);
      for (const userRole of userRoles) {
        await rbacService.removeRole(targetUserId, userRole.role.key, organizationId);
      }
      
      logger.info('User removed from organization', {
        organizationId,
        targetUserId,
        removedBy: authUser.id,
        reason
      });
      
      res.success({ success: true });
      
    } catch (error: any) {
      logger.error('Failed to remove user from organization', {
        error: error.message,
        organizationId,
        targetUserId
      });
      
      return res.error('INTERNAL_ERROR', 'Failed to remove user from organization', 500);
    }
  })
);

/**
 * @swagger
 * /organizations/summary:
 *   get:
 *     tags:
 *       - Organizations
 *     summary: Get organizations summary for current user
 *     description: Get organizations with user counts (for owners)
 *     security:
 *       - bearerAuth: []
 */
router.get('/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    
    try {
      const walletAddress = req.context!.walletAddress!;
      const authUser = await usersService.getUserByWallet(tenantContext, walletAddress);
      
      // Get user's organizations
      const userRoles = await rbacService.getUserRoles(authUser.id);
      const organizationIds = [...new Set(userRoles.map(ur => ur.organizationId))];
      
      // Get organization summaries
      const summaries = await Promise.all(
        organizationIds.map(async (orgId) => {
          const organization = await organizationRepository.findById(orgId);
          if (!organization) return null;
          
          // Get user count
          const userCount = await repositories.users.countByOrganization(orgId);
          
          // Get user's role
          const orgRoles = userRoles.filter(ur => ur.organizationId === orgId && !ur.isExpired);
          const primaryRole = orgRoles[0]?.role?.key || 'member';
          
          return {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
            userCount,
            role: primaryRole,
            isActive: organization.isActive
          };
        })
      );
      
      const validSummaries = summaries.filter(Boolean);
      
      logger.info('Organization summaries retrieved', {
        userId: authUser.id,
        organizationCount: validSummaries.length
      });
      
      res.success({ organizations: validSummaries });
      
    } catch (error: any) {
      logger.error('Failed to retrieve organization summaries', {
        error: error.message
      });
      
      return res.error('INTERNAL_ERROR', 'Failed to retrieve organization summaries', 500);
    }
  })
);

/**
 * @swagger
 * /organizations/{organizationId}/activity:
 *   get:
 *     tags:
 *       - Organizations
 *     summary: Get organization activity logs
 *     description: |
 *       Returns activity logs for the specified organization.
 *       Requires appropriate permissions to view organization activity.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: organizationId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: ulid
 *         description: The organization ID
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Maximum number of activity logs to return
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of activity logs to skip
 *     responses:
 *       200:
 *         description: Organization activity logs retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     activities:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           action:
 *                             type: string
 *                           entity_type:
 *                             type: string
 *                           entity_id:
 *                             type: string
 *                           user_id:
 *                             type: string
 *                           user:
 *                             type: object
 *                             properties:
 *                               wallet_address:
 *                                 type: string
 *                               display_name:
 *                                 type: string
 *                           metadata:
 *                             type: object
 *                           created_at:
 *                             type: string
 *                             format: date-time
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         offset:
 *                           type: integer
 */
router.get('/:organizationId/activity',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const { organizationId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    // Validate organizationId format (ULID)
    if (!organizationId || !/^[0-9A-HJKMNP-TV-Z]{26}$/.test(organizationId)) {
      return res.error('INVALID_REQUEST', 'Invalid organization ID format. Must be a valid ULID.', 400);
    }
    
    try {
      const walletAddress = req.context!.walletAddress!;
      const authUser = await usersService.getUserByWallet(tenantContext, walletAddress);
      
      // Check if user has permission to view organization activity
      let hasPermission = false;
      
      if (organizationId === tenantContext.tenantId) {
        // Same organization - check basic permissions
        hasPermission = await rbacService.hasPermission(
          authUser.id,
          ['org:activity:read', 'org:audit:read', 'activity:read'],
          { requireAll: false, organizationId, allowSystemOverride: true }
        );
      } else {
        // Different organization - check cross-org permissions
        hasPermission = await rbacService.hasPermission(
          authUser.id,
          ['system:cross_tenant', 'system:admin', 'org:activity:read'],
          { requireAll: false, organizationId, allowSystemOverride: true }
        );
        
        if (!hasPermission) {
          // Check if user has admin role in target organization
          const userRoles = await rbacService.getUserRoles(authUser.id, organizationId);
          hasPermission = userRoles.some(ur => 
            ['owner', 'admin', 'system_admin'].includes(ur.role.key) && !ur.isExpired
          );
        }
      }
      
      if (!hasPermission) {
        logger.warn('User lacks permission to view organization activity', {
          userId: authUser.id,
          organizationId,
          userOrgId: tenantContext.tenantId
        });
        return res.error('FORBIDDEN', 'Insufficient permissions to view organization activity', 403);
      }

      // Query organization activity logs
      const activitiesQuery = `
        SELECT 
          al.id,
          al.action,
          al.table_name as entity_type,
          al.record_id as entity_id,
          al.user_id,
          al.metadata,
          al.created_at,
          u.wallet_address,
          CONCAT_WS(' ', u.first_name, u.last_name) as display_name
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.organization_id = $1
        ORDER BY al.created_at DESC
        LIMIT ${parseInt(limit as string, 10)}
        OFFSET ${parseInt(offset as string, 10)}
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM audit_logs al
        WHERE al.organization_id = $1
      `;

      const [activitiesResult, countResult] = await Promise.all([
        AppDataSource.query(activitiesQuery, [organizationId]),
        AppDataSource.query(countQuery, [organizationId])
      ]);

      const total = parseInt(countResult[0]?.total || '0', 10);

      // Format activities with user information
      const activities = activitiesResult.map((activity: any) => ({
        id: activity.id,
        action: activity.action,
        entity_type: activity.entity_type,
        entity_id: activity.entity_id,
        user_id: activity.user_id,
        user: activity.wallet_address ? {
          wallet_address: activity.wallet_address,
          display_name: activity.display_name || 'Unknown User'
        } : null,
        metadata: activity.metadata || {},
        created_at: activity.created_at
      }));

      logger.info('Organization activity retrieved successfully', {
        organizationId,
        activityCount: activities.length,
        total,
        requestedBy: authUser.id
      });

      res.success({
        activities,
        pagination: {
          total,
          limit: parseInt(limit as string, 10),
          offset: parseInt(offset as string, 10)
        }
      });

    } catch (error: any) {
      logger.error('Failed to retrieve organization activity', {
        error: error.message,
        organizationId,
        userId: req.context?.userId
      });
      
      return res.error('INTERNAL_ERROR', 'Failed to retrieve organization activity', 500);
    }
  })
);

export const organizationRoutes = router;