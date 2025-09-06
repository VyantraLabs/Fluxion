import { ethers } from 'ethers';

// Currency formatting
export const formatCurrency = (
  amount: number | string,
  options: {
    currency?: string;
    decimals?: number;
    showSymbol?: boolean;
  } = {}
): string => {
  const {
    currency = 'USD',
    decimals = 2,
    showSymbol = true,
  } = options;

  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numAmount)) return '0.00';

  const formatter = new Intl.NumberFormat('en-US', {
    style: showSymbol ? 'currency' : 'decimal',
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return formatter.format(numAmount);
};

// Format USDC amounts (6 decimals)
export const formatUSDC = (amount: string | number): string => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  return formatCurrency(numAmount, { currency: 'USD', decimals: 2 });
};

// Format token amounts from wei
export const formatTokenAmount = (
  amountWei: string | bigint,
  decimals: number = 18,
  displayDecimals: number = 4
): string => {
  try {
    const formatted = ethers.formatUnits(amountWei.toString(), decimals);
    const num = parseFloat(formatted);
    return num.toFixed(displayDecimals);
  } catch (error) {
    console.error('Error formatting token amount:', error);
    return '0.0000';
  }
};

// Parse token amounts to wei
export const parseTokenAmount = (
  amount: string | number,
  decimals: number = 18
): bigint => {
  try {
    const amountStr = typeof amount === 'number' ? amount.toString() : amount;
    return ethers.parseUnits(amountStr, decimals);
  } catch (error) {
    console.error('Error parsing token amount:', error);
    return BigInt(0);
  }
};

// Wallet address formatting
export const formatWalletAddress = (
  address: string,
  startChars: number = 6,
  endChars: number = 4
): string => {
  if (!address || address.length < startChars + endChars) {
    return address;
  }

  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};

// Transaction hash formatting
export const formatTxHash = (
  hash: string,
  startChars: number = 8,
  endChars: number = 6
): string => {
  if (!hash || hash.length < startChars + endChars) {
    return hash;
  }

  return `${hash.slice(0, startChars)}...${hash.slice(-endChars)}`;
};

// Date formatting
export const formatDate = (
  date: string | Date,
  options: Intl.DateTimeFormatOptions = {}
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  };

  return new Intl.DateTimeFormat('en-US', { ...defaultOptions, ...options }).format(dateObj);
};

// Relative date formatting (e.g., "2 days ago", "in 3 hours")
export const formatRelativeDate = (date: string | Date): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

  const intervals = [
    { label: 'year', seconds: 31536000 },
    { label: 'month', seconds: 2592000 },
    { label: 'week', seconds: 604800 },
    { label: 'day', seconds: 86400 },
    { label: 'hour', seconds: 3600 },
    { label: 'minute', seconds: 60 },
    { label: 'second', seconds: 1 },
  ];

  for (const interval of intervals) {
    const count = Math.floor(Math.abs(diffInSeconds) / interval.seconds);
    if (count > 0) {
      const suffix = count === 1 ? '' : 's';
      const prefix = diffInSeconds < 0 ? 'in' : '';
      const postfix = diffInSeconds >= 0 ? 'ago' : '';
      return `${prefix} ${count} ${interval.label}${suffix} ${postfix}`.trim();
    }
  }

  return 'just now';
};

// Alias for consistency with component imports
export const formatRelativeTime = formatRelativeDate;

// Due date status formatting
export const formatDueDate = (dueDate: string | Date): {
  formatted: string;
  status: 'upcoming' | 'due_soon' | 'overdue';
  daysRemaining: number;
} => {
  const dueDateObj = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const now = new Date();
  const diffInDays = Math.ceil((dueDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  let status: 'upcoming' | 'due_soon' | 'overdue';
  if (diffInDays < 0) {
    status = 'overdue';
  } else if (diffInDays <= 3) {
    status = 'due_soon';
  } else {
    status = 'upcoming';
  }

  return {
    formatted: formatDate(dueDateObj),
    status,
    daysRemaining: diffInDays,
  };
};

// Percentage formatting
export const formatPercentage = (
  value: number,
  decimals: number = 1
): string => {
  return `${(value * 100).toFixed(decimals)}%`;
};

// File size formatting
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Number formatting with suffixes (1.2K, 1.5M, etc.)
export const formatNumberWithSuffix = (num: number): string => {
  if (num >= 1e9) {
    return (num / 1e9).toFixed(1) + 'B';
  }
  if (num >= 1e6) {
    return (num / 1e6).toFixed(1) + 'M';
  }
  if (num >= 1e3) {
    return (num / 1e3).toFixed(1) + 'K';
  }
  return num.toString();
};

// Gas price formatting
export const formatGasPrice = (gasPrice: string | bigint): string => {
  const gasPriceGwei = ethers.formatUnits(gasPrice.toString(), 'gwei');
  return `${parseFloat(gasPriceGwei).toFixed(2)} Gwei`;
};

// Block number formatting
export const formatBlockNumber = (blockNumber: number): string => {
  return new Intl.NumberFormat('en-US').format(blockNumber);
};

// Confirmation count formatting
export const formatConfirmations = (confirmations: number): string => {
  if (confirmations === 0) return 'Unconfirmed';
  if (confirmations === 1) return '1 confirmation';
  return `${confirmations} confirmations`;
};

// Invoice status formatting
export const formatInvoiceStatus = (status: string): string => {
  const statusMap = {
    draft: 'Draft',
    pending: 'Pending Payment',
    paid: 'Paid',
    expired: 'Expired',
    cancelled: 'Cancelled',
  };

  return statusMap[status as keyof typeof statusMap] || status;
};

// Payment status formatting
export const formatPaymentStatus = (status: string): string => {
  const statusMap = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    failed: 'Failed',
  };

  return statusMap[status as keyof typeof statusMap] || status;
};

// Input validation formatting
export const formatInput = {
  // Remove non-numeric characters except decimal point
  currency: (value: string): string => {
    return value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
  },

  // Format as user types currency
  currencyInput: (value: string): string => {
    const cleaned = formatInput.currency(value);
    const parts = cleaned.split('.');
    
    if (parts.length > 2) {
      return `${parts[0]}.${parts[1]}`;
    }
    
    if (parts[1] && parts[1].length > 2) {
      return `${parts[0]}.${parts[1].substring(0, 2)}`;
    }
    
    return cleaned;
  },

  // Remove non-alphanumeric characters
  alphanumeric: (value: string): string => {
    return value.replace(/[^a-zA-Z0-9]/g, '');
  },

  // Format email input
  email: (value: string): string => {
    return value.toLowerCase().trim();
  },
};