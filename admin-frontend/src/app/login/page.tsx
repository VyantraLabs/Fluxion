'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/contexts/AdminAuthContext'
import { WalletAccountSelector } from '@/components/WalletAccountSelector'
import toast, { Toaster } from 'react-hot-toast'

export default function LoginPage() {
  const [walletAddress, setWalletAddress] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const { login, isAuthenticated, isLoading, hasSystemAccess } = useAdminAuth()
  const router = useRouter()

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && hasSystemAccess) {
      console.log('✅ Login: User already authenticated, redirecting to dashboard')
      router.push('/dashboard')
    }
  }, [isAuthenticated, hasSystemAccess, router])

  // Auto-fill with test wallet address
  useEffect(() => {
    setWalletAddress('0xeDeF23d5ee863a34df67E345C64E99d52B07421D')
  }, [])

  const connectWallet = async () => {
    try {
      setIsConnecting(true)
      console.log('🔄 Admin Login: Starting wallet connection...')
      
      // Use the chain-agnostic wallet connection
      const { connectWallet: connectWalletUtil, getAvailableAccounts } = await import('@/utils/walletConnection')
      
      // First, connect to wallet and get available accounts
      const connection = await connectWalletUtil()
      
      // Get all available accounts for user information
      const availableAccounts = await getAvailableAccounts()
      
      setWalletAddress(connection.address)
      console.log(`✅ Admin Login: Connected on ${connection.chainName} (${connection.address})`)
      console.log('🔍 Admin Login: Available accounts:', availableAccounts)
      
      if (availableAccounts.length > 1) {
        toast.success(`Connected on ${connection.chainName} - ${availableAccounts.length} accounts available`)
      } else {
        toast.success(`Connected on ${connection.chainName}`)
      }
      
    } catch (error: any) {
      console.error('❌ Admin Login: Wallet connection error:', error)
      
      if (error.message.includes('cancelled') || error.message.includes('rejected')) {
        toast.error('Connection cancelled by user')
      } else if (error.message.includes('install')) {
        toast.error('Please install MetaMask or another Web3 wallet')
      } else {
        toast.error(error.message || 'Failed to connect wallet')
      }
    } finally {
      setIsConnecting(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!walletAddress) {
      toast.error('Please enter a wallet address or connect your wallet')
      return
    }

    try {
      setIsSigningIn(true)
      console.log('🔄 Login: Starting authentication process...')
      
      // Show loading message
      const loadingToast = toast.loading('Authenticating with wallet signature...')
      
      await login(walletAddress)
      
      toast.dismiss(loadingToast)
      toast.success('Authentication successful! Welcome to the admin panel.')
      
      console.log('✅ Login: Authentication successful, redirecting to dashboard')
      router.push('/dashboard')
      
    } catch (error: any) {
      console.error('❌ Login: Authentication error:', error)
      
      // Handle specific error types
      if (error.message?.includes('System administrator privileges required') || 
          error.message?.includes('Access denied')) {
        toast.error('Access denied: You need system administrator privileges to access this admin panel', {
          duration: 6000
        })
      } else if (error.code === 'USER_REJECTED' || error.code === 4001 || error.message?.includes('cancelled by user')) {
        toast.error('Please approve the wallet connection to authenticate')
      } else if (error.code === 'REQUEST_PENDING' || error.code === -32002) {
        toast.error('Connection request already pending. Please check your MetaMask extension.')
      } else if (error.message?.includes('User rejected')) {
        toast.error('Please approve the wallet signature to authenticate')
      } else if (error.message?.includes('install MetaMask')) {
        toast.error('Please install MetaMask or another Web3 wallet')
      } else {
        toast.error(error.message || 'Authentication failed. Please try again.')
      }
    } finally {
      setIsSigningIn(false)
    }
  }

  const handleWalletAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWalletAddress(e.target.value)
  }

  // Show loading spinner while initializing
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          
          {/* Header */}
          <div>
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-2xl font-bold text-white">F</span>
              </div>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Fluxion System Admin
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              System administrator access required
            </p>
            
            {/* Warning Box */}
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="text-center">
                <p className="text-sm font-medium text-amber-800">
                  🔒 Restricted Access Area
                </p>
                <p className="text-xs text-amber-700 mt-1">
                  This admin panel requires system-level privileges. Only users with super_admin, admin, or support roles can access this area.
                </p>
              </div>
            </div>
          </div>
          
          {/* Login Form */}
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="wallet-address" className="block text-sm font-medium text-gray-700 mb-2">
                Wallet Address
              </label>
              <div className="relative">
                <input
                  id="wallet-address"
                  name="wallet-address"
                  type="text"
                  value={walletAddress}
                  onChange={handleWalletAddressChange}
                  className="appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="0x..."
                  disabled={isConnecting || isSigningIn}
                />
                <button
                  type="button"
                  onClick={connectWallet}
                  disabled={isConnecting || isSigningIn}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-medium rounded transition-colors disabled:opacity-50"
                >
                  {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
              </div>
              
              {/* Account Selector */}
              <div className="mt-2">
                <WalletAccountSelector 
                  onAccountSelect={setWalletAddress}
                  selectedAddress={walletAddress}
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={!walletAddress || isConnecting || isSigningIn}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSigningIn ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Authenticating...
                  </>
                ) : (
                  'Sign In with Wallet'
                )}
              </button>
            </div>

            {/* Required Roles Display */}
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-2">Required system roles:</p>
              <div className="flex justify-center space-x-2">
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">super_admin</span>
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">admin</span>
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">support</span>
              </div>
            </div>
          </form>

          {/* Test Credentials Info */}
          <div className="mt-6 border-t border-gray-200 pt-6">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-center">
                <p className="text-sm font-medium text-blue-800 mb-2">Test Wallet</p>
                <p className="text-xs text-blue-700 font-mono break-all">
                  0xeDeF23d5ee863a34df67E345C64E99d52B07421D
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  This wallet has super_admin privileges for testing
                </p>
              </div>
            </div>
          </div>

          {/* Supported Wallets */}
          <div className="text-center space-y-2">
            <p className="text-sm font-medium text-gray-700">Supported Wallets</p>
            <div className="flex justify-center space-x-4">
              <div className="flex items-center space-x-2 text-xs text-gray-600">
                <div className="w-4 h-4 bg-orange-500 rounded"></div>
                <span>MetaMask</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-gray-600">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span>WalletConnect</span>
              </div>
              <div className="flex items-center space-x-2 text-xs text-gray-600">
                <div className="w-4 h-4 bg-purple-500 rounded"></div>
                <span>Coinbase</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <Toaster position="top-right" />
    </>
  )
}