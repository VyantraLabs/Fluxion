import { Router, Request, Response } from 'express';
import { ConfigService } from './service';
import { Logger } from '@/shared/utils/logger';
import { 
  asyncHandler, 
  validateRequest, 
  cacheResponse 
} from '@/shared/middleware';
import { 
  GetNetworksQuery,
  GetTokensQuery,
  GetNetworkTokensQuery,
  NetworkFilter,
  TokenFilter
} from '@/types/config';
import { z } from 'zod';

const router = Router();
const configService = new ConfigService();
const logger = new Logger('ConfigHandlers');

// Validation schemas
const ChainIdSchema = z.object({
  chainId: z.string().transform(val => parseInt(val, 10)).pipe(z.number().positive()),
});

const NetworksQuerySchema = z.object({
  active: z.enum(['true', 'false']).optional(),
  testnet: z.enum(['true', 'false']).optional(),
  chainIds: z.string().optional(),
  symbols: z.string().optional(),
  includeTokens: z.enum(['true', 'false']).optional(),
});

const TokensQuerySchema = z.object({
  active: z.enum(['true', 'false']).optional(),
  stablecoin: z.enum(['true', 'false']).optional(),
  native: z.enum(['true', 'false']).optional(),
  networkId: z.string().uuid().optional(),
  chainId: z.string().transform(val => parseInt(val, 10)).pipe(z.number().positive()).optional(),
  symbols: z.string().optional(),
  includeNetwork: z.enum(['true', 'false']).optional(),
});

const NetworkTokensQuerySchema = z.object({
  active: z.enum(['true', 'false']).optional(),
  stablecoin: z.enum(['true', 'false']).optional(),
  native: z.enum(['true', 'false']).optional(),
  symbols: z.string().optional(),
});

/**
 * @swagger
 * /config/networks:
 *   get:
 *     tags: [Configuration]
 *     summary: Get all blockchain networks
 *     description: |
 *       Retrieve a list of supported blockchain networks with their configuration details.
 *       Results can be filtered by active status, network type (mainnet/testnet), specific chain IDs, or symbols.
 *     parameters:
 *       - $ref: '#/components/parameters/ActiveParam'
 *       - $ref: '#/components/parameters/TestnetParam'
 *       - $ref: '#/components/parameters/ChainIdsParam'
 *       - $ref: '#/components/parameters/SymbolsParam'
 *       - name: includeTokens
 *         in: query
 *         description: Include token data in response
 *         required: false
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *           default: 'false'
 *     responses:
 *       200:
 *         description: Networks retrieved successfully
 *         headers:
 *           X-Cache:
 *             description: Cache status (HIT/MISS)
 *             schema:
 *               type: string
 *           Cache-Control:
 *             description: Cache control directives
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, data, meta]
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/NetworksResponse'
 *                 meta:
 *                   $ref: '#/components/schemas/ResponseMeta'
 *             examples:
 *               all_networks:
 *                 summary: All networks
 *                 description: Get all active networks
 *                 value:
 *                   success: true
 *                   data:
 *                     networks: []
 *                     count: 12
 *                     mainnets: []
 *                     testnets: []
 *                   meta:
 *                     requestId: "req-123"
 *                     timestamp: "2024-01-15T10:30:00.000Z"
 *               mainnet_only:
 *                 summary: Mainnet networks only
 *                 description: Get only mainnet networks
 *                 value:
 *                   success: true
 *                   data:
 *                     networks: []
 *                     count: 8
 *                     mainnets: []
 *                     testnets: []
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/networks',
  validateRequest({ query: NetworksQuerySchema }),
  cacheResponse(3600), // Cache for 1 hour
  asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as GetNetworksQuery;
    
    const filter: NetworkFilter = {};
    
    if (query.active !== undefined) {
      filter.isActive = query.active === 'true';
    }
    
    if (query.testnet !== undefined) {
      filter.isTestnet = query.testnet === 'true';
    }
    
    if (query.chainIds) {
      filter.chainIds = query.chainIds.split(',').map(id => parseInt(id.trim(), 10));
    }
    
    if (query.symbols) {
      filter.symbols = query.symbols.split(',').map(s => s.trim().toUpperCase());
    }

    const networks = await configService.getNetworks(filter);

    logger.info('Networks configuration retrieved', { 
      count: networks.count,
      mainnets: networks.mainnets.length,
      testnets: networks.testnets.length,
      filter 
    });

    res.success(networks);
  })
);

/**
 * @swagger
 * /config/networks/{chainId}:
 *   get:
 *     tags: [Configuration]
 *     summary: Get network by chain ID
 *     description: Retrieve configuration details for a specific blockchain network by its chain ID.
 *     parameters:
 *       - $ref: '#/components/parameters/ChainIdParam'
 *     responses:
 *       200:
 *         description: Network configuration retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, data, meta]
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/NetworkConfig'
 *                 meta:
 *                   $ref: '#/components/schemas/ResponseMeta'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/networks/:chainId',
  validateRequest({ params: ChainIdSchema }),
  cacheResponse(3600), // Cache for 1 hour
  asyncHandler(async (req: Request, res: Response) => {
    const { chainId } = req.params as any;

    const network = await configService.getNetworkByChainId(chainId);

    if (!network) {
      logger.warn('Network not found or inactive', { chainId });
      return res.error('Network not found', 404);
    }

    logger.info('Network configuration retrieved', { chainId, networkId: network.id });
    res.success(network);
  })
);

/**
 * Get all tokens
 * GET /config/tokens
 * 
 * Query parameters:
 * - active: filter by active status (true/false)
 * - stablecoin: filter by stablecoin status (true/false)
 * - native: filter by native token status (true/false)
 * - networkId: filter by network UUID
 * - chainId: filter by chain ID
 * - symbols: comma-separated list of symbols
 * - includeNetwork: include network data (true/false)
 */
router.get('/tokens',
  validateRequest({ query: TokensQuerySchema }),
  cacheResponse(1800), // Cache for 30 minutes
  asyncHandler(async (req: Request, res: Response) => {
    const query = req.query as GetTokensQuery;
    
    const filter: TokenFilter = {};
    
    if (query.active !== undefined) {
      filter.isActive = query.active === 'true';
    }
    
    if (query.stablecoin !== undefined) {
      filter.isStablecoin = query.stablecoin === 'true';
    }
    
    if (query.native !== undefined) {
      filter.isNative = query.native === 'true';
    }
    
    if (query.networkId) {
      filter.networkId = query.networkId;
    }
    
    if (query.chainId) {
      filter.chainId = query.chainId;
    }
    
    if (query.symbols) {
      filter.symbols = query.symbols.split(',').map(s => s.trim().toUpperCase());
    }

    const tokens = await configService.getTokens(filter);

    logger.info('Tokens configuration retrieved', { 
      count: tokens.count,
      stablecoins: tokens.stablecoins.length,
      native: tokens.nativeTokens.length,
      erc20: tokens.erc20Tokens.length,
      filter 
    });

    res.success(tokens);
  })
);

/**
 * Get tokens for specific network
 * GET /config/tokens/:chainId
 * 
 * Query parameters:
 * - active: filter by active status (true/false)
 * - stablecoin: filter by stablecoin status (true/false)
 * - native: filter by native token status (true/false)
 * - symbols: comma-separated list of symbols
 */
router.get('/tokens/:chainId',
  validateRequest({ 
    params: ChainIdSchema,
    query: NetworkTokensQuerySchema 
  }),
  cacheResponse(1800), // Cache for 30 minutes
  asyncHandler(async (req: Request, res: Response) => {
    const { chainId } = req.params as any;
    const query = req.query as GetNetworkTokensQuery;
    
    const filter: TokenFilter = {};
    
    if (query.active !== undefined) {
      filter.isActive = query.active === 'true';
    }
    
    if (query.stablecoin !== undefined) {
      filter.isStablecoin = query.stablecoin === 'true';
    }
    
    if (query.native !== undefined) {
      filter.isNative = query.native === 'true';
    }
    
    if (query.symbols) {
      filter.symbols = query.symbols.split(',').map(s => s.trim().toUpperCase());
    }

    const networkTokens = await configService.getNetworkTokens(chainId, filter);

    if (!networkTokens) {
      logger.warn('Network not found for tokens query', { chainId });
      return res.error('Network not found', 404);
    }

    logger.info('Network tokens retrieved', { 
      chainId, 
      networkId: networkTokens.networkId,
      count: networkTokens.count,
      filter 
    });

    res.success(networkTokens);
  })
);

/**
 * @swagger
 * /config/app-config:
 *   get:
 *     tags: [Configuration]
 *     summary: Get complete application configuration
 *     description: |
 *       Retrieve the complete application configuration including all networks, tokens, 
 *       supported features, limits, and UI settings. This endpoint provides everything 
 *       needed to bootstrap a frontend application.
 *     responses:
 *       200:
 *         description: Complete application configuration retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, data, meta]
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ConfigResponse'
 *                 meta:
 *                   $ref: '#/components/schemas/ResponseMeta'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/app-config',
  cacheResponse(900), // Cache for 15 minutes
  asyncHandler(async (req: Request, res: Response) => {
    const config = await configService.getAppConfig();

    logger.info('Complete app configuration retrieved', {
      networksCount: config.meta.networksCount,
      tokensCount: config.meta.tokensCount,
      supportedNetworks: config.appConfig.supportedNetworks.length,
    });

    res.success(config);
  })
);

/**
 * Health check endpoint for config service
 * GET /config/health
 */
router.get('/health',
  asyncHandler(async (req: Request, res: Response) => {
    const health = await configService.getHealthStatus();
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    logger.info('Config service health check', { 
      status: health.status,
      ...(health.data || {}),
      ...(health.error && { error: health.error })
    });
    
    res.status(statusCode).json({
      success: health.status === 'healthy',
      data: health,
      meta: {
        requestId: req.context?.requestId || 'unknown',
        timestamp: new Date().toISOString()
      }
    });
  })
);

/**
 * Validate network endpoint
 * GET /config/validate/network/:chainId
 */
router.get('/validate/network/:chainId',
  validateRequest({ params: ChainIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { chainId } = req.params as any;

    const isValid = await configService.validateNetwork(chainId);

    logger.info('Network validation', { chainId, isValid });

    res.success({
      chainId,
      isValid,
      message: isValid ? 'Network is supported and active' : 'Network not found or inactive'
    });
  })
);

/**
 * Get configuration summary for frontend bootstrap
 * GET /config/summary
 */
router.get('/summary',
  cacheResponse(1800), // Cache for 30 minutes
  asyncHandler(async (req: Request, res: Response) => {
    const [networks, tokens] = await Promise.all([
      configService.getNetworks({ isActive: true }),
      configService.getTokens({ isActive: true }),
    ]);

    // Create a lightweight summary for frontend initialization
    const summary = {
      networks: networks.networks.map(n => ({
        chainId: n.chainId,
        name: n.name,
        symbol: n.symbol,
        isTestnet: n.isTestnet,
        gasSettings: n.gasSettings,
      })),
      tokens: tokens.tokens.map(t => ({
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        isNative: t.isNative,
        isStablecoin: t.isStablecoin,
        contractAddress: t.contractAddress,
        networkId: t.networkId,
        logoUrl: t.logoUrl,
      })),
      defaultNetwork: 137, // Polygon
      showTestnets: process.env.NODE_ENV !== 'production',
      features: {
        invoicing: true,
        payroll: true,
        escrow: false,
        subscriptions: false,
        crossChain: false,
      }
    };

    logger.info('Configuration summary retrieved', {
      networksCount: summary.networks.length,
      tokensCount: summary.tokens.length,
    });

    res.success(summary);
  })
);

export const configRoutes = router;