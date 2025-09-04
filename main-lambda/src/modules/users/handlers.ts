import { Router, Request, Response } from 'express';
import { UserService } from './service';
import { UsersService } from '@/shared/services/users.service';
import { getDatabase } from '@/shared/database/client';
// Unused import removed: UpdateUserProfileSchema
import { 
  WalletAuthMessageSchema,
  WalletAuthVerifySchema,
  UpdateUserSchema,
  WalletAddressParamSchema
} from '@/shared/validation';
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
import { APIResponse } from '@/types/common';

const router = Router();
const userService = new UserService();
const db = getDatabase();
const usersService = new UsersService(db);
const logger = new Logger('UserHandlers');

// Apply tenant context middleware to all routes
router.use(extractTenantContext());
router.use(requireTenantContext());

/**
 * @swagger
 * /users/auth/message:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Generate authentication message for wallet signing
 *     description: |
 *       Generates a unique message that needs to be signed by the user's wallet for authentication.
 *       The message includes a nonce and timestamp to prevent replay attacks.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - wallet_address
 *             properties:
 *               wallet_address:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 example: '0x742d35Cc6635C0532925a3b8D0aC0199'
 *           examples:
 *             valid_request:
 *               summary: Valid wallet address
 *               value:
 *                 wallet_address: '0x742d35Cc6635C0532925a3b8D0aC0199'
 *     responses:
 *       200:
 *         description: Authentication message generated successfully
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
 *                     message:
 *                       type: string
 *                       example: 'Sign this message to authenticate with Fluxion: nonce_123456_1642234567'
 *                     nonce:
 *                       type: string
 *                       example: 'nonce_123456'
 *                     timestamp:
 *                       type: integer
 *                       example: 1642234567
 *                 meta:
 *                   $ref: '#/components/schemas/ResponseMeta'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/auth/message', 
  validateRequest({ body: WalletAuthMessageSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { wallet_address } = req.body;
    const authMessage = await userService.generateAuthMessage(wallet_address);
    
    logger.info('Auth message generated via API', { wallet_address });
    res.success(authMessage);
  })
);

// Wallet authentication handler function (shared between both endpoints)
const handleWalletAuthentication = asyncHandler(async (req: Request, res: Response) => {
  const tenantContext = getTenantContext(req);
  
  // First authenticate with legacy service
  const authResponse = await userService.authenticateWallet(req.body);
  
  // Then ensure user exists in new multi-table schema
  try {
    await usersService.getOrCreateUserByWallet(tenantContext, req.body.wallet_address);
  } catch (error) {
    logger.warn('Failed to create/update user in new schema', { error });
  }
  
  logger.info('User authenticated via API', { wallet_address: req.body.wallet_address });
  res.success(authResponse);
});

/**
 * @swagger
 * /users/auth/verify:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Authenticate user with wallet signature
 *     description: |
 *       Verifies the wallet signature against the authentication message and returns a JWT token.
 *       Creates a new user record if this is the first time the wallet is authenticating.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthenticateRequest'
 *           examples:
 *             valid_auth:
 *               summary: Valid authentication request
 *               value:
 *                 wallet_address: '0x742d35Cc6635C0532925a3b8D0aC0199'
 *                 signature: '0x1234567890abcdef...'
 *                 message: 'Sign this message to authenticate with Fluxion: nonce_123456_1642234567'
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthenticationResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         description: Invalid signature or authentication failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/auth/verify',
  validateRequest({ body: WalletAuthVerifySchema }),
  handleWalletAuthentication
);

/**
 * @swagger
 * /users/auth/verify-wallet:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Authenticate user with wallet signature (Legacy endpoint)
 *     description: |
 *       Verifies the wallet signature against the authentication message and returns a JWT token.
 *       Creates a new user record if this is the first time the wallet is authenticating.
 *       This endpoint is deprecated, use /auth/verify instead.
 *     deprecated: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AuthenticateRequest'
 *           examples:
 *             valid_auth:
 *               summary: Valid authentication request
 *               value:
 *                 wallet_address: '0x742d35Cc6635C0532925a3b8D0aC0199'
 *                 signature: '0x1234567890abcdef...'
 *                 message: 'Sign this message to authenticate with Fluxion: nonce_123456_1642234567'
 *     responses:
 *       200:
 *         description: Authentication successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthenticationResponse'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         description: Invalid signature or authentication failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/auth/verify-wallet',
  validateRequest({ body: WalletAuthVerifySchema }),
  handleWalletAuthentication
);

/**
 * @swagger
 * /users/profile:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get current user profile
 *     description: |
 *       Retrieves the authenticated user's profile information including stats and preferences.
 *       Requires valid JWT authentication token.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *                 meta:
 *                   $ref: '#/components/schemas/ResponseMeta'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/profile', 
  authenticateJWT, 
  asyncHandler(async (req: Request, res: Response) => {
    const walletAddress = req.user!.wallet_address;
    const tenantContext = getTenantContext(req);
    
    // Try new multi-table service first
    try {
      const user = await usersService.getUserByWallet(tenantContext, walletAddress);
      logger.info('User profile retrieved via API (new schema)', { wallet_address: walletAddress });
      res.success(user);
      return;
    } catch (error) {
      logger.debug('New schema lookup failed, falling back to legacy', { error });
    }
    
    // Fallback to legacy service
    const user = await userService.findByWalletAddress(walletAddress);
    
    if (!user) {
      return res.error('NOT_FOUND', 'User profile not found', 404);
    }
    
    logger.info('User profile retrieved via API (legacy)', { wallet_address: walletAddress });
    res.success(user);
  })
);

/**
 * @swagger
 * /users/profile:
 *   put:
 *     tags:
 *       - Users
 *     summary: Update current user profile
 *     description: |
 *       Updates the authenticated user's profile information such as email, display name, 
 *       and notification preferences. All fields are optional.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: 'john@example.com'
 *               profile:
 *                 type: object
 *                 properties:
 *                   display_name:
 *                     type: string
 *                     maxLength: 50
 *                     example: 'John Doe'
 *                   avatar_url:
 *                     type: string
 *                     format: uri
 *                     example: 'https://avatar.example.com/john.jpg'
 *                   bio:
 *                     type: string
 *                     maxLength: 500
 *                     example: 'Freelance developer'
 *               notification_preferences:
 *                 $ref: '#/components/schemas/NotificationPreferences'
 *           examples:
 *             profile_update:
 *               summary: Update profile information
 *               value:
 *                 email: 'john@example.com'
 *                 profile:
 *                   display_name: 'John Doe'
 *                   bio: 'Freelance developer and blockchain enthusiast'
 *                 notification_preferences:
 *                   email_on_payment: true
 *                   email_on_invoice_viewed: false
 *                   email_on_reminders: true
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *                 meta:
 *                   $ref: '#/components/schemas/ResponseMeta'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.put('/profile', 
  authenticateJWT,
  validateRequest({ body: UpdateUserSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const walletAddress = req.user!.wallet_address;
    const tenantContext = getTenantContext(req);
    
    // Try new multi-table service first
    try {
      const existingUser = await usersService.getUserByWallet(tenantContext, walletAddress);
      const updatedUser = await usersService.updateUser(tenantContext, existingUser.id, req.body);
      logger.info('User profile updated via API (new schema)', { wallet_address: walletAddress });
      res.success(updatedUser);
      return;
    } catch (error) {
      logger.debug('New schema update failed, falling back to legacy', { error });
    }
    
    // Fallback to legacy service
    const user = await userService.updateProfile(walletAddress, req.body);
    
    logger.info('User profile updated via API (legacy)', { wallet_address: walletAddress });
    res.success(user);
  })
);

/**
 * @swagger
 * /users/stats/{wallet}:
 *   get:
 *     tags:
 *       - Users
 *     summary: Get user statistics
 *     description: |
 *       Retrieves statistical information for a user including invoice counts, total amounts, 
 *       and activity metrics. Users can only access their own statistics.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: wallet
 *         in: path
 *         required: true
 *         description: Wallet address to get statistics for
 *         schema:
 *           type: string
 *           pattern: '^0x[a-fA-F0-9]{40}$'
 *           example: '0x742d35Cc6635C0532925a3b8D0aC0199'
 *     responses:
 *       200:
 *         description: User statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/UserStats'
 *                 meta:
 *                   $ref: '#/components/schemas/ResponseMeta'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Cannot access statistics for different wallet address
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/stats/:wallet', 
  authenticateJWT, 
  asyncHandler(async (req: Request, res: Response) => {
    const walletAddress = req.params.wallet;
    
    // Ensure user can only access their own stats
    if (walletAddress !== req.user?.wallet_address) {
      const response: APIResponse = {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Cannot access statistics for different wallet address'
        },
        meta: {
          requestId: req.context?.requestId || 'unknown',
          timestamp: new Date().toISOString()
        }
      };
      
      res.status(403).json(response);
      return;
    }

    const stats = await userService.getUserStats(walletAddress);

    const response: APIResponse = {
      success: true,
      data: stats,
      meta: {
        requestId: req.context?.requestId || 'unknown',
        timestamp: new Date().toISOString()
      }
    };

    logger.info('User statistics retrieved via API', { wallet_address: walletAddress });
    res.json(response);
  })
);

/**
 * @swagger
 * /users/profile:
 *   delete:
 *     tags:
 *       - Users
 *     summary: Delete current user account (GDPR compliance)
 *     description: |
 *       Permanently deletes the authenticated user's account and all associated data.
 *       This action is irreversible and is provided for GDPR compliance.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User account deleted successfully
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
 *                     message:
 *                       type: string
 *                       example: 'User account deleted successfully'
 *                 meta:
 *                   $ref: '#/components/schemas/ResponseMeta'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.delete('/profile', 
  authenticateJWT, 
  asyncHandler(async (req: Request, res: Response) => {
    const walletAddress = req.user!.wallet_address;
    await userService.deleteUser(walletAddress);
    
    logger.info('User account deleted via API', { wallet_address: walletAddress });
    res.success({ message: 'User account deleted successfully' });
  })
);

/**
 * @swagger
 * /users/validate-address:
 *   post:
 *     tags:
 *       - Users
 *     summary: Validate wallet address format
 *     description: |
 *       Validates if the provided wallet address has the correct format for Ethereum-compatible addresses.
 *       This is a utility endpoint for client-side validation.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - wallet_address
 *             properties:
 *               wallet_address:
 *                 type: string
 *                 example: '0x742d35Cc6635C0532925a3b8D0aC0199'
 *     responses:
 *       200:
 *         description: Wallet address validation completed
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
 *                     wallet_address:
 *                       type: string
 *                       example: '0x742d35Cc6635C0532925a3b8D0aC0199'
 *                     is_valid:
 *                       type: boolean
 *                       example: true
 *                 meta:
 *                   $ref: '#/components/schemas/ResponseMeta'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/validate-address',
  validateRequest({ body: WalletAuthMessageSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { wallet_address } = req.body;
    const isValid = userService.isValidWalletAddress(wallet_address);
    
    logger.info('Wallet address validated via API', { wallet_address, is_valid: isValid });
    res.success({
      wallet_address,
      is_valid: isValid
    });
  })
);

/**
 * @swagger
 * /users/platform/stats:
 *   get:
 *     tags:
 *       - Analytics
 *     summary: Get platform statistics
 *     description: |
 *       Retrieves public platform statistics including active user counts,
 *       supported networks, and platform information. This is a public endpoint.
 *     responses:
 *       200:
 *         description: Platform statistics retrieved successfully
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
 *                     active_users_7d:
 *                       type: integer
 *                       example: 1250
 *                       description: Number of users active in last 7 days
 *                     active_users_30d:
 *                       type: integer
 *                       example: 3400
 *                       description: Number of users active in last 30 days
 *                     platform_launch_date:
 *                       type: string
 *                       format: date
 *                       example: '2025-09-03'
 *                     supported_networks:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ['Polygon']
 *                     supported_tokens:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ['USDC']
 *                 meta:
 *                   $ref: '#/components/schemas/ResponseMeta'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/platform/stats', 
  asyncHandler(async (_req: Request, res: Response) => {
    const activeUsers7d = await userService.getActiveUsersCount(7);
    const activeUsers30d = await userService.getActiveUsersCount(30);
    
    const platformStats = {
      active_users_7d: activeUsers7d,
      active_users_30d: activeUsers30d,
      platform_launch_date: '2025-09-03',
      supported_networks: ['Polygon'],
      supported_tokens: ['USDC']
    };
    
    logger.info('Platform statistics retrieved via API');
    res.success(platformStats);
  })
);

/**
 * @swagger
 * /users/exists/{wallet}:
 *   get:
 *     tags:
 *       - Users
 *     summary: Check if user exists
 *     description: |
 *       Checks if a user with the specified wallet address exists in the system.
 *       Also indicates if the user has completed their profile setup.
 *     parameters:
 *       - name: wallet
 *         in: path
 *         required: true
 *         description: Wallet address to check
 *         schema:
 *           type: string
 *           pattern: '^0x[a-fA-F0-9]{40}$'
 *           example: '0x742d35Cc6635C0532925a3b8D0aC0199'
 *     responses:
 *       200:
 *         description: User existence check completed
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
 *                     wallet_address:
 *                       type: string
 *                       example: '0x742d35Cc6635C0532925a3b8D0aC0199'
 *                     exists:
 *                       type: boolean
 *                       example: true
 *                     profile_complete:
 *                       type: boolean
 *                       example: false
 *                       description: True if user has email and display name set
 *                 meta:
 *                   $ref: '#/components/schemas/ResponseMeta'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/exists/:wallet',
  validateRequest({ params: WalletAddressParamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const walletAddress = req.params.wallet;
    const tenantContext = getTenantContext(req);
    
    // Check in new schema first
    try {
      const exists = await usersService.userExists(tenantContext, walletAddress);
      if (exists) {
        const user = await usersService.getUserByWallet(tenantContext, walletAddress);
        logger.info('User existence checked via API (new schema)', { wallet_address: walletAddress, exists: true });
        res.success({
          wallet_address: walletAddress,
          exists: true,
          profile_complete: !!(user?.email && user?.profile?.display_name)
        });
        return;
      }
    } catch (error) {
      logger.debug('New schema lookup failed, checking legacy', { error });
    }
    
    // Fallback to legacy service
    const user = await userService.findByWalletAddress(walletAddress);
    const exists = !!user;
    
    logger.info('User existence checked via API (legacy)', { wallet_address: walletAddress, exists });
    res.success({
      wallet_address: walletAddress,
      exists,
      profile_complete: exists ? !!(user?.email && user?.display_name) : false
    });
  })
);

export const userRoutes = router;