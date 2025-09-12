'use client';

import React, { useState } from 'react';
import {
  X,
  Mail,
  Calendar,
  Shield,
  ShieldCheck,
  User,
  Building2,
  Activity,
  Edit2,
  Trash2,
  Settings,
} from 'lucide-react';
import { OrganizationUser, Organization } from '@/types/user';
import { useOrganization, useUserPermissions } from '@/contexts/OrganizationContext';
import { UserRoleManager } from './UserRoleManager';
import { cn } from '@/utils/helpers';

interface UserDetailsModalProps {
  user: OrganizationUser | null;
  organization?: Organization;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (user: OrganizationUser) => void;
  onRemove?: (user: OrganizationUser) => void;
}

export const UserDetailsModal: React.FC<UserDetailsModalProps> = ({
  user,
  organization,
  isOpen,
  onClose,
  onEdit,
  onRemove,
}) => {
  const { state } = useOrganization();
  const permissions = useUserPermissions();
  const [showRoleManager, setShowRoleManager] = useState(false);

  if (!isOpen || !user) return null;

  const currentOrg = organization || state.activeOrganization;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoleBadge = (role: string, isSystemRole = false) => {
    const roleColors: Record<string, string> = {
      // System roles
      super_admin: 'bg-purple-100 text-purple-800',
      admin: 'bg-blue-100 text-blue-800',
      // Organization roles
      owner: 'bg-green-100 text-green-800',
      org_admin: 'bg-blue-100 text-blue-800',
      manager: 'bg-indigo-100 text-indigo-800',
      member: 'bg-gray-100 text-gray-800',
      viewer: 'bg-yellow-100 text-yellow-800',
      client: 'bg-pink-100 text-pink-800',
    };

    return (
      <span
        key={role}
        className={cn(
          'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
          roleColors[role] || 'bg-gray-100 text-gray-800'
        )}
      >
        {isSystemRole && <Shield className="w-3 h-3 mr-1" />}
        {role.replace('_', ' ').charAt(0).toUpperCase() + role.replace('_', ' ').slice(1)}
      </span>
    );
  };

  const canEditUser = permissions?.canManageUsers && user.id !== permissions.user.id;
  const canRemoveUser = permissions?.canRemoveUsers && user.id !== permissions.user.id;
  const canManageRoles = permissions?.canChangeRoles && user.id !== permissions.user.id;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-lg font-semibold text-gray-700">
                    {user.display_name?.[0] || user.first_name?.[0] || user.email?.[0]?.toUpperCase() || '?'}
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {user.display_name || 
                     (user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : null) ||
                     user.email ||
                     'Unknown User'
                    }
                  </h2>
                  <p className="text-sm text-gray-600">{currentOrg?.name || 'Unknown Organization'}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-[calc(90vh-180px)] overflow-y-auto">
            {/* User Information */}
            <div className="px-6 py-4 space-y-6">
              {/* Basic Info */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {user.email && (
                    <div className="flex items-center space-x-3">
                      <Mail className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Email</p>
                        <p className="text-sm text-gray-600 flex items-center">
                          {user.email}
                          {user.email_verified === false && (
                            <span className="ml-2 text-xs text-orange-600 font-medium">(Unverified)</span>
                          )}
                        </p>
                      </div>
                    </div>
                  )}

                  {user.wallet_address && (
                    <div className="flex items-center space-x-3">
                      <User className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Wallet Address</p>
                        <p className="text-sm text-gray-600 font-mono">
                          {user.wallet_address.slice(0, 10)}...{user.wallet_address.slice(-8)}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center space-x-3">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Joined</p>
                      <p className="text-sm text-gray-600">{formatDate(user.created_at)}</p>
                    </div>
                  </div>

                  {user.last_login_at && (
                    <div className="flex items-center space-x-3">
                      <Activity className="w-5 h-5 text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Last Login</p>
                        <p className="text-sm text-gray-600">{formatDate(user.last_login_at)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Status */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Status</h3>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <div className={cn(
                      'w-3 h-3 rounded-full',
                      user.is_active ? 'bg-green-500' : 'bg-red-500'
                    )} />
                    <span className="text-sm font-medium text-gray-900">
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  {user.email_verified !== undefined && (
                    <div className="flex items-center space-x-2">
                      <div className={cn(
                        'w-3 h-3 rounded-full',
                        user.email_verified ? 'bg-green-500' : 'bg-yellow-500'
                      )} />
                      <span className="text-sm font-medium text-gray-900">
                        {user.email_verified ? 'Email Verified' : 'Email Pending'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Roles */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Roles & Permissions</h3>
                  {canManageRoles && (
                    <button
                      onClick={() => setShowRoleManager(true)}
                      className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center"
                    >
                      <Settings className="w-4 h-4 mr-1" />
                      Manage Roles
                    </button>
                  )}
                </div>

                {/* Organization Roles */}
                {user.organization_roles && user.organization_roles.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Organization Roles</p>
                    <div className="flex flex-wrap gap-2">
                      {user.organization_roles.map(role => getRoleBadge(role, false))}
                    </div>
                  </div>
                )}

                {/* System Roles */}
                {user.system_roles && user.system_roles.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">System Roles</p>
                    <div className="flex flex-wrap gap-2">
                      {user.system_roles.map(role => getRoleBadge(role, true))}
                    </div>
                  </div>
                )}

                {(!user.organization_roles || user.organization_roles.length === 0) &&
                 (!user.system_roles || user.system_roles.length === 0) && (
                  <p className="text-sm text-gray-500">No roles assigned</p>
                )}
              </div>

              {/* Organization Details */}
              {permissions?.canViewAllOrganizations && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Organization Details</h3>
                  <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                    <Building2 className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">{user.organization_name}</p>
                      <p className="text-xs text-gray-500">Organization ID: {user.organization_id}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Additional Profile Info */}
              {(user.first_name || user.last_name) && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Profile</h3>
                  <div className="space-y-2">
                    {user.first_name && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">First Name</p>
                        <p className="text-sm text-gray-600">{user.first_name}</p>
                      </div>
                    )}
                    {user.last_name && (
                      <div>
                        <p className="text-sm font-medium text-gray-700">Last Name</p>
                        <p className="text-sm text-gray-600">{user.last_name}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="text-xs text-gray-500">
                User ID: {user.id}
              </div>
              <div className="flex space-x-3">
                {canEditUser && onEdit && (
                  <button
                    onClick={() => onEdit(user)}
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit User
                  </button>
                )}
                
                {canRemoveUser && onRemove && (
                  <button
                    onClick={() => onRemove(user)}
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove User
                  </button>
                )}
                
                <button
                  onClick={onClose}
                  className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Role Manager Modal */}
      <UserRoleManager
        user={user}
        organization={currentOrg}
        isOpen={showRoleManager}
        onClose={() => setShowRoleManager(false)}
      />
    </>
  );
};