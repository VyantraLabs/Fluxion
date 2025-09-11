'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '@/contexts/AdminAuthContext'
import { AdminPermission } from '@/types/admin'
import { hasPermission } from '@/utils/permissions'

interface AdminProtectedRouteProps {
  children: React.ReactNode
  requiredPermission?: AdminPermission
  requireSuperAdmin?: boolean
}

export function AdminProtectedRoute({ 
  children, 
  requiredPermission,
  requireSuperAdmin = false 
}: AdminProtectedRouteProps) {
  const { user, isAuthenticated, isLoading, isAdmin, isSuperAdmin } = useAdminAuth()
  const router = useRouter()

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
      return
    }

    if (!isLoading && isAuthenticated && !isAdmin) {
      // User is authenticated but not an admin
      router.push('/unauthorized')
      return
    }

    if (requireSuperAdmin && !isSuperAdmin) {
      router.push('/unauthorized')
      return
    }

    if (requiredPermission && !hasPermission(user, requiredPermission)) {
      router.push('/unauthorized')
      return
    }
  }, [
    isLoading, 
    isAuthenticated, 
    isAdmin, 
    isSuperAdmin, 
    user, 
    requiredPermission, 
    requireSuperAdmin, 
    router
  ])

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  // Show nothing if not authenticated or authorized
  if (!isAuthenticated || !isAdmin) {
    return null
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    return null
  }

  if (requiredPermission && !hasPermission(user, requiredPermission)) {
    return null
  }

  return <>{children}</>
}