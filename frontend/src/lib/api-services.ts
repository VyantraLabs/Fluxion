import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { authStorage } from '@/utils/storage';
import { config } from '@/utils/config';

// Service configuration using config from utils/config.ts
export const SERVICE_CONFIG = {
  main: {
    baseUrl: config.api.mainService.baseUrl,
    timeout: config.api.mainService.timeout,
  },
  admin: {
    baseUrl: config.api.adminService.baseUrl,
    timeout: config.api.adminService.timeout,
  }
} as const;

// Generate unique request ID
const generateRequestId = () => {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Get auth token
const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  return authStorage.getToken();
};

// Create a configured axios instance for a service
const createServiceClient = (serviceType: 'main' | 'admin'): AxiosInstance => {
  const config = SERVICE_CONFIG[serviceType];
  
  const client = axios.create({
    baseURL: config.baseUrl,
    timeout: config.timeout,
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Type': 'frontend',
      'X-Client-Version': '1.0.0',
      'X-Request-Source': 'frontend',
      'X-Service': serviceType,
    },
  });

  // Request interceptor for authentication
  client.interceptors.request.use(
    (config) => {
      // Add auth token if available
      const token = getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.debug(`🔐 [${serviceType}] API Request: Authorization header set`, {
          url: config.url,
          method: config.method,
          tokenPreview: token.substring(0, 20) + '...',
        });
      }

      // Add request ID for tracking
      config.headers['X-Request-ID'] = generateRequestId();
      config.headers['X-Request-Timestamp'] = new Date().toISOString();

      // Debug logging
      console.debug(`🌐 [${serviceType}] API Request:`, {
        url: config.url,
        method: config.method,
        hasAuth: !!config.headers.Authorization,
        baseURL: config.baseURL,
      });

      return config;
    },
    (error) => {
      console.error(`[${serviceType}] Request interceptor error:`, error);
      return Promise.reject(error);
    }
  );

  // Response interceptor for error handling
  client.interceptors.response.use(
    (response) => {
      console.debug(`✅ [${serviceType}] API Response:`, {
        url: response.config.url,
        status: response.status,
      });
      return response;
    },
    (error) => {
      console.error(`❌ [${serviceType}] API Error:`, {
        url: error.config?.url,
        status: error.response?.status,
        message: error.response?.data?.error?.message || error.message,
      });

      // Handle authentication errors
      if (error.response?.status === 401) {
        console.error(`🚫 [${serviceType}] Authentication error - clearing auth state`);
        // Clear auth state if needed
        // authStorage.clearAuth();
        // Redirect to login if needed
        // window.location.href = '/login';
      }

      return Promise.reject(error);
    }
  );

  return client;
};

// Service instances
export const mainService = createServiceClient('main');
export const adminService = createServiceClient('admin');

// Service-specific API endpoints using configurable base paths
export const API_ENDPOINTS = {
  main: {
    // Authentication
    auth: {
      message: `${config.api.basePath}/users/auth/message`,
      verify: `${config.api.basePath}/users/auth/verify`,
    },
    
    // User management
    users: {
      profile: `${config.api.basePath}/user/profile`,
      updateProfile: `${config.api.basePath}/user/profile`,
    },
    
    // Invoices
    invoices: {
      list: `${config.api.basePath}/invoices`,
      create: `${config.api.basePath}/invoices`,
      getById: (id: string) => `${config.api.basePath}/invoices/${id}`,
      update: (id: string) => `${config.api.basePath}/invoices/${id}`,
      delete: (id: string) => `${config.api.basePath}/invoices/${id}`,
      pay: (id: string) => `${config.api.basePath}/invoices/${id}/pay`,
    },
    
    // Payments
    payments: {
      list: `${config.api.basePath}/payments`,
      getById: (id: string) => `${config.api.basePath}/payments/${id}`,
    },
    
    // Organizations
    organizations: {
      list: `${config.api.basePath}/organizations`,
      create: `${config.api.basePath}/organizations`,
      getById: (id: string) => `${config.api.basePath}/organizations/${id}`,
      update: (id: string) => `${config.api.basePath}/organizations/${id}`,
    },
    
    // Templates
    templates: {
      list: `${config.api.basePath}/templates`,
      getById: (id: string) => `${config.api.basePath}/templates/${id}`,
    },
    
    // Analytics
    analytics: {
      dashboard: `${config.api.basePath}/analytics/dashboard`,
    },
  },
  
  admin: {
    // Admin authentication
    auth: {
      login: `${config.api.adminService.basePath}/auth`,
      verify: `${config.api.adminService.basePath}/auth/verify`,
    },
    
    // User management (admin)
    users: {
      list: `${config.api.adminService.basePath}/users`,
      getById: (id: string) => `${config.api.adminService.basePath}/users/${id}`,
      update: (id: string) => `${config.api.adminService.basePath}/users/${id}`,
      delete: (id: string) => `${config.api.adminService.basePath}/users/${id}`,
    },
    
    // Organization management (admin)
    organizations: {
      list: `${config.api.adminService.basePath}/organizations`,
      getById: (id: string) => `${config.api.adminService.basePath}/organizations/${id}`,
      update: (id: string) => `${config.api.adminService.basePath}/organizations/${id}`,
      delete: (id: string) => `${config.api.adminService.basePath}/organizations/${id}`,
    },
    
    // System management
    system: {
      stats: `${config.api.adminService.basePath}/system/stats`,
      health: `${config.api.adminService.basePath}/system/health`,
    },
    
    // Template management (admin)
    templates: {
      globalList: `${config.api.adminService.basePath}/templates/global`,
      createGlobal: `${config.api.adminService.basePath}/templates/global`,
      updateGlobal: (id: string) => `${config.api.adminService.basePath}/templates/global/${id}`,
      deleteGlobal: (id: string) => `${config.api.adminService.basePath}/templates/global/${id}`,
    },
    
    // Activity logs
    activityLogs: {
      list: `${config.api.adminService.basePath}/activity-logs`,
      export: `${config.api.adminService.basePath}/activity-logs/export`,
    },
    
    // Global statistics
    stats: {
      global: `${config.api.adminService.basePath}/stats/global`,
      revenue: `${config.api.adminService.basePath}/stats/revenue`,
    },
  },
} as const;

// Helper functions for making API calls
export const mainApi = {
  // Authentication
  getAuthMessage: (walletAddress: string) => 
    mainService.post(API_ENDPOINTS.main.auth.message, { walletAddress }),
    
  verifySignature: (data: { walletAddress: string; signature: string; message: string }) =>
    mainService.post(API_ENDPOINTS.main.auth.verify, data),
    
  // User Profile
  getUserProfile: () => 
    mainService.get(API_ENDPOINTS.main.users.profile),
    
  updateUserProfile: (data: any) =>
    mainService.put(API_ENDPOINTS.main.users.updateProfile, data),
    
  // Invoices
  getInvoices: (params?: any) =>
    mainService.get(API_ENDPOINTS.main.invoices.list, { params }),
    
  createInvoice: (data: any) =>
    mainService.post(API_ENDPOINTS.main.invoices.create, data),
    
  getInvoiceById: (id: string) =>
    mainService.get(API_ENDPOINTS.main.invoices.getById(id)),
    
  updateInvoice: (id: string, data: any) =>
    mainService.put(API_ENDPOINTS.main.invoices.update(id), data),
    
  deleteInvoice: (id: string) =>
    mainService.delete(API_ENDPOINTS.main.invoices.delete(id)),
    
  payInvoice: (id: string, data: { transactionHash: string; payerAddress: string }) =>
    mainService.post(API_ENDPOINTS.main.invoices.pay(id), data),
    
  // Payments
  getPayments: (params?: any) =>
    mainService.get(API_ENDPOINTS.main.payments.list, { params }),
    
  getPaymentById: (id: string) =>
    mainService.get(API_ENDPOINTS.main.payments.getById(id)),
    
  // Organizations
  getOrganizations: () =>
    mainService.get(API_ENDPOINTS.main.organizations.list),
    
  createOrganization: (data: any) =>
    mainService.post(API_ENDPOINTS.main.organizations.create, data),
    
  getOrganizationById: (id: string) =>
    mainService.get(API_ENDPOINTS.main.organizations.getById(id)),
    
  updateOrganization: (id: string, data: any) =>
    mainService.put(API_ENDPOINTS.main.organizations.update(id), data),
    
  // Templates
  getTemplates: (params?: any) =>
    mainService.get(API_ENDPOINTS.main.templates.list, { params }),
    
  getTemplateById: (id: string) =>
    mainService.get(API_ENDPOINTS.main.templates.getById(id)),
    
  // Analytics
  getDashboardStats: (params?: any) =>
    mainService.get(API_ENDPOINTS.main.analytics.dashboard, { params }),
};

export const adminApi = {
  // Admin Authentication
  adminLogin: (data: { walletAddress: string; signature: string; message: string }) =>
    adminService.post(API_ENDPOINTS.admin.auth.login, data),
    
  verifyAdminToken: () =>
    adminService.get(API_ENDPOINTS.admin.auth.verify),
    
  // User Management
  getUsers: (params?: any) =>
    adminService.get(API_ENDPOINTS.admin.users.list, { params }),
    
  getUserById: (id: string) =>
    adminService.get(API_ENDPOINTS.admin.users.getById(id)),
    
  updateUser: (id: string, data: any) =>
    adminService.put(API_ENDPOINTS.admin.users.update(id), data),
    
  deleteUser: (id: string) =>
    adminService.delete(API_ENDPOINTS.admin.users.delete(id)),
    
  // Organization Management
  getAdminOrganizations: (params?: any) =>
    adminService.get(API_ENDPOINTS.admin.organizations.list, { params }),
    
  getAdminOrganizationById: (id: string) =>
    adminService.get(API_ENDPOINTS.admin.organizations.getById(id)),
    
  updateAdminOrganization: (id: string, data: any) =>
    adminService.put(API_ENDPOINTS.admin.organizations.update(id), data),
    
  deleteAdminOrganization: (id: string) =>
    adminService.delete(API_ENDPOINTS.admin.organizations.delete(id)),
    
  // System Management
  getSystemStats: () =>
    adminService.get(API_ENDPOINTS.admin.system.stats),
    
  getSystemHealth: () =>
    adminService.get(API_ENDPOINTS.admin.system.health),
    
  // Template Management
  getGlobalTemplates: () =>
    adminService.get(API_ENDPOINTS.admin.templates.globalList),
    
  createGlobalTemplate: (data: any) =>
    adminService.post(API_ENDPOINTS.admin.templates.createGlobal, data),
    
  updateGlobalTemplate: (id: string, data: any) =>
    adminService.put(API_ENDPOINTS.admin.templates.updateGlobal(id), data),
    
  deleteGlobalTemplate: (id: string) =>
    adminService.delete(API_ENDPOINTS.admin.templates.deleteGlobal(id)),
    
  // Activity Logs
  getActivityLogs: (params?: any) =>
    adminService.get(API_ENDPOINTS.admin.activityLogs.list, { params }),
    
  exportActivityLogs: (params?: any) =>
    adminService.get(API_ENDPOINTS.admin.activityLogs.export, { params }),
    
  // Statistics
  getGlobalStats: (params?: any) =>
    adminService.get(API_ENDPOINTS.admin.stats.global, { params }),
    
  getRevenueStats: (params?: any) =>
    adminService.get(API_ENDPOINTS.admin.stats.revenue, { params }),
};

// Export types for TypeScript support
export type MainApiEndpoints = typeof API_ENDPOINTS.main;
export type AdminApiEndpoints = typeof API_ENDPOINTS.admin;
export type ServiceType = 'main' | 'admin';