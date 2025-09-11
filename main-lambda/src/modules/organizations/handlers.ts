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
          u.role,
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

      // Get organization details
      const organization = await organizationRepository.findById(targetOrganizationId);

      logger.info('Organization users retrieved successfully', {
        organizationId: targetOrganizationId,
        userOrgId: tenantContext.tenantId,
        userCount: orgUsersResult.length,
        total,
        requestedBy: authUser.id,
        hasSearch: !!search,
        isCrossOrg: targetOrganizationId !== tenantContext.tenantId
      });

      res.success({
        users: orgUsersResult,
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
 * /organizations/my-organizations:
 *   get:
 *     tags:
 *       - Organizations
 *     summary: Get organizations where current user has roles
 *     description: |
 *       Returns all organizations where the authenticated user has any role or membership.
 *       Users can be members of multiple organizations in the RBAC system.
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
 *                   type: object
 *                   properties:
 *                     organizations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: '01HXYZ123456789ABCDEF000000'
 *                           name:
 *                             type: string
 *                             example: 'Acme Corporation'
 *                           slug:
 *                             type: string
 *                             example: 'acme-corporation-742d35cc'
 *                           role:
 *                             type: string
 *                             example: 'owner'
 *                           isActive:
 *                             type: boolean
 *                             example: true
 *                           joinedAt:
 *                             type: string
 *                             format: date-time
 *                             example: '2025-09-01T10:00:00Z'
 *                           permissions:
 *                             type: array
 *                             items:
 *                               type: string
 *                             example: ['invoice:create', 'invoice:read', 'user:read']
 *                 meta:
 *                   $ref: '#/components/schemas/ResponseMeta'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/my-organizations', 
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const userId = req.context!.userId!;
    
    try {
      // Get authenticated user by their wallet address
      const walletAddress = req.context!.walletAddress!;
      logger.info('Getting user by wallet address', { walletAddress, userId });
      
      const authUser = await usersService.getUserByWallet(tenantContext, walletAddress);
      logger.info('User found', { userId: authUser.id, organizationId: authUser.organizationId });
      
      // Get all organizations where user has roles using RBAC system
      logger.info('Getting user roles', { userId: authUser.id });
      const userRoles = await rbacService.getUserRoles(authUser.id);
      logger.info('User roles found', { roleCount: userRoles.length });
      
      // Group roles by organization and get organization details
      const organizationIds = [...new Set(userRoles.map(ur => ur.organizationId))];
      
      if (organizationIds.length === 0) {
        // User has no organization roles, return their primary organization
        const primaryOrg = await organizationRepository.findById(authUser.organizationId);
        
        return res.success({
          organizations: primaryOrg ? [{
            id: primaryOrg.id,
            name: primaryOrg.name,
            slug: primaryOrg.slug,
            role: authUser.role || 'member',
            isActive: primaryOrg.isActive,
            joinedAt: authUser.createdAt,
            permissions: []
          }] : []
        });
      }

      // Get organization details for all organizations where user has roles
      const organizationsWithRoles = await Promise.all(
        organizationIds.map(async (orgId) => {
          const organization = await organizationRepository.findById(orgId);
          if (!organization) return null;

          // Get user's roles and permissions for this organization
          const orgRoles = userRoles.filter(ur => ur.organizationId === orgId && !ur.isExpired);
          const permissions = await rbacService.getUserPermissions(authUser.id, orgId);

          // Determine primary role (highest priority role)
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
            isActive: organization.isActive,
            joinedAt: orgRoles[0]?.createdAt || authUser.createdAt,
            permissions: permissions.map(p => p.key)
          };
        })
      );

      const validOrganizations = organizationsWithRoles.filter(Boolean);

      logger.info('User organizations retrieved successfully', {
        userId: authUser.id,
        organizationCount: validOrganizations.length
      });

      res.success({
        organizations: validOrganizations
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
  })
);

export const organizationRoutes = router;