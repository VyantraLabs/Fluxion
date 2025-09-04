import { DatabaseService } from '../../../../src/shared/database/client';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { FluxionRecord } from '../../../../src/types/common';

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb');
jest.mock('@aws-sdk/lib-dynamodb');

describe('DatabaseService', () => {
  let databaseService: DatabaseService;
  let mockSend: jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSend = jest.fn();
    (DynamoDBDocumentClient.from as jest.Mock).mockReturnValue({
      send: mockSend
    });

    databaseService = new DatabaseService();
    
    // Mock environment variables
    process.env.DYNAMODB_TABLE = 'test-table';
  });

  describe('save', () => {
    it('should save a record successfully', async () => {
      const mockRecord: FluxionRecord = {
        PK: 'TEST#123',
        SK: 'METADATA',
        entityType: 'INVOICE',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
        data: {
          invoice_id: '123',
          creator_wallet: '0x123',
          client_email: 'test@example.com',
          client_name: 'Test Client',
          amount: 100,
          description: 'Test invoice',
          status: 'draft',
          due_date: '2023-01-02T00:00:00.000Z',
          payment_url: 'https://example.com/pay/123'
        }
      };

      mockSend.mockResolvedValueOnce({});

      await databaseService.save(mockRecord);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TableName: 'test-table',
            Item: expect.objectContaining({
              PK: 'TEST#123',
              SK: 'METADATA',
              entityType: 'INVOICE'
            })
          })
        })
      );
    });

    it('should throw error when save fails', async () => {
      const mockRecord: FluxionRecord = {
        PK: 'TEST#123',
        SK: 'METADATA',
        entityType: 'INVOICE',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
        data: {} as any
      };

      const error = new Error('DynamoDB error');
      mockSend.mockRejectedValueOnce(error);

      await expect(databaseService.save(mockRecord)).rejects.toThrow('Failed to save record: Error: DynamoDB error');
    });
  });

  describe('findById', () => {
    it('should find a record by ID', async () => {
      const mockItem: FluxionRecord = {
        PK: 'TEST#123',
        SK: 'METADATA',
        entityType: 'INVOICE',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
        data: {} as any
      };

      mockSend.mockResolvedValueOnce({ Item: mockItem });

      const result = await databaseService.findById('TEST#123', 'METADATA');

      expect(result).toEqual(mockItem);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TableName: 'test-table',
            Key: { PK: 'TEST#123', SK: 'METADATA' }
          })
        })
      );
    });

    it('should return null when record not found', async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await databaseService.findById('TEST#123', 'METADATA');

      expect(result).toBeNull();
    });

    it('should throw error when findById fails', async () => {
      const error = new Error('DynamoDB error');
      mockSend.mockRejectedValueOnce(error);

      await expect(databaseService.findById('TEST#123', 'METADATA')).rejects.toThrow('Failed to find record: Error: DynamoDB error');
    });
  });

  describe('queryByPK', () => {
    it('should query records by partition key', async () => {
      const mockItems: FluxionRecord[] = [
        {
          PK: 'USER#0x123',
          SK: 'INV#1',
          entityType: 'INVOICE',
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
          data: {} as any
        }
      ];

      mockSend.mockResolvedValueOnce({ 
        Items: mockItems,
        LastEvaluatedKey: undefined
      });

      const result = await databaseService.queryByPK('USER#0x123');

      expect(result.items).toEqual(mockItems);
      expect(result.nextToken).toBeUndefined();
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TableName: 'test-table',
            KeyConditionExpression: 'PK = :pk',
            ExpressionAttributeValues: { ':pk': 'USER#0x123' }
          })
        })
      );
    });

    it('should handle pagination', async () => {
      const mockLastEvaluatedKey = { PK: 'USER#0x123', SK: 'INV#2' };
      
      mockSend.mockResolvedValueOnce({ 
        Items: [],
        LastEvaluatedKey: mockLastEvaluatedKey
      });

      const result = await databaseService.queryByPK('USER#0x123');

      expect(result.nextToken).toBeDefined();
      expect(JSON.parse(Buffer.from(result.nextToken!, 'base64').toString())).toEqual(mockLastEvaluatedKey);
    });
  });

  describe('queryGSI1', () => {
    it('should query records using GSI1', async () => {
      const mockItems: FluxionRecord[] = [
        {
          PK: 'INV#123',
          SK: 'METADATA',
          GSI1PK: 'USER#0x123',
          GSI1SK: '2023-01-01T00:00:00.000Z',
          entityType: 'INVOICE',
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
          data: {} as any
        }
      ];

      mockSend.mockResolvedValueOnce({ 
        Items: mockItems,
        LastEvaluatedKey: undefined
      });

      const result = await databaseService.queryGSI1('USER#0x123');

      expect(result.items).toEqual(mockItems);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TableName: 'test-table',
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :gsi1pk',
            ExpressionAttributeValues: { ':gsi1pk': 'USER#0x123' }
          })
        })
      );
    });
  });

  describe('update', () => {
    it('should update a record', async () => {
      const mockUpdatedRecord: FluxionRecord = {
        PK: 'TEST#123',
        SK: 'METADATA',
        entityType: 'INVOICE',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T01:00:00.000Z',
        data: {} as any
      };

      mockSend.mockResolvedValueOnce({ Attributes: mockUpdatedRecord });

      const updates = { 'data.status': 'paid' };
      const result = await databaseService.update('TEST#123', 'METADATA', updates);

      expect(result).toEqual(mockUpdatedRecord);
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TableName: 'test-table',
            Key: { PK: 'TEST#123', SK: 'METADATA' },
            UpdateExpression: expect.stringContaining('SET'),
            ReturnValues: 'ALL_NEW'
          })
        })
      );
    });
  });

  describe('delete', () => {
    it('should delete a record', async () => {
      mockSend.mockResolvedValueOnce({});

      await databaseService.delete('TEST#123', 'METADATA');

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            TableName: 'test-table',
            Key: { PK: 'TEST#123', SK: 'METADATA' }
          })
        })
      );
    });
  });

  describe('batchWrite', () => {
    it('should batch write records', async () => {
      const mockRecords: FluxionRecord[] = [
        {
          PK: 'TEST#1',
          SK: 'METADATA',
          entityType: 'INVOICE',
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
          data: {} as any
        },
        {
          PK: 'TEST#2',
          SK: 'METADATA',
          entityType: 'INVOICE',
          created_at: '2023-01-01T00:00:00.000Z',
          updated_at: '2023-01-01T00:00:00.000Z',
          data: {} as any
        }
      ];

      mockSend.mockResolvedValueOnce({});

      await databaseService.batchWrite(mockRecords);

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({
            RequestItems: expect.objectContaining({
              'test-table': expect.arrayContaining([
                expect.objectContaining({
                  PutRequest: expect.objectContaining({
                    Item: expect.objectContaining({
                      PK: 'TEST#1'
                    })
                  })
                })
              ])
            })
          })
        })
      );
    });

    it('should handle empty array', async () => {
      await databaseService.batchWrite([]);
      expect(mockSend).not.toHaveBeenCalled();
    });

    it('should handle large batches (>25 items)', async () => {
      const mockRecords: FluxionRecord[] = Array.from({ length: 30 }, (_, i) => ({
        PK: `TEST#${i}`,
        SK: 'METADATA',
        entityType: 'INVOICE',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-01T00:00:00.000Z',
        data: {} as any
      }));

      mockSend.mockResolvedValue({});

      await databaseService.batchWrite(mockRecords);

      // Should be called twice for 30 items (25 + 5)
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });
});