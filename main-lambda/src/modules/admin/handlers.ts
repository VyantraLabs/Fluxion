import { Router, Request, Response } from 'express';
import { AdminService } from './service';
import { Logger } from '@/shared/utils/logger';
import { 
  authenticateJWT, 
  validateRequest, 
  asyncHandler,
  adminOnly 
} from '@/shared/middleware';
import { getTenantContext, extractTenantContext } from '@/shared/middleware/tenant';
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

export const adminRoutes = router;