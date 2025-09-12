'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'
import { adminAuthStorage, adminUserStorage, adminWalletStorage } from '@/utils/storage'

// Simple user interface matching new backend response (single role)
interface SimpleAdminUser {
  id: string
  wallet_address: string
  name?: string
  email?: string
  role: string  // Single role from backend
  created_at: string
  updated_at: string
}

interface AdminAuthContextType {
  user: SimpleAdminUser | null
  isAuthenticated: boolean
  isLoading: boolean
  hasSystemAccess: boolean
  role: string | null  // Single role instead of array
  systemRoles: string[]  // Array for backwards compatibility with existing components
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

  // Simple derived properties with null safety for single role
  const isAuthenticated = !!user
  const role: string | null = user?.role || null
  const systemRoles: string[] = role ? [role] : []  // Convert single role to array for backwards compatibility
  const hasSystemAccess = !!role
  const isSuperAdmin = role === 'super_admin'
  const isAdmin = role === 'admin'
  const isSupport = role === 'support'

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
          
          if (jwtPayload && jwtPayload.role) {
            const enhancedUser: SimpleAdminUser = {
              ...userData,
              role: jwtPayload.role  // Single role from JWT
            }
            
            console.log('🔍 Admin Auth: Enhanced user with single role:', {
              id: enhancedUser.id,
              wallet_address: enhancedUser.wallet_address,
              role: enhancedUser.role
            })
            
            // Check if user has a valid system role
            if (enhancedUser.role && ['super_admin', 'admin', 'support'].includes(enhancedUser.role)) {
              setUser(enhancedUser)
              console.log('✅ Admin Auth: Authentication initialized successfully with role:', enhancedUser.role)
            } else {
              console.log('❌ Admin Auth: Invalid system role, clearing auth:', enhancedUser.role)
              adminAuthStorage.removeToken()
              adminUserStorage.removeProfile()
            }
          } else {
            console.log('❌ Admin Auth: No role in JWT token, clearing auth')
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

      // Use chain-agnostic wallet connection with ethers and target address
      const { connectWallet, signMessage } = await import('@/utils/walletConnection')
      
      console.log('🔄 Admin Auth: Connecting to specific wallet address:', walletAddress)
      const connection = await connectWallet(walletAddress)
      
      console.log(`✅ Admin Auth: Connected on ${connection.chainName} (Chain ID: ${connection.chainId})`)

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

      // Step 2: Sign the message using ethers
      console.log('🔄 Admin Auth: Signing message...')
      const signature = await signMessage(message, connection.signer)
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

      // Validate that JWT has the required role property
      if (!jwtPayload.role) {
        console.error('❌ Admin Auth: JWT payload missing role property:', jwtPayload)
        throw new Error('Invalid authentication token: missing role')
      }

      // Create simplified user object with single role
      const simpleUser: SimpleAdminUser = {
        id: authenticatedUser.id,
        wallet_address: authenticatedUser.wallet_address,
        name: authenticatedUser.name,
        email: authenticatedUser.email,
        role: jwtPayload.role,  // Single role from JWT
        created_at: authenticatedUser.created_at,
        updated_at: authenticatedUser.updated_at
      }

      console.log('🔍 Admin Auth: Simple user object with single role:', simpleUser)

      // Check if user has valid system access
      const hasValidSystemRole = simpleUser.role && ['super_admin', 'admin', 'support'].includes(simpleUser.role)
      console.log('🔍 Admin Auth: Single role check:', {
        role: simpleUser.role,
        hasValidSystemRole
      })

      if (!hasValidSystemRole) {
        console.error('❌ Admin Auth: Access denied - invalid system role:', simpleUser.role)
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
      console.log('✅ Admin Auth: User role:', simpleUser.role)
      
    } catch (error: any) {
      console.error('❌ Admin Auth: Login error:', error)
      
      // Handle specific wallet connection errors
      if (error.code === 4001) {
        console.debug('💡 Admin Auth: User rejected the connection request')
        const userError = new Error('Connection cancelled by user')
        ;(userError as any).code = 'USER_REJECTED'
        throw userError
      } else if (error.code === -32002) {
        console.debug('💡 Admin Auth: Request already pending')
        const pendingError = new Error('Connection request already pending. Please check your MetaMask extension.')
        ;(pendingError as any).code = 'REQUEST_PENDING'
        throw pendingError
      }
      
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
    role,  // Single role instead of array
    systemRoles,  // Array for backwards compatibility
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