import { z } from 'zod';
import { ethers } from 'ethers';

// Common validation patterns
export const validationPatterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  walletAddress: /^0x[a-fA-F0-9]{40}$/,
  transactionHash: /^0x[a-fA-F0-9]{64}$/,
  url: /^https?:\/\/.+/,
  phone: /^\+?[\d\s\-\(\)]+$/,
};

// Custom Zod validators
export const createWalletAddressValidator = () =>
  z.string()
    .min(42, 'Wallet address must be 42 characters')
    .max(42, 'Wallet address must be 42 characters')
    .regex(validationPatterns.walletAddress, 'Invalid wallet address format')
    .refine((address) => {
      try {
        return ethers.isAddress(address);
      } catch {
        return false;
      }
    }, 'Invalid Ethereum address');

export const createTransactionHashValidator = () =>
  z.string()
    .min(66, 'Transaction hash must be 66 characters')
    .max(66, 'Transaction hash must be 66 characters')
    .regex(validationPatterns.transactionHash, 'Invalid transaction hash format');

// Zod schemas for form validation
export const emailSchema = z.string()
  .min(1, 'Email is required')
  .email('Invalid email format')
  .max(100, 'Email too long');

export const walletAddressSchema = createWalletAddressValidator();

export const transactionHashSchema = createTransactionHashValidator();

export const amountSchema = z.number()
  .min(0.01, 'Amount must be at least $0.01')
  .max(1000000, 'Amount cannot exceed $1,000,000');

export const lineItemSchema = z.object({
  id: z.string().optional(),
  description: z.string()
    .min(1, 'Description is required')
    .max(200, 'Description too long'),
  quantity: z.number()
    .min(0.01, 'Quantity must be at least 0.01')
    .max(1000000, 'Quantity too large'),
  rate: z.number()
    .min(0.01, 'Rate must be at least $0.01')
    .max(1000000, 'Rate too large'),
  amount: z.number()
    .min(0.01, 'Amount must be at least $0.01'),
});

export const invoiceFormSchema = z.object({
  client_name: z.string()
    .min(1, 'Client name is required')
    .max(100, 'Client name too long'),
  client_email: emailSchema,
  description: z.string()
    .min(1, 'Description is required')
    .max(500, 'Description too long'),
  line_items: z.array(lineItemSchema)
    .min(1, 'At least one line item is required')
    .max(20, 'Maximum 20 line items allowed'),
  due_date: z.string()
    .min(1, 'Due date is required')
    .refine((date) => {
      const dueDate = new Date(date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return dueDate >= today;
    }, 'Due date must be today or in the future'),
});

export const profileFormSchema = z.object({
  display_name: z.string()
    .max(50, 'Display name too long')
    .optional(),
  email: emailSchema.optional(),
  notification_preferences: z.object({
    email_on_payment: z.boolean(),
    email_on_invoice_viewed: z.boolean(),
  }),
});

export const paymentFormSchema = z.object({
  amount: amountSchema,
  recipient_address: walletAddressSchema,
  invoice_id: z.string().uuid('Invalid invoice ID'),
});

export const verifyPaymentSchema = z.object({
  invoice_id: z.string().uuid('Invalid invoice ID'),
  tx_hash: transactionHashSchema,
  from_address: walletAddressSchema,
});

// Utility validation functions
export const isValidEmail = (email: string): boolean => {
  return validationPatterns.email.test(email);
};

export const isValidWalletAddress = (address: string): boolean => {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
};

export const isValidTransactionHash = (hash: string): boolean => {
  return validationPatterns.transactionHash.test(hash);
};

export const isValidAmount = (amount: number): boolean => {
  return amount >= 0.01 && amount <= 1000000;
};

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return validationPatterns.url.test(url);
  } catch {
    return false;
  }
};

// Date validation helpers
export const isValidDueDate = (date: string | Date): boolean => {
  try {
    const dueDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return dueDate >= today && dueDate <= new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  } catch {
    return false;
  }
};

export const isDateInFuture = (date: string | Date): boolean => {
  try {
    const targetDate = new Date(date);
    return targetDate > new Date();
  } catch {
    return false;
  }
};

export const isDateInPast = (date: string | Date): boolean => {
  try {
    const targetDate = new Date(date);
    return targetDate < new Date();
  } catch {
    return false;
  }
};

// Sanitization helpers
export const sanitizeInput = {
  text: (input: string): string => {
    return input.trim().replace(/[<>]/g, '');
  },

  email: (input: string): string => {
    return input.trim().toLowerCase();
  },

  amount: (input: string): number => {
    const cleaned = input.replace(/[^\d.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  },

  walletAddress: (input: string): string => {
    return input.trim().toLowerCase();
  },

  description: (input: string): string => {
    return input.trim().replace(/[<>]/g, '').substring(0, 500);
  },
};

// Validation error formatters
export const formatValidationError = (error: z.ZodError): Record<string, string> => {
  const formatted: Record<string, string> = {};
  
  error.errors.forEach((err) => {
    const field = err.path.join('.');
    formatted[field] = err.message;
  });
  
  return formatted;
};

export const getFirstValidationError = (error: z.ZodError): string => {
  return error.errors[0]?.message || 'Validation error';
};

// Invoice-specific validation
export const validateInvoiceAmount = (lineItems: Array<{ quantity: number; rate: number }>): number => {
  return lineItems.reduce((total, item) => {
    const itemTotal = item.quantity * item.rate;
    return total + (isNaN(itemTotal) ? 0 : itemTotal);
  }, 0);
};

export const validateInvoiceDuplication = async (
  clientEmail: string,
  amount: number,
  description: string
): Promise<boolean> => {
  // This would typically check against existing invoices
  // For now, return true (no duplication)
  return true;
};

// Password strength validation (for future use)
export const validatePasswordStrength = (password: string): {
  score: number;
  feedback: string[];
  isStrong: boolean;
} => {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score += 1;
  else feedback.push('Password must be at least 8 characters');

  if (/[a-z]/.test(password)) score += 1;
  else feedback.push('Password must contain lowercase letters');

  if (/[A-Z]/.test(password)) score += 1;
  else feedback.push('Password must contain uppercase letters');

  if (/\d/.test(password)) score += 1;
  else feedback.push('Password must contain numbers');

  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
  else feedback.push('Password must contain special characters');

  return {
    score,
    feedback,
    isStrong: score >= 4,
  };
};

// File validation
export const validateFile = (
  file: File,
  options: {
    maxSize?: number; // in bytes
    allowedTypes?: string[];
    maxFiles?: number;
  } = {}
): { isValid: boolean; error?: string } => {
  const { maxSize = 5 * 1024 * 1024, allowedTypes = ['image/*', 'application/pdf'] } = options;

  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`,
    };
  }

  const isTypeAllowed = allowedTypes.some((type) => {
    if (type.endsWith('/*')) {
      return file.type.startsWith(type.slice(0, -1));
    }
    return file.type === type;
  });

  if (!isTypeAllowed) {
    return {
      isValid: false,
      error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`,
    };
  }

  return { isValid: true };
};