// Simplified Admin API Client for Fluxion Admin Frontend
// Direct admin endpoint usage only - no complex fallbacks

import { adminAuthStorage } from '@/utils/storage'

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

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'
  }

  private getAuthHeaders(): HeadersInit {
    const token = typeof window !== 'undefined' ? adminAuthStorage.getToken() : null
    
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}/admin${endpoint}`
    const headers = {
      ...this.getAuthHeaders(),
      ...options.headers,
    }
    
    console.log('Admin API Request:', {
      url,
      method: options.method || 'GET',
      hasAuth: !!headers.Authorization
    })
    
    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Admin API Error:', {
        status: response.status,
        statusText: response.statusText,
        url,
        error: errorData
      })
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  // === AUTHENTICATION METHODS ===
  
  async getAuthMessage(walletAddress: string): Promise<ApiResponse<{ message: string }>> {
    console.log('🔄 Admin API: Getting auth message for wallet:', walletAddress)
    
    const response = await fetch(`${this.baseUrl}/admin/auth/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ wallet_address: walletAddress }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`)
    }

    return response.json()
  }

  async verifySignature(
    walletAddress: string, 
    signature: string, 
    message: string
  ): Promise<ApiResponse<{ token: string; user: SimpleUser }>> {
    console.log('🔄 Admin API: Verifying signature for wallet:', walletAddress)
    
    const response = await fetch(`${this.baseUrl}/admin/auth/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        wallet_address: walletAddress,
        signature,
        message
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()
    
    // Validate that the response contains required data
    if (!result.success || !result.data?.user || !result.data?.token) {
      throw new Error('Authentication failed - invalid response format')
    }

    return result
  }

  // === SYSTEM MANAGEMENT METHODS ===
  
  async getSystemStats(): Promise<ApiResponse<any>> {
    return this.request('/system/stats')
  }

  async getSystemHealth(): Promise<ApiResponse<any>> {
    return this.request('/system/health')
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
    const endpoint = `/users${query ? `?${query}` : ''}`
    
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
    const endpoint = `/organizations${query ? `?${query}` : ''}`
    
    return this.request(endpoint)
  }

  async getOrganization(id: string): Promise<ApiResponse<any>> {
    return this.request(`/organizations/${id}`)
  }

  // === DEBUG METHOD ===
  
  async debugCurrentUser(): Promise<ApiResponse<any>> {
    console.log('🔍 Admin API: Debug - getting current user info')
    const token = adminAuthStorage.getToken()
    
    if (!token) {
      console.log('❌ Admin API: No token found')
      return { success: false, error: { code: 'NO_TOKEN', message: 'No authentication token found' } }
    }
    
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      console.log('🔍 Admin API: JWT Payload:', payload)
      return { 
        success: true, 
        data: { 
          jwtPayload: payload,
          tokenExists: true,
          tokenLength: token.length 
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