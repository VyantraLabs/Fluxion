'use client'

import React from 'react'
import clsx from 'clsx'

interface StatisticsCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>
  trend?: {
    value: number
    label: string
    direction: 'up' | 'down' | 'neutral'
  }
  variant?: 'default' | 'success' | 'warning' | 'error'
  loading?: boolean
  className?: string
}

export function StatisticsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  loading = false,
  className,
}: StatisticsCardProps) {
  const variants = {
    default: 'bg-white border-gray-200',
    success: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    error: 'bg-red-50 border-red-200',
  }

  const iconColors = {
    default: 'text-gray-400',
    success: 'text-green-600',
    warning: 'text-yellow-600',
    error: 'text-red-600',
  }

  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600',
    neutral: 'text-gray-500',
  }

  if (loading) {
    return (
      <div className={clsx(
        'admin-card p-6 animate-pulse',
        className
      )}>
        <div className="flex items-center">
          <div className="flex-1">
            <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/3"></div>
          </div>
          <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    )
  }

  return (
    <div className={clsx(
      'admin-card p-6 border',
      variants[variant],
      className
    )}>
      <div className="flex items-center">
        <div className="flex-1">
          <div className="flex items-center">
            <p className="text-sm font-medium text-gray-600">{title}</p>
          </div>
          
          <div className="mt-2">
            <div className="flex items-baseline">
              <p className="text-2xl font-semibold text-gray-900">
                {typeof value === 'number' ? value.toLocaleString() : value}
              </p>
              
              {trend && (
                <p className={clsx(
                  'ml-2 flex items-baseline text-sm font-semibold',
                  trendColors[trend.direction]
                )}>
                  {trend.direction === 'up' && (
                    <svg className="w-3 h-3 mr-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  {trend.direction === 'down' && (
                    <svg className="w-3 h-3 mr-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  {trend.value}% {trend.label}
                </p>
              )}
            </div>
            
            {subtitle && (
              <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
        </div>

        {Icon && (
          <div className={clsx(
            'flex-shrink-0 p-3 rounded-lg',
            variant === 'default' ? 'bg-gray-100' :
            variant === 'success' ? 'bg-green-100' :
            variant === 'warning' ? 'bg-yellow-100' :
            'bg-red-100'
          )}>
            <Icon className={clsx('w-6 h-6', iconColors[variant])} />
          </div>
        )}
      </div>
    </div>
  )
}