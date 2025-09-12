'use client'

import React, { useState, useEffect } from 'react'
import { adminApi } from '@/services/adminApi'
import { RoleBadge } from './RoleBadge'
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'
import toast from 'react-hot-toast'
import clsx from 'clsx'

interface UserRole {
  id: string
  name: string
  type: 'system' | 'organization'
  description?: string
}

interface RoleManagerProps {
  userId: string
  organizationId?: string
  currentRoles: UserRole[]
  canModify: boolean
  onRoleChange: (newRoles: UserRole[]) => void
  className?: string
}

const AVAILABLE_ROLES = {
  system: [
    { name: 'super_admin', label: 'Super Admin', description: 'Full system access' },
    { name: 'admin', label: 'Admin', description: 'System administration' },
    { name: 'support', label: 'Support', description: 'Customer support access' },
    { name: 'moderator', label: 'Moderator', description: 'Content moderation' }
  ],
  organization: [
    { name: 'owner', label: 'Owner', description: 'Organization owner' },
    { name: 'organization_admin', label: 'Admin', description: 'Organization administration' },
    { name: 'organization_support', label: 'Support', description: 'Organization support' },
    { name: 'member', label: 'Member', description: 'Standard member access' },
    { name: 'viewer', label: 'Viewer', description: 'Read-only access' }
  ]
}

export const RoleManager: React.FC<RoleManagerProps> = ({
  userId,
  organizationId,
  currentRoles,
  canModify,
  onRoleChange,
  className = ''
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [selectedRoles, setSelectedRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setSelectedRoles(currentRoles.map(role => role.name))
  }, [currentRoles])

  const handleToggleRole = (roleName: string) => {
    if (!canModify) return

    setSelectedRoles(prev => 
      prev.includes(roleName)
        ? prev.filter(r => r !== roleName)
        : [...prev, roleName]
    )
  }

  const handleSave = async () => {
    if (!canModify) return

    setLoading(true)
    try {
      const response = await adminApi.updateUserRoles(userId, organizationId || '', selectedRoles)
      
      if (response.success) {
        // Transform response to match UserRole interface
        const updatedRoles: UserRole[] = selectedRoles.map(roleName => ({
          id: roleName,
          name: roleName,
          type: roleName.startsWith('organization') || ['owner', 'member', 'viewer'].includes(roleName) 
            ? 'organization' 
            : 'system',
          description: AVAILABLE_ROLES.system.find(r => r.name === roleName)?.description ||
                      AVAILABLE_ROLES.organization.find(r => r.name === roleName)?.description
        }))

        onRoleChange(updatedRoles)
        setIsEditing(false)
        toast.success('User roles updated successfully')
      } else {
        throw new Error(response.error?.message || 'Failed to update roles')
      }
    } catch (error) {
      console.error('Error updating user roles:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update roles')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setSelectedRoles(currentRoles.map(role => role.name))
    setIsEditing(false)
  }

  const getAvailableRoles = () => {
    if (organizationId) {
      return AVAILABLE_ROLES.organization
    }
    return [...AVAILABLE_ROLES.system, ...AVAILABLE_ROLES.organization]
  }

  return (
    <div className={clsx('space-y-4', className)}>
      {/* Current Roles Display */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-900">
            {organizationId ? 'Organization Roles' : 'User Roles'}
          </h4>
          {canModify && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Edit Roles
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {currentRoles.length > 0 ? (
            currentRoles.map((role) => (
              <RoleBadge
                key={role.id}
                role={role.name}
                type={role.type}
                showPrefix={!organizationId}
              />
            ))
          ) : (
            <span className="text-sm text-gray-500">No roles assigned</span>
          )}
        </div>
      </div>

      {/* Role Editor */}
      {isEditing && canModify && (
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <div className="flex items-center justify-between mb-3">
            <h5 className="text-sm font-medium text-gray-900">
              Edit Roles
            </h5>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCancel}
                disabled={loading}
                className="px-3 py-1.5 text-sm bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center"
              >
                {loading ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckIcon className="h-4 w-4 mr-1" />
                    Save
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {getAvailableRoles().map((role) => {
              const isSelected = selectedRoles.includes(role.name)
              return (
                <label
                  key={role.name}
                  className={clsx(
                    'flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors',
                    isSelected 
                      ? 'border-blue-200 bg-blue-50' 
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  )}
                >
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleRole(role.name)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">
                          {role.label}
                        </span>
                        <RoleBadge
                          role={role.name}
                          type={role.name.startsWith('organization') || ['owner', 'member', 'viewer'].includes(role.name) ? 'organization' : 'system'}
                          showPrefix={false}
                        />
                      </div>
                      {role.description && (
                        <p className="text-sm text-gray-500">{role.description}</p>
                      )}
                    </div>
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* Permissions Preview */}
      {!canModify && (
        <div className="text-sm text-gray-500 italic">
          You don't have permission to modify roles for this user
        </div>
      )}
    </div>
  )
}

export default RoleManager