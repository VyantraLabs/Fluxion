import { Router, Request, Response } from 'express';
import { ReminderService } from './service';
import { 
  CreateReminderSchema,
  UpdateReminderSchema,
  ReminderFilterSchema,
  ReminderIdSchema,
  BulkReminderSchema
} from '../../shared/validation/reminders';
import { Logger } from '../../shared/utils/logger';
import { 
  authenticateJWT, 
  validateRequest, 
  asyncHandler 
} from '../../shared/middleware';
import { getTenantContext, extractTenantContext } from '../../shared/middleware/tenant';

const router = Router();
const reminderService = new ReminderService();
const logger = new Logger('ReminderHandlers');

/**
 * @swagger
 * /reminders:
 *   get:
 *     tags:
 *       - Reminders
 *     summary: List invoice reminders
 *     description: |
 *       Retrieves a paginated list of invoice reminders for the authenticated organization.
 *       Supports filtering by status, type, and date ranges.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Maximum number of reminders to return
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
 *       - name: status
 *         in: query
 *         description: Filter reminders by status
 *         required: false
 *         schema:
 *           type: string
 *           enum: ['scheduled', 'pending', 'processing', 'sent', 'failed', 'cancelled', 'skipped']
 *       - name: type
 *         in: query
 *         description: Filter reminders by type
 *         required: false
 *         schema:
 *           type: string
 *           enum: ['due_date', 'overdue', 'payment_pending', 'custom']
 *       - name: invoiceId
 *         in: query
 *         description: Filter reminders for specific invoice
 *         required: false
 *         schema:
 *           type: string
 *       - name: scheduledFrom
 *         in: query
 *         description: Filter reminders scheduled after this date
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *       - name: scheduledTo
 *         in: query
 *         description: Filter reminders scheduled before this date
 *         required: false
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Reminders retrieved successfully
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
 *                     reminders:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ReminderJob'
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
  validateRequest({ query: ReminderFilterSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const filters = req.query as any;
    
    const result = await reminderService.searchReminders(tenantContext, filters);
    
    logger.info('Reminders retrieved via API', { 
      tenantId: tenantContext.tenantId,
      count: result.items.length,
      total: result.total
    });
    
    res.success({
      reminders: result.items,
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
 * /reminders/stats:
 *   get:
 *     tags:
 *       - Reminders
 *     summary: Get reminder statistics
 *     description: |
 *       Retrieves statistics about reminders for the authenticated organization,
 *       including counts by status, type, and effectiveness metrics.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reminder statistics retrieved successfully
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
 *                       example: 156
 *                     byStatus:
 *                       type: object
 *                       properties:
 *                         scheduled:
 *                           type: integer
 *                         sent:
 *                           type: integer
 *                         failed:
 *                           type: integer
 *                         cancelled:
 *                           type: integer
 *                     byType:
 *                       type: object
 *                       properties:
 *                         due_date:
 *                           type: integer
 *                         overdue:
 *                           type: integer
 *                         custom:
 *                           type: integer
 *                     effectiveness:
 *                       type: object
 *                       properties:
 *                         paymentRate:
 *                           type: number
 *                           format: float
 *                           example: 0.73
 *                         avgResponseTime:
 *                           type: number
 *                           format: float
 *                           example: 2.5
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
    
    const stats = await reminderService.getReminderStats(tenantContext);
    
    logger.info('Reminder statistics retrieved via API', { 
      tenantId: tenantContext.tenantId,
      total: stats.total
    });
    
    res.success(stats);
  })
);

/**
 * @swagger
 * /reminders/{id}:
 *   get:
 *     tags:
 *       - Reminders
 *     summary: Get reminder by ID
 *     description: Retrieves a specific reminder by its ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Unique reminder ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Reminder retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ReminderJob'
 *       404:
 *         description: Reminder not found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/:id', 
  authenticateJWT,
  extractTenantContext(),
  validateRequest({ params: ReminderIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const reminderId = req.params.id;
    const tenantContext = getTenantContext(req);
    
    const reminder = await reminderService.getReminderById(tenantContext, reminderId);
    
    logger.info('Reminder retrieved via API', { reminderId });
    res.success(reminder);
  })
);

/**
 * @swagger
 * /reminders:
 *   post:
 *     tags:
 *       - Reminders
 *     summary: Create a new reminder
 *     description: Creates a new reminder for an invoice
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - invoiceId
 *               - type
 *               - configuration
 *             properties:
 *               invoiceId:
 *                 type: string
 *                 description: ID of the invoice to create reminder for
 *               type:
 *                 type: string
 *                 enum: ['due_date', 'overdue', 'payment_pending', 'custom']
 *                 example: "due_date"
 *               configuration:
 *                 type: object
 *                 description: Reminder configuration settings
 *                 properties:
 *                   intervalDays:
 *                     type: integer
 *                     description: Days before/after due date
 *                     example: 7
 *                   isOverdueReminder:
 *                     type: boolean
 *                     description: Whether this is an overdue reminder
 *                     example: false
 *                   businessDaysOnly:
 *                     type: boolean
 *                     example: false
 *                   excludeWeekends:
 *                     type: boolean
 *                     example: false
 *                   reminderTime:
 *                     type: string
 *                     pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                     example: "09:00"
 *                   timezone:
 *                     type: string
 *                     example: "UTC"
 *                   customMessage:
 *                     type: string
 *                     example: "Your invoice is due soon. Please pay by the due date."
 *                   webhookEnabled:
 *                     type: boolean
 *                     example: true
 *                   smsEnabled:
 *                     type: boolean
 *                     example: false
 *               priority:
 *                 type: string
 *                 enum: ['low', 'normal', 'high', 'urgent']
 *                 default: 'normal'
 *               maxOccurrences:
 *                 type: integer
 *                 minimum: 1
 *                 description: Maximum number of times this reminder should be sent
 *                 example: 1
 *               scheduledFor:
 *                 type: string
 *                 format: date-time
 *                 description: When to send the reminder (optional, calculated if not provided)
 *     responses:
 *       201:
 *         description: Reminder created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ReminderJob'
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
  validateRequest({ body: CreateReminderSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const userId = req.context?.userId;
    
    const reminder = await reminderService.createReminder(
      tenantContext,
      req.body,
      userId
    );
    
    logger.info('Reminder created via API', { 
      reminderId: reminder.id,
      invoiceId: req.body.invoiceId,
      type: req.body.type,
      userId
    });
    
    res.success(reminder, 201);
  })
);

/**
 * @swagger
 * /reminders/{id}:
 *   put:
 *     tags:
 *       - Reminders
 *     summary: Update a reminder
 *     description: Updates an existing reminder
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Unique reminder ID
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               configuration:
 *                 type: object
 *                 description: Updated reminder configuration
 *               priority:
 *                 type: string
 *                 enum: ['low', 'normal', 'high', 'urgent']
 *               scheduledFor:
 *                 type: string
 *                 format: date-time
 *                 description: Reschedule the reminder
 *               maxOccurrences:
 *                 type: integer
 *                 minimum: 1
 *     responses:
 *       200:
 *         description: Reminder updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ReminderJob'
 *       404:
 *         description: Reminder not found
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.put('/:id', 
  authenticateJWT,
  extractTenantContext(),
  validateRequest({ 
    params: ReminderIdSchema,
    body: UpdateReminderSchema 
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const reminderId = req.params.id;
    const tenantContext = getTenantContext(req);
    
    const reminder = await reminderService.updateReminder(
      tenantContext,
      reminderId,
      req.body
    );
    
    logger.info('Reminder updated via API', { reminderId });
    res.success(reminder);
  })
);

/**
 * @swagger
 * /reminders/{id}:
 *   delete:
 *     tags:
 *       - Reminders
 *     summary: Cancel a reminder
 *     description: Cancels a scheduled reminder
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Unique reminder ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Reminder cancelled successfully
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
 *                       example: "Reminder cancelled successfully"
 *       404:
 *         description: Reminder not found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.delete('/:id', 
  authenticateJWT,
  extractTenantContext(),
  validateRequest({ params: ReminderIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const reminderId = req.params.id;
    const tenantContext = getTenantContext(req);
    
    await reminderService.cancelReminder(tenantContext, reminderId);
    
    logger.info('Reminder cancelled via API', { reminderId });
    res.success({ message: 'Reminder cancelled successfully' });
  })
);

/**
 * @swagger
 * /reminders/invoice/{invoiceId}:
 *   get:
 *     tags:
 *       - Reminders
 *     summary: Get reminders for specific invoice
 *     description: Retrieves all reminders for a specific invoice
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: invoiceId
 *         in: path
 *         required: true
 *         description: Invoice ID to get reminders for
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Invoice reminders retrieved successfully
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
 *                     $ref: '#/components/schemas/ReminderJob'
 *       404:
 *         description: Invoice not found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/invoice/:invoiceId', 
  authenticateJWT,
  extractTenantContext(),
  asyncHandler(async (req: Request, res: Response) => {
    const invoiceId = req.params.invoiceId;
    const tenantContext = getTenantContext(req);
    
    const reminders = await reminderService.getInvoiceReminders(
      tenantContext,
      invoiceId
    );
    
    logger.info('Invoice reminders retrieved via API', { 
      invoiceId,
      count: reminders.length 
    });
    res.success(reminders);
  })
);

/**
 * @swagger
 * /reminders/invoice/{invoiceId}/setup:
 *   post:
 *     tags:
 *       - Reminders
 *     summary: Setup default reminders for invoice
 *     description: |
 *       Automatically sets up a standard reminder schedule for an invoice
 *       based on the organization's notification settings or template configuration.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: invoiceId
 *         in: path
 *         required: true
 *         description: Invoice ID to setup reminders for
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reminderType:
 *                 type: string
 *                 enum: ['standard', 'aggressive', 'minimal', 'custom']
 *                 default: 'standard'
 *                 description: Type of reminder schedule to setup
 *               customSchedule:
 *                 type: object
 *                 description: Custom reminder schedule (required if type is 'custom')
 *                 properties:
 *                   dueDateReminders:
 *                     type: array
 *                     items:
 *                       type: integer
 *                     example: [7, 3, 1]
 *                     description: Days before due date to send reminders
 *                   overdueReminders:
 *                     type: array
 *                     items:
 *                       type: integer
 *                     example: [1, 7, 14]
 *                     description: Days after due date to send reminders
 *               replaceExisting:
 *                 type: boolean
 *                 default: false
 *                 description: Whether to replace existing reminders
 *     responses:
 *       201:
 *         description: Reminders setup successfully
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
 *                     reminders:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ReminderJob'
 *                     setupType:
 *                       type: string
 *                       example: "standard"
 *                     totalCreated:
 *                       type: integer
 *                       example: 5
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         description: Invoice not found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/invoice/:invoiceId/setup', 
  authenticateJWT,
  extractTenantContext(),
  asyncHandler(async (req: Request, res: Response) => {
    const invoiceId = req.params.invoiceId;
    const tenantContext = getTenantContext(req);
    const userId = req.context?.userId;
    
    const { reminderType = 'standard', customSchedule, replaceExisting = false } = req.body;
    
    const result = await reminderService.setupInvoiceReminders(
      tenantContext,
      invoiceId,
      reminderType,
      customSchedule,
      replaceExisting,
      userId
    );
    
    logger.info('Invoice reminders setup via API', { 
      invoiceId,
      reminderType,
      totalCreated: result.reminders.length
    });
    
    res.success(result, 201);
  })
);

/**
 * @swagger
 * /reminders/bulk/create:
 *   post:
 *     tags:
 *       - Reminders
 *     summary: Create bulk reminders for multiple invoices
 *     description: |
 *       Creates reminders for multiple invoices in a single request.
 *       Useful for batch processing overdue invoices or setting up reminders
 *       for newly created invoices.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - invoiceIds
 *               - reminderType
 *             properties:
 *               invoiceIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 100
 *                 description: Array of invoice IDs to create reminders for
 *               reminderType:
 *                 type: string
 *                 enum: ['due_date', 'overdue', 'custom']
 *                 description: Type of reminders to create
 *               configuration:
 *                 type: object
 *                 description: Common configuration for all reminders
 *               replaceExisting:
 *                 type: boolean
 *                 default: false
 *                 description: Whether to replace existing reminders
 *     responses:
 *       201:
 *         description: Bulk reminders created successfully
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
 *                     created:
 *                       type: integer
 *                       example: 25
 *                     skipped:
 *                       type: integer
 *                       example: 3
 *                     failed:
 *                       type: integer
 *                       example: 0
 *                     results:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           invoiceId:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: ['created', 'skipped', 'failed']
 *                           reminderId:
 *                             type: string
 *                             nullable: true
 *                           error:
 *                             type: string
 *                             nullable: true
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/bulk/create', 
  authenticateJWT,
  extractTenantContext(),
  validateRequest({ body: BulkReminderSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const userId = req.context?.userId;
    
    const result = await reminderService.createBulkReminders(
      tenantContext,
      req.body,
      userId
    );
    
    logger.info('Bulk reminders created via API', { 
      total: req.body.invoiceIds.length,
      created: result.created,
      skipped: result.skipped,
      failed: result.failed
    });
    
    res.success(result, 201);
  })
);


/**
 * @swagger
 * /reminders/{id}/execute:
 *   post:
 *     tags:
 *       - Reminders
 *     summary: Manually execute a reminder
 *     description: |
 *       Manually triggers the execution of a scheduled reminder.
 *       This is useful for testing or immediate delivery.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Unique reminder ID
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Reminder executed successfully
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
 *                     executed:
 *                       type: boolean
 *                       example: true
 *                     notificationId:
 *                       type: string
 *                       example: "01HKQB2..."
 *                     message:
 *                       type: string
 *                       example: "Reminder executed successfully"
 *       404:
 *         description: Reminder not found
 *       400:
 *         description: Reminder cannot be executed (wrong status)
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/:id/execute', 
  authenticateJWT,
  extractTenantContext(),
  validateRequest({ params: ReminderIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const reminderId = req.params.id;
    const tenantContext = getTenantContext(req);
    
    const result = await reminderService.executeReminder(tenantContext, reminderId);
    
    logger.info('Reminder manually executed via API', { 
      reminderId,
      notificationId: result.notificationId
    });
    
    res.success(result);
  })
);

export const reminderRoutes = router;