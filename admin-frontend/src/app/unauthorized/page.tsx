'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/contexts/AdminAuthContext'
import { adminAuthStorage, adminUserStorage } from '@/utils/storage'
import { getSystemRoleDisplayName, hasSystemAccess } from '@/utils/systemRoles'

export default function UnauthorizedPage() {
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAdminAuth()

  // Debug information for development
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Unauthorized Page Debug:', {
        isAuthenticated,
        user: user ? {
          id: user.id,
          wallet_address: user.wallet_address,
          system_roles: (user as any).system_roles,
          organization_roles: (user as any).organization_roles
        } : null,
        storedToken: !!adminAuthStorage.getToken(),
        storedUser: !!adminUserStorage.getProfile()
      })
    }
  }, [isAuthenticated, user])

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-red-100 rounded-lg flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.502 0L4.312 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            System Access Restricted
          </h2>
          
          {isAuthenticated && user ? (
            <div className="mt-4 space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800 font-medium mb-2">
                  🚫 System Administrator Privileges Required
                </p>
                <p className="text-sm text-red-700">
                  This admin panel is restricted to authorized system administrators only. 
                  Regular users and organization administrators cannot access this area.
                </p>
              </div>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-600 font-medium mb-2">Current Account:</p>
                <div className="text-xs text-gray-600 space-y-1">
                  <p><span className="font-medium">Wallet:</span> {user.wallet_address}</p>
                  <p><span className="font-medium">System Access:</span> {hasSystemAccess(user) ? 'Yes' : 'No'}</p>
                  {(user as any).system_roles && (user as any).system_roles.length > 0 ? (
                    <p><span className="font-medium">System Roles:</span> {(user as any).system_roles.map((role: string) => getSystemRoleDisplayName(role)).join(', ')}</p>
                  ) : (
                    <p><span className="font-medium">System Roles:</span> None</p>
                  )}
                  {(user as any).organization_roles && (user as any).organization_roles.length > 0 ? (
                    <p><span className="font-medium">Organization Roles:</span> {(user as any).organization_roles.join(', ')}</p>
                  ) : (
                    <p><span className="font-medium">Organization Roles:</span> None</p>
                  )}
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800 font-medium mb-2">Required System Roles:</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">Super Administrator</span>
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">System Administrator</span>
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">Support Specialist</span>
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">Content Moderator</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-600">
              Please sign in with a system administrator account to access this panel.
            </p>
          )}
        </div>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            This system admin panel requires special system-level privileges that are different from organization-level admin access. 
            Please contact your platform administrator if you believe you should have access.
          </p>
          
          <div className="space-y-2">
            {isAuthenticated ? (
              <>
                <Link
                  href="/login"
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Try System Admin Account
                </Link>
                
                <button
                  onClick={handleLogout}
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Logout
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Sign In as System Admin
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}