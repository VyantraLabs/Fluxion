import { z } from 'zod';
import { FluxionRecord, PaymentData } from './common';

export const VerifyPaymentSchema = z.object({
  invoice_id: z.string().uuid('Invalid invoice ID'),
  tx_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'),
  from_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid from address')
});

export const GetPaymentsQuerySchema = z.object({
  invoice_id: z.string().uuid('Invalid invoice ID').optional(),
  limit: z.string().transform(val => parseInt(val)).refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100').optional(),
  nextToken: z.string().optional()
});

export interface PaymentEntity extends FluxionRecord {
  PK: `PAY#${string}`;           
  SK: 'METADATA';
  GSI1PK: `INV#${string}`;       
  GSI1SK: string;                
  entityType: 'PAYMENT';
  data: PaymentData;
}

export type VerifyPaymentDTO = z.infer<typeof VerifyPaymentSchema>;
export type GetPaymentsQuery = z.infer<typeof GetPaymentsQuerySchema>;

export interface Payment {
  payment_id: string;
  invoice_id: string;
  tx_hash: string;
  from_address: string;
  to_address: string;
  amount: number;
  gas_used: number;
  block_number: number;
  status: PaymentData['status'];
  confirmations: number;
  created_at: string;
  updated_at: string;
}

export interface BlockchainTransaction {
  hash: string;
  blockNumber: number;
  blockHash: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  gasPrice: string;
  status: number;
  confirmations: number;
}

export interface USDCTransferEvent {
  from: string;
  to: string;
  value: string;
  transactionHash: string;
  blockNumber: number;
}