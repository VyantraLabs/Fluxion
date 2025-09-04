import { InvoiceService } from '../../../src/modules/invoices/service';
import { DatabaseService } from '../../../src/shared/database/client';
import { NotificationService } from '../../../src/shared/notifications/client';
import { FluxionError, ErrorCodes } from '../../../src/types/common';

// Mock dependencies
jest.mock('../../../src/shared/database/client');
jest.mock('../../../src/shared/notifications/client');

const mockDb = {
  put: jest.fn(),
  get: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  query: jest.fn(),
  generateId: jest.fn(() => 'test-invoice-id'),
  getCurrentTimestamp: jest.fn(() => '2024-01-01T00:00:00.000Z')
};

const mockNotifications = {
  sendInvoiceCreated: jest.fn(),
  isEnabled: jest.fn(() => true)
};

(DatabaseService as jest.MockedClass<typeof DatabaseService>).mockImplementation(() => mockDb as any);
(NotificationService as jest.MockedClass<typeof NotificationService>).mockImplementation(() => mockNotifications as any);

describe('InvoiceService', () => {
  let invoiceService: InvoiceService;

  beforeEach(() => {
    jest.clearAllMocks();
    invoiceService = new InvoiceService();
  });

  describe('create', () => {
    const validInvoiceData = {
      creator_wallet: '0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e',
      client_email: 'client@example.com',
      client_name: 'Test Client',
      amount: 250.00,
      description: 'Test invoice',
      due_date: '2024-02-01T00:00:00.000Z'
    };

    it('should create invoice successfully', async () => {
      mockDb.put.mockResolvedValueOnce(undefined);

      const result = await invoiceService.create(validInvoiceData);

      expect(result).toMatchObject({
        invoice_id: 'test-invoice-id',
        creator_wallet: validInvoiceData.creator_wallet,
        client_email: validInvoiceData.client_email,
        client_name: validInvoiceData.client_name,
        amount: validInvoiceData.amount,
        description: validInvoiceData.description,
        status: 'draft',
        due_date: validInvoiceData.due_date
      });

      expect(mockDb.put).toHaveBeenCalledWith(expect.objectContaining({
        PK: 'INV#test-invoice-id',
        SK: 'METADATA',
        GSI1PK: `USER#${validInvoiceData.creator_wallet}`,
        GSI2PK: 'STATUS#draft',
        entityType: 'INVOICE'
      }));
    });

    it('should validate line items total', async () => {
      const invalidData = {
        ...validInvoiceData,
        amount: 100.00,
        line_items: [
          { id: '1', description: 'Item 1', quantity: 2, rate: 50, amount: 100 },
          { id: '2', description: 'Item 2', quantity: 1, rate: 25, amount: 25 }
        ]
      };

      await expect(invoiceService.create(invalidData)).rejects.toThrow(
        expect.objectContaining({
          code: ErrorCodes.VALIDATION_ERROR,
          message: expect.stringContaining('Line items total does not match')
        })
      );

      expect(mockDb.put).not.toHaveBeenCalled();
    });

    it('should generate payment URL correctly', async () => {
      process.env.FRONTEND_URL = 'https://test.fluxion.pay';
      mockDb.put.mockResolvedValueOnce(undefined);

      const result = await invoiceService.create(validInvoiceData);

      expect(result.payment_url).toBe('https://test.fluxion.pay/pay/test-invoice-id');
    });

    it('should handle database errors', async () => {
      mockDb.put.mockRejectedValueOnce(new Error('Database error'));

      await expect(invoiceService.create(validInvoiceData)).rejects.toThrow(
        expect.objectContaining({
          code: ErrorCodes.DATABASE_ERROR
        })
      );
    });
  });

  describe('getById', () => {
    it('should return invoice when found', async () => {
      const mockInvoiceRecord = {
        PK: 'INV#test-invoice-id',
        SK: 'METADATA',
        entityType: 'INVOICE',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-01T00:00:00.000Z',
        data: {
          invoice_id: 'test-invoice-id',
          creator_wallet: '0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e',
          client_email: 'client@example.com',
          client_name: 'Test Client',
          amount: 250.00,
          description: 'Test invoice',
          status: 'draft',
          due_date: '2024-02-01T00:00:00.000Z',
          payment_url: 'https://app.fluxion.pay/pay/test-invoice-id'
        }
      };

      mockDb.get.mockResolvedValueOnce(mockInvoiceRecord);

      const result = await invoiceService.getById('test-invoice-id');

      expect(result).toMatchObject({
        invoice_id: 'test-invoice-id',
        creator_wallet: '0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e',
        client_email: 'client@example.com',
        client_name: 'Test Client',
        amount: 250.00,
        description: 'Test invoice',
        status: 'draft'
      });

      expect(mockDb.get).toHaveBeenCalledWith('INV#test-invoice-id', 'METADATA');
    });

    it('should return null when invoice not found', async () => {
      mockDb.get.mockResolvedValueOnce(null);

      const result = await invoiceService.getById('non-existent-id');

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockDb.get.mockRejectedValueOnce(new Error('Database error'));

      await expect(invoiceService.getById('test-invoice-id')).rejects.toThrow(
        expect.objectContaining({
          code: ErrorCodes.DATABASE_ERROR
        })
      );
    });
  });

  describe('update', () => {
    const existingInvoice = {
      invoice_id: 'test-invoice-id',
      creator_wallet: '0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e',
      client_email: 'client@example.com',
      client_name: 'Test Client',
      amount: 250.00,
      description: 'Test invoice',
      status: 'draft' as const,
      due_date: '2024-02-01T00:00:00.000Z',
      payment_url: 'https://app.fluxion.pay/pay/test-invoice-id',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z'
    };

    beforeEach(() => {
      jest.spyOn(invoiceService, 'getById').mockResolvedValue(existingInvoice);
    });

    it('should update invoice successfully', async () => {
      const updates = {
        client_name: 'Updated Client',
        description: 'Updated description'
      };

      const updatedRecord = {
        ...existingInvoice,
        client_name: updates.client_name,
        description: updates.description,
        updated_at: '2024-01-01T01:00:00.000Z'
      };

      mockDb.update.mockResolvedValueOnce({
        data: updatedRecord,
        updated_at: '2024-01-01T01:00:00.000Z'
      });

      const result = await invoiceService.update(
        'test-invoice-id',
        updates,
        '0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e'
      );

      expect(mockDb.update).toHaveBeenCalledWith(
        'INV#test-invoice-id',
        'METADATA',
        expect.stringContaining('SET'),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should prevent updates to paid invoices', async () => {
      const paidInvoice = { ...existingInvoice, status: 'paid' as const };
      jest.spyOn(invoiceService, 'getById').mockResolvedValueOnce(paidInvoice);

      await expect(
        invoiceService.update(
          'test-invoice-id',
          { description: 'Updated' },
          '0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e'
        )
      ).rejects.toThrow(
        expect.objectContaining({
          code: ErrorCodes.VALIDATION_ERROR,
          message: expect.stringContaining('Cannot update paid invoice')
        })
      );
    });

    it('should enforce ownership', async () => {
      await expect(
        invoiceService.update(
          'test-invoice-id',
          { description: 'Updated' },
          '0x8ba1f109551bD432803012645Hac136c95ce69A88' // different wallet
        )
      ).rejects.toThrow(
        expect.objectContaining({
          code: ErrorCodes.FORBIDDEN,
          message: expect.stringContaining('Access denied')
        })
      );
    });

    it('should update GSI2PK when status changes', async () => {
      const updates = { status: 'pending' as const };

      mockDb.update.mockResolvedValueOnce({
        data: { ...existingInvoice, ...updates },
        updated_at: '2024-01-01T01:00:00.000Z'
      });

      await invoiceService.update(
        'test-invoice-id',
        updates,
        '0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e'
      );

      expect(mockDb.update).toHaveBeenCalledWith(
        'INV#test-invoice-id',
        'METADATA',
        expect.stringContaining('GSI2PK = :gsi2pk'),
        expect.any(Object),
        expect.objectContaining({
          ':gsi2pk': 'STATUS#pending'
        })
      );
    });
  });

  describe('send', () => {
    const existingInvoice = {
      invoice_id: 'test-invoice-id',
      creator_wallet: '0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e',
      client_email: 'client@example.com',
      client_name: 'Test Client',
      amount: 250.00,
      description: 'Test invoice',
      status: 'draft' as const,
      due_date: '2024-02-01T00:00:00.000Z',
      payment_url: 'https://app.fluxion.pay/pay/test-invoice-id',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z'
    };

    it('should send invoice and queue notification', async () => {
      const updatedInvoice = { ...existingInvoice, status: 'pending' as const };
      
      jest.spyOn(invoiceService, 'update').mockResolvedValueOnce(updatedInvoice);
      mockNotifications.sendInvoiceCreated.mockResolvedValueOnce(undefined);

      const result = await invoiceService.send(
        'test-invoice-id',
        '0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e'
      );

      expect(result.status).toBe('pending');
      expect(mockNotifications.sendInvoiceCreated).toHaveBeenCalledWith(
        expect.objectContaining({
          invoice_id: 'test-invoice-id',
          client_name: 'Test Client',
          client_email: 'client@example.com',
          amount: 250.00,
          currency: 'USDC'
        })
      );
    });

    it('should handle notification failures gracefully', async () => {
      const updatedInvoice = { ...existingInvoice, status: 'pending' as const };
      
      jest.spyOn(invoiceService, 'update').mockResolvedValueOnce(updatedInvoice);
      mockNotifications.sendInvoiceCreated.mockRejectedValueOnce(new Error('Notification failed'));

      // Should not throw error even if notification fails
      const result = await invoiceService.send(
        'test-invoice-id',
        '0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e'
      );

      expect(result.status).toBe('pending');
    });
  });

  describe('markAsPaid', () => {
    const existingInvoice = {
      invoice_id: 'test-invoice-id',
      creator_wallet: '0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e',
      client_email: 'client@example.com',
      client_name: 'Test Client',
      amount: 250.00,
      description: 'Test invoice',
      status: 'pending' as const,
      due_date: '2024-02-01T00:00:00.000Z',
      payment_url: 'https://app.fluxion.pay/pay/test-invoice-id',
      created_at: '2024-01-01T00:00:00.000Z',
      updated_at: '2024-01-01T00:00:00.000Z'
    };

    it('should mark invoice as paid', async () => {
      jest.spyOn(invoiceService, 'getById').mockResolvedValueOnce(existingInvoice);
      
      const updatedRecord = {
        data: {
          ...existingInvoice,
          status: 'paid',
          paid_at: '2024-01-01T12:00:00.000Z',
          payment_tx_hash: '0x123...abc'
        },
        updated_at: '2024-01-01T12:00:00.000Z'
      };
      
      mockDb.update.mockResolvedValueOnce(updatedRecord);

      const result = await invoiceService.markAsPaid(
        'test-invoice-id',
        '0x123...abc'
      );

      expect(result.status).toBe('paid');
      expect(result.payment_tx_hash).toBe('0x123...abc');
      expect(result.paid_at).toBeDefined();

      expect(mockDb.update).toHaveBeenCalledWith(
        'INV#test-invoice-id',
        'METADATA',
        expect.stringContaining('paid_at'),
        expect.any(Object),
        expect.objectContaining({
          ':status': 'paid',
          ':paid_at': expect.any(String),
          ':tx_hash': '0x123...abc',
          ':gsi2pk': 'STATUS#paid'
        })
      );
    });

    it('should handle already paid invoices', async () => {
      const paidInvoice = {
        ...existingInvoice,
        status: 'paid' as const,
        paid_at: '2024-01-01T11:00:00.000Z',
        payment_tx_hash: '0x456...def'
      };
      
      jest.spyOn(invoiceService, 'getById').mockResolvedValueOnce(paidInvoice);

      const result = await invoiceService.markAsPaid(
        'test-invoice-id',
        '0x123...abc'
      );

      expect(result.status).toBe('paid');
      expect(result.payment_tx_hash).toBe('0x456...def'); // Original tx hash
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  describe('getUserInvoices', () => {
    it('should return paginated user invoices', async () => {
      const mockQueryResult = {
        items: [
          {
            PK: 'INV#test-invoice-1',
            SK: 'METADATA',
            entityType: 'INVOICE',
            data: {
              invoice_id: 'test-invoice-1',
              creator_wallet: '0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e',
              client_name: 'Client 1',
              amount: 100.00,
              status: 'paid'
            },
            created_at: '2024-01-01T00:00:00.000Z',
            updated_at: '2024-01-01T00:00:00.000Z'
          }
        ],
        nextToken: 'next-token-123',
        count: 1,
        scannedCount: 1
      };

      mockDb.query.mockResolvedValueOnce(mockQueryResult);

      const result = await invoiceService.getUserInvoices(
        '0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e',
        { limit: 10, status: 'paid' }
      );

      expect(result).toEqual({
        invoices: expect.arrayContaining([
          expect.objectContaining({
            invoice_id: 'test-invoice-1',
            client_name: 'Client 1',
            amount: 100.00,
            status: 'paid'
          })
        ]),
        nextToken: 'next-token-123',
        hasMore: true
      });

      expect(mockDb.query).toHaveBeenCalledWith(
        'GSI1PK = :walletAddress',
        expect.objectContaining({
          indexName: 'GSI1',
          expressionAttributeValues: expect.objectContaining({
            ':walletAddress': 'USER#0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e',
            ':entityType': 'INVOICE',
            ':status': 'paid'
          }),
          limit: 10
        })
      );
    });

    it('should handle empty results', async () => {
      mockDb.query.mockResolvedValueOnce({
        items: [],
        nextToken: undefined,
        count: 0,
        scannedCount: 0
      });

      const result = await invoiceService.getUserInvoices(
        '0x742D35Cc6634C0532925a3b8D0Ca91c7aCe0E25e'
      );

      expect(result).toEqual({
        invoices: [],
        nextToken: undefined,
        hasMore: false
      });
    });
  });
});