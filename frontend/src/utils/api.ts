import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { config, apiEndpoints } from './config';
import { ApiResponse, PaginatedResponse, ErrorCodes, TenantContext } from '@/types/common';
import { authStorage } from './storage';
import { userTokenManager } from './token-manager';
// Import from api-client for unified service access
import { mainApi, apiClient as unifiedApiClient } from '@/lib/api-client';
// Import service-specific APIs for microservices routing
import { mainApi as serviceMainApi, adminApi as serviceAdminApi } from '@/lib/api-services';

// Create axios instance (Legacy - for backward compatibility)
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: config.api.mainService.baseUrl, // Use main service as default
    timeout: config.api.mainService.timeout,
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Type': 'frontend',
      'X-Client-Version': '1.0.0',
      'X-Request-Source': 'frontend',
      // Tenant ID will be extracted from JWT token by backend middleware
    },
  });

  // Request interceptor for authentication
  client.interceptors.request.use(
    (config) => {
      // Add auth token if available
      const token = getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        console.debug('🔐 API Request: Authorization header set', {
          url: config.url,
          method: config.method,
          tokenPreview: token.substring(0, 20) + '...',
          tokenLength: token.length,
          hasAuthHeader: !!config.headers.Authorization,
          timestamp: new Date().toISOString()
        });
      } else {
        console.warn('⚠️ API Request: No token available - this may cause auth errors!', {
          url: config.url,
          method: config.method,
          hasAuthHeader: !!config.headers.Authorization,
          isServerSide: typeof window === 'undefined',
          timestamp: new Date().toISOString()
        });
      }

      // Add request ID for tracking
      config.headers['X-Request-ID'] = generateRequestId();

      // Add timestamp
      config.headers['X-Request-Timestamp'] = new Date().toISOString();

      // Debug logging for requests - Always log for debugging
      console.debug('🌐 API Request:', {
        url: config.url,
        method: config.method,
        hasAuth: !!config.headers.Authorization,
        baseURL: config.baseURL,
        headers: {
          Authorization: config.headers.Authorization ? '[PRESENT]' : '[MISSING]',
          'Content-Type': config.headers['Content-Type'],
          'X-Request-ID': config.headers['X-Request-ID']
        }
      });

      return config;
    },
    (error) => {
      return Promise.reject(error);
    }
  );

  // Response interceptor for error handling
  client.interceptors.response.use(
    (response: AxiosResponse<ApiResponse>) => {
      // Log successful responses in development
      if (config.debug.enabled) {
        console.log('API Response:', {
          url: response.config.url,
          status: response.status,
          data: response.data,
        });
      }

      return response;
    },
    (error) => {
      console.error('API Error:', error);

      // Handle specific error cases
      if (error.response) {
        const { status, data } = error.response;

        // Handle authentication errors
        if (status === 401 || data?.error?.code === ErrorCodes.UNAUTHORIZED) {
          console.error('🚫 Authentication error detected:', {
            status,
            url: error.config?.url,
            method: error.config?.method,
            hasAuthHeader: !!error.config?.headers?.Authorization,
            errorData: data
          });
          handleAuthError();
        }

        // Handle rate limiting
        if (status === 429 || data?.error?.code === ErrorCodes.RATE_LIMIT_EXCEEDED) {
          handleRateLimitError();
        }

        // Enhanced error structure to match backend
        const errorInfo = {
          status,
          message: data?.error?.message || data?.message || 'An error occurred',
          code: data?.error?.code || mapStatusToErrorCode(status),
          details: data?.error?.details || data?.details,
          // Additional context from enhanced error responses
          validation_errors: data?.error?.validation_errors,
          request_id: data?.meta?.requestId,
          timestamp: data?.meta?.timestamp,
        };

        console.error('API Error Details:', errorInfo);
        return Promise.reject(errorInfo);
      }

      // Handle network errors
      if (error.request) {
        return Promise.reject({
          status: 0,
          message: 'Network error - please check your connection',
          code: 'NETWORK_ERROR',
        });
      }

      // Handle other errors
      return Promise.reject({
        status: 0,
        message: error.message || 'An unexpected error occurred',
        code: 'UNKNOWN_ERROR',
      });
    }
  );

  return client;
};

// Create legacy API client instance for backward compatibility
export const legacyApiClient = createApiClient();

// Re-export the unified API client as the default apiClient
export const apiClient = unifiedApiClient;

// Helper functions
const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
};

const getAuthToken = (): string | null => {
  // Use the unified token manager for consistent token retrieval
  const token = userTokenManager.getToken();
  
  // If token manager doesn't have token, try fallback methods
  let fallbackToken = null;
  if (!token && typeof window !== 'undefined') {
    // Try direct localStorage access
    try {
      fallbackToken = localStorage.getItem('fluxion_auth_token');
      if (fallbackToken) {
        // Try to parse if it's structured data
        try {
          const parsed = JSON.parse(fallbackToken);
          if (parsed.value) {
            fallbackToken = parsed.value;
          }
        } catch {
          // If parsing fails, use as-is if it looks like a JWT
          if (!fallbackToken.includes('.') || fallbackToken.split('.').length !== 3) {
            fallbackToken = null;
          }
        }
      }
      
      // Try legacy storage keys
      if (!fallbackToken) {
        fallbackToken = localStorage.getItem('auth_token') || 
                       localStorage.getItem('token') || 
                       localStorage.getItem('fluxion_token');
      }
    } catch (error) {
      console.error('Error accessing fallback token storage:', error);
    }
  }
  
  const finalToken = token || fallbackToken;
  
  console.debug('🔍 Legacy API Client - Token retrieval with fallback:', {
    tokenManagerToken: !!token,
    fallbackToken: !!fallbackToken,
    finalToken: !!finalToken,
    tokenLength: finalToken?.length || 0,
    tokenPreview: finalToken ? finalToken.substring(0, 25) + '...' : 'null',
    timestamp: new Date().toISOString(),
    source: token ? 'TokenManager' : fallbackToken ? 'Fallback' : 'None'
  });
  
  return finalToken;
};

const handleAuthError = (): void => {
  // Clear stored auth token using unified token manager
  if (typeof window !== 'undefined') {
    userTokenManager.removeToken();
    authStorage.removeToken();
    // Keep the legacy localStorage removal for backward compatibility
    localStorage.removeItem('fluxion_user');
  }

  // Redirect to login or show auth modal
  if (typeof window !== 'undefined' && window.location.pathname !== '/') {
    window.location.href = '/';
  }
};

const handleRateLimitError = (): void => {
  // Show rate limit notification
  console.warn('Rate limit exceeded. Please try again later.');
};

// Map HTTP status codes to error codes
const mapStatusToErrorCode = (status: number): string => {
  switch (status) {
    case 400:
      return ErrorCodes.VALIDATION_ERROR;
    case 401:
      return ErrorCodes.UNAUTHORIZED;
    case 403:
      return ErrorCodes.FORBIDDEN;
    case 404:
      return ErrorCodes.NOT_FOUND;
    case 409:
      return ErrorCodes.CONFLICT;
    case 429:
      return ErrorCodes.RATE_LIMIT_EXCEEDED;
    case 503:
      return ErrorCodes.SERVICE_UNAVAILABLE;
    case 500:
    default:
      return ErrorCodes.INTERNAL_ERROR;
  }
};

// Generic API functions
export const apiRequest = {
  get: async <T = any>(
    url: string,
    params?: Record<string, any>
  ): Promise<ApiResponse<T>> => {
    const response = await legacyApiClient.get(url, { params });
    return response.data;
  },

  post: async <T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> => {
    const response = await legacyApiClient.post(url, data, config);
    return response.data;
  },

  put: async <T = any>(
    url: string,
    data?: any,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> => {
    const response = await legacyApiClient.put(url, data, config);
    return response.data;
  },

  delete: async <T = any>(
    url: string,
    config?: AxiosRequestConfig
  ): Promise<ApiResponse<T>> => {
    const response = await legacyApiClient.delete(url, config);
    return response.data;
  },
};

// Specific API functions
export const healthApi = {
  check: () => apiRequest.get(apiEndpoints.health),
  metrics: () => apiRequest.get(apiEndpoints.metrics),
};

export const authApi = {
  getMessage: (walletAddress: string) =>
    mainApi.auth.getMessage(walletAddress),

  verifySignature: (walletAddress: string, signature: string, message: string) =>
    mainApi.auth.verify(walletAddress, signature, message),

  createUser: (
    walletAddress: string, 
    signature: string, 
    message: string,
    organizationName: string,
    displayName?: string,
    email?: string
  ) =>
    apiRequest.post(apiEndpoints.auth.create, {
      wallet_address: walletAddress,
      signature,
      message,
      organizationName,
      displayName,
      email,
    }),
};

export const userApi = {
  // Public user endpoints (no auth required)
  exists: (wallet: string) =>
    apiRequest.get(apiEndpoints.users.exists(wallet)),

  // Alias for backwards compatibility
  checkUserExists: (wallet: string) =>
    apiRequest.get(apiEndpoints.users.exists(wallet)),

  validateAddress: (walletAddress: string) =>
    apiRequest.post(apiEndpoints.users.validateAddress, { wallet_address: walletAddress }),

  getPlatformStats: () =>
    apiRequest.get(apiEndpoints.users.platformStats),

  // Authenticated user endpoints (auth required, no wallet parameter)
  getProfile: () =>
    mainApi.users.getProfile(),

  updateProfile: (data: any) =>
    mainApi.users.updateProfile(data),

  deleteProfile: () =>
    apiRequest.delete(apiEndpoints.user.profile),

  getStats: () =>
    apiRequest.get(apiEndpoints.user.stats),

  completeOnboarding: (data: { organizationName: string; displayName?: string; email?: string }) =>
    apiRequest.post(apiEndpoints.user.completeOnboarding, data),
};

export const invoiceApi = {
  create: (data: any) =>
    mainApi.invoices.create({ ...data, status: data.status || 'created' }),
  saveDraft: (data: any) =>
    mainApi.invoices.create({ ...data, status: 'draft' }),
  createWithStatus: (data: any, status: 'draft' | 'created' | 'initiated' | 'sent') =>
    mainApi.invoices.create({ ...data, status }),
  
  // Template integration - for now, this just creates a regular invoice
  // TODO: Implement proper template-to-invoice conversion in backend
  createFromTemplate: (templateId: string, data: any) => {
    // For now, just create a regular invoice with the provided data
    // The template data should have been applied in the frontend
    console.log(`Creating invoice from template ${templateId}`, data);
    return apiRequest.post(apiEndpoints.invoices.base, data);
  },

  getById: (id: string) =>
    mainApi.invoices.getById(id),

  getPublic: (id: string) =>
    apiRequest.get(apiEndpoints.invoices.public(id)),

  getClientInvoice: (token: string) =>
    apiRequest.get(`${apiEndpoints.invoices.base}/client/${token}`),

  update: (id: string, data: any) =>
    mainApi.invoices.update(id, data),

  delete: (id: string) =>
    mainApi.invoices.delete(id),

  send: (id: string) =>
    apiRequest.post(apiEndpoints.invoices.send(id)),

  bulkSend: (ids: string[]) =>
    apiRequest.post(`${apiEndpoints.invoices.base}/bulk/send`, { ids }),

  bulkCancel: (ids: string[]) =>
    apiRequest.post(`${apiEndpoints.invoices.base}/bulk/cancel`, { ids }),

  bulkDelete: (ids: string[]) =>
    apiRequest.post(`${apiEndpoints.invoices.base}/bulk/delete`, { ids }),

  duplicate: (id: string) =>
    apiRequest.post(`${apiEndpoints.invoices.byId(id)}/duplicate`),

  getUserInvoices: (params?: {
    limit?: number;
    nextToken?: string;
    status?: string;
  }) => mainApi.invoices.getAll(params),

  getStats: () =>
    apiRequest.get(apiEndpoints.invoices.stats),
};

export const paymentApi = {
  verify: (invoiceId: string, txHash: string, fromAddress: string) =>
    apiRequest.post(apiEndpoints.payments.verify, {
      invoice_id: invoiceId,
      tx_hash: txHash,
      from_address: fromAddress,
    }),

  submitPayment: (invoiceId: string, txHash: string, payerAddress: string) =>
    mainApi.payments.submit(invoiceId, txHash, payerAddress),

  getById: (id: string) =>
    apiRequest.get(apiEndpoints.payments.byId(id)),

  getByTxHash: (hash: string) =>
    apiRequest.get(apiEndpoints.payments.byTxHash(hash)),
};

export const analyticsApi = {
  getPlatform: () =>
    apiRequest.get(apiEndpoints.analytics.platform),
};

// Organization API
export const organizationApi = {
  getAll: () =>
    mainApi.organizations.getAll(),
    
  getById: (id: string) =>
    apiRequest.get(`${config.api.basePath}/organizations/${id}`),
    
  // Organization activity logs (routes to main service with proper API base path)
  getActivity: async (orgId: string, params?: {
    limit?: number;
    offset?: number;
    type?: string;
  }) => {
    try {
      // Route to main service for organization activity logs using proper configuration
      const queryParams: Record<string, string> = {};
      if (params?.limit) queryParams.limit = params.limit.toString();
      if (params?.offset) queryParams.offset = params.offset.toString();
      if (params?.type) queryParams.type = params.type;
      
      const queryString = Object.keys(queryParams).length > 0 
        ? '?' + new URLSearchParams(queryParams).toString() 
        : '';
        
      // Use main service with proper API base path for organization activity logs
      const endpoint = `${config.api.basePath}/organizations/${orgId}/activity${queryString}`;
      const response = await unifiedApiClient.mainRequest('GET', endpoint);
      
      // Normalize the response format to ensure consistent data structure
      if (response.success && response.data) {
        // Handle different response formats from the backend
        let activities = [];
        
        if (response.data.activities && Array.isArray(response.data.activities)) {
          // Real API format: { success: true, data: { activities: [...] } }
          activities = response.data.activities;
        } else if (Array.isArray(response.data)) {
          // Alternative format: { success: true, data: [...] }
          activities = response.data;
        }
        
        // Normalize each activity to ensure consistent actor field
        const normalizedActivities = activities.map((activity: any) => ({
          ...activity,
          // Ensure actor property exists (map from 'user' field if needed)
          actor: activity.actor || activity.user || {
            id: activity.user_id || 'unknown',
            display_name: activity.user?.display_name || activity.user?.wallet_address || 'Unknown User',
            email: activity.user?.email
          },
          // Ensure required fields have defaults
          id: activity.id || `activity_${Date.now()}_${Math.random()}`,
          type: activity.type || 'unknown',
          description: activity.description || 'Unknown activity',
          metadata: activity.metadata || {},
          created_at: activity.created_at || new Date().toISOString()
        }));
        
        // Return in consistent format
        return {
          success: true,
          data: {
            activities: normalizedActivities,
            pagination: response.data.pagination || { hasMore: false }
          }
        };
      }
      
      return response;
    } catch (error: any) {
      // If endpoint doesn't exist (404), return mock data
      if (error.status === 404) {
        console.warn('Organization activity endpoint not implemented, using mock data');
        const mockActivities = generateMockActivityLogs(orgId, params?.limit || 10);
        return {
          success: true,
          data: {
            activities: mockActivities,
            pagination: { hasMore: false }
          }
        };
      }
      throw error;
    }
  },
  
  getUsers: (orgId: string) =>
    apiRequest.get(`${config.api.basePath}/organizations/${orgId}/users`),
    
  getStats: (orgId: string) =>
    apiRequest.get(`${config.api.basePath}/organizations/${orgId}/stats`),
};

// Mock activity logs generator for development
const generateMockActivityLogs = (orgId: string, limit: number = 10) => {
  const actions = [
    'invoice_created',
    'invoice_sent',
    'invoice_paid',
    'user_invited',
    'user_joined',
    'settings_updated',
    'template_created',
    'payment_received',
    'reminder_sent',
  ];
  
  const actorNames = ['John Doe', 'Jane Smith', 'Mike Johnson', 'Sarah Wilson', 'David Brown'];
  const organizations = ['Acme Corp', 'Tech Startup', 'Design Agency', 'Consulting Firm'];
  
  return Array.from({ length: limit }, (_, index) => {
    const action = actions[Math.floor(Math.random() * actions.length)];
    const actorName = actorNames[Math.floor(Math.random() * actorNames.length)];
    const hoursAgo = Math.floor(Math.random() * 48) + 1; // 1-48 hours ago
    
    let description = '';
    let metadata: any = {};
    
    switch (action) {
      case 'invoice_created':
        const invoiceNum = Math.floor(Math.random() * 1000);
        description = `Created invoice #INV-${invoiceNum}`;
        metadata = { invoice_id: `inv_${invoiceNum}`, amount: `$${Math.floor(Math.random() * 5000) + 500}` };
        break;
      case 'invoice_sent':
        description = `Sent invoice to client`;
        metadata = { recipient: 'client@example.com' };
        break;
      case 'invoice_paid':
        description = `Payment received for invoice`;
        metadata = { amount: `$${Math.floor(Math.random() * 5000) + 500}` };
        break;
      case 'user_invited':
        description = `Invited new user to organization`;
        metadata = { email: 'newuser@example.com' };
        break;
      case 'user_joined':
        description = `Joined the organization`;
        break;
      case 'settings_updated':
        description = `Updated organization settings`;
        metadata = { setting: 'payment_terms' };
        break;
      default:
        description = `Performed ${action.replace('_', ' ')}`;
    }
    
    return {
      id: `activity_${index + 1}`,
      organization_id: orgId,
      organization_name: organizations[Math.floor(Math.random() * organizations.length)],
      type: action as any, // Cast to satisfy type constraints
      description,
      actor: {
        id: `user_${Math.floor(Math.random() * 5) + 1}`,
        display_name: actorName,
        email: `${actorName.toLowerCase().replace(' ', '.')}@example.com`,
      },
      metadata,
      created_at: new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString(),
    };
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
};

// Template API
export const templateApi = {
  // Template CRUD
  create: (data: any) =>
    apiRequest.post(apiEndpoints.templates.base, data),

  getById: (id: string) =>
    apiRequest.get(apiEndpoints.templates.byId(id)),

  update: (id: string, data: any) =>
    apiRequest.put(apiEndpoints.templates.byId(id), data),

  delete: (id: string) =>
    apiRequest.delete(apiEndpoints.templates.byId(id)),

  // Template listing (unified endpoint supports both authenticated and unauthenticated access)
  getAll: (params?: {
    category?: string;
    search?: string;
    name?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
    nextToken?: string;
  }) => mainApi.templates.getAll(params),

  // Categories (unified endpoint supports both authenticated and unauthenticated access)
  getCategories: () =>
    apiRequest.get(apiEndpoints.templates.categories),

  // Template analytics
  getAnalytics: (id: string) =>
    apiRequest.get(apiEndpoints.templates.analytics(id)),

  // Template usage
  incrementUsage: (id: string) =>
    apiRequest.post(apiEndpoints.templates.incrementUsage(id)),
};

// Reminder API - Updated to use unified API client
export const reminderApi = {
  // Reminder CRUD
  create: (data: any) =>
    mainApi.reminders.create(data),

  getById: (id: string) =>
    mainApi.reminders.getById(id),

  update: (id: string, data: any) =>
    mainApi.reminders.update(id, data),

  delete: (id: string) =>
    mainApi.reminders.delete(id),

  // Reminder listing
  getAll: (params?: {
    type?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) => mainApi.reminders.getAll(params),

  // Reminder execution
  execute: (id: string) =>
    mainApi.reminders.execute(id),

  pause: (id: string) =>
    mainApi.reminders.pause(id),

  resume: (id: string) =>
    mainApi.reminders.resume(id),

  // Reminder analytics
  getAnalytics: (id: string) =>
    apiRequest.get(apiEndpoints.reminders.analytics(id)),

  getStats: () =>
    mainApi.reminders.getStats(),

  // Reminder templates
  getTemplates: () =>
    apiRequest.get(apiEndpoints.reminders.templates),

  // Invoice-specific reminders
  getByInvoiceId: (invoiceId: string) =>
    apiRequest.get(apiEndpoints.reminders.byInvoice(invoiceId)),

  setupForInvoice: (invoiceId: string, data: any) =>
    apiRequest.post(apiEndpoints.reminders.setupForInvoice(invoiceId), data),

  // Bulk operations
  bulkCreate: (data: any) =>
    apiRequest.post(apiEndpoints.reminders.bulkCreate, data),
};

// Session storage utilities for configuration caching
const SESSION_STORAGE_KEYS = {
  NETWORKS: 'fluxion_networks_cache',
  TOKENS: 'fluxion_tokens_cache',
  CONFIG_SUMMARY: 'fluxion_config_summary',
  CONFIG_TIMESTAMP: 'fluxion_config_timestamp'
};

// Cache duration in milliseconds (15 minutes)
const CACHE_DURATION = 15 * 60 * 1000;

const sessionCache = {
  set: (key: string, data: any) => {
    try {
      const cacheEntry = {
        data,
        timestamp: Date.now()
      };
      sessionStorage.setItem(key, JSON.stringify(cacheEntry));
    } catch (error) {
      console.warn('Failed to cache data in session storage:', error);
    }
  },
  
  get: (key: string) => {
    try {
      const cached = sessionStorage.getItem(key);
      if (!cached) return null;
      
      const cacheEntry = JSON.parse(cached);
      const isExpired = Date.now() - cacheEntry.timestamp > CACHE_DURATION;
      
      if (isExpired) {
        sessionStorage.removeItem(key);
        return null;
      }
      
      return cacheEntry.data;
    } catch (error) {
      console.warn('Failed to retrieve cached data from session storage:', error);
      return null;
    }
  },
  
  clear: (key?: string) => {
    try {
      if (key) {
        sessionStorage.removeItem(key);
      } else {
        // Clear all fluxion cache keys
        Object.values(SESSION_STORAGE_KEYS).forEach(k => sessionStorage.removeItem(k));
      }
    } catch (error) {
      console.warn('Failed to clear session storage:', error);
    }
  }
};

// Configuration API
export const configApi = {
  // Get all blockchain networks
  getNetworks: async (params?: {
    active?: boolean;
    testnet?: boolean;
    chainIds?: number[];
    symbols?: string[];
    includeTokens?: boolean;
  }) => {
    // Generate cache key based on parameters
    const cacheKey = `${SESSION_STORAGE_KEYS.NETWORKS}_${JSON.stringify(params || {})}`;
    
    // Try to get from cache first
    if (typeof window !== 'undefined') {
      const cached = sessionCache.get(cacheKey);
      if (cached) {
        console.log('Using cached networks data');
        return cached;
      }
    }
    
    // If not cached, fetch from API
    const queryParams: Record<string, string> = {};
    
    if (params?.active !== undefined) {
      queryParams.active = params.active.toString();
    }
    if (params?.testnet !== undefined) {
      queryParams.testnet = params.testnet.toString();
    }
    if (params?.chainIds?.length) {
      queryParams.chainIds = params.chainIds.join(',');
    }
    if (params?.symbols?.length) {
      queryParams.symbols = params.symbols.join(',');
    }
    if (params?.includeTokens !== undefined) {
      queryParams.includeTokens = params.includeTokens.toString();
    }

    const response = await apiRequest.get(apiEndpoints.config.networks, queryParams);
    
    // Cache the response for future use
    if (typeof window !== 'undefined') {
      sessionCache.set(cacheKey, response);
      console.log('Networks data cached');
    }
    
    return response;
  },

  // Get specific network by chain ID
  getNetworkByChainId: (chainId: number) =>
    apiRequest.get(apiEndpoints.config.networkByChainId(chainId)),

  // Get all tokens
  getTokens: async (params?: {
    active?: boolean;
    stablecoin?: boolean;
    native?: boolean;
    networkId?: string;
    chainId?: number;
    symbols?: string[];
    includeNetwork?: boolean;
  }) => {
    // Generate cache key based on parameters
    const cacheKey = `${SESSION_STORAGE_KEYS.TOKENS}_${JSON.stringify(params || {})}`;
    
    // Try to get from cache first
    if (typeof window !== 'undefined') {
      const cached = sessionCache.get(cacheKey);
      if (cached) {
        console.log('Using cached tokens data');
        return cached;
      }
    }
    
    // If not cached, fetch from API
    const queryParams: Record<string, string> = {};
    
    if (params?.active !== undefined) {
      queryParams.active = params.active.toString();
    }
    if (params?.stablecoin !== undefined) {
      queryParams.stablecoin = params.stablecoin.toString();
    }
    if (params?.native !== undefined) {
      queryParams.native = params.native.toString();
    }
    if (params?.networkId) {
      queryParams.networkId = params.networkId;
    }
    if (params?.chainId !== undefined) {
      queryParams.chainId = params.chainId.toString();
    }
    if (params?.symbols?.length) {
      queryParams.symbols = params.symbols.join(',');
    }
    if (params?.includeNetwork !== undefined) {
      queryParams.includeNetwork = params.includeNetwork.toString();
    }

    const response = await apiRequest.get(apiEndpoints.config.tokens, queryParams);
    
    // Cache the response for future use
    if (typeof window !== 'undefined') {
      sessionCache.set(cacheKey, response);
      console.log('Tokens data cached');
    }
    
    return response;
  },

  // Get tokens for specific network
  getTokensByChainId: (chainId: number, params?: {
    active?: boolean;
    stablecoin?: boolean;
    native?: boolean;
    symbols?: string[];
  }) => {
    const queryParams: Record<string, string> = {};
    
    if (params?.active !== undefined) {
      queryParams.active = params.active.toString();
    }
    if (params?.stablecoin !== undefined) {
      queryParams.stablecoin = params.stablecoin.toString();
    }
    if (params?.native !== undefined) {
      queryParams.native = params.native.toString();
    }
    if (params?.symbols?.length) {
      queryParams.symbols = params.symbols.join(',');
    }

    return apiRequest.get(apiEndpoints.config.tokensByChainId(chainId), queryParams);
  },

  // Get complete application configuration
  getAppConfig: () =>
    apiRequest.get(apiEndpoints.config.appConfig),

  // Get lightweight configuration summary for frontend bootstrap
  getSummary: async () => {
    console.warn('/config/summary endpoint not available. Using fallback to load networks and tokens separately.');
    // Throw error to trigger fallback logic in ConfigContext
    throw new Error('Summary endpoint not available - fallback to individual endpoints');
  },

  // Validate network support
  validateNetwork: (chainId: number) =>
    apiRequest.get(apiEndpoints.config.validateNetwork(chainId)),

  // Get configuration health status
  getHealth: () =>
    apiRequest.get(apiEndpoints.config.health),
    
  // Clear all cached configuration data
  clearCache: () => {
    if (typeof window !== 'undefined') {
      sessionCache.clear();
      console.log('All configuration cache cleared');
    }
  }
};

// Utility functions for handling API responses
export const handleApiResponse = <T>(
  response: ApiResponse<T> | any // Accept both old and new API response formats
): T => {
  // Handle new unified API client format
  if (response && typeof response === 'object' && 'success' in response) {
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

  // If it's not in the expected format, assume it's already the data
  return response;
};

// Enhanced error handler with validation error support
export const handleApiError = (error: any): never => {
  // If it's already a structured error from our interceptor
  if (error.code && error.message) {
    const enhancedError = new Error(error.message);
    (enhancedError as any).code = error.code;
    (enhancedError as any).details = error.details;
    (enhancedError as any).validation_errors = error.validation_errors;
    (enhancedError as any).status = error.status;
    throw enhancedError;
  }

  // Fallback for other errors
  throw new Error(error.message || 'An unexpected error occurred');
};

export const handlePaginatedResponse = <T>(
  response: PaginatedResponse<T>
): {
  data: T[];
  hasMore: boolean;
  nextToken?: string;
} => {
  const data = handleApiResponse(response);
  return {
    data: data as T[],
    hasMore: response.pagination.hasMore,
    nextToken: response.pagination.nextToken,
  };
};

// Retry logic for failed requests
export const retryApiRequest = async <T>(
  requestFn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on authentication or validation errors
      if (error.status === 401 || error.status === 400) {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }

  throw lastError;
};

// Upload file helper
export const uploadFile = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ url: string; filename: string }> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await legacyApiClient.post(`${config.api.basePath}/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent: any) => {
      if (progressEvent.total && onProgress) {
        const progress = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress(progress);
      }
    },
  });

  return handleApiResponse(response.data);
};

// WebSocket connection for real-time updates
export const createWebSocketConnection = (
  endpoint: string,
  onMessage: (data: any) => void,
  onError?: (error: Event) => void
): WebSocket | null => {
  if (typeof window === 'undefined') return null;

  const wsUrl = config.api.baseUrl.replace('http', 'ws') + endpoint;
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connected');
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    if (onError) {
      onError(error);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
  };

  return ws;
};

// Export session cache utilities for external use
export { sessionCache, SESSION_STORAGE_KEYS };