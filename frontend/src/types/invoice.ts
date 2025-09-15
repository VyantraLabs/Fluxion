import { WalletAddress, TransactionHash, DateString } from './common';

// Invoice status types (updated to match backend)
export type InvoiceStatus = 'draft' | 'created' | 'initiated' | 'sent' | 'pending' | 'paid' | 'overdue' | 'cancelled' | 'partial';

// Line item types
export interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

// Core invoice type (matches PostgreSQL backend)
export interface Invoice {
  id: string;
  organizationId: string;
  createdBy: string;
  invoiceNumber: string;
  title: string;
  description?: string;
  dueDate?: Date;
  clientName?: string;
  clientEmail?: string;
  clientWallet?: string;
  networkId: string;
  tokenId: string;
  amount: string; // Stored as decimal string
  amountPaid: string;
  status: InvoiceStatus;
  metadata: {
    currency?: string;
    exchangeRate?: string;
    taxRate?: number;
    taxAmount?: string;
    notes?: string;
    attachments?: string[];
    remindersSent?: number;
    customFields?: Record<string, any>;
    cancellationReason?: string;
  };
  sentAt?: Date;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Relations
  network?: {
    id: string;
    name: string;
    chainId: number;
  };
  token?: {
    id: string;
    symbol: string;
    decimals: number;
    contractAddress: string;
  };
  payments?: Payment[];
}

// Payment summary for lists
export interface PaymentSummary {
  id: string;
  amount: string;
  status: 'pending' | 'confirmed' | 'failed';
  transactionHash: string;
  createdAt: Date;
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

// Payment interface (matches backend)
export interface Payment {
  id: string;
  invoiceId: string;
  transactionHash: string;
  amount: string;
  status: 'pending' | 'confirmed' | 'failed';
  confirmations: number;
  blockNumber?: number;
  gasUsed?: string;
  gasPrice?: string;
  networkId: string;
  fromAddress: string;
  toAddress: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Invoice creation request (matches backend API)
export interface CreateInvoiceRequest {
  title: string;
  description?: string;
  clientName?: string;
  clientEmail?: string;
  amount: number; // Changed from string to number for backend
  dueDate?: string; // ISO string
  networkId: number; // Changed to number (chainId) to match backend
  tokenId: string;
  status?: 'draft' | 'created' | 'initiated' | 'sent'; // Support for status-based creation
}

// Invoice update request (matches backend API)
export interface UpdateInvoiceRequest {
  title?: string;
  description?: string;
  clientName?: string;
  clientEmail?: string;
  dueDate?: string; // ISO string
  status?: InvoiceStatus;
}

// Invoice form data for frontend forms
export interface InvoiceFormData {
  title: string;
  description: string;
  clientName: string;
  clientEmail: string;
  amount: string;
  dueDate: string;
  networkId: string;
  tokenId: string;
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

// Invoice templates (updated for backend implementation)
export interface InvoiceTemplate {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  category?: string;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultAmount?: string;
  defaultDueDate?: number; // days from creation
  fields: TemplateField[];
  isPublic: boolean;
  usageCount: number;
  metadata: {
    tags?: string[];
    industry?: string;
    complexity?: 'simple' | 'moderate' | 'advanced';
    estimatedTime?: number; // minutes to complete
    customCSS?: string;
    logoUrl?: string;
    brandColors?: {
      primary: string;
      secondary: string;
    };
  };
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// Template field configuration
export interface TemplateField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'email' | 'textarea' | 'select' | 'checkbox';
  required: boolean;
  placeholder?: string;
  defaultValue?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    options?: string[]; // for select fields
  };
  displayOrder: number;
  section?: string; // group fields into sections
}

// Template creation request
export interface CreateTemplateRequest {
  name: string;
  description?: string;
  category?: string;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultAmount?: string;
  defaultDueDate?: number;
  fields: Omit<TemplateField, 'id'>[];
  isPublic: boolean;
  metadata?: InvoiceTemplate['metadata'];
}

// Template usage analytics
export interface TemplateAnalytics {
  templateId: string;
  usageCount: number;
  averageAmount: number;
  completionRate: number;
  lastUsed?: Date;
  topUsers: {
    userId: string;
    usageCount: number;
  }[];
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

// Blockchain network interface (matches backend entity)
export interface BlockchainNetwork {
  chainId: number; // Primary key - matches backend
  name: string;
  symbol: string;
  rpcUrl: string;
  explorerUrl?: string;
  isTestnet: boolean;
  isActive: boolean;
  gasSettings: {
    gasPrice?: string;
    gasLimit?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
    type?: 'legacy' | 'eip1559';
  };
  confirmationsRequired: number;
  metadata?: {
    logo?: string;
    color?: string;
    description?: string;
    nativeToken?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

// Token interface
export interface Token {
  id: string;
  networkId: string;
  name: string;
  symbol: string;
  contractAddress: string;
  decimals: number;
  isNative: boolean;
  isStablecoin: boolean;
  isActive: boolean;
  metadata: {
    logo?: string;
    description?: string;
    website?: string;
    coingeckoId?: string;
  };
  network?: BlockchainNetwork;
  createdAt: Date;
  updatedAt: Date;
}

// Invoice access token for client viewing
export interface InvoiceAccessToken {
  id: string;
  invoiceId: string;
  token: string;
  expiresAt: Date;
  isActive: boolean;
  accessCount: number;
  lastAccessedAt?: Date;
  metadata: {
    clientIP?: string;
    userAgent?: string;
    restrictions?: {
      maxAccess?: number;
      allowedIPs?: string[];
    };
  };
  createdAt: Date;
}

// Client access response
export interface ClientAccessResponse {
  invoice: Invoice;
  token: Token;
  network: BlockchainNetwork;
  qrCode: string;
  paymentAddress: string;
  expiresAt: Date;
}

// Invoice context types
export interface InvoiceContextState {
  invoices: Invoice[];
  currentInvoice: Invoice | null;
  isLoading: boolean;
  error: string | null;
  filters: InvoiceFilters;
  analytics: InvoiceAnalytics | null;
  templates: InvoiceTemplate[];
  networks: BlockchainNetwork[];
  tokens: Token[];
}

export interface InvoiceContextActions {
  // Invoice operations
  createInvoice: (data: CreateInvoiceRequest) => Promise<Invoice>;
  createFromTemplate: (templateId: string, data: any) => Promise<Invoice>;
  updateInvoice: (id: string, data: UpdateInvoiceRequest) => Promise<Invoice>;
  deleteInvoice: (id: string) => Promise<void>;
  sendInvoice: (id: string) => Promise<void>;
  duplicateInvoice: (id: string) => Promise<Invoice>;
  
  // Invoice retrieval
  getInvoice: (id: string) => Promise<Invoice>;
  getPublicInvoice: (id: string) => Promise<PublicInvoice>;
  getUserInvoices: (filters?: InvoiceFilters) => Promise<Invoice[]>;
  getInvoiceStats: () => Promise<InvoiceAnalytics>;
  
  // Client access
  generateClientToken: (id: string) => Promise<InvoiceAccessToken>;
  getClientInvoice: (token: string) => Promise<ClientAccessResponse>;
  
  // Template operations
  getTemplates: (filters?: { category?: string; isPublic?: boolean }) => Promise<InvoiceTemplate[]>;
  getTemplate: (id: string) => Promise<InvoiceTemplate>;
  createTemplate: (data: CreateTemplateRequest) => Promise<InvoiceTemplate>;
  updateTemplate: (id: string, data: Partial<CreateTemplateRequest>) => Promise<InvoiceTemplate>;
  deleteTemplate: (id: string) => Promise<void>;
  getTemplateAnalytics: (id: string) => Promise<TemplateAnalytics>;
  
  // Configuration
  getNetworks: () => Promise<BlockchainNetwork[]>;
  getTokens: (networkId?: string) => Promise<Token[]>;
  
  // Utilities
  generatePDF: (invoice: Invoice, config?: InvoicePDFConfig) => Promise<Blob>;
  setFilters: (filters: Partial<InvoiceFilters>) => void;
  clearError: () => void;
  refreshData: () => Promise<void>;
}