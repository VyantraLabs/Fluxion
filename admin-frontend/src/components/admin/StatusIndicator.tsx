'use client'

import React from 'react'
import clsx from 'clsx'
import { 
  CheckCircleIcon, 
  ExclamationCircleIcon, 
  ExclamationTriangleIcon,
  InformationCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline'

export type StatusType = 'success' | 'error' | 'warning' | 'info' | 'pending' | 'neutral'

interface StatusIndicatorProps {
  status: StatusType
  message: string
  size?: 'sm' | 'md' | 'lg'
  showIcon?: boolean
  className?: string
}

const STATUS_CONFIG = {
  success: {
    icon: CheckCircleIcon,
    colors: 'text-green-700 bg-green-50 border-green-200',
    iconColor: 'text-green-600'
  },
  error: {
    icon: ExclamationCircleIcon,
    colors: 'text-red-700 bg-red-50 border-red-200',
    iconColor: 'text-red-600'
  },
  warning: {
    icon: ExclamationTriangleIcon,
    colors: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    iconColor: 'text-yellow-600'
  },
  info: {
    icon: InformationCircleIcon,
    colors: 'text-blue-700 bg-blue-50 border-blue-200',
    iconColor: 'text-blue-600'
  },
  pending: {
    icon: ClockIcon,
    colors: 'text-gray-700 bg-gray-50 border-gray-200',
    iconColor: 'text-gray-600'
  },
  neutral: {
    icon: InformationCircleIcon,
    colors: 'text-gray-700 bg-gray-50 border-gray-200',
    iconColor: 'text-gray-600'
  }
}

const SIZE_CONFIG = {
  sm: {
    padding: 'px-3 py-2',
    text: 'text-sm',
    iconSize: 'h-4 w-4'
  },
  md: {
    padding: 'px-4 py-3',
    text: 'text-sm',
    iconSize: 'h-5 w-5'
  },
  lg: {
    padding: 'px-6 py-4',
    text: 'text-base',
    iconSize: 'h-6 w-6'
  }
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  message,
  size = 'md',
  showIcon = true,
  className = ''
}) => {
  const config = STATUS_CONFIG[status]
  const sizeConfig = SIZE_CONFIG[size]
  const IconComponent = config.icon

  return (
    <div
      className={clsx(
        'border rounded-md flex items-center',
        config.colors,
        sizeConfig.padding,
        className
      )}
    >
      {showIcon && (
        <div className="flex-shrink-0 mr-3">
          <IconComponent className={clsx(sizeConfig.iconSize, config.iconColor)} />
        </div>
      )}
      <div className={clsx('flex-1', sizeConfig.text)}>
        {message}
      </div>
    </div>
  )
}

interface StatusBadgeProps {
  status: StatusType
  text: string
  size?: 'sm' | 'md'
  className?: string
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  text,
  size = 'sm',
  className = ''
}) => {
  const config = STATUS_CONFIG[status]
  
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm'
  }

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full font-medium',
        config.colors.replace('border-', 'ring-1 ring-'),
        sizeClasses[size],
        className
      )}
    >
      {text}
    </span>
  )
}

interface SystemHealthProps {
  services: Array<{
    name: string
    status: 'healthy' | 'degraded' | 'down'
    message?: string
    lastChecked?: string
  }>
  className?: string
}

export const SystemHealth: React.FC<SystemHealthProps> = ({
  services,
  className = ''
}) => {
  const getOverallStatus = (): StatusType => {
    const hasDown = services.some(s => s.status === 'down')
    const hasDegraded = services.some(s => s.status === 'degraded')
    
    if (hasDown) return 'error'
    if (hasDegraded) return 'warning'
    return 'success'
  }

  const overallStatus = getOverallStatus()
  const healthyCount = services.filter(s => s.status === 'healthy').length

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Overall Status */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">System Health</h3>
        <StatusBadge
          status={overallStatus}
          text={overallStatus === 'success' ? 'All Systems Operational' : 'Service Issues Detected'}
          size="md"
        />
      </div>

      {/* Service List */}
      <div className="space-y-2">
        {services.map((service) => {
          const serviceStatus: StatusType = service.status === 'healthy' ? 'success' : 
                                          service.status === 'degraded' ? 'warning' : 'error'
          
          return (
            <div key={service.name} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-md">
              <div className="flex items-center space-x-3">
                <span className="font-medium text-gray-900">{service.name}</span>
                {service.message && (
                  <span className="text-sm text-gray-600">{service.message}</span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                {service.lastChecked && (
                  <span className="text-xs text-gray-500">
                    {new Date(service.lastChecked).toLocaleTimeString()}
                  </span>
                )}
                <StatusBadge
                  status={serviceStatus}
                  text={service.status.charAt(0).toUpperCase() + service.status.slice(1)}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary */}
      <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
        {healthyCount}/{services.length} services are healthy
      </div>
    </div>
  )
}

export default StatusIndicator