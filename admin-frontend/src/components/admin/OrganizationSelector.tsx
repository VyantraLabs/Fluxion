'use client'

import React, { useState, useEffect } from 'react'
import { ChevronDownIcon, BuildingOfficeIcon, CheckIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'

export interface Organization {
  id: string
  name: string
  slug: string
  role: string
  userCount: number
  canManageUsers: boolean
  isActive: boolean
}

interface OrganizationSelectorProps {
  organizations: Organization[]
  selectedOrganizationId: string | null
  onOrganizationChange: (organizationId: string) => void
  loading?: boolean
  error?: string | null
  className?: string
}

export function OrganizationSelector({
  organizations,
  selectedOrganizationId,
  onOrganizationChange,
  loading = false,
  error = null,
  className = ''
}: OrganizationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Get the selected organization details
  const selectedOrganization = organizations.find(org => org.id === selectedOrganizationId)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (!target.closest('.organization-selector')) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const formatRole = (role: string) => {
    switch (role) {
      case 'system_admin':
        return 'System Admin'
      case 'super_admin':
        return 'Super Admin'
      case 'owner':
        return 'Owner'
      case 'admin':
        return 'Admin'
      default:
        return role.charAt(0).toUpperCase() + role.slice(1)
    }
  }

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'system_admin':
      case 'super_admin':
        return 'bg-red-100 text-red-800'
      case 'owner':
        return 'bg-purple-100 text-purple-800'
      case 'admin':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (error) {
    return (
      <div className={clsx('rounded-md border border-red-200 bg-red-50 p-3', className)}>
        <div className="flex items-center">
          <BuildingOfficeIcon className="h-4 w-4 text-red-400 mr-2" />
          <span className="text-sm text-red-800">Failed to load organizations</span>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className={clsx('rounded-md border border-gray-200 bg-gray-50 p-3', className)}>
        <div className="flex items-center">
          <BuildingOfficeIcon className="h-4 w-4 text-gray-400 mr-2" />
          <span className="text-sm text-gray-600">Loading organizations...</span>
          <div className="ml-auto">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
          </div>
        </div>
      </div>
    )
  }

  if (organizations.length === 0) {
    return (
      <div className={clsx('rounded-md border border-gray-200 bg-gray-50 p-3', className)}>
        <div className="flex items-center">
          <BuildingOfficeIcon className="h-4 w-4 text-gray-400 mr-2" />
          <span className="text-sm text-gray-600">No organizations available</span>
        </div>
      </div>
    )
  }

  // If only one organization, show it without dropdown
  if (organizations.length === 1) {
    const org = organizations[0]
    return (
      <div className={clsx('rounded-md border border-gray-200 bg-white p-3', className)}>
        <div className="flex items-center">
          <BuildingOfficeIcon className="h-4 w-4 text-gray-500 mr-2" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900 truncate">
                {org.name}
              </span>
              <span className={clsx(
                'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                getRoleBadgeClass(org.role)
              )}>
                {formatRole(org.role)}
              </span>
            </div>
            <div className="text-xs text-gray-500">
              {org.userCount} user{org.userCount !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={clsx('organization-selector relative', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-full rounded-md border border-gray-200 bg-white pl-3 pr-10 py-3 text-left cursor-pointer focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:text-sm hover:bg-gray-50"
      >
        <div className="flex items-center">
          <BuildingOfficeIcon className="h-4 w-4 text-gray-500 mr-2 flex-shrink-0" />
          
          {selectedOrganization ? (
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-900 truncate">
                  {selectedOrganization.name}
                </span>
                <span className={clsx(
                  'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                  getRoleBadgeClass(selectedOrganization.role)
                )}>
                  {formatRole(selectedOrganization.role)}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                {selectedOrganization.userCount} user{selectedOrganization.userCount !== 1 ? 's' : ''}
              </div>
            </div>
          ) : (
            <span className="text-sm text-gray-500">Select an organization</span>
          )}
        </div>
        
        <span className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <ChevronDownIcon
            className={clsx(
              'h-4 w-4 text-gray-400 transition-transform duration-150',
              isOpen && 'transform rotate-180'
            )}
          />
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
          {organizations.map((org) => (
            <button
              key={org.id}
              type="button"
              onClick={() => {
                onOrganizationChange(org.id)
                setIsOpen(false)
              }}
              className={clsx(
                'relative cursor-pointer select-none py-2 pl-3 pr-9 w-full text-left hover:bg-blue-50 focus:bg-blue-50',
                selectedOrganizationId === org.id 
                  ? 'bg-blue-50 text-blue-900' 
                  : 'text-gray-900'
              )}
            >
              <div className="flex items-center">
                <BuildingOfficeIcon className="h-4 w-4 text-gray-400 mr-2 flex-shrink-0" />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className={clsx(
                      'text-sm font-medium truncate',
                      selectedOrganizationId === org.id ? 'text-blue-900' : 'text-gray-900'
                    )}>
                      {org.name}
                    </span>
                    <span className={clsx(
                      'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium',
                      getRoleBadgeClass(org.role)
                    )}>
                      {formatRole(org.role)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {org.userCount} user{org.userCount !== 1 ? 's' : ''} • {org.slug}
                  </div>
                </div>
              </div>

              {selectedOrganizationId === org.id && (
                <span className="absolute inset-y-0 right-0 flex items-center pr-4">
                  <CheckIcon className="h-4 w-4 text-blue-600" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}