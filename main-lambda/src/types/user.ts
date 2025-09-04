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
export type GetUserStatsQuery = z.infer<typeof GetUserStatsQuerySchema>;

export interface User {
  wallet_address: string;
  email?: string;
  display_name?: string;
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
}

export interface AuthResponse {
  token: string;
  user: User;
  expires_at: string;
}

export interface JWTPayload {
  wallet_address: string;
  iat: number;
  exp: number;
}

export interface AuthMessage {
  message: string;
  nonce: string;
  timestamp: number;
}