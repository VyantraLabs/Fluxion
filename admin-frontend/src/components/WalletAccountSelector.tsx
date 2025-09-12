'use client'

import React, { useState, useEffect } from 'react'
import toast from 'react-hot-toast'

interface WalletAccount {
  address: string
  isSelected: boolean
}

interface WalletAccountSelectorProps {
  onAccountSelect: (address: string) => void
  selectedAddress?: string
}

export const WalletAccountSelector: React.FC<WalletAccountSelectorProps> = ({
  onAccountSelect,
  selectedAddress
}) => {
  const [accounts, setAccounts] = useState<WalletAccount[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  const loadAccounts = async () => {
    try {
      setIsLoading(true)
      
      const { getAvailableAccounts } = await import('@/utils/walletConnection')
      const availableAccounts = await getAvailableAccounts()
      
      const accountList: WalletAccount[] = availableAccounts.map(address => ({
        address,
        isSelected: address.toLowerCase() === selectedAddress?.toLowerCase()
      }))
      
      setAccounts(accountList)
      
    } catch (error: any) {
      console.error('Failed to load accounts:', error)
      toast.error('Failed to load wallet accounts')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isExpanded) {
      loadAccounts()
    }
  }, [isExpanded, selectedAddress])

  const handleAccountClick = (address: string) => {
    onAccountSelect(address)
    setIsExpanded(false)
  }

  const formatAddress = (address: string) => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
  }

  if (accounts.length <= 1) {
    return null // Don't show selector if only one account
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="text-xs text-blue-600 hover:text-blue-500 underline"
      >
        {accounts.length > 1 ? `${accounts.length} accounts available` : 'Select account'}
      </button>

      {isExpanded && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsExpanded(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute top-full mt-2 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[280px]">
            <div className="p-3 border-b border-gray-100">
              <h3 className="text-sm font-medium text-gray-900">Select Wallet Account</h3>
              <p className="text-xs text-gray-500 mt-1">
                Choose which account to use for admin access
              </p>
            </div>
            
            <div className="max-h-60 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-sm text-gray-500 mt-2">Loading accounts...</p>
                </div>
              ) : (
                <div className="py-2">
                  {accounts.map((account, index) => (
                    <button
                      key={account.address}
                      onClick={() => handleAccountClick(account.address)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                        account.isSelected ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            Account {index + 1}
                          </div>
                          <div className="text-xs font-mono text-gray-500">
                            {account.address}
                          </div>
                        </div>
                        {account.isSelected && (
                          <div className="text-blue-500">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-600">
              💡 Tip: You can change the active account in your wallet app to set a default
            </div>
          </div>
        </>
      )}
    </div>
  )
}