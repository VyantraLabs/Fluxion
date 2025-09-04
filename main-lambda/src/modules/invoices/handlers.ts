import { Router, Request, Response } from 'express';
import { InvoiceService } from './service';
import { 
  CreateInvoiceSchema, 
  UpdateInvoiceSchema, 
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

const router = Router();
const invoiceService = new InvoiceService();
const logger = new Logger('InvoiceHandlers');

/**
 * Create a new invoice
 * POST /invoices
 */
router.post('/', 
  authenticateJWT,
  validateRequest({ body: CreateInvoiceSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    // Set creator wallet to authenticated user
    const invoiceData = {
      ...req.body,
      creator_wallet: req.context!.walletAddress!
    };
    
    const invoice = await invoiceService.create(invoiceData);
    
    logger.info('Invoice created via API', { 
      invoice_id: invoice.invoice_id,
      creator_wallet: invoice.creator_wallet 
    });
    res.success(invoice, 201);
  })
);

/**
 * Get invoice by ID (public endpoint for payment pages)
 * GET /invoices/:id
 */
router.get('/:id', 
  optionalAuth,
  validateRequest({ params: InvoiceIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const invoiceId = req.params.id;
    const walletAddress = req.context?.walletAddress;
    
    const invoice = await invoiceService.findByIdWithPayments(invoiceId, walletAddress);
    
    logger.info('Invoice retrieved via API', { invoice_id: invoiceId });
    res.success(invoice);
  })
);

/**
 * Get public invoice data (for payment page, limited information)
 * GET /invoices/:id/public
 */
router.get('/:id/public',
  validateRequest({ params: InvoiceIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const invoiceId = req.params.id;
    const invoice = await invoiceService.findPublicById(invoiceId);
    
    logger.info('Public invoice retrieved via API', { invoice_id: invoiceId });
    res.success(invoice);
  })
);

/**
 * Get invoices for current authenticated user
 * GET /invoices/my
 */
router.get('/my', 
  authenticateJWT,
  validateRequest({ query: InvoiceFilterSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const walletAddress = req.context!.walletAddress!;
    const { limit, nextToken, status } = req.query as any;
    
    const invoices = await invoiceService.findByUser(walletAddress, {
      limit,
      nextToken,
      status
    });
    
    logger.info('User invoices retrieved via API', { 
      wallet_address: walletAddress,
      count: invoices.items.length 
    });
    res.success({
      invoices: invoices.items,
      pagination: {
        hasMore: invoices.hasMore,
        nextToken: invoices.nextToken
      }
    });
  })
);

/**
 * Update an invoice
 * PUT /invoices/:id
 */
router.put('/:id', 
  authenticateJWT,
  validateRequest({ 
    params: InvoiceIdSchema,
    body: UpdateInvoiceSchema 
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const invoiceId = req.params.id;
    const walletAddress = req.context!.walletAddress!;
    
    const invoice = await invoiceService.update(invoiceId, req.body, walletAddress);
    
    logger.info('Invoice updated via API', { 
      invoice_id: invoiceId,
      creator_wallet: walletAddress 
    });
    res.success(invoice);
  })
);

/**
 * Cancel/delete an invoice
 * DELETE /invoices/:id
 */
router.delete('/:id', 
  authenticateJWT,
  validateRequest({ params: InvoiceIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const invoiceId = req.params.id;
    const walletAddress = req.context!.walletAddress!;
    
    await invoiceService.cancel(invoiceId, walletAddress);
    
    logger.info('Invoice cancelled via API', { 
      invoice_id: invoiceId,
      creator_wallet: walletAddress 
    });
    res.success({ message: 'Invoice cancelled successfully' });
  })
);

/**
 * Send an invoice to client (change status to pending)
 * POST /invoices/:id/send
 */
router.post('/:id/send', 
  authenticateJWT,
  validateRequest({ params: InvoiceIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const invoiceId = req.params.id;
    const walletAddress = req.context!.walletAddress!;
    
    const invoice = await invoiceService.send(invoiceId, walletAddress);
    
    logger.info('Invoice sent via API', { 
      invoice_id: invoiceId,
      creator_wallet: walletAddress 
    });
    res.success(invoice);
  })
);

/**
 * Get dashboard statistics for authenticated user
 * GET /invoices/dashboard/stats
 */
router.get('/dashboard/stats', 
  authenticateJWT,
  asyncHandler(async (req: Request, res: Response) => {
    const walletAddress = req.context!.walletAddress!;
    const stats = await invoiceService.getDashboardStats(walletAddress);
    
    logger.info('Invoice dashboard stats retrieved via API', { 
      wallet_address: walletAddress 
    });
    res.success(stats);
  })
);

/**
 * Get invoice status and payment info
 * GET /invoices/:id/status
 */
router.get('/:id/status',
  validateRequest({ params: InvoiceIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const invoiceId = req.params.id;
    const status = await invoiceService.getStatus(invoiceId);
    
    logger.info('Invoice status retrieved via API', { invoice_id: invoiceId });
    res.success(status);
  })
);

export const invoiceRoutes = router;