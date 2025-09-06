import { Invoice, CreateInvoiceRequest, UpdateInvoiceRequest } from '@/types/invoice';
import { authStorage } from '../storage';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta: {
    requestId: string;
    timestamp: string;
    version?: string;
  };
}

export interface InvoiceListResponse {
  invoices: Invoice[];
  total: number;
  pagination: {
    hasMore: boolean;
    nextToken?: string;
  };
}

export interface InvoiceStatsResponse {
  total: number;
  byStatus: Record<string, number>;
  totalAmount: string;
  totalPaidAmount: string;
  overdue: number;
  dueSoon: number;
}

class InvoiceApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'InvoiceApiError';
  }
}

class InvoiceApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getAuthToken();
    const url = `${this.baseUrl}${endpoint}`;

    const defaultHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      defaultHeaders['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    const responseData: ApiResponse<T> = await response.json();

    if (!responseData.success) {
      throw new InvoiceApiError(
        responseData.error?.code || 'UNKNOWN_ERROR',
        responseData.error?.message || 'An unknown error occurred',
        responseData.error?.details
      );
    }

    return responseData.data as T;
  }

  private getAuthToken(): string | null {
    // Get token using proper storage utility
    if (typeof window !== 'undefined') {
      return authStorage.getToken();
    }
    return null;
  }

  /**
   * Create a new invoice
   */
  async createInvoice(data: CreateInvoiceRequest): Promise<Invoice> {
    return this.request<Invoice>('/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(id: string): Promise<Invoice> {
    return this.request<Invoice>(`/invoices/${id}`);
  }

  /**
   * Get public invoice (no auth required)
   */
  async getPublicInvoice(id: string): Promise<Invoice> {
    return this.request<Invoice>(`/invoices/${id}/public`);
  }

  /**
   * Get user's invoices (authenticated - uses JWT context)
   */
  async getUserInvoices(params?: {
    status?: string;
    limit?: number;
    nextToken?: string;
  }): Promise<InvoiceListResponse> {
    const searchParams = new URLSearchParams();
    
    if (params?.status) searchParams.append('status', params.status);
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.nextToken) searchParams.append('nextToken', params.nextToken);

    const queryString = searchParams.toString();
    const endpoint = `/invoices${queryString ? `?${queryString}` : ''}`;

    return this.request<InvoiceListResponse>(endpoint);
  }

  /**
   * Update invoice status
   */
  async updateInvoiceStatus(id: string, status: 'sent' | 'cancelled'): Promise<Invoice> {
    return this.request<Invoice>(`/invoices/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  /**
   * Generate shareable link for invoice
   */
  async getShareableLink(id: string): Promise<{ shareUrl: string; expiresAt?: string }> {
    return this.request<{ shareUrl: string; expiresAt?: string }>(`/invoices/${id}/share`);
  }

  /**
   * Get invoice status (public)
   */
  async getInvoiceStatus(id: string): Promise<{
    status: string;
    last_updated: string;
  }> {
    return this.request(`/invoices/${id}/status`);
  }

  /**
   * Get dashboard statistics (authenticated - uses JWT context)
   */
  async getDashboardStats(): Promise<InvoiceStatsResponse> {
    return this.request<InvoiceStatsResponse>('/invoices/stats');
  }

  /**
   * Create invoice from template
   */
  async createFromTemplate(templateId: string, data: CreateInvoiceRequest): Promise<Invoice> {
    return this.request<Invoice>(`/templates/${templateId}/create-invoice`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Send invoice via email
   */
  async send(invoiceId: string): Promise<{ sent: boolean; message: string }> {
    return this.request<{ sent: boolean; message: string }>(`/invoices/${invoiceId}/send`, {
      method: 'POST',
    });
  }

  /**
   * Update invoice
   */
  async update(id: string, data: Partial<UpdateInvoiceRequest>): Promise<Invoice> {
    return this.request<Invoice>(`/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete invoice
   */
  async delete(id: string): Promise<{ deleted: boolean }> {
    return this.request<{ deleted: boolean }>(`/invoices/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * Create invoice (alias for backward compatibility)
   */
  async create(data: CreateInvoiceRequest): Promise<Invoice> {
    return this.createInvoice(data);
  }
}

// Export singleton instance
export const invoiceApi = new InvoiceApiClient();

// Export class for testing or custom instances
export { InvoiceApiClient, InvoiceApiError };

// Convenience functions that can be used directly
export const createInvoice = (data: CreateInvoiceRequest) => invoiceApi.createInvoice(data);
export const getInvoice = (id: string) => invoiceApi.getInvoice(id);
export const getPublicInvoice = (id: string) => invoiceApi.getPublicInvoice(id);
export const getUserInvoices = (params?: Parameters<typeof invoiceApi.getUserInvoices>[0]) => invoiceApi.getUserInvoices(params);
export const updateInvoiceStatus = (id: string, status: 'sent' | 'cancelled') => invoiceApi.updateInvoiceStatus(id, status);
export const getShareableLink = (id: string) => invoiceApi.getShareableLink(id);
export const getDashboardStats = () => invoiceApi.getDashboardStats();
export const createFromTemplate = (templateId: string, data: CreateInvoiceRequest) => invoiceApi.createFromTemplate(templateId, data);
export const sendInvoice = (invoiceId: string) => invoiceApi.send(invoiceId);