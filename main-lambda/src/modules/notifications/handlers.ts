import { Router, Request, Response } from 'express';
import { NotificationService } from './service';
import { Logger } from '@/shared/utils/logger';
import { 
  authenticateJWT, 
  validateRequest, 
  asyncHandler 
} from '@/shared/middleware';
import { getTenantContext, extractTenantContext } from '@/shared/middleware/tenant';
import {
  SendNotificationSchema,
  NotificationFilterSchema,
  NotificationIdSchema
} from '@/shared/validation/notifications';

const router = Router();
const notificationService = new NotificationService();
const logger = new Logger('NotificationHandlers');

/**
 * @swagger
 * /notifications:
 *   post:
 *     tags:
 *       - Notifications
 *     summary: Send notification
 *     description: |
 *       Sends a notification through the notification system. Supports multiple
 *       notification types and channels.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - recipientEmail
 *               - templateData
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [invoice_sent, payment_received, payment_failed, payment_reminder, payment_overdue, invoice_viewed]
 *                 example: "invoice_sent"
 *               recipientEmail:
 *                 type: string
 *                 format: email
 *                 example: "client@acme.com"
 *               templateData:
 *                 type: object
 *                 description: Data to populate notification template
 *                 example:
 *                   invoiceId: "abc123def"
 *                   clientName: "Acme Corporation"
 *                   amount: 2500.00
 *                   dueDate: "2025-10-15"
 *               channels:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [email, webhook, sms]
 *                 default: ["email"]
 *                 example: ["email", "webhook"]
 *               priority:
 *                 type: string
 *                 enum: [high, medium, low]
 *                 default: "medium"
 *                 example: "high"
 *               scheduleAt:
 *                 type: string
 *                 format: date-time
 *                 description: Schedule notification for future delivery
 *                 example: "2025-09-06T12:00:00.000Z"
 *     responses:
 *       200:
 *         description: Notification queued successfully
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
 *                     notificationId:
 *                       type: string
 *                       format: uuid
 *                       example: "n1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *                     status:
 *                       type: string
 *                       enum: [queued, scheduled]
 *                       example: "queued"
 *                     message:
 *                       type: string
 *                       example: "Notification queued for delivery"
 *                     scheduledAt:
 *                       type: string
 *                       format: date-time
 *                       nullable: true
 *                       example: "2025-09-06T12:00:00.000Z"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/',
  authenticateJWT,
  extractTenantContext(),
  validateRequest({ body: SendNotificationSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    
    const result = await notificationService.sendNotification(tenantContext, req.body);
    
    logger.info('Notification queued via API', {
      notificationId: result.notificationId,
      type: req.body.type,
      recipient: req.body.recipientEmail,
      tenantId: tenantContext.tenantId
    });
    
    res.success(result);
  })
);

/**
 * @swagger
 * /notifications:
 *   get:
 *     tags:
 *       - Notifications
 *     summary: List notifications
 *     description: |
 *       Retrieves a paginated list of notifications for the authenticated organization.
 *       Supports filtering by type, status, and date range.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Maximum number of notifications to return
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - name: nextToken
 *         in: query
 *         description: Pagination token from previous response
 *         required: false
 *         schema:
 *           type: string
 *       - name: type
 *         in: query
 *         description: Filter by notification type
 *         required: false
 *         schema:
 *           type: string
 *           enum: [invoice_sent, payment_received, payment_failed, payment_reminder, payment_overdue, invoice_viewed]
 *       - name: status
 *         in: query
 *         description: Filter by notification status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [pending, sent, failed, cancelled]
 *       - name: startDate
 *         in: query
 *         description: Filter notifications from this date
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: endDate
 *         in: query
 *         description: Filter notifications until this date
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
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
 *                     notifications:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/NotificationQueue'
 *                     total:
 *                       type: integer
 *                       example: 42
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         hasMore:
 *                           type: boolean
 *                         nextToken:
 *                           type: string
 *                           nullable: true
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/',
  authenticateJWT,
  extractTenantContext(),
  validateRequest({ query: NotificationFilterSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const { limit, nextToken, type, status, startDate, endDate } = req.query as any;
    
    const result = await notificationService.getNotifications(tenantContext, {
      limit,
      nextToken,
      type,
      status,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    });
    
    logger.info('Notifications retrieved via API', {
      count: result.items.length,
      total: result.total,
      tenantId: tenantContext.tenantId
    });
    
    res.success({
      notifications: result.items,
      total: result.total,
      pagination: {
        hasMore: !!result.nextToken,
        nextToken: result.nextToken
      }
    });
  })
);

/**
 * @swagger
 * /notifications/{id}:
 *   get:
 *     tags:
 *       - Notifications
 *     summary: Get notification by ID
 *     description: Retrieves details of a specific notification
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Notification ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Notification retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/NotificationQueue'
 *       404:
 *         description: Notification not found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/:id',
  authenticateJWT,
  extractTenantContext(),
  validateRequest({ params: NotificationIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const notificationId = req.params.id;
    
    const notification = await notificationService.getNotificationById(tenantContext, notificationId);
    
    logger.info('Notification retrieved via API', { notificationId });
    res.success(notification);
  })
);

/**
 * @swagger
 * /notifications/{id}/retry:
 *   post:
 *     tags:
 *       - Notifications
 *     summary: Retry failed notification
 *     description: |
 *       Retries a failed notification by requeueing it for delivery.
 *       Only notifications with 'failed' status can be retried.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Notification ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Notification retry queued successfully
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
 *                       example: "Notification queued for retry"
 *                     retryAttempt:
 *                       type: integer
 *                       example: 2
 *       400:
 *         description: Notification cannot be retried (not in failed status)
 *       404:
 *         description: Notification not found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/:id/retry',
  authenticateJWT,
  extractTenantContext(),
  validateRequest({ params: NotificationIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const notificationId = req.params.id;
    
    const result = await notificationService.retryNotification(tenantContext, notificationId);
    
    logger.info('Notification retry queued via API', {
      notificationId,
      retryAttempt: result.retryAttempt
    });
    
    res.success(result);
  })
);

/**
 * @swagger
 * /notifications/stats:
 *   get:
 *     tags:
 *       - Notifications
 *     summary: Get notification statistics
 *     description: |
 *       Retrieves comprehensive statistics about notifications for the authenticated organization,
 *       including delivery rates, failure rates, and performance metrics.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: period
 *         in: query
 *         description: Time period for statistics
 *         required: false
 *         schema:
 *           type: string
 *           enum: [day, week, month, year]
 *           default: month
 *     responses:
 *       200:
 *         description: Notification statistics retrieved successfully
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
 *                     total:
 *                       type: integer
 *                       example: 1247
 *                     byStatus:
 *                       type: object
 *                       properties:
 *                         sent:
 *                           type: integer
 *                           example: 1150
 *                         failed:
 *                           type: integer
 *                           example: 47
 *                         pending:
 *                           type: integer
 *                           example: 35
 *                         cancelled:
 *                           type: integer
 *                           example: 15
 *                     byType:
 *                       type: object
 *                       properties:
 *                         invoice_sent:
 *                           type: integer
 *                           example: 425
 *                         payment_received:
 *                           type: integer
 *                           example: 380
 *                         payment_reminder:
 *                           type: integer
 *                           example: 285
 *                     deliveryRate:
 *                       type: number
 *                       example: 92.24
 *                     averageDeliveryTime:
 *                       type: number
 *                       description: Average delivery time in seconds
 *                       example: 2.5
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/stats',
  authenticateJWT,
  extractTenantContext(),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const { period = 'month' } = req.query as any;
    
    const stats = await notificationService.getNotificationStats(tenantContext, period);
    
    logger.info('Notification stats retrieved via API', {
      period,
      total: stats.total,
      tenantId: tenantContext.tenantId
    });
    
    res.success(stats);
  })
);

export const notificationRoutes = router;