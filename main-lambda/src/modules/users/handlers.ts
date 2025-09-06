import { Router, Request, Response } from 'express';
import { UserService } from './service';
import { UsersService } from '@/shared/services/users.service';
import { getDatabase } from '@/shared/database/client';
// Unused import removed: UpdateUserProfileSchema
import { 
  WalletAuthMessageSchema,
  WalletAuthVerifySchema,
  UpdateUserSchema,
  WalletAddressParamSchema,
  CompleteOnboardingSchema
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

// Note: Tenant context middleware is applied per route as needed
// Auth endpoints don't need tenant context as they establish it

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
  extractTenantContext(), // Add tenant context for auth message
  validateRequest({ body: WalletAuthMessageSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { wallet_address } = req.body;
    const authMessage = await userService.generateAuthMessage(wallet_address);
    
    logger.info('Auth message generated via API', { wallet_address });
    res.success(authMessage);
  })
);

// Wallet authentication handler function (for EXISTING users only)
const handleWalletAuthentication = asyncHandler(async (req: Request, res: Response) => {
  const tenantContext = getTenantContext(req);
  
  try {
    // Use the UserService which properly handles existing vs new users
    const authResponse = await userService.authenticateWallet(req.body);
    
    logger.info('User authenticated via API', { 
      wallet_address: req.body.wallet_address,
      user_id: authResponse.user.id 
    });
    
    res.success(authResponse);
  } catch (error: any) {
    logger.error('Authentication failed', { 
      error: error.message,
      code: error.code,
      wallet_address: req.body.wallet_address
    });
    
    // If user not found, return proper 404 response for frontend to handle
    if (error.code === 'NOT_FOUND') {
      return res.error('NOT_FOUND', 'User not found. Please complete onboarding first.', 404);
    }
    
    // If unauthorized (invalid signature, etc.)
    if (error.code === 'UNAUTHORIZED') {
      return res.error('UNAUTHORIZED', error.message, 401);
    }
    
    // For other errors, return 500
    return res.error('INTERNAL_ERROR', 'Authentication failed', 500);
  }
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
  extractTenantContext(), // Add tenant context for auth verify
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
  extractTenantContext(), // Add tenant context for legacy auth endpoint
  validateRequest({ body: WalletAuthVerifySchema }),
  handleWalletAuthentication
);

/**
 * @swagger
 * /users/auth/create:
 *   post:
 *     tags:
 *       - Authentication
 *     summary: Create new user with organization (Onboarding)
 *     description: |
 *       Creates a new user with their organization after wallet signature verification.
 *       This endpoint is used for new users during the onboarding flow.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - wallet_address
 *               - signature
 *               - message
 *               - organizationName
 *             properties:
 *               wallet_address:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 example: '0x742d35Cc6635C0532925a3b8D0aC0199'
 *               signature:
 *                 type: string
 *                 example: '0x1234567890abcdef...'
 *               message:
 *                 type: string
 *                 example: 'Sign this message to authenticate with Fluxion: nonce_123456_1642234567'
 *               organizationName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: 'Acme Corporation'
 *               displayName:
 *                 type: string
 *                 maxLength: 50
 *                 example: 'John Doe'
 *               email:
 *                 type: string
 *                 format: email
 *                 example: 'john@acme.com'
 *           examples:
 *             create_user:
 *               summary: Create new user with organization
 *               value:
 *                 wallet_address: '0x742d35Cc6635C0532925a3b8D0aC0199'
 *                 signature: '0x1234567890abcdef...'
 *                 message: 'Sign this message to authenticate with Fluxion: nonce_123456_1642234567'
 *                 organizationName: 'Acme Corporation'
 *                 displayName: 'John Doe'
 *                 email: 'john@acme.com'
 *     responses:
 *       201:
 *         description: User created and authenticated successfully
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
 *       409:
 *         description: User already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/auth/create',
  extractTenantContext(), // Add tenant context for user creation
  validateRequest({ body: CompleteOnboardingSchema.merge(WalletAuthVerifySchema) }),
  asyncHandler(async (req: Request, res: Response) => {
    const { wallet_address, signature, message, organizationName, displayName, email } = req.body;
    
    try {
      // Create new user with organization
      const authResponse = await userService.createNewUser({
        wallet_address,
        signature,
        message,
        organizationName,
        displayName,
        email
      });
      
      logger.info('New user created via API', { 
        wallet_address,
        user_id: authResponse.user.id,
        organization_name: organizationName
      });
      
      res.status(201).success(authResponse);
    } catch (error: any) {
      logger.error('New user creation failed via API', { 
        error: error.message,
        wallet_address,
        organization_name: organizationName
      });
      
      if (error.message && error.message.includes('User already exists')) {
        return res.error('CONFLICT', 'User already exists. Please use the login flow instead.', 409);
      }
      
      if (error.code === 'UNAUTHORIZED') {
        return res.error('UNAUTHORIZED', error.message, 401);
      }
      
      return res.error('INTERNAL_ERROR', 'Failed to create user account', 500);
    }
  })
);

/**
 * @swagger
 * /user/profile:
 *   get:
 *     tags:
 *       - User
 *     summary: Get authenticated user profile
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
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/profile', 
  authenticateJWT, 
  extractTenantContext(), // Extract tenant context after JWT auth
  asyncHandler(async (req: Request, res: Response) => {
    const walletAddress = req.context!.userId!;
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
 * /user/profile:
 *   put:
 *     tags:
 *       - User
 *     summary: Update authenticated user profile
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
  extractTenantContext(), // Extract tenant context after JWT auth
  validateRequest({ body: UpdateUserSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const walletAddress = req.context!.userId!;
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
 * /user/stats:
 *   get:
 *     tags:
 *       - User
 *     summary: Get authenticated user statistics
 *     description: |
 *       Retrieves statistical information for the authenticated user including invoice counts, 
 *       total amounts, and activity metrics.
 *     security:
 *       - bearerAuth: []
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
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/stats', 
  authenticateJWT,
  extractTenantContext(), // Extract tenant context after JWT auth
  asyncHandler(async (req: Request, res: Response) => {
    const walletAddress = req.context!.userId!;

    const stats = await userService.getUserStats(walletAddress);

    logger.info('User statistics retrieved via API', { wallet_address: walletAddress });
    res.success(stats);
  })
);

/**
 * @swagger
 * /user/profile:
 *   delete:
 *     tags:
 *       - User
 *     summary: Delete authenticated user account (GDPR compliance)
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
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.delete('/profile', 
  authenticateJWT,
  extractTenantContext(), // Extract tenant context after JWT auth
  asyncHandler(async (req: Request, res: Response) => {
    const walletAddress = req.context!.userId!;
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
  extractTenantContext(), // Add tenant context for validation
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
  extractTenantContext(), // Add tenant context for platform stats
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
  extractTenantContext(), // Add tenant context for user existence check
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

/**
 * @swagger
 * /users/onboarding/complete:
 *   post:
 *     tags:
 *       - Onboarding
 *     summary: Complete user onboarding
 *     description: |
 *       Complete the onboarding process for a first-time user by setting their organization name
 *       and updating their profile information.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - organizationName
 *             properties:
 *               organizationName:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: 'Acme Corporation'
 *               displayName:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 50
 *                 example: 'John Doe'
 *               email:
 *                 type: string
 *                 format: email
 *                 example: 'john@acme.com'
 *           examples:
 *             complete_onboarding:
 *               summary: Complete onboarding with all fields
 *               value:
 *                 organizationName: 'Acme Corporation'
 *                 displayName: 'John Doe'
 *                 email: 'john@acme.com'
 *     responses:
 *       200:
 *         description: Onboarding completed successfully
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
 *                     user:
 *                       $ref: '#/components/schemas/UserRecord'
 *                     organization:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           example: 'org-123e4567-e89b-12d3-a456-426614174000'
 *                         name:
 *                           type: string
 *                           example: 'Acme Corporation'
 *                         slug:
 *                           type: string
 *                           example: 'acme-corporation-742d35cc'
 *                 meta:
 *                   $ref: '#/components/schemas/ResponseMeta'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/onboarding/complete',
  authenticateJWT,
  extractTenantContext(), // Extract tenant context after JWT auth
  validateRequest({ body: CompleteOnboardingSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const userId = req.context!.userId!; // This is the wallet address from JWT

    try {
      // Try to get user from new schema first
      let userRecord;
      try {
        userRecord = await usersService.getUserByWallet(tenantContext, userId);
      } catch (error: any) {
        if (error.code === 'NOT_FOUND') {
          logger.error('User not found during onboarding', { 
            userId, 
            tenantId: tenantContext.tenantId 
          });
          return res.error('NOT_FOUND', 'User not found', 404);
        }
        throw error;
      }

      // Complete onboarding
      const updatedUser = await usersService.completeOnboarding(
        tenantContext, 
        userRecord.id, 
        req.body
      );

      logger.info('User onboarding completed via API', { 
        userId: userRecord.id,
        organizationName: req.body.organizationName,
        tenantId: tenantContext.tenantId
      });

      res.success({
        user: updatedUser,
        organization: updatedUser.organization
      });
    } catch (error: any) {
      logger.error('Failed to complete onboarding via API', { 
        error: error.message,
        userId,
        organizationName: req.body.organizationName
      });
      
      if (error.code === 'NOT_FOUND') {
        return res.error('NOT_FOUND', 'User not found', 404);
      }
      
      return res.error('INTERNAL_ERROR', 'Failed to complete onboarding', 500);
    }
  })
);

export const userRoutes = router;