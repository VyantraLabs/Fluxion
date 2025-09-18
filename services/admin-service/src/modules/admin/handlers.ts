import { Router, Request, Response } from 'express';
import { AdminService } from './service';
import { Logger } from '@fluxion/shared-lib/utils/logger';
import { 
  authenticateJWT, 
  validateRequest, 
  asyncHandler
} from '@fluxion/shared-lib/middleware';
import { permissionMiddleware } from '../../shared/utils/permissions';
import { getTenantContext, extractTenantContext } from '../../shared/middleware/tenant';
import { adminAuthRoutes } from './auth.handlers';
import {
  CreateNetworkSchema,
  UpdateNetworkSchema,
  CreateTokenSchema,
  UpdateTokenSchema,
  NetworkIdSchema,
  TokenIdSchema
} from '../../shared/validation/admin';

const router = Router();
const adminService = new AdminService();
const logger = new Logger('AdminHandlers');

// Mount admin authentication routes (no middleware, handles auth internally)
router.use('/', adminAuthRoutes);

// All admin routes require authentication and admin privileges
router.use(authenticateJWT);
router.use(extractTenantContext());
router.use(permissionMiddleware.requireUserManagement);

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
  permissionMiddleware.requireSuperAdmin,
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
  permissionMiddleware.requireSuperAdmin,
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

// =============================================================================
// EXTENDED USER AND ORGANIZATION MANAGEMENT
// =============================================================================

/**
 * @swagger
 * /admin/organizations/{id}/users/{userId}/roles:
 *   post:
 *     tags:
 *       - Admin Organizations
 *     summary: Change user roles in organization (admin/super_admin only)
 *     description: Assign or change user roles within a specific organization
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 */
router.post('/organizations/:id/users/:userId/roles',
  permissionMiddleware.requireUserManagement,
  validateRequest({
    body: {
      roleKey: { type: 'string', required: true },
      action: { type: 'string', enum: ['assign', 'revoke'], required: true },
      reason: { type: 'string', optional: true }
    }
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const organizationId = req.params.id;
    const targetUserId = req.params.userId;
    const { roleKey, action, reason } = req.body;
    
    const result = await adminService.changeUserOrganizationRole(
      tenantContext,
      organizationId,
      targetUserId,
      roleKey,
      action,
      reason
    );
    
    logger.info('Admin: User organization role changed', {
      adminUser: tenantContext.userId,
      organizationId,
      targetUserId,
      roleKey,
      action,
      reason
    });
    
    res.success(result);
  })
);

/**
 * @swagger
 * /admin/organizations/{id}/users/{userId}:
 *   delete:
 *     tags:
 *       - Admin Organizations
 *     summary: Remove user from organization (admin/super_admin only)
 *     description: Remove a user from a specific organization
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 */
router.delete('/organizations/:id/users/:userId',
  permissionMiddleware.requireUserManagement,
  validateRequest({
    body: {
      reason: { type: 'string', optional: true }
    }
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const organizationId = req.params.id;
    const targetUserId = req.params.userId;
    const { reason } = req.body;
    
    await adminService.removeUserFromOrganization(
      tenantContext,
      organizationId,
      targetUserId,
      reason
    );
    
    logger.info('Admin: User removed from organization', {
      adminUser: tenantContext.userId,
      organizationId,
      targetUserId,
      reason
    });
    
    res.success({ success: true });
  })
);

/**
 * @swagger
 * /admin/users/{id}/organizations:
 *   get:
 *     tags:
 *       - Admin Users
 *     summary: Get user's organizations
 *     description: Retrieves all organizations a user belongs to
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 */
router.get('/users/:id/organizations',
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const userId = req.params.id;
    
    const organizations = await adminService.getUserOrganizations(tenantContext, userId);
    
    logger.info('Admin: User organizations retrieved', {
      adminUser: tenantContext.userId,
      targetUserId: userId,
      count: organizations.length
    });
    
    res.success(organizations);
  })
);

/**
 * @swagger
 * /admin/users/{id}/roles:
 *   put:
 *     tags:
 *       - Admin Users
 *     summary: Change user system/org roles (admin/super_admin only)
 *     description: Assign or revoke system-wide or organization-specific roles
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 */
router.put('/users/:id/roles',
  permissionMiddleware.requireUserManagement,
  validateRequest({
    body: {
      systemRoles: { 
        type: 'array', 
        items: { 
          type: 'object',
          properties: {
            roleKey: { type: 'string', required: true },
            action: { type: 'string', enum: ['assign', 'revoke'], required: true }
          }
        },
        optional: true 
      },
      organizationRoles: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            organizationId: { type: 'string', required: true },
            roleKey: { type: 'string', required: true },
            action: { type: 'string', enum: ['assign', 'revoke'], required: true }
          }
        },
        optional: true
      },
      reason: { type: 'string', optional: true }
    }
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const targetUserId = req.params.id;
    const { systemRoles, organizationRoles, reason } = req.body;
    
    const result = await adminService.changeUserRoles(
      tenantContext,
      targetUserId,
      { systemRoles, organizationRoles },
      reason
    );
    
    logger.info('Admin: User roles changed', {
      adminUser: tenantContext.userId,
      targetUserId,
      systemRoleChanges: systemRoles?.length || 0,
      orgRoleChanges: organizationRoles?.length || 0,
      reason
    });
    
    res.success(result);
  })
);

/**
 * @swagger
 * /admin/users/{id}:
 *   delete:
 *     tags:
 *       - Admin Users
 *     summary: Remove user from system (admin/super_admin only)
 *     description: Completely remove a user from the Fluxion system
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 */
router.delete('/users/:id',
  permissionMiddleware.requireUserManagement,
  validateRequest({
    body: {
      reason: { type: 'string', required: true },
      deleteData: { type: 'boolean', optional: true, default: false }
    }
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const targetUserId = req.params.id;
    const { reason, deleteData } = req.body;
    
    await adminService.removeUserFromSystem(
      tenantContext,
      targetUserId,
      reason,
      deleteData || false
    );
    
    logger.info('Admin: User removed from system', {
      adminUser: tenantContext.userId,
      targetUserId,
      reason,
      deleteData: deleteData || false
    });
    
    res.success({ success: true });
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
  permissionMiddleware.requireSuperAdmin,
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

/**
 * @swagger
 * /admin/audit-logs/users/{userId}:
 *   get:
 *     tags:
 *       - Admin Audit
 *     summary: Get user-specific audit logs (admin/super_admin only)
 *     description: Retrieves comprehensive audit logs for a specific user
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 */
router.get('/audit-logs/users/:userId',
  permissionMiddleware.requireUserManagement,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const targetUserId = req.params.userId;
    const { limit = 100, offset = 0, severityLevel, action, startDate, endDate } = req.query;
    
    const filters = {
      userId: targetUserId,
      severityLevel: severityLevel as string,
      action: action as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    };
    
    const result = await adminService.getUserAuditLogs(
      tenantContext,
      targetUserId,
      parseInt(limit as string, 10),
      parseInt(offset as string, 10),
      filters
    );
    
    logger.info('Admin: User audit logs retrieved', {
      adminUser: tenantContext.userId,
      targetUserId,
      count: result.logs.length,
      total: result.total
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
 * @swagger
 * /admin/audit-logs/organizations/{organizationId}:
 *   get:
 *     tags:
 *       - Admin Audit
 *     summary: Get organization audit logs (admin/super_admin only)
 *     description: Retrieves comprehensive audit logs for a specific organization
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 */
router.get('/audit-logs/organizations/:organizationId',
  permissionMiddleware.requireUserManagement,
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const organizationId = req.params.organizationId;
    const { limit = 100, offset = 0, severityLevel, action, startDate, endDate } = req.query;
    
    const filters = {
      organizationId,
      severityLevel: severityLevel as string,
      action: action as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    };
    
    const result = await adminService.getOrganizationAuditLogs(
      tenantContext,
      organizationId,
      parseInt(limit as string, 10),
      parseInt(offset as string, 10),
      filters
    );
    
    logger.info('Admin: Organization audit logs retrieved', {
      adminUser: tenantContext.userId,
      organizationId,
      count: result.logs.length,
      total: result.total
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
 * @swagger
 * /admin/audit-logs/export:
 *   post:
 *     tags:
 *       - Admin Audit
 *     summary: Export audit logs (admin/super_admin only)
 *     description: Export audit logs in CSV/JSON format
 *     security:
 *       - bearerAuth: []
 *       - adminAccess: []
 */
router.post('/audit-logs/export',
  permissionMiddleware.requireUserManagement,
  validateRequest({
    body: {
      format: { type: 'string', enum: ['csv', 'json'], required: true },
      filters: {
        type: 'object',
        properties: {
          userId: { type: 'string', optional: true },
          organizationId: { type: 'string', optional: true },
          action: { type: 'string', optional: true },
          tableName: { type: 'string', optional: true },
          severityLevel: { type: 'string', optional: true },
          startDate: { type: 'string', optional: true },
          endDate: { type: 'string', optional: true },
          adminOnly: { type: 'boolean', optional: true },
          highRiskOnly: { type: 'boolean', optional: true }
        },
        optional: true
      },
      maxRecords: { type: 'number', minimum: 1, maximum: 50000, optional: true, default: 10000 }
    }
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const { format, filters, maxRecords } = req.body;
    
    const exportResult = await adminService.exportAuditLogs(
      tenantContext,
      format,
      filters || {},
      maxRecords || 10000
    );
    
    logger.info('Admin: Audit logs exported', {
      adminUser: tenantContext.userId,
      format,
      recordCount: exportResult.recordCount,
      filters
    });
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${Date.now()}.csv"`);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${Date.now()}.json"`);
    }
    
    res.send(exportResult.data);
  })
);

/**
 * @swagger
 * /admin/global-stats:
 *   get:
 *     tags:
 *       - Admin System
 *     summary: Get global statistics for multi-organization dashboard (system admin only)
 *     description: |
 *       Retrieves comprehensive cross-organization statistics including users, organizations, 
 *       invoices, revenue, and activity data. Only accessible to system administrators.
 *       Data is cached for 5 minutes for performance.
 *     security:
 *       - bearerAuth: []
 *       - systemAdminAccess: []
 *     responses:
 *       200:
 *         description: Global statistics retrieved successfully
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
 *                     totalUsers:
 *                       type: integer
 *                       description: Total number of users across all organizations
 *                       example: 1250
 *                     totalOrganizations:
 *                       type: integer
 *                       description: Total number of organizations
 *                       example: 45
 *                     totalInvoices:
 *                       type: integer
 *                       description: Total number of invoices across all organizations
 *                       example: 8920
 *                     totalRevenue:
 *                       type: number
 *                       description: Total revenue from completed payments
 *                       example: 2847561.50
 *                     recentActivity:
 *                       type: array
 *                       description: Recent high-level activity logs
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           action:
 *                             type: string
 *                           userDisplayName:
 *                             type: string
 *                           organizationName:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           summary:
 *                             type: string
 *                     organizationBreakdown:
 *                       type: array
 *                       description: Top organizations with statistics
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           userCount:
 *                             type: integer
 *                           invoiceCount:
 *                             type: integer
 *                           revenue:
 *                             type: number
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: System admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/global-stats',
  permissionMiddleware.requireSystemAdmin, // Only system admins can access global statistics
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    
    try {
      const globalStats = await adminService.getGlobalStatistics(tenantContext);
      
      logger.info('Admin: Global statistics retrieved successfully', {
        adminUser: tenantContext.userId,
        totalUsers: globalStats.totalUsers,
        totalOrganizations: globalStats.totalOrganizations,
        totalRevenue: globalStats.totalRevenue,
        orgBreakdownCount: globalStats.organizationBreakdown.length
      });
      
      res.success(globalStats);
      
    } catch (error: any) {
      logger.error('Admin: Failed to retrieve global statistics', {
        error: error.message,
        adminUser: tenantContext.userId
      });
      
      if (error.code === 'FORBIDDEN') {
        return res.error('FORBIDDEN', 'System admin access required for global statistics', 403);
      }
      
      return res.error('INTERNAL_ERROR', 'Failed to retrieve global statistics', 500);
    }
  })
);

/**
 * @swagger
 * /admin/activity-logs:
 *   get:
 *     tags:
 *       - Admin Activity
 *     summary: Get global activity logs (system admin only)
 *     description: |
 *       Retrieves cross-organization activity logs with filtering and pagination.
 *       Only accessible to system administrators with cross-tenant permissions.
 *       Provides comprehensive audit trail across all organizations.
 *     security:
 *       - bearerAuth: []
 *       - systemAdminAccess: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *           default: 50
 *         description: Maximum number of logs to return
 *       - name: offset
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of logs to skip
 *       - name: organizationId
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by specific organization ID
 *       - name: action
 *         in: query
 *         schema:
 *           type: string
 *           enum: [CREATE, UPDATE, DELETE, LOGIN, LOGOUT, EXPORT, IMPORT]
 *         description: Filter by activity type
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
 *         description: Filter from start date (ISO 8601)
 *       - name: endDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter to end date (ISO 8601)
 *       - name: highRiskOnly
 *         in: query
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Show only high-risk operations
 *     responses:
 *       200:
 *         description: Activity logs retrieved successfully
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
 *                     logs:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           action:
 *                             type: string
 *                           tableName:
 *                             type: string
 *                           displayAction:
 *                             type: string
 *                           displayTableName:
 *                             type: string
 *                           userDisplayName:
 *                             type: string
 *                           organizationName:
 *                             type: string
 *                           isHighRisk:
 *                             type: boolean
 *                           adminAction:
 *                             type: boolean
 *                           severityLevel:
 *                             type: string
 *                           ipAddress:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           summary:
 *                             type: string
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         offset:
 *                           type: integer
 *                     filters:
 *                       type: object
 *                       properties:
 *                         organizations:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: Available organization IDs for filtering
 *                         actions:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: Available actions for filtering
 *                         severityLevels:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: Available severity levels for filtering
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: System admin access required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/activity-logs',
  permissionMiddleware.requireSystemAdmin, // Only system admins can access cross-organization logs
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const { 
      limit = 50, 
      offset = 0, 
      organizationId,
      action,
      severityLevel,
      startDate,
      endDate,
      highRiskOnly
    } = req.query;
    
    // Build filters object
    const filters = {
      adminOnly: false, // Show all activities, not just admin
      highRiskOnly: highRiskOnly === 'true',
      organizationId: organizationId as string,
      action: action as string,
      severityLevel: severityLevel as string,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    };
    
    try {
      // Get activity logs with cross-organization access
      const result = await adminService.getActivityLogs(
        tenantContext,
        parseInt(limit as string, 10),
        parseInt(offset as string, 10),
        filters
      );

      // Get available filter options for frontend
      const [organizationOptions, actionOptions, severityOptions] = await Promise.all([
        getAvailableOrganizations(),
        getAvailableActions(),
        getAvailableSeverityLevels()
      ]);
      
      logger.info('Admin: Global activity logs retrieved', {
        adminUser: tenantContext.userId,
        count: result.logs.length,
        total: result.total,
        filters: {
          organizationId,
          action,
          severityLevel,
          startDate,
          endDate,
          highRiskOnly
        }
      });
      
      res.success({
        logs: result.logs,
        pagination: {
          total: result.total,
          limit: parseInt(limit as string, 10),
          offset: parseInt(offset as string, 10)
        },
        filters: {
          organizations: organizationOptions,
          actions: actionOptions,
          severityLevels: severityOptions
        }
      });
      
    } catch (error: any) {
      logger.error('Admin: Failed to retrieve global activity logs', {
        error: error.message,
        adminUser: tenantContext.userId,
        filters
      });
      
      if (error.code === 'FORBIDDEN') {
        return res.error('FORBIDDEN', 'System admin access required for global activity logs', 403);
      }
      
      return res.error('INTERNAL_ERROR', 'Failed to retrieve global activity logs', 500);
    }

    // Helper functions to get filter options
    async function getAvailableOrganizations(): Promise<string[]> {
      try {
        const { AppDataSource } = await import('../../database/data-source');
        const result = await AppDataSource.query(`
          SELECT DISTINCT o.id, o.name 
          FROM organizations o 
          INNER JOIN audit_logs al ON al.organization_id = o.id
          WHERE o.deleted_at IS NULL
          ORDER BY o.name
          LIMIT 100
        `);
        return result.map((row: any) => ({ id: row.id, name: row.name }));
      } catch (error) {
        logger.error('Failed to get organization filter options', { error });
        return [];
      }
    }

    async function getAvailableActions(): Promise<string[]> {
      try {
        const { AppDataSource } = await import('../../database/data-source');
        const result = await AppDataSource.query(`
          SELECT DISTINCT action 
          FROM audit_logs 
          WHERE action IS NOT NULL
          ORDER BY action
        `);
        return result.map((row: any) => row.action);
      } catch (error) {
        logger.error('Failed to get action filter options', { error });
        return ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT'];
      }
    }

    async function getAvailableSeverityLevels(): Promise<string[]> {
      return ['low', 'medium', 'high', 'critical'];
    }
  })
);

export const adminRoutes = router;