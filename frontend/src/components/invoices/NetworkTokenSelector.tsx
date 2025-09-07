'use client';

import React, { useState, useEffect } from 'react';
import {
  ChevronDown,
  CheckCircle,
  AlertCircle,
  Loader2,
  Search,
  Star,
  Globe,
} from 'lucide-react';
import { BlockchainNetwork, Token } from '@/types/invoice';
import { useConfig, useNetworks, useTokens } from '@/contexts/ConfigContext';
import { formatCurrency } from '@/utils/format';

interface NetworkTokenSelectorProps {
  selectedNetworkId?: string;
  selectedTokenId?: string;
  onNetworkChange: (networkId: string) => void;
  onTokenChange: (tokenId: string) => void;
  disabled?: boolean;
  error?: string;
}

interface NetworkWithTokens extends BlockchainNetwork {
  tokens: Token[];
  metadata?: {
    logo?: string;
  };
}

export const NetworkTokenSelector: React.FC<NetworkTokenSelectorProps> = ({
  selectedNetworkId,
  selectedTokenId,
  onNetworkChange,
  onTokenChange,
  disabled = false,
  error,
}) => {
  const { config } = useConfig();
  const networks = useNetworks();
  const tokens = useTokens();
  
  const [isNetworkDropdownOpen, setIsNetworkDropdownOpen] = useState(false);
  const [isTokenDropdownOpen, setIsTokenDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Build networks with their tokens
  const networksWithTokens: NetworkWithTokens[] = networks.map(network => ({
    ...network,
    tokens: tokens.filter(token => token.networkId === network.id).map(token => ({
      ...token,
      metadata: {
        logo: token.logoUrl,
      },
    })),
    metadata: {
      logo: undefined, // Will be populated from database if available
    },
  }));

  const selectedNetwork = networksWithTokens.find(n => 
    n.chainId.toString() === selectedNetworkId || n.id === selectedNetworkId
  );
  const selectedToken = selectedNetwork?.tokens.find(t => t.id === selectedTokenId);
  const availableTokens = selectedNetwork?.tokens || [];

  // Auto-select first network and token if none selected
  useEffect(() => {
    if (networksWithTokens.length > 0 && !selectedNetworkId && config.isLoaded) {
      const firstNetwork = networksWithTokens[0];
      // Use the network's ID (which should match the chainId as string)
      onNetworkChange(firstNetwork.id);
    }
  }, [networksWithTokens, selectedNetworkId, onNetworkChange, config.isLoaded]);

  useEffect(() => {
    if (selectedNetwork?.tokens.length > 0 && !selectedTokenId) {
      // Prefer stablecoins for default selection
      const stablecoin = selectedNetwork.tokens.find(t => t.isStablecoin);
      const defaultToken = stablecoin || selectedNetwork.tokens[0];
      onTokenChange(defaultToken.id);
    }
  }, [selectedNetwork, selectedTokenId, onTokenChange]);

  const handleNetworkSelect = (networkId: string) => {
    onNetworkChange(networkId);
    setIsNetworkDropdownOpen(false);
    
    // Reset token selection when network changes
    const newNetwork = networksWithTokens.find(n => 
      n.chainId.toString() === networkId || n.id === networkId
    );
    if (newNetwork?.tokens.length > 0) {
      const stablecoin = newNetwork.tokens.find(t => t.isStablecoin);
      const defaultToken = stablecoin || newNetwork.tokens[0];
      onTokenChange(defaultToken.id);
    }
  };

  const handleTokenSelect = (tokenId: string) => {
    onTokenChange(tokenId);
    setIsTokenDropdownOpen(false);
  };

  const filteredNetworks = networksWithTokens.filter(network =>
    network.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    network.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredTokens = availableTokens.filter(token =>
    token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    token.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (config.error && !config.isLoaded) {
    return (
      <div className="space-y-4">
        <label className="block text-sm font-medium text-secondary-700">
          Payment Network & Token
        </label>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Failed to load networks</h3>
              <p className="text-sm text-red-700 mt-1">{config.error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium text-secondary-700">
        Payment Network & Token *
      </label>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Network Selector */}
        <div className="relative">
          <label className="block text-xs font-medium text-secondary-600 mb-2">
            Blockchain Network
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => !disabled && setIsNetworkDropdownOpen(!isNetworkDropdownOpen)}
              disabled={disabled || config.isLoading}
              className={`w-full flex items-center justify-between p-3 border rounded-lg text-left transition-colors ${
                disabled || config.isLoading
                  ? 'bg-secondary-50 border-secondary-200 text-secondary-400 cursor-not-allowed'
                  : 'bg-white border-secondary-300 hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
              } ${error ? 'border-red-300' : ''}`}
            >
              {config.isLoading ? (
                <div className="flex items-center">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  <span className="text-secondary-500">Loading networks...</span>
                </div>
              ) : selectedNetwork ? (
                <div className="flex items-center">
                  {selectedNetwork.metadata?.logo && (
                    <img
                      src={selectedNetwork.metadata.logo}
                      alt={selectedNetwork.name}
                      className="w-5 h-5 rounded mr-3"
                    />
                  )}
                  <div>
                    <div className="font-medium text-secondary-900">{selectedNetwork.name}</div>
                    <div className="text-xs text-secondary-500">
                      Chain ID: {selectedNetwork.chainId}
                    </div>
                  </div>
                </div>
              ) : (
                <span className="text-secondary-500">Select network</span>
              )}
              <ChevronDown className="w-4 h-4 text-secondary-400" />
            </button>

            {/* Network Dropdown */}
            {isNetworkDropdownOpen && !disabled && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-secondary-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                <div className="p-2 border-b border-secondary-200">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary-400" />
                    <input
                      type="text"
                      placeholder="Search networks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-secondary-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
                
                <div className="py-1">
                  {filteredNetworks.map((network) => (
                    <button
                      key={network.chainId}
                      type="button"
                      onClick={() => handleNetworkSelect(network.id)}
                      className="w-full flex items-center px-3 py-2 text-left hover:bg-secondary-50 transition-colors"
                    >
                      {network.metadata?.logo && (
                        <img
                          src={network.metadata.logo}
                          alt={network.name}
                          className="w-5 h-5 rounded mr-3"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center">
                          <span className="font-medium text-secondary-900">{network.name}</span>
                          {network.isTestnet && (
                            <span className="ml-2 px-2 py-1 text-xs bg-warning-100 text-warning-800 rounded">
                              Testnet
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-secondary-500">
                          Chain ID: {network.chainId} • {network.tokens.length} tokens
                        </div>
                      </div>
                      {(selectedNetworkId === network.chainId.toString() || selectedNetworkId === network.id) && (
                        <CheckCircle className="w-4 h-4 text-primary-600" />
                      )}
                    </button>
                  ))}
                  
                  {filteredNetworks.length === 0 && (
                    <div className="px-3 py-2 text-sm text-secondary-500 text-center">
                      No networks found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Token Selector */}
        <div className="relative">
          <label className="block text-xs font-medium text-secondary-600 mb-2">
            Allowed Tokens
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => !disabled && selectedNetwork && setIsTokenDropdownOpen(!isTokenDropdownOpen)}
              disabled={disabled || !selectedNetwork || availableTokens.length === 0}
              className={`w-full flex items-center justify-between p-3 border rounded-lg text-left transition-colors ${
                disabled || !selectedNetwork
                  ? 'bg-secondary-50 border-secondary-200 text-secondary-400 cursor-not-allowed'
                  : 'bg-white border-secondary-300 hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500'
              } ${error ? 'border-red-300' : ''}`}
            >
              {!selectedNetwork ? (
                <span className="text-secondary-500">Select network first</span>
              ) : availableTokens.length === 0 ? (
                <span className="text-secondary-500">No tokens available</span>
              ) : selectedToken ? (
                <div className="flex items-center">
                  {selectedToken.metadata?.logo && (
                    <img
                      src={selectedToken.metadata.logo}
                      alt={selectedToken.symbol}
                      className="w-5 h-5 rounded mr-3"
                    />
                  )}
                  <div>
                    <div className="font-medium text-secondary-900">
                      {selectedToken.symbol}
                      {selectedToken.isStablecoin && (
                        <Star className="w-3 h-3 inline ml-1 text-warning-500" />
                      )}
                    </div>
                    <div className="text-xs text-secondary-500">{selectedToken.name}</div>
                  </div>
                </div>
              ) : (
                <span className="text-secondary-500">Select token</span>
              )}
              <ChevronDown className="w-4 h-4 text-secondary-400" />
            </button>

            {/* Token Dropdown */}
            {isTokenDropdownOpen && !disabled && selectedNetwork && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-secondary-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                <div className="p-2 border-b border-secondary-200">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary-400" />
                    <input
                      type="text"
                      placeholder="Search tokens..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-sm border border-secondary-300 rounded-md focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                </div>
                
                <div className="py-1">
                  {/* Stablecoins first */}
                  {filteredTokens.filter(t => t.isStablecoin).map((token) => (
                    <button
                      key={token.id}
                      type="button"
                      onClick={() => handleTokenSelect(token.id)}
                      className="w-full flex items-center px-3 py-2 text-left hover:bg-secondary-50 transition-colors"
                    >
                      {token.metadata?.logo && (
                        <img
                          src={token.metadata.logo}
                          alt={token.symbol}
                          className="w-5 h-5 rounded mr-3"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center">
                          <span className="font-medium text-secondary-900">{token.symbol}</span>
                          <Star className="w-3 h-3 ml-1 text-warning-500" />
                          {token.isNative && (
                            <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                              Native
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-secondary-500">{token.name}</div>
                      </div>
                      {selectedTokenId === token.id && (
                        <CheckCircle className="w-4 h-4 text-primary-600" />
                      )}
                    </button>
                  ))}
                  
                  {/* Other tokens */}
                  {filteredTokens.filter(t => !t.isStablecoin).map((token) => (
                    <button
                      key={token.id}
                      type="button"
                      onClick={() => handleTokenSelect(token.id)}
                      className="w-full flex items-center px-3 py-2 text-left hover:bg-secondary-50 transition-colors"
                    >
                      {token.metadata?.logo && (
                        <img
                          src={token.metadata.logo}
                          alt={token.symbol}
                          className="w-5 h-5 rounded mr-3"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center">
                          <span className="font-medium text-secondary-900">{token.symbol}</span>
                          {token.isNative && (
                            <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                              Native
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-secondary-500">{token.name}</div>
                      </div>
                      {selectedTokenId === token.id && (
                        <CheckCircle className="w-4 h-4 text-primary-600" />
                      )}
                    </button>
                  ))}
                  
                  {filteredTokens.length === 0 && (
                    <div className="px-3 py-2 text-sm text-secondary-500 text-center">
                      No tokens found
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Selection Summary */}
      {selectedNetwork && selectedToken && (
        <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg">
          <div className="flex items-center text-sm">
            <Globe className="w-4 h-4 text-primary-600 mr-2" />
            <span className="text-primary-800">
              Payments will be received on <strong>{selectedNetwork.name}</strong> in <strong>{selectedToken.symbol}</strong>
              {selectedToken.isStablecoin && ' (Stablecoin)'}
            </span>
          </div>
          {selectedToken.isStablecoin && (
            <div className="mt-1 text-xs text-primary-700">
              💡 Stablecoins provide price stability and are recommended for invoices
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 flex items-center">
          <AlertCircle className="w-4 h-4 mr-1" />
          {error}
        </div>
      )}
    </div>
  );
};