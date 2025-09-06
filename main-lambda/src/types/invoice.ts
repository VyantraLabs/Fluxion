import { z } from 'zod';
import { FluxionRecord, InvoiceData, LineItem } from './common';

// ID validation - accepts both UUIDs and ULIDs for backward compatibility
const idSchema = z.string()
  .refine(
    (val) => {
      // Check if it's a valid UUID (36 chars with hyphens)
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);
      // Check if it's a valid ULID (26 chars alphanumeric)
      const isUlid = /^[0-9A-HJKMNP-TV-Z]{26}$/i.test(val);
      return isUuid || isUlid;
    },
    'Invalid ID format - must be either UUID or ULID'
  );

export const LineItemSchema = z.object({
  id: idSchema.optional(),
  description: z.string().min(1, 'Description is required').max(200),
  quantity: z.number().min(0.01, 'Quantity must be greater than 0').max(1000000),
  rate: z.number().min(0.01, 'Rate must be greater than 0').max(1000000),
  amount: z.number().min(0.01, 'Amount must be greater than 0')
});

export const CreateInvoiceSchema = z.object({
  creator_wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
  client_email: z.string().email('Invalid email address'),
  client_name: z.string().min(1, 'Client name is required').max(100),
  amount: z.number().min(0.01, 'Amount must be greater than 0').max(1000000),
  description: z.string().min(1, 'Description is required').max(500),
  line_items: z.array(LineItemSchema).optional(),
  due_date: z.string().datetime('Invalid due date format')
});

export const UpdateInvoiceSchema = z.object({
  client_email: z.string().email('Invalid email address').optional(),
  client_name: z.string().min(1, 'Client name is required').max(100).optional(),
  description: z.string().min(1, 'Description is required').max(500).optional(),
  line_items: z.array(LineItemSchema).optional(),
  due_date: z.string().datetime('Invalid due date format').optional(),
  status: z.enum(['draft', 'pending', 'paid', 'expired', 'cancelled']).optional()
});

export const GetInvoicesQuerySchema = z.object({
  limit: z.string().transform(val => parseInt(val)).refine(val => val > 0 && val <= 100, 'Limit must be between 1 and 100').optional(),
  nextToken: z.string().optional(),
  status: z.enum(['draft', 'pending', 'paid', 'expired', 'cancelled']).optional()
});

export interface InvoiceEntity extends FluxionRecord {
  PK: `INV#${string}`;           
  SK: 'METADATA';                
  GSI1PK: `USER#${string}`;      
  GSI1SK: string;                
  GSI2PK: `STATUS#${string}`;
  GSI2SK: string;                
  entityType: 'INVOICE';
  data: InvoiceData;
}

export type CreateInvoiceDTO = z.infer<typeof CreateInvoiceSchema>;
export type UpdateInvoiceDTO = z.infer<typeof UpdateInvoiceSchema>;
export type GetInvoicesQuery = z.infer<typeof GetInvoicesQuerySchema>;

export interface Invoice {
  invoice_id: string;
  creator_wallet: string;
  client_email: string;
  client_name: string;
  amount: number;
  description: string;
  line_items?: LineItem[];
  status: InvoiceData['status'];
  due_date: string;
  paid_at?: string;
  payment_tx_hash?: string;
  payment_url: string;
  pdf_url?: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceWithPayments extends Invoice {
  payments?: Array<{
    payment_id: string;
    tx_hash: string;
    amount: number;
    status: string;
    created_at: string;
  }>;
}