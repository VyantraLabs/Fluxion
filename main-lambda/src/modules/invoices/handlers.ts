import { Router, Request, Response } from 'express';
import { InvoiceService, CreateInvoiceDto } from './service';
import { 
  CreateInvoiceSchema, 
  CreateDraftInvoiceSchema,
  UpdateInvoiceStatusSchema, 
  InvoiceFilterSchema,
  InvoiceIdSchema
} from '@/shared/validation';
import { Logger } from '@/shared/utils/logger';
import { 
  authenticateJWT, 
  optionalAuth, 
  validateRequest, 
  asyncHandler 
} from '@/shared/middleware';
import { getTenantContext, extractTenantContext } from '@/shared/middleware/tenant';
import { TenantContext } from '@/types/common';
import { InvoiceStatus } from '@/database/entities/Invoice';

const router = Router();
const invoiceService = new InvoiceService();
const logger = new Logger('InvoiceHandlers');

/**
 * @swagger
 * /invoices:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Create a new invoice with status support
 *     description: |
 *       Creates a new invoice for the authenticated user with specified payment details.
 *       Supports creating invoices in different states: draft, created, initiated, or sent.
 *       Draft invoices allow partial data for saving work in progress.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 255
 *                 example: "Web Development Services"
 *               description:
 *                 type: string
 *                 example: "Frontend development and smart contract integration"
 *               clientName:
 *                 type: string
 *                 maxLength: 255
 *                 example: "Acme Corporation"
 *               clientEmail:
 *                 type: string
 *                 format: email
 *                 example: "client@acme.com"
 *               clientWallet:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 example: "0x742d35Cc6635C0532925a3b8D0aC0199845F8A0E"
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 example: 2500.00
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-10-15T12:00:00.000Z"
 *               networkId:
 *                 type: number
 *                 example: 137
 *                 description: Blockchain network chain ID
 *               tokenId:
 *                 type: string
 *                 format: uuid
 *                 example: "f6ec8763-b80f-4031-a420-100213e0be73"
 *               status:
 *                 type: string
 *                 enum: [draft, created, initiated, sent]
 *                 default: draft
 *                 example: "draft"
 *                 description: Invoice status - draft allows partial data
 *           examples:
 *             complete_invoice:
 *               summary: Complete invoice ready to send
 *               value:
 *                 title: "Web Development Services"
 *                 description: "Frontend development and smart contract integration"
 *                 clientName: "Acme Corporation"
 *                 clientEmail: "client@acme.com"
 *                 clientWallet: "0x742d35Cc6635C0532925a3b8D0aC0199845F8A0E"
 *                 amount: 2500.00
 *                 dueDate: "2025-10-15T12:00:00.000Z"
 *                 networkId: 137
 *                 tokenId: "f6ec8763-b80f-4031-a420-100213e0be73"
 *                 status: "created"
 *             draft_invoice:
 *               summary: Draft invoice with minimal data
 *               value:
 *                 title: "Project Draft"
 *                 status: "draft"
 *     responses:
 *       201:
 *         description: Invoice created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Invoice'
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
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const userId = req.context?.userId!; // Use userId from JWT token
    const walletAddress = req.context?.walletAddress!; // For logging
    
    // Determine the requested status 
    const requestedStatus = req.body.status || 'draft';
    const isDraft = requestedStatus === 'draft';
    
    try {
      // Set the status in the request body for validation
      const requestBodyWithStatus = { ...req.body, status: requestedStatus };
      
      // Use unified validation schema - it will handle draft vs complete validation automatically
      const validatedBody = CreateInvoiceSchema.parse(requestBodyWithStatus);
      
      // Build invoice data, only including fields that are provided
      const invoiceData: Partial<CreateInvoiceDto> = {
        status: requestedStatus
      };
      
      // Only add fields that were actually provided (not undefined)
      if (validatedBody.title !== undefined) invoiceData.title = validatedBody.title;
      if (validatedBody.description !== undefined) invoiceData.description = validatedBody.description;
      if (validatedBody.clientName !== undefined) invoiceData.clientName = validatedBody.clientName;
      if (validatedBody.clientEmail !== undefined) invoiceData.clientEmail = validatedBody.clientEmail;
      if (validatedBody.clientWallet !== undefined) invoiceData.clientWallet = validatedBody.clientWallet;
      if (validatedBody.amount !== undefined) invoiceData.amount = validatedBody.amount;
      if (validatedBody.dueDate !== undefined) invoiceData.dueDate = validatedBody.dueDate;
      if (validatedBody.networkId !== undefined) invoiceData.networkId = validatedBody.networkId.toString();
      if (validatedBody.tokenId !== undefined) invoiceData.tokenId = validatedBody.tokenId;
      
      // For drafts, save exactly as provided by user - no defaults or modifications
      
      const invoice = await invoiceService.createInvoice(tenantContext, userId, invoiceData as CreateInvoiceDto);
      
      logger.info('Invoice created via unified API', { 
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: requestedStatus,
        isDraft,
        userId,
        walletAddress,
        tenantId: tenantContext.tenantId
      });
      
      res.success(invoice, 201);
    } catch (validationError: any) {
      if (validationError.name === 'ZodError') {
        const formattedErrors = validationError.errors.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));
        
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data',
            details: formattedErrors
          }
        });
      }
      throw validationError;
    }
  })
);

// DEPRECATED: /invoices/draft endpoint removed in favor of unified POST /invoices with status parameter
// Use POST /invoices with { "status": "draft" } instead

/**
 * @swagger
 * /invoices:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get invoices for authenticated user
 *     description: |
 *       Retrieves a paginated list of invoices created by the authenticated user.
 *       Supports filtering by status and pagination with cursor-based tokens.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Maximum number of invoices to return
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *           example: 20
 *       - name: nextToken
 *         in: query
 *         description: Pagination token from previous response
 *         required: false
 *         schema:
 *           type: string
 *           example: "eyJjcmVhdGVkQXQiOiIyMDI1LTA5LTAzVDA5OjAwOjAwLjAwMFoifQ=="
 *       - name: status
 *         in: query
 *         description: Filter invoices by status
 *         required: false
 *         schema:
 *           type: string
 *           enum: [draft, sent, paid, overdue, cancelled, partial]
 *           example: "sent"
 *     responses:
 *       200:
 *         description: User invoices retrieved successfully
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
 *                     invoices:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Invoice'
 *                     total:
 *                       type: integer
 *                       example: 42
 *                       description: Total number of invoices for user
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         hasMore:
 *                           type: boolean
 *                           example: true
 *                           description: Whether more results are available
 *                         nextToken:
 *                           type: string
 *                           nullable: true
 *                           example: "eyJjcmVhdGVkQXQiOiIyMDI1LTA5LTAzVDA5OjAwOjAwLjAwMFoifQ=="
 *                           description: Token for next page of results
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/', 
  authenticateJWT,
  extractTenantContext(),
  validateRequest({ query: InvoiceFilterSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.context!.userId!; // Use userId from JWT token
    const walletAddress = req.context!.walletAddress!; // For logging
    const tenantContext = getTenantContext(req);
    const { limit, nextToken, status } = req.query as any;
    
    const result = await invoiceService.getUserInvoices(tenantContext, userId, {
      limit,
      nextToken,
      status
    });
    
    logger.info('User invoices retrieved via API', { 
      userId,
      walletAddress,
      count: result.items.length,
      total: result.total
    });
    res.success({
      invoices: result.items,
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
 * /invoices/stats:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get invoice statistics for authenticated user
 *     description: |
 *       Retrieves comprehensive statistics about the authenticated user's invoices including
 *       counts by status, total amounts, overdue invoices, and invoices due soon.
 *       This endpoint is used for dashboard analytics and overview displays.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Invoice statistics retrieved successfully
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
 *                       example: 42
 *                       description: Total number of invoices
 *                     byStatus:
 *                       type: object
 *                       properties:
 *                         draft:
 *                           type: integer
 *                           example: 5
 *                         sent:
 *                           type: integer
 *                           example: 12
 *                         paid:
 *                           type: integer
 *                           example: 20
 *                         overdue:
 *                           type: integer
 *                           example: 3
 *                         cancelled:
 *                           type: integer
 *                           example: 1
 *                         partial:
 *                           type: integer
 *                           example: 1
 *                       description: Count of invoices by status
 *                     totalAmount:
 *                       type: string
 *                       example: "125000.50"
 *                       description: Total amount of all invoices
 *                     totalPaidAmount:
 *                       type: string
 *                       example: "98750.25"
 *                       description: Total amount paid across all invoices
 *                     overdue:
 *                       type: integer
 *                       example: 3
 *                       description: Number of overdue invoices
 *                     dueSoon:
 *                       type: integer
 *                       example: 2
 *                       description: Number of invoices due within 7 days
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
router.get('/stats', 
  authenticateJWT,
  extractTenantContext(),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.context?.userId!; // Use userId from JWT token
    const walletAddress = req.context?.walletAddress!; // For logging
    const tenantContext = getTenantContext(req);
    
    const stats = await invoiceService.getDashboardStats(tenantContext, userId);
    
    logger.info('Invoice stats retrieved via API', { 
      userId,
      walletAddress,
      stats: {
        total: stats.total,
        overdue: stats.overdue,
        dueSoon: stats.dueSoon
      }
    });
    res.success(stats);
  })
);

/**
 * @swagger
 * /invoices/{id}:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get invoice by ID
 *     description: |
 *       Retrieves a specific invoice by its unique ID. The authenticated user must have
 *       access to the invoice (must be in the same organization). Returns full invoice
 *       details including payment status, client information, and computed fields.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Unique invoice ID
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Invoice retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Invoice'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Invoice not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "NOT_FOUND"
 *                     message:
 *                       type: string
 *                       example: "Invoice not found"
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/:id', 
  authenticateJWT,
  extractTenantContext(),
  validateRequest({ params: InvoiceIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const invoiceId = req.params.id;
    const tenantContext = getTenantContext(req);
    
    const invoice = await invoiceService.getInvoiceById(tenantContext, invoiceId);
    
    logger.info('Invoice retrieved via API', { invoiceId });
    res.success(invoice);
  })
);

/**
 * @swagger
 * /invoices/{id}/public:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get public invoice data (for payment page)
 *     description: |
 *       Retrieves public invoice information for payment processing. This endpoint
 *       does not require authentication and is used by the payment page to display
 *       invoice details to clients. Sensitive information is excluded from the response.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Unique invoice ID
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Public invoice data retrieved successfully
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
 *                       format: uuid
 *                       example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *                     title:
 *                       type: string
 *                       example: "Web Development Services"
 *                     description:
 *                       type: string
 *                       example: "Frontend development and smart contract integration"
 *                     amount:
 *                       type: string
 *                       example: "2500.00"
 *                       description: Invoice amount in token units
 *                     dueDate:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-10-15T12:00:00.000Z"
 *                     clientName:
 *                       type: string
 *                       example: "Acme Corporation"
 *                     clientEmail:
 *                       type: string
 *                       example: "client@acme.com"
 *                     status:
 *                       type: string
 *                       enum: [draft, sent, paid, overdue, cancelled, partial]
 *                       example: "sent"
 *                     networkId:
 *                       type: string
 *                       format: uuid
 *                       example: "1501e461-3295-4b7c-bd4a-a0643b7c9a93"
 *                     tokenId:
 *                       type: string
 *                       format: uuid
 *                       example: "f6ec8763-b80f-4031-a420-100213e0be73"
 *                     network:
 *                       $ref: '#/components/schemas/BlockchainNetwork'
 *                     token:
 *                       $ref: '#/components/schemas/Token'
 *                     paymentUrl:
 *                       type: string
 *                       format: uri
 *                       example: "https://fluxion.app/invoice/a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-09-03T12:00:00.000Z"
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-09-03T12:05:00.000Z"
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         description: Invoice not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/:id/public',
  validateRequest({ params: InvoiceIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const invoiceId = req.params.id;
    const invoice = await invoiceService.getPublicInvoice(invoiceId);
    
    logger.info('Public invoice retrieved via API', { invoiceId });
    res.success(invoice);
  })
);

/**
 * @swagger
 * /invoices/{id}/status:
 *   put:
 *     tags:
 *       - Invoices
 *     summary: Update invoice status
 *     description: |
 *       Updates the status of an existing invoice. Only valid status transitions are allowed.
 *       Valid transitions: draft→sent/cancelled, sent→paid/overdue/cancelled/partial, 
 *       overdue→paid/cancelled/partial, partial→paid/overdue/cancelled.
 *       Paid and cancelled are terminal states.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Unique invoice ID
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [draft, sent, paid, overdue, cancelled, partial]
 *                 example: "sent"
 *                 description: New invoice status
 *           examples:
 *             mark_as_sent:
 *               summary: Mark invoice as sent
 *               value:
 *                 status: "sent"
 *             mark_as_paid:
 *               summary: Mark invoice as paid
 *               value:
 *                 status: "paid"
 *             cancel_invoice:
 *               summary: Cancel invoice
 *               value:
 *                 status: "cancelled"
 *     responses:
 *       200:
 *         description: Invoice status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Invoice'
 *       400:
 *         description: Invalid status transition or validation error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "VALIDATION_ERROR"
 *                     message:
 *                       type: string
 *                       example: "Cannot change status from paid to draft"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Invoice not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.put('/:id/status', 
  authenticateJWT,
  extractTenantContext(),
  validateRequest({ 
    params: InvoiceIdSchema,
    body: UpdateInvoiceStatusSchema 
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const invoiceId = req.params.id;
    const tenantContext = getTenantContext(req);
    const { status } = req.body;
    
    const invoice = await invoiceService.updateInvoiceStatus(tenantContext, invoiceId, status as InvoiceStatus);
    
    logger.info('Invoice status updated via API', { 
      invoiceId,
      newStatus: status
    });
    res.success(invoice);
  })
);

// Remove the DELETE endpoint as it's not in the requirements

// Remove the send endpoint as status updates are handled via PUT /invoices/:id/status

// Remove dashboard stats endpoint as it's not in the current requirements

/**
 * @swagger
 * /invoices/{id}/share:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Generate shareable link for invoice
 *     description: |
 *       Generates a shareable public link for an invoice that can be sent to clients
 *       for payment. The generated link points to the public payment page where
 *       clients can view invoice details and make payments without authentication.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Unique invoice ID
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *     responses:
 *       200:
 *         description: Shareable link generated successfully
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
 *                     shareableLink:
 *                       type: string
 *                       format: uri
 *                       example: "https://fluxion.app/invoice/a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *                       description: Public URL where clients can view and pay the invoice
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Invoice not found or user lacks access
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "NOT_FOUND"
 *                     message:
 *                       type: string
 *                       example: "Invoice not found"
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/:id/share',
  authenticateJWT,
  extractTenantContext(),
  validateRequest({ params: InvoiceIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const invoiceId = req.params.id;
    const tenantContext = getTenantContext(req);
    
    // First verify the invoice exists and user has access
    await invoiceService.getInvoiceById(tenantContext, invoiceId);
    
    // Generate shareable link
    const shareableLink = invoiceService.generateShareableLink(invoiceId);
    
    logger.info('Shareable link generated via API', { invoiceId });
    res.success({ shareableLink });
  })
);

/**
 * @swagger
 * /invoices/from-template:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Create invoice from template
 *     description: |
 *       Creates a new invoice using an existing template. Template variables will be
 *       substituted with provided data and defaults from the template will be applied.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - templateId
 *               - clientName
 *               - clientEmail
 *               - amount
 *             properties:
 *               templateId:
 *                 type: string
 *                 format: uuid
 *                 example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *               clientName:
 *                 type: string
 *                 maxLength: 255
 *                 example: "Acme Corporation"
 *               clientEmail:
 *                 type: string
 *                 format: email
 *                 example: "client@acme.com"
 *               clientWallet:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 example: "0x742d35Cc6635C0532925a3b8D0aC0199845F8A0E"
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *                 example: 2500.00
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2025-10-15T12:00:00.000Z"
 *               customData:
 *                 type: object
 *                 description: Custom data for template variable substitution
 *                 example:
 *                   project_id: "PROJ-2025-001"
 *                   service_period: "September 2025"
 *     responses:
 *       201:
 *         description: Invoice created from template successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Invoice'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         description: Template not found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/from-template', 
  authenticateJWT,
  extractTenantContext(),
  validateRequest({ body: require('@/shared/validation/templates').CreateInvoiceFromTemplateSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const userId = req.context?.userId!; // Use userId from JWT token
    const walletAddress = req.context?.walletAddress!; // For logging
    
    // Import template service dynamically to avoid circular dependencies
    const { TemplateService } = await import('@/modules/templates/service');
    const templateService = new TemplateService();
    
    const { templateId, ...invoiceData } = req.body;
    
    // Create invoice data from template
    const templateInvoiceData = await templateService.createInvoiceFromTemplate(
      tenantContext, 
      templateId, 
      invoiceData
    );
    
    // Create the actual invoice using existing service
    const finalInvoiceData: CreateInvoiceDto = {
      title: templateInvoiceData.title,
      description: templateInvoiceData.description,
      clientName: templateInvoiceData.clientName,
      clientEmail: templateInvoiceData.clientEmail,
      clientWallet: templateInvoiceData.clientWallet,
      amount: templateInvoiceData.amount,
      dueDate: templateInvoiceData.dueDate,
      networkId: templateInvoiceData.networkId || req.body.networkId,
      tokenId: templateInvoiceData.tokenId || req.body.tokenId
    };
    
    const invoice = await invoiceService.createInvoice(tenantContext, userId, finalInvoiceData);
    
    logger.info('Invoice created from template via API', { 
      invoiceId: invoice.id,
      templateId,
      invoiceNumber: invoice.invoiceNumber,
      userId,
      walletAddress
    });
    
    res.success(invoice, 201);
  })
);

/**
 * @swagger
 * /invoices/{id}/generate-access-token:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Generate client access token
 *     description: |
 *       Generates a temporary access token that allows clients to view invoice details
 *       without authentication. Useful for sharing invoice links via email.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Unique invoice ID
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               expiresIn:
 *                 type: integer
 *                 description: Token expiration time in hours (default 72 hours)
 *                 minimum: 1
 *                 maximum: 168
 *                 default: 72
 *                 example: 72
 *     responses:
 *       201:
 *         description: Access token generated successfully
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
 *                     accessToken:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                     publicUrl:
 *                       type: string
 *                       format: uri
 *                       example: "https://fluxion.app/invoice/abc123def?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-09-06T12:00:00.000Z"
 *       404:
 *         description: Invoice not found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/:id/generate-access-token',
  authenticateJWT,
  extractTenantContext(),
  validateRequest({ params: InvoiceIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const invoiceId = req.params.id;
    const tenantContext = getTenantContext(req);
    const expiresIn = req.body?.expiresIn || 72; // Default 72 hours
    
    // Verify invoice exists and user has access
    await invoiceService.getInvoiceById(tenantContext, invoiceId);
    
    // Generate client access token
    const tokenData = await invoiceService.generateClientAccessToken(tenantContext, invoiceId, expiresIn);
    
    logger.info('Client access token generated via API', { 
      invoiceId,
      expiresIn 
    });
    
    res.success(tokenData, 201);
  })
);

/**
 * @swagger
 * /invoices/{id}/qr-code:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Generate payment QR code data
 *     description: |
 *       Generates QR code data for invoice payment. Returns the data needed to create
 *       a QR code that contains payment information for wallet apps.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Unique invoice ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: QR code data generated successfully
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
 *                     qrData:
 *                       type: string
 *                       example: "ethereum:0x742d35Cc6635C0532925a3b8D0aC0199845F8A0E@137?value=2500000000000000000000&gas=21000"
 *                     paymentUrl:
 *                       type: string
 *                       format: uri
 *                       example: "https://fluxion.app/invoice/abc123def"
 *                     walletDeepLink:
 *                       type: string
 *                       example: "metamask://send?to=0x742d35Cc6635C0532925a3b8D0aC0199845F8A0E&value=2500000000000000000000"
 *       404:
 *         description: Invoice not found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/:id/qr-code',
  authenticateJWT,
  extractTenantContext(),
  validateRequest({ params: InvoiceIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const invoiceId = req.params.id;
    const tenantContext = getTenantContext(req);
    
    const qrCodeData = await invoiceService.generateQRCodeData(tenantContext, invoiceId);
    
    logger.info('QR code data generated via API', { invoiceId });
    res.success(qrCodeData);
  })
);

/**
 * @swagger
 * /invoices/{id}/send-email:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Send invoice via email
 *     description: |
 *       Sends the invoice to the client via email with a secure payment link.
 *       Optionally includes a custom message from the sender.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Unique invoice ID
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               customMessage:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Thank you for your business! Please find your invoice attached."
 *               sendCopy:
 *                 type: boolean
 *                 default: false
 *                 example: true
 *                 description: Send a copy to the invoice creator
 *     responses:
 *       200:
 *         description: Email sent successfully
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
 *                       example: "Invoice email sent successfully"
 *                     sentAt:
 *                       type: string
 *                       format: date-time
 *                       example: "2025-09-05T12:00:00.000Z"
 *                     recipient:
 *                       type: string
 *                       example: "client@acme.com"
 *       404:
 *         description: Invoice not found
 *       400:
 *         description: Cannot send email (e.g., invoice already paid)
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/:id/send-email',
  authenticateJWT,
  extractTenantContext(),
  validateRequest({ params: InvoiceIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const invoiceId = req.params.id;
    const tenantContext = getTenantContext(req);
    const { customMessage, sendCopy } = req.body || {};
    
    const result = await invoiceService.sendInvoiceEmail(
      tenantContext, 
      invoiceId, 
      customMessage,
      sendCopy
    );
    
    logger.info('Invoice email sent via API', { 
      invoiceId,
      recipient: result.recipient
    });
    
    res.success(result);
  })
);

/**
 * @swagger
 * /invoices/{id}/payment:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Submit payment transaction hash
 *     description: |
 *       Submits a blockchain transaction hash for invoice payment verification.
 *       The system will verify the transaction on-chain and update the invoice status.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Unique invoice ID
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - txHash
 *               - fromAddress
 *             properties:
 *               txHash:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{64}$'
 *                 example: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
 *               fromAddress:
 *                 type: string
 *                 pattern: '^0x[a-fA-F0-9]{40}$'
 *                 example: "0x742d35Cc6635C0532925a3b8D0aC0199845F8A0E"
 *     responses:
 *       200:
 *         description: Payment submitted successfully
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
 *                     paymentId:
 *                       type: string
 *                       format: uuid
 *                       example: "p1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *                     status:
 *                       type: string
 *                       enum: [pending, confirmed, failed]
 *                       example: "pending"
 *                     message:
 *                       type: string
 *                       example: "Payment submitted for verification"
 *       400:
 *         description: Invalid payment data or invoice cannot accept payments
 *       404:
 *         description: Invoice not found
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/:id/payment',
  validateRequest({ params: InvoiceIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const invoiceId = req.params.id;
    const { txHash, fromAddress } = req.body;
    
    // Import payment service
    const { PaymentService } = await import('@/modules/payments/service');
    const paymentService = new PaymentService();
    
    const result = await paymentService.submitPayment(invoiceId, txHash, fromAddress);
    
    logger.info('Payment submitted via API', { 
      invoiceId,
      paymentId: result.paymentId,
      txHash
    });
    
    res.success(result);
  })
);

/**
 * @swagger
 * /invoices/{id}/payment-status:
 *   get:
 *     tags:
 *       - Invoices
 *     summary: Get payment verification status
 *     description: |
 *       Retrieves the current payment verification status for an invoice,
 *       including any pending or completed payments.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Unique invoice ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Payment status retrieved successfully
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
 *                     invoiceStatus:
 *                       type: string
 *                       enum: [draft, sent, paid, overdue, cancelled, partial]
 *                       example: "sent"
 *                     payments:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           paymentId:
 *                             type: string
 *                             format: uuid
 *                           txHash:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: [pending, confirmed, failed]
 *                           amount:
 *                             type: string
 *                           verifiedAt:
 *                             type: string
 *                             format: date-time
 *                             nullable: true
 *                     totalPaid:
 *                       type: string
 *                       example: "2500.00"
 *                     remainingAmount:
 *                       type: string
 *                       example: "0.00"
 *       404:
 *         description: Invoice not found
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/:id/payment-status',
  validateRequest({ params: InvoiceIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const invoiceId = req.params.id;
    
    const paymentStatus = await invoiceService.getPaymentStatus(invoiceId);
    
    logger.info('Payment status retrieved via API', { invoiceId });
    res.success(paymentStatus);
  })
);

/**
 * @swagger
 * /invoices/{id}/verify-payment:
 *   post:
 *     tags:
 *       - Invoices
 *     summary: Manual payment verification trigger
 *     description: |
 *       Manually triggers payment verification for pending payments.
 *       Useful for re-checking payments that may have been missed by automatic verification.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Unique invoice ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Payment verification triggered successfully
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
 *                       example: "Payment verification triggered"
 *                     verificationsStarted:
 *                       type: integer
 *                       example: 2
 *       404:
 *         description: Invoice not found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/:id/verify-payment',
  authenticateJWT,
  extractTenantContext(),
  validateRequest({ params: InvoiceIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const invoiceId = req.params.id;
    const tenantContext = getTenantContext(req);
    
    const result = await invoiceService.triggerPaymentVerification(tenantContext, invoiceId);
    
    logger.info('Manual payment verification triggered via API', { 
      invoiceId,
      verificationsStarted: result.verificationsStarted
    });
    
    res.success(result);
  })
);

export const invoiceRoutes = router;