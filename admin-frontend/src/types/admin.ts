// Admin-specific types for Fluxion Admin Frontend

export interface AdminUser {
  id: string
  wallet_address: string
  email?: string
  first_name?: string
  last_name?: string
  display_name?: string
  created_at: string
  updated_at: string
  last_login_at?: string
  organization?: Organization
  // RBAC roles from backend
  system_roles: string[]
  organization_roles: string[]
  // RBAC permissions (populated from backend)
  permissions?: string[]
  // System access flag
  has_system_access: boolean
}

export type SystemRole = 
  | 'system_super_admin'
  | 'system_admin' 
  | 'system_support'
  | 'system_moderator'

export interface SystemRolePermissions {
  system_super_admin: SystemPermission[]
  system_admin: SystemPermission[]
  system_support: SystemPermission[]
  system_moderator: SystemPermission[]
}

export interface Organization {
  id: string
  name: string
  created_at: string
  updated_at: string
  user_count: number
  invoice_count: number
  total_revenue: string
  status: 'active' | 'suspended' | 'inactive'
}

export interface SystemStats {
  users: {
    total: number
    active: number
    adminUsers: number
    superAdminUsers: number
    thisMonth: number
  }
  organizations: {
    total: number
    active: number
    thisMonth: number
  }
  invoices: {
    total: number
    thisMonth: number
    totalValue: string
    thisMonthValue: string
    averageValue: string
  }
  payments: {
    total: number
    thisMonth: number
    totalValue: string
    thisMonthValue: string
    successRate: number
  }
  templates: {
    system: number
    organizational: number
    active: number
    totalUsage: number
  }
  systemHealth: {
    status: 'healthy' | 'degraded' | 'critical'
    uptime: number
    lastUpdated: string
    issues: string[]
  }
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down'
  services: {
    database: {
      status: 'up' | 'down'
      response_time: number
    }
    redis: {
      status: 'up' | 'down'
      response_time: number
    }
    blockchain: {
      status: 'up' | 'down'
      response_time: number
      networks_connected: number
    }
  }
  last_checked: string
}

export interface ActivityLog {
  id: string
  user_id?: string
  organization_id?: string
  action: string
  resource_type: string
  resource_id?: string
  details: Record<string, any>
  ip_address?: string
  user_agent?: string
  created_at: string
  user?: {
    id: string
    wallet_address: string
    email?: string
  }
}

export interface Template {
  id: string
  name: string
  description?: string
  category: string
  is_system: boolean
  is_active: boolean
  content: Record<string, any>
  preview_url?: string
  usage_count: number
  created_at: string
  updated_at: string
}

export interface SystemSetting {
  id: string
  key: string
  value: any
  description?: string
  category: string
  is_public: boolean
  created_at: string
  updated_at: string
}

export interface PaginationParams {
  page?: number
  limit?: number
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export interface FilterParams {
  search?: string
  status?: string
  date_from?: string
  date_to?: string
  [key: string]: any
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
    has_next: boolean
    has_prev: boolean
  }
}

export type AdminPermission = 
  | 'system:read'
  | 'system:write' 
  | 'organizations:read'
  | 'organizations:write'
  | 'users:read'
  | 'users:write'
  | 'templates:read'
  | 'templates:write'
  | 'settings:read'
  | 'settings:write'
  | 'activity:read'
  | 'maintenance:toggle'

export type SystemPermission = 
  | 'system:stats:read'
  | 'system:health:read'
  | 'system:maintenance:toggle'
  | 'system:settings:read'
  | 'system:settings:write'
  | 'organizations:list'
  | 'organizations:read'
  | 'organizations:suspend'
  | 'users:list'
  | 'users:read' 
  | 'users:admin_status:update'
  | 'users:activity:read'
  | 'templates:list'
  | 'templates:update'
  | 'templates:activate'
  | 'activity_logs:read'
  | 'audit:read'
  | 'content:moderate'
  | 'support:tickets:read'
  | 'support:tickets:respond'

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  metadata?: {
    pagination?: {
      page: number
      limit: number
      total: number
      pages: number
      has_next: boolean
      has_prev: boolean
    }
    timestamp: string
  }
}