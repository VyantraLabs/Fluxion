import { WalletAddress, TransactionHash, DateString } from './common';

// Invoice status types
export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'expired' | 'cancelled';

// Line item types
export interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

// Core invoice type (enhanced to match backend schema)
export interface Invoice {
  id?: string;
  invoice_id: string;
  user_id?: string;
  creator_wallet: WalletAddress;
  // Legacy fields for backward compatibility
  client_email?: string;
  client_name?: string;
  amount?: number;
  description?: string;
  // Enhanced client info structure
  client_info: {
    name: string;
    email: string;
    address?: string;
  };
  line_items?: LineItem[];
  // Enhanced amounts structure
  amounts: {
    subtotal: number;
    tax_rate?: number;
    tax_amount?: number;
    discount_amount?: number;
    total: number;
  };
  status: InvoiceStatus;
  due_date: DateString;
  paid_at?: DateString;
  payment_tx_hash?: TransactionHash;
  // Legacy field
  payment_url?: string;
  // Enhanced blockchain data
  blockchain_data?: {
    network: string;
    token_address: string;
    recipient_address: string;
    payment_url: string;
  };
  // Enhanced metadata
  metadata?: {
    pdf_url?: string;
    public_url?: string;
    notes?: string;
    description?: string; // For backward compatibility
  };
  pdf_url?: string; // Legacy field
  tenant_id?: string;
  created_at: DateString;
  updated_at: DateString;
}

// Invoice with payment information
export interface InvoiceWithPayments extends Invoice {
  payments: PaymentSummary[];
}

// Public invoice (for payment pages)
export interface PublicInvoice {
  invoice_id: string;
  creator_wallet: WalletAddress;
  client_name: string;
  amount: number;
  description: string;
  line_items?: LineItem[];
  status: InvoiceStatus;
  due_date: DateString;
  created_at: DateString;
}

// Payment summary for invoice
export interface PaymentSummary {
  payment_id: string;
  tx_hash: TransactionHash;
  amount: number;
  status: string;
  created_at: DateString;
}

// Invoice creation request (enhanced for new schema)
export interface CreateInvoiceRequest {
  creator_wallet: WalletAddress;
  // Legacy fields for backward compatibility
  client_email?: string;
  client_name?: string;
  amount?: number;
  description?: string;
  // Enhanced structure
  client_info: {
    name: string;
    email: string;
    address?: string;
  };
  line_items?: LineItem[];
  amounts?: {
    subtotal: number;
    tax_rate?: number;
    tax_amount?: number;
    discount_amount?: number;
    total: number;
  };
  due_date: DateString;
  blockchain_data?: {
    network: string;
    token_address: string;
    recipient_address: string;
  };
  metadata?: {
    notes?: string;
    description?: string;
  };
}

// Invoice update request
export interface UpdateInvoiceRequest {
  client_email?: string;
  client_name?: string;
  description?: string;
  line_items?: LineItem[];
  due_date?: DateString;
  status?: InvoiceStatus;
}

// Invoice form data
export interface InvoiceFormData {
  client_name: string;
  client_email: string;
  description: string;
  line_items: LineItem[];
  due_date: string;
  amount?: number; // Calculated from line items
}

// Invoice filters for listing
export interface InvoiceFilters {
  status?: InvoiceStatus;
  client_name?: string;
  amount_min?: number;
  amount_max?: number;
  date_from?: DateString;
  date_to?: DateString;
  search?: string;
}

// Invoice list item (simplified for lists)
export interface InvoiceListItem {
  invoice_id: string;
  client_name: string;
  amount: number;
  status: InvoiceStatus;
  due_date: DateString;
  created_at: DateString;
  paid_at?: DateString;
}

// Invoice analytics
export interface InvoiceAnalytics {
  total_count: number;
  total_amount: number;
  paid_count: number;
  paid_amount: number;
  pending_count: number;
  pending_amount: number;
  overdue_count: number;
  overdue_amount: number;
  average_amount: number;
  conversion_rate: number;
}

// Invoice templates (for future use)
export interface InvoiceTemplate {
  id: string;
  name: string;
  description: string;
  line_items: LineItem[];
  creator_wallet: WalletAddress;
  created_at: DateString;
  updated_at: DateString;
}

// Invoice PDF configuration
export interface InvoicePDFConfig {
  include_line_items: boolean;
  include_payment_instructions: boolean;
  company_logo?: string;
  company_details?: {
    name: string;
    address: string;
    email: string;
    website: string;
  };
  custom_message?: string;
}

// Invoice reminder settings
export interface ReminderSettings {
  days_before_due: number[];
  days_after_due: number[];
  custom_message?: string;
}

// Invoice export options
export interface InvoiceExportOptions {
  format: 'pdf' | 'csv' | 'json';
  date_range?: {
    from: DateString;
    to: DateString;
  };
  status_filter?: InvoiceStatus[];
  include_line_items: boolean;
}

// Bulk operations
export interface BulkInvoiceOperation {
  invoice_ids: string[];
  operation: 'send' | 'cancel' | 'delete' | 'export';
  options?: Record<string, any>;
}

// Invoice validation errors
export interface InvoiceValidationError {
  field: keyof InvoiceFormData | `line_items.${number}.${keyof LineItem}`;
  message: string;
  code: string;
}

// Invoice context types
export interface InvoiceContextState {
  invoices: Invoice[];
  currentInvoice: Invoice | null;
  isLoading: boolean;
  error: string | null;
  filters: InvoiceFilters;
  analytics: InvoiceAnalytics | null;
}

export interface InvoiceContextActions {
  createInvoice: (data: CreateInvoiceRequest) => Promise<Invoice>;
  updateInvoice: (id: string, data: UpdateInvoiceRequest) => Promise<Invoice>;
  deleteInvoice: (id: string) => Promise<void>;
  sendInvoice: (id: string) => Promise<void>;
  getInvoice: (id: string) => Promise<Invoice>;
  getPublicInvoice: (id: string) => Promise<PublicInvoice>;
  getUserInvoices: (walletAddress: WalletAddress, filters?: InvoiceFilters) => Promise<Invoice[]>;
  generatePDF: (invoice: Invoice, config?: InvoicePDFConfig) => Promise<Blob>;
  setFilters: (filters: Partial<InvoiceFilters>) => void;
  clearError: () => void;
}