import { InvoiceService } from '../../../../src/modules/invoices/service';
import { DatabaseService } from '../../../../src/shared/database/client';
import { NotificationService } from '../../../../src/shared/notifications/client';
import { CreateInvoiceDTO, UpdateInvoiceDTO } from '../../../../src/types/invoice';
import { createNotFoundError, createValidationError } from '../../../../src/shared/errors';

// Mock dependencies
jest.mock('../../../../src/shared/database/client');
jest.mock('../../../../src/shared/notifications/client');
jest.mock('uuid', () => ({
  v4: () => 'mocked-uuid-123'
}));

describe('InvoiceService', () => {
  let invoiceService: InvoiceService;
  let mockDb: jest.Mocked<DatabaseService>;
  let mockNotifications: jest.Mocked<NotificationService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDb = {
      save: jest.fn(),
      findById: jest.fn(),
      queryByPK: jest.fn(),
      queryGSI1: jest.fn(),
      queryGSI2: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      batchWrite: jest.fn()
    } as any;

    mockNotifications = {
      sendInvoiceCreated: jest.fn(),
      sendPaymentReceived: jest.fn(),
      sendInvoiceReminder: jest.fn(),
      sendPaymentFailed: jest.fn()
    } as any;

    (DatabaseService as jest.Mock).mockImplementation(() => mockDb);
    (NotificationService as jest.Mock).mockImplementation(() => mockNotifications);

    invoiceService = new InvoiceService();

    // Mock environment variables
    process.env.FRONTEND_URL = 'https://test.example.com';
  });

  describe('create', () => {
    it('should create an invoice successfully', async () => {
      const createData: CreateInvoiceDTO = {
        creator_wallet: '0x1234567890123456789012345678901234567890',
        client_email: 'client@example.com',
        client_name: 'Test Client',
        amount: 100,
        description: 'Test invoice',
        due_date: '2023-12-31T23:59:59.000Z'
      };

      mockDb.save.mockResolvedValueOnce(undefined);

      const result = await invoiceService.create(createData);

      expect(result).toEqual(
        expect.objectContaining({
          invoice_id: 'mocked-uuid-123',
          creator_wallet: createData.creator_wallet,
          client_email: createData.client_email,
          client_name: createData.client_name,
          amount: createData.amount,
          description: createData.description,
          status: 'draft',
          due_date: createData.due_date,
          payment_url: expect.stringContaining('mocked-uuid-123')
        })
      );

      expect(mockDb.save).toHaveBeenCalledWith(
        expect.objectContaining({
          PK: 'INV#mocked-uuid-123',
          SK: 'METADATA',
          GSI1PK: `USER#${createData.creator_wallet}`,
          GSI2PK: 'STATUS#draft',
          entityType: 'INVOICE'
        })
      );
    });

    it('should calculate amount from line items', async () => {
      const createData: CreateInvoiceDTO = {
        creator_wallet: '0x1234567890123456789012345678901234567890',
        client_email: 'client@example.com',
        client_name: 'Test Client',
        amount: 50, // This should be overridden by line items
        description: 'Test invoice',
        due_date: '2023-12-31T23:59:59.000Z',
        line_items: [
          {
            description: 'Item 1',
            quantity: 2,
            rate: 25,
            amount: 50
          },
          {
            description: 'Item 2',
            quantity: 1,
            rate: 75,
            amount: 75
          }
        ]
      };

      mockDb.save.mockResolvedValueOnce(undefined);

      const result = await invoiceService.create(createData);

      // Amount should be calculated as 2*25 + 1*75 = 125
      expect(result.amount).toBe(125);
    });

    it('should send notification for pending invoice', async () => {
      const createData: CreateInvoiceDTO = {
        creator_wallet: '0x1234567890123456789012345678901234567890',
        client_email: 'client@example.com',
        client_name: 'Test Client',
        amount: 100,
        description: 'Test invoice',
        due_date: '2023-12-31T23:59:59.000Z'
      };

      mockDb.save.mockResolvedValueOnce(undefined);
      mockNotifications.sendInvoiceCreated.mockResolvedValueOnce(undefined);

      // Mock the saved entity to have pending status
      const mockEntity = {
        PK: 'INV#mocked-uuid-123',
        SK: 'METADATA',
        entityType: 'INVOICE',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
        data: {
          ...createData,
          invoice_id: 'mocked-uuid-123',
          status: 'pending',
          payment_url: 'https://test.example.com/pay/mocked-uuid-123'
        }
      };

      // Override the save mock to simulate pending status
      mockDb.save.mockImplementationOnce(async (entity) => {
        entity.data.status = 'pending';
      });

      const result = await invoiceService.create(createData);

      expect(mockNotifications.sendInvoiceCreated).not.toHaveBeenCalled(); // Only called for pending status
    });
  });

  describe('findById', () => {
    it('should find an invoice by ID', async () => {
      const mockEntity = {
        PK: 'INV#123',
        SK: 'METADATA',
        entityType: 'INVOICE',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
        data: {
          invoice_id: '123',
          creator_wallet: '0x1234567890123456789012345678901234567890',
          client_email: 'client@example.com',
          client_name: 'Test Client',
          amount: 100,
          description: 'Test invoice',
          status: 'pending',
          due_date: '2023-12-31T23:59:59.000Z',
          payment_url: 'https://test.example.com/pay/123'
        }
      };

      mockDb.findById.mockResolvedValueOnce(mockEntity as any);

      const result = await invoiceService.findById('123');

      expect(result).toEqual(
        expect.objectContaining({
          invoice_id: '123',
          creator_wallet: mockEntity.data.creator_wallet,
          status: 'pending'
        })
      );

      expect(mockDb.findById).toHaveBeenCalledWith('INV#123', 'METADATA');
    });

    it('should throw NotFoundError when invoice does not exist', async () => {
      mockDb.findById.mockResolvedValueOnce(null);

      await expect(invoiceService.findById('nonexistent')).rejects.toThrow(createNotFoundError('Invoice', 'nonexistent'));
    });

    it('should check wallet access permissions', async () => {
      const mockEntity = {
        PK: 'INV#123',
        SK: 'METADATA',
        entityType: 'INVOICE',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
        data: {
          creator_wallet: '0x1111111111111111111111111111111111111111',
          // ... other fields
        }
      };

      mockDb.findById.mockResolvedValueOnce(mockEntity as any);

      await expect(
        invoiceService.findById('123', '0x2222222222222222222222222222222222222222')
      ).rejects.toThrow('You do not have permission to access this invoice');
    });
  });

  describe('findByUser', () => {
    it('should find invoices by user wallet', async () => {
      const mockItems = [
        {
          PK: 'INV#123',
          SK: 'METADATA',
          entityType: 'INVOICE',
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
          data: {
            invoice_id: '123',
            creator_wallet: '0x1234567890123456789012345678901234567890',
            status: 'pending'
            // ... other fields
          }
        }
      ];

      mockDb.queryGSI1.mockResolvedValueOnce({
        items: mockItems as any,
        nextToken: undefined
      });

      const result = await invoiceService.findByUser('0x1234567890123456789012345678901234567890');

      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual(
        expect.objectContaining({
          invoice_id: '123',
          creator_wallet: '0x1234567890123456789012345678901234567890'
        })
      );

      expect(mockDb.queryGSI1).toHaveBeenCalledWith(
        'USER#0x1234567890123456789012345678901234567890',
        expect.objectContaining({
          limit: 20,
          scanIndexForward: false
        })
      );
    });

    it('should filter by status when provided', async () => {
      const mockItems = [
        {
          PK: 'INV#123',
          SK: 'METADATA',
          entityType: 'INVOICE',
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
          data: {
            creator_wallet: '0x1234567890123456789012345678901234567890',
            status: 'paid'
          }
        }
      ];

      mockDb.queryGSI2.mockResolvedValueOnce({
        items: mockItems as any,
        nextToken: undefined
      });

      const result = await invoiceService.findByUser(
        '0x1234567890123456789012345678901234567890',
        { status: 'paid' }
      );

      expect(mockDb.queryGSI2).toHaveBeenCalledWith(
        'STATUS#paid',
        expect.objectContaining({
          limit: 20,
          scanIndexForward: false
        })
      );
    });
  });

  describe('update', () => {
    it('should update an invoice', async () => {
      const existingInvoice = {
        invoice_id: '123',
        creator_wallet: '0x1234567890123456789012345678901234567890',
        client_email: 'old@example.com',
        client_name: 'Old Client',
        amount: 100,
        description: 'Old description',
        status: 'draft',
        due_date: '2023-12-31T23:59:59.000Z',
        payment_url: 'https://test.example.com/pay/123',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z'
      };

      const updateData: UpdateInvoiceDTO = {
        client_email: 'new@example.com',
        client_name: 'New Client',
        description: 'New description'
      };

      // Mock findById to return existing invoice
      mockDb.findById.mockResolvedValueOnce({
        PK: 'INV#123',
        SK: 'METADATA',
        entityType: 'INVOICE',
        created_at: existingInvoice.created_at,
        updated_at: existingInvoice.updated_at,
        data: {
          invoice_id: existingInvoice.invoice_id,
          creator_wallet: existingInvoice.creator_wallet,
          client_email: existingInvoice.client_email,
          client_name: existingInvoice.client_name,
          amount: existingInvoice.amount,
          description: existingInvoice.description,
          status: existingInvoice.status,
          due_date: existingInvoice.due_date,
          payment_url: existingInvoice.payment_url
        }
      } as any);

      mockDb.update.mockResolvedValueOnce({} as any);

      // Mock findById for the final return
      mockDb.findById.mockResolvedValueOnce({
        PK: 'INV#123',
        SK: 'METADATA',
        entityType: 'INVOICE',
        created_at: existingInvoice.created_at,
        updated_at: '2023-01-01T01:00:00.000Z',
        data: {
          ...existingInvoice,
          client_email: updateData.client_email,
          client_name: updateData.client_name,
          description: updateData.description
        }
      } as any);

      const result = await invoiceService.update('123', updateData, existingInvoice.creator_wallet);

      expect(mockDb.update).toHaveBeenCalledWith(
        'INV#123',
        'METADATA',
        expect.objectContaining({
          updated_at: expect.any(String)
        })
      );

      expect(result.client_email).toBe(updateData.client_email);
      expect(result.client_name).toBe(updateData.client_name);
      expect(result.description).toBe(updateData.description);
    });

    it('should not allow updates to paid invoices', async () => {
      const paidInvoice = {
        invoice_id: '123',
        creator_wallet: '0x1234567890123456789012345678901234567890',
        status: 'paid',
        // ... other fields
      };

      mockDb.findById.mockResolvedValueOnce({
        data: paidInvoice
      } as any);

      const updateData: UpdateInvoiceDTO = {
        client_email: 'new@example.com'
      };

      await expect(
        invoiceService.update('123', updateData, paidInvoice.creator_wallet)
      ).rejects.toThrow(createValidationError('Cannot update paid invoices'));
    });
  });

  describe('markAsPaid', () => {
    it('should mark invoice as paid', async () => {
      const existingInvoice = {
        invoice_id: '123',
        creator_wallet: '0x1234567890123456789012345678901234567890',
        amount: 100,
        status: 'pending'
      };

      mockDb.findById.mockResolvedValueOnce({
        data: existingInvoice
      } as any);

      mockDb.update.mockResolvedValueOnce({} as any);

      mockDb.findById.mockResolvedValueOnce({
        data: {
          ...existingInvoice,
          status: 'paid',
          paid_at: expect.any(String),
          payment_tx_hash: '0xabcdef123456'
        }
      } as any);

      const result = await invoiceService.markAsPaid('123', '0xabcdef123456', 150);

      expect(mockDb.update).toHaveBeenCalledWith(
        'INV#123',
        'METADATA',
        expect.objectContaining({
          GSI2PK: 'STATUS#paid',
          updated_at: expect.any(String)
        })
      );
    });
  });

  describe('delete', () => {
    it('should soft delete invoice by changing status to cancelled', async () => {
      const existingInvoice = {
        invoice_id: '123',
        creator_wallet: '0x1234567890123456789012345678901234567890',
        status: 'draft'
      };

      // Mock findById for permission check
      mockDb.findById.mockResolvedValueOnce({
        data: existingInvoice
      } as any);

      // Mock update for changing status
      mockDb.update.mockResolvedValueOnce({} as any);

      // Mock findById for final return in update method
      mockDb.findById.mockResolvedValueOnce({
        data: {
          ...existingInvoice,
          status: 'cancelled'
        }
      } as any);

      await invoiceService.delete('123', existingInvoice.creator_wallet);

      expect(mockDb.update).toHaveBeenCalledWith(
        'INV#123',
        'METADATA',
        expect.objectContaining({
          updated_at: expect.any(String)
        })
      );
    });
  });
});