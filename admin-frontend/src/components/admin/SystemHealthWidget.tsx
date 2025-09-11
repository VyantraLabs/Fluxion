'use client'

import React from 'react'
import clsx from 'clsx'
import { SystemHealth } from '@/types/admin'
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  XCircleIcon 
} from '@heroicons/react/24/solid'

interface SystemHealthWidgetProps {
  health: SystemHealth | null
  loading?: boolean
}

export function SystemHealthWidget({ health, loading }: SystemHealthWidgetProps) {
  if (loading || !health) {
    return (
      <div className="admin-card p-6 animate-pulse">
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-full"></div>
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'up':
        return 'text-green-600'
      case 'degraded':
        return 'text-yellow-600'
      case 'down':
      default:
        return 'text-red-600'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'up':
        return CheckCircleIcon
      case 'degraded':
        return ExclamationTriangleIcon
      case 'down':
      default:
        return XCircleIcon
    }
  }

  const getStatusBadge = (status: string) => {
    const baseClasses = 'inline-flex px-2 py-1 text-xs font-semibold rounded-full'
    
    switch (status) {
      case 'healthy':
      case 'up':
        return clsx(baseClasses, 'bg-green-100 text-green-800')
      case 'degraded':
        return clsx(baseClasses, 'bg-yellow-100 text-yellow-800')
      case 'down':
      default:
        return clsx(baseClasses, 'bg-red-100 text-red-800')
    }
  }

  const StatusIcon = getStatusIcon(health.status)

  return (
    <div className="admin-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">System Health</h3>
        <div className={getStatusBadge(health.status)}>
          {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
        </div>
      </div>

      <div className="flex items-center mb-4">
        <StatusIcon className={clsx('w-5 h-5 mr-2', getStatusColor(health.status))} />
        <span className="text-sm font-medium text-gray-700">
          Overall Status: {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
        </span>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-700 border-b border-gray-200 pb-1">
          Service Status
        </h4>
        
        {health.services && Object.entries(health.services).map(([serviceName, serviceHealth]) => {
          const ServiceStatusIcon = getStatusIcon(serviceHealth.status)
          
          return (
            <div key={serviceName} className="flex items-center justify-between">
              <div className="flex items-center">
                <ServiceStatusIcon 
                  className={clsx('w-4 h-4 mr-2', getStatusColor(serviceHealth.status))} 
                />
                <span className="text-sm text-gray-700 capitalize">
                  {serviceName}
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">
                  {serviceHealth.response_time}ms
                </span>
                <div className={getStatusBadge(serviceHealth.status)}>
                  {serviceHealth.status.toUpperCase()}
                </div>
              </div>
            </div>
          )
        })}
        
        {!health.services && (
          <div className="text-sm text-gray-500 italic">
            Service status unavailable
          </div>
        )}
        
        {health.services?.blockchain && (
          <div className="text-xs text-gray-500 mt-2">
            Networks connected: {health.services.blockchain.networks_connected || 0}
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Last checked: {new Date(health.last_checked).toLocaleString()}
        </p>
      </div>
    </div>
  )
}