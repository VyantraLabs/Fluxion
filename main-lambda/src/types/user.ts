import { z } from 'zod';
import { FluxionRecord, UserData } from './common';

export const AuthenticateWalletSchema = z.object({
  wallet_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
  signature: z.string().min(1, 'Signature is required'),
  message: z.string().min(1, 'Message is required')
});

export const UpdateUserProfileSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  display_name: z.string().min(1, 'Display name is required').max(50).optional(),
  notification_preferences: z.object({
    email_on_payment: z.boolean(),
    email_on_invoice_viewed: z.boolean(),
    email_on_reminders: z.boolean()
  }).optional()
});

export const CompleteOnboardingSchema = z.object({
  organizationName: z.string().min(2, 'Organization name must be at least 2 characters').max(100, 'Organization name too long'),
  displayName: z.string().min(1, 'Display name is required').max(50).optional(),
  email: z.string().email('Invalid email address').optional()
});

export const GetUserStatsQuerySchema = z.object({
  wallet_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address')
});

export interface UserEntity extends FluxionRecord {
  PK: `USER#${string}`;          
  SK: 'PROFILE';
  GSI1PK: `ACTIVE#${string}`;    
  GSI1SK: string;                
  entityType: 'USER';
  data: UserData;
}

export type AuthenticateWalletDTO = z.infer<typeof AuthenticateWalletSchema>;
export type UpdateUserProfileDTO = z.infer<typeof UpdateUserProfileSchema>;
export type CompleteOnboardingDTO = z.infer<typeof CompleteOnboardingSchema>;
export type GetUserStatsQuery = z.infer<typeof GetUserStatsQuerySchema>;

export interface User {
  id?: string; // Database user ID
  wallet_address: string;
  email?: string;
  display_name?: string;
  role?: string; // RBAC role (owner, admin, member, viewer)
  notification_preferences: {
    email_on_payment: boolean;
    email_on_invoice_viewed: boolean;
    email_on_reminders: boolean;
  };
  stats: {
    invoice_count: number;
    total_received: number;
    last_active_at: string;
  };
  created_at: string;
  updated_at: string;
  // SECURITY: Admin fields are NOT included in API responses - they're in JWT tokens only
}

export interface AuthResponse {
  token: string;
  user: User;
  expires_at: string;
  needsOnboarding: boolean;
  isNewUser?: boolean; // Flag to indicate if this is a first-time user
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface JWTPayload {
  wallet_address: string;
  user_id?: string;
  tenant_id?: string;
  role?: string; // RBAC role (owner, admin, member, viewer)
  is_admin?: boolean;
  is_super_admin?: boolean;
  // System-level roles for admin access
  system_roles?: string[]; // Array of system roles (super_admin, admin, support)
  is_system_user?: boolean; // Flag indicating if user has any system roles
  iat: number;
  exp: number;
}

export interface AuthMessage {
  message: string;
  nonce: string;
  timestamp: number;
}