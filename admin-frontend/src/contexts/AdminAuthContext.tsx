'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { adminAuthStorage, adminUserStorage, adminWalletStorage } from '@/utils/storage'

// Simple user interface matching backend response
interface SimpleAdminUser {
  id: string
  wallet_address: string
  name?: string
  email?: string
  systemRoles: string[]
  organizationRoles: string[]
  created_at: string
  updated_at: string
}

interface AdminAuthContextType {
  user: SimpleAdminUser | null
  isAuthenticated: boolean
  isLoading: boolean
  hasSystemAccess: boolean
  systemRoles: string[]
  login: (walletAddress: string) => Promise<void>
  logout: () => void
  isSuperAdmin: boolean
  isAdmin: boolean
  isSupport: boolean
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined)

interface AdminAuthProviderProps {
  children: React.ReactNode
}

// Simple JWT decoder with better error handling
const decodeJWT = (token: string) => {
  try {
    if (!token || typeof token !== 'string') {
      console.error('Invalid token provided to decodeJWT')
      return null
    }
    
    const parts = token.split('.')
    if (parts.length !== 3) {
      console.error('Malformed JWT token - invalid structure')
      return null
    }
    
    const payload = JSON.parse(atob(parts[1]))
    return payload
  } catch (error) {
    console.error('Error decoding JWT:', error)
    return null
  }
}

export function AdminAuthProvider({ children }: AdminAuthProviderProps) {
  const [user, setUser] = useState<SimpleAdminUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Simple derived properties with null safety
  const isAuthenticated = !!user
  const systemRoles: string[] = user?.systemRoles || []
  const hasSystemAccess = systemRoles.length > 0
  const isSuperAdmin = systemRoles.includes('super_admin')
  const isAdmin = systemRoles.includes('admin')
  const isSupport = systemRoles.includes('support')

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = async () => {
      console.log('🔄 Admin Auth: Initializing authentication...')
      
      try {
        const token = adminAuthStorage.getToken()
        const userData = adminUserStorage.getProfile()
        
        console.log('🔍 Admin Auth: Storage check:', {
          hasToken: !!token,
          hasUserData: !!userData
        })
        
        if (token && userData) {
          // Decode JWT to get fresh role information
          const jwtPayload = decodeJWT(token)
          console.log('🔍 Admin Auth: JWT payload:', jwtPayload)
          
          if (jwtPayload && jwtPayload.system_roles) {
            const enhancedUser: SimpleAdminUser = {
              ...userData,
              systemRoles: jwtPayload.system_roles || [],
              organizationRoles: jwtPayload.organization_roles || []
            }
            
            console.log('🔍 Admin Auth: Enhanced user:', {
              id: enhancedUser.id,
              wallet_address: enhancedUser.wallet_address,
              systemRoles: enhancedUser.systemRoles,
              organizationRoles: enhancedUser.organizationRoles
            })
            
            // Check if user has any system roles
            if (enhancedUser.systemRoles.length > 0) {
              setUser(enhancedUser)
              console.log('✅ Admin Auth: Authentication initialized successfully')
            } else {
              console.log('❌ Admin Auth: User has no system roles, clearing auth')
              adminAuthStorage.removeToken()
              adminUserStorage.removeProfile()
            }
          } else {
            console.log('❌ Admin Auth: Invalid token, clearing auth')
            adminAuthStorage.removeToken()
            adminUserStorage.removeProfile()
          }
        } else {
          console.log('🔍 Admin Auth: No stored authentication found')
        }
      } catch (error) {
        console.error('❌ Admin Auth: Error initializing auth:', error)
        adminAuthStorage.removeToken()
        adminUserStorage.removeProfile()
      } finally {
        setIsLoading(false)
        console.log('✅ Admin Auth: Initialization complete')
      }
    }

    initAuth()
  }, [])

  const login = useCallback(async (walletAddress: string) => {
    try {
      setIsLoading(true)
      console.log('🔄 Admin Auth: Starting login for wallet:', walletAddress)

      // Check if wallet is available
      if (typeof window.ethereum === 'undefined') {
        throw new Error('Please install MetaMask or another Web3 wallet')
      }

      // Request account access
      console.log('🔄 Admin Auth: Requesting account access...')
      await window.ethereum.request({ method: 'eth_requestAccounts' })
      
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      
      // Verify wallet address matches
      const signerAddress = await signer.getAddress()
      console.log('🔍 Admin Auth: Signer address:', signerAddress)
      if (signerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        throw new Error('Wallet address mismatch')
      }

      // Step 1: Get message to sign from admin endpoint
      console.log('🔄 Admin Auth: Getting auth message...')
      const messageResponse = await fetch('http://localhost:3000/admin/auth/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ wallet_address: walletAddress }),
      })
      
      if (!messageResponse.ok) {
        const errorData = await messageResponse.json().catch(() => ({}))
        throw new Error(errorData.error?.message || 'Failed to get authentication message')
      }

      const messageData = await messageResponse.json()
      console.log('🔍 Admin Auth: Message response:', messageData)
      
      if (!messageData.success || !messageData.data?.message) {
        throw new Error('Failed to get authentication message')
      }

      const message = messageData.data.message

      // Step 2: Sign the message
      console.log('🔄 Admin Auth: Signing message...')
      const signature = await signer.signMessage(message)
      console.log('🔍 Admin Auth: Message signed successfully')

      // Step 3: Verify signature with admin endpoint
      console.log('🔄 Admin Auth: Verifying signature...')
      const verifyResponse = await fetch('http://localhost:3000/admin/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wallet_address: walletAddress,
          signature,
          message
        }),
      })
      
      if (!verifyResponse.ok) {
        const errorData = await verifyResponse.json().catch(() => ({}))
        throw new Error(errorData.error?.message || 'Authentication failed')
      }

      const verifyData = await verifyResponse.json()
      console.log('🔍 Admin Auth: Verify response:', verifyData)
      
      if (!verifyData.success || !verifyData.data?.token || !verifyData.data?.user) {
        throw new Error('Authentication failed - invalid response')
      }

      const { token, user: authenticatedUser } = verifyData.data
      console.log('🔍 Admin Auth: Authenticated user from backend:', authenticatedUser)

      // Decode JWT to get role information
      const jwtPayload = decodeJWT(token)
      console.log('🔍 Admin Auth: JWT payload:', jwtPayload)

      if (!jwtPayload) {
        console.error('❌ Admin Auth: Failed to decode JWT token')
        throw new Error('Invalid authentication token')
      }

      // Validate that JWT has the required system roles property
      if (!jwtPayload.system_roles) {
        console.error('❌ Admin Auth: JWT payload missing system_roles property:', jwtPayload)
        throw new Error('Invalid authentication token: missing system roles')
      }

      // Create simplified user object
      const simpleUser: SimpleAdminUser = {
        id: authenticatedUser.id,
        wallet_address: authenticatedUser.wallet_address,
        name: authenticatedUser.name,
        email: authenticatedUser.email,
        systemRoles: jwtPayload.system_roles || [],
        organizationRoles: jwtPayload.organization_roles || [],
        created_at: authenticatedUser.created_at,
        updated_at: authenticatedUser.updated_at
      }

      console.log('🔍 Admin Auth: Simple user object:', simpleUser)

      // Check if user has system access
      const hasValidSystemRoles = simpleUser.systemRoles && simpleUser.systemRoles.length > 0
      console.log('🔍 Admin Auth: System roles check:', {
        systemRoles: simpleUser.systemRoles,
        hasValidSystemRoles
      })

      if (!hasValidSystemRoles) {
        console.error('❌ Admin Auth: Access denied - no system roles found')
        throw new Error('Access denied: System administrator privileges required')
      }

      // Store auth data
      console.log('🔄 Admin Auth: Storing auth data...')
      const tokenExpiresInMs = 24 * 60 * 60 * 1000 // 24 hours
      
      adminAuthStorage.setToken(token, tokenExpiresInMs)
      adminUserStorage.setProfile(simpleUser)
      adminWalletStorage.setAddress(walletAddress)
      
      // Set user state
      setUser(simpleUser)
      
      console.log('✅ Admin Auth: Login completed successfully!')
      console.log('✅ Admin Auth: User roles:', simpleUser.systemRoles)
      
    } catch (error) {
      console.error('❌ Admin Auth: Login error:', error)
      throw error
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    console.log('🔄 Admin Auth: Logging out...')
    
    // Clear all stored data
    adminAuthStorage.removeToken()
    adminUserStorage.removeProfile()
    adminWalletStorage.removeAddress()
    
    // Reset state
    setUser(null)
    
    console.log('✅ Admin Auth: Logout completed')
  }, [])

  const value: AdminAuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    hasSystemAccess,
    systemRoles,
    login,
    logout,
    isSuperAdmin,
    isAdmin,
    isSupport
  }

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth(): AdminAuthContextType {
  const context = useContext(AdminAuthContext)
  if (context === undefined) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider')
  }
  return context
}

// Extend Window interface for TypeScript
declare global {
  interface Window {
    ethereum?: any
  }
}