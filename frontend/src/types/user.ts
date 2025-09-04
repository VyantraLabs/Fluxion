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
}

export interface UserContextActions {
  login: (walletAddress: WalletAddress, signature: string, message: string) => Promise<void>;
  logout: () => void;
  updateProfile: (updates: UpdateUserProfileRequest) => Promise<void>;
  refreshUser: () => Promise<void>;
  checkUserExists: (walletAddress: WalletAddress) => Promise<UserExistsResponse>;
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

// User activity
export interface UserActivity {
  id: string;
  type: 'invoice_created' | 'payment_received' | 'profile_updated' | 'login';
  description: string;
  metadata?: Record<string, any>;
  timestamp: DateString;
}