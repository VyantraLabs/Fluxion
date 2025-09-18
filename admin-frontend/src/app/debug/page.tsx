'use client'

import React from 'react'
import { useAdminAuth } from '@/contexts/AdminAuthContext'
import { adminApi } from '@/services/adminApi'

export default function DebugPage() {
  const { 
    user, 
    isAuthenticated, 
    isLoading, 
    hasSystemAccess, 
    systemRoles,
    isSuperAdmin,
    isAdmin,
    isSupport
  } = useAdminAuth()

  const [debugInfo, setDebugInfo] = React.useState<any>(null)
  const [isLoadingDebug, setIsLoadingDebug] = React.useState(false)

  const handleDebugCurrentUser = async () => {
    setIsLoadingDebug(true)
    try {
      const result = await adminApi.debugCurrentUser()
      setDebugInfo(result)
      console.log('Debug result:', result)
    } catch (error) {
      console.error('Debug error:', error)
      setDebugInfo({ error: error instanceof Error ? error.message : String(error) })
    } finally {
      setIsLoadingDebug(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4">Loading authentication state...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow px-6 py-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-8">Admin Auth Debug</h1>

          {/* Authentication State */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Authentication State</h2>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Is Loading:</span>
                  <span className={`ml-2 ${isLoading ? 'text-yellow-600' : 'text-green-600'}`}>
                    {isLoading ? 'Yes' : 'No'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Is Authenticated:</span>
                  <span className={`ml-2 ${isAuthenticated ? 'text-green-600' : 'text-red-600'}`}>
                    {isAuthenticated ? 'Yes' : 'No'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Has System Access:</span>
                  <span className={`ml-2 ${hasSystemAccess ? 'text-green-600' : 'text-red-600'}`}>
                    {hasSystemAccess ? 'Yes' : 'No'}
                  </span>
                </div>
                <div>
                  <span className="font-medium">System Roles Count:</span>
                  <span className="ml-2 text-blue-600">{systemRoles?.length || 0}</span>
                </div>
              </div>
            </div>
          </div>

          {/* User Information */}
          {user && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">User Information</h2>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">User ID:</span>
                    <span className="ml-2 font-mono text-blue-700">{user.id}</span>
                  </div>
                  <div>
                    <span className="font-medium">Wallet Address:</span>
                    <span className="ml-2 font-mono text-blue-700">{user.wallet_address}</span>
                  </div>
                  <div>
                    <span className="font-medium">Name:</span>
                    <span className="ml-2">{user.name || 'Not set'}</span>
                  </div>
                  <div>
                    <span className="font-medium">Email:</span>
                    <span className="ml-2">{user.email || 'Not set'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Roles Information */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Role Information</h2>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="space-y-3 text-sm">
                <div>
                  <span className="font-medium">System Roles:</span>
                  <div className="mt-1">
                    {systemRoles && systemRoles.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {systemRoles.map(role => (
                          <span key={role} className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                            {role}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-red-600">No system roles</span>
                    )}
                  </div>
                </div>

                <div>
                  <span className="font-medium">Role Flags:</span>
                  <div className="mt-1 grid grid-cols-3 gap-2">
                    <div className={`px-2 py-1 rounded text-xs ${isSuperAdmin ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                      Super Admin: {isSuperAdmin ? 'Yes' : 'No'}
                    </div>
                    <div className={`px-2 py-1 rounded text-xs ${isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                      Admin: {isAdmin ? 'Yes' : 'No'}
                    </div>
                    <div className={`px-2 py-1 rounded text-xs ${isSupport ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                      Support: {isSupport ? 'Yes' : 'No'}
                    </div>
                  </div>
                </div>

                {(user as any)?.organizationRoles && (user as any).organizationRoles.length > 0 && (
                  <div>
                    <span className="font-medium">Organization Roles:</span>
                    <div className="mt-1">
                      <div className="flex flex-wrap gap-2">
                        {(user as any).organizationRoles.map((role: string) => (
                          <span key={role} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                            {role}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Debug JWT Button */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">JWT Debug</h2>
            <button
              onClick={handleDebugCurrentUser}
              disabled={isLoadingDebug}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoadingDebug ? 'Loading...' : 'Debug JWT Token'}
            </button>

            {debugInfo && (
              <div className="mt-4 bg-gray-50 rounded-lg p-4">
                <pre className="text-xs overflow-x-auto">
                  {JSON.stringify(debugInfo, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <div className="border-t pt-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Navigation</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={() => window.location.href = '/login'}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
              >
                Login Page
              </button>
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Dashboard
              </button>
              <button
                onClick={() => window.location.href = '/unauthorized'}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Unauthorized
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Home
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}