'use client';

import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Globe,
} from 'lucide-react';
import { Invoice, Token, BlockchainNetwork } from '@/types/invoice';
import { formatCurrency } from '@/utils/format';

interface WalletConnectPaymentProps {
  invoice: Invoice;
  token: Token;
  network: BlockchainNetwork;
  paymentAddress: string;
  onPaymentSubmit: (txHash: string) => void;
  isSubmitting?: boolean;
}

interface WalletInfo {
  address: string;
  balance: string;
  chainId: number;
  isConnected: boolean;
}

export const WalletConnectPayment: React.FC<WalletConnectPaymentProps> = ({
  invoice,
  token,
  network,
  paymentAddress,
  onPaymentSubmit,
  isSubmitting = false,
}) => {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [hasMetaMask, setHasMetaMask] = useState(false);

  const amount = parseFloat(invoice.amount);
  const isCorrectNetwork = wallet?.chainId === network.chainId;
  const hasEnoughBalance = wallet ? parseFloat(wallet.balance) >= amount : false;

  // Check if MetaMask is installed
  useEffect(() => {
    const checkMetaMask = () => {
      setHasMetaMask(typeof window !== 'undefined' && !!window.ethereum);
    };
    
    checkMetaMask();
    
    // Listen for wallet events
    if (window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          setWallet(null);
        } else {
          connectWallet();
        }
      };

      const handleChainChanged = () => {
        connectWallet();
      };

      if (window.ethereum) {
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);
      }

      return () => {
        if (window.ethereum) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) {
      setError('MetaMask is not installed. Please install MetaMask to continue.');
      return;
    }

    try {
      setIsConnecting(true);
      setError(null);

      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      // Get chain ID
      const chainId = await window.ethereum.request({
        method: 'eth_chainId',
      });

      // Get balance (simplified - in production, you'd need to handle different token types)
      let balance = '0';
      try {
        if (token.isNative) {
          const balanceWei = await window.ethereum.request({
            method: 'eth_getBalance',
            params: [accounts[0], 'latest'],
          });
          balance = (parseInt(balanceWei, 16) / Math.pow(10, 18)).toFixed(4);
        } else {
          // For ERC-20 tokens, we'd need to call the contract
          balance = '0'; // Placeholder
        }
      } catch (balanceError) {
        console.error('Failed to get balance:', balanceError);
      }

      setWallet({
        address: accounts[0],
        balance,
        chainId: parseInt(chainId, 16),
        isConnected: true,
      });
    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      setError(error.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const switchNetwork = async () => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${network.chainId.toString(16)}` }],
      });
    } catch (error: any) {
      // If the network is not added, add it
      if (error.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${network.chainId.toString(16)}`,
              chainName: network.name,
              nativeCurrency: {
                name: token.name,
                symbol: token.symbol,
                decimals: token.decimals,
              },
              rpcUrls: [network.rpcUrl],
              blockExplorerUrls: [network.explorerUrl],
            }],
          });
        } catch (addError) {
          console.error('Failed to add network:', addError);
          setError('Failed to add network to wallet');
        }
      } else {
        console.error('Failed to switch network:', error);
        setError('Failed to switch network');
      }
    }
  };

  const sendPayment = async () => {
    if (!wallet || !isCorrectNetwork) return;

    try {
      setIsSending(true);
      setError(null);

      let txParams;
      
      if (token.isNative) {
        // Native token transfer
        txParams = {
          from: wallet.address,
          to: paymentAddress,
          value: `0x${Math.floor(amount * Math.pow(10, token.decimals)).toString(16)}`,
        };
      } else {
        // ERC-20 token transfer
        // This is simplified - in production, you'd encode the transfer function call
        txParams = {
          from: wallet.address,
          to: token.contractAddress,
          data: `0xa9059cbb${paymentAddress.slice(2).padStart(64, '0')}${Math.floor(amount * Math.pow(10, token.decimals)).toString(16).padStart(64, '0')}`,
        };
      }

      if (!window.ethereum) {
        throw new Error('MetaMask is not available');
      }

      const hash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [txParams],
      });

      setTxHash(hash);
      onPaymentSubmit(hash);
    } catch (error: any) {
      console.error('Failed to send payment:', error);
      setError(error.message || 'Failed to send payment');
    } finally {
      setIsSending(false);
    }
  };

  if (!hasMetaMask) {
    return (
      <div className="bg-white rounded-lg border border-secondary-200 p-6 text-center">
        <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Wallet className="w-6 h-6 text-orange-600" />
        </div>
        <h3 className="text-lg font-semibold text-secondary-900 mb-2">
          MetaMask Required
        </h3>
        <p className="text-secondary-600 mb-4">
          You need MetaMask or a compatible Web3 wallet to pay with this method.
        </p>
        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
        >
          Install MetaMask
          <ExternalLink className="w-4 h-4 ml-2" />
        </a>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-secondary-200 p-6">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Wallet className="w-6 h-6 text-purple-600" />
        </div>
        <h3 className="text-lg font-semibold text-secondary-900 mb-1">
          Browser Wallet Payment
        </h3>
        <p className="text-sm text-secondary-600">
          Connect your wallet to pay directly from your browser
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-lg">
          <div className="flex items-center">
            <AlertTriangle className="w-4 h-4 text-danger-600 mr-2" />
            <p className="text-sm text-danger-800">{error}</p>
          </div>
        </div>
      )}

      {!wallet ? (
        /* Connect Wallet */
        <div className="text-center">
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="btn-primary"
          >
            {isConnecting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Wallet className="w-4 h-4 mr-2" />
            )}
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        </div>
      ) : (
        /* Wallet Connected */
        <div className="space-y-4">
          {/* Wallet Info */}
          <div className="bg-secondary-50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-secondary-900 mb-2">Connected Wallet</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-secondary-600">Address:</span>
                <span className="font-mono text-secondary-900">
                  {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary-600">Balance:</span>
                <span className="text-secondary-900">{wallet.balance} {token.symbol}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-secondary-600">Network:</span>
                <span className={`${isCorrectNetwork ? 'text-success-600' : 'text-danger-600'}`}>
                  Chain ID {wallet.chainId}
                </span>
              </div>
            </div>
          </div>

          {/* Network Check */}
          {!isCorrectNetwork && (
            <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <AlertTriangle className="w-5 h-5 text-warning-600 mr-2" />
                  <div>
                    <p className="text-sm font-semibold text-warning-900">Wrong Network</p>
                    <p className="text-xs text-warning-800">Switch to {network.name}</p>
                  </div>
                </div>
                <button
                  onClick={switchNetwork}
                  className="btn-secondary text-sm"
                >
                  Switch Network
                </button>
              </div>
            </div>
          )}

          {/* Balance Check */}
          {isCorrectNetwork && !hasEnoughBalance && (
            <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertTriangle className="w-5 h-5 text-danger-600 mr-2" />
                <div>
                  <p className="text-sm font-semibold text-danger-900">Insufficient Balance</p>
                  <p className="text-xs text-danger-800">
                    You need at least {invoice.amount} {token.symbol}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Payment Details */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-3">Payment Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-blue-800">Amount:</span>
                <span className="font-semibold text-blue-900">
                  {invoice.amount} {token.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-800">USD Value:</span>
                <span className="text-blue-900">{formatCurrency(amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-blue-800">To:</span>
                <span className="font-mono text-blue-900 text-xs">
                  {paymentAddress.slice(0, 10)}...{paymentAddress.slice(-8)}
                </span>
              </div>
            </div>
          </div>

          {/* Transaction Hash Display */}
          {txHash && (
            <div className="bg-success-50 border border-success-200 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-success-600 mr-2" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-success-900">Payment Sent!</p>
                  <p className="text-xs text-success-800 font-mono mt-1">
                    TX: {txHash.slice(0, 10)}...{txHash.slice(-8)}
                  </p>
                </div>
                <a
                  href={`${network.explorerUrl}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-success-600 hover:text-success-700"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          )}

          {/* Send Payment Button */}
          <button
            onClick={sendPayment}
            disabled={!isCorrectNetwork || !hasEnoughBalance || isSending || isSubmitting || !!txHash}
            className="w-full btn-primary"
          >
            {isSending || isSubmitting ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : txHash ? (
              <CheckCircle className="w-4 h-4 mr-2" />
            ) : (
              <ArrowRight className="w-4 h-4 mr-2" />
            )}
            {isSending || isSubmitting 
              ? 'Processing...'
              : txHash 
              ? 'Payment Sent'
              : `Pay ${invoice.amount} ${token.symbol}`
            }
          </button>
        </div>
      )}

      {/* Help Text */}
      <div className="mt-6 pt-4 border-t border-secondary-200">
        <div className="flex items-start space-x-2">
          <Globe className="w-4 h-4 text-secondary-400 mt-0.5" />
          <p className="text-xs text-secondary-600 leading-relaxed">
            This method directly interacts with your browser wallet. Make sure you're on the correct network 
            and have enough {token.symbol} plus gas fees for the transaction.
          </p>
        </div>
      </div>
    </div>
  );
};