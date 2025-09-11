'use client'

import React from 'react'
import { useAdminAuth } from '@/contexts/AdminAuthContext'
import { AdminPermission } from '@/types/admin'
import { hasPermission } from '@/utils/permissions'

interface PermissionGuardProps {
  permission: AdminPermission
  children: React.ReactNode
  fallback?: React.ReactNode
  require?: 'admin' | 'super_admin'
}

export function PermissionGuard({ 
  permission, 
  children, 
  fallback = null,
  require 
}: PermissionGuardProps) {
  const { user, isAdmin, isSuperAdmin } = useAdminAuth()

  // Check base requirements first
  if (require === 'super_admin' && !isSuperAdmin) {
    return <>{fallback}</>
  }

  if (require === 'admin' && !isAdmin) {
    return <>{fallback}</>
  }

  // Check specific permission
  if (!hasPermission(user, permission)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

// Hook version for conditional rendering
export function usePermission(permission: AdminPermission): boolean {
  const { user } = useAdminAuth()
  return hasPermission(user, permission)
}