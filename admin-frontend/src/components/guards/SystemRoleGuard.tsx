'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/contexts/AdminAuthContext'
import { ErrorBoundary } from '../errors/ErrorBoundary'

interface SystemRoleGuardProps {
  children: React.ReactNode
  roles?: string[]  // Accept both 'roles' and 'requiredRoles'
  permissions?: string[]  // Accept permissions as well
  requiredRoles?: string[]  // Simple array of role strings
  fallbackUrl?: string
  showError?: boolean
}

export function SystemRoleGuard({ 
  children, 
  roles,
  permissions,
  requiredRoles = [], 
  fallbackUrl = '/unauthorized',
  showError = true
}: SystemRoleGuardProps) {
  // Use roles prop or requiredRoles prop
  const rolesToCheck = roles || requiredRoles
  const { user, isLoading, isAuthenticated, hasSystemAccess, systemRoles } = useAdminAuth()
  const router = useRouter()

  // Show loading state while authentication is being checked
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Verifying system access...</p>
        </div>
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated || !user) {
    console.log('❌ SystemRoleGuard: User not authenticated, redirecting to login')
    if (typeof window !== 'undefined') {
      router.push('/login')
    }
    return null
  }

  // Check if user has any system access
  if (!hasSystemAccess) {
    console.log('❌ SystemRoleGuard: User has no system access')
    if (showError) {
      return <SystemAccessDenied reason="no_system_access" userRoles={systemRoles} />
    }
    if (typeof window !== 'undefined') {
      router.push(fallbackUrl)
    }
    return null
  }

  // Check specific role requirements (if any specified)
  if (rolesToCheck.length > 0) {
    const hasRequiredRole = rolesToCheck.some(role => systemRoles.includes(role))
    
    if (!hasRequiredRole) {
      console.log('❌ SystemRoleGuard: User lacks required role:', {
        userRoles: systemRoles,
        requiredRoles: rolesToCheck
      })
      if (showError) {
        return <SystemAccessDenied reason="insufficient_role" requiredRoles={rolesToCheck} userRoles={systemRoles} />
      }
      if (typeof window !== 'undefined') {
        router.push(fallbackUrl)
      }
      return null
    }
  }

  console.log('✅ SystemRoleGuard: Access granted', {
    userRoles: systemRoles,
    requiredRoles: rolesToCheck.length > 0 ? rolesToCheck : 'any system role'
  })

  // All checks passed, render children with error boundary
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  )
}

interface SystemAccessDeniedProps {
  reason: 'no_system_access' | 'insufficient_role'
  requiredRoles?: string[]
  userRoles: string[]
}

function SystemAccessDenied({ reason, requiredRoles = [], userRoles }: SystemAccessDeniedProps) {
  const { user, logout } = useAdminAuth()
  const router = useRouter()

  const getMessage = () => {
    switch (reason) {
      case 'no_system_access':
        return 'Access denied: You do not have system administrator privileges'
      case 'insufficient_role':
        return 'Access denied: You do not have the required role for this area'
      default:
        return 'Access denied: You do not have permission to access this area'
    }
  }

  const getDetails = () => {
    if (requiredRoles.length > 0) {
      return `Required role(s): ${requiredRoles.join(', ')}`
    }
    return 'System administrator privileges required'
  }

  const handleGoBack = () => {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push('/dashboard')
    }
  }

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          {/* Warning Icon */}
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" 
              />
            </svg>
          </div>

          {/* Title */}
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Access Restricted
          </h2>

          {/* Main Message */}
          <p className="mt-4 text-sm text-gray-600">
            {getMessage()}
          </p>

          {/* Details */}
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800">
              {getDetails()}
            </p>
          </div>

          {/* User Info */}
          {user && (
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
              <p className="text-xs text-gray-600">
                Current user: <span className="font-mono">{user.wallet_address}</span>
              </p>
              {userRoles.length > 0 ? (
                <p className="text-xs text-gray-600 mt-1">
                  Your roles: <span className="font-medium">{userRoles.join(', ')}</span>
                </p>
              ) : (
                <p className="text-xs text-red-600 mt-1">
                  No system roles assigned
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-8 space-y-3">
            <button
              onClick={handleGoBack}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Go Back
            </button>
            
            <button
              onClick={handleLogout}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Switch Account
            </button>
          </div>

          {/* Help Text */}
          <p className="mt-6 text-xs text-gray-500">
            If you believe this is an error, please contact your system administrator.
          </p>
        </div>
      </div>
    </div>
  )
}

export default SystemRoleGuard