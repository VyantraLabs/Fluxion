/**
 * Unified API Client for Fluxion Microservices
 * Supports both main-service (user-facing) and admin-service APIs
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { config } from '@/utils/config';
import { authStorage, userStorage } from '@/utils/storage';
import { userTokenManager, adminTokenManager } from '@/utils/token-manager';

// Types for API responses
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
    validation_errors?: Record<string, string[]>;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrevious?: boolean;
    requestId: string;
    timestamp: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
    requestId: string;
    timestamp: string;
  };
}

// Service configuration
export interface ServiceConfig {
  baseUrl: string;
  timeout?: number;
  retries?: number;
}

export interface ApiClientConfig {
  mainService: ServiceConfig;
  adminService: ServiceConfig;
  debug?: boolean;
}

// Default configuration using config from utils/config.ts
const defaultConfig: ApiClientConfig = {
  mainService: {
    baseUrl: config.api.mainService.baseUrl,
    timeout: config.api.mainService.timeout,
    retries: 3,
  },
  adminService: {
    baseUrl: config.api.adminService.baseUrl,
    timeout: config.api.adminService.timeout,
    retries: 3,
  },
  debug: config.debug.enabled,
};

export class UnifiedApiClient {
  private mainServiceClient: AxiosInstance;
  private adminServiceClient: AxiosInstance;
  private config: ApiClientConfig;

  constructor(config: Partial<ApiClientConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.mainServiceClient = this.createAxiosInstance('main', this.config.mainService);
    this.adminServiceClient = this.createAxiosInstance('admin', this.config.adminService);
  }

  private createAxiosInstance(serviceName: string, serviceConfig: ServiceConfig): AxiosInstance {
    const client = axios.create({
      baseURL: serviceConfig.baseUrl,
      timeout: serviceConfig.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Type': serviceName === 'admin' ? 'admin-frontend' : 'frontend',
        'X-Client-Version': '1.0.0',
        'X-Service-Target': serviceName,
      },
    });

    // Request interceptor
    client.interceptors.request.use(
      (config) => {
        // Add auth token based on service
        const token = this.getAuthToken(serviceName === 'admin');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          console.debug(`🔐 ${serviceName.toUpperCase()} API Request - Auth header set:`, {
            url: config.url,
            method: config.method,
            tokenLength: token.length,
            tokenPreview: token.substring(0, 25) + '...',
            hasAuthHeader: !!config.headers.Authorization
          });
        } else {
          console.warn(`⚠️ ${serviceName.toUpperCase()} API Request - No auth token available:`, {
            url: config.url,
            method: config.method,
            serviceName,
            isAdmin: serviceName === 'admin'
          });
        }

        // Add request ID for tracking
        config.headers['X-Request-ID'] = this.generateRequestId();
        config.headers['X-Request-Timestamp'] = new Date().toISOString();

        // Always log API requests for debugging authentication issues
        console.debug(`🌐 ${serviceName.toUpperCase()} API Request:`, {
          url: config.url,
          method: config.method,
          hasAuth: !!config.headers.Authorization,
          baseURL: config.baseURL,
          authHeader: config.headers.Authorization ? '[PRESENT]' : '[MISSING]',
          timestamp: new Date().toISOString()
        });

        return config;
      },
      (error) => {
        console.error(`❌ ${serviceName.toUpperCase()} Request interceptor error:`, error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    client.interceptors.response.use(
      (response: AxiosResponse<ApiResponse>) => {
        if (this.config.debug) {
          console.debug(`✅ ${serviceName.toUpperCase()} API Response:`, {
            url: response.config.url,
            status: response.status,
            success: response.data.success,
          });
        }
        return response;
      },
      (error) => {
        console.error(`❌ ${serviceName.toUpperCase()} API Error:`, {
          url: error.config?.url,
          status: error.response?.status,
          message: error.response?.data?.error?.message || error.message,
        });

        // Handle authentication errors
        if (error.response?.status === 401) {
          this.handleAuthError(serviceName === 'admin');
        }

        // Transform error to consistent format
        const transformedError = this.transformError(error);
        return Promise.reject(transformedError);
      }
    );

    return client;
  }

  private getAuthToken(isAdmin: boolean = false): string | null {
    if (typeof window === 'undefined') {
      console.debug('🔍 UnifiedApiClient - Server-side rendering, no token available');
      return null;
    }
    
    // Use unified token managers for consistent token retrieval
    const token = isAdmin ? adminTokenManager.getToken() : userTokenManager.getToken();
    
    console.debug(`🔍 UnifiedApiClient - ${isAdmin ? 'Admin' : 'User'} token retrieval:`, {
      tokenExists: !!token,
      tokenLength: token?.length || 0,
      tokenPreview: token ? token.substring(0, 25) + '...' : 'null',
      isAdmin,
      timestamp: new Date().toISOString()
    });
    
    return token;
  }

  private handleAuthError(isAdmin: boolean = false): void {
    if (typeof window === 'undefined') return;
    
    if (isAdmin) {
      // Handle admin auth error using token manager
      adminTokenManager.removeToken();
      localStorage.removeItem('fluxion_admin_user');
    } else {
      // Handle regular user auth error using token manager
      userTokenManager.removeToken();
      authStorage.removeToken(); // Keep for backward compatibility
      userStorage.removeProfile();
    }
    
    // Redirect to appropriate login page
    const loginPath = isAdmin ? '/admin/login' : '/';
    if (window.location.pathname !== loginPath) {
      window.location.href = loginPath;
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private transformError(error: any): any {
    if (error.response) {
      const { status, data } = error.response;
      return {
        status,
        message: data?.error?.message || data?.message || 'An error occurred',
        code: data?.error?.code || this.mapStatusToErrorCode(status),
        details: data?.error?.details || data?.details,
        validation_errors: data?.error?.validation_errors,
        request_id: data?.meta?.requestId,
        timestamp: data?.meta?.timestamp,
      };
    }

    if (error.request) {
      return {
        status: 0,
        message: 'Network error - please check your connection',
        code: 'NETWORK_ERROR',
      };
    }

    return {
      status: 0,
      message: error.message || 'An unexpected error occurred',
      code: 'UNKNOWN_ERROR',
    };
  }

  private mapStatusToErrorCode(status: number): string {
    const errorCodes: { [key: number]: string } = {
      400: 'VALIDATION_ERROR',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      429: 'RATE_LIMIT_EXCEEDED',
      500: 'INTERNAL_ERROR',
      503: 'SERVICE_UNAVAILABLE',
    };
    return errorCodes[status] || 'UNKNOWN_ERROR';
  }

  private async retryRequest<T>(
    requestFn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn();
      } catch (error: any) {
        lastError = error;

        // Don't retry on auth or validation errors
        if (error.status === 401 || error.status === 400) {
          throw error;
        }

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }
      }
    }

    throw lastError;
  }

  // Generic request methods for main service
  async mainRequest<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const requestFn = async () => {
      const response = await this.mainServiceClient.request({
        method,
        url: endpoint,
        data,
        ...config,
      });
      return response.data;
    };

    return this.retryRequest(requestFn, this.config.mainService.retries);
  }

  // Generic request methods for admin service
  async adminRequest<T = any>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> {
    const requestFn = async () => {
      const response = await this.adminServiceClient.request({
        method,
        url: endpoint,
        data,
        ...config,
      });
      return response.data;
    };

    return this.retryRequest(requestFn, this.config.adminService.retries);
  }

  // ============================================================================
  // MAIN SERVICE API METHODS (User-facing)
  // ============================================================================

  // Authentication
  async getAuthMessage(walletAddress: string): Promise<ApiResponse<{ message: string; nonce: string }>> {
    return this.mainRequest('POST', `${config.api.basePath}/users/auth/message`, { wallet_address: walletAddress });
  }

  async verifyAuth(walletAddress: string, signature: string, message: string): Promise<ApiResponse<{ token: string; user: any; expiresIn: string }>> {
    return this.mainRequest('POST', `${config.api.basePath}/users/auth/verify`, { wallet_address: walletAddress, signature, message });
  }

  // User management
  async getUserProfile(): Promise<ApiResponse<any>> {
    return this.mainRequest('GET', `${config.api.basePath}/user/profile`);
  }

  async updateUserProfile(data: any): Promise<ApiResponse<any>> {
    return this.mainRequest('PUT', `${config.api.basePath}/user/profile`, data);
  }

  // Invoice management
  async createInvoice(data: any): Promise<ApiResponse<any>> {
    return this.mainRequest('POST', `${config.api.basePath}/invoices`, data);
  }

  async getInvoices(params?: any): Promise<ApiResponse<any[]>> {
    return this.mainRequest('GET', `${config.api.basePath}/invoices`, undefined, { params });
  }

  async getInvoice(id: string): Promise<ApiResponse<any>> {
    return this.mainRequest('GET', `${config.api.basePath}/invoices/${id}`);
  }

  async updateInvoice(id: string, data: any): Promise<ApiResponse<any>> {
    return this.mainRequest('PUT', `${config.api.basePath}/invoices/${id}`, data);
  }

  async deleteInvoice(id: string): Promise<ApiResponse<{ message: string }>> {
    return this.mainRequest('DELETE', `${config.api.basePath}/invoices/${id}`);
  }

  // Payment management
  async submitPayment(invoiceId: string, transactionHash: string, payerAddress: string): Promise<ApiResponse<any>> {
    return this.mainRequest('POST', `${config.api.basePath}/invoices/${invoiceId}/pay`, { transactionHash, payerAddress });
  }

  async getPayments(params?: any): Promise<ApiResponse<any[]>> {
    return this.mainRequest('GET', `${config.api.basePath}/payments`, undefined, { params });
  }

  // Organization management
  async getOrganizations(): Promise<ApiResponse<any[]>> {
    return this.mainRequest('GET', `${config.api.basePath}/organizations`);
  }

  async createOrganization(data: any): Promise<ApiResponse<any>> {
    return this.mainRequest('POST', `${config.api.basePath}/organizations`, data);
  }

  // Template management
  async getTemplates(params?: any): Promise<ApiResponse<any[]>> {
    return this.mainRequest('GET', `${config.api.basePath}/templates`, undefined, { params });
  }

  // Reminder management
  async getReminders(params?: any): Promise<ApiResponse<any[]>> {
    return this.mainRequest('GET', `${config.api.basePath}/reminders`, undefined, { params });
  }

  async createReminder(data: any): Promise<ApiResponse<any>> {
    return this.mainRequest('POST', `${config.api.basePath}/reminders`, data);
  }

  async getReminderById(id: string): Promise<ApiResponse<any>> {
    return this.mainRequest('GET', `${config.api.basePath}/reminders/${id}`);
  }

  async updateReminder(id: string, data: any): Promise<ApiResponse<any>> {
    return this.mainRequest('PUT', `${config.api.basePath}/reminders/${id}`, data);
  }

  async deleteReminder(id: string): Promise<ApiResponse<{ message: string }>> {
    return this.mainRequest('DELETE', `${config.api.basePath}/reminders/${id}`);
  }

  async executeReminder(id: string): Promise<ApiResponse<any>> {
    return this.mainRequest('POST', `${config.api.basePath}/reminders/${id}/execute`);
  }

  async pauseReminder(id: string): Promise<ApiResponse<any>> {
    return this.mainRequest('POST', `${config.api.basePath}/reminders/${id}/pause`);
  }

  async resumeReminder(id: string): Promise<ApiResponse<any>> {
    return this.mainRequest('POST', `${config.api.basePath}/reminders/${id}/resume`);
  }

  async getReminderStats(): Promise<ApiResponse<any>> {
    return this.mainRequest('GET', `${config.api.basePath}/reminders/stats`);
  }

  // Analytics
  async getDashboardAnalytics(period?: string): Promise<ApiResponse<any>> {
    return this.mainRequest('GET', `${config.api.basePath}/dashboard`, undefined, { params: { period } });
  }

  // ============================================================================
  // ADMIN SERVICE API METHODS (Admin-facing)
  // ============================================================================

  // Admin authentication
  async adminAuth(walletAddress: string, signature: string, message: string): Promise<ApiResponse<{ token: string; user: any; permissions: string[] }>> {
    return this.adminRequest('POST', `${config.api.adminService.basePath}/auth`, { wallet_address: walletAddress, signature, message });
  }

  async verifyAdminAuth(): Promise<ApiResponse<{ valid: boolean; user: any }>> {
    return this.adminRequest('GET', `${config.api.adminService.basePath}/auth/verify`);
  }

  // User management (admin)
  async adminGetUsers(params?: any): Promise<PaginatedResponse<any>> {
    return this.adminRequest('GET', `${config.api.adminService.basePath}/users`, undefined, { params }) as Promise<PaginatedResponse<any>>;
  }

  async adminUpdateUser(id: string, data: any): Promise<ApiResponse<any>> {
    return this.adminRequest('PUT', `${config.api.adminService.basePath}/users/${id}`, data);
  }

  async adminDeleteUser(id: string): Promise<ApiResponse<{ message: string }>> {
    return this.adminRequest('DELETE', `${config.api.adminService.basePath}/users/${id}`);
  }

  // Organization management (admin)
  async adminGetOrganizations(params?: any): Promise<PaginatedResponse<any>> {
    return this.adminRequest('GET', `${config.api.adminService.basePath}/organizations`, undefined, { params }) as Promise<PaginatedResponse<any>>;
  }

  async adminUpdateOrganization(id: string, data: any): Promise<ApiResponse<any>> {
    return this.adminRequest('PUT', `${config.api.adminService.basePath}/organizations/${id}`, data);
  }

  // System management
  async getSystemStats(): Promise<ApiResponse<any>> {
    return this.adminRequest('GET', `${config.api.adminService.basePath}/system/stats`);
  }

  async getSystemHealth(): Promise<ApiResponse<any>> {
    return this.adminRequest('GET', `${config.api.adminService.basePath}/system/health`);
  }

  // Template management (admin)
  async adminGetGlobalTemplates(): Promise<ApiResponse<any[]>> {
    return this.adminRequest('GET', `${config.api.adminService.basePath}/templates/global`);
  }

  async adminCreateGlobalTemplate(data: any): Promise<ApiResponse<any>> {
    return this.adminRequest('POST', `${config.api.adminService.basePath}/templates/global`, data);
  }

  // Activity logs
  async getActivityLogs(params?: any): Promise<PaginatedResponse<any>> {
    return this.adminRequest('GET', `${config.api.adminService.basePath}/activity-logs`, undefined, { params }) as Promise<PaginatedResponse<any>>;
  }

  async exportActivityLogs(params?: any): Promise<any> {
    return this.adminRequest('GET', `${config.api.adminService.basePath}/activity-logs/export`, undefined, { params });
  }

  // Global statistics
  async getGlobalStats(period?: string): Promise<ApiResponse<any>> {
    return this.adminRequest('GET', `${config.api.adminService.basePath}/stats/global`, undefined, { params: { period } });
  }

  async getRevenueStats(period?: string, granularity?: string): Promise<ApiResponse<any>> {
    return this.adminRequest('GET', `${config.api.adminService.basePath}/stats/revenue`, undefined, { params: { period, granularity } });
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  // Handle API response
  handleResponse<T>(response: ApiResponse<T>): T {
    if (!response.success) {
      const error = new Error(response.error?.message || 'API request failed');
      (error as any).code = response.error?.code;
      (error as any).details = response.error?.details;
      (error as any).validation_errors = response.error?.validation_errors;
      throw error;
    }

    if (response.data === undefined || response.data === null) {
      throw new Error('No data in API response');
    }

    return response.data;
  }

  // Handle paginated response
  handlePaginatedResponse<T>(response: PaginatedResponse<T>): {
    data: T[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  } {
    const data = this.handleResponse(response);
    return {
      data,
      pagination: {
        page: response.meta.page,
        limit: response.meta.limit,
        total: response.meta.total,
        totalPages: response.meta.totalPages,
        hasNext: response.meta.hasNext,
        hasPrevious: response.meta.hasPrevious,
      },
    };
  }

  // Update service URLs
  updateServiceUrls(mainServiceUrl?: string, adminServiceUrl?: string): void {
    if (mainServiceUrl) {
      this.config.mainService.baseUrl = mainServiceUrl;
      this.mainServiceClient = this.createAxiosInstance('main', this.config.mainService);
    }

    if (adminServiceUrl) {
      this.config.adminService.baseUrl = adminServiceUrl;
      this.adminServiceClient = this.createAxiosInstance('admin', this.config.adminService);
    }
  }

  // Get current configuration
  getConfig(): ApiClientConfig {
    return { ...this.config };
  }
}

// Create and export singleton instance
export const apiClient = new UnifiedApiClient();

// Export convenience methods
export const mainApi = {
  auth: {
    getMessage: (walletAddress: string) => apiClient.getAuthMessage(walletAddress),
    verify: (walletAddress: string, signature: string, message: string) => 
      apiClient.verifyAuth(walletAddress, signature, message),
  },
  users: {
    getProfile: () => apiClient.getUserProfile(),
    updateProfile: (data: any) => apiClient.updateUserProfile(data),
  },
  invoices: {
    create: (data: any) => apiClient.createInvoice(data),
    getAll: (params?: any) => apiClient.getInvoices(params),
    getById: (id: string) => apiClient.getInvoice(id),
    update: (id: string, data: any) => apiClient.updateInvoice(id, data),
    delete: (id: string) => apiClient.deleteInvoice(id),
  },
  payments: {
    submit: (invoiceId: string, transactionHash: string, payerAddress: string) => 
      apiClient.submitPayment(invoiceId, transactionHash, payerAddress),
    getAll: (params?: any) => apiClient.getPayments(params),
  },
  organizations: {
    getAll: () => apiClient.getOrganizations(),
    create: (data: any) => apiClient.createOrganization(data),
  },
  templates: {
    getAll: (params?: any) => apiClient.getTemplates(params),
  },
  reminders: {
    getAll: (params?: any) => apiClient.getReminders(params),
    create: (data: any) => apiClient.createReminder(data),
    getById: (id: string) => apiClient.getReminderById(id),
    update: (id: string, data: any) => apiClient.updateReminder(id, data),
    delete: (id: string) => apiClient.deleteReminder(id),
    execute: (id: string) => apiClient.executeReminder(id),
    pause: (id: string) => apiClient.pauseReminder(id),
    resume: (id: string) => apiClient.resumeReminder(id),
    getStats: () => apiClient.getReminderStats(),
  },
  analytics: {
    getDashboard: (period?: string) => apiClient.getDashboardAnalytics(period),
  },
};

export const adminApi = {
  auth: {
    login: (walletAddress: string, signature: string, message: string) => 
      apiClient.adminAuth(walletAddress, signature, message),
    verify: () => apiClient.verifyAdminAuth(),
  },
  users: {
    getAll: (params?: any) => apiClient.adminGetUsers(params),
    update: (id: string, data: any) => apiClient.adminUpdateUser(id, data),
    delete: (id: string) => apiClient.adminDeleteUser(id),
  },
  organizations: {
    getAll: (params?: any) => apiClient.adminGetOrganizations(params),
    update: (id: string, data: any) => apiClient.adminUpdateOrganization(id, data),
  },
  system: {
    getStats: () => apiClient.getSystemStats(),
    getHealth: () => apiClient.getSystemHealth(),
  },
  templates: {
    getGlobal: () => apiClient.adminGetGlobalTemplates(),
    createGlobal: (data: any) => apiClient.adminCreateGlobalTemplate(data),
  },
  activityLogs: {
    getAll: (params?: any) => apiClient.getActivityLogs(params),
    export: (params?: any) => apiClient.exportActivityLogs(params),
  },
  stats: {
    getGlobal: (period?: string) => apiClient.getGlobalStats(period),
    getRevenue: (period?: string, granularity?: string) => apiClient.getRevenueStats(period, granularity),
  },
};

export default apiClient;