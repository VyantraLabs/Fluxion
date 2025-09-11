import { Router, Request, Response } from 'express';
import { AdminAuthService } from './auth.service';
import { Logger } from '@/shared/utils/logger';
import { 
  validateRequest, 
  asyncHandler,
  authenticateJWT,
  requireSystemRole
} from '@/shared/middleware';
import { 
  GenerateMessageSchema,
  AuthenticateWalletSchema
} from '@/shared/validation';
import { getTenantContext } from '@/shared/middleware/tenant';

const router = Router();
const adminAuthService = new AdminAuthService();
const logger = new Logger('AdminAuthHandlers');

/**
 * @swagger
 * /admin/auth/message:
 *   post:
 *     tags:
 *       - Admin Authentication
 *     summary: Generate authentication message for system admin
 *     description: |
 *       Generates a message to be signed for system admin authentication.
 *       Only works for wallet addresses that have system-level roles assigned.
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
 *                 example: "0x742d35Cc6486C3e1Bd8E7D3d"
 *                 description: Ethereum wallet address
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
 *                       example: "Fluxion Admin Authentication\n\nWallet: 0x742d35Cc6486C3e1Bd8E7D3d\nNonce: abc123\nTimestamp: 1234567890\nAction: Admin Login\n\nThis request will not trigger any blockchain transaction or cost any gas fees."
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         description: Wallet not authorized for system admin access
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/auth/message',
  validateRequest({ body: GenerateMessageSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { wallet_address } = req.body;
    
    logger.info('Admin auth message requested', { 
      wallet_address 
    });

    try {
      const result = await adminAuthService.generateAuthMessage(wallet_address);
      
      logger.info('Admin auth message generated', { 
        wallet_address 
      });
      
      res.success(result);
    } catch (error: any) {
      logger.error('Admin auth message generation failed', {
        wallet_address,
        error: error.message
      });
      throw error;
    }
  })
);

/**
 * @swagger
 * /admin/auth/verify:
 *   post:
 *     tags:
 *       - Admin Authentication
 *     summary: Verify signature and authenticate system admin
 *     description: |
 *       Verifies the wallet signature and authenticates a system admin user.
 *       Returns JWT token with system roles for authorized admin access.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - wallet_address
 *               - message
 *               - signature
 *             properties:
 *               wallet_address:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 example: "0x742d35Cc6486C3e1Bd8E7D3d"
 *                 description: Ethereum wallet address
 *               message:
 *                 type: string
 *                 example: "Fluxion Admin Authentication\n\nWallet: 0x742d35Cc6486C3e1Bd8E7D3d\nNonce: abc123\nTimestamp: 1234567890\nAction: Admin Login\n\nThis request will not trigger any blockchain transaction or cost any gas fees."
 *                 description: The message that was signed
 *               signature:
 *                 type: string
 *                 example: "0x123456789abcdef..."
 *                 description: The wallet signature of the message
 *     responses:
 *       200:
 *         description: Authentication successful
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
 *                     token:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                       description: JWT token with system admin privileges
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         wallet_address:
 *                           type: string
 *                         email:
 *                           type: string
 *                         display_name:
 *                           type: string
 *                         role:
 *                           type: string
 *                           description: Primary system role
 *                     expires_at:
 *                       type: string
 *                       format: date-time
 *                     needsOnboarding:
 *                       type: boolean
 *                       example: false
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         description: Invalid signature or unauthorized access
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/auth/verify',
  validateRequest({ body: AuthenticateWalletSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const authData = req.body;
    
    logger.info('Admin authentication attempt', { 
      wallet_address: authData.wallet_address 
    });

    try {
      const authResponse = await adminAuthService.verifyAndAuthenticate(authData);
      
      logger.info('Admin authentication successful', { 
        user_id: authResponse.user.id,
        wallet_address: authData.wallet_address
      });
      
      res.success(authResponse);
    } catch (error: any) {
      logger.error('Admin authentication failed', {
        wallet_address: authData.wallet_address,
        error: error.message
      });
      throw error;
    }
  })
);

/**
 * @swagger
 * /admin/auth/profile:
 *   get:
 *     tags:
 *       - Admin Authentication
 *     summary: Get current admin user profile with system roles
 *     description: |
 *       Returns the current authenticated admin user's profile including
 *       their system roles and permissions.
 *     security:
 *       - bearerAuth: []
 *       - systemAdminAccess: []
 *     responses:
 *       200:
 *         description: Admin profile retrieved successfully
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
 *                     id:
 *                       type: string
 *                     wallet_address:
 *                       type: string
 *                     email:
 *                       type: string
 *                     display_name:
 *                       type: string
 *                     role:
 *                       type: string
 *                       description: Primary system role
 *                     systemRoles:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: All system roles assigned to user
 *                       example: ["system_super_admin", "system_admin"]
 *                     stats:
 *                       type: object
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     updated_at:
 *                       type: string
 *                       format: date-time
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: System admin access required
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/auth/profile',
  authenticateJWT,
  requireSystemRole(['system_super_admin', 'system_admin', 'system_support', 'system_moderator']),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    
    if (!tenantContext.userId) {
      logger.error('No user ID in tenant context for admin profile');
      throw new Error('User ID not found in request context');
    }

    logger.info('Admin profile requested', { 
      user_id: tenantContext.userId 
    });

    try {
      const profile = await adminAuthService.getAdminProfile(tenantContext.userId);
      
      logger.info('Admin profile retrieved', { 
        user_id: tenantContext.userId,
        system_roles: profile.systemRoles
      });
      
      res.success(profile);
    } catch (error: any) {
      logger.error('Admin profile retrieval failed', {
        user_id: tenantContext.userId,
        error: error.message
      });
      throw error;
    }
  })
);

export const adminAuthRoutes = router;