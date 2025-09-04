import { Router, Request, Response } from 'express';
import { PaymentService } from './service';
import { 
  PaymentVerificationSchema,
  PaymentStatusSchema,
  PaginationSchema
} from '@/shared/validation';
import { Logger } from '@/shared/utils/logger';
import { 
  authenticateJWT,
  validateRequest, 
  asyncHandler 
} from '@/shared/middleware';

const router = Router();
const paymentService = new PaymentService();
const logger = new Logger('PaymentHandlers');

/**
 * Verify a blockchain payment
 * POST /payments/verify
 */
router.post('/verify', 
  validateRequest({ body: PaymentVerificationSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { invoice_id, tx_hash, from_address } = req.body;
    
    const result = await paymentService.verify({
      invoice_id,
      tx_hash,
      from_address
    });

    logger.info('Payment verification completed', { 
      invoice_id,
      tx_hash,
      is_valid: result.verification.isValid 
    });
    
    res.success({
      payment: result.payment,
      invoice: result.invoice,
      verification_details: {
        is_valid: result.verification.isValid,
        confirmations: result.verification.confirmations,
        actual_amount: result.verification.actualAmount,
        actual_sender: result.verification.actualSender,
        actual_recipient: result.verification.actualRecipient,
        already_processed: result.verification.alreadyProcessed || false
      }
    });
  })
);

/**
 * Get payment status by ID
 * GET /payments/:id/status
 */
router.get('/:id/status',
  validateRequest({ params: PaymentStatusSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const paymentId = req.params.payment_id;
    const status = await paymentService.getStatus(paymentId);
    
    logger.info('Payment status retrieved', { payment_id: paymentId });
    res.success(status);
  })
);

/**
 * Get payments for an invoice (public endpoint)
 * GET /payments/invoice/:invoice_id
 */
router.get('/invoice/:invoice_id',
  asyncHandler(async (req: Request, res: Response) => {
    const invoiceId = req.params.invoice_id;
    const payments = await paymentService.findByInvoice(invoiceId);
    
    logger.info('Invoice payments retrieved', { 
      invoice_id: invoiceId,
      count: payments.items.length 
    });
    res.success({ payments: payments.items, nextToken: payments.nextToken });
  })
);

/**
 * Get payment history for authenticated user
 * GET /payments/my
 */
router.get('/my',
  authenticateJWT,
  validateRequest({ query: PaginationSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const walletAddress = req.context!.walletAddress!;
    const { limit, nextToken } = req.query as any;
    
    const payments = await paymentService.findByUser(walletAddress, undefined, {
      limit,
      nextToken
    });
    
    logger.info('User payments retrieved', { 
      wallet_address: walletAddress,
      count: payments.items.length 
    });
    res.success({
      payments: payments.items,
      pagination: {
        hasMore: !!payments.nextToken,
        nextToken: payments.nextToken,
        totalCount: payments.totalCount
      }
    });
  })
);

/**
 * Get payment details by transaction hash (public endpoint)
 * GET /payments/tx/:tx_hash
 */
router.get('/tx/:tx_hash',
  asyncHandler(async (req: Request, res: Response) => {
    const txHash = req.params.tx_hash;
    
    // Validate transaction hash format
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return res.error('VALIDATION_ERROR', 'Invalid transaction hash format', 400);
    }
    
    const payment = await paymentService.findByTransactionHash(txHash);
    
    logger.info('Payment by transaction hash retrieved', { tx_hash: txHash });
    res.success(payment);
  })
);

/**
 * Retry payment verification (for failed payments)
 * POST /payments/:id/retry
 */
router.post('/:id/retry',
  authenticateJWT,
  validateRequest({ params: PaymentStatusSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const paymentId = req.params.payment_id;
    const walletAddress = req.context!.walletAddress!;
    
    const result = await paymentService.retryVerification(paymentId, walletAddress);
    
    logger.info('Payment verification retry completed', { 
      payment_id: paymentId,
      is_valid: result.verification.isValid 
    });
    res.success(result);
  })
);

/**
 * Get payment statistics for authenticated user
 * GET /payments/stats
 */
router.get('/stats',
  authenticateJWT,
  asyncHandler(async (req: Request, res: Response) => {
    const walletAddress = req.context!.walletAddress!;
    const stats = await paymentService.getPaymentStats();
    
    logger.info('Payment statistics retrieved', { wallet_address: walletAddress });
    res.success(stats);
  })
);

/**
 * Check if a transaction hash has already been used
 * GET /payments/check-tx/:tx_hash
 */
router.get('/check-tx/:tx_hash',
  asyncHandler(async (req: Request, res: Response) => {
    const txHash = req.params.tx_hash;
    
    // Validate transaction hash format
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return res.error('VALIDATION_ERROR', 'Invalid transaction hash format', 400);
    }
    
    const exists = await paymentService.transactionExists(txHash);
    
    logger.info('Transaction existence checked', { tx_hash: txHash, exists });
    res.success({
      tx_hash: txHash,
      exists,
      message: exists ? 'Transaction has already been processed' : 'Transaction available for processing'
    });
  })
);

export const paymentRoutes = router;