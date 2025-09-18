'use client';

import React, { useState } from 'react';
import { WalletConnectButton } from '@/components/web3/WalletConnectButton';
import { useWalletAuth } from '@/contexts/AuthContext';
// Mock wallet utility removed during repository cleanup
// import { enableMockWallet } from '@/utils/mockWallet';

export default function TestWalletPage() {
  const { 
    isWalletConnected, 
    isAuthenticated, 
    isConnecting, 
    isAuthenticating, 
    user, 
    wallet, 
    error 
  } = useWalletAuth();
  
  const [mockEnabled, setMockEnabled] = useState(false);

  const enableMock = () => {
    // Mock wallet functionality disabled - utility removed during cleanup
    console.log('Mock wallet functionality disabled in production build');
    setMockEnabled(true);
  };

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Wallet Connection Test</h1>
        
        {/* Mock Wallet Controls */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
          <h2 className="text-lg font-semibold text-yellow-800 mb-2">Development Testing</h2>
          <p className="text-yellow-700 mb-4">
            If you don't have MetaMask installed, you can enable a mock wallet for testing.
          </p>
          <button
            onClick={enableMock}
            disabled={mockEnabled}
            className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mockEnabled ? 'Mock Wallet Enabled' : 'Enable Mock Wallet'}
          </button>
        </div>

        {/* Wallet Connection Status */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Connection Status</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Wallet Connected:</span>
                <span className={`font-medium ${isWalletConnected ? 'text-green-600' : 'text-red-600'}`}>
                  {isWalletConnected ? '✅ Yes' : '❌ No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Authenticated:</span>
                <span className={`font-medium ${isAuthenticated ? 'text-green-600' : 'text-red-600'}`}>
                  {isAuthenticated ? '✅ Yes' : '❌ No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Connecting:</span>
                <span className={`font-medium ${isConnecting ? 'text-blue-600' : 'text-gray-500'}`}>
                  {isConnecting ? '⏳ Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Authenticating:</span>
                <span className={`font-medium ${isAuthenticating ? 'text-blue-600' : 'text-gray-500'}`}>
                  {isAuthenticating ? '⏳ Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Wallet Details</h3>
            {wallet ? (
              <div className="space-y-2 text-sm font-mono">
                <div>
                  <strong>Address:</strong>
                  <div className="text-xs bg-gray-100 p-2 rounded mt-1 break-all">
                    {wallet.address}
                  </div>
                </div>
                <div>
                  <strong>Chain ID:</strong> {wallet.chainId}
                </div>
                <div>
                  <strong>Provider:</strong> {wallet.provider}
                </div>
                {wallet.balance && (
                  <div>
                    <strong>Balance:</strong> {parseFloat(wallet.balance).toFixed(4)} MATIC
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500">No wallet connected</p>
            )}
          </div>
        </div>

        {/* User Info */}
        {user && (
          <div className="bg-green-50 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold mb-4">User Information</h3>
            <div className="space-y-2">
              <div>
                <strong>Display Name:</strong> {user.display_name}
              </div>
              <div>
                <strong>Email:</strong> {user.email}
              </div>
              <div>
                <strong>Organization:</strong> {user.tenant_id}
              </div>
              <div>
                <strong>User ID:</strong> 
                <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded ml-2">
                  {user.id}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <h3 className="text-lg font-semibold text-red-800 mb-2">Error</h3>
            <p className="text-red-700">{typeof error === 'string' ? error : JSON.stringify(error)}</p>
          </div>
        )}

        {/* Wallet Connect Button */}
        <div className="text-center">
          <WalletConnectButton size="lg" showAddress={true} />
        </div>

        {/* Debug Information */}
        <div className="mt-12 bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Debug Information</h3>
          <div className="space-y-4">
            <div>
              <strong>Window.ethereum available:</strong>{' '}
              <span className="font-mono">
                {typeof window !== 'undefined' ? String(!!window.ethereum) : 'N/A'}
              </span>
            </div>
            <div>
              <strong>Is MetaMask:</strong>{' '}
              <span className="font-mono">
                {typeof window !== 'undefined' && window.ethereum 
                  ? String(!!window.ethereum.isMetaMask) 
                  : 'N/A'
                }
              </span>
            </div>
            <div>
              <strong>Current Chain ID:</strong>{' '}
              <span className="font-mono">
                {typeof window !== 'undefined' && window.ethereum?.chainId
                  ? window.ethereum.chainId
                  : 'N/A'
                }
              </span>
            </div>
            
            {/* Console Log Instructions */}
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded">
              <p className="text-blue-800 font-medium mb-2">Console Debug Commands:</p>
              <div className="space-y-1 text-sm font-mono">
                <div>• Check wallet: <code className="bg-blue-100 px-1">window.ethereum</code></div>
                <div>• Enable mock wallet: <code className="bg-blue-100 px-1">enableMockWallet()</code></div>
                <div>• Check connection status in DevTools Console</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}