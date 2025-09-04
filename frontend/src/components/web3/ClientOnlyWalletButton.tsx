'use client';

import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { ButtonVariant, ButtonSize } from '@/types/common';
import clsx from 'clsx';

interface WalletConnectButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  showAddress?: boolean;
  fullWidth?: boolean;
}

// Dynamically import the wallet button to prevent SSR hydration issues
const WalletConnectButtonInternal = dynamic(
  () => import('./WalletConnectButtonInternal').then(mod => ({ default: mod.WalletConnectButtonInternal })),
  {
    ssr: false,
    loading: ({ variant = 'primary', size = 'md', className, fullWidth }: WalletConnectButtonProps) => {
      // Button size classes
      const sizeClasses = {
        sm: 'px-3 py-2 text-sm',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base',
      };

      // Button variant classes
      const variantClasses = {
        primary: 'btn-primary',
        secondary: 'btn-secondary',
        success: 'btn-success',
        warning: 'btn-warning',
        error: 'btn-error',
        ghost: 'bg-transparent hover:bg-secondary-100 text-secondary-700 border border-secondary-300',
      };

      const buttonClasses = clsx(
        'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className
      );

      return (
        <button className={buttonClasses} disabled>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Loading...
        </button>
      );
    }
  }
);

export const WalletConnectButton: React.FC<WalletConnectButtonProps> = (props) => {
  return <WalletConnectButtonInternal {...props} />;
};