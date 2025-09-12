'use client'

import React from 'react'
import clsx from 'clsx'

export type RoleType = 'system' | 'organization'
export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'

interface RoleBadgeProps {
  role: string
  type: RoleType
  variant?: BadgeVariant
  showPrefix?: boolean
  className?: string
}

const ROLE_CONFIG = {
  // System roles
  super_admin: {
    label: 'Super Admin',
    variant: 'error' as BadgeVariant,
    prefix: 'System'
  },
  admin: {
    label: 'Admin',
    variant: 'warning' as BadgeVariant,
    prefix: 'System'
  },
  support: {
    label: 'Support',
    variant: 'info' as BadgeVariant,
    prefix: 'System'
  },
  moderator: {
    label: 'Moderator',
    variant: 'secondary' as BadgeVariant,
    prefix: 'System'
  },
  
  // Organization roles
  owner: {
    label: 'Owner',
    variant: 'primary' as BadgeVariant,
    prefix: 'Org'
  },
  organization_admin: {
    label: 'Admin',
    variant: 'warning' as BadgeVariant,
    prefix: 'Org'
  },
  organization_support: {
    label: 'Support',
    variant: 'info' as BadgeVariant,
    prefix: 'Org'
  },
  member: {
    label: 'Member',
    variant: 'secondary' as BadgeVariant,
    prefix: 'Org'
  },
  viewer: {
    label: 'Viewer',
    variant: 'secondary' as BadgeVariant,
    prefix: 'Org'
  }
}

const VARIANT_CLASSES = {
  primary: 'bg-blue-100 text-blue-800 border-blue-200',
  secondary: 'bg-gray-100 text-gray-800 border-gray-200',
  success: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  error: 'bg-red-100 text-red-800 border-red-200',
  info: 'bg-cyan-100 text-cyan-800 border-cyan-200'
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({
  role,
  type,
  variant,
  showPrefix = true,
  className = ''
}) => {
  const config = ROLE_CONFIG[role as keyof typeof ROLE_CONFIG] || {
    label: role,
    variant: 'secondary' as BadgeVariant,
    prefix: type === 'system' ? 'System' : 'Org'
  }

  const finalVariant = variant || config.variant
  const variantClasses = VARIANT_CLASSES[finalVariant]

  return (
    <span
      className={clsx(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        variantClasses,
        className
      )}
      title={`${config.prefix} Role: ${config.label}`}
    >
      {showPrefix && (
        <span className="opacity-75 mr-1">
          {config.prefix}:
        </span>
      )}
      {config.label}
    </span>
  )
}

export default RoleBadge