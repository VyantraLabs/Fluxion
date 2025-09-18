// Application constants

// Network constants
export const SUPPORTED_CHAINS = [137, 80001] as const;
export const DEFAULT_CHAIN_ID = 137; // Polygon mainnet

// Token constants
export const USDC_DECIMALS = 6;
export const DEFAULT_TOKEN_DECIMALS = 18;

// Invoice constants
export const INVOICE_STATUS = {
  DRAFT: 'draft',
  PENDING: 'pending', 
  PAID: 'paid',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
} as const;

// UI constants
export const TOAST_DURATION = {
  SHORT: 2000,
  MEDIUM: 4000,
  LONG: 6000,
} as const;

export const DEBOUNCE_DELAY = {
  SEARCH: 300,
  INPUT: 500,
  RESIZE: 150,
} as const;

// Validation constants
export const VALIDATION_RULES = {
  EMAIL: {
    MIN_LENGTH: 5,
    MAX_LENGTH: 100,
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  WALLET_ADDRESS: {
    LENGTH: 42,
    PATTERN: /^0x[a-fA-F0-9]{40}$/,
  },
  TRANSACTION_HASH: {
    LENGTH: 66,
    PATTERN: /^0x[a-fA-F0-9]{64}$/,
  },
  INVOICE: {
    DESCRIPTION_MAX_LENGTH: 500,
    CLIENT_NAME_MAX_LENGTH: 100,
    LINE_ITEMS_MAX: 20,
    AMOUNT_MIN: 0.01,
    AMOUNT_MAX: 1000000,
  },
} as const;

// Date constants
export const DATE_FORMATS = {
  DISPLAY: 'MMM dd, yyyy',
  ISO: 'yyyy-MM-dd',
  DATETIME: 'MMM dd, yyyy HH:mm',
  TIME: 'HH:mm',
} as const;

// Error messages
export const ERROR_MESSAGES = {
  WALLET_NOT_CONNECTED: 'Please connect your wallet first',
  NETWORK_NOT_SUPPORTED: 'Please switch to a supported network',
  INSUFFICIENT_BALANCE: 'Insufficient balance for this transaction',
  TRANSACTION_FAILED: 'Transaction failed. Please try again',
  USER_REJECTED: 'Transaction was rejected by user',
  INVALID_ADDRESS: 'Invalid wallet address format',
  INVALID_EMAIL: 'Please enter a valid email address',
  REQUIRED_FIELD: 'This field is required',
  AMOUNT_TOO_SMALL: 'Amount must be at least $0.01',
  AMOUNT_TOO_LARGE: 'Amount cannot exceed $1,000,000',
  GENERIC_ERROR: 'Something went wrong. Please try again',
} as const;

// Success messages
export const SUCCESS_MESSAGES = {
  WALLET_CONNECTED: 'Wallet connected successfully',
  INVOICE_CREATED: 'Invoice created successfully',
  INVOICE_UPDATED: 'Invoice updated successfully',
  INVOICE_SENT: 'Invoice sent successfully',
  PAYMENT_SENT: 'Payment sent successfully',
  PAYMENT_CONFIRMED: 'Payment confirmed',
  PROFILE_UPDATED: 'Profile updated successfully',
} as const;

// Local storage keys (should match STORAGE_KEYS in storage.ts)
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'fluxion_auth_token',
  USER_PROFILE: 'fluxion_user_profile',
  WALLET_ADDRESS: 'fluxion_wallet_address',
  PREFERRED_NETWORK: 'fluxion_preferred_network',
  DRAFT_INVOICES: 'fluxion_draft_invoices',
  UI_PREFERENCES: 'fluxion_ui_preferences',
  ONBOARDING_COMPLETED: 'fluxion_onboarding_completed',
} as const;

// API constants (DEPRECATED - Use apiEndpoints from config.ts instead)
// These are kept for backward compatibility but should not be used in new code
export const API_ENDPOINTS = {
  HEALTH: '/health', // This is root-level, doesn't use base path
  AUTH_MESSAGE: '/users/auth/message', // Deprecated: Use apiEndpoints.auth.message
  AUTH_VERIFY: '/users/auth/verify', // Deprecated: Use apiEndpoints.auth.verify
  INVOICES: '/invoices', // Deprecated: Use apiEndpoints.invoices.base
  PAYMENTS_VERIFY: '/payments/verify', // Deprecated: Use apiEndpoints.payments.verify
} as const;

// Note: For new code, import and use apiEndpoints from '@/utils/config' instead:
// import { apiEndpoints } from '@/utils/config';
// Use: apiEndpoints.auth.message instead of API_ENDPOINTS.AUTH_MESSAGE

// Pagination constants
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  PAGE_SIZES: [10, 20, 50, 100],
  MAX_PAGE_SIZE: 100,
} as const;

// File upload constants
export const UPLOAD_LIMITS = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  MAX_FILES: 5,
} as const;

// Animation constants
export const ANIMATION_DURATION = {
  FAST: 150,
  NORMAL: 200,
  SLOW: 300,
} as const;

// Z-index constants
export const Z_INDEX = {
  DROPDOWN: 50,
  MODAL: 100,
  OVERLAY: 90,
  TOAST: 200,
  TOOLTIP: 60,
} as const;

// Media query breakpoints (should match Tailwind config)
export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  '2XL': 1536,
} as const;

// Color constants
export const COLORS = {
  PRIMARY: '#3b82f6',
  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',
  SECONDARY: '#6b7280',
} as const;

// Feature flags
export const FEATURES = {
  ANALYTICS: true,
  NOTIFICATIONS: true,
  DARK_MODE: false,
  MULTI_CHAIN: false,
  BATCH_PAYMENTS: false,
  RECURRING_INVOICES: false,
} as const;

// Social links
export const SOCIAL_LINKS = {
  TWITTER: 'https://twitter.com/fluxionpay',
  DISCORD: 'https://discord.gg/fluxion',
  GITHUB: 'https://github.com/fluxion-pay',
  DOCS: 'https://docs.fluxion.pay',
  SUPPORT: 'mailto:support@fluxion.pay',
} as const;

// External links
export const EXTERNAL_LINKS = {
  METAMASK_DOWNLOAD: 'https://metamask.io',
  POLYGON_BRIDGE: 'https://wallet.polygon.technology/bridge',
  USDC_INFO: 'https://www.centre.io/usdc',
  POLYGONSCAN: 'https://polygonscan.com',
  MUMBAI_POLYGONSCAN: 'https://mumbai.polygonscan.com',
} as const;

// Regular expressions
export const REGEX = {
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  WALLET_ADDRESS: /^0x[a-fA-F0-9]{40}$/,
  TRANSACTION_HASH: /^0x[a-fA-F0-9]{64}$/,
  AMOUNT: /^\d+\.?\d{0,2}$/,
  PHONE: /^\+?[\d\s\-\(\)]+$/,
  URL: /^https?:\/\/.+/,
} as const;

// Time constants
export const TIME = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
} as const;

// Type exports for better TypeScript support
export type InvoiceStatus = typeof INVOICE_STATUS[keyof typeof INVOICE_STATUS];
export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS];
export type SupportedChain = typeof SUPPORTED_CHAINS[number];