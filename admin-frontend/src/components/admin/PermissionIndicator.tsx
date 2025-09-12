'use client'

import React, { useState } from 'react'
import { ShieldCheckIcon, ShieldExclamationIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

interface User {
  id: string
  name?: string
  email?: string
  wallet_address: string
  roles?: Array<{
    id: string
    name: string
    type: 'system' | 'organization'
  }>
}

interface PermissionIndicatorProps {
  user: User
  requiredRole: string | string[]
  showDetails?: boolean
  className?: string
}

const ROLE_HIERARCHY = {
  system: {
    super_admin: 100,
    admin: 80,
    support: 60,
    moderator: 40
  },
  organization: {
    owner: 90,
    organization_admin: 70,
    organization_support: 50,
    member: 30,
    viewer: 10
  }
}

const hasPermission = (userRoles: User['roles'] = [], requiredRole: string | string[]): boolean => {
  if (!userRoles || userRoles.length === 0) return false
  
  const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
  
  // Check if user has any of the required roles
  for (const role of userRoles) {
    if (requiredRoles.includes(role.name)) {
      return true
    }
    
    // Check role hierarchy - higher roles inherit lower role permissions
    const userRoleLevel = ROLE_HIERARCHY[role.type]?.[role.name as keyof typeof ROLE_HIERARCHY[typeof role.type]]
    
    for (const reqRole of requiredRoles) {
      // Determine type of required role
      const reqRoleType = Object.keys(ROLE_HIERARCHY.system).includes(reqRole) ? 'system' : 'organization'
      const reqRoleLevel = ROLE_HIERARCHY[reqRoleType]?.[reqRole as keyof typeof ROLE_HIERARCHY[typeof reqRoleType]]
      
      if (role.type === reqRoleType && userRoleLevel && reqRoleLevel && userRoleLevel >= reqRoleLevel) {
        return true
      }
    }
  }
  
  return false
}

export const PermissionIndicator: React.FC<PermissionIndicatorProps> = ({
  user,
  requiredRole,
  showDetails = false,
  className = ''
}) => {
  const [showTooltip, setShowTooltip] = useState(false)
  const hasAccess = hasPermission(user.roles, requiredRole)

  const requiredRolesList = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
  const userRoleNames = user.roles?.map(r => r.name) || []
  
  const getStatusColor = () => {
    if (hasAccess) {
      return 'text-green-600'
    } else {
      return 'text-red-600'
    }
  }

  const getStatusIcon = () => {
    if (hasAccess) {
      return <ShieldCheckIcon className="h-5 w-5" />
    } else {
      return <ShieldExclamationIcon className="h-5 w-5" />
    }
  }

  const getStatusText = () => {
    if (hasAccess) {
      return 'Has Access'
    } else {
      return 'No Access'
    }
  }

  return (
    <div className={clsx('flex items-center space-x-2', className)}>
      <div 
        className={clsx('flex items-center space-x-1', getStatusColor())}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {getStatusIcon()}
        <span className="text-sm font-medium">{getStatusText()}</span>
      </div>

      {showDetails && (
        <div className="text-xs text-gray-500">
          Required: {requiredRolesList.join(' or ')}
        </div>
      )}

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute z-10 px-3 py-2 text-sm bg-gray-900 text-white rounded-lg shadow-lg max-w-xs">
          <div className="space-y-2">
            <div>
              <strong>User:</strong> {user.name || user.wallet_address?.slice(0, 8) + '...'}
            </div>
            <div>
              <strong>Current Roles:</strong> {userRoleNames.join(', ') || 'None'}
            </div>
            <div>
              <strong>Required:</strong> {requiredRolesList.join(' or ')}
            </div>
            <div>
              <strong>Access:</strong> 
              <span className={hasAccess ? 'text-green-400 ml-1' : 'text-red-400 ml-1'}>
                {hasAccess ? 'Granted' : 'Denied'}
              </span>
            </div>
          </div>
        </div>
      )}

      {showDetails && (
        <button
          onClick={() => setShowTooltip(!showTooltip)}
          className="text-gray-400 hover:text-gray-600"
        >
          <InformationCircleIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export default PermissionIndicator