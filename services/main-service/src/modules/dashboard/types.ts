export interface UserInfo {
  id: string;
  email: string;
  role: string;
  permissions: string[];
  organizationId?: string;
  organizationName?: string;
}

export interface SystemStats {
  users: {
    total: number;
    active: number;
    admin_users: number;
    new_this_month: number;
  };
  organizations: {
    total: number;
    active: number;
    new_this_month: number;
  };
  invoices: {
    total: number;
    total_value: number;
    this_month: number;
    success_rate: number;
  };
  payments: {
    total: number;
    total_value: number;
    success_rate: number;
    this_month: number;
  };
  platform_health: {
    uptime: number;
    response_time: number;
    error_rate: number;
  };
}

export interface OrganizationStats {
  invoices: {
    total: number;
    pending: number;
    paid: number;
    total_value: number;
  };
  payments: {
    total_received: number;
    pending_amount: number;
    this_month: number;
  };
  team: {
    members: number;
    active_users: number;
  };
}

export interface PersonalStats {
  my_invoices: {
    total: number;
    paid: number;
    pending: number;
    total_value: number;
  };
  recent_activity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  type: 'invoice_created' | 'payment_received' | 'user_joined' | 'system_alert' | 'role_changed';
  title: string;
  description: string;
  timestamp: Date;
  metadata?: Record<string, any>;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  services: {
    database: { status: 'ok' | 'error'; response_time?: number };
    blockchain: { status: 'ok' | 'error'; response_time?: number };
    notifications: { status: 'ok' | 'error'; response_time?: number };
    cache: { status: 'ok' | 'error'; response_time?: number };
  };
}

export interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: string;
  permissions?: string[];
}

export interface AdminDashboardResponse {
  user_info: UserInfo;
  system_stats: SystemStats;
  recent_activity: ActivityItem[];
  system_health: SystemHealth;
}

export interface FrontendDashboardResponse {
  user_info: UserInfo;
  organization_stats: OrganizationStats;
  personal_stats: PersonalStats;
  quick_actions: QuickAction[];
}

export type DashboardResponse = AdminDashboardResponse | FrontendDashboardResponse;

export enum ClientType {
  ADMIN_FRONTEND = 'admin-frontend',
  FRONTEND = 'frontend'
}

export interface DashboardFilters {
  dateRange?: {
    start: Date;
    end: Date;
  };
  organizationId?: string;
  userId?: string;
}