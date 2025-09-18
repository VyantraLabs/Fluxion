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
    loading: () => (
      <button 
        className="inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm btn-primary" 
        disabled
      >
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        Loading...
      </button>
    )
  }
);

export const WalletConnectButton: React.FC<WalletConnectButtonProps> = (props) => {
  return <WalletConnectButtonInternal {...props} />;
};