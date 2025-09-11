import { Router, Request, Response } from 'express';
import { AdminService } from './service';
import { Logger } from '@/shared/utils/logger';
import { 
  authenticateJWT, 
  validateRequest, 
  asyncHandler,
  adminOnly,
  requireSystemRole,
  requireSystemSuperAdmin,
  requireSystemAdmin
} from '@/shared/middleware';
import { requireSuperAdmin, requireAdmin, auditAdminOperation } from '@/shared/middleware/super-admin';
import { getTenantContext, extractTenantContext } from '@/shared/middleware/tenant';
import { adminAuthRoutes } from './auth.handlers';
import {
  CreateNetworkSchema,
  UpdateNetworkSchema,
  CreateTokenSchema,
  UpdateTokenSchema,
  NetworkIdSchema,
  TokenIdSchema
} from '@/shared/validation/admin';

const router = Router();
const adminService = new AdminService();
const logger = new Logger('AdminHandlers');

// Mount admin authentication routes (no middleware, handles auth internally)
router.use('/', adminAuthRoutes);

// All admin routes require authentication and admin privileges
router.use(authenticateJWT);
router.use(extractTenantContext());
router.use(adminOnly);

/**
 * @swagger
 * /admin/networks:
 *   get:
 *     tags:
 *       - Admin
 *     summary: List all networks (admin only)
 *     description: |
 *       Retrieves all blockchain networks including inactive ones.
 *       Only accessible to admin users.
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 *     responses:
 *       200:
 *         description: Networks retrieved successfully
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
 *                         format: uuid
 *                       name:
 *                         type: string
 *                       chainId:
 *                         type: integer
 *                       rpcUrl:
 *                         type: string
 *                       explorerUrl:
 *                         type: string
 *                       isActive:
 *                         type: boolean
 *                       isTestnet:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Admin access required
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/networks',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    
    const networks = await adminService.getAllNetworks(tenantContext);
    
    logger.info('Admin: All networks retrieved', { 
      count: networks.length,
      adminUser: tenantContext.userId
    });
    
    res.success(networks);
  })
);

/**
 * @swagger
 * /admin/networks:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Create new blockchain network (admin only)
 *     description: Adds a new blockchain network configuration
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - chainId
 *               - rpcUrl
 *               - explorerUrl
 *               - symbol
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Ethereum"
 *               chainId:
 *                 type: integer
 *                 example: 1
 *               rpcUrl:
 *                 type: string
 *                 format: uri
 *                 example: "https://mainnet.infura.io/v3/YOUR_API_KEY"
 *               explorerUrl:
 *                 type: string
 *                 format: uri
 *                 example: "https://etherscan.io"
 *               symbol:
 *                 type: string
 *                 example: "ETH"
 *               logoUrl:
 *                 type: string
 *                 format: uri
 *                 example: "https://assets.coingecko.com/coins/images/279/small/ethereum.png"
 *               isTestnet:
 *                 type: boolean
 *                 default: false
 *               isActive:
 *                 type: boolean
 *                 default: true
 *               gasSettings:
 *                 type: object
 *                 properties:
 *                   gasPrice:
 *                     type: string
 *                     example: "20000000000"
 *                   gasLimit:
 *                     type: string
 *                     example: "21000"
 *               multicallAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 example: "0xcA11bde05977b3631167028862bE2a173976CA11"
 *     responses:
 *       201:
 *         description: Network created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/BlockchainNetwork'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Admin access required
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/networks',
  validateRequest({ body: CreateNetworkSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    
    const network = await adminService.createNetwork(tenantContext, req.body);
    
    logger.info('Admin: Network created', { 
      networkId: network.id,
      name: network.name,
      chainId: network.chainId,
      adminUser: tenantContext.userId
    });
    
    res.success(network, 201);
  })
);

/**
 * @swagger
 * /admin/networks/{id}:
 *   put:
 *     tags:
 *       - Admin
 *     summary: Update blockchain network (admin only)
 *     description: Updates an existing blockchain network configuration
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Network UUID
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               rpcUrl:
 *                 type: string
 *                 format: uri
 *               explorerUrl:
 *                 type: string
 *                 format: uri
 *               logoUrl:
 *                 type: string
 *                 format: uri
 *               isActive:
 *                 type: boolean
 *               gasSettings:
 *                 type: object
 *                 properties:
 *                   gasPrice:
 *                     type: string
 *                   gasLimit:
 *                     type: string
 *               multicallAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *     responses:
 *       200:
 *         description: Network updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/BlockchainNetwork'
 *       404:
 *         description: Network not found
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Admin access required
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.put('/networks/:id',
  validateRequest({ 
    params: NetworkIdSchema,
    body: UpdateNetworkSchema 
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const networkId = req.params.id;
    
    const network = await adminService.updateNetwork(tenantContext, networkId, req.body);
    
    logger.info('Admin: Network updated', { 
      networkId: network.id,
      name: network.name,
      adminUser: tenantContext.userId
    });
    
    res.success(network);
  })
);

/**
 * @swagger
 * /admin/tokens:
 *   get:
 *     tags:
 *       - Admin
 *     summary: List all tokens (admin only)
 *     description: |
 *       Retrieves all tokens including inactive ones.
 *       Only accessible to admin users.
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 *     responses:
 *       200:
 *         description: Tokens retrieved successfully
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
 *                     $ref: '#/components/schemas/Token'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Admin access required
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/tokens',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    
    const tokens = await adminService.getAllTokens(tenantContext);
    
    logger.info('Admin: All tokens retrieved', { 
      count: tokens.length,
      adminUser: tenantContext.userId
    });
    
    res.success(tokens);
  })
);

/**
 * @swagger
 * /admin/tokens:
 *   post:
 *     tags:
 *       - Admin
 *     summary: Create new token (admin only)
 *     description: Adds a new token configuration
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - symbol
 *               - decimals
 *               - networkId
 *             properties:
 *               name:
 *                 type: string
 *                 example: "USD Coin"
 *               symbol:
 *                 type: string
 *                 example: "USDC"
 *               decimals:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 18
 *                 example: 6
 *               contractAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 example: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"
 *               networkId:
 *                 type: string
 *                 format: uuid
 *                 example: "1501e461-3295-4b7c-bd4a-a0643b7c9a93"
 *               isNative:
 *                 type: boolean
 *                 default: false
 *               isStablecoin:
 *                 type: boolean
 *                 default: false
 *               isActive:
 *                 type: boolean
 *                 default: true
 *               logoUrl:
 *                 type: string
 *                 format: uri
 *                 example: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png"
 *               coingeckoId:
 *                 type: string
 *                 example: "usd-coin"
 *     responses:
 *       201:
 *         description: Token created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Token'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Admin access required
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/tokens',
  validateRequest({ body: CreateTokenSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    
    const token = await adminService.createToken(tenantContext, req.body);
    
    logger.info('Admin: Token created', { 
      tokenId: token.id,
      name: token.name,
      symbol: token.symbol,
      networkId: token.networkId,
      adminUser: tenantContext.userId
    });
    
    res.success(token, 201);
  })
);

/**
 * @swagger
 * /admin/tokens/{id}:
 *   put:
 *     tags:
 *       - Admin
 *     summary: Update token (admin only)
 *     description: Updates an existing token configuration
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Token UUID
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               logoUrl:
 *                 type: string
 *                 format: uri
 *               isActive:
 *                 type: boolean
 *               isStablecoin:
 *                 type: boolean
 *               coingeckoId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Token'
 *       404:
 *         description: Token not found
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Admin access required
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.put('/tokens/:id',
  validateRequest({ 
    params: TokenIdSchema,
    body: UpdateTokenSchema 
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const tokenId = req.params.id;
    
    const token = await adminService.updateToken(tenantContext, tokenId, req.body);
    
    logger.info('Admin: Token updated', { 
      tokenId: token.id,
      name: token.name,
      symbol: token.symbol,
      adminUser: tenantContext.userId
    });
    
    res.success(token);
  })
);

// =============================================================================
// COMPREHENSIVE SYSTEM ADMIN ENDPOINTS
// =============================================================================

/**
 * System Statistics and Health
 */

/**
 * @swagger
 * /admin/system/stats:
 *   get:
 *     tags:
 *       - Admin System
 *     summary: Get comprehensive system statistics
 *     description: Retrieves platform-wide statistics including users, organizations, invoices, payments
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 *     responses:
 *       200:
 *         description: System statistics retrieved successfully
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
 *                     users:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         active:
 *                           type: integer
 *                         adminUsers:
 *                           type: integer
 *                         superAdminUsers:
 *                           type: integer
 *                         thisMonth:
 *                           type: integer
 *                     organizations:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         active:
 *                           type: integer
 *                         thisMonth:
 *                           type: integer
 *                     invoices:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         thisMonth:
 *                           type: integer
 *                         totalValue:
 *                           type: string
 *                         thisMonthValue:
 *                           type: string
 *                         averageValue:
 *                           type: string
 *                     payments:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         thisMonth:
 *                           type: integer
 *                         totalValue:
 *                           type: string
 *                         thisMonthValue:
 *                           type: string
 *                         successRate:
 *                           type: number
 */
router.get('/system/stats',
  auditAdminOperation('view_system_stats'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    
    const stats = await adminService.getSystemStats(tenantContext);
    
    logger.info('Admin: System statistics retrieved', {
      adminUser: tenantContext.userId,
      totalUsers: stats.users.total,
      totalOrganizations: stats.organizations.total
    });
    
    res.success(stats);
  })
);

/**
 * @swagger
 * /admin/system/health:
 *   get:
 *     tags:
 *       - Admin System
 *     summary: Get system health status
 *     description: Performs comprehensive health checks on database, Redis, external APIs, and storage
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 *     responses:
 *       200:
 *         description: System health check completed
 */
router.get('/system/health',
  auditAdminOperation('view_system_health'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    
    const health = await adminService.getSystemHealth(tenantContext);
    
    logger.info('Admin: System health check completed', {
      adminUser: tenantContext.userId,
      status: health.status
    });
    
    res.success(health);
  })
);

/**
 * @swagger
 * /admin/system/maintenance:
 *   post:
 *     tags:
 *       - Admin System
 *     summary: Toggle maintenance mode (super admin only)
 *     description: Enable or disable system-wide maintenance mode
 *     security:
 *       - bearerAuth: []
 *       - superAdminAccess: []
 */
router.post('/system/maintenance',
  requireSuperAdmin,
  auditAdminOperation('toggle_maintenance_mode'),
  validateRequest({
    body: {
      enabled: { type: 'boolean', required: true },
      message: { type: 'string', optional: true },
      estimatedDuration: { type: 'number', optional: true }
    }
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const { enabled, message, estimatedDuration } = req.body;
    
    const maintenanceMode = await adminService.toggleMaintenanceMode(
      tenantContext,
      enabled,
      message,
      estimatedDuration
    );
    
    logger.info('Admin: Maintenance mode toggled', {
      adminUser: tenantContext.userId,
      enabled
    });
    
    res.success(maintenanceMode);
  })
);

/**
 * Organization Management
 */

/**
 * @swagger
 * /admin/organizations:
 *   get:
 *     tags:
 *       - Admin Organizations
 *     summary: List all organizations with statistics
 *     description: Retrieves all organizations with usage statistics and activity data
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *         description: Search by organization name or slug
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [active, inactive, suspended]
 */
router.get('/organizations',
  auditAdminOperation('view_organizations'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const { limit = 50, offset = 0, search, status } = req.query;
    
    const result = await adminService.getAllOrganizations(
      tenantContext,
      parseInt(limit as string, 10),
      parseInt(offset as string, 10),
      search as string,
      status as 'active' | 'inactive' | 'suspended'
    );
    
    logger.info('Admin: Organizations retrieved', {
      adminUser: tenantContext.userId,
      count: result.organizations.length,
      total: result.total
    });
    
    res.success({
      organizations: result.organizations,
      pagination: {
        total: result.total,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10)
      }
    });
  })
);

/**
 * @swagger
 * /admin/organizations/{id}:
 *   get:
 *     tags:
 *       - Admin Organizations
 *     summary: Get organization details
 *     description: Retrieves detailed information about a specific organization
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 */
router.get('/organizations/:id',
  auditAdminOperation('view_organization_details'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const organizationId = req.params.id;
    
    const organization = await adminService.getOrganizationDetails(tenantContext, organizationId);
    
    logger.info('Admin: Organization details retrieved', {
      adminUser: tenantContext.userId,
      organizationId: organization.id,
      organizationName: organization.name
    });
    
    res.success(organization);
  })
);

/**
 * @swagger
 * /admin/organizations/{id}/users:
 *   get:
 *     tags:
 *       - Admin Organizations
 *     summary: Get organization users
 *     description: Retrieves all users belonging to a specific organization
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 */
router.get('/organizations/:id/users',
  auditAdminOperation('view_organization_users'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const organizationId = req.params.id;
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await adminService.getOrganizationUsers(
      tenantContext,
      organizationId,
      parseInt(limit as string, 10),
      parseInt(offset as string, 10)
    );
    
    logger.info('Admin: Organization users retrieved', {
      adminUser: tenantContext.userId,
      organizationId,
      count: result.users.length
    });
    
    res.success({
      users: result.users,
      pagination: {
        total: result.total,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10)
      }
    });
  })
);

/**
 * @swagger
 * /admin/organizations/{id}/activity:
 *   get:
 *     tags:
 *       - Admin Organizations
 *     summary: Get organization activity feed
 *     description: Retrieves activity logs for a specific organization
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 */
router.get('/organizations/:id/activity',
  auditAdminOperation('view_organization_activity'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const organizationId = req.params.id;
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await adminService.getOrganizationActivity(
      tenantContext,
      organizationId,
      parseInt(limit as string, 10),
      parseInt(offset as string, 10)
    );
    
    logger.info('Admin: Organization activity retrieved', {
      adminUser: tenantContext.userId,
      organizationId,
      count: result.logs.length
    });
    
    res.success({
      logs: result.logs,
      pagination: {
        total: result.total,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10)
      }
    });
  })
);

/**
 * User Management
 */

/**
 * @swagger
 * /admin/users:
 *   get:
 *     tags:
 *       - Admin Users
 *     summary: List all users with statistics
 *     description: Retrieves all users across organizations with usage statistics
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *         description: Search by email, name, or wallet address
 *       - name: organizationId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by organization ID
 *       - name: adminOnly
 *         in: query
 *         schema:
 *           type: boolean
 *         description: Show only admin users
 */
router.get('/users',
  auditAdminOperation('view_users'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const { 
      limit = 50, 
      offset = 0, 
      search, 
      organizationId, 
      adminOnly 
    } = req.query;
    
    const result = await adminService.getAllUsers(
      tenantContext,
      parseInt(limit as string, 10),
      parseInt(offset as string, 10),
      search as string,
      organizationId as string,
      adminOnly === 'true'
    );
    
    logger.info('Admin: Users retrieved', {
      adminUser: tenantContext.userId,
      count: result.users.length,
      total: result.total,
      adminOnly: adminOnly === 'true'
    });
    
    res.success({
      users: result.users,
      pagination: {
        total: result.total,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10)
      }
    });
  })
);

/**
 * @swagger
 * /admin/users/{id}/admin-status:
 *   put:
 *     tags:
 *       - Admin Users
 *     summary: Update user admin status (super admin only)
 *     description: Grant or revoke admin privileges for a user
 *     security:
 *       - bearerAuth: []
 *       - superAdminAccess: []
 */
router.put('/users/:id/admin-status',
  requireSuperAdmin,
  auditAdminOperation('update_user_admin_status'),
  validateRequest({
    body: {
      isAdmin: { type: 'boolean', required: true },
      isSuperAdmin: { type: 'boolean', optional: true },
      reason: { type: 'string', optional: true }
    }
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const userId = req.params.id;
    
    const updatedUser = await adminService.updateUserAdminStatus(
      tenantContext,
      userId,
      req.body
    );
    
    logger.info('Admin: User admin status updated', {
      adminUser: tenantContext.userId,
      targetUserId: updatedUser.id,
      isAdmin: updatedUser.isAdmin,
      isSuperAdmin: updatedUser.isSuperAdmin
    });
    
    res.success(updatedUser);
  })
);

/**
 * @swagger
 * /admin/users/{id}/activity:
 *   get:
 *     tags:
 *       - Admin Users
 *     summary: Get user activity audit trail
 *     description: Retrieves activity logs for a specific user
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 */
router.get('/users/:id/activity',
  auditAdminOperation('view_user_activity'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const userId = req.params.id;
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await adminService.getUserActivity(
      tenantContext,
      userId,
      parseInt(limit as string, 10),
      parseInt(offset as string, 10)
    );
    
    logger.info('Admin: User activity retrieved', {
      adminUser: tenantContext.userId,
      targetUserId: userId,
      count: result.logs.length
    });
    
    res.success({
      logs: result.logs,
      pagination: {
        total: result.total,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10)
      }
    });
  })
);

/**
 * Template Management
 */

/**
 * @swagger
 * /admin/templates:
 *   get:
 *     tags:
 *       - Admin Templates
 *     summary: Get all system templates
 *     description: Retrieves all system-wide templates with admin metadata
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 */
router.get('/templates',
  auditAdminOperation('view_system_templates'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    
    const templates = await adminService.getAllSystemTemplates(tenantContext);
    
    logger.info('Admin: System templates retrieved', {
      adminUser: tenantContext.userId,
      count: templates.length
    });
    
    res.success(templates);
  })
);

/**
 * @swagger
 * /admin/templates/{id}:
 *   put:
 *     tags:
 *       - Admin Templates
 *     summary: Update system template
 *     description: Updates a system-wide template
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 */
router.put('/templates/:id',
  auditAdminOperation('update_system_template'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const templateId = req.params.id;
    
    const updatedTemplate = await adminService.updateSystemTemplate(
      tenantContext,
      templateId,
      req.body
    );
    
    logger.info('Admin: System template updated', {
      adminUser: tenantContext.userId,
      templateId: updatedTemplate.id,
      templateName: updatedTemplate.name
    });
    
    res.success(updatedTemplate);
  })
);

/**
 * @swagger
 * /admin/templates/{id}/activate:
 *   post:
 *     tags:
 *       - Admin Templates
 *     summary: Toggle template activation status
 *     description: Activate or deactivate a system template
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 */
router.post('/templates/:id/activate',
  auditAdminOperation('toggle_template_status'),
  validateRequest({
    body: {
      isActive: { type: 'boolean', required: true }
    }
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const templateId = req.params.id;
    const { isActive } = req.body;
    
    const updatedTemplate = await adminService.toggleTemplateStatus(
      tenantContext,
      templateId,
      isActive
    );
    
    logger.info('Admin: Template status toggled', {
      adminUser: tenantContext.userId,
      templateId: updatedTemplate.id,
      isActive: updatedTemplate.isActive
    });
    
    res.success(updatedTemplate);
  })
);

/**
 * @swagger
 * /admin/templates/bulk-update:
 *   post:
 *     tags:
 *       - Admin Templates
 *     summary: Bulk template operations
 *     description: Perform bulk operations on multiple templates
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 */
router.post('/templates/bulk-update',
  auditAdminOperation('bulk_template_operation'),
  validateRequest({
    body: {
      templateIds: { type: 'array', items: { type: 'string' }, required: true },
      operation: { type: 'string', enum: ['activate', 'deactivate', 'delete'], required: true }
    }
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    
    const results = await adminService.bulkTemplateOperation(tenantContext, req.body);
    
    logger.info('Admin: Bulk template operation completed', {
      adminUser: tenantContext.userId,
      operation: req.body.operation,
      templateCount: req.body.templateIds.length,
      success: results.success,
      failed: results.failed
    });
    
    res.success(results);
  })
);

/**
 * System Settings
 */

/**
 * @swagger
 * /admin/settings:
 *   get:
 *     tags:
 *       - Admin Settings
 *     summary: Get system settings
 *     description: Retrieves system configuration settings
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 *     parameters:
 *       - name: category
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by settings category
 *       - name: publicOnly
 *         in: query
 *         schema:
 *           type: boolean
 *         description: Show only public settings
 */
router.get('/settings',
  auditAdminOperation('view_system_settings'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const { category, publicOnly } = req.query;
    
    const settings = await adminService.getSystemSettings(
      tenantContext,
      category as string,
      publicOnly === 'true'
    );
    
    logger.info('Admin: System settings retrieved', {
      adminUser: tenantContext.userId,
      count: settings.length,
      category
    });
    
    res.success(settings);
  })
);

/**
 * @swagger
 * /admin/settings/{key}:
 *   put:
 *     tags:
 *       - Admin Settings
 *     summary: Update system setting (super admin only)
 *     description: Updates a system configuration setting
 *     security:
 *       - bearerAuth: []
 *       - superAdminAccess: []
 */
router.put('/settings/:key',
  requireSuperAdmin,
  auditAdminOperation('update_system_setting'),
  validateRequest({
    body: {
      value: { required: true },
      description: { type: 'string', optional: true }
    }
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const key = req.params.key;
    
    const updatedSetting = await adminService.updateSystemSetting(
      tenantContext,
      key,
      req.body
    );
    
    logger.info('Admin: System setting updated', {
      adminUser: tenantContext.userId,
      key: updatedSetting.key
    });
    
    res.success(updatedSetting);
  })
);

/**
 * Activity Logs and Audit
 */

/**
 * @swagger
 * /admin/activity:
 *   get:
 *     tags:
 *       - Admin Activity
 *     summary: Get activity logs
 *     description: Retrieves comprehensive system activity logs
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *           default: 100
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *       - name: adminOnly
 *         in: query
 *         schema:
 *           type: boolean
 *         description: Show only admin operations
 *       - name: highRiskOnly
 *         in: query
 *         schema:
 *           type: boolean
 *         description: Show only high-risk operations
 *       - name: userId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - name: organizationId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by organization ID
 *       - name: action
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by action type
 *       - name: tableName
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by table name
 *       - name: severityLevel
 *         in: query
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         description: Filter by severity level
 *       - name: startDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter from start date
 *       - name: endDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter to end date
 */
router.get('/activity',
  auditAdminOperation('view_activity_logs'),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const { 
      limit = 100, 
      offset = 0, 
      adminOnly,
      highRiskOnly,
      userId,
      organizationId,
      action,
      tableName,
      severityLevel,
      startDate,
      endDate
    } = req.query;
    
    const filters = {
      adminOnly: adminOnly === 'true',
      highRiskOnly: highRiskOnly === 'true',
      userId: userId as string,
      organizationId: organizationId as string,
      action: action as string,
      tableName: tableName as string,
      severityLevel: severityLevel as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    };
    
    const result = await adminService.getActivityLogs(
      tenantContext,
      parseInt(limit as string, 10),
      parseInt(offset as string, 10),
      filters
    );
    
    logger.info('Admin: Activity logs retrieved', {
      adminUser: tenantContext.userId,
      count: result.logs.length,
      total: result.total,
      filters
    });
    
    res.success({
      logs: result.logs,
      pagination: {
        total: result.total,
        limit: parseInt(limit as string, 10),
        offset: parseInt(offset as string, 10)
      }
    });
  })
);

export const adminRoutes = router;