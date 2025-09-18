import { WalletAddress, DateString } from './common';

// User profile types (enhanced to match backend schema)
export interface User {
  id?: string;
  wallet_address: WalletAddress;
  email?: string;
  display_name?: string;
  profile?: {
    display_name?: string;
    avatar_url?: string;
    bio?: string;
  };
  notification_preferences: NotificationPreferences;
  stats: UserStats;
  tenant_id?: string;
  // Single role system (simplified from RBAC arrays)
  role?: string; // New single role field
  // Legacy role arrays for backwards compatibility during transition
  system_roles?: string[];
  organization_roles?: string[];
  created_at: DateString;
  updated_at: DateString;
}

export interface NotificationPreferences {
  email_on_payment: boolean;
  email_on_invoice_viewed: boolean;
  email_on_reminders?: boolean;
}

export interface UserStats {
  invoice_count: number;
  total_received: number;
  last_active_at: DateString;
}

// Authentication types
export interface AuthMessage {
  message: string;
  nonce: string;
  timestamp: number;
}

export interface AuthRequest {
  wallet_address: WalletAddress;
  signature: string;
  message: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  expires_at: DateString;
  needsOnboarding: boolean;
  isNewUser?: boolean; // Flag to indicate if this is a first-time user
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
}

// Profile update types (enhanced for new schema)
export interface UpdateUserProfileRequest {
  email?: string;
  display_name?: string;
  profile?: {
    display_name?: string;
    avatar_url?: string;
    bio?: string;
  };
  notification_preferences?: Partial<NotificationPreferences>;
}

// User existence check
export interface UserExistsResponse {
  wallet_address: WalletAddress;
  exists: boolean;
  profile_complete: boolean;
}

// Address validation
export interface AddressValidationResponse {
  wallet_address: string;
  is_valid: boolean;
}

// User analytics
export interface UserAnalytics {
  invoice_summary: {
    total_invoices: number;
    paid_invoices: number;
    pending_invoices: number;
    total_amount_received: number;
  };
  payment_trends: {
    period: string;
    amount: number;
    count: number;
  }[];
  top_clients: {
    client_name: string;
    total_amount: number;
    invoice_count: number;
  }[];
  monthly_revenue: {
    month: string;
    amount: number;
  }[];
}

// User context types
export interface UserContextState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isOnboarding: boolean;
  needsOnboarding: boolean;
}

// Global statistics types
export interface GlobalStats {
  totalUsers: number;
  totalOrganizations: number;
  totalInvoices: number;
  totalRevenue: number;
  recentActivity: ActivityLog[];
  organizationBreakdown: {
    id: string;
    name: string;
    userCount: number;
    invoiceCount: number;
    revenue: number;
  }[];
}

// Organization context types
export interface OrganizationContextState {
  organizations: Organization[];
  activeOrganization: Organization | null;
  isLoading: boolean;
  error: string | null;
  isGlobalView: boolean;
  globalStats: GlobalStats | null;
  globalStatsLoading: boolean;
}

export interface OrganizationContextActions {
  setActiveOrganization: (org: Organization | null) => void;
  enterOrganization: (org: Organization) => void;
  exitOrganization: () => void;
  refreshOrganizations: () => Promise<void>;
  getOrganizationUsers: (orgId?: string) => Promise<OrganizationUser[]>;
  inviteUser: (data: InviteUserRequest) => Promise<void>;
  updateUserRoles: (data: UpdateUserRolesRequest) => Promise<void>;
  removeUser: (data: RemoveUserRequest) => Promise<void>;
  getActivityLogs: (orgId?: string, filters?: any) => Promise<ActivityLog[]>;
  getGlobalStatistics: () => Promise<GlobalStats>;
  setGlobalView: (isGlobal: boolean) => void;
}

export interface UserContextActions {
  login: (walletAddress: string, signature: string, message: string) => Promise<void>;
  logout: () => void;
  updateProfile: (updates: UpdateUserProfileRequest) => Promise<void>;
  refreshUser: () => Promise<void>;
  checkUserExists: (walletAddress: string) => Promise<UserExistsResponse>;
  completeOnboarding: (data: CompleteOnboardingRequest) => Promise<void>;
}

// Profile form types
export interface ProfileFormData {
  display_name: string;
  email: string;
  notification_preferences: NotificationPreferences;
}

// Account settings
export interface AccountSettings extends UpdateUserProfileRequest {
  timezone?: string;
  language?: string;
  currency_preference?: string;
}

// User onboarding
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  required: boolean;
}

export interface OnboardingState {
  current_step: number;
  completed_steps: string[];
  total_steps: number;
  is_complete: boolean;
}

export interface CompleteOnboardingRequest {
  organizationName: string;
  displayName?: string;
  email?: string;
}

// Organization types
export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  settings: {
    timezone?: string;
    currency?: string;
    language?: string;
    invoice_prefix?: string;
    auto_reminder_enabled?: boolean;
  };
  stats: {
    user_count: number;
    invoice_count: number;
    total_revenue: number;
    active_invoices: number;
  };
  created_at: DateString;
  updated_at: DateString;
}

// Multi-organization user data
export interface UserWithOrganizations extends User {
  organizations: {
    organization: Organization;
    // Single role per organization (simplified from array)
    role?: string;
    // Legacy roles array for backwards compatibility
    roles?: string[];
    is_active: boolean;
    joined_at: DateString;
  }[];
}

// Organization user (for user management)
export interface OrganizationUser {
  id: string;
  wallet_address?: string;
  email?: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  profile?: {
    display_name?: string;
    avatar_url?: string;
    bio?: string;
  };
  // Single role system (simplified from RBAC arrays)
  role?: string; // New single role field
  // Legacy role arrays for backwards compatibility during transition
  system_roles?: string[];
  organization_roles?: string[];
  organization_id: string;
  organization_name: string;
  is_active: boolean;
  email_verified?: boolean;
  last_login_at?: DateString;
  created_at: DateString;
  updated_at: DateString;
}

// User invitation types
export interface UserInvitation {
  id: string;
  email: string;
  wallet_address?: string;
  organization_id: string;
  organization_name: string;
  invited_by: {
    id: string;
    display_name?: string;
    email?: string;
  };
  // Single role system (simplified from array)
  role?: string;
  // Legacy roles array for backwards compatibility
  roles?: string[];
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expires_at: DateString;
  created_at: DateString;
  updated_at: DateString;
}

// User management API types
export interface InviteUserRequest {
  email?: string;
  wallet_address?: string;
  organization_id: string;
  // Single role system (simplified from array)
  role?: string;
  // Legacy roles array for backwards compatibility
  roles?: string[];
  message?: string;
}

export interface UpdateUserRolesRequest {
  user_id: string;
  organization_id: string;
  // Single role system (simplified from array)
  role?: string;
  // Legacy roles array for backwards compatibility
  roles?: string[];
}

export interface RemoveUserRequest {
  user_id: string;
  organization_id: string;
}

// Activity log types
export interface ActivityLog {
  id: string;
  type: 'user_invited' | 'user_joined' | 'user_removed' | 'role_changed' | 'invoice_created' | 'payment_received' | 'login' | 'profile_updated';
  description: string;
  actor: {
    id: string;
    display_name?: string;
    email?: string;
  };
  target?: {
    id: string;
    type: 'user' | 'invoice' | 'organization';
    name?: string;
  };
  organization_id: string;
  organization_name: string;
  metadata?: Record<string, any>;
  created_at: DateString;
}

// User activity (legacy support)
export interface UserActivity {
  id: string;
  type: 'invoice_created' | 'payment_received' | 'profile_updated' | 'login';
  description: string;
  metadata?: Record<string, any>;
  timestamp: DateString;
}

// Organization statistics
export interface OrganizationStats {
  total_users: number;
  active_users: number;
  pending_invitations: number;
  total_invoices: number;
  paid_invoices: number;
  pending_invoices: number;
  total_revenue: number;
  monthly_revenue: {
    month: string;
    amount: number;
  }[];
}

// User permissions context
export interface UserPermissionContext {
  user: User;
  organization?: Organization;
  isOwner: boolean;
  isSystemAdmin: boolean;
  isOrgAdmin: boolean;
  canManageUsers: boolean;
  canInviteUsers: boolean;
  canRemoveUsers: boolean;
  canChangeRoles: boolean;
  canViewActivity: boolean;
  canManageSettings: boolean;
  canViewAllOrganizations: boolean;
}