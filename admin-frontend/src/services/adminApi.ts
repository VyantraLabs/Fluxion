// Simplified Admin API Client for Fluxion Admin Frontend
// Direct admin endpoint usage only - no complex fallbacks

import { adminAuthStorage } from '@/utils/storage'
import { adminTokenManager } from '@/utils/token-manager'

// Simple response interface
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  meta?: {
    requestId: string
    timestamp: string
  }
}

// Simple user interface
interface SimpleUser {
  id: string
  wallet_address: string
  name?: string
  email?: string
  created_at: string
  updated_at: string
}

class SimplifiedAdminApi {
  private baseUrl: string
  private basePath: string

  constructor() {
    // Use admin service URL (port 3001) instead of main service
    this.baseUrl = process.env.NEXT_PUBLIC_ADMIN_SERVICE_URL || 'http://localhost:3001'
    this.basePath = process.env.NEXT_PUBLIC_ADMIN_BASE_PATH || '/admin'
  }

  private getAuthHeaders(): HeadersInit {
    // Use the unified admin token manager for consistent token retrieval
    const token = typeof window !== 'undefined' ? adminTokenManager.getToken() : null
    
    console.debug('🔐 AdminAPI - Getting auth headers:', {
      hasToken: !!token,
      tokenLength: token?.length || 0,
      tokenPreview: token ? token.substring(0, 25) + '...' : 'null'
    });
    
    return {
      'Content-Type': 'application/json',
      'X-Client-Type': 'admin-frontend',
      'X-Client-Version': '1.0.0',
      'X-Request-Timestamp': new Date().toISOString(),
      ...(token && { 'Authorization': `Bearer ${token}` }),
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    // Use configurable base path instead of hardcoded /api
    const url = `${this.baseUrl}${endpoint.startsWith('/admin') ? endpoint : `${this.basePath}${endpoint}`}`
    const headers = {
      ...this.getAuthHeaders(),
      ...options.headers,
    }
    
    console.log('🌐 Admin API Request:', {
      url,
      method: options.method || 'GET',
      hasAuth: !!headers.Authorization,
      authHeader: headers.Authorization ? '[PRESENT]' : '[MISSING]',
      timestamp: new Date().toISOString()
    })
    
    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('❌ Admin API Error:', {
        status: response.status,
        statusText: response.statusText,
        url,
        error: errorData,
        hasAuth: !!headers.Authorization
      })
      
      // Handle authentication errors
      if (response.status === 401) {
        console.error('🚫 Admin authentication error - clearing tokens');
        adminTokenManager.removeToken();
        adminAuthStorage.removeToken();
        // Redirect to admin login if not already there
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
      
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  // === AUTHENTICATION METHODS ===
  
  async getAuthMessage(walletAddress: string): Promise<ApiResponse<{ message: string }>> {
    console.log('🔄 Admin API: Getting auth message for wallet:', walletAddress)
    
    // Use the actual admin service auth/message endpoint
    return this.request('/admin/auth/message', {
      method: 'POST',
      body: JSON.stringify({ wallet_address: walletAddress })
    })
  }

  async verifySignature(
    walletAddress: string, 
    signature: string, 
    message: string
  ): Promise<ApiResponse<{ token: string; user: SimpleUser }>> {
    console.log('🔄 Admin API: Verifying signature for wallet:', walletAddress)
    
    return this.request('/admin/auth/verify', {
      method: 'POST',
      body: JSON.stringify({
        wallet_address: walletAddress,
        signature,
        message
      })
    })
  }

  // === SYSTEM MANAGEMENT METHODS ===
  
  async getSystemStats(): Promise<ApiResponse<any>> {
    return this.request('/admin/system/stats')
  }

  async getSystemHealth(): Promise<ApiResponse<any>> {
    return this.request('/admin/system/health')
  }

  // === USER MANAGEMENT METHODS ===
  
  async getUsers(params?: any): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams()
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          searchParams.append(key, String(value))
        }
      })
    }

    const query = searchParams.toString()
    const endpoint = `/admin/users${query ? `?${query}` : ''}`
    
    return this.request(endpoint)
  }

  // === ORGANIZATION MANAGEMENT METHODS ===
  
  async getOrganizations(params?: any): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams()
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          searchParams.append(key, String(value))
        }
      })
    }

    const query = searchParams.toString()
    const endpoint = `/admin/organizations${query ? `?${query}` : ''}`
    
    return this.request(endpoint)
  }

  async getOrganization(id: string): Promise<ApiResponse<any>> {
    return this.request(`/admin/organizations/${id}`)
  }

  async getOrganizationUsers(id: string, params?: any): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams()
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          searchParams.append(key, String(value))
        }
      })
    }

    const query = searchParams.toString()
    const endpoint = `/admin/organizations/${id}/users${query ? `?${query}` : ''}`
    
    return this.request(endpoint)
  }

  async getOrganizationActivity(id: string, params?: any): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams()
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          searchParams.append(key, String(value))
        }
      })
    }

    const query = searchParams.toString()
    const endpoint = `/admin/organizations/${id}/activity${query ? `?${query}` : ''}`
    
    return this.request(endpoint)
  }

  // === USER MANAGEMENT ENHANCED METHODS ===
  
  async getUser(id: string): Promise<ApiResponse<any>> {
    return this.request(`/admin/users/${id}`)
  }

  async getUserActivity(id: string, params?: any): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams()
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          searchParams.append(key, String(value))
        }
      })
    }

    const query = searchParams.toString()
    const endpoint = `/admin/users/${id}/activity${query ? `?${query}` : ''}`
    
    return this.request(endpoint)
  }

  async updateUserAdminStatus(id: string, data: {
    isAdmin: boolean
    isSuperAdmin?: boolean
    reason?: string
  }): Promise<ApiResponse<any>> {
    return this.request(`/admin/users/${id}/admin-status`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  async updateUserRoles(userId: string, organizationId: string, roles: string[]): Promise<ApiResponse<any>> {
    return this.request(`/admin/users/${userId}/roles`, {
      method: 'PUT',
      body: JSON.stringify({
        organizationId,
        roles
      })
    })
  }

  async removeUserFromOrganization(userId: string, organizationId: string, reason?: string): Promise<ApiResponse<any>> {
    return this.request(`/admin/organizations/${organizationId}/users/${userId}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason })
    })
  }

  // === AUDIT LOG METHODS ===
  
  async getActivityLogs(params?: any): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams()
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          searchParams.append(key, String(value))
        }
      })
    }

    const query = searchParams.toString()
    const endpoint = `/admin/activity-logs${query ? `?${query}` : ''}`
    
    return this.request(endpoint)
  }

  // === ROLE MANAGEMENT METHODS ===
  
  async getAvailableRoles(): Promise<ApiResponse<any>> {
    return this.request('/admin/roles')
  }

  async getUserRoles(userId: string, organizationId?: string): Promise<ApiResponse<any>> {
    const params = organizationId ? `?organizationId=${organizationId}` : ''
    return this.request(`/admin/users/${userId}/roles${params}`)
  }

  // === SYSTEM SETTINGS METHODS ===
  
  async getSystemSettings(params?: any): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams()
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          searchParams.append(key, String(value))
        }
      })
    }

    const query = searchParams.toString()
    const endpoint = `/admin/settings${query ? `?${query}` : ''}`
    
    return this.request(endpoint)
  }

  async updateSystemSetting(key: string, data: {
    value: any
    description?: string
  }): Promise<ApiResponse<any>> {
    return this.request(`/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  }

  // === MAINTENANCE METHODS ===
  
  async toggleMaintenanceMode(enabled: boolean, message?: string, estimatedDuration?: number): Promise<ApiResponse<any>> {
    return this.request('/system/maintenance', {
      method: 'POST',
      body: JSON.stringify({
        enabled,
        message,
        estimatedDuration
      })
    })
  }

  // === DEBUG METHOD ===
  
  async debugCurrentUser(): Promise<ApiResponse<any>> {
    console.log('🔍 Admin API: Debug - getting current user info')
    const token = adminTokenManager.getToken()
    const legacyToken = adminAuthStorage.getToken()
    
    if (!token) {
      console.log('❌ Admin API: No token found via TokenManager')
      return { 
        success: false, 
        error: { 
          code: 'NO_TOKEN', 
          message: 'No authentication token found',
          details: {
            tokenManagerResult: null,
            legacyStorageResult: legacyToken ? 'exists' : 'null',
            allKeys: typeof window !== 'undefined' ? Object.keys(localStorage).filter(k => k.includes('admin')) : []
          }
        } 
      }
    }
    
    try {
      const payload = adminTokenManager.decodeTokenPayload()
      console.log('🔍 Admin API: JWT Payload via TokenManager:', payload)
      return { 
        success: true, 
        data: { 
          jwtPayload: payload,
          tokenExists: true,
          tokenLength: token.length,
          source: 'TokenManager'
        } 
      }
    } catch (error) {
      console.error('❌ Admin API: Error decoding token:', error)
      return { 
        success: false, 
        error: { 
          code: 'INVALID_TOKEN', 
          message: 'Invalid authentication token',
          details: error 
        } 
      }
    }
  }
}

// Create and export singleton instance
export const adminApi = new SimplifiedAdminApi()
export default adminApi