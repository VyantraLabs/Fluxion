'use client';

import React, { useState, useEffect } from 'react';
import { Wallet, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { useWalletAuth } from '@/contexts/AuthContext';
import { formatWalletAddress } from '@/utils/format';
import { isMetaMaskInstalled } from '@/utils/web3';
import { ButtonVariant, ButtonSize } from '@/types/common';
import clsx from 'clsx';

interface WalletConnectButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  showAddress?: boolean;
  fullWidth?: boolean;
}

export const WalletConnectButtonInternal: React.FC<WalletConnectButtonProps> = ({
  variant = 'primary',
  size = 'md',
  className,
  showAddress = false,
  fullWidth = false,
}) => {
  const {
    isWalletConnected,
    isAuthenticated,
    isConnecting,
    isAuthenticating,
    user,
    wallet,
    error,
    connectAndAuthenticate,
    disconnectAndLogout,
  } = useWalletAuth();

  const [showDropdown, setShowDropdown] = useState(false);
  const [hasMetaMask, setHasMetaMask] = useState(true); // Default to true to prevent initial flash

  // Client-side detection of MetaMask
  useEffect(() => {
    setHasMetaMask(isMetaMaskInstalled());
  }, []);

  const handleConnect = async () => {
    try {
      await connectAndAuthenticate();
    } catch (error) {
      console.error('Connection failed:', error);
    }
  };

  const handleDisconnect = () => {
    disconnectAndLogout();
    setShowDropdown(false);
  };

  const isLoading = isConnecting || isAuthenticating;

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

  // If MetaMask is not installed
  if (!hasMetaMask) {
    return (
      <div className="relative">
        <button className={buttonClasses} disabled>
          <AlertCircle className="w-4 h-4 mr-2" />
          Install MetaMask
        </button>
        
        <div className="absolute top-full mt-2 left-0 bg-white border border-secondary-200 rounded-lg shadow-lg p-3 z-50">
          <p className="text-sm text-secondary-600 mb-2">
            MetaMask is required to use Fluxion
          </p>
          <a
            href="https://metamask.io"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-sm text-primary-600 hover:text-primary-500"
          >
            Download MetaMask
            <ExternalLink className="w-3 h-3 ml-1" />
          </a>
        </div>
      </div>
    );
  }

  // If authenticated, show wallet info
  if (isAuthenticated && wallet) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={clsx(
            buttonClasses,
            'wallet-connected'
          )}
        >
          <Wallet className="w-4 h-4 mr-2" />
          {showAddress ? (
            <span className="font-mono">
              {formatWalletAddress(wallet.address)}
            </span>
          ) : (
            <span>Connected</span>
          )}
        </button>

        {/* Dropdown menu */}
        {showDropdown && (
          <div className="absolute top-full mt-2 right-0 bg-white border border-secondary-200 rounded-lg shadow-lg py-2 z-50 min-w-[200px]">
            <div className="px-4 py-2 border-b border-secondary-100">
              <p className="text-sm font-medium text-secondary-900">
                {user?.display_name || 'Anonymous'}
              </p>
              <p className="text-xs text-secondary-500 font-mono">
                {formatWalletAddress(wallet.address)}
              </p>
            </div>
            
            {wallet.balance && (
              <div className="px-4 py-2 border-b border-secondary-100">
                <p className="text-xs text-secondary-500">Balance</p>
                <p className="text-sm font-medium text-secondary-900">
                  {parseFloat(wallet.balance).toFixed(4)} MATIC
                </p>
              </div>
            )}

            <button
              onClick={handleDisconnect}
              className="w-full text-left px-4 py-2 text-sm text-error-600 hover:bg-error-50 transition-colors"
            >
              Disconnect
            </button>
          </div>
        )}

        {/* Backdrop for dropdown */}
        {showDropdown && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
        )}
      </div>
    );
  }

  // Default connect button
  return (
    <button
      onClick={handleConnect}
      disabled={isLoading}
      className={buttonClasses}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <Wallet className="w-4 h-4 mr-2" />
      )}
      
      {isLoading ? (
        isConnecting ? 'Connecting...' : 'Authenticating...'
      ) : (
        'Connect Wallet'
      )}
    </button>
  );
};

// Wallet status indicator component
export const WalletStatus: React.FC = () => {
  const { isWalletConnected, isAuthenticated, wallet } = useWalletAuth();

  if (!isWalletConnected) {
    return (
      <div className="flex items-center space-x-2 text-sm text-secondary-500">
        <div className="w-2 h-2 bg-error-500 rounded-full" />
        <span>Not connected</span>
      </div>
    );
  }

  if (isWalletConnected && !isAuthenticated) {
    return (
      <div className="flex items-center space-x-2 text-sm text-warning-600">
        <div className="w-2 h-2 bg-warning-500 rounded-full animate-pulse" />
        <span>Authenticating...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2 text-sm text-success-600">
      <div className="w-2 h-2 bg-success-500 rounded-full" />
      <span>{formatWalletAddress(wallet?.address || '')}</span>
    </div>
  );
};

// Network indicator component
export const NetworkIndicator: React.FC = () => {
  const { wallet } = useWalletAuth();

  if (!wallet) return null;

  const getNetworkInfo = (chainId: number) => {
    switch (chainId) {
      case 137:
        return { name: 'Polygon', color: 'bg-purple-500' };
      case 80001:
        return { name: 'Mumbai', color: 'bg-purple-400' };
      case 1:
        return { name: 'Ethereum', color: 'bg-blue-500' };
      default:
        return { name: 'Unknown', color: 'bg-secondary-400' };
    }
  };

  const networkInfo = getNetworkInfo(wallet.chainId);

  return (
    <div className="flex items-center space-x-2 text-sm">
      <div className={`w-2 h-2 ${networkInfo.color} rounded-full`} />
      <span className="text-secondary-600">{networkInfo.name}</span>
    </div>
  );
};